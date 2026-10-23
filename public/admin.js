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
    addDoc,
    doc,
    getDoc,
    setDoc,
    query,
    orderBy,
    limit
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
        allUsersData = [];
        window.allUsersData = [];
        if (authGate) authGate.classList.remove('hidden');
        if (panel) panel.classList.add('hidden');
        if (btnLogout) btnLogout.classList.add('hidden');
        return;
    }

    const email = (user.email || '').toLowerCase();
    if (!ADMIN_EMAILS.includes(email)) {
        allUsersData = [];
        window.allUsersData = [];
        if (authGate) authGate.classList.remove('hidden');
        if (panel) panel.classList.add('hidden');
        if (btnLogout) btnLogout.classList.remove('hidden');
        if (errBox) {
            errBox.classList.remove('hidden');
            errBox.innerHTML = `
                <div class="space-y-2">
                    <div>🚫 <b>การเข้าถึงถูกปฏิเสธ (403 Forbidden):</b> บัญชี <b>${email}</b> ไม่มีสิทธิ์เข้าถึงหน้านี้ สงวนสิทธิ์เฉพาะผู้ดูแลระบบเท่านั้น</div>
                    <a href="index.html" class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold text-xs shadow-xs hover:opacity-90 transition mt-1">
                        <span>📱</span> <span>กลับสู่หน้าหลักสำหรับผู้ใช้งาน</span>
                    </a>
                </div>
            `;
        }
        // Log unauthorized admin panel breach attempt to Firestore security audit
        try {
            const logsCol = collection(db, 'security_audit_logs');
            await addDoc(logsCol, {
                type: 'UNAUTHORIZED_ADMIN_ACCESS_ATTEMPT',
                reason: `Unauthorized Google account '${email}' attempted to access admin.html`,
                timestamp: new Date().toISOString(),
                userId: user.uid,
                userEmail: email,
                platform: navigator.platform || 'Unknown',
                userAgent: navigator.userAgent || 'Unknown'
            });
        } catch (e) { }
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

// Fetch All Users & Guest Sessions from Cloud Firestore (Phase 1)
window.loadAllUserData = async function () {
    // Security check: Only verified admin can load Firestore data
    if (!window.allUsersData && (!currentUser || !ADMIN_EMAILS.includes((currentUser.email || '').toLowerCase()))) {
        console.warn('Unauthorized loadAllUserData rejected');
        return;
    }

    const refreshIcon = document.getElementById('refreshIcon');
    if (refreshIcon) refreshIcon.classList.add('animate-spin');

    try {
        const [usersSnap, guestsSnap] = await Promise.all([
            getDocs(collection(db, 'users')),
            getDocs(collection(db, 'guest_sessions')).catch(err => {
                console.warn('Failed to load guest_sessions collection:', err);
                return { forEach: () => {} };
            })
        ]);

        allUsersData = [];

        usersSnap.forEach((docSnap) => {
            allUsersData.push({
                uid: docSnap.id,
                isGuest: false,
                provider: 'google',
                ...docSnap.data()
            });
        });

        guestsSnap.forEach((docSnap) => {
            const data = docSnap.data();
            allUsersData.push({
                uid: docSnap.id,
                deviceId: docSnap.id,
                isGuest: true,
                provider: 'guest',
                displayName: data.displayName || `ผู้ใช้ทั่วไป (${data.platform || 'Device'})`,
                email: data.convertedEmail ? `แปลงเป็น: ${data.convertedEmail}` : 'ผู้ใช้ทั่วไป (ไม่ระบุตัวตน)',
                ...data
            });
        });

        window.allUsersData = allUsersData;
        renderAdminOverview();
    } catch (err) {
        console.error('Failed to load users data:', err);
        alert('เกิดข้อผิดพลาดในการดึงข้อมูลจาก Cloud Firestore: ' + err.message);
    } finally {
        if (refreshIcon) refreshIcon.classList.remove('animate-spin');
    }
};

window.renderAdminOverview = renderAdminOverview;
function renderAdminOverview() {
    if (Array.isArray(window.allUsersData) && window.allUsersData.length > 0) {
        allUsersData = window.allUsersData;
    } else {
        window.allUsersData = allUsersData;
    }
    const todayStr = getTodayStr();

    let totalUsers = allUsersData.length;
    let googleUsersCount = allUsersData.filter(u => !u.isGuest).length;
    let guestUsersCount = allUsersData.filter(u => !!u.isGuest).length;

    let activeToday = 0;
    let activeGoogleToday = 0;
    let activeGuestToday = 0;
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
            if (user.isGuest) {
                activeGuestToday++;
            } else {
                activeGoogleToday++;
            }
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

    // Update KPIs (Phase 1: Google + Guest breakdown)
    document.getElementById('statTotalUsers').textContent = totalUsers.toLocaleString();
    const statUsersBrk = document.getElementById('statUsersBreakdown');
    if (statUsersBrk) {
        statUsersBrk.textContent = `🔵 ${googleUsersCount.toLocaleString()} สมาชิก Google + ⚪ ${guestUsersCount.toLocaleString()} ผู้ใช้ทั่วไป`;
    }

    document.getElementById('statActiveToday').textContent = activeToday.toLocaleString();
    const statActBrk = document.getElementById('statActiveBreakdown');
    if (statActBrk) {
        statActBrk.textContent = `🔵 ${activeGoogleToday} สมาชิก + ⚪ ${activeGuestToday} ผู้ใช้ทั่วไปวันนี้`;
    }

    document.getElementById('statTotalMeals').textContent = totalMealsToday.toLocaleString();
    document.getElementById('statTotalWater').textContent = totalWaterToday.toLocaleString();
    document.getElementById('userCountBadge').textContent = totalUsers;

    // Filter count badges
    const cntAll = document.getElementById('countFilterAll');
    if (cntAll) cntAll.textContent = totalUsers;
    const cntG = document.getElementById('countFilterGoogle');
    if (cntG) cntG.textContent = googleUsersCount;
    const cntGuest = document.getElementById('countFilterGuest');
    if (cntGuest) cntGuest.textContent = guestUsersCount;

    // Render Users Table using active filters
    applyUserFilters();

    // Render Top Foods
    renderTopFoods(foodCountMap);

    // Render Top Workouts
    renderTopWorkouts(workoutCountMap);

    // Render Custom Presets
    renderCustomPresets(customPresetsPool);

    // Render In-Depth Analytics & Peak Hours (v5.7.0)
    renderInDepthAnalytics(allUsersData);
    if (window.loadAdminAiCacheStats) window.loadAdminAiCacheStats();
}

function renderInDepthAnalytics(users) {
    if (!users) users = [];
    const todayStr = getTodayStr();

    // 1. 7-Day DAU Trend
    const dayDates = [];
    const todayObj = new Date();
    for (let i = 6; i >= 0; i--) {
        const d = new Date(todayObj);
        d.setDate(d.getDate() - i);
        dayDates.push(d.toISOString().split('T')[0]);
    }

    const dauMap = {};
    dayDates.forEach(d => { dauMap[d] = 0; });

    users.forEach(u => {
        const state = u.state || {};
        const logs = state.logsByDate || {};
        const water = state.waterByDate || {};
        const workouts = state.workoutsByDate || {};
        const updatedDate = u.updatedAt ? u.updatedAt.split('T')[0] : null;

        dayDates.forEach(dStr => {
            const hasMeals = logs[dStr] && logs[dStr].length > 0;
            const hasWater = water[dStr] && water[dStr] > 0;
            const hasWorkouts = workouts[dStr] && workouts[dStr].length > 0;
            const isUpdated = updatedDate === dStr;
            if (hasMeals || hasWater || hasWorkouts || isUpdated) {
                dauMap[dStr]++;
            }
        });
    });

    const maxDau = Math.max(...Object.values(dauMap), 1);
    const totalDau7Days = Object.values(dauMap).reduce((s, v) => s + v, 0);
    const avgDau = (totalDau7Days / 7).toFixed(1);

    const dauBadge = document.getElementById('dau7DayAvgBadge');
    if (dauBadge) dauBadge.textContent = `เฉลี่ย ${avgDau} คน/วัน`;

    const barContainer = document.getElementById('dau7DayBarContainer');
    if (barContainer) {
        barContainer.innerHTML = dayDates.map(dStr => {
            const count = dauMap[dStr] || 0;
            const heightPct = Math.max(14, Math.round((count / maxDau) * 100));
            const isToday = dStr === todayStr;
            const dateObj = new Date(dStr);
            const dayLabel = isToday ? 'วันนี้' : dateObj.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric' });

            return `
                <div class="flex flex-col items-center h-full justify-end group">
                    <span class="text-[10px] font-bold text-slate-500 dark:text-slate-400 group-hover:text-purple-500 mb-1">
                        ${count}
                    </span>
                    <div class="w-full max-w-[28px] sm:max-w-[36px] rounded-t-xl transition-all duration-300 ${isToday
                        ? 'bg-gradient-to-t from-purple-600 to-indigo-500 shadow-md shadow-purple-500/20'
                        : 'bg-slate-200 dark:bg-slate-700 hover:bg-purple-500/40'}"
                        style="height: ${heightPct}%;">
                    </div>
                    <span class="text-[10px] font-medium text-slate-400 truncate mt-1 text-center w-full">
                        ${dayLabel}
                    </span>
                </div>
            `;
        }).join('');
    }

    // 2. Device & Platform Distribution
    let mobileCount = 0;
    let desktopCount = 0;
    const platformCountMap = {};

    users.forEach(u => {
        const cat = u.deviceCategory || (u.platform === 'iOS' || u.platform === 'Android' ? 'Mobile' : null);
        if (cat === 'Mobile') {
            mobileCount++;
        } else if (cat === 'Desktop') {
            desktopCount++;
        } else {
            // Default split if not set: majority of web users are mobile
            mobileCount++;
        }

        const plat = u.platform || 'iOS / Web';
        platformCountMap[plat] = (platformCountMap[plat] || 0) + 1;
    });

    const totalDevices = mobileCount + desktopCount || 1;
    const pctMobile = Math.round((mobileCount / totalDevices) * 100);
    const pctDesktop = 100 - pctMobile;

    const barMobile = document.getElementById('barDeviceMobile');
    const barDesktop = document.getElementById('barDeviceDesktop');
    const textMobile = document.getElementById('textPctMobile');
    const textDesktop = document.getElementById('textPctDesktop');

    if (barMobile) barMobile.style.width = `${pctMobile}%`;
    if (barDesktop) barDesktop.style.width = `${pctDesktop}%`;
    if (textMobile) textMobile.textContent = `${pctMobile}% (${mobileCount} คน)`;
    if (textDesktop) textDesktop.textContent = `${pctDesktop}% (${desktopCount} คน)`;

    const platformContainer = document.getElementById('platformPillsContainer');
    if (platformContainer) {
        platformContainer.innerHTML = Object.entries(platformCountMap).map(([plat, count]) => {
            return `
                <span class="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-700 font-semibold text-slate-600 dark:text-slate-300">
                    ${plat}: <b>${count}</b>
                </span>
            `;
        }).join('');
    }

    // 3. Peak Hours & Meal Timing Distribution
    let breakfastMeals = 0; // 06:00 - 10:59
    let lunchMeals = 0;     // 11:00 - 14:59
    let dinnerMeals = 0;    // 15:00 - 20:59
    let snackMeals = 0;     // 21:00 - 05:59
    const hourlyMealMap = {};
    for (let h = 0; h < 24; h++) hourlyMealMap[h] = 0;

    users.forEach(u => {
        const state = u.state || {};
        const logs = state.logsByDate || {};
        Object.values(logs).forEach(mealList => {
            if (Array.isArray(mealList)) {
                mealList.forEach(m => {
                    let hour = 12; // default
                    if (m.time && m.time.includes(':')) {
                        const parsedH = parseInt(m.time.split(':')[0], 10);
                        if (!isNaN(parsedH) && parsedH >= 0 && parsedH <= 23) {
                            hour = parsedH;
                        }
                    } else if (m.meal === 'breakfast') {
                        hour = 8;
                    } else if (m.meal === 'lunch') {
                        hour = 12;
                    } else if (m.meal === 'dinner') {
                        hour = 19;
                    }

                    hourlyMealMap[hour]++;

                    if (hour >= 6 && hour < 11) {
                        breakfastMeals++;
                    } else if (hour >= 11 && hour < 15) {
                        lunchMeals++;
                    } else if (hour >= 15 && hour < 21) {
                        dinnerMeals++;
                    } else {
                        snackMeals++;
                    }
                });
            }
        });
    });

    const totalCategorizedMeals = breakfastMeals + lunchMeals + dinnerMeals + snackMeals || 1;
    const pctB = Math.round((breakfastMeals / totalCategorizedMeals) * 100);
    const pctL = Math.round((lunchMeals / totalCategorizedMeals) * 100);
    const pctD = Math.round((dinnerMeals / totalCategorizedMeals) * 100);
    const pctS = Math.round((snackMeals / totalCategorizedMeals) * 100);

    const elB = document.getElementById('statBreakfastMeals');
    const elBPct = document.getElementById('pctBreakfastMeals');
    const elL = document.getElementById('statLunchMeals');
    const elLPct = document.getElementById('pctLunchMeals');
    const elD = document.getElementById('statDinnerMeals');
    const elDPct = document.getElementById('pctDinnerMeals');
    const elS = document.getElementById('statSnackMeals');
    const elSPct = document.getElementById('pctSnackMeals');

    if (elB) elB.textContent = `${breakfastMeals.toLocaleString()} รายการ`;
    if (elBPct) elBPct.textContent = `${pctB}% ของมื้อทั้งหมด`;
    if (elL) elL.textContent = `${lunchMeals.toLocaleString()} รายการ`;
    if (elLPct) elLPct.textContent = `${pctL}% ของมื้อทั้งหมด`;
    if (elD) elD.textContent = `${dinnerMeals.toLocaleString()} รายการ`;
    if (elDPct) elDPct.textContent = `${pctD}% ของมื้อทั้งหมด`;
    if (elS) elS.textContent = `${snackMeals.toLocaleString()} รายการ`;
    if (elSPct) elSPct.textContent = `${pctS}% ของมื้อทั้งหมด`;

    // Find peak hour
    let peakHour = 12;
    let maxHourlyCount = -1;
    for (let h = 0; h < 24; h++) {
        if (hourlyMealMap[h] > maxHourlyCount) {
            maxHourlyCount = hourlyMealMap[h];
            peakHour = h;
        }
    }

    const peakStart = String(peakHour).padStart(2, '0') + ':00';
    const peakEnd = String((peakHour + 1) % 24).padStart(2, '0') + ':00';
    const peakBadge = document.getElementById('badgePeakTime');
    if (peakBadge) {
        peakBadge.textContent = `🔥 ช่วงคนใช้มากที่สุด: ${peakStart} - ${peakEnd} น. (${maxHourlyCount > 0 ? maxHourlyCount : 0} รายการ)`;
    }

    const recText = document.getElementById('broadcastRecommendationText');
    if (recText) {
        recText.textContent = `แนะนำส่งข้อความช่วง ${peakStart} - ${peakEnd} น. หรือช่วงมื้อเย็น 18:30 - 19:30 น. ซึ่งมีผู้ใช้เข้ามาบันทึกมื้ออาหารหนาแน่นที่สุด เพื่อให้เห็นแจ้งเตือนทันใจ`;
    }

    // 4. Feature Adoption
    let fastingUsersCount = 0;
    const planCounts = {};
    let waterAchievedCount = 0;
    let totalWaterAllUsers = 0;
    let workoutUsersCount = 0;
    let totalWorkoutItemsToday = 0;
    let weightUsersCount = 0;

    users.forEach(u => {
        const state = u.state || {};
        // IF
        if (state.fasting && (state.fasting.isFasting || (state.fasting.history && state.fasting.history.length > 0) || state.fasting.startTime)) {
            fastingUsersCount++;
            const plan = state.fasting.plan || '16:8';
            planCounts[plan] = (planCounts[plan] || 0) + 1;
        }

        // Water
        const wToday = (state.waterByDate && state.waterByDate[todayStr]) || 0;
        totalWaterAllUsers += wToday;
        if (wToday >= 8) waterAchievedCount++;

        // Workout
        const wList = (state.workoutsByDate && state.workoutsByDate[todayStr]) || [];
        if (wList.length > 0) {
            workoutUsersCount++;
            totalWorkoutItemsToday += wList.length;
        }

        // Weight
        if (state.weightsByDate && state.weightsByDate[todayStr]) {
            weightUsersCount++;
        }
    });

    const statFasting = document.getElementById('statFastingUsers');
    if (statFasting) statFasting.textContent = `${fastingUsersCount} คน`;

    // Most popular fasting plan
    let popularPlan = '16:8';
    let maxPlanCount = -1;
    Object.entries(planCounts).forEach(([p, count]) => {
        if (count > maxPlanCount) {
            maxPlanCount = count;
            popularPlan = p;
        }
    });

    const statPopPlan = document.getElementById('statPopularFastingPlan');
    if (statPopPlan) statPopPlan.textContent = popularPlan;

    const breakdownEl = document.getElementById('fastingPlansBreakdown');
    if (breakdownEl) {
        breakdownEl.innerHTML = Object.entries(planCounts).map(([p, c]) => `<span>${p}: <b>${c}</b></span>`).join('');
    }

    const statWaterAch = document.getElementById('statWaterAchievedUsers');
    if (statWaterAch) statWaterAch.textContent = `${waterAchievedCount} คน`;

    const statAvgWater = document.getElementById('statAvgWaterPerUser');
    if (statAvgWater) {
        const avgW = users.length > 0 ? (totalWaterAllUsers / users.length).toFixed(1) : 0;
        statAvgWater.textContent = `${avgW} แก้ว/คน`;
    }

    const statWorkouts = document.getElementById('statWorkoutUsers');
    if (statWorkouts) statWorkouts.textContent = `${workoutUsersCount} คน`;

    const statWorkoutsToday = document.getElementById('statTotalWorkoutToday');
    if (statWorkoutsToday) statWorkoutsToday.textContent = `${totalWorkoutItemsToday} รายการ`;

    const statWeightUsers = document.getElementById('statWeightLogUsers');
    if (statWeightUsers) statWeightUsers.textContent = `${weightUsersCount} คน`;

    const statWeightToday = document.getElementById('statWeightLoggedToday');
    if (statWeightToday) statWeightToday.textContent = `${weightUsersCount} คน`;
}


// ==========================================
// GENERIC ADMIN TABLE PAGINATION ENGINE (v5.8.3)
// ==========================================
window.renderPaginationControls = renderPaginationControls;
function renderPaginationControls({
    containerId,
    totalItems,
    currentPage,
    pageSize,
    onPageChange,
    onPageSizeChange
}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (totalItems === 0) {
        container.innerHTML = '';
        return;
    }

    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const safePage = Math.min(Math.max(1, currentPage), totalPages);
    const startItem = (safePage - 1) * pageSize + 1;
    const endItem = Math.min(safePage * pageSize, totalItems);

    // Calculate visible page buttons (max 5)
    const pageNumbers = [];
    const maxVisiblePages = 5;
    if (totalPages <= maxVisiblePages) {
        for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
    } else {
        let start = Math.max(1, safePage - 2);
        let end = Math.min(totalPages, start + maxVisiblePages - 1);
        if (end - start < maxVisiblePages - 1) {
            start = Math.max(1, end - maxVisiblePages + 1);
        }
        for (let i = start; i <= end; i++) pageNumbers.push(i);
    }

    const prevDisabled = safePage <= 1;
    const nextDisabled = safePage >= totalPages;

    const pageButtonsHtml = pageNumbers.map(p => {
        const isActive = p === safePage;
        return `
            <button type="button" onclick="${onPageChange}(${p})"
                class="min-w-8 h-8 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center cursor-pointer ${
                    isActive
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/70 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                }">
                ${p}
            </button>
        `;
    }).join('');

    const pageSizeSelectorHtml = onPageSizeChange ? `
        <div class="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <span>แสดง</span>
            <select onchange="${onPageSizeChange}(Number(this.value))"
                class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-purple-500 cursor-pointer">
                <option value="10" ${pageSize === 10 ? 'selected' : ''}>10</option>
                <option value="25" ${pageSize === 25 ? 'selected' : ''}>25</option>
                <option value="50" ${pageSize === 50 ? 'selected' : ''}>50</option>
            </select>
            <span>/หน้า</span>
        </div>
    ` : '';

    container.innerHTML = `
        <div class="w-full flex flex-wrap items-center justify-between gap-3 text-xs">
            <div class="flex items-center gap-3 flex-wrap">
                <span class="text-slate-500 dark:text-slate-400">
                    แสดง <b>${startItem.toLocaleString()}</b>-<b>${endItem.toLocaleString()}</b> จากทั้งหมด <b>${totalItems.toLocaleString()}</b> รายการ
                </span>
                ${pageSizeSelectorHtml}
            </div>

            ${totalPages > 1 ? `
            <div class="flex items-center gap-1.5 flex-wrap">
                <button type="button" onclick="${onPageChange}(${safePage - 1})"
                    ${prevDisabled ? 'disabled' : ''}
                    class="h-8 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold transition flex items-center gap-1 ${
                        prevDisabled
                            ? 'opacity-40 cursor-not-allowed text-slate-400 bg-slate-50 dark:bg-slate-800'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer bg-white dark:bg-slate-800'
                    }">
                    <span>◀</span> <span>ก่อนหน้า</span>
                </button>

                <div class="flex items-center gap-1">
                    ${pageButtonsHtml}
                </div>

                <button type="button" onclick="${onPageChange}(${safePage + 1})"
                    ${nextDisabled ? 'disabled' : ''}
                    class="h-8 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold transition flex items-center gap-1 ${
                        nextDisabled
                            ? 'opacity-40 cursor-not-allowed text-slate-400 bg-slate-50 dark:bg-slate-800'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer bg-white dark:bg-slate-800'
                    }">
                    <span>ถัดไป</span> <span>▶</span>
                </button>
            </div>
            ` : ''}
        </div>
    `;
}

