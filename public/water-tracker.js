/**
 * NovaFit Pro - Water Tracker & Hydration Engine (v5.9.30)
 * Manages daily water intake calculation, target adjustments based on body weight & activity,
 * clickable glass icon controls, water progress bar, and hydration feedback.
 */

(function () {
    'use strict';

    // Safe inter-module helpers
    function getAppStateSafe() {
        return (typeof window !== 'undefined' && window.state) ? window.state : (typeof state !== 'undefined' ? state : null);
    }

    function saveStateSafe() {
        if (typeof saveState === 'function') return saveState();
        if (typeof window.saveState === 'function') return window.saveState();
    }

    function playSoundSafe(type) {
        if (typeof playSound === 'function') return playSound(type);
        if (typeof window.playSound === 'function') return window.playSound(type);
    }

    function getCalculatedTargetsSafe(dateStr) {
        if (typeof getCalculatedTargets === 'function') return getCalculatedTargets(dateStr);
        if (typeof window.getCalculatedTargets === 'function') return window.getCalculatedTargets(dateStr);
        return null;
    }

    function renderDateTrackerAndRecommendationsSafe(targets, forceReshuffle = false) {
        if (typeof renderDateTrackerAndRecommendations === 'function') {
            return renderDateTrackerAndRecommendations(targets, forceReshuffle);
        }
        if (typeof window.renderDateTrackerAndRecommendations === 'function') {
            return window.renderDateTrackerAndRecommendations(targets, forceReshuffle);
        }
        renderWaterSection(targets);
    }

    function triggerLivingCompanionCheckSafe(delay = 600, force = true) {
        if (typeof triggerLivingCompanionCheck === 'function') {
            triggerLivingCompanionCheck(delay, force);
        } else if (typeof window.triggerLivingCompanionCheck === 'function') {
            window.triggerLivingCompanionCheck(delay, force);
        }
    }

    // ==========================================
    // WATER TRACKER & HYDRATION ENGINE
    // ==========================================
    function renderWaterSection(targets) {
        const appState = getAppStateSafe();
        if (!appState) return;
        if (!targets) {
            targets = getCalculatedTargetsSafe();
        }
        if (!targets) return;

        const subEl = document.getElementById('waterRecommendationSubtitle');
        const countEl = document.getElementById('waterCountText');
        const mlEl = document.getElementById('waterMlStatusText');
        const targetEl = document.getElementById('waterTargetText');
        const barEl = document.getElementById('barWater');
        const defEl = document.getElementById('waterDeficitText');
        const iconsEl = document.getElementById('waterGlassIcons');
        if (!subEl && !countEl && !barEl && !iconsEl) return;

        const dStr = appState.selectedDate;
        const waterGlasses = (appState.waterByDate && appState.waterByDate[dStr]) || 0;
        const targetGlasses = targets.waterTargetGlasses || 8;
        const currentMl = waterGlasses * 250;
        const targetMl = targets.waterTargetMl || (targetGlasses * 250);
        const remGlasses = Math.max(0, targetGlasses - waterGlasses);
        const remMl = Math.max(0, targetMl - currentMl);
        const pctWater = Math.min(100, Math.round((waterGlasses / targetGlasses) * 100));

        if (subEl) {
            subEl.textContent =
                `แนะนำตามน้ำหนัก ${targets.weight} กก. (35 มล./กก.${targets.activityBonusMl > 0 ? ` + ชดเชยออกกำลังกาย ${targets.activityBonusMl} มล.` : ''}) = ควรดื่มวันละ ${targetMl.toLocaleString()} มล.`;
        }

        if (countEl) countEl.textContent = `${waterGlasses} / ${targetGlasses} แก้ว`;
        if (mlEl) mlEl.textContent = `ดื่มแล้ว ${currentMl.toLocaleString()} มล. (${pctWater}%)`;
        if (targetEl) targetEl.textContent = `เป้าหมาย ${targetMl.toLocaleString()} มล. (${targetGlasses} แก้ว)`;
        if (barEl) barEl.style.width = `${pctWater}%`;

        if (defEl) {
            if (remGlasses > 0) {
                defEl.className = 'text-[11px] text-amber-500 font-medium mt-1.5';
                defEl.textContent = `💧 วันนี้ยังดื่มน้ำขาดอีก ${remGlasses} แก้ว (${remMl.toLocaleString()} มล.) คลิกที่รูปแก้วด้านล่างหรือกด + เพื่อบันทึก`;
            } else {
                defEl.className = 'text-[11px] text-emerald-500 font-semibold mt-1.5';
                defEl.textContent = `✅ ยอดเยี่ยม! วันนี้ดื่มน้ำครบตามเป้าหมาย ${targetMl.toLocaleString()} มล. แล้ว`;
            }
        }

        // Render clickable glass icons
        if (iconsEl) {
            const totalIcons = Math.max(targetGlasses, waterGlasses);
            let iconsHtml = '';
            for (let i = 1; i <= totalIcons; i++) {
                const filled = i <= waterGlasses;
                iconsHtml += `
                    <button onclick="setWaterDirect(${i})" title="ตั้งค่าเป็น ${i} แก้ว (${i * 250} มล.)"
                        class="w-7 h-8 rounded-lg flex items-center justify-center text-xs font-bold border transition ${filled
                        ? 'bg-sky-500 text-white border-sky-400 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-700/50 text-slate-400 border-slate-200 dark:border-slate-700 hover:border-sky-400'
                    }">
                        💧
                    </button>
                `;
            }
            iconsEl.innerHTML = iconsHtml;
        }
    }

    function adjustWater(delta) {
        const appState = getAppStateSafe();
        if (!appState) return;

        const dStr = appState.selectedDate;
        if (!appState.waterByDate) appState.waterByDate = {};
        const cur = appState.waterByDate[dStr] || 0;
        appState.waterByDate[dStr] = Math.max(0, cur + delta);
        if (delta > 0) playSoundSafe('water'); else playSoundSafe('delete');
        saveStateSafe();
        const t = getCalculatedTargetsSafe();
        renderDateTrackerAndRecommendationsSafe(t, false);
        triggerLivingCompanionCheckSafe(600, true);
    }

    function setWaterDirect(glasses) {
        const appState = getAppStateSafe();
        if (!appState) return;

        const dStr = appState.selectedDate;
        if (!appState.waterByDate) appState.waterByDate = {};
        const cur = appState.waterByDate[dStr] || 0;
        appState.waterByDate[dStr] = (cur === glasses) ? glasses - 1 : glasses;
        playSoundSafe('water');
        saveStateSafe();
        const t = getCalculatedTargetsSafe();
        renderDateTrackerAndRecommendationsSafe(t, false);
        triggerLivingCompanionCheckSafe(600, true);
    }

    // Attach to window for global access and backward compatibility
    window.renderWaterSection = renderWaterSection;
    window.adjustWater = adjustWater;
    window.setWaterDirect = setWaterDirect;
})();
