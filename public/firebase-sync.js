// ==========================================
// NovaFit Pro - Firebase Auth & Cloud Firestore Real-time Sync (v5.2.1)
// ==========================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import {
    getAuth,
    signInWithPopup,
    GoogleAuthProvider,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";
import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    onSnapshot,
    collection,
    query,
    orderBy,
    updateDoc,
    addDoc
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAdsQGWeZmSgyje6OT8ekH1o3vAoXuwhNY",
    authDomain: "fitmacro-pro-benz.firebaseapp.com",
    projectId: "fitmacro-pro-benz",
    storageBucket: "fitmacro-pro-benz.firebasestorage.app",
    messagingSenderId: "1042669675366",
    appId: "1:1042669675366:web:ca7b10af6e148575301ea7",
    measurementId: "G-37SPY4P1NY"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// Persistent device ID to distinguish between visits on THIS device vs actual remote updates
let myDeviceId = localStorage.getItem('fitmacro_device_id');
if (!myDeviceId) {
    myDeviceId = 'dev_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
    try {
        localStorage.setItem('fitmacro_device_id', myDeviceId);
    } catch (e) { }
}

// Unique ID for this specific browser tab/session
const mySessionId = 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);

// Device Category & Platform Detection for Admin Analytics
const ua = navigator.userAgent || '';
const isMobileDevice = /iPhone|iPad|iPod|Android|Mobile/i.test(ua);
const platformName = /iPhone|iPad|iPod/i.test(ua) ? 'iOS' : /Android/i.test(ua) ? 'Android' : /Macintosh|Mac OS/i.test(ua) ? 'macOS' : /Windows/i.test(ua) ? 'Windows' : 'Other';
const deviceCategory = isMobileDevice ? 'Mobile' : 'Desktop';

let currentUser = null;
let cloudSyncTimer = null;
let unsubscribeSnapshot = null;
let isFirstSnapshot = true;
let hasPendingCloudSync = false;
let isCloudSyncLocked = true; // Lock writes until initial cloud download/merge completes

// Offline status handling
window.addEventListener('offline', () => {
    hasPendingCloudSync = true;
    const badge = document.getElementById('cloudStatusBadge');
    if (badge) {
        badge.classList.remove('hidden');
        badge.classList.add('flex');
        badge.textContent = '📶 ออฟไลน์ (บันทึกในเครื่องแล้ว)';
    }
    const indicator = document.getElementById('cloudSyncIndicator');
    if (indicator) {
        indicator.className = 'w-2 h-2 rounded-full bg-amber-500 animate-pulse';
        indicator.title = 'ออฟไลน์: ข้อมูลถูกบันทึกในเครื่องปลอดภัย เมื่อมีเน็ตจะส่งขึ้น Cloud อัตโนมัติ';
    }
    if (window.showToast) {
        window.showToast('📶 ทำงานแบบออฟไลน์: ข้อมูลบันทึกในเครื่องแล้ว เมื่อต่อเน็ตจะซิงค์ให้อัตโนมัติ');
    }
});

// Online status handling
window.addEventListener('online', () => {
    const badge = document.getElementById('cloudStatusBadge');
    if (badge) {
        badge.classList.remove('hidden');
        badge.classList.add('flex');
        badge.textContent = '☁️ กำลังซิงค์ข้อมูลกับ Cloud...';
    }
    const indicator = document.getElementById('cloudSyncIndicator');
    if (indicator) {
        indicator.className = 'w-2 h-2 rounded-full bg-emerald-500 animate-pulse';
        indicator.title = 'Cloud Firestore ออนไลน์';
    }
    if (currentUser) {
        if (window.showToast) {
            window.showToast('📶 กลับมาออนไลน์แล้ว: กำลังส่งข้อมูลขึ้น Cloud...');
        }
        window.triggerCloudSync(true);
    }
});

// Fetch System AI Configuration (Gemini API Key) from Firestore
async function fetchSystemAiConfig() {
    try {
        const snap = await getDoc(doc(db, 'system_config', 'ai'));
        if (snap.exists()) {
            const aiConfig = snap.data();
            if (aiConfig) {
                if (aiConfig.geminiApiKey) {
                    window._systemGeminiApiKey = aiConfig.geminiApiKey;
                    try {
                        localStorage.setItem('novafit_system_gemini_api_key', aiConfig.geminiApiKey);
                    } catch (e) { }
                }
                if (aiConfig.dailyQuota) {
                    window._systemDailyQuota = Number(aiConfig.dailyQuota);
                    try {
                        localStorage.setItem('novafit_system_daily_quota', aiConfig.dailyQuota);
                    } catch (e) { }
                }
                if (window.updateAiSnapQuotaDisplay) {
                    window.updateAiSnapQuotaDisplay();
                }
            }
        }
    } catch (err) {
        // Non-fatal: if offline or rules block, fallback to cached or manual key
        console.warn('System AI config fetch skipped or failed:', err);
    }
}