let _currentUsersList = [];
let _usersCurrentPage = 1;
let _usersPageSize = 10;

function changeUsersPage(newPage) {
    _usersCurrentPage = newPage;
    renderUsersTableSlice();
}
window.changeUsersPage = changeUsersPage;

function changeUsersPageSize(newSize) {
    _usersPageSize = newSize;
    _usersCurrentPage = 1;
    renderUsersTableSlice();
}
window.changeUsersPageSize = changeUsersPageSize;

function renderUsersTable(users) {
    _currentUsersList = users || [];
    _usersCurrentPage = 1;
    renderUsersTableSlice();
}

function renderUsersTableSlice() {
    const tbody = document.getElementById('usersTableBody');
    const todayStr = getTodayStr();

    if (!_currentUsersList || _currentUsersList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-slate-400">ไม่พบรายชื่อผู้ใช้งาน</td></tr>`;
        renderPaginationControls({
            containerId: 'usersPagination',
            totalItems: 0,
            currentPage: 1,
            pageSize: _usersPageSize,
            onPageChange: 'changeUsersPage',
            onPageSizeChange: 'changeUsersPageSize'
        });
        return;
    }

    // Sort by latest updatedAt
    const sorted = [..._currentUsersList].sort((a, b) => {
        const tA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const tB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return tB - tA;
    });

    const totalPages = Math.max(1, Math.ceil(sorted.length / _usersPageSize));
    if (_usersCurrentPage > totalPages) _usersCurrentPage = totalPages;
    if (_usersCurrentPage < 1) _usersCurrentPage = 1;

    const startIdx = (_usersCurrentPage - 1) * _usersPageSize;
    const pageItems = sorted.slice(startIdx, startIdx + _usersPageSize);

    tbody.innerHTML = pageItems.map(u => {
        const state = u.state || {};
        const p = state.profile || {};
        const isGuest = !!u.isGuest;
        const photo = isGuest ? 'icon.svg' : (u.photoURL || 'icon.svg');
        const name = u.displayName || (isGuest ? 'ผู้ใช้ทั่วไป (Guest)' : 'ผู้ใช้ Google');
        const email = isGuest 
            ? `📱 Guest Session (${u.platform || 'อุปกรณ์'}${u.pwa ? ' • PWA' : ''})` 
            : (u.email || 'ไม่มีอีเมล');
        const weight = p.weight ? `${p.weight} kg` : '-';
        const targetCal = p.weight ? Math.round(10 * p.weight + 6.25 * (p.height || 170) - 5 * (p.age || 30) + (p.gender === 'female' ? -161 : 5)) : 2000;

        const mealsToday = (state.logsByDate && state.logsByDate[todayStr]) || [];
        const calToday = mealsToday.reduce((s, m) => s + (m.cal || 0), 0);
        const waterToday = (state.waterByDate && state.waterByDate[todayStr]) || 0;

        const updatedStr = u.updatedAt ? formatTimeAgo(new Date(u.updatedAt)) : 'ยังไม่มีประวัติ';
        const typeBadge = isGuest
            ? `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 text-[10px] font-bold">⚪ Guest</span>`
            : `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-bold">🔵 Google</span>`;

        return `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">
                <td class="py-3 px-4">
                    <div class="flex items-center gap-2.5">
                        <img src="${photo}" class="w-8 h-8 rounded-full border border-purple-500/30 object-cover" onerror="this.src='icon.svg'">
                        <div>
                            <div class="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                                <span>${name}</span>
                                ${typeBadge}
                            </div>
                            <div class="text-[11px] text-slate-400 font-mono">${email}</div>
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
                        ${!isGuest ? `
                        <button type="button" onclick="openSendMessageModal('${u.uid}', '${(name || '').replace(/'/g, "\\'")}', '${(email || '').replace(/'/g, "\\'")}')" class="px-2.5 py-1.5 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/25 font-bold transition shadow-xs text-xs flex items-center gap-1 cursor-pointer">
                            💬 ส่งข้อความ
                        </button>
                        ` : `
                        <span title="ผู้ใช้ทั่วไปไม่มีกล่องจดหมายส่วนตัว" class="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 text-xs font-medium border border-slate-200 dark:border-slate-700">
                            💬 เฉพาะ Google
                        </span>
                        `}
                        <button type="button" onclick="inspectUser('${u.uid}')" class="px-2.5 py-1.5 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30 hover:bg-purple-500/25 font-bold transition shadow-xs text-xs cursor-pointer">
                            👁️ ส่องไดอารี่
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    renderPaginationControls({
        containerId: 'usersPagination',
        totalItems: sorted.length,
        currentPage: _usersCurrentPage,
        pageSize: _usersPageSize,
        onPageChange: 'changeUsersPage',
        onPageSizeChange: 'changeUsersPageSize'
    });
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

let _currentPresetsList = [];
let _presetsCurrentPage = 1;
let _presetsPageSize = 12;

function changeCustomPresetsPage(newPage) {
    _presetsCurrentPage = newPage;
    renderCustomPresetsSlice();
}
window.changeCustomPresetsPage = changeCustomPresetsPage;

function changeCustomPresetsPageSize(newSize) {
    _presetsPageSize = newSize;
    _presetsCurrentPage = 1;
    renderCustomPresetsSlice();
}
window.changeCustomPresetsPageSize = changeCustomPresetsPageSize;

function renderCustomPresets(presets) {
    _currentPresetsList = presets || [];
    _presetsCurrentPage = 1;
    const badge = document.getElementById('customPresetsCountBadge');
    if (badge) badge.textContent = `${_currentPresetsList.length} รายการ`;
    renderCustomPresetsSlice();
}

function renderCustomPresetsSlice() {
    const container = document.getElementById('customPresetsContainer');
    if (!container) return;

    if (!_currentPresetsList || _currentPresetsList.length === 0) {
        container.innerHTML = `<div class="col-span-full py-8 text-center text-slate-400">ยังไม่มีผู้ใช้เพิ่มเมนูอาหารส่วนตัว</div>`;
        renderPaginationControls({
            containerId: 'customPresetsPagination',
            totalItems: 0,
            currentPage: 1,
            pageSize: _presetsPageSize,
            onPageChange: 'changeCustomPresetsPage',
            onPageSizeChange: 'changeCustomPresetsPageSize'
        });
        return;
    }

    const totalPages = Math.max(1, Math.ceil(_currentPresetsList.length / _presetsPageSize));
    if (_presetsCurrentPage > totalPages) _presetsCurrentPage = totalPages;
    if (_presetsCurrentPage < 1) _presetsCurrentPage = 1;

    const startIdx = (_presetsCurrentPage - 1) * _presetsPageSize;
    const pageItems = _currentPresetsList.slice(startIdx, startIdx + _presetsPageSize);

    container.innerHTML = pageItems.map(item => {
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

    renderPaginationControls({
        containerId: 'customPresetsPagination',
        totalItems: _currentPresetsList.length,
        currentPage: _presetsCurrentPage,
        pageSize: _presetsPageSize,
        onPageChange: 'changeCustomPresetsPage',
        onPageSizeChange: 'changeCustomPresetsPageSize'
    });
}

let _currentUserTypeFilter = 'all';

window.setUserTypeFilter = function (type) {
    _currentUserTypeFilter = type;
    const btnAll = document.getElementById('btnFilterUserAll');
    const btnGoogle = document.getElementById('btnFilterUserGoogle');
    const btnGuest = document.getElementById('btnFilterUserGuest');

    [btnAll, btnGoogle, btnGuest].forEach(btn => {
        if (!btn) return;
        btn.className = 'px-2.5 py-1 rounded-lg font-bold text-slate-500 hover:text-purple-600 transition cursor-pointer';
    });

    const activeBtn = type === 'google' ? btnGoogle : type === 'guest' ? btnGuest : btnAll;
    if (activeBtn) {
        activeBtn.className = 'px-2.5 py-1 rounded-lg font-bold bg-white dark:bg-slate-700 shadow-xs text-purple-600 dark:text-purple-400 transition cursor-pointer';
    }

    applyUserFilters();
};

function applyUserFilters() {
    if (Array.isArray(window.allUsersData) && window.allUsersData.length > 0) {
        allUsersData = window.allUsersData;
    }
    const q = (document.getElementById('adminUserSearch')?.value || '').trim().toLowerCase();
    let filtered = allUsersData;

    if (_currentUserTypeFilter === 'google') {
        filtered = filtered.filter(u => !u.isGuest);
    } else if (_currentUserTypeFilter === 'guest') {
        filtered = filtered.filter(u => !!u.isGuest);
    }

    if (q) {
        filtered = filtered.filter(u => {
            const name = (u.displayName || '').toLowerCase();
            const email = (u.email || '').toLowerCase();
            const device = (u.platform || '').toLowerCase();
            return name.includes(q) || email.includes(q) || device.includes(q);
        });
    }

    renderUsersTable(filtered);
}
window.applyUserFilters = applyUserFilters;

window.filterUsersList = function (query) {
    applyUserFilters();
};

window.switchAdminTab = function (tabId) {
    ['users', 'analytics', 'foods', 'custom_presets', 'message_logs', 'system_changelog', 'system_ai', 'security_logs'].forEach(t => {
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
    if (tabId === 'system_ai') {
        if (window.loadAdminGeminiApiKey) window.loadAdminGeminiApiKey();
        if (window.loadAdminAiScanLogs) window.loadAdminAiScanLogs();
        if (window.loadAdminAiCacheStats) window.loadAdminAiCacheStats();
    }
    if (tabId === 'security_logs') {
        if (window.loadAdminSecurityLogs) window.loadAdminSecurityLogs();
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

function escapeAdminHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}


let _currentMessageLogs = [];
let _msgLogsCurrentPage = 1;
let _msgLogsPageSize = 10;

function changeMessageLogsPage(newPage) {
    _msgLogsCurrentPage = newPage;
    renderMessageLogsSlice();
}
window.changeMessageLogsPage = changeMessageLogsPage;

function changeMessageLogsPageSize(newSize) {
    _msgLogsPageSize = newSize;
    _msgLogsCurrentPage = 1;
    renderMessageLogsSlice();
}
window.changeMessageLogsPageSize = changeMessageLogsPageSize;

function renderMessageLogsSlice() {
    const tableBody = document.getElementById('messageLogsTableBody');
    const mobileList = document.getElementById('messageLogsMobileList');

    if (!_currentMessageLogs || _currentMessageLogs.length === 0) {
        const emptyHtml = '📭 ยังไม่มีประวัติการส่งข้อความจากแอดมิน';
        if (tableBody) tableBody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-slate-400">${emptyHtml}</td></tr>`;
        if (mobileList) mobileList.innerHTML = `<div class="py-8 text-center text-slate-400 text-xs">${emptyHtml}</div>`;
        renderPaginationControls({
            containerId: 'messageLogsPagination',
            totalItems: 0,
            currentPage: 1,
            pageSize: _msgLogsPageSize,
            onPageChange: 'changeMessageLogsPage',
            onPageSizeChange: 'changeMessageLogsPageSize'
        });
        return;
    }

    const totalPages = Math.max(1, Math.ceil(_currentMessageLogs.length / _msgLogsPageSize));
    if (_msgLogsCurrentPage > totalPages) _msgLogsCurrentPage = totalPages;
    if (_msgLogsCurrentPage < 1) _msgLogsCurrentPage = 1;

    const startIdx = (_msgLogsCurrentPage - 1) * _msgLogsPageSize;
    const pageItems = _currentMessageLogs.slice(startIdx, startIdx + _msgLogsPageSize);

    // Render Desktop Table (md and up)
    if (tableBody) {
        tableBody.innerHTML = pageItems.map(log => {
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
                                <div class="font-bold text-slate-800 dark:text-slate-100">${escapeAdminHtml(log.recipientName || 'ผู้ใช้')}</div>
                                <div class="text-[10px] text-slate-400">${escapeAdminHtml(log.recipientEmail || '-')}</div>
                            </div>
                        `}
                    </td>
                    <td class="py-3 px-3 font-semibold text-slate-700 dark:text-slate-200">
                        ${escapeAdminHtml(log.title || 'โดย BenzNova')}
                    </td>
                    <td class="py-3 px-3 max-w-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed text-xs">
                        ${escapeAdminHtml(log.message || '-')}
                    </td>
                    <td class="py-3 px-3 whitespace-nowrap text-slate-500 dark:text-slate-400 font-medium text-[11px]">
                        ${escapeAdminHtml(log.sentBy || 'โดย BenzNova')}
                    </td>
                    <td class="py-3 px-3 text-center whitespace-nowrap">
                        <span class="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                            ✓ ส่งสำเร็จ
                        </span>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // Render Mobile Cards (sm and down)
    if (mobileList) {
        mobileList.innerHTML = pageItems.map(log => {
            const d = log.createdAt ? new Date(log.createdAt) : new Date();
            const dateStr = d.toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
            const isBroadcast = log.type === 'broadcast' || log.recipientUid === 'all';

            return `
                <div class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 space-y-2.5 text-xs">
                    <div class="flex items-center justify-between gap-2">
                        <div>
                            ${isBroadcast ? `
                                <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400 font-bold text-[11px]">
                                    📢 ทุกคน (${log.recipientCount || 'ทั้งหมด'} คน)
                                </span>
                            ` : `
                                <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-bold text-[11px]">
                                    👤 ${escapeAdminHtml(log.recipientName || 'ผู้ใช้')}
                                </span>
                            `}
                        </div>
                        <div class="flex items-center gap-1.5 shrink-0">
                            <span class="text-[10px] text-slate-400 font-mono">${dateStr}</span>
                            <span class="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold">✓ ส่งแล้ว</span>
                        </div>
                    </div>

                    ${!isBroadcast && log.recipientEmail ? `
                        <div class="text-[11px] text-slate-400 -mt-1 truncate">
                            อีเมล: <span class="text-slate-600 dark:text-slate-300 font-mono text-[10px]">${escapeAdminHtml(log.recipientEmail)}</span>
                        </div>
                    ` : ''}

                    <div class="space-y-1">
                        <div class="font-bold text-slate-800 dark:text-slate-100 text-xs">
                            📌 ${escapeAdminHtml(log.title || 'โดย BenzNova')}
                        </div>
                        <div class="p-3 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200/70 dark:border-slate-700/70 text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed text-xs">
                            ${escapeAdminHtml(log.message || '-')}
                        </div>
                    </div>

                    <div class="flex items-center justify-between pt-1 text-[11px] text-slate-400 border-t border-slate-200/60 dark:border-slate-700/60">
                        <span>ผู้ส่ง: <strong class="text-slate-600 dark:text-slate-300 font-medium">${escapeAdminHtml(log.sentBy || 'โดย BenzNova')}</strong></span>
                        <span class="text-slate-400 text-[10px]">Audit Log</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderPaginationControls({
        containerId: 'messageLogsPagination',
        totalItems: _currentMessageLogs.length,
        currentPage: _msgLogsCurrentPage,
        pageSize: _msgLogsPageSize,
        onPageChange: 'changeMessageLogsPage',
        onPageSizeChange: 'changeMessageLogsPageSize'
    });
}

window.loadAdminMessageLogs = async function () {
    const tableBody = document.getElementById('messageLogsTableBody');
    const mobileList = document.getElementById('messageLogsMobileList');
    if (!tableBody && !mobileList) return;

    const loadingHtml = '<span class="inline-block animate-spin mr-2">🔄</span> กำลังโหลดประวัติข้อความ...';
    if (tableBody) {
        tableBody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-slate-400">${loadingHtml}</td></tr>`;
    }
    if (mobileList) {
        mobileList.innerHTML = `<div class="py-8 text-center text-slate-400 text-xs">${loadingHtml}</div>`;
    }

    try {
        const snap = await getDocs(collection(db, 'admin_messages_log'));
        const logs = [];
        snap.forEach(doc => {
            logs.push({ id: doc.id, ...doc.data() });
        });

        // Sort descending by createdAt
        logs.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

        if (logs.length === 0) {
            const emptyHtml = '📭 ยังไม่มีประวัติการส่งข้อความจากแอดมิน';
            if (tableBody) {
                tableBody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-slate-400">${emptyHtml}</td></tr>`;
            }
            if (mobileList) {
                mobileList.innerHTML = `<div class="py-8 text-center text-slate-400 text-xs">${emptyHtml}</div>`;
            }
            renderPaginationControls({
                containerId: 'messageLogsPagination',
                totalItems: 0,
                currentPage: 1,
                pageSize: _msgLogsPageSize,
                onPageChange: 'changeMessageLogsPage',
                onPageSizeChange: 'changeMessageLogsPageSize'
            });
            return;
        }

        _currentMessageLogs = logs;
        _msgLogsCurrentPage = 1;
        renderMessageLogsSlice();
    } catch (err) {
        console.error('Failed to load message logs:', err);
        const errMsg = `❌ โหลดประวัติข้อความไม่สำเร็จ: ${err.message}`;
        if (tableBody) {
            tableBody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-rose-500 text-xs">${errMsg}</td></tr>`;
        }
        if (mobileList) {
            mobileList.innerHTML = `<div class="py-8 text-center text-rose-500 text-xs">${errMsg}</div>`;
        }
    }
};

// ==========================================
// Admin: Gemini AI API Key Management (Firestore system_config/ai)
// ==========================================

window.toggleAdminKeyVisibility = function () {
    const input = document.getElementById('adminGeminiApiKeyInput');
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
};

window.loadAdminGeminiApiKey = async function () {
    const input = document.getElementById('adminGeminiApiKeyInput');
    const badge = document.getElementById('adminAiKeyStatusBadge');
    if (badge) {
        badge.textContent = '⏳ กำลังโหลด...';
        badge.className = 'text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500';
    }

    try {
        const snap = await getDoc(doc(db, 'system_config', 'ai'));
        if (snap.exists()) {
            const data = snap.data();
            const key = data.geminiApiKey || '';
            if (input && !input.value) {
                input.value = key;
            }
            const quota = data.dailyQuota || 15;
            const quotaInput = document.getElementById('adminAiDailyQuotaInput');
            if (quotaInput) quotaInput.value = quota;
            const quotaStat = document.getElementById('statAiCurrentQuota');
            if (quotaStat) quotaStat.textContent = `${quota}/คน`;
            if (badge) {
                if (key) {
                    badge.textContent = '✓ บันทึกคีย์แล้ว (พร้อมใช้งาน)';
                    badge.className = 'text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30';
                } else {
                    badge.textContent = '⚡ ยังไม่มี API Key (ใช้ Demo)';
                    badge.className = 'text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30';
                }
            }
        } else {
            if (badge) {
                badge.textContent = '⚡ ยังไม่มี API Key (ใช้ Demo)';
                badge.className = 'text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30';
            }
        }
    } catch (err) {
        console.error('Failed to load system AI config:', err);
        if (badge) {
            badge.textContent = '⚠️ ไม่สามารถโหลดสถานะได้';
            badge.className = 'text-[11px] font-bold px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30';
        }
    }
};

window.saveAdminGeminiApiKey = async function () {
    const input = document.getElementById('adminGeminiApiKeyInput');
    const key = (input ? input.value : '').trim();

    if (key && !key.startsWith('AIzaSy') && !key.startsWith('AQ.')) {
        alert("⚠️ รูปแบบ API Key ไม่ถูกต้อง!\n\nGoogle Gemini API Key ต้องขึ้นต้นด้วย 'AIzaSy...' หรือ 'AQ....' (รับได้ที่ https://aistudio.google.com/app/apikey)\n\nกรุณาตรวจสอบคีย์อีกครั้งก่อนบันทึกครับ");
        return;
    }

    if (!confirm(key ? 'ต้องการบันทึก Gemini API Key นี้ลงระบบ Firestore ใช่หรือไม่?' : 'ต้องการล้าง Gemini API Key และเปลี่ยนเป็น Demo ใช่หรือไม่?')) {
        return;
    }

    try {
        const quotaInput = document.getElementById('adminAiDailyQuotaInput');
        const dailyQuota = Math.max(1, Math.min(100, Number(quotaInput ? quotaInput.value : 15) || 15));

        await setDoc(doc(db, 'system_config', 'ai'), {
            dailyQuota: dailyQuota,
            geminiApiKey: key,
            updatedAt: new Date().toISOString(),
            updatedBy: currentUser?.email || 'admin'
        }, { merge: true });

        alert('✓ บันทึกการตั้งค่า Gemini AI ลงระบบ Firestore เรียบร้อยแล้ว!\nสมาชิกทุกคนที่ล็อกอินจะดึงคีย์ไปใช้งานได้ทันที');
        window.loadAdminGeminiApiKey();
    } catch (err) {
        console.error('Failed to save Gemini API key:', err);
        alert('❌ บันทึกไม่สำเร็จ: ' + err.message);
    }
};

window.testAdminGeminiApiKey = async function () {
    const input = document.getElementById('adminGeminiApiKeyInput');
    const key = (input ? input.value : '').trim();

    if (!key) {
        alert('กรุณากรอก API Key ก่อนทดสอบครับ');
        return;
    }

    const testModels = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-flash-lite-latest'];
    let lastErr = null;
    let workedModel = null;

    for (const m of testModels) {
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 10000);
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${encodeURIComponent(key)}`, {
                method: 'POST',
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': key
                },
                body: JSON.stringify({
                    contents: [
                        { parts: [{ text: "Ping test connection" }] }
                    ]
                })
            });
            clearTimeout(timer);

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error?.message || 'HTTP ' + res.status);
            }

            const data = await res.json();
            workedModel = m;
            break;
        } catch (e) {
            lastErr = e;
            if (e.message && (e.message.includes('API key') || e.message.includes('INVALID_ARGUMENT'))) {
                break;
            }
        }
    }

    if (workedModel) {
        alert(`🎉 การเชื่อมต่อสำเร็จ (Connection Verified 100%)!\n\nGemini API (${workedModel}) ตอบกลับปกติ คีย์นี้สามารถใช้งานฟังก์ชัน AI Snap & Log ได้อย่างสมบูรณ์แบบ`);
    } else {
        console.error('Gemini test ping failed:', lastErr);
        alert('❌ การทดสอบล้มเหลว: ' + (lastErr?.message || 'ไม่สามารถเชื่อมต่อได้'));
    }
};


let _currentAiScanLogs = [];
let _aiLogsCurrentPage = 1;
let _aiLogsPageSize = 10;

function changeAiScanLogsPage(newPage) {
    _aiLogsCurrentPage = newPage;
    renderAiScanLogsSlice();
}
window.changeAiScanLogsPage = changeAiScanLogsPage;

function changeAiScanLogsPageSize(newSize) {
    _aiLogsPageSize = newSize;
    _aiLogsCurrentPage = 1;
    renderAiScanLogsSlice();
}
window.changeAiScanLogsPageSize = changeAiScanLogsPageSize;
window.renderAiScanLogsSlice = renderAiScanLogsSlice;

function renderAiScanLogsSlice() {
    const tbody = document.getElementById('adminAiScanLogsTableBody');
    if (!tbody) return;

    const logs = window._currentAiScanLogs || _currentAiScanLogs;
    if (!logs || logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="py-8 text-center text-slate-400 text-xs">ยังไม่มีประวัติการสแกนอาหารในระบบ</td></tr>';
        renderPaginationControls({
            containerId: 'aiScanLogsPagination',
            totalItems: 0,
            currentPage: 1,
            pageSize: _aiLogsPageSize,
            onPageChange: 'changeAiScanLogsPage',
            onPageSizeChange: 'changeAiScanLogsPageSize'
        });
        return;
    }

    const totalPages = Math.max(1, Math.ceil(logs.length / _aiLogsPageSize));
    if (_aiLogsCurrentPage > totalPages) _aiLogsCurrentPage = totalPages;
    if (_aiLogsCurrentPage < 1) _aiLogsCurrentPage = 1;

    const startIdx = (_aiLogsCurrentPage - 1) * _aiLogsPageSize;
    const pageItems = logs.slice(startIdx, startIdx + _aiLogsPageSize);

    tbody.innerHTML = pageItems.map(d => {
        let tsMs = null;
        if (typeof d.timestamp === 'number') {
            tsMs = d.timestamp;
        } else if (d.timestamp && typeof d.timestamp.toMillis === 'function') {
            tsMs = d.timestamp.toMillis();
        } else if (d.timestamp && d.timestamp.seconds) {
            tsMs = d.timestamp.seconds * 1000;
        } else if (typeof d.timestamp === 'string') {
            const parsed = Date.parse(d.timestamp);
            if (!isNaN(parsed)) tsMs = parsed;
        }

        const timeFormatted = tsMs
            ? new Date(tsMs).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
            : '-';
        const dateFormatted = tsMs
            ? new Date(tsMs).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
            : '';

        const userPhoto = d.userPhoto || 'icon.svg';
        const userName = d.userName || 'ผู้ใช้งาน';
        const userEmail = d.userEmail || '';
        const foodName = d.foodName || 'เมนูอาหาร';
        const cal = Number(d.cal) || 0;
        const p = Number(d.p) || 0;
        const c = Number(d.c) || 0;
        const f = Number(d.f) || 0;
        const env = (d.environment || '').toLowerCase() === 'uat' ? 'UAT' : 'PROD';
        const envBadge = env === 'UAT'
            ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400">UAT</span>'
            : '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">PROD</span>';

        return `
            <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition">
                <td class="py-2.5 px-3 whitespace-nowrap text-slate-500 dark:text-slate-400 text-[11px]">
                    <div>${timeFormatted} น.</div>
                    <div class="text-[10px] text-slate-400">${dateFormatted}</div>
                </td>
                <td class="py-2.5 px-3">
                    <div class="flex items-center gap-2">
                        <img src="${userPhoto}" class="w-6 h-6 rounded-full border border-slate-200 dark:border-slate-700 object-cover" onerror="this.src='icon.svg'">
                        <div class="min-w-0">
                            <div class="font-bold text-slate-800 dark:text-slate-100 truncate max-w-[130px] sm:max-w-[180px]">${userName}</div>
                            <div class="text-[10px] text-slate-400 truncate max-w-[130px] sm:max-w-[180px]">${userEmail}</div>
                        </div>
                    </div>
                </td>
                <td class="py-2.5 px-3">
                    <span class="font-semibold text-slate-800 dark:text-slate-200">${foodName}</span>
                    <div class="text-[10px] text-slate-400">P:${p}g C:${c}g F:${f}g</div>
                </td>
                <td class="py-2.5 px-3 text-right font-black text-purple-600 dark:text-purple-400 whitespace-nowrap">
                    ${cal} kcal
                </td>
                <td class="py-2.5 px-3 text-center whitespace-nowrap">
                    ${envBadge}
                </td>
            </tr>
        `;
    }).join('');

    renderPaginationControls({
        containerId: 'aiScanLogsPagination',
        totalItems: logs.length,
        currentPage: _aiLogsCurrentPage,
        pageSize: _aiLogsPageSize,
        onPageChange: 'changeAiScanLogsPage',
        onPageSizeChange: 'changeAiScanLogsPageSize'
    });
}

window.loadAdminAiScanLogs = async function () {
    const tbody = document.getElementById('adminAiScanLogsTableBody');
    const statScans = document.getElementById('statAiScansToday');
    const statUsers = document.getElementById('statAiUniqueUsers');
    if (!tbody) return;

    try {
        tbody.innerHTML = '<tr><td colspan="5" class="py-6 text-center text-slate-400 text-xs">⏳ กำลังโหลดประวัติการสแกน...</td></tr>';

        const logsRef = collection(db, 'ai_scan_logs');
        const q = query(logsRef, orderBy('timestamp', 'desc'), limit(150));
        const snap = await getDocs(q);

        if (snap.empty) {
            _currentAiScanLogs = [];
            _aiLogsCurrentPage = 1;
            renderAiScanLogsSlice();
            if (statScans) statScans.textContent = '0';
            if (statUsers) statUsers.textContent = '0';
            return;
        }

        const todayIso = new Date().toISOString().split('T')[0];
        let scansTodayCount = 0;
        const uniqueUsersToday = new Set();

        const logItems = [];
        snap.forEach(docSnap => {
            const d = docSnap.data();
            let tsMs = null;
            if (typeof d.timestamp === 'number') {
                tsMs = d.timestamp;
            } else if (d.timestamp && typeof d.timestamp.toMillis === 'function') {
                tsMs = d.timestamp.toMillis();
            } else if (d.timestamp && d.timestamp.seconds) {
                tsMs = d.timestamp.seconds * 1000;
            } else if (typeof d.timestamp === 'string') {
                const parsed = Date.parse(d.timestamp);
                if (!isNaN(parsed)) tsMs = parsed;
            }

            const dateStr = d.dateStr || (tsMs ? new Date(tsMs).toISOString().split('T')[0] : '');
            if (dateStr === todayIso) {
                scansTodayCount++;
                if (d.userId || d.userEmail) uniqueUsersToday.add(d.userId || d.userEmail);
            }

            logItems.push({ id: docSnap.id, ...d });
        });

        _currentAiScanLogs = logItems;
        _aiLogsCurrentPage = 1;
        renderAiScanLogsSlice();
        if (statScans) statScans.textContent = scansTodayCount;
        if (statUsers) statUsers.textContent = uniqueUsersToday.size;
    } catch (err) {
        console.error('Failed to load AI scan logs:', err);
        tbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-rose-500 text-xs">⚠️ เกิดข้อผิดพลาดในการโหลดประวัติ: ${err.message}</td></tr>`;
    }
};

// ==========================================
// Admin AI Smart Food Cache & Token Savings Engine (v5.8.6)
// ==========================================
window.loadAdminAiCacheStats = async function () {
    const elTokensSaved = document.getElementById('statAiTokensSaved');
    const elCacheHitsSummary = document.getElementById('statAiCacheHitsSummary');
    const elUniqueFoods = document.getElementById('statCachedUniqueFoods');
    const elHitsTotal = document.getElementById('statCacheHitsTotal');
    const elTokensEst = document.getElementById('statEstimatedTokensSaved');
    const topDishesList = document.getElementById('topCachedDishesList');

    try {
        const cacheRef = collection(db, 'ai_food_cache');
        const snap = await getDocs(cacheRef);

        if (snap.empty) {
            if (elTokensSaved) elTokensSaved.textContent = '0';
            if (elCacheHitsSummary) elCacheHitsSummary.textContent = 'ดึงผลจาก Cache ฟรี 0 ครั้ง';
            if (elUniqueFoods) elUniqueFoods.textContent = '0 รายการ';
            if (elHitsTotal) elHitsTotal.textContent = '0 ครั้ง';
            if (elTokensEst) elTokensEst.textContent = '0 Tokens';
            if (topDishesList) topDishesList.innerHTML = '<div class="text-slate-400 text-xs py-2">ยังไม่มีเมนูในคลังแคช</div>';
            return;
        }

        const items = [];
        let totalHits = 0;
        snap.forEach(docSnap => {
            const d = docSnap.data();
            const hits = Number(d.hitCount) || 1;
            totalHits += hits;
            items.push({
                id: docSnap.id,
                foodName: d.summaryTitle || d.rawQuery || d.key || docSnap.id,
                hits: hits,
                totalCal: d.totalCal || 0,
                lastAccessedAt: d.lastAccessedAt || d.cachedAt
            });
        });

        const tokensSavedCount = totalHits * 1200;

        if (elTokensSaved) elTokensSaved.textContent = tokensSavedCount.toLocaleString();
        if (elCacheHitsSummary) elCacheHitsSummary.textContent = `ประหยัดแล้ว ${totalHits.toLocaleString()} ครั้ง (~${tokensSavedCount.toLocaleString()} Tokens)`;
        if (elUniqueFoods) elUniqueFoods.textContent = `${snap.size.toLocaleString()} รายการ`;
        if (elHitsTotal) elHitsTotal.textContent = `${totalHits.toLocaleString()} ครั้ง`;
        if (elTokensEst) elTokensEst.textContent = `${tokensSavedCount.toLocaleString()} Tokens`;

        items.sort((a, b) => b.hits - a.hits);
        const top5 = items.slice(0, 5);

        if (topDishesList) {
            topDishesList.innerHTML = top5.map((d, idx) => `
                <div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-200/60 dark:border-slate-600/60">
                    <div class="flex items-center gap-2 min-w-0">
                        <span class="w-5 h-5 rounded-full bg-purple-500/20 text-purple-600 dark:text-purple-400 font-bold text-[10px] flex items-center justify-center shrink-0">
                            ${idx + 1}
                        </span>
                        <div class="min-w-0">
                            <span class="font-bold text-slate-800 dark:text-slate-100 truncate block">${escapeAdminHtml(d.foodName)}</span>
                            <span class="text-[10px] text-slate-400 font-mono">${d.totalCal} kcal</span>
                        </div>
                    </div>
                    <div class="text-right shrink-0">
                        <span class="text-xs font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                            ⚡ ${d.hits.toLocaleString()} ครั้ง
                        </span>
                        <div class="text-[10px] text-slate-400">~${(d.hits * 1200).toLocaleString()} tokens</div>
                    </div>
                </div>
            `).join('');
        }
    } catch (err) {
        console.warn('Failed to load AI cache stats:', err);
        if (topDishesList) topDishesList.innerHTML = `<div class="text-slate-400 text-xs py-2">ไม่สามารถดึงข้อมูลแคชได้: ${err.message}</div>`;
    }
};

// ==========================================
// 🛡️ SECURITY AUDIT & ANTI-CHEAT ENGINE (Phase 3)
// ==========================================
let _currentSecurityLogs = [];
let _securityLogsCurrentPage = 1;
let _securityLogsPageSize = 10;

window._currentSecurityLogs = _currentSecurityLogs;

function changeSecurityLogsPage(page) {
    _securityLogsCurrentPage = page;
    renderSecurityLogsSlice();
}
window.changeSecurityLogsPage = changeSecurityLogsPage;

function changeSecurityLogsPageSize(newSize) {
    _securityLogsPageSize = Number(newSize) || 10;
    _securityLogsCurrentPage = 1;
    renderSecurityLogsSlice();
}
window.changeSecurityLogsPageSize = changeSecurityLogsPageSize;

function renderSecurityLogsSlice() {
    const tbody = document.getElementById('securityLogsTableBody');
    if (!tbody) return;

    const logs = window.allSecurityLogsData || _currentSecurityLogs;
    if (!logs || logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-slate-400 text-xs">🛡️ ยังไม่พบเหตุการณ์น่าสงสัย ระบบปลอดภัยและทำงานปกติ 100%</td></tr>`;
        renderPaginationControls({
            containerId: 'securityLogsPagination',
            totalItems: 0,
            currentPage: 1,
            pageSize: _securityLogsPageSize,
            onPageChange: 'changeSecurityLogsPage',
            onPageSizeChange: 'changeSecurityLogsPageSize'
        });
        return;
    }

    const startIdx = (_securityLogsCurrentPage - 1) * _securityLogsPageSize;
    const endIdx = startIdx + _securityLogsPageSize;
    const pageItems = logs.slice(startIdx, endIdx);

    tbody.innerHTML = pageItems.map(item => {
        let typeBadge = '';
        if (item.type === 'UNAUTHORIZED_PRESTIGE_EQUIP') {
            typeBadge = '<span class="px-2 py-0.5 rounded-full font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[10px]">⚠️ พยายามสวมกรอบผิดกฎ</span>';
        } else if (item.type === 'STREAK_SPOOF_TAMPER') {
            typeBadge = '<span class="px-2 py-0.5 rounded-full font-bold bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30 text-[10px]">🚫 ปลอมแปลงสตรีค</span>';
        } else if (item.type === 'ILLEGAL_FRAME_DOWNGRADE') {
            typeBadge = '<span class="px-2 py-0.5 rounded-full font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-[10px]">⚡ ตรวจพบกรอบไม่ถูกต้อง</span>';
        } else {
            typeBadge = `<span class="px-2 py-0.5 rounded-full font-bold bg-slate-500/15 text-slate-600 dark:text-slate-400 text-[10px]">${escapeAdminHtml(item.type || 'UNKNOWN')}</span>`;
        }

        const dateStr = item.timestamp ? new Date(item.timestamp).toLocaleString('th-TH', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        }) : '-';

        const userIdentity = item.userEmail && item.userEmail !== 'guest' 
            ? `<span class="font-bold text-slate-800 dark:text-slate-100">${escapeAdminHtml(item.userEmail)}</span>`
            : `<span class="font-bold text-slate-500">⚪ ผู้ใช้ทั่วไป (${escapeAdminHtml(item.platform || 'อุปกรณ์')})</span>`;
        const devId = item.deviceId ? `<div class="font-mono text-[10px] text-slate-400 truncate max-w-[140px]" title="${escapeAdminHtml(item.deviceId)}">${escapeAdminHtml(item.deviceId)}</div>` : '';

        const reason = item.reason || 'ตรวจพบพฤติกรรมดัดแปลงข้อมูล';
        let detailHtml = `<div class="font-medium text-slate-700 dark:text-slate-200">${escapeAdminHtml(reason)}</div>`;
        if (item.details && typeof item.details === 'object') {
            const keys = Object.keys(item.details);
            if (keys.length > 0) {
                const subText = keys.map(k => `${k}: ${item.details[k]}`).join(' | ');
                detailHtml += `<div class="text-[10px] text-slate-400 font-mono mt-0.5">${escapeAdminHtml(subText)}</div>`;
            }
        }

        return `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                <td class="p-3 text-[11px] font-mono text-slate-400 whitespace-nowrap">${dateStr}</td>
                <td class="p-3 whitespace-nowrap">${typeBadge}</td>
                <td class="p-3 whitespace-nowrap">${userIdentity}${devId}</td>
                <td class="p-3">${detailHtml}</td>
                <td class="p-3 text-center whitespace-nowrap">
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px]">
                        <span>🛡️</span> สกัดกั้น & รีเซ็ตสำเร็จ
                    </span>
                </td>
            </tr>
        `;
    }).join('');

    renderPaginationControls({
        containerId: 'securityLogsPagination',
        totalItems: logs.length,
        currentPage: _securityLogsCurrentPage,
        pageSize: _securityLogsPageSize,
        onPageChange: 'changeSecurityLogsPage',
        onPageSizeChange: 'changeSecurityLogsPageSize'
    });
}
window.renderSecurityLogsSlice = renderSecurityLogsSlice;

