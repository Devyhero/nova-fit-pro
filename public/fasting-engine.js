/**
 * NovaFit Pro - Intermittent Fasting (IF) Timer Engine (v5.9.30)
 * Handles fasting plans (16:8, 18:6, 14:10, 20:4), active timers, history, and milestone alerts.
 */

function getFastingPlanTargetHours(plan) {
    if (plan === '18:6') return 18;
    if (plan === '14:10') return 14;
    if (plan === '20:4') return 20;
    return 16; // default 16:8
}

function setFastingPlan(plan) {
    if (!window.state) return;
    if (!window.state.fasting) window.state.fasting = {};
    window.state.fasting.plan = plan;
    window.state.fasting.targetHours = getFastingPlanTargetHours(plan);
    if (typeof window.saveState === 'function') window.saveState();
    renderFastingSection();
    if (typeof window.showToast === 'function') {
        window.showToast(`⏱️ สลับแผนอดอาหารเป็น IF ${plan} (${window.state.fasting.targetHours} ชม.)`);
    }
}

function toggleFastingTimer() {
    if (!window.state) return;
    if (!window.state.fasting) window.state.fasting = { isFasting: false, plan: '16:8', targetHours: 16 };

    if (!window.state.fasting.isFasting) {
        window.state.fasting.isFasting = true;
        window.state.fasting.startTime = Date.now();
        window.state.fasting.endTime = null;
        if (typeof window.saveState === 'function') window.saveState();
        renderFastingSection();
        if (typeof window.showToast === 'function') {
            window.showToast(`🔥 เริ่มนับเวลาอดอาหาร IF ${window.state.fasting.plan} แล้ว!`);
        }
    } else {
        openFastingCompleteModal();
    }
}

