const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const webpush = require("web-push");

admin.initializeApp();
const db = admin.firestore();

// VAPID Credentials for NovaFit Pro Web Push (Apple APNs & Google FCM)
const VAPID_PUBLIC_KEY = "BH7nccKTKkAp3vI6Da6DcZgviPRkCl4YFtY5nMewhH6hxDeewB8X6lfTHGMHqhimFZAxFtiDqu_LkbH1UpSd9kw";
const VAPID_PRIVATE_KEY = "HsOrDw3wdx0G9vYd0St_EBxZDHDaudR8aMzpqwmCjXM";

webpush.setVapidDetails(
    "mailto:benznova01@gmail.com",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
);

/**
 * Helper: Get accurate Bangkok (UTC+7) YYYY-MM-DD and HH:mm without UTC shift
 */
function getBangkokDateTime() {
    const now = new Date();
    const bkkParts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Bangkok",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
    }).formatToParts(now);

    const map = {};
    bkkParts.forEach((p) => { map[p.type] = p.value; });
    const todayStr = `${map.year}-${map.month}-${map.day}`;
    const hours = parseInt(map.hour, 10) || 0;
    const minutes = parseInt(map.minute, 10) || 0;
    return {
        todayStr,
        hours,
        minutes,
        totalMinutes: hours * 60 + minutes
    };
}

/**
 * Shared Engine: Evaluates each individual user/guest's water intake for today
 * and dispatches personalized Web Push notifications only to users below thresholdPct.
 */
async function executePersonalizedHydrationDispatch(hConfigInput, todayStr) {
    const hConfig = hConfigInput || {};
    const thresholdPct = Number(hConfig.thresholdPct) || 50;
    const criticalThreshold = Number(hConfig.criticalThreshold) || 25;

    const critMsgs = Array.isArray(hConfig.criticalMsgs) && hConfig.criticalMsgs.length > 0
        ? hConfig.criticalMsgs
        : ["🥱 บ่ายนี้เริ่มล้า สมองตื้ออยู่มั้ย? เช็คดูแล้ววันนี้เพิ่งได้น้ำไปนิดเดียวเอง! ลุกไปจิบน้ำสัก 1 แก้วตอนนี้เลยนะ 💧"];
    const modMsgs = Array.isArray(hConfig.moderateMsgs) && hConfig.moderateMsgs.length > 0
        ? hConfig.moderateMsgs
        : ["🥤 บ่ายนี้เติมความสดชื่นอีกนิด! ดื่มน้ำเพิ่มอีก 1-2 แก้วจะแตะ 50% ของเป้าหมายแล้วนะ 💧"];

    const [usersSnap, guestsSnap, tokensSnap] = await Promise.all([
        db.collection("users").get(),
        db.collection("guest_sessions").get(),
        db.collection("fcm_tokens").get()
    ]);

    // Map user/device water percentages by both uid and deviceId
    const userWaterMap = new Map();
    const processUserWater = (docId, data) => {
        if (!data) return;
        const st = data.state || {};
        const waterLogs = st.waterByDate || {};
        let todayGlasses = 0;
        if (typeof waterLogs[todayStr] === "number") {
            todayGlasses = waterLogs[todayStr];
        } else if (data.stats && typeof data.stats.waterGlassesToday === "number") {
            todayGlasses = data.stats.waterGlassesToday;
        }
        const w = parseFloat(st.profile?.weight || data.weight || 60);
        const targetWaterMl = Math.round(w * 35) || 2000;
        const waterMl = (todayGlasses > 30) ? todayGlasses : (todayGlasses * 250);
        const pct = Math.round((waterMl / targetWaterMl) * 100);
        userWaterMap.set(docId, pct);
        if (data.uid) userWaterMap.set(data.uid, pct);
        if (data.deviceId) userWaterMap.set(data.deviceId, pct);
    };

    usersSnap.forEach((d) => processUserWater(d.id, d.data()));
    guestsSnap.forEach((d) => processUserWater(d.id, d.data()));

    const sendPromises = [];
    let skippedHealthy = 0;
    let criticalSent = 0;
    let moderateSent = 0;
    let iosCount = 0;
    let androidCount = 0;
    let otherCount = 0;

    tokensSnap.forEach((d) => {
        const device = d.data();
        if (!device || !device.pushSubscription || !device.pushSubscription.endpoint) return;
        if (device.notificationPreferences && device.notificationPreferences.hydration === false) return;

        // Resolve user's water % by userId first, then deviceId, then token doc id
        let pct = 0;
        if (device.userId && userWaterMap.has(device.userId)) {
            pct = userWaterMap.get(device.userId);
        } else if (device.deviceId && userWaterMap.has(device.deviceId)) {
            pct = userWaterMap.get(device.deviceId);
        } else if (userWaterMap.has(d.id)) {
            pct = userWaterMap.get(d.id);
        }

        // Do Not Disturb if user already reached threshold (e.g. >= 50%)
        if (pct >= thresholdPct) {
            skippedHealthy++;
            return;
        }

        let chosenMsg = "";
        let title = "";
        if (pct < criticalThreshold) {
            chosenMsg = critMsgs[Math.floor(Math.random() * critMsgs.length)];
            title = "💧 บ่ายนี้ร่างกายต้องการน้ำ!";
            criticalSent++;
        } else {
            chosenMsg = modMsgs[Math.floor(Math.random() * modMsgs.length)];
            title = "🥤 เติมความสดชื่นอีกนิด!";
            moderateSent++;
        }

        const platform = (device.platform || "").toLowerCase();
        if (platform.includes("ios") || platform.includes("apple") || platform.includes("iphone") || platform.includes("ipad")) {
            iosCount++;
        } else if (platform.includes("android")) {
            androidCount++;
        } else {
            otherCount++;
        }

        const payload = JSON.stringify({
            title: title,
            body: chosenMsg,
            icon: "icon-192.png",
            badge: "favicon-32x32.png",
            vibrate: [120, 60, 120],
            tag: `novafit-hydration-${todayStr}`,
            data: { url: "./", timestamp: Date.now() }
        });

        const p = webpush.sendNotification(device.pushSubscription, payload)
            .then(() => ({ success: true, id: d.id }))
            .catch(async (err) => {
                if (err.statusCode === 410 || err.statusCode === 404) {
                    await db.collection("fcm_tokens").doc(d.id).delete();
                }
                return { success: false, id: d.id, error: err.message };
            });
        sendPromises.push(p);
    });

    const results = await Promise.allSettled(sendPromises);
    const delivered = results.filter((r) => r.status === "fulfilled" && r.value.success).length;

    return {
        totalTargeted: sendPromises.length,
        delivered,
        skippedHealthy,
        criticalSent,
        moderateSent,
        ios: iosCount,
        android: androidCount,
        other: otherCount
    };
}

