// ==========================================
// NovaFit Pro - Admin Dashboard Logic (v5.4.0)
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
    collection,
    getDocs,
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

// Authorized Admin Emails
const ADMIN_EMAILS = [
    'benznova01@gmail.com',
    'parinya6969@gmail.com'
];

let currentUser = null;
let allUsersData = [];

function getTodayStr() {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().split('T')[0];
}

// Auth State Listener
onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    const authGate = document.getElementById('adminAuthGate');
    const panel = document.getElementById('adminPanel');
    const btnLogout = document.getElementById('btnAdminLogout');
    const errBox = document.getElementById('adminLoginError');

    if (!user) {
        if (authGate) authGate.classList.remove('hidden');
        if (panel) panel.classList.add('hidden');
        if (btnLogout) btnLogout.classList.add('hidden');
        return;
    }

    const email = (user.email || '').toLowerCase();
    if (!ADMIN_EMAILS.includes(email)) {
        if (authGate) authGate.classList.remove('hidden');
        if (panel) panel.classList.add('hidden');
        if (btnLogout) btnLogout.classList.remove('hidden');
        if (errBox) {
            errBox.classList.remove('hidden');
            errBox.innerHTML = `🚫 <b>การเข้าถึงถูกปฏิเสธ (403 Forbidden):</b> บัญชี <b>${email}</b> ไม่มีสิทธิ์เข้าถึงหน้านี้ กรุณาเข้าสู่ระบบด้วยบัญชีผู้ดูแลระบบ (benznova01@gmail.com)`;
        }
        return;
    }

    // Authorized
    if (authGate) authGate.classList.add('hidden');
    if (panel) panel.classList.remove('hidden');
    if (btnLogout) btnLogout.classList.remove('hidden');
    if (errBox) errBox.classList.add('hidden');

    document.getElementById('adminName').textContent = user.displayName || 'Admin';
    document.getElementById('adminEmail').textContent = user.email || '';
    if (user.photoURL) {
        document.getElementById('adminPhoto').src = user.photoURL;
    }

    await loadAllUserData();
});

window.handleAdminGoogleLogin = async function () {
    try {
        await signInWithPopup(auth, googleProvider);
    } catch (err) {
        console.error('Admin Google sign-in failed:', err);
        const errBox = document.getElementById('adminLoginError');
        if (errBox) {
            errBox.classList.remove('hidden');
            errBox.textContent = 'เข้าสู่ระบบไม่สำเร็จ: ' + (err.message || 'เกิดข้อผิดพลาด');
        }
    }
};

window.handleAdminSignOut = async function () {
    try {
        await signOut(auth);
        window.location.reload();
    } catch (err) {
        console.error('Sign out error:', err);
    }
};

// Fetch All Users from Cloud Firestore
window.loadAllUserData = async function () {
    const refreshIcon = document.getElementById('refreshIcon');
    if (refreshIcon) refreshIcon.classList.add('animate-spin');

    try {
        const querySnapshot = await getDocs(collection(db, 'users'));
        allUsersData = [];

        querySnapshot.forEach((docSnap) => {
            allUsersData.push({
                uid: docSnap.id,
                ...docSnap.data()
            });
        });

        renderAdminOverview();
    } catch (err) {
        console.error('Failed to load users data:', err);
        alert('เกิดข้อผิดพลาดในการดึงข้อมูลจาก Cloud Firestore: ' + err.message);
    } finally {
        if (refreshIcon) refreshIcon.classList.remove('animate-spin');
    }
};

