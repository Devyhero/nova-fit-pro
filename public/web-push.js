/**
 * NovaFit Pro - Web Push Notifications & FCM Engine (v5.9.30)
 * Handles browser push permission negotiation, status UI badges,
 * smart delayed onboarding prompt banners, local/watch notification dispatch,
 * and integration with Firebase Cloud Messaging (FCM).
 */

(function () {
    'use strict';

    // Safe inter-module helpers
    function showToastSafe(msg, duration = 2200) {
        if (typeof showToast === 'function') return showToast(msg);
        if (typeof window.showToast === 'function') return window.showToast(msg, duration);
    }

    function syncPushTokenToCloudSafe() {
        if (typeof window.syncPushTokenToCloud === 'function') {
            window.syncPushTokenToCloud();
        }
    }

    // ==========================================
    // Web Push Notifications & FCM Engine
    // ==========================================
    function getPushPermissionState() {
        if (!('Notification' in window)) return 'unsupported';
        return Notification.permission;
    }

    function updatePushStatusUI() {
        const perm = getPushPermissionState();
        const badge = document.getElementById('pushStatusBadge');
        const btn = document.getElementById('btnTogglePush');

        if (badge) {
            if (perm === 'granted') {
                badge.className = 'text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold';
                badge.textContent = 'เปิด';
            } else if (perm === 'denied') {
                badge.className = 'text-[10px] px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold';
                badge.textContent = 'บล็อก';
            } else if (perm === 'unsupported') {
                badge.className = 'text-[10px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 font-bold';
                badge.textContent = 'ไม่รองรับ';
            } else {
                badge.className = 'text-[10px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 font-bold';
                badge.textContent = 'ปิด';
            }
        }

        const btnWatch = document.getElementById('btnTestWatchDelay');
        if (btnWatch) {
            btnWatch.classList.toggle('hidden', perm !== 'granted');
        }

        if (perm === 'granted' || perm === 'denied') {
            dismissPushPrompt(false);
        }
    }

    async function requestPushPermission(isUserAction = true) {
        if (!('Notification' in window)) {
            if (isUserAction) alert('เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน Web Push ครับ');
            return false;
        }

        try {
            const permission = await Notification.requestPermission();
            updatePushStatusUI();

            if (permission === 'granted') {
                dismissPushPrompt(false);
                if (isUserAction) {
                    showToastSafe('🎉 เปิดการแจ้งเตือนสำเร็จ! รองรับสั่นเตือนบน Apple Watch & สมาร์ตวอทช์');
                }
                syncPushTokenToCloudSafe();
                return true;
            } else if (permission === 'denied') {
                dismissPushPrompt(true);
                if (isUserAction) {
                    alert('คุณได้ปฏิเสธการแจ้งเตือนไว้ สามารถไปเปิดใหม่ได้ที่ การตั้งค่าเบราว์เซอร์ > การแจ้งเตือน ครับ');
                }
                return false;
            }
        } catch (err) {
            console.warn('Push permission request error:', err);
            return false;
        }
    }

    function requestPushPermissionFromBanner() {
        requestPushPermission(true);
    }

    function dismissPushPrompt(recordDismiss = true) {
        const banner = document.getElementById('pushPromptBanner');
        if (!banner) return;
        banner.classList.add('translate-y-20', 'opacity-0');
        setTimeout(() => {
            banner.classList.add('hidden');
        }, 500);
        if (recordDismiss) {
            try {
                localStorage.setItem('novafit_push_dismissed', Date.now().toString());
            } catch (e) {}
        }
    }

    function checkPushPromptEligibility() {
        if (!('Notification' in window)) return;
        if (Notification.permission !== 'default') return;

        const lastDismiss = localStorage.getItem('novafit_push_dismissed');
        if (lastDismiss) {
            const daysAgo = (Date.now() - parseInt(lastDismiss, 10)) / (1000 * 60 * 60 * 24);
            if (daysAgo < 5) return;
        }

        setTimeout(() => {
            const banner = document.getElementById('pushPromptBanner');
            if (banner && Notification.permission === 'default') {
                banner.classList.remove('hidden');
                requestAnimationFrame(() => {
                    banner.classList.remove('translate-y-20', 'opacity-0');
                });
            }
        }, 3000);
    }

    async function testLocalNotification(customTitle, customBody, delaySeconds = 0) {
        const title = customTitle || 'NovaFit Pro 🥑';
        const body = customBody || '🔔 ทดสอบการแจ้งเตือน! พร้อมสั่นเตือนบนข้อมือ Apple Watch & สมาร์ตวอทช์ของคุณ';

        if (delaySeconds > 0) {
            showToastSafe(`⏱️ จะส่งแจ้งเตือนใน ${delaySeconds} วิ... รีบล็อคหน้าจอเพื่อดูบน Apple Watch!`, 4000);
            await new Promise(r => setTimeout(r, delaySeconds * 1000));
        }

        const options = {
            body: body,
            icon: 'icon-192.png',
            badge: 'favicon-32x32.png',
            vibrate: [120, 60, 120],
            tag: 'novafit-notification-' + Date.now(),
            renotify: true,
            data: { url: './' }
        };

        // Priority 1: Service Worker Registration showNotification (Works on iOS 16.4+ PWA & Android)
        if ('serviceWorker' in navigator) {
            try {
                const reg = await navigator.serviceWorker.ready;
                if (reg && reg.showNotification) {
                    await reg.showNotification(title, options);
                    console.log('✅ ServiceWorker showNotification delivered:', title);
                    return;
                }
            } catch (err) {
                console.warn('ServiceWorker showNotification failed:', err);
            }
        }

        // Priority 2: Fallback for Desktop browsers supporting new Notification() (Never call on iOS)
        const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
        if (!isIos && 'Notification' in window && Notification.permission === 'granted') {
            try {
                new Notification(title, {
                    body: body,
                    icon: 'icon-192.png'
                });
                console.log('✅ Desktop new Notification delivered:', title);
            } catch (err) {
                console.warn('Desktop new Notification failed:', err);
            }
        }
    }

    function togglePushNotificationPermission() {
        const perm = getPushPermissionState();
        if (perm === 'granted') {
            testLocalNotification();
            showToastSafe('🔔 ส่งข้อความทดสอบไปยังเครื่องของคุณแล้ว!');
        } else {
            requestPushPermission(true);
        }
    }

    // Attach to window for global access and backward compatibility
    window.getPushPermissionState = getPushPermissionState;
    window.updatePushStatusUI = updatePushStatusUI;
    window.requestPushPermission = requestPushPermission;
    window.requestPushPermissionFromBanner = requestPushPermissionFromBanner;
    window.dismissPushPrompt = dismissPushPrompt;
    window.checkPushPromptEligibility = checkPushPromptEligibility;
    window.testLocalNotification = testLocalNotification;
    window.togglePushNotificationPermission = togglePushNotificationPermission;
})();
