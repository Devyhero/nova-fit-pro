/**
 * NovaFit Pro - Modal Controller, Profile Drawer & Quick Add Engine (v5.9.30)
 * Handles Apple-grade smooth animated modal dialogs, profile biometrics drawer,
 * onboarding profile prompts, and quick meal logger (calories/protein).
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

    function renderAllSafe() {
        if (typeof renderAll === 'function') return renderAll();
        if (typeof window.renderAll === 'function') return window.renderAll();
    }

    function showToastSafe(msg) {
        if (typeof showToast === 'function') return showToast(msg);
        if (typeof window.showToast === 'function') return window.showToast(msg);
    }

    function playSoundSafe(type) {
        if (typeof playSound === 'function') return playSound(type);
        if (typeof window.playSound === 'function') return window.playSound(type);
    }

    function getMealConfigSafe() {
        if (typeof MEAL_CONFIG !== 'undefined') return MEAL_CONFIG;
        if (typeof window.MEAL_CONFIG !== 'undefined') return window.MEAL_CONFIG;
        return {};
    }

    // ==========================================
    // APPLE-GRADE SMOOTH MODALS CONTROLLER
    // ==========================================
    function openModalAnimated(modalId, onOpened) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        if (modal._closeTimer) {
            clearTimeout(modal._closeTimer);
            modal._closeTimer = null;
        }
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                modal.classList.add('modal-open');
                if (typeof onOpened === 'function') onOpened();
            });
        });
        document.body.style.overflow = 'hidden';
    }

    function closeModalAnimated(modalId, onClosed) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        modal.classList.remove('modal-open');
        if (modal._closeTimer) {
            clearTimeout(modal._closeTimer);
        }
        modal._closeTimer = setTimeout(() => {
            modal.classList.add('hidden');
            modal.style.display = 'none';
            document.body.style.overflow = '';
            if (typeof onClosed === 'function') onClosed();
            modal._closeTimer = null;
        }, 280);
    }

    // ==========================================
    // PROFILE SETTINGS DRAWER & ONBOARDING PROMPT
    // ==========================================
    function openProfileSettingsModal() {
        openModalAnimated('profileSettingsModal');
    }

    function closeProfileSettingsModal() {
        closeModalAnimated('profileSettingsModal');
    }

    function dismissProfileSettingsModal() {
        closeModalAnimated('profileSettingsModal');
        const appState = getAppStateSafe();
        if (appState && !appState.profileConfigured) {
            showToastSafe('ℹ️ ข้อมูลร่างกายยังไม่ได้รับการบันทึก ระบบจะแสดงหน้านี้อีกครั้งจนกว่าจะกด "✓ บันทึกข้อมูลเรียบร้อย"');
        }
    }

    function saveAndConfirmProfileSettings() {
        const appState = getAppStateSafe();
        if (appState) {
            appState.profileConfigured = true;
        }
        localStorage.setItem('novafit_profile_prompted', 'true');
        if (window.currentUser) {
            localStorage.setItem('novafit_profile_prompted_' + window.currentUser.uid, 'true');
            if (window.saveProfileConfiguredToCloud) {
                window.saveProfileConfiguredToCloud();
            } else if (window.triggerCloudSync) {
                window.triggerCloudSync(true);
            }
        }
        saveStateSafe();
        closeModalAnimated('profileSettingsModal');
        playSoundSafe('pop');
        showToastSafe('✓ บันทึกข้อมูลร่างกายและเป้าหมายสำเร็จแล้ว!');
    }

    function checkFirstVisitProfilePrompt() {
        const tourSeen = localStorage.getItem('novafit_tour_seen');
        // 1. If brand new visitor hasn't seen the tour, show App Tour first!
        if (!tourSeen) {
            setTimeout(() => {
                if (typeof window.openAppTourModal === 'function') {
                    window.openAppTourModal();
                }
            }, 500);
            return;
        }

        // 2. If profile is not yet confirmed (profileConfigured !== true), keep prompting until user saves!
        const appState = getAppStateSafe();
        if (appState && !appState.profileConfigured) {
            setTimeout(() => {
                openProfileSettingsModal();
                showToastSafe('⚙️ กรุณาตรวจสอบและกด "✓ บันทึกข้อมูลเรียบร้อย" เพื่อเริ่มคำนวณเป้าหมายส่วนตัว');
            }, 500);
        }
    }

    function closeProfileSettingsOnBackdrop(e) {
        if (e && e.target && e.target.id === 'profileSettingsModal') {
            dismissProfileSettingsModal();
        }
    }

    // ==========================================
    // QUICK ADD MODAL & ACTION
    // ==========================================
    function openQuickAddModal() {
        const inName = document.getElementById('inQuickName');
        const inCal = document.getElementById('inQuickCal');
        const inP = document.getElementById('inQuickP');
        const inC = document.getElementById('inQuickC');
        const inF = document.getElementById('inQuickF');
        if (inName) inName.value = '';
        if (inCal) inCal.value = '';
        if (inP) inP.value = '';
        if (inC) inC.value = '';
        if (inF) inF.value = '';
        openModalAnimated('quickAddModal', () => {
            if (inCal) inCal.focus();
        });
    }

    function closeQuickAddModal() {
        closeModalAnimated('quickAddModal');
    }

    function closeQuickAddOnBackdrop(e) {
        if (e && e.target && e.target.id === 'quickAddModal') {
            closeQuickAddModal();
        }
    }

    function submitQuickAddMeal() {
        const nameInput = document.getElementById("inQuickName");
        const name = (nameInput?.value || "").trim() || "⚡ มื้อด่วน (Quick Add)";
        const cal = Number(document.getElementById("inQuickCal")?.value) || 0;
        const p = Number(document.getElementById("inQuickP")?.value) || 0;
        let c = Number(document.getElementById("inQuickC")?.value);
        let f = Number(document.getElementById("inQuickF")?.value);

        if (cal <= 0 && p <= 0) {
            alert("กรุณากรอกแคลอรีหรือโปรตีนครับ");
            return;
        }

        if (isNaN(c) || c < 0) c = 0;
        if (isNaN(f) || f < 0) f = 0;

        const appState = getAppStateSafe();
        if (!appState) return;

        const mealKey = appState.activeMeal || "breakfast";
        const quickItem = {
            name,
            cal: Math.round(cal),
            p: Math.round(p * 10) / 10,
            c: Math.round(c * 10) / 10,
            f: Math.round(f * 10) / 10,
            portion: 1,
            meal: mealKey,
            servingSize: "1 ที่",
            timestamp: Date.now()
        };

        const dStr = appState.selectedDate;
        if (!appState.logsByDate) appState.logsByDate = {};
        if (!appState.logsByDate[dStr]) appState.logsByDate[dStr] = [];
        appState.logsByDate[dStr].push(quickItem);

        saveStateSafe();
        closeQuickAddModal();
        renderAllSafe();
        const mealConfig = getMealConfigSafe();
        showToastSafe(`⚡ บันทึก "${name}" (${quickItem.cal} kcal) ลงใน${mealConfig[mealKey]?.name || "มื้อนี้"}แล้ว`);
    }

    function copyYesterdayActiveMeal() {
        const appState = getAppStateSafe();
        const mealKey = (appState && appState.activeMeal) || "breakfast";
        if (typeof window.copyMealFromYesterday === 'function') {
            window.copyMealFromYesterday(mealKey);
        } else if (typeof copyMealFromYesterday === 'function') {
            copyMealFromYesterday(mealKey);
        }
    }

    // Attach to window for global access and backward compatibility
    window.openModalAnimated = openModalAnimated;
    window.closeModalAnimated = closeModalAnimated;
    window.openProfileSettingsModal = openProfileSettingsModal;
    window.closeProfileSettingsModal = closeProfileSettingsModal;
    window.dismissProfileSettingsModal = dismissProfileSettingsModal;
    window.saveAndConfirmProfileSettings = saveAndConfirmProfileSettings;
    window.checkFirstVisitProfilePrompt = checkFirstVisitProfilePrompt;
    window.closeProfileSettingsOnBackdrop = closeProfileSettingsOnBackdrop;
    window.openQuickAddModal = openQuickAddModal;
    window.closeQuickAddModal = closeQuickAddModal;
    window.closeQuickAddOnBackdrop = closeQuickAddOnBackdrop;
    window.submitQuickAddMeal = submitQuickAddMeal;
    window.copyYesterdayActiveMeal = copyYesterdayActiveMeal;
})();