function openFastingCompleteModal() {
    const modal = document.getElementById('fastingCompleteModal');
    if (!modal) return;
    if (!window.state || !window.state.fasting || !window.state.fasting.startTime) return;

    const fasting = window.state.fasting;
    const plan = fasting.plan || '16:8';
    const targetHours = fasting.targetHours || getFastingPlanTargetHours(plan);
    const startMs = fasting.startTime;
    const nowMs = Date.now();
    const elapsedMs = Math.max(0, nowMs - startMs);
    const targetMs = targetHours * 3600 * 1000;
    const pct = Math.min(100, Math.round((elapsedMs / targetMs) * 100));

    const elapsedSecs = Math.floor(elapsedMs / 1000);
    const eh = Math.floor(elapsedSecs / 3600);
    const em = Math.floor((elapsedSecs % 3600) / 60);

    const startDate = new Date(startMs);
    const now = new Date(nowMs);
    const startStr = startDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    const endStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

    const planBadge = document.getElementById('fastingModalPlanBadge');
    if (planBadge) planBadge.textContent = `แผน IF ${plan} (เป้าหมาย ${targetHours} ชม.)`;

    const durationEl = document.getElementById('fastingModalDuration');
    if (durationEl) durationEl.textContent = `${eh} ชม. ${em} นาที`;

    const progressEl = document.getElementById('fastingModalProgressBar');
    if (progressEl) progressEl.style.width = `${pct}%`;

    const progressText = document.getElementById('fastingModalProgressText');
    if (progressText) progressText.textContent = `${pct}% ของเป้าหมาย`;

    const rangeEl = document.getElementById('fastingModalTimeRange');
    if (rangeEl) rangeEl.textContent = `เริ่ม ${startStr} น. → สิ้นสุด ${endStr} น.`;

    const statusBadge = document.getElementById('fastingModalStatusBadge');
    const headerTitle = document.getElementById('fastingModalTitle');
    const headerSub = document.getElementById('fastingModalSubtitle');

    if (elapsedMs >= targetMs) {
        const overMs = elapsedMs - targetMs;
        const oh = Math.floor(overMs / (3600 * 1000));
        const om = Math.floor((overMs % (3600 * 1000)) / (60 * 1000));
        if (statusBadge) {
            statusBadge.className = 'text-xs px-3 py-1 rounded-full font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25';
            statusBadge.textContent = '🏆 บรรลุเป้าหมายครบถ้วน!';
        }
        if (headerTitle) headerTitle.textContent = '🎉 ยินดีด้วย! ทำตามเป้าหมายสำเร็จ';
        if (headerSub) headerSub.textContent = `คุณอดอาหารครบ ${targetHours} ชม. ตามแผนเรียบร้อย${oh > 0 || om > 0 ? ` (เกินเป้าหมายมา ${oh} ชม. ${om} นาที)` : ''} ร่างกายได้รับประโยชน์จากการทำ IF เต็มที่ครับ!`;
    } else {
        const remHours = Math.ceil((targetMs - elapsedMs) / (3600 * 1000) * 10) / 10;
        if (statusBadge) {
            statusBadge.className = 'text-xs px-3 py-1 rounded-full font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25';
            statusBadge.textContent = '⏱️ สรุปเวลาก่อนสิ้นสุด';
        }
        if (headerTitle) headerTitle.textContent = 'ต้องการสิ้นสุดการอดอาหารตอนนี้ใช่หรือไม่?';
        if (headerSub) headerSub.textContent = `ทำเวลาได้ ${eh} ชม. ${em} นาที (ขาดอีกประมาณ ${remHours} ชม. จะครบตามเป้าหมาย ${plan})`;
    }

    // Milestone indicators based on hours completed
    const m1 = document.getElementById('fastingMilestone_1');
    const m2 = document.getElementById('fastingMilestone_2');
    const m3 = document.getElementById('fastingMilestone_3');
    const m4 = document.getElementById('fastingMilestone_4');

    if (m1) m1.className = eh >= 1 ? 'flex items-center gap-2 p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold' : 'flex items-center gap-2 p-2 rounded-xl bg-slate-100 dark:bg-slate-700/60 text-slate-400';
    if (m2) m2.className = eh >= 4 ? 'flex items-center gap-2 p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold' : 'flex items-center gap-2 p-2 rounded-xl bg-slate-100 dark:bg-slate-700/60 text-slate-400';
    if (m3) m3.className = eh >= 12 ? 'flex items-center gap-2 p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold' : 'flex items-center gap-2 p-2 rounded-xl bg-slate-100 dark:bg-slate-700/60 text-slate-400';
    if (m4) m4.className = eh >= 16 ? 'flex items-center gap-2 p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold' : 'flex items-center gap-2 p-2 rounded-xl bg-slate-100 dark:bg-slate-700/60 text-slate-400';

    modal.classList.remove('hidden');
}

function closeFastingCompleteModal() {
    const modal = document.getElementById('fastingCompleteModal');
    if (modal) modal.classList.add('hidden');
}

function confirmFinishFasting(goToMeal = false) {
    const state = window.state;
    if (!state || !state.fasting || !state.fasting.isFasting) {
        closeFastingCompleteModal();
        return;
    }
    const elapsedMs = Date.now() - (state.fasting.startTime || Date.now());
    const elapsedHours = Math.round((elapsedMs / (3600 * 1000)) * 10) / 10;

    state.fasting.isFasting = false;
    if (typeof window.triggerCelebrationConfetti === 'function') {
        window.triggerCelebrationConfetti();
    }
    if (typeof window.showMilestoneBeatCard === 'function') {
        window.showMilestoneBeatCard({
            icon: '⏱️',
            title: 'พิชิตเป้าหมาย Fasting สำเร็จ!',
            subtitle: `อดอาหารได้ครบ ${elapsedHours} ชม. ตามเป้าหมายเรียบร้อยแล้ว`,
            detail: 'ระบบเผาผลาญปรับตัวและดึงไขมันสะสมมาใช้ได้อย่างเต็มที่ ร่างกายพักผ่อนเต็มอิ่ม! ✨'
        });
    }
    state.fasting.endTime = Date.now();
    if (!state.fasting.history) state.fasting.history = [];
    state.fasting.history.unshift({
        plan: state.fasting.plan || '16:8',
        startTime: state.fasting.startTime,
        endTime: state.fasting.endTime,
        elapsedHours
    });
    if (state.fasting.history.length > 20) state.fasting.history.pop();
    if (typeof window.saveState === 'function') window.saveState();
    renderFastingSection();
    closeFastingCompleteModal();

    if (typeof window.showToast === 'function') {
        window.showToast(`🎉 สิ้นสุดการอดอาหาร! บันทึกประวัติสำเร็จ (${elapsedHours} ชม.)`);
    }

    if (goToMeal) {
        if (typeof window.selectMealTab === 'function') {
            window.selectMealTab('breakfast');
        }
        const foodSec = document.getElementById('foodSection');
        if (foodSec) {
            foodSec.scrollIntoView({ behavior: 'smooth' });
        }
    }
}