// Listen for authentication changes
onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    window.currentUser = user;
    updateAuthUI(user);

    // Clean up previous real-time listener if any
    if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
    }
    if (unsubscribeNotifications) {
        unsubscribeNotifications();
        unsubscribeNotifications = null;
    }

    if (user) {
        setupRealtimeCloudListener(user);
        setupRealtimeNotificationsListener(user);
        fetchSystemAiConfig();
    } else {
        userNotifications = [];
        updateNotificationBadge(0);
        // Phase 1: Trigger Guest Session heartbeat sync
        syncGuestSession();
    }

    if (window.syncPushTokenToCloud) {
        window.syncPushTokenToCloud();
    }

    if (window.updateAiSnapQuotaDisplay) {
        window.updateAiSnapQuotaDisplay();
    }
});

function updateAuthUI(user) {
    const btnLogin = document.getElementById('btnGoogleLogin');
    const userPill = document.getElementById('userProfilePill');
    const userAvatar = document.getElementById('userAvatar');
    const userName = document.getElementById('userName');
    const dropdownName = document.getElementById('dropdownUserFullName');
    const dropdownEmail = document.getElementById('dropdownUserEmail');
    const cloudBadge = document.getElementById('cloudStatusBadge');

    if (user) {
        if (btnLogin) btnLogin.classList.add('hidden');
        if (userPill) userPill.classList.remove('hidden');
        const effectiveAvatar = (window.state && window.state.userAvatarUrl) || user.photoURL || 'https://www.gravatar.com/avatar/?d=mp';
        const effectiveName = (window.state && window.state.userDisplayName) || (user.displayName ? user.displayName.split(' ')[0] : 'ผู้ใช้');
        const effectiveFullName = (window.state && window.state.userDisplayName) || user.displayName || 'ผู้ใช้งาน NovaFit Pro';
        if (userAvatar) userAvatar.src = effectiveAvatar;
        if (userName) userName.textContent = effectiveName;
        if (dropdownName) dropdownName.textContent = effectiveFullName;
        if (dropdownEmail) dropdownEmail.textContent = user.email || '';
        if (cloudBadge) {
            cloudBadge.classList.remove('hidden');
            cloudBadge.classList.add('flex');
            cloudBadge.textContent = '☁️ Cloud ซิงค์แล้ว';
        }
    } else {
        if (btnLogin) btnLogin.classList.remove('hidden');
        if (userPill) userPill.classList.add('hidden');
        if (cloudBadge) {
            cloudBadge.classList.add('hidden');
            cloudBadge.classList.remove('flex');
        }
    }

    const adminLink = document.getElementById('btnAdminDashboard');
    const adminSection = document.getElementById('adminToolsSection');
    const btnGuestWardrobe = document.getElementById('btnGuestWardrobe');
    if (btnGuestWardrobe) {
        btnGuestWardrobe.classList.toggle('hidden', !!user);
    }
    if (window.renderPrestigeFrames) {
        window.renderPrestigeFrames();
    }
    const isAdmin = user && user.email && ['benznova01@gmail.com', 'parinya6969@gmail.com'].includes(user.email.toLowerCase());
    if (adminLink) {
        adminLink.classList.toggle('hidden', !isAdmin);
    }
    if (adminSection) {
        adminSection.classList.toggle('hidden', !isAdmin);
    }
}