function renderAdminOverview() {
    const todayStr = getTodayStr();

    let totalUsers = allUsersData.length;
    let activeToday = 0;
    let totalMealsToday = 0;
    let totalWaterToday = 0;

    const foodCountMap = {};
    const workoutCountMap = {};
    const customPresetsPool = [];

    allUsersData.forEach(user => {
        const state = user.state || {};
        const updatedAt = user.updatedAt ? new Date(user.updatedAt) : null;

        // Check if active today
        const isUpdatedToday = updatedAt && updatedAt.toISOString().split('T')[0] === todayStr;
        const mealsToday = (state.logsByDate && state.logsByDate[todayStr]) || [];
        const waterToday = (state.waterByDate && state.waterByDate[todayStr]) || 0;
        const workoutsToday = (state.workoutsByDate && state.workoutsByDate[todayStr]) || [];

        if (isUpdatedToday || mealsToday.length > 0 || waterToday > 0 || workoutsToday.length > 0) {
            activeToday++;
        }

        totalMealsToday += mealsToday.length;
        totalWaterToday += waterToday;

        // Tally all foods logged across dates
        if (state.logsByDate) {
            Object.values(state.logsByDate).forEach(meals => {
                if (Array.isArray(meals)) {
                    meals.forEach(m => {
                        foodCountMap[m.name] = (foodCountMap[m.name] || 0) + 1;
                    });
                }
            });
        }

        // Tally workouts
        if (state.workoutsByDate) {
            Object.values(state.workoutsByDate).forEach(workouts => {
                if (Array.isArray(workouts)) {
                    workouts.forEach(w => {
                        workoutCountMap[w.name] = (workoutCountMap[w.name] || 0) + 1;
                    });
                }
            });
        }

        // Custom presets
        if (Array.isArray(state.customPresets)) {
            state.customPresets.forEach(preset => {
                customPresetsPool.push({
                    ...preset,
                    author: user.displayName || user.email || 'ผู้ใช้'
                });
            });
        }
    });

    // Update KPIs
    document.getElementById('statTotalUsers').textContent = totalUsers.toLocaleString();
    document.getElementById('statActiveToday').textContent = activeToday.toLocaleString();
    document.getElementById('statTotalMeals').textContent = totalMealsToday.toLocaleString();
    document.getElementById('statTotalWater').textContent = totalWaterToday.toLocaleString();
    document.getElementById('userCountBadge').textContent = totalUsers;

    // Render Users Table
    renderUsersTable(allUsersData);

    // Render Top Foods
    renderTopFoods(foodCountMap);

    // Render Top Workouts
    renderTopWorkouts(workoutCountMap);

    // Render Custom Presets
    renderCustomPresets(customPresetsPool);
}