window.loadAdminSecurityLogs = async function () {
    const tbody = document.getElementById('securityLogsTableBody');
    const elTotal = document.getElementById('countSecurityTotal');
    const elFrame = document.getElementById('countSecurityFrameTamper');
    const elStreak = document.getElementById('countSecurityStreakTamper');

    // If mocked in test environment
    if (window.allSecurityLogsData && Array.isArray(window.allSecurityLogsData)) {
        _currentSecurityLogs = [...window.allSecurityLogsData];
        updateSecurityCounters(_currentSecurityLogs);
        renderSecurityLogsSlice();
        return;
    }

    // Security check: Only verified admin can load audit logs from Firestore
    if (!currentUser || !ADMIN_EMAILS.includes((currentUser.email || '').toLowerCase())) {
        console.warn('Unauthorized loadAdminSecurityLogs rejected');
        return;
    }

    try {
        if (typeof db === 'undefined' || !db) {
            console.warn('Firestore db not available for security logs');
            return;
        }
        const logsCol = collection(db, 'security_audit_logs');
        const q = query(logsCol, orderBy('timestamp', 'desc'));
        const snap = await getDocs(q);

        _currentSecurityLogs = [];
        snap.forEach(docSnap => {
            _currentSecurityLogs.push({ id: docSnap.id, ...docSnap.data() });
        });

        updateSecurityCounters(_currentSecurityLogs);
        _securityLogsCurrentPage = 1;
        renderSecurityLogsSlice();
    } catch (err) {
        console.warn('Could not load security logs:', err);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-slate-400 text-xs">ไม่สามารถดึงบันทึกความปลอดภัยได้: ${escapeAdminHtml(err.message)}</td></tr>`;
        }
    }
};

function updateSecurityCounters(logs) {
    const elTotal = document.getElementById('countSecurityTotal');
    const elFrame = document.getElementById('countSecurityFrameTamper');
    const elStreak = document.getElementById('countSecurityStreakTamper');

    const total = logs.length;
    const frameTamper = logs.filter(l => l.type === 'UNAUTHORIZED_PRESTIGE_EQUIP' || l.type === 'ILLEGAL_FRAME_DOWNGRADE').length;
    const streakTamper = logs.filter(l => l.type === 'STREAK_SPOOF_TAMPER').length;

    if (elTotal) elTotal.textContent = total.toLocaleString();
    if (elFrame) elFrame.textContent = frameTamper.toLocaleString();
    if (elStreak) elStreak.textContent = streakTamper.toLocaleString();
}
window.updateSecurityCounters = updateSecurityCounters;