// Live Real-Time Multi-Device Listener (Phone <-> Computer instant sync)
function setupRealtimeCloudListener(user) {
    isFirstSnapshot = true;
    isCloudSyncLocked = true;
    const userDocRef = doc(db, 'users', user.uid);

    unsubscribeSnapshot = onSnapshot(userDocRef, (snap) => {
        if (!snap.exists()) {
            // First time login for this Google account! (No existing cloud doc)
            isFirstSnapshot = false;
            isCloudSyncLocked = false;
            setDoc(userDocRef, {
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                lastUpdatedBy: mySessionId,
                lastUpdatedByDevice: myDeviceId,
                deviceCategory: deviceCategory,
                platform: platformName,
                profileConfigured: !!window.state?.profileConfigured,
                state: window.state
            }).catch(err => console.warn('Init firestore doc failed:', err));

            const promptKey = 'novafit_profile_prompted_' + user.uid;
            if (!localStorage.getItem(promptKey)) {
                localStorage.setItem(promptKey, 'true');
                setTimeout(() => {
                    if (window.openProfileSettingsModal) {
                        window.openProfileSettingsModal();
                    }
                    if (window.showToast) {
                        window.showToast(`🎉 ยินดีต้อนรับคุณ ${user.displayName || ''}! กรุณากรอกข้อมูลร่างกายเพื่อเริ่มต้นใช้งาน`);
                    }
                }, 400);
            }
            return;
        }

        const cloudData = snap.data();
        if (!cloudData) {
            isCloudSyncLocked = false;
            return;
        }

        // Always save local safety backup of whatever cloud has
        if (cloudData.state) {
            try {
                localStorage.setItem('novafit_cloud_backup_latest', JSON.stringify(cloudData.state));
                localStorage.setItem('novafit_cloud_backup_time', new Date().toISOString());
            } catch (e) { }
        }

        // If this update was saved by THIS exact active session, ignore to prevent redraw loops
        if (cloudData.lastUpdatedBy === mySessionId) {
            isCloudSyncLocked = false;
            return;
        }

        // On first snapshot upon entering the app / logging in:
        if (isFirstSnapshot) {
            isFirstSnapshot = false;

            const promptKey = 'novafit_profile_prompted_' + user.uid;
            const alreadyPrompted = localStorage.getItem(promptKey);
            const hasExistingWeight = window.state?.profile?.weight && Number(window.state.profile.weight) > 0 && !window._isFirstTimeVisitor;

            if (cloudData && !cloudData.profileConfigured && !alreadyPrompted && !hasExistingWeight) {
                localStorage.setItem(promptKey, 'true');
                setTimeout(() => {
                    if (window.openProfileSettingsModal) {
                        window.openProfileSettingsModal();
                    }
                    if (window.showToast) {
                        window.showToast(`👋 ยินดีต้อนรับคุณ ${user.displayName || ''}! กรุณากรอกข้อมูลร่างกายเพื่อเริ่มต้นใช้งาน`);
                    }
                }, 400);
            }

            // CRITICAL FIX: ALWAYS apply and merge cloud data into local state!
            // Never skip based on myDeviceId, because a computer that opens without login has empty state.
            if (cloudData.state && window.applyCloudState) {
                window.applyCloudState(cloudData.state, true);
            }

            // Unlock uploads only AFTER cloud state has been applied and merged into local state
            isCloudSyncLocked = false;

            const badge = document.getElementById('cloudStatusBadge');
            if (badge) {
                badge.classList.remove('hidden');
                badge.classList.add('flex');
                badge.textContent = '☁️ Cloud ซิงค์แล้ว';
            }
            return;
        }

        // Live real-time update arriving from another active device while running
        if (cloudData.state && window.applyCloudState) {
            window.applyCloudState(cloudData.state, false);
            const badge = document.getElementById('cloudStatusBadge');
            if (badge) {
                badge.classList.remove('hidden');
                badge.classList.add('flex');
                badge.textContent = '⚡ อัปเดตสดจากอุปกรณ์อื่น (' + new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ')';
            }
            if (cloudData.lastUpdatedByDevice !== myDeviceId && window.showToast) {
                window.showToast('⚡ ซิงค์ข้อมูลล่าสุดจากอุปกรณ์อื่นเรียบร้อย!');
            }
        }
    }, (err) => {
        console.warn('Real-time snapshot listener error:', err);
        const badge = document.getElementById('cloudStatusBadge');
        if (badge) badge.textContent = !navigator.onLine ? '📶 ออฟไลน์ (บันทึกในเครื่องแล้ว)' : '⚠️ ซิงค์ขัดข้อง';
    });
}

// ==========================================
// GUEST SESSION HEARTBEAT & ACTIVITY TRACKING (v5.9.4 Phase 1)
// ==========================================
let guestSyncTimer = null;
let lastGuestSyncTime = 0;

