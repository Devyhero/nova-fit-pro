/**
 * NovaFit Pro - Daily Report & Changelog Engine (v5.9.30)
 * Manages daily nutrition & workout deficit report modal,
 * version release changelog modal, PWA update prompt banner,
 * Service Worker cache busting, and version badge alignment.
 */

(function () {
    'use strict';

    // Safe inter-module helpers
    function getAppStateSafe() {
        return (typeof window !== 'undefined' && window.state) ? window.state : (typeof state !== 'undefined' ? state : null);
    }

    function getCalculatedTargetsSafe() {
        if (typeof getCalculatedTargets === 'function') return getCalculatedTargets();
        if (typeof window.getCalculatedTargets === 'function') return window.getCalculatedTargets();
        return null;
    }

    function showToastSafe(msg, duration = 2200) {
        if (typeof showToast === 'function') return showToast(msg);
        if (typeof window.showToast === 'function') return window.showToast(msg, duration);
    }

    function getAppVersionSafe() {
        if (typeof APP_VERSION !== 'undefined') return APP_VERSION;
        if (typeof window.APP_VERSION !== 'undefined') return window.APP_VERSION;
        return '5.9.30';
    }

    // ==========================================
    // DAILY NUTRITION & DEFICIT REPORT MODAL
    // ==========================================
    function openDailyReportModal() {
        const appState = getAppStateSafe();
        if (!appState) return;

        const t = getCalculatedTargetsSafe();
        if (!t) return;

        const dStr = appState.selectedDate;
        const meals = (appState.logsByDate && appState.logsByDate[dStr]) || [];
        const sumP = Math.round(meals.reduce((s, m) => s + m.p, 0));
        const sumC = Math.round(meals.reduce((s, m) => s + m.c, 0));
        const sumF = Math.round(meals.reduce((s, m) => s + m.f, 0));
        const sumCal = Math.round(meals.reduce((s, m) => s + m.cal, 0));

        const dayWorkouts = (appState.workoutsByDate && appState.workoutsByDate[dStr]) || [];
        const burnedCal = dayWorkouts.reduce((s, w) => s + w.cal, 0);
        const netCal = sumCal - burnedCal;

        const waterGlasses = (appState.waterByDate && appState.waterByDate[dStr]) || 0;
        const waterMl = waterGlasses * 250;
        const diffWaterMl = t.waterTargetMl - waterMl;

        const diffCal = t.targetCal - sumCal;
        const diffP = t.pGram - sumP;
        const diffC = t.cGram - sumC;
        const diffF = t.fGram - sumF;

        const rowHtml = (label, eaten, target, diff, unit, color) => {
            const status = diff > 0
                ? `<span class="text-amber-500 font-bold">ขาดอีก ${diff.toLocaleString()} ${unit}</span>`
                : diff < 0
                    ? `<span class="text-rose-500 font-bold">เกินมา ${Math.abs(diff).toLocaleString()} ${unit}</span>`
                    : `<span class="text-emerald-500 font-bold">ครบเป๊ะ!</span>`;
            return `
                <div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                    <div>
                        <span class="font-bold ${color}">${label}</span>
                        <span class="text-slate-400 block text-[11px]">ทำได้ ${eaten.toLocaleString()} / เป้าหมาย ${target.toLocaleString()} ${unit}</span>
                    </div>
                    <div class="text-right">${status}</div>
                </div>
            `;
        };

        const waterStatus = diffWaterMl > 0
            ? `<span class="text-amber-500 font-bold">ขาดอีก ${Math.round(diffWaterMl / 250)} แก้ว (${diffWaterMl.toLocaleString()} มล.)</span>`
            : `<span class="text-emerald-500 font-bold">ดื่มครบเป้าแล้ว! (${waterGlasses} แก้ว)</span>`;

        const recordedWeight = appState.weightsByDate && appState.weightsByDate[dStr];
        const weightRowHtml = recordedWeight
            ? `
                <div class="flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <div>
                        <span class="font-bold text-emerald-600 dark:text-emerald-400">⚖️ น้ำหนักตัวที่บันทึกวันนี้</span>
                        <span class="text-slate-400 block text-[11px]">ใช้คำนวณอัตราเผาผลาญประจำวัน</span>
                    </div>
                    <div class="text-right font-bold text-emerald-500">${recordedWeight} กก.</div>
                </div>
            `
            : '';

        const workoutRowHtml = burnedCal > 0
            ? `
                <div class="flex items-center justify-between p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20">
                    <div>
                        <span class="font-bold text-orange-500">🏃 กิจกรรมออกกำลังกาย (เบิร์น)</span>
                        <span class="text-slate-400 block text-[11px]">${dayWorkouts.map(w => `${w.name} (-${w.cal})`).join(', ')}</span>
                    </div>
                    <div class="text-right">
                        <span class="text-orange-500 font-bold block">-${burnedCal.toLocaleString()} kcal</span>
                        <span class="text-[10px] text-slate-400 font-medium">Net: ${netCal.toLocaleString()} kcal</span>
                    </div>
                </div>
            `
            : '';

        const modalContent = document.getElementById('dailyReportModalContent');
        if (modalContent) {
            modalContent.innerHTML = `
                <p class="text-slate-500 dark:text-slate-400">สรุปข้อมูลของวันที่ <b>${dStr}</b> (${meals.length} รายการอาหาร):</p>
                <div class="space-y-2">
                    ${weightRowHtml}
                    ${rowHtml('🔥 พลังงานรวม (Calories)', sumCal, t.targetCal, diffCal, 'kcal', 'text-emerald-500')}
                    ${workoutRowHtml}
                    ${rowHtml('🥩 โปรตีน (Protein)', sumP, t.pGram, diffP, 'g', 'text-blue-500')}
                    ${rowHtml('🍚 คาร์โบไฮเดรต (Carbs)', sumC, t.cGram, diffC, 'g', 'text-amber-500')}
                    ${rowHtml('🥑 ไขมัน (Fat)', sumF, t.fGram, diffF, 'g', 'text-rose-500')}
                    <div class="flex items-center justify-between p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20">
                        <div>
                            <span class="font-bold text-sky-500">💧 น้ำดื่มสะอาด (Water)</span>
                            <span class="text-slate-400 block text-[11px]">ดื่มแล้ว ${waterMl.toLocaleString()} / เป้าหมาย ${t.waterTargetMl.toLocaleString()} มล.</span>
                        </div>
                        <div class="text-right">${waterStatus}</div>
                    </div>
                </div>
            `;
        }

        const modal = document.getElementById('dailyReportModal');
        if (modal) modal.classList.remove('hidden');
    }

    function closeDailyReportModal() {
        const modal = document.getElementById('dailyReportModal');
        if (modal) modal.classList.add('hidden');
    }

    // ==========================================
    // CHANGELOG & APP UPDATES
    // ==========================================
    function openChangelogModal(isNewUpdate = false) {
        const alertEl = document.getElementById('whatsNewAlert');
        if (alertEl) {
            alertEl.classList.toggle('hidden', !isNewUpdate);
        }
        const modal = document.getElementById('changelogModal');
        if (modal) {
            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        }
    }

    function closeChangelogModal() {
        const modal = document.getElementById('changelogModal');
        if (modal) {
            modal.classList.add('hidden');
            document.body.style.overflow = '';
        }
    }

    function closeChangelogModalOnBackdrop(e) {
        if (e && e.target && e.target.id === 'changelogModal') {
            closeChangelogModal();
        }
    }

    function showNewVersionBanner(newVersion) {
        const banner = document.getElementById('newVersionBanner');
        const tag = document.getElementById('newVersionTag');
        if (banner) {
            if (tag) tag.textContent = `v${newVersion}`;
            banner.classList.remove('hidden');
        }
    }

    function dismissNewVersionBanner() {
        const banner = document.getElementById('newVersionBanner');
        if (banner) banner.classList.add('hidden');
    }

    async function applyAppUpdate() {
        window._swManualUpdateTriggered = true;
        showToastSafe('🚀 กำลังติดตั้งเวอร์ชันใหม่...');
        try {
            if ('serviceWorker' in navigator) {
                const reg = await navigator.serviceWorker.getRegistration();
                if (reg) {
                    if (reg.waiting) {
                        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
                    }
                    await reg.update().catch(() => {});
                    if (reg.waiting) {
                        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
                    }
                }
            }
            if ('caches' in window) {
                const keys = await caches.keys();
                await Promise.all(keys.map(k => caches.delete(k)));
            }
        } catch (e) {
            console.warn('Update error:', e);
        }
        const url = new URL(window.location.href);
        url.searchParams.set('v_reload', Date.now().toString());
        window.location.replace(url.href);
    }

    async function checkForAppUpdates() {
        const curVer = getAppVersionSafe();
        try {
            const res = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
            if (!res.ok) return;
            const meta = await res.json();
            if (meta && meta.version && meta.version !== curVer) {
                showNewVersionBanner(meta.version);
            }
        } catch (e) {
            // Ignore fetch errors
        }
    }

    function updateVersionBadges() {
        const curVer = getAppVersionSafe();
        const hBadge = document.getElementById('headerVersionBadge');
        if (hBadge) hBadge.textContent = `🚀 v${curVer}`;
        const tBadge = document.getElementById('toolsVersionBadge');
        if (tBadge) tBadge.innerHTML = `<span>🚀</span> ประวัติอัปเดต (v${curVer})`;
        const alertText = document.getElementById('whatsNewAlertText');
        if (alertText) alertText.textContent = `ยินดีต้อนรับสู่ NovaFit Pro v${curVer}!`;
    }

    function checkFirstVisitVersionNotes() {
        const curVer = getAppVersionSafe();
        const LAST_SEEN_KEY = 'novafit_last_seen_version';
        const lastSeen = localStorage.getItem(LAST_SEEN_KEY);
        updateVersionBadges();
        if (lastSeen !== curVer) {
            localStorage.setItem(LAST_SEEN_KEY, curVer);
            setTimeout(() => {
                showToastSafe(`🚀 อัปเดตสู่ NovaFit Pro v${curVer} เรียบร้อย!`, 4000);
                if (lastSeen) {
                    openChangelogModal(true);
                }
            }, 800);
        }
    }

    // Attach to window for global access and backward compatibility
    window.openDailyReportModal = openDailyReportModal;
    window.closeDailyReportModal = closeDailyReportModal;
    window.openChangelogModal = openChangelogModal;
    window.closeChangelogModal = closeChangelogModal;
    window.closeChangelogModalOnBackdrop = closeChangelogModalOnBackdrop;
    window.showNewVersionBanner = showNewVersionBanner;
    window.dismissNewVersionBanner = dismissNewVersionBanner;
    window.applyAppUpdate = applyAppUpdate;
    window.checkForAppUpdates = checkForAppUpdates;
    window.updateVersionBadges = updateVersionBadges;
    window.checkFirstVisitVersionNotes = checkFirstVisitVersionNotes;
})();
