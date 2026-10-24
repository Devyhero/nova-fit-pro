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
 * Cloud Functions v2: Dispatches native Web Push notifications to all subscribed devices.
 * Invoked by Admin Dashboard (Manual Broadcast & Instant Slot Testers).
 */
exports.sendPushBroadcast = onRequest({
    region: "asia-southeast1",
    cors: true
}, async (req, res) => {
    // Only allow POST
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method Not Allowed" });
    }

    const { title, body, audience, broadcastId, slot } = req.body || {};
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

    try {
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
 * Checks push_schedules/main_schedule and dispatches meals/hydration/streak reminders to devices.
 */
exports.scheduledPushReminders = onSchedule({
    schedule: "*/30 7-22 * * *",
    timeZone: "Asia/Bangkok",
    region: "asia-southeast1"
}, async (event) => {
    try {
        const schedDoc = await db.collection("push_schedules").doc("main_schedule").get();
        if (!schedDoc.exists) return null;

        const schedData = schedDoc.data() || {};
        const slots = schedData.slots || {};

        // Current Bangkok time
        const nowBkk = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
        const currentHours = nowBkk.getHours();
        const currentMinutes = nowBkk.getMinutes();
        const currentTotalMinutes = currentHours * 60 + currentMinutes;
        const todayStr = nowBkk.toISOString().slice(0, 10);

        for (const [slotKey, slot] of Object.entries(slots)) {
            if (slot.enabled === false) continue;
            if (!slot.time) continue;

            const [slotH, slotM] = slot.time.split(":").map(Number);
            const slotTotalMinutes = slotH * 60 + slotM;

            // Trigger if within a 30-minute window of slot time
            const diff = currentTotalMinutes - slotTotalMinutes;
            if (diff >= 0 && diff < 30) {
                // Check if already dispatched today to avoid double sending
                const lastDispatched = schedData[`lastDispatched_${slotKey}`];
                if (lastDispatched === todayStr) {
                    continue;
                }

                // Pick random message
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

                // Send push to all devices subscribed to this slot
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

                // Update last dispatched date in Firestore
                await db.collection("push_schedules").doc("main_schedule").set({
                    [`lastDispatched_${slotKey}`]: todayStr,
                    lastDispatchedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });

                console.log(`⏰ Scheduled reminder for [${slotKey}] dispatched to ${sendPromises.length} devices.`);
            }
        }

        // ----------------------------------------------------
        // 💧 Smart Behavioral Hydration Automated Dispatcher (v5.9.17)
        // ----------------------------------------------------
        try {
            const hydroDoc = await db.collection("push_schedules").doc("hydration_behavior_config").get();
            if (hydroDoc.exists) {
                const hConfig = hydroDoc.data()?.config || {};
                const triggerTime = hConfig.triggerTime || "14:30";
                const [hH, hM] = triggerTime.split(":").map(Number);
                const hTotalMinutes = (hH || 14) * 60 + (hM || 30);
                const hDiff = currentTotalMinutes - hTotalMinutes;

                // Trigger if within a 30-minute window of trigger time
                if (hDiff >= 0 && hDiff < 30) {
                    const lastHydroDispatched = hydroDoc.data()?.lastDispatched;
                    if (lastHydroDispatched !== todayStr) {
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

                        // Map user/device water states
                        const userWaterMap = new Map();
                        const processUserWater = (docId, data) => {
                            const st = data.state || {};
                            const waterLogs = st.waterByDate || {};
                            let todayGlasses = 0;
                            if (typeof waterLogs[todayStr] === 'number') {
                                todayGlasses = waterLogs[todayStr];
                            } else if (data.stats && typeof data.stats.waterGlassesToday === 'number') {
                                todayGlasses = data.stats.waterGlassesToday;
                            }
                            const w = parseFloat(st.profile?.weight || data.weight || 60);
                            const targetWaterMl = Math.round(w * 35) || 2000;
                            const waterMl = (todayGlasses > 30) ? todayGlasses : (todayGlasses * 250);
                            const pct = Math.round((waterMl / targetWaterMl) * 100);
                            userWaterMap.set(docId, pct);
                        };

                        usersSnap.forEach(d => processUserWater(d.id, d.data()));
                        guestsSnap.forEach(d => processUserWater(d.id, d.data()));

                        // Send personalized notification to each device
                        const hydroPromises = [];
                        tokensSnap.forEach(d => {
                            const device = d.data();
                            if (!device || !device.pushSubscription || !device.pushSubscription.endpoint) return;

                            // Match user by userId or deviceId
                            const uid = device.userId || device.deviceId || d.id;
                            const pct = userWaterMap.has(uid) ? userWaterMap.get(uid) : 0;

                            // If >= 50%, do not disturb!
                            if (pct >= (hConfig.thresholdPct || 50)) return;

                            let chosenMsg = '';
                            let title = '';
                            if (pct < (hConfig.criticalThreshold || 25)) {
                                chosenMsg = critMsgs[Math.floor(Math.random() * critMsgs.length)];
                                title = '💧 บ่ายนี้ร่างกายต้องการน้ำ!';
                            } else {
                                chosenMsg = modMsgs[Math.floor(Math.random() * modMsgs.length)];
                                title = '🥤 เติมความสดชื่นอีกนิด!';
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
                                .catch(async (err) => {
                                    if (err.statusCode === 410 || err.statusCode === 404) {
                                        await db.collection("fcm_tokens").doc(d.id).delete();
                                    }
                                });
                            hydroPromises.push(p);
                        });

                        await Promise.allSettled(hydroPromises);

                        await db.collection("push_schedules").doc("hydration_behavior_config").set({
                            lastDispatched: todayStr,
                            lastDispatchedCount: hydroPromises.length,
                            lastDispatchedAt: admin.firestore.FieldValue.serverTimestamp()
                        }, { merge: true });

                        console.log(`💧 Smart Behavioral Hydration dispatched to ${hydroPromises.length} devices.`);
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