/**
 * Cloud Functions v2: Dispatches native Web Push notifications to all subscribed devices.
 * Invoked by Admin Dashboard (Manual Broadcast, Personalized Hydration & Instant Slot Testers).
 */
exports.sendPushBroadcast = onRequest({
    region: "asia-southeast1",
    cors: true
}, async (req, res) => {
    // Only allow POST
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method Not Allowed" });
    }

    const { title, body, audience, broadcastId, slot, type, hydrationConfig } = req.body || {};

    try {
        // Special Route: Per-user Personalized Hydration Dispatch
        if (type === "personalized_hydration") {
            const { todayStr } = getBangkokDateTime();
            let hConf = hydrationConfig;
            if (!hConf) {
                const hydroDoc = await db.collection("push_schedules").doc("hydration_behavior_config").get();
                hConf = hydroDoc.exists ? (hydroDoc.data()?.config || {}) : {};
            }
            const stats = await executePersonalizedHydrationDispatch(hConf, todayStr);
            return res.status(200).json({
                success: true,
                message: `Dispatched personalized hydration to ${stats.delivered}/${stats.totalTargeted} devices (skipped ${stats.skippedHealthy} healthy users)`,
                stats: {
                    totalSubscribed: stats.totalTargeted,
                    delivered: stats.delivered,
                    skippedHealthy: stats.skippedHealthy,
                    criticalSent: stats.criticalSent,
                    moderateSent: stats.moderateSent,
                    ios: stats.ios,
                    android: stats.android,
                    other: stats.other
                }
            });
        }

        const pushTitle = title || "🥑 บันทึกสุขภาพประจำวัน";
        const pushBody = body || "คุณมีการแจ้งเตือนใหม่จาก NovaFit Pro";
        const targetAudience = audience || "all";

        const payload = JSON.stringify({
            title: pushTitle,
            body: pushBody,
            icon: "icon-192.png",
            badge: "favicon-32x32.png",
            vibrate: [120, 60, 120],
            tag: "novafit-broadcast-" + (broadcastId || Date.now()),
            data: {
                url: "./",
                timestamp: Date.now()
            }
        });

        const tokensSnap = await db.collection("fcm_tokens").get();
        const sendPromises = [];
        let iosCount = 0;
        let androidCount = 0;
        let otherCount = 0;

        tokensSnap.forEach((docSnap) => {
            const device = docSnap.data();
            if (!device) return;

            // Filter by audience
            if (targetAudience === "google" && !device.isMember) return;
            if (targetAudience === "guest" && device.isMember) return;

            // Filter by specific slot preference if specified
            if (slot && device.notificationPreferences && device.notificationPreferences[slot] === false) {
                return;
            }

            if (device.pushSubscription && device.pushSubscription.endpoint) {
                const platform = (device.platform || "").toLowerCase();
                if (platform.includes("ios") || platform.includes("apple") || platform.includes("iphone") || platform.includes("ipad")) {
                    iosCount++;
                } else if (platform.includes("android")) {
                    androidCount++;
                } else {
                    otherCount++;
                }

                const p = webpush.sendNotification(device.pushSubscription, payload)
                    .then(() => ({ success: true, id: docSnap.id }))
                    .catch(async (err) => {
                        console.warn(`❌ Push to ${docSnap.id} failed:`, err.statusCode || err.message);
                        if (err.statusCode === 410 || err.statusCode === 404) {
                            await db.collection("fcm_tokens").doc(docSnap.id).delete();
                            console.log(`🗑️ Removed expired token: ${docSnap.id}`);
                        }
                        return { success: false, id: docSnap.id, error: err.message };
                    });
                sendPromises.push(p);
            }
        });

        const results = await Promise.allSettled(sendPromises);
        const delivered = results.filter(r => r.status === "fulfilled" && r.value.success).length;

        // Record to Firestore push_broadcasts if not already created
        if (!broadcastId) {
            await db.collection("push_broadcasts").add({
                title: pushTitle,
                body: pushBody,
                audience: targetAudience,
                slot: slot || "broadcast",
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                sentBy: "CloudFunction",
                deliveredCount: delivered,
                targetDevices: sendPromises.length
            });
        }

        return res.status(200).json({
            success: true,
            message: `Dispatched to ${delivered}/${sendPromises.length} devices`,
            stats: {
                totalSubscribed: sendPromises.length,
                delivered: delivered,
                ios: iosCount,
                android: androidCount,
                other: otherCount
            }
        });
    } catch (err) {
        console.error("sendPushBroadcast error:", err);
        return res.status(500).json({ error: err.message });
    }
});