async function syncGuestSession(force = false) {
    if (currentUser) return; // Only track unauthenticated visitors
    if (!navigator.onLine) return;

    const now = Date.now();
    // Throttle automatic heartbeats to at most once every 30 seconds unless force=true
    if (!force && (now - lastGuestSyncTime < 30000)) return;

    clearTimeout(guestSyncTimer);
    guestSyncTimer = setTimeout(async () => {
        if (currentUser || !navigator.onLine) return;
        try {
            const guestDocRef = doc(db, 'guest_sessions', myDeviceId);
            const todayStr = (window.getTodayStr && window.getTodayStr()) || new Date().toISOString().split('T')[0];
            const currentState = window.state || {};
            const mealsToday = (currentState.logsByDate && currentState.logsByDate[todayStr]) || [];
            const waterToday = (currentState.waterByDate && currentState.waterByDate[todayStr]) || 0;
            const workoutsToday = (currentState.workoutsByDate && currentState.workoutsByDate[todayStr]) || [];
            const calToday = mealsToday.reduce((sum, m) => sum + (Number(m.cal) || 0), 0);

            let firstSeen = localStorage.getItem('novafit_first_seen');
            if (!firstSeen) {
                firstSeen = new Date().toISOString();
                try { localStorage.setItem('novafit_first_seen', firstSeen); } catch (e) { }
            }

            const guestPayload = {
                deviceId: myDeviceId,
                isGuest: true,
                provider: 'guest',
                displayName: (currentState.userDisplayName ? `${currentState.userDisplayName} (${platformName})` : `ผู้ใช้ทั่วไป (${platformName})`),
                avatarUrl: currentState.userAvatarUrl || '',
                platform: platformName,
                deviceCategory: deviceCategory,
                pwa: !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches),
                firstSeen: firstSeen,
                updatedAt: new Date().toISOString(),
                lastActive: new Date().toISOString(),
                clientVersion: (typeof APP_VERSION !== 'undefined' ? APP_VERSION : '5.9.6'),
                state: currentState,
                stats: {
                    mealsCountToday: mealsToday.length,
                    calToday: calToday,
                    waterGlassesToday: waterToday,
                    workoutsCountToday: workoutsToday.length,
                    streakDays: Number(currentState.streakDays) || 0,
                    prestigeFrame: currentState.prestigeFrame || 'novice'
                }
            };

            await setDoc(guestDocRef, guestPayload, { merge: true });
            lastGuestSyncTime = Date.now();
            console.log('📡 Guest session heartbeat recorded for device:', myDeviceId);
        } catch (err) {
            console.warn('Guest session sync failed quietly:', err);
        }
    }, force ? 100 : 2000);
}
window.syncGuestSession = syncGuestSession;

window.syncProfileDataToCloud = async function () {
    try {
        const customName = (window.state && window.state.userDisplayName) || '';
        const customAvatar = (window.state && window.state.userAvatarUrl) || '';
        if (currentUser && currentUser.uid) {
            const userDocRef = doc(db, 'users', currentUser.uid);
            await setDoc(userDocRef, {
                customDisplayName: customName,
                customAvatarUrl: customAvatar,
                displayName: customName || currentUser.displayName,
                photoURL: customAvatar || currentUser.photoURL,
                updatedAt: new Date().toISOString(),
                lastUpdatedBy: mySessionId
            }, { merge: true });
        } else {
            syncGuestSession(true);
        }
    } catch (e) {
        console.warn('syncProfileDataToCloud error:', e);
    }
};

// ==========================================
// 🛡️ SECURITY AUDIT & ANTI-CHEAT LOGGING (Phase 3)
// ==========================================
window.recordSecurityAuditLog = async function (logData) {
    if (!logData) return;
    try {
        const payload = {
            type: logData.type || 'SUSPICIOUS_ACTIVITY',
            reason: logData.reason || 'Unauthorized modification attempt',
            timestamp: new Date().toISOString(),
            deviceId: myDeviceId,
            userId: currentUser ? currentUser.uid : 'guest',
            userEmail: currentUser ? (currentUser.email || 'authenticated') : 'guest',
            platform: platformName,
            deviceCategory: deviceCategory,
            details: logData.details || {},
            userAgent: navigator.userAgent || 'unknown'
        };
        const logsCol = collection(db, 'security_audit_logs');
        await addDoc(logsCol, payload);
        console.warn('🛡️ Security audit incident recorded:', payload.type, payload.reason);
    } catch (err) {
        console.warn('Could not record security audit log to Firestore:', err);
    }
};

window.triggerCloudSync = function (showSuccessToast = false) {
    if (!currentUser) {
        syncGuestSession();
        return;
    }
    if (isCloudSyncLocked) {
        console.warn('triggerCloudSync paused: Waiting for initial cloud snapshot to merge.');
        return;
    }
    clearTimeout(cloudSyncTimer);
    cloudSyncTimer = setTimeout(async () => {
        if (!currentUser || isCloudSyncLocked) return;
        const badge = document.getElementById('cloudStatusBadge');
        if (!navigator.onLine) {
            hasPendingCloudSync = true;
            if (badge) {
                badge.classList.remove('hidden');
                badge.classList.add('flex');
                badge.textContent = '📶 ออฟไลน์ (บันทึกในเครื่องแล้ว)';
            }
            return;
        }

        try {
            if (badge) {
                badge.classList.remove('hidden');
                badge.classList.add('flex');
                badge.textContent = '☁️ กำลังซิงค์...';
            }
            const userDocRef = doc(db, 'users', currentUser.uid);
            await setDoc(userDocRef, {
                email: currentUser.email,
                displayName: currentUser.displayName,
                photoURL: currentUser.photoURL,
                updatedAt: new Date().toISOString(),
                lastUpdatedBy: mySessionId,
                lastUpdatedByDevice: myDeviceId,
                deviceCategory: deviceCategory,
                platform: platformName,
                profileConfigured: !!window.state?.profileConfigured,
                state: window.state
            }, { merge: true });
            hasPendingCloudSync = false;
            if (badge) {
                badge.textContent = '☁️ ซิงค์แล้ว (' + new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ')';
            }
            if (showSuccessToast && window.showToast) {
                window.showToast('☁️ ซิงค์ข้อมูลล่าสุดขึ้น Cloud เรียบร้อย!');
            }
        } catch (err) {
            console.warn('Auto cloud sync failed:', err);
            hasPendingCloudSync = true;
            if (badge) {
                badge.textContent = !navigator.onLine ? '📶 ออฟไลน์ (บันทึกในเครื่องแล้ว)' : '⚠️ รอซิงค์ใหม่';
            }
        }
    }, 250);
};