function promptEditFastingStartTime() {
    const state = window.state;
    if (!state || !state.fasting || !state.fasting.isFasting || !state.fasting.startTime) return;
    const currentStart = new Date(state.fasting.startTime);
    const defaultTimeStr = currentStart.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
    const newTime = prompt('กรุณาระบุเวลาที่เริ่มอดอาหารจริง (เช่น 20:00 หรือ 21:30):', defaultTimeStr);
    if (!newTime || !newTime.includes(':')) return;

    const [hh, mm] = newTime.split(':').map(x => parseInt(x, 10));
    if (isNaN(hh) || isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
        alert('รูปแบบเวลาไม่ถูกต้อง กรุณาระบุ เช่น 20:30');
        return;
    }

    const now = new Date();
    const targetDate = new Date();
    targetDate.setHours(hh, mm, 0, 0);
    if (targetDate.getTime() > now.getTime()) {
        targetDate.setDate(targetDate.getDate() - 1);
    }
    state.fasting.startTime = targetDate.getTime();
    if (typeof window.saveState === 'function') window.saveState();
    renderFastingSection();
    if (typeof window.showToast === 'function') {
        window.showToast(`✏️ อัปเดตเวลาเริ่มอดอาหารเป็น ${targetDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} เรียบร้อย`);
    }
}