function renderUsersTable(users) {
    const tbody = document.getElementById('usersTableBody');
    const todayStr = getTodayStr();

    if (!users || users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-slate-400">ไม่พบรายชื่อผู้ใช้งาน</td></tr>`;
        return;
    }

    // Sort by latest updatedAt
    const sorted = [...users].sort((a, b) => {
        const tA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const tB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return tB - tA;
    });

    tbody.innerHTML = sorted.map(u => {
        const state = u.state || {};
        const p = state.profile || {};
        const photo = u.photoURL || 'icon.svg';
        const name = u.displayName || 'ผู้ใช้ทั่วไป';
        const email = u.email || 'ไม่มีอีเมล';
        const weight = p.weight ? `${p.weight} kg` : '-';
        const targetCal = p.weight ? Math.round(10 * p.weight + 6.25 * (p.height || 170) - 5 * (p.age || 30) + (p.gender === 'female' ? -161 : 5)) : 2000;

        const mealsToday = (state.logsByDate && state.logsByDate[todayStr]) || [];
        const calToday = mealsToday.reduce((s, m) => s + (m.cal || 0), 0);
        const waterToday = (state.waterByDate && state.waterByDate[todayStr]) || 0;

        const updatedStr = u.updatedAt ? formatTimeAgo(new Date(u.updatedAt)) : 'ยังไม่มีประวัติ';

        return `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">
                <td class="py-3 px-4">
                    <div class="flex items-center gap-2.5">
                        <img src="${photo}" class="w-8 h-8 rounded-full border border-purple-500/30 object-cover" onerror="this.src='icon.svg'">
                        <div>
                            <div class="font-bold text-slate-800 dark:text-slate-100">${name}</div>
                            <div class="text-[11px] text-slate-400">${email}</div>
                        </div>
                    </div>
                </td>
                <td class="py-3 px-3">
                    <div class="font-semibold text-slate-700 dark:text-slate-200">${weight}</div>
                    <div class="text-[11px] text-slate-400">เป้า: ~${targetCal.toLocaleString()} kcal</div>
                </td>
                <td class="py-3 px-3">
                    <div class="font-bold ${calToday > 0 ? 'text-emerald-500' : 'text-slate-400'}">${calToday.toLocaleString()} kcal (${mealsToday.length} มื้อ)</div>
                    <div class="text-[11px] text-sky-500">💧 ${waterToday} แก้ว</div>
                </td>
                <td class="py-3 px-3 text-slate-500 dark:text-slate-400">
                    ${updatedStr}
                </td>
                <td class="py-3 px-4 text-right">
                    <div class="flex items-center justify-end gap-1.5 flex-wrap">
                        <button type="button" onclick="openSendMessageModal('${u.uid}', '${(name || '').replace(/'/g, "\\'")}', '${(email || '').replace(/'/g, "\\'")}')" class="px-2.5 py-1.5 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/25 font-bold transition shadow-xs text-xs flex items-center gap-1">
                            💬 ส่งข้อความ
                        </button>
                        <button type="button" onclick="inspectUser('${u.uid}')" class="px-2.5 py-1.5 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30 hover:bg-purple-500/25 font-bold transition shadow-xs text-xs">
                            👁️ ส่องไดอารี่
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function renderTopFoods(foodCountMap) {
    const container = document.getElementById('topFoodsList');
    const sorted = Object.entries(foodCountMap).sort((a, b) => b[1] - a[1]).slice(0, 10);

    if (sorted.length === 0) {
        container.innerHTML = `<div class="text-slate-400">ยังไม่มีข้อมูลอาหารที่ถูกบันทึก</div>`;
        return;
    }

    container.innerHTML = sorted.map(([name, count], index) => {
        return `
            <div class="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-700/40">
                <div class="flex items-center gap-2">
                    <span class="w-5 text-center font-bold text-slate-400">${index + 1}.</span>
                    <span class="font-semibold text-slate-700 dark:text-slate-200">${name}</span>
                </div>
                <span class="px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-600 dark:text-purple-400 font-bold">${count} ครั้ง</span>
            </div>
        `;
    }).join('');
}

function renderTopWorkouts(workoutCountMap) {
    const container = document.getElementById('topWorkoutsList');
    const sorted = Object.entries(workoutCountMap).sort((a, b) => b[1] - a[1]).slice(0, 10);

    if (sorted.length === 0) {
        container.innerHTML = `<div class="text-slate-400">ยังไม่มีข้อมูลการออกกำลังกายที่ถูกบันทึก</div>`;
        return;
    }

    container.innerHTML = sorted.map(([name, count], index) => {
        return `
            <div class="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-700/40">
                <div class="flex items-center gap-2">
                    <span class="w-5 text-center font-bold text-slate-400">${index + 1}.</span>
                    <span class="font-semibold text-slate-700 dark:text-slate-200">${name}</span>
                </div>
                <span class="px-2 py-0.5 rounded-md bg-orange-500/15 text-orange-600 dark:text-orange-400 font-bold">${count} ครั้ง</span>
            </div>
        `;
    }).join('');
}

function renderCustomPresets(presets) {
    const container = document.getElementById('customPresetsContainer');
    const badge = document.getElementById('customPresetsCountBadge');
    if (badge) badge.textContent = `${presets.length} รายการ`;

    if (presets.length === 0) {
        container.innerHTML = `<div class="col-span-full py-8 text-center text-slate-400">ยังไม่มีผู้ใช้เพิ่มเมนูอาหารส่วนตัว</div>`;
        return;
    }

    container.innerHTML = presets.map(item => {
        const cal = item.calories || Math.round((item.protein || 0) * 4 + (item.carbs || 0) * 4 + (item.fat || 0) * 9);
        return `
            <div class="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 space-y-1.5 shadow-xs">
                <div class="flex items-center justify-between gap-1.5">
                    <div class="font-bold text-slate-800 dark:text-slate-100 truncate">${item.name}</div>
                    <span class="text-xs font-bold text-emerald-500">${cal} kcal</span>
                </div>
                <div class="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                    <span class="text-blue-500">P:${item.protein || 0}g</span>
                    <span class="text-amber-500">C:${item.carbs || 0}g</span>
                    <span class="text-rose-500">F:${item.fat || 0}g</span>
                </div>
                <div class="text-[10px] text-slate-400 truncate">โดย: ${item.author}</div>
            </div>
        `;
    }).join('');
}

window.filterUsersList = function (query) {
    const q = (query || '').trim().toLowerCase();
    if (!q) {
        renderUsersTable(allUsersData);
        return;
    }

    const filtered = allUsersData.filter(u => {
        const name = (u.displayName || '').toLowerCase();
        const email = (u.email || '').toLowerCase();
        return name.includes(q) || email.includes(q);
    });

    renderUsersTable(filtered);
};

window.switchAdminTab = function (tabId) {
    ['users', 'foods', 'custom_presets', 'message_logs'].forEach(t => {
        const btn = document.getElementById('tabBtn_' + t);
        const view = document.getElementById('tabView_' + t);
        if (btn) {
            btn.className = t === tabId
                ? 'px-4 py-2 rounded-xl font-bold text-xs sm:text-sm bg-purple-600 text-white shadow-xs transition shrink-0'
                : 'px-4 py-2 rounded-xl font-bold text-xs sm:text-sm bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-purple-500 transition shrink-0';
        }
        if (view) {
            view.classList.toggle('hidden', t !== tabId);
        }
    });

    if (tabId === 'message_logs' && window.loadAdminMessageLogs) {
        window.loadAdminMessageLogs();
    }
};

window.inspectUser = function (uid) {
    const user = allUsersData.find(u => u.uid === uid);
    if (!user) return;

    const state = user.state || {};
    const p = state.profile || {};
    const todayStr = getTodayStr();
    const mealsToday = (state.logsByDate && state.logsByDate[todayStr]) || [];
    const waterToday = (state.waterByDate && state.waterByDate[todayStr]) || 0;
    const workoutsToday = (state.workoutsByDate && state.workoutsByDate[todayStr]) || [];

    document.getElementById('inspectUserName').textContent = user.displayName || 'ผู้ใช้';
    document.getElementById('inspectUserEmail').textContent = user.email || uid;
    document.getElementById('inspectUserPhoto').src = user.photoURL || 'icon.svg';

    const sumP = Math.round(mealsToday.reduce((s, m) => s + (m.p || 0), 0));
    const sumC = Math.round(mealsToday.reduce((s, m) => s + (m.c || 0), 0));
    const sumF = Math.round(mealsToday.reduce((s, m) => s + (m.f || 0), 0));
    const sumCal = Math.round(mealsToday.reduce((s, m) => s + (m.cal || 0), 0));

    const bodyEl = document.getElementById('inspectUserBody');
    const safeName = (user.displayName || 'ผู้ใช้').replace(/'/g, "\\'");
    const safeEmail = (user.email || '').replace(/'/g, "\\'");

    bodyEl.innerHTML = `
        <div class="flex items-center gap-2">
            <button type="button" onclick="openSendMessageModal('${user.uid}', '${safeName}', '${safeEmail}')" class="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition active:scale-95">
                <span>💬</span> <span>ส่งข้อความแจ้งเตือนถึงผู้ใช้นี้</span>
            </button>
        </div>

        <div class="grid grid-cols-3 gap-2 text-center p-3 rounded-2xl bg-slate-50 dark:bg-slate-700/40">
            <div>
                <span class="text-slate-400 block text-[11px]">น้ำหนัก</span>
                <span class="font-bold text-sm">${p.weight || '-'} kg</span>
            </div>
            <div>
                <span class="text-slate-400 block text-[11px]">ส่วนสูง</span>
                <span class="font-bold text-sm">${p.height || '-'} cm</span>
            </div>
            <div>
                <span class="text-slate-400 block text-[11px]">อายุ</span>
                <span class="font-bold text-sm">${p.age || '-'} ปี</span>
            </div>
        </div>

        <div class="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
            <div class="flex items-center justify-between font-bold">
                <span class="text-emerald-600 dark:text-emerald-400">สรุปการกินวันนี้ (${todayStr}):</span>
                <span class="text-emerald-600 dark:text-emerald-400">${sumCal} kcal</span>
            </div>
            <div class="flex items-center gap-3 text-xs">
                <span class="text-blue-500 font-semibold">P: ${sumP}g</span>
                <span class="text-amber-500 font-semibold">C: ${sumC}g</span>
                <span class="text-rose-500 font-semibold">F: ${sumF}g</span>
                <span class="text-sky-500 font-semibold ml-auto">💧 ${waterToday} แก้ว</span>
            </div>
        </div>

        <div class="space-y-2">
            <h4 class="font-bold text-slate-700 dark:text-slate-200">รายการอาหารที่กินวันนี้ (${mealsToday.length} รายการ):</h4>
            ${mealsToday.length === 0 ? '<div class="text-slate-400 py-3 text-center">ยังไม่ได้บันทึกอาหารวันนี้</div>' : `
                <div class="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    ${mealsToday.map(m => `
                        <div class="p-2 rounded-xl bg-slate-100 dark:bg-slate-700/50 flex items-center justify-between text-xs">
                            <div>
                                <span class="font-semibold">${m.name}</span>
                                <span class="text-[10px] text-slate-400 block">(${m.meal || 'มื้ออาหาร'} • ${m.time || ''})</span>
                            </div>
                            <span class="font-bold text-emerald-500">${m.cal} kcal</span>
                        </div>
                    `).join('')}
                </div>
            `}
        </div>

        ${workoutsToday.length > 0 ? `
            <div class="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-700">
                <h4 class="font-bold text-orange-500">การออกกำลังกายวันนี้ (${workoutsToday.length} รายการ):</h4>
                ${workoutsToday.map(w => `
                    <div class="p-2 rounded-xl bg-orange-500/10 text-xs flex justify-between">
                        <span>🔥 ${w.name} (${w.minutes} นาที)</span>
                        <span class="font-bold text-orange-600">-${w.cal} kcal</span>
                    </div>
                `).join('')}
            </div>
        ` : ''}
    `;

    const modal = document.getElementById('userInspectModal');
    if (modal) modal.classList.remove('hidden');
};

window.closeUserInspectModal = function () {
    const modal = document.getElementById('userInspectModal');
    if (modal) modal.classList.add('hidden');
};

function formatTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return 'เมื่อสักครู่';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} วันที่แล้ว`;
    return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}

// ==========================================
// Admin Direct Messaging & Broadcast Engine (v5.5.0)
// ==========================================

let targetUserForMsg = null;
let isBroadcastMode = false;

window.openSendMessageModal = function (uid, name, email) {
    targetUserForMsg = { uid, name, email };
    isBroadcastMode = false;

    const modal = document.getElementById('adminSendMessageModal');
    const recipientText = document.getElementById('sendMsgRecipientText');
    const titleInput = document.getElementById('adminMsgTitle');
    const bodyInput = document.getElementById('adminMsgBody');
    const statusBox = document.getElementById('adminSendStatus');
    const btnSend = document.getElementById('btnConfirmSendMsg');

    if (recipientText) {
        recipientText.textContent = `ถึง: ${name} (${email || uid})`;
    }
    if (titleInput) {
        titleInput.value = 'โดย BenzNova';
    }
    if (bodyInput) {
        bodyInput.value = '';
    }
    if (statusBox) {
        statusBox.classList.add('hidden');
    }
    if (btnSend) {
        btnSend.disabled = false;
        btnSend.innerHTML = '<span>🚀 ส่งข้อความทันที</span>';
    }

    if (modal) modal.classList.remove('hidden');
};

window.openBroadcastMessageModal = function () {
    targetUserForMsg = null;
    isBroadcastMode = true;

    const modal = document.getElementById('adminSendMessageModal');
    const recipientText = document.getElementById('sendMsgRecipientText');
    const titleInput = document.getElementById('adminMsgTitle');
    const bodyInput = document.getElementById('adminMsgBody');
    const statusBox = document.getElementById('adminSendStatus');
    const btnSend = document.getElementById('btnConfirmSendMsg');

    if (recipientText) {
        recipientText.textContent = `📢 ส่งประกาศถึงผู้ใช้งานทุกคนในระบบ (${allUsersData.length} บัญชี)`;
    }
    if (titleInput) {
        titleInput.value = 'โดย BenzNova';
    }
    if (bodyInput) {
        bodyInput.value = '';
    }
    if (statusBox) {
        statusBox.classList.add('hidden');
    }
    if (btnSend) {
        btnSend.disabled = false;
        btnSend.innerHTML = '<span>📢 ส่งประกาศถึงทุกคน</span>';
    }

    if (modal) modal.classList.remove('hidden');
};

window.closeSendMessageModal = function () {
    const modal = document.getElementById('adminSendMessageModal');
    if (modal) modal.classList.add('hidden');
};

window.fillQuickMessage = function (text) {
    const bodyInput = document.getElementById('adminMsgBody');
    if (bodyInput) {
        bodyInput.value = text;
        bodyInput.focus();
    }
};

window.submitSendAdminMessage = async function () {
    const title = (document.getElementById('adminMsgTitle')?.value || '').trim();
    const body = (document.getElementById('adminMsgBody')?.value || '').trim();
    const statusBox = document.getElementById('adminSendStatus');
    const btnSend = document.getElementById('btnConfirmSendMsg');

    if (!body) {
        alert('กรุณากรอกข้อความก่อนกดส่งครับ');
        return;
    }

    if (!currentUser) {
        alert('กรุณาเข้าสู่ระบบก่อนดำเนินการ');
        return;
    }

    if (btnSend) {
        btnSend.disabled = true;
        btnSend.innerHTML = '<span class="animate-spin mr-1">🔄</span> กำลังส่งข้อความ...';
    }

    try {
        const notifPayload = {
            title: title || 'โดย BenzNova',
            message: body,
            senderName: 'BenzNova',
            senderEmail: currentUser.email || 'benznova01@gmail.com',
            createdAt: new Date().toISOString(),
            read: false,
            type: isBroadcastMode ? 'broadcast' : 'admin_direct'
        };

        let recipientCount = 0;
        if (isBroadcastMode) {
            let sentCount = 0;
            for (const u of allUsersData) {
                if (u.uid) {
                    try {
                        await addDoc(collection(db, 'users', u.uid, 'notifications'), notifPayload);
                        sentCount++;
                    } catch (e) {
                        console.warn(`Failed to notify user ${u.uid}:`, e);
                    }
                }
            }
            recipientCount = sentCount;
            if (statusBox) {
                statusBox.className = 'p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold block';
                statusBox.textContent = `✅ ส่งข้อความประกาศถึงผู้ใช้สำเร็จ ${sentCount} คนเรียบร้อยแล้ว!`;
            }
        } else if (targetUserForMsg && targetUserForMsg.uid) {
            await addDoc(collection(db, 'users', targetUserForMsg.uid, 'notifications'), notifPayload);
            recipientCount = 1;
            if (statusBox) {
                statusBox.className = 'p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold block';
                statusBox.textContent = `✅ ส่งข้อความถึง ${targetUserForMsg.name} เรียบร้อยแล้ว! ผู้ใช้จะเห็นการแจ้งเตือนทันที`;
            }
        }

        // Record into admin audit log collection
        try {
            await addDoc(collection(db, 'admin_messages_log'), {
                title: title || 'โดย BenzNova',
                message: body,
                type: isBroadcastMode ? 'broadcast' : 'direct',
                recipientName: isBroadcastMode ? 'ทุกคนในระบบ (Broadcast)' : (targetUserForMsg?.name || 'ผู้ใช้'),
                recipientEmail: isBroadcastMode ? 'ทุกคน' : (targetUserForMsg?.email || '-'),
                recipientUid: isBroadcastMode ? 'all' : (targetUserForMsg?.uid || '-'),
                recipientCount: isBroadcastMode ? (recipientCount || allUsersData?.length || 0) : 1,
                sentBy: 'โดย BenzNova',
                sentByEmail: currentUser.email || 'benznova01@gmail.com',
                createdAt: new Date().toISOString()
            });
        } catch (logErr) {
            console.warn('Failed to record admin message log:', logErr);
        }

        setTimeout(() => {
            window.closeSendMessageModal();
            if (window.loadAdminMessageLogs) window.loadAdminMessageLogs();
        }, 1500);
    } catch (err) {
        console.error('Failed to send admin message:', err);
        if (statusBox) {
            statusBox.className = 'p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-semibold block';
            statusBox.textContent = '❌ เกิดข้อผิดพลาดในการส่งข้อความ: ' + err.message;
        }
        if (btnSend) {
            btnSend.disabled = false;
            btnSend.innerHTML = '<span>ลองใหม่อีกครั้ง</span>';
        }
    }
};

window.loadAdminMessageLogs = async function () {
    const tableBody = document.getElementById('messageLogsTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = `
        <tr>
            <td colspan="6" class="py-8 text-center text-slate-400">
                <span class="inline-block animate-spin mr-2">🔄</span> กำลังโหลดประวัติข้อความ...
            </td>
        </tr>
    `;

    try {
        const snap = await getDocs(collection(db, 'admin_messages_log'));
        const logs = [];
        snap.forEach(doc => {
            logs.push({ id: doc.id, ...doc.data() });
        });

        // Sort descending by createdAt
        logs.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

        if (logs.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="py-8 text-center text-slate-400">
                        📭 ยังไม่มีประวัติการส่งข้อความจากแอดมิน
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = logs.map(log => {
            const d = log.createdAt ? new Date(log.createdAt) : new Date();
            const dateStr = d.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
            const isBroadcast = log.type === 'broadcast' || log.recipientUid === 'all';

            return `
                <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">
                    <td class="py-3 px-3 text-slate-600 dark:text-slate-300 font-mono text-[11px] whitespace-nowrap">
                        ${dateStr}
                    </td>
                    <td class="py-3 px-3">
                        ${isBroadcast ? `
                            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400 font-bold text-[11px]">
                                📢 ทุกคน (${log.recipientCount || 'ทั้งหมด'} คน)
                            </span>
                        ` : `
                            <div>
                                <div class="font-bold text-slate-800 dark:text-slate-100">${log.recipientName || 'ผู้ใช้'}</div>
                                <div class="text-[10px] text-slate-400">${log.recipientEmail || '-'}</div>
                            </div>
                        `}
                    </td>
                    <td class="py-3 px-3 font-semibold text-slate-700 dark:text-slate-200">
                        ${log.title || 'โดย BenzNova'}
                    </td>
                    <td class="py-3 px-3 max-w-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                        ${log.message || '-'}
                    </td>
                    <td class="py-3 px-3 whitespace-nowrap text-slate-500 dark:text-slate-400 font-medium text-[11px]">
                        ${log.sentBy || 'โดย BenzNova'}
                    </td>
                    <td class="py-3 px-3 text-center whitespace-nowrap">
                        <span class="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                            ✓ ส่งสำเร็จ
                        </span>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error('Failed to load message logs:', err);
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="py-8 text-center text-rose-500">
                    ❌ โหลดประวัติข้อความไม่สำเร็จ: ${err.message}
                </td>
            </tr>
        `;
    }
};