window.saveProfileConfiguredToCloud = async function () {
    if (!currentUser) return;
    try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        await setDoc(userDocRef, {
            profileConfigured: true,
            updatedAt: new Date().toISOString()
        }, { merge: true });
    } catch (e) {
        console.warn('saveProfileConfiguredToCloud failed:', e);
    }
};

window.handleGoogleLogin = async function () {
    if (window.showMiniLoader) window.showMiniLoader('กำลังเชื่อมต่อ Google...');
    try {
        await signInWithPopup(auth, googleProvider);
    } catch (err) {
        console.error('Google Sign-in error:', err);
        if (err.code === 'auth/operation-not-allowed' || err.code === 'auth/configuration-not-found') {
            alert('⚠️ ยังไม่ได้เปิดใช้งาน Google Sign-In ใน Firebase Console ครับ!\n\nวิธีเปิดง่ายๆ:\n1. เข้า Firebase Console > Authentication > แท็บ "Sign-in method"\n2. คลิกเลือก "Google"\n3. กดเปิดสวิตช์ Enable แล้วกด Save');
        } else if (err.code !== 'auth/popup-closed-by-user') {
            alert('การเข้าสู่ระบบไม่สำเร็จ: ' + (err.message || err.code));
        }
    } finally {
        if (window.hideMiniLoader) window.hideMiniLoader();
    }
};
window.loginWithGoogle = window.handleGoogleLogin;

window.handleUserLogout = async function () {
    if (!confirm('ต้องการออกจากระบบใช่หรือไม่? (ข้อมูลในเครื่องยังคงอยู่)')) return;
    if (window.showMiniLoader) window.showMiniLoader('กำลังออกจากระบบ...');
    try {
        if (unsubscribeSnapshot) {
            unsubscribeSnapshot();
            unsubscribeSnapshot = null;
        }
        await signOut(auth);
        const dropdown = document.getElementById('userDropdown');
        if (dropdown) dropdown.classList.add('hidden');
        if (window.showToast) window.showToast('🚪 ออกจากระบบเรียบร้อย');
    } catch (err) {
        console.error('Logout error:', err);
    } finally {
        if (window.hideMiniLoader) window.hideMiniLoader();
    }
};

window.manualCloudSync = async function (silent = false) {
    if (!currentUser) {
        if (!silent) alert('กรุณาเข้าสู่ระบบก่อนซิงค์ข้อมูลครับ');
        return;
    }
    if (!navigator.onLine) {
        if (!silent) alert('ขณะนี้ออฟไลน์อยู่ ข้อมูลถูกบันทึกในเครื่องเรียบร้อยแล้ว เมื่อต่อเน็ตจะซิงค์ให้อัตโนมัติครับ');
        return;
    }
    if (!silent && window.showMiniLoader) window.showMiniLoader('กำลังซิงค์ข้อมูล Cloud...');
    try {
        const dropdown = document.getElementById('userDropdown');
        if (dropdown) dropdown.classList.add('hidden');
        if (!silent && window.showToast) window.showToast('🔄 กำลังซิงค์ข้อมูลกับ Cloud Firestore...');
        const userDocRef = doc(db, 'users', currentUser.uid);
        await setDoc(userDocRef, {
            email: currentUser.email,
            displayName: currentUser.displayName,
            photoURL: currentUser.photoURL,
            updatedAt: new Date().toISOString(),
            lastUpdatedBy: mySessionId,
            lastUpdatedByDevice: myDeviceId,
            state: window.state
        }, { merge: true });
        hasPendingCloudSync = false;
        const badge = document.getElementById('cloudStatusBadge');
        if (badge) {
            badge.classList.remove('hidden');
            badge.classList.add('flex');
            badge.textContent = '☁️ ซิงค์แล้ว (' + new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ')';
        }
        if (!silent && window.showToast) window.showToast('✓ ซิงค์ข้อมูลกับ Cloud สำเร็จแล้ว!');
    } catch (err) {
        if (!silent) alert('ไม่สามารถซิงค์ได้: ' + (err.message || err));
    } finally {
        if (!silent && window.hideMiniLoader) window.hideMiniLoader();
    }
};