let _lastFastingToggleTime = 0;
function toggleFastingCollapse(forceState) {
    const now = Date.now();
    if (typeof forceState !== 'boolean' && now - _lastFastingToggleTime < 150) return;
    _lastFastingToggleTime = now;

    const state = window.state;
    const body = document.getElementById('fastingPanelBody');
    const chevron = document.getElementById('fastingChevron');
    const label = document.getElementById('fastingCollapseLabel');
    if (!body || !state) return;

    if (!state.collapsedSections) state.collapsedSections = {};

    let isCollapsed;
    if (typeof forceState === 'boolean') {
        isCollapsed = forceState;
    } else {
        isCollapsed = !(body.classList.contains('hidden') || body.classList.contains('is-collapsed'));
    }

    state.collapsedSections['fasting'] = isCollapsed;

    const panel = document.getElementById('fastingTimerPanel');
    let panelRectBefore = null;
    if (panel) {
        panelRectBefore = panel.getBoundingClientRect();
    }

    if (typeof window.animateSmoothAccordion === 'function') {
        window.animateSmoothAccordion(body, isCollapsed, true);
    } else {
        body.classList.toggle('hidden', isCollapsed);
    }

    if (isCollapsed) {
        if (chevron) chevron.textContent = '▼';
        if (label) label.textContent = 'แสดง';
        try { localStorage.setItem('novafit_fasting_collapsed', 'true'); } catch (e) {}
    } else {
        if (chevron) chevron.textContent = '▲';
        if (label) label.textContent = 'ซ่อน';
        try { localStorage.setItem('novafit_fasting_collapsed', 'false'); } catch (e) {}
    }

    // Mobile iOS Safari Viewport & Overscroll Clamping Protection
    if (isCollapsed && panel) {
        const maxScrollY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        if (panelRectBefore && panelRectBefore.top < 0) {
            panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else if (window.scrollY > maxScrollY) {
            window.scrollTo({ top: maxScrollY, behavior: 'instant' });
        }
    }

    // Immediately update status badge text if fasting is active
    if (state.fasting && state.fasting.isFasting) {
        updateFastingTimerClock();
    }

    clearTimeout(window._collapseSaveTimer);
    window._collapseSaveTimer = setTimeout(() => {
        try {
            const storageKey = window.STORAGE_KEY || 'fitmacro_pro_v4_state';
            localStorage.setItem(storageKey, JSON.stringify(state));
        } catch (e) {}
    }, 100);
}

function updateFastingTimerClock() {
    const state = window.state;
    if (!state || !state.fasting || !state.fasting.isFasting) return;

    const fasting = state.fasting;
    const plan = fasting.plan || '16:8';
    const targetHours = fasting.targetHours || getFastingPlanTargetHours(plan);
    const startMs = fasting.startTime || Date.now();
    const elapsedMs = Math.max(0, Date.now() - startMs);
    const targetMs = targetHours * 3600 * 1000;
    const remainingMs = targetMs - elapsedMs;
    const pct = Math.min(100, Math.round((elapsedMs / targetMs) * 100));

    const elapsedSecs = Math.floor(elapsedMs / 1000);
    const eh = Math.floor(elapsedSecs / 3600);
    const em = Math.floor((elapsedSecs % 3600) / 60);
    const es = elapsedSecs % 60;
    const clockStr = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}:${String(es).padStart(2, '0')}`;

    const clockEl = document.getElementById('fastingTimerClock');
    const progressEl = document.getElementById('fastingProgressBar');
    const remainingEl = document.getElementById('fastingRemainingText');
    const statusBadge = document.getElementById('fastingStatusBadge');

    if (clockEl) clockEl.textContent = clockStr;
    if (progressEl) progressEl.style.width = `${pct}%`;

    const isCollapsed = state.collapsedSections && state.collapsedSections['fasting'] !== undefined
        ? !!state.collapsedSections['fasting']
        : (localStorage.getItem('novafit_fasting_collapsed') === 'true');

    if (remainingMs > 0) {
        const remSecs = Math.ceil(remainingMs / 1000);
        const rh = Math.floor(remSecs / 3600);
        const rm = Math.floor((remSecs % 3600) / 60);
        if (statusBadge) {
            statusBadge.textContent = isCollapsed ? `🔥 ${clockStr} (${pct}%)` : `🔥 กำลังอดอาหาร (${pct}%)`;
        }
        if (remainingEl) remainingEl.textContent = `เหลืออีก ${rh} ชม. ${rm} นาที จะครบ ${targetHours} ชม.`;
    } else {
        const overSecs = Math.floor(Math.abs(remainingMs) / 1000);
        const oh = Math.floor(overSecs / 3600);
        const om = Math.floor((overSecs % 3600) / 60);
        if (statusBadge) {
            statusBadge.textContent = '🎉 ครบเป้าหมายแล้ว!';
        }
        if (remainingEl) remainingEl.textContent = `ครบ ${targetHours} ชม. แล้ว (เกินมา ${oh} ชม. ${om} นาที) พร้อมเริ่มมื้อแรกได้เลยครับ`;
    }
}

function renderFastingSection() {
    const state = window.state;
    if (!state) return;
    const fasting = state.fasting || { isFasting: false, plan: '16:8', targetHours: 16 };
    const plan = fasting.plan || '16:8';
    const targetHours = fasting.targetHours || getFastingPlanTargetHours(plan);

    // Sync Plan Badge
    const planBadge = document.getElementById('fastingPlanBadge');
    if (planBadge) planBadge.textContent = plan;

    // Sync Collapsible State
    if (!state.collapsedSections) state.collapsedSections = {};
    const isCollapsed = state.collapsedSections['fasting'] !== undefined
        ? !!state.collapsedSections['fasting']
        : (localStorage.getItem('novafit_fasting_collapsed') === 'true');
    state.collapsedSections['fasting'] = isCollapsed;

    const bodyEl = document.getElementById('fastingPanelBody');
    const chevronEl = document.getElementById('fastingChevron');
    const labelEl = document.getElementById('fastingCollapseLabel');
    if (bodyEl) {
        bodyEl.classList.add('accordion-section');
        if (!bodyEl.classList.contains('accordion-animating')) {
            bodyEl.classList.toggle('hidden', isCollapsed);
            bodyEl.classList.toggle('is-collapsed', isCollapsed);
            bodyEl.style.maxHeight = isCollapsed ? '0px' : 'none';
        }
    }
    if (chevronEl) {
        chevronEl.textContent = isCollapsed ? '▼' : '▲';
    }
    if (labelEl) {
        labelEl.textContent = isCollapsed ? 'แสดง' : 'ซ่อน';
    }

    // Update plan buttons
    ['16:8', '18:6', '14:10', '20:4'].forEach(pKey => {
        const btn = document.getElementById('btnFastingPlan_' + pKey.replace(':', '_'));
        if (btn) {
            const isActive = plan === pKey;
            btn.className = `px-2 py-1 rounded-xl text-xs font-bold transition ${isActive 
                ? 'bg-purple-600 text-white shadow-xs' 
                : 'bg-white/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:border-purple-500/50'}`;
        }
    });

    const statusBadge = document.getElementById('fastingStatusBadge');
    const clockEl = document.getElementById('fastingTimerClock');
    const progressEl = document.getElementById('fastingProgressBar');
    const remainingEl = document.getElementById('fastingRemainingText');
    const rangeEl = document.getElementById('fastingTimeRangeText');
    const toggleBtn = document.getElementById('btnToggleFasting');
    const editBtn = document.getElementById('btnEditFastingStart');

    if (!fasting.isFasting) {
        if (statusBadge) {
            statusBadge.className = 'text-xs px-2.5 py-0.5 rounded-full font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300';
            statusBadge.textContent = '🍽️ ช่วงทานอาหาร';
        }
        if (clockEl) clockEl.textContent = '00:00:00';
        if (progressEl) progressEl.style.width = '0%';
        if (remainingEl) remainingEl.textContent = `แตะ "เริ่มอดอาหาร" เพื่อเริ่มนับเวลาเป้าหมาย ${targetHours} ชม.`;
        if (rangeEl) rangeEl.textContent = 'แตะที่นี่เพื่อซ่อน/ขยาย';
        if (toggleBtn) {
            toggleBtn.className = 'px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs shadow-xs transition active:scale-95 flex items-center gap-1.5';
            toggleBtn.innerHTML = '<span>⏱️ เริ่มอดอาหาร (Start Fast)</span>';
        }
        if (editBtn) editBtn.classList.add('hidden');
        return;
    }

    // Is Fasting
    const startMs = fasting.startTime || Date.now();
    const targetMs = targetHours * 3600 * 1000;
    const startDate = new Date(startMs);
    const targetDate = new Date(startMs + targetMs);
    const startStr = startDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    const targetStr = targetDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

    if (rangeEl) rangeEl.textContent = `เริ่ม ${startStr} น. → เป้าหมาย ${targetStr} น.`;
    if (statusBadge) {
        statusBadge.className = 'text-xs px-2.5 py-0.5 rounded-full font-bold bg-purple-500/20 text-purple-600 dark:text-purple-400 animate-pulse';
    }
    if (toggleBtn) {
        toggleBtn.className = 'px-4 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-amber-600 hover:from-rose-600 hover:to-amber-700 text-white font-bold text-xs shadow-xs transition active:scale-95 flex items-center gap-1.5';
        toggleBtn.innerHTML = '<span>🏁 สิ้นสุดการอดอาหาร (End Fast)</span>';
    }
    if (editBtn) editBtn.classList.remove('hidden');

    updateFastingTimerClock();
}

// Fasting Timer Ticker (Tick every second ONLY clock and progress, no DOM churn)
setInterval(() => {
    const state = window.state;
    if (state && state.fasting && state.fasting.isFasting) {
        updateFastingTimerClock();
    }
}, 1000);

// Window Exports
window.getFastingPlanTargetHours = getFastingPlanTargetHours;
window.setFastingPlan = setFastingPlan;
window.toggleFastingTimer = toggleFastingTimer;
window.openFastingCompleteModal = openFastingCompleteModal;
window.closeFastingCompleteModal = closeFastingCompleteModal;
window.confirmFinishFasting = confirmFinishFasting;
window.promptEditFastingStartTime = promptEditFastingStartTime;
window.toggleFastingCollapse = toggleFastingCollapse;
window.updateFastingTimerClock = updateFastingTimerClock;
window.renderFastingSection = renderFastingSection;