/**
 * Cloud Functions v2 Cron Scheduler:
 * Runs automatically every 30 minutes between 07:00 and 22:00 (Asia/Bangkok timezone).
 * Checks push_schedules/main_schedule and hydration_behavior_config to dispatch reminders.
 */
exports.scheduledPushReminders = onSchedule({
    schedule: "*/30 7-22 * * *",
    timeZone: "Asia/Bangkok",
    region: "asia-southeast1"
}, async (event) => {
    try {
        const { todayStr, totalMinutes: currentTotalMinutes } = getBangkokDateTime();

        const schedDoc = await db.collection("push_schedules").doc("main_schedule").get();
        if (schedDoc.exists) {
            const schedData = schedDoc.data() || {};
            const slots = schedData.slots || {};

            for (const [slotKey, slot] of Object.entries(slots)) {
                if (slot.enabled === false) continue;
                if (!slot.time) continue;

                const [slotH, slotM] = slot.time.split(":").map(Number);
                const slotTotalMinutes = slotH * 60 + slotM;

                // Trigger if within a 30-minute window of slot time
                const diff = currentTotalMinutes - slotTotalMinutes;
                if (diff >= 0 && diff < 30) {
                    const dispatchKey = `${todayStr}_${slot.time}`;
                    const lastDispatched = schedData[`lastDispatched_${slotKey}`];
                    if (lastDispatched === todayStr || lastDispatched === dispatchKey) {
                        continue;
                    }

                    const messages = Array.isArray(slot.messages) && slot.messages.length > 0 ? slot.messages : [];
                    let chosenMessage = "";
                    if (messages.length > 0) {
                        chosenMessage = messages[Math.floor(Math.random() * messages.length)];
                    } else {
                        const defaults = {
                            breakfast: "อรุณสวัสดิ์! อาหารเช้าแสนอร่อยรออยู่ อย่าลืมบันทึกแคลลง NovaFit กันนะครับ 🥞",
                            lunch: "เที่ยงแล้ว! แวะพักทานข้าวให้อร่อย แล้วบันทึกมื้อเที่ยงกันนะ 🍲",
                            dinner: "มื้อเย็นวันนี้ทานอะไรดี? บันทึกโภชนาการให้ครบเป้าหมายวันนี้กันครับ 🥗",
                            streakSaver: "🔥 โค้งสุดท้ายก่อนหมดวัน! บันทึกอาหารวันนี้เพื่อรักษาสถิติ Streak กันเถอะ",
                            hydration: "💧 ดื่มน้ำแก้วใหม่กันหน่อย! ร่างกายสดชื่น สมองแล่น เผาผลาญดีขึ้น"
                        };
                        chosenMessage = defaults[slotKey] || "อย่าลืมดูแลสุขภาพและบันทึกอาหารกับ NovaFit Pro นะครับ 🥑";
                    }

                    const pushTitle = `${slot.icon || "🥑"} ${slot.title || "แจ้งเตือนสุขภาพ"}`;

                    const payload = JSON.stringify({
                        title: pushTitle,
                        body: chosenMessage,
                        icon: "icon-192.png",
                        badge: "favicon-32x32.png",
                        vibrate: [120, 60, 120],
                        tag: `novafit-scheduled-${slotKey}-${todayStr}`,
                        data: {
                            url: "./",
                            timestamp: Date.now()
                        }
                    });

                    const tokensSnap = await db.collection("fcm_tokens").get();
                    const sendPromises = [];

                    tokensSnap.forEach((docSnap) => {
                        const device = docSnap.data();
                        if (!device) return;
                        if (device.notificationPreferences && device.notificationPreferences[slotKey] === false) return;

                        if (device.pushSubscription && device.pushSubscription.endpoint) {
                            const p = webpush.sendNotification(device.pushSubscription, payload)
                                .catch(async (err) => {
                                    if (err.statusCode === 410 || err.statusCode === 404) {
                                        await db.collection("fcm_tokens").doc(docSnap.id).delete();
                                    }
                                });
                            sendPromises.push(p);
                        }
                    });

                    await Promise.allSettled(sendPromises);

                    await db.collection("push_schedules").doc("main_schedule").set({
                        [`lastDispatched_${slotKey}`]: dispatchKey,
                        lastDispatchedAt: admin.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });

                    console.log(`⏰ Scheduled reminder for [${slotKey}] dispatched to ${sendPromises.length} devices.`);
                }
            }
        }

        // ----------------------------------------------------
        // 💧 Smart Behavioral Hydration Automated Dispatcher (v5.9.29)
        // Works even if hydration_behavior_config document wasn't created yet!
        // ----------------------------------------------------
        try {
            const hydroDoc = await db.collection("push_schedules").doc("hydration_behavior_config").get();
            const hData = hydroDoc.exists ? (hydroDoc.data() || {}) : {};
            const hConfig = hData.config || {
                enabled: true,
                triggerTime: "14:30",
                thresholdPct: 50,
                criticalThreshold: 25
            };

            if (hConfig.enabled !== false) {
                const triggerTime = hConfig.triggerTime || "14:30";
                const [hH, hM] = triggerTime.split(":").map(Number);
                const hTotalMinutes = (isNaN(hH) ? 14 : hH) * 60 + (isNaN(hM) ? 30 : hM);
                const hDiff = currentTotalMinutes - hTotalMinutes;

                // Trigger if within a 30-minute window of configured triggerTime
                if (hDiff >= 0 && hDiff < 30) {
                    const dispatchKey = `${todayStr}_${triggerTime}`;
                    const lastHydroDispatched = hData.lastDispatchedKey || hData.lastDispatched;
                    if (lastHydroDispatched !== dispatchKey) {
                        const stats = await executePersonalizedHydrationDispatch(hConfig, todayStr);

                        await db.collection("push_schedules").doc("hydration_behavior_config").set({
                            config: hConfig,
                            lastDispatched: `${todayStr} (${triggerTime} น.)`,
                            lastDispatchedKey: dispatchKey,
                            lastDispatchedCount: stats.delivered,
                            skippedHealthyCount: stats.skippedHealthy,
                            lastDispatchedAt: admin.firestore.FieldValue.serverTimestamp()
                        }, { merge: true });

                        console.log(`💧 Smart Behavioral Hydration dispatched to ${stats.delivered}/${stats.totalTargeted} devices (skipped ${stats.skippedHealthy} healthy).`);
                    }
                }
            }
        } catch (hErr) {
            console.warn("Smart Behavioral Hydration dispatch error:", hErr);
        }

        return null;
    } catch (schedErr) {
        console.error("scheduledPushReminders error:", schedErr);
        return null;
    }
});