window.toggleUserDropdown = function () {
    const dropdown = document.getElementById('userDropdown');
    const toolsDropdown = document.getElementById('toolsDropdownMenu');
    if (toolsDropdown) toolsDropdown.classList.add('hidden');
    if (dropdown) dropdown.classList.toggle('hidden');
};

// Immediately flush pending sync if user switches apps on mobile
function flushPendingSync() {
    if (currentUser && cloudSyncTimer && navigator.onLine) {
        clearTimeout(cloudSyncTimer);
        cloudSyncTimer = null;
        const userDocRef = doc(db, 'users', currentUser.uid);
        setDoc(userDocRef, {
            email: currentUser.email,
            displayName: currentUser.displayName,
            photoURL: currentUser.photoURL,
            updatedAt: new Date().toISOString(),
            lastUpdatedBy: mySessionId,
            lastUpdatedByDevice: myDeviceId,
            profileConfigured: !!window.state?.profileConfigured,
            state: window.state
        }, { merge: true }).catch(() => { });
    }
}
window.addEventListener('pagehide', flushPendingSync);

window.saveProfileConfiguredToCloud = async function () {
    if (!currentUser) return;
    try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        await setDoc(userDocRef, {
            profileConfigured: true,
            updatedAt: new Date().toISOString()
        }, { merge: true });
        console.log('✅ Saved profileConfigured: true to Firestore for user:', currentUser.uid);
    } catch (err) {
        console.warn('Failed to save profileConfigured to Firestore:', err);
    }
};

// When switching back to this tab (especially on mobile waking up), refresh if needed
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        flushPendingSync();
    } else if (currentUser) {
        if (hasPendingCloudSync && navigator.onLine) {
            window.triggerCloudSync(true);
        } else if (navigator.onLine) {
            const userDocRef = doc(db, 'users', currentUser.uid);
            getDoc(userDocRef).then(snap => {
                if (snap.exists()) {
                    const data = snap.data();
                    if (data && data.state && data.lastUpdatedByDevice !== myDeviceId) {
                        if (window.applyCloudState) {
                            window.applyCloudState(data.state, false);
                        }
                    }
                }
            }).catch(() => { });
        }
    }
});

document.addEventListener('click', (e) => {
    const pill = document.getElementById('userProfilePill');
    const dropdown = document.getElementById('userDropdown');
    if (pill && dropdown && !pill.contains(e.target)) {
        dropdown.classList.add('hidden');
    }
});

// ==========================================
// Admin Direct Notifications & Messaging Engine (v5.5.0)
// ==========================================

let unsubscribeNotifications = null;
let userNotifications = [];
const seenNotificationIds = new Set();

function setupRealtimeNotificationsListener(user) {
    if (unsubscribeNotifications) {
        unsubscribeNotifications();
        unsubscribeNotifications = null;
    }
    try {
        const notifColRef = collection(db, 'users', user.uid, 'notifications');
        const q = query(notifColRef, orderBy('createdAt', 'desc'));

        unsubscribeNotifications = onSnapshot(q, (snapshot) => {
            userNotifications = [];
            let unreadCount = 0;
            let latestNewUnread = null;

            snapshot.forEach((docSnap) => {
                const notif = {
                    id: docSnap.id,
                    ...docSnap.data()
                };
                userNotifications.push(notif);
                if (!notif.read) {
                    unreadCount++;
                    if (!seenNotificationIds.has(notif.id)) {
                        seenNotificationIds.add(notif.id);
                        if (!latestNewUnread) {
                            latestNewUnread = notif;
                        }
                    }
                }
            });

            updateNotificationBadge(unreadCount);
            renderNotificationsModalList();

            // Pop up if a new unread admin message arrives
            if (latestNewUnread) {
                showAdminMessagePopup(latestNewUnread);
            }
        }, (err) => {
            console.warn('Notifications snapshot error:', err);
        });
    } catch (err) {
        console.warn('Could not setup notifications listener:', err);
    }
}

