const { onRequest } = require("firebase-functions/v2/https");
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
 * Invoked by Admin Dashboard or automated schedulers.
 */
exports.sendPushBroadcast = onRequest({
    region: "asia-southeast1",
    cors: true
}, async (req, res) => {
    // Only allow POST
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method Not Allowed" });
    }

    const { title, body, audience, broadcastId } = req.body || {};
    const pushTitle = title || "NovaFit Pro 🥑";
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
