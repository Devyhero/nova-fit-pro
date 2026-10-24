// NovaFit Pro Service Worker (v5.9.21)
const CACHE_NAME = 'novafit-pro-v5.9.21-cache';
const PRECACHE_ASSETS = [
    './',
    './index.html',
    './app.js',
    './mascot-companion.js',
    './food-db.js',
    './health-tips.js',
    './health-tips.json',
    './ai-snap.js',
    './firebase-sync.js',
    './admin.html',
    './admin.js',
    './manifest.json',
    './icon.svg',
    './icon-192.png',
    './icon-512.png',
    './apple-touch-icon.png',
    './favicon.ico',
    './favicon-32x32.png',
    './favicon-16x16.png',
    './version.json',
    './frames/frame-novice.png',
    './frames/frame-bronze.png',
    './frames/frame-silver.png',
    './frames/frame-gold.png',
    './frames/frame-diamond.png',
    './mascot/nova-happy.png',
    './mascot/nova-thirsty.png',
    './mascot/nova-proud.png',
    './mascot/nova-workout.png',
    './mascot/nova-sleepy.png'
];

// Listen for SKIP_WAITING message to activate immediately
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// Install: Pre-cache core shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(PRECACHE_ASSETS);
        }).then(() => self.skipWaiting())
    );
});

// Activate: Clean up old versions immediately & claim clients
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch Strategy
self.addEventListener('fetch', (event) => {
    // 0. Only intercept GET requests. Never intercept POST, PUT, DELETE (e.g. Gemini AI, Firestore writes)
    if (event.request.method !== 'GET') {
        return;
    }

    const url = new URL(event.request.url);

    // 0.1 Bypass Service Worker completely for external APIs (Gemini Vision, Firebase Auth/Firestore, Google APIs)
    if (url.hostname.includes('googleapis.com') ||
        url.hostname.includes('firebase') ||
        url.hostname.includes('identitytoolkit') ||
        url.hostname.includes('securetoken')) {
        return;
    }

    // 0.2 Only handle http and https schemes
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return;
    }

    // 1. version.json: Always check network first to enable live update detection
    if (url.pathname.endsWith('version.json')) {
        event.respondWith(
            fetch(event.request).catch(() => caches.match(event.request))
        );
        return;
    }

    // 2. Navigation requests (HTML documents): Network-First with Cache fallback
    // Crucial: Eliminates the double-reload bug by serving the latest network HTML immediately when online!
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch(() => {
                return caches.match('./index.html') || caches.match(event.request);
            })
        );
        return;
    }

    // 3. For same-origin requests & CDNs: Stale-While-Revalidate
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200 && (url.protocol === 'http:' || url.protocol === 'https:')) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            });

            // Return cached response immediately if available; otherwise wait for network fetch
            return cachedResponse || fetchPromise;
        })
    );
});

// ==========================================
// Web Push Notifications & Background FCM Engine (v5.9.9)
// ==========================================
self.addEventListener('push', (event) => {
    let payload = {
        title: 'NovaFit Pro 🥑',
        body: 'อย่าลืมบันทึกอาหารและดูแลสุขภาพวันนี้นะครับ!',
        icon: 'icon-192.png',
        badge: 'favicon-32x32.png',
        url: './',
        tag: 'novafit-notification'
    };

    if (event.data) {
        try {
            const json = event.data.json();
            if (json.notification) {
                payload.title = json.notification.title || payload.title;
                payload.body = json.notification.body || payload.body;
                if (json.notification.icon) payload.icon = json.notification.icon;
            } else {
                payload.title = json.title || payload.title;
                payload.body = json.body || payload.body;
                if (json.icon) payload.icon = json.icon;
                if (json.url) payload.url = json.url;
            }
            if (json.data) {
                if (json.data.url) payload.url = json.data.url;
                if (json.data.tag) payload.tag = json.data.tag;
            }
        } catch (e) {
            payload.body = event.data.text() || payload.body;
        }
    }

    const options = {
        body: payload.body,
        icon: payload.icon || 'icon-192.png',
        badge: payload.badge || 'favicon-32x32.png',
        vibrate: [120, 60, 120],
        tag: payload.tag || 'novafit-reminder',
        renotify: true,
        data: {
            url: payload.url || './',
            timestamp: Date.now()
        }
    };

    event.waitUntil(
        self.registration.showNotification(payload.title, options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = event.notification.data?.url || './';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                if (client.url.includes('index.html') || client.url.endsWith('/') || client.url.includes(targetUrl)) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});