function updateNotificationBadge(unreadCount) {
    const badge = document.getElementById('unreadNotifBadge');
    if (badge) {
        if (unreadCount > 0) {
            badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }
    const toolsBadge = document.getElementById('toolsUnreadNotifBadge');
    if (toolsBadge) {
        if (unreadCount > 0) {
            toolsBadge.textContent = `${unreadCount} ใหม่`;
            toolsBadge.classList.remove('hidden');
        } else {
            toolsBadge.classList.add('hidden');
        }
    }
}

function showAdminMessagePopup(notif) {
    const modal = document.getElementById('adminMessagePopupModal');
    if (!modal) return;

    const titleEl = document.getElementById('adminPopupTitle');
    const msgEl = document.getElementById('adminPopupMessage');
    const senderEl = document.getElementById('adminPopupSender');
    const timeEl = document.getElementById('adminPopupTime');
    const btnAck = document.getElementById('btnAckAdminMessage');

    if (titleEl) titleEl.textContent = notif.title || 'โดย BenzNova';
    if (msgEl) msgEl.textContent = notif.message || '';
    if (senderEl) senderEl.textContent = 'โดย BenzNova';
    if (timeEl) {
        const d = notif.createdAt ? new Date(notif.createdAt) : new Date();
        timeEl.textContent = d.toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
    }
    if (btnAck) {
        btnAck.onclick = () => {
            window.markNotificationAsRead(notif.id);
            window.closeAdminMessagePopup();
        };
    }

    modal.classList.remove('hidden');
}

window.closeAdminMessagePopup = function () {
    const modal = document.getElementById('adminMessagePopupModal');
    if (modal) modal.classList.add('hidden');
};

window.openUserNotificationsModal = function () {
    const modal = document.getElementById('userNotificationsModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    renderNotificationsModalList();
};

window.closeUserNotificationsModal = function () {
    const modal = document.getElementById('userNotificationsModal');
    if (!modal) return;
    modal.classList.add('hidden');
};

function renderNotificationsModalList() {
    const container = document.getElementById('userNotificationsListContainer');
    if (!container) return;

    if (!currentUser) {
        container.innerHTML = `
            <div class="py-10 text-center text-slate-400 space-y-2">
                <span class="text-3xl block">🔐</span>
                <p>กรุณาเข้าสู่ระบบด้วย Google เพื่อรับการแจ้งเตือน</p>
            </div>
        `;
        return;
    }

    if (userNotifications.length === 0) {
        container.innerHTML = `
            <div class="py-10 text-center text-slate-400 space-y-2">
                <span class="text-3xl block">📭</span>
                <p>ยังไม่มีข้อความหรือการแจ้งเตือนในขณะนี้</p>
            </div>
        `;
        return;
    }

    container.innerHTML = userNotifications.map(n => {
        const d = n.createdAt ? new Date(n.createdAt) : new Date();
        const dateStr = d.toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
        const isUnread = !n.read;

        return `
            <div class="p-3.5 rounded-2xl ${isUnread ? 'bg-purple-500/10 border-purple-500/30 dark:bg-purple-500/15' : 'bg-slate-50 dark:bg-slate-700/40 border-slate-200/80 dark:border-slate-700'} border space-y-2 transition">
                <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2">
                        <span class="text-lg">📢</span>
                        <div>
                            <h4 class="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                                <span>${n.title || 'โดย BenzNova'}</span>
                                ${isUnread ? '<span class="text-[9px] bg-rose-500 text-white font-black px-1.5 py-0.2 rounded-full">ใหม่</span>' : ''}
                            </h4>
                            <span class="text-[10px] text-slate-400">${dateStr} • โดย BenzNova</span>
                        </div>
                    </div>
                    ${isUnread ? `
                        <button type="button" onclick="markNotificationAsRead('${n.id}')" class="px-2.5 py-1 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition shadow-xs">
                            ✓ รับทราบ
                        </button>
                    ` : `
                        <span class="text-[10px] text-slate-400">อ่านแล้ว</span>
                    `}
                </div>
                <p class="text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">${n.message || ''}</p>
            </div>
        `;
    }).join('');
}

window.renderNotificationsModalList = renderNotificationsModalList;

window.markNotificationAsRead = async function (notifId) {
    if (!currentUser || !notifId) return;
    try {
        const notifDocRef = doc(db, 'users', currentUser.uid, 'notifications', notifId);
        await updateDoc(notifDocRef, { read: true });
        const target = userNotifications.find(n => n.id === notifId);
        if (target) target.read = true;
        const unreadCount = userNotifications.filter(n => !n.read).length;
        updateNotificationBadge(unreadCount);
        renderNotificationsModalList();
    } catch (err) {
        console.error('Failed to mark notification as read:', err);
    }
};

window.markAllNotificationsAsRead = async function () {
    if (!currentUser) return;
    const unread = userNotifications.filter(n => !n.read);
    for (const n of unread) {
        try {
            const notifDocRef = doc(db, 'users', currentUser.uid, 'notifications', n.id);
            await updateDoc(notifDocRef, { read: true });
            n.read = true;
        } catch (err) {
            console.error('Failed to mark notif read:', err);
        }
    }
    updateNotificationBadge(0);
    renderNotificationsModalList();
};

window.firebaseDb = db;
window.firestoreCollection = collection;
window.firestoreAddDoc = addDoc;

// ==========================================
// Global AI Food Cloud Cache Engine (v5.8.5)
// ==========================================
window.fetchAiFoodCacheFromCloud = async function(docId) {
    if (!docId) return null;
    try {
        const docRef = doc(db, 'ai_food_cache', docId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            const data = snap.data();
            try {
                updateDoc(docRef, {
                    hitCount: (Number(data.hitCount) || 1) + 1,
                    lastAccessedAt: new Date().toISOString()
                }).catch(() => {});
            } catch (e) {}
            return data;
        }
    } catch (err) {
        console.warn('Cloud food cache lookup error:', err);
    }
    return null;
};

window.saveAiFoodCacheToCloud = async function(docId, data) {
    if (!docId || !data) return false;
    try {
        const docRef = doc(db, 'ai_food_cache', docId);
        await setDoc(docRef, {
            ...data,
            hitCount: 1,
            createdAt: new Date().toISOString(),
            lastAccessedAt: new Date().toISOString(),
            contributedBy: window.currentUser ? window.currentUser.uid : 'anonymous'
        }, { merge: true });
        return true;
    } catch (err) {
        console.warn('Cloud food cache save error:', err);
        return false;
    }
};



// ==========================================
// Safe Backup & Recovery Engine (v5.8.1)
// ==========================================
window.exportUserDataBackup = function () {
    try {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(window.state || {}, null, 2));
        const dlAnchorElem = document.createElement('a');
        const todayStr = (window.getTodayStr && window.getTodayStr()) || new Date().toISOString().split('T')[0];
        dlAnchorElem.setAttribute("href", dataStr);
        dlAnchorElem.setAttribute("download", `novafit_backup_${todayStr}.json`);
        dlAnchorElem.click();
        if (window.showToast) window.showToast('💾 ส่งออกไฟล์สำรองข้อมูลเรียบร้อย');
    } catch (e) {
        alert('ส่งออกข้อมูลไม่สำเร็จ: ' + e.message);
    }
};

window.restoreUserDataBackup = function (jsonString) {
    if (window.showMiniLoader) window.showMiniLoader('กำลังนำเข้าข้อมูลสำรอง...');
    try {
        const parsed = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
        if (!parsed || typeof parsed !== 'object') throw new Error('ไฟล์ข้อมูลไม่ถูกต้อง');
        if (window.applyCloudState) {
            window.applyCloudState(parsed);
        }
        if (window.triggerCloudSync) {
            window.triggerCloudSync(true);
        }
        if (window.showToast) window.showToast('✅ กู้คืนข้อมูลสำเร็จเรียบร้อย');
        return true;
    } catch (e) {
        alert('กู้คืนข้อมูลไม่สำเร็จ: ' + e.message);
        return false;
    } finally {
        setTimeout(() => {
            if (window.hideMiniLoader) window.hideMiniLoader();
        }, 400);
    }
};

// ==========================================
// 🔔 WEB PUSH & FCM TOKEN SYNCHRONIZATION (v5.9.9)
// ==========================================
window.syncPushTokenToCloud = async function (explicitPermission) {
    if (!navigator.onLine) return;
    try {
        const permission = explicitPermission || (typeof Notification !== 'undefined' ? Notification.permission : 'default');
        const tokenDocRef = doc(db, 'fcm_tokens', myDeviceId);

        const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
        const isAndroid = /android/i.test(navigator.userAgent);
        const isPwa = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

        const payload = {
            deviceId: myDeviceId,
            sessionId: mySessionId,
            permission: permission,
            platform: isIos ? 'ios' : isAndroid ? 'android' : 'desktop',
            isPwa: isPwa,
            isAppleWatchEligible: isIos,
            userId: currentUser ? currentUser.uid : null,
            userEmail: currentUser ? currentUser.email : null,
            userDisplayName: (window.state && window.state.userDisplayName) || (currentUser && currentUser.displayName) || 'Guest',
            isMember: !!currentUser,
            fcmToken: `fcm_${myDeviceId}`,
            userAgent: navigator.userAgent,
            notificationPreferences: (window.state && window.state.notificationPreferences) || {
                breakfast: true,
                lunch: true,
                dinner: true,
                streakSaver: true,
                hydration: true
            },
            updatedAt: new Date().toISOString()
        };

        await setDoc(tokenDocRef, payload, { merge: true });
        console.log('🔔 Push token synchronized with cloud:', permission, myDeviceId);
    } catch (err) {
        console.warn('syncPushTokenToCloud skipped/failed:', err);
    }
};
