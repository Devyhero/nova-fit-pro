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
    onSnapshot
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

let currentUser = null;
let cloudSyncTimer = null;
let unsubscribeSnapshot = null;
let isFirstSnapshot = true;
let hasPendingCloudSync = false;

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

    if (user) {
        setupRealtimeCloudListener(user);
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
        if (userAvatar) userAvatar.src = user.photoURL || 'https://www.gravatar.com/avatar/?d=mp';
        if (userName) userName.textContent = user.displayName ? user.displayName.split(' ')[0] : 'ผู้ใช้';
        if (dropdownName) dropdownName.textContent = user.displayName || 'ผู้ใช้งาน NovaFit Pro';
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
}

// Live Real-Time Multi-Device Listener (Phone <-> Computer instant sync)
function setupRealtimeCloudListener(user) {
    isFirstSnapshot = true;
    const userDocRef = doc(db, 'users', user.uid);
    unsubscribeSnapshot = onSnapshot(userDocRef, (snap) => {
        if (!snap.exists()) {
            // First time login: Upload current local state to Firestore
            const isConfigured = !!window.state?.profileConfigured;
            setDoc(userDocRef, {
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                lastUpdatedBy: mySessionId,
                lastUpdatedByDevice: myDeviceId,
                profileConfigured: isConfigured,
                state: window.state
            }).catch(err => console.warn('Init firestore doc failed:', err));

            const userPromptedKey = 'novafit_profile_prompted_' + user.uid;
            const alreadyPrompted = localStorage.getItem(userPromptedKey);

            if (!isConfigured && !alreadyPrompted) {
                localStorage.setItem(userPromptedKey, 'true');
                localStorage.setItem('novafit_profile_prompted', 'true');
                setTimeout(() => {
                    if (window.openProfileSettingsModal) {
                        window.openProfileSettingsModal();
                    }
                    if (window.showToast) {
                        window.showToast(`🎉 ยินดีต้อนรับคุณ ${user.displayName || ''}! กรุณากรอกข้อมูลร่างกายเพื่อเริ่มต้นครับ`);
                    }
                }, 500);
            } else {
                localStorage.setItem(userPromptedKey, 'true');
                if (window.showToast) window.showToast(`🎉 ยินดีต้อนรับคุณ ${user.displayName || ''}! บันทึกข้อมูลขึ้น Cloud แล้ว`);
            }
            return;
        }

        const cloudData = snap.data();
        const userPromptedKey = 'novafit_profile_prompted_' + user.uid;
        if (!cloudData.profileConfigured && !localStorage.getItem(userPromptedKey) && !window.state?.profileConfigured) {
            localStorage.setItem(userPromptedKey, 'true');
            localStorage.setItem('novafit_profile_prompted', 'true');
            setTimeout(() => {
                if (window.openProfileSettingsModal) {
                    window.openProfileSettingsModal();
                }
                if (window.showToast) {
                    window.showToast(`🎉 ยินดีต้อนรับคุณ ${user.displayName || ''}! กรุณากรอกข้อมูลร่างกายเพื่อเริ่มต้นครับ`);
                }
            }, 500);
        } else {
            localStorage.setItem(userPromptedKey, 'true');
        }

        // If this update was saved by THIS exact browser session, ignore to prevent local redraw loops
        if (cloudData.lastUpdatedBy === mySessionId) {
            return;
        }

        // If this device still has pending local writes in flight, let local state lead
        if (snap.metadata && snap.metadata.hasPendingWrites) {
            return;
        }

        // On first snapshot upon entering the app, silently adopt newer cloud data without confusing toasts
        if (isFirstSnapshot) {
            isFirstSnapshot = false;
            if (cloudData && cloudData.state && cloudData.lastUpdatedByDevice !== myDeviceId) {
                if (window.applyCloudState) {
                    window.applyCloudState(cloudData.state);
                }
            }
            const badge = document.getElementById('cloudStatusBadge');
            if (badge) {
                badge.classList.remove('hidden');
                badge.classList.add('flex');
                badge.textContent = '☁️ Cloud ซิงค์แล้ว';
            }
            return;
        }

        // Live real-time update arriving from another active device while running
        if (cloudData && cloudData.state) {
            if (window.applyCloudState) {
                window.applyCloudState(cloudData.state);
            }

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

window.triggerCloudSync = function (showSuccessToast = false) {
    if (!currentUser) return;
    clearTimeout(cloudSyncTimer);
    cloudSyncTimer = setTimeout(async () => {
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

window.handleGoogleLogin = async function () {
    try {
        await signInWithPopup(auth, googleProvider);
    } catch (err) {
        console.error('Google Sign-in error:', err);
        if (err.code === 'auth/operation-not-allowed' || err.code === 'auth/configuration-not-found') {
            alert('⚠️ ยังไม่ได้เปิดใช้งาน Google Sign-In ใน Firebase Console ครับ!\n\nวิธีเปิดง่ายๆ:\n1. เข้า Firebase Console > Authentication > แท็บ "Sign-in method"\n2. คลิกเลือก "Google"\n3. กดเปิดสวิตช์ Enable แล้วกด Save');
        } else if (err.code !== 'auth/popup-closed-by-user') {
            alert('การเข้าสู่ระบบไม่สำเร็จ: ' + (err.message || err.code));
        }
    }
};

window.handleUserLogout = async function () {
    if (!confirm('ต้องการออกจากระบบใช่หรือไม่? (ข้อมูลในเครื่องยังคงอยู่)')) return;
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
            state: window.state
        }, { merge: true }).catch(() => { });
    }
}
window.addEventListener('pagehide', flushPendingSync);

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
                            window.applyCloudState(data.state);
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
