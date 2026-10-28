/**
 * NovaFit Pro - Supplements & Vitamins Engine (v5.9.30)
 * Manages daily vitamin & supplement checklist, check/uncheck status,
 * custom supplement modal creation, deletion with confirm dialog, and default presets restoration.
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

    function showToastSafe(msg) {
        if (typeof showToast === 'function') return showToast(msg);
        if (typeof window.showToast === 'function') return window.showToast(msg);
    }

    function showConfirmDialogSafe(opts) {
        if (typeof showConfirmDialog === 'function') return showConfirmDialog(opts);
        if (typeof window.showConfirmDialog === 'function') return window.showConfirmDialog(opts);
        if (confirm(opts.message || 'ยืนยันการดำเนินการ')) {
            if (opts.onConfirm) opts.onConfirm();
        }
    }

    function openModalAnimatedSafe(modalId, onOpened) {
        if (typeof openModalAnimated === 'function') return openModalAnimated(modalId, onOpened);
        if (typeof window.openModalAnimated === 'function') return window.openModalAnimated(modalId, onOpened);
        const m = document.getElementById(modalId);
        if (m) {
            m.classList.remove('hidden');
            if (typeof onOpened === 'function') onOpened();
        }
    }

    function closeModalAnimatedSafe(modalId) {
        if (typeof closeModalAnimated === 'function') return closeModalAnimated(modalId);
        if (typeof window.closeModalAnimated === 'function') return window.closeModalAnimated(modalId);
        const m = document.getElementById(modalId);
        if (m) m.classList.add('hidden');
    }

    function getDefaultSupplementsSafe() {
        if (typeof window.DEFAULT_SUPPLEMENTS !== 'undefined' && Array.isArray(window.DEFAULT_SUPPLEMENTS)) {
            return window.DEFAULT_SUPPLEMENTS;
        }
        if (typeof DEFAULT_SUPPLEMENTS !== 'undefined' && Array.isArray(DEFAULT_SUPPLEMENTS)) {
            return DEFAULT_SUPPLEMENTS;
        }
        return [];
    }

    // ==========================================
    // SUPPLEMENT & VITAMIN CHECKLIST (v5.6.6)
    // ==========================================
    function renderSupplements() {
        const container = document.getElementById('supplementListContainer');
        const badge = document.getElementById('suppProgressBadge');
        const bar = document.getElementById('barSupplements');
        if (!container) return;

        const appState = getAppStateSafe();
        if (!appState) return;

        const dStr = appState.selectedDate;
        const defaultList = getDefaultSupplementsSafe();
        const supps = Array.isArray(appState.supplementList) ? appState.supplementList : defaultList;
        const checkedMap = (appState.supplementsByDate && appState.supplementsByDate[dStr]) || {};

        let takenCount = 0;
        supps.forEach(s => {
            if (checkedMap[s.id]) takenCount++;
        });

        if (badge) {
            badge.textContent = `${takenCount}/${supps.length} ทานแล้ว`;
            badge.className = takenCount === supps.length && supps.length > 0
                ? 'text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                : 'text-xs px-2.5 py-0.5 rounded-full font-bold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20';
        }

        if (bar) {
            const pct = supps.length > 0 ? Math.round((takenCount / supps.length) * 100) : 0;
            bar.style.width = `${pct}%`;
        }

        if (supps.length === 0) {
            container.innerHTML = `
                <div class="col-span-1 sm:col-span-2 text-center py-6 px-4 bg-slate-50/60 dark:bg-slate-700/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                    <div class="text-2xl mb-1.5">💊</div>
                    <div class="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">ยังไม่มีรายการวิตามินหรืออาหารเสริม</div>
                    <div class="text-[11px] text-slate-400 dark:text-slate-500 mb-3">กดปุ่ม "+ เพิ่มวิตามิน" เพื่อบันทึกตัวที่คุณทาน หรือคืนค่าเริ่มต้นได้เลย</div>
                    <div class="flex items-center justify-center gap-2 flex-wrap">
                        <button type="button" onclick="openAddSupplementModal()" class="text-xs px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold shadow-xs transition">
                            + เพิ่มวิตามิน
                        </button>
                        <button type="button" onclick="restoreDefaultSupplements()" class="text-xs px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg font-medium transition">
                            ↺ คืนค่าเริ่มต้น (7 รายการ)
                        </button>
                    </div>
                </div>
            `;
            return;
        }

        const itemsHtml = supps.map(s => {
            const isTaken = !!checkedMap[s.id];
            const bgClass = isTaken
                ? 'bg-emerald-500/10 border-emerald-500/40 text-slate-800 dark:text-slate-100 shadow-xs'
                : 'bg-slate-50 dark:bg-slate-700/40 border-slate-200/80 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300';
            const checkIcon = isTaken
                ? '<span class="w-5 h-5 rounded-md bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-xs">✓</span>'
                : '<span class="w-5 h-5 rounded-md border border-slate-300 dark:border-slate-500 flex items-center justify-center text-xs shrink-0"></span>';

            return `
                <div class="flex items-center justify-between p-2.5 rounded-xl border transition ${bgClass} gap-2 cursor-pointer group"
                    onclick="toggleSupplement('${s.id}')">
                    <div class="flex items-center gap-2 min-w-0">
                        ${checkIcon}
                        <div class="min-w-0">
                            <div class="text-xs font-semibold truncate flex items-center gap-1 ${isTaken ? 'line-through text-slate-400' : ''}">
                                <span>${s.icon || '💊'}</span>
                                <span>${s.name}</span>
                            </div>
                            <div class="text-[10px] text-slate-400 truncate">${s.time || 'พร้อมอาหาร'}</div>
                        </div>
                    </div>
                    <button type="button" onclick="event.stopPropagation(); deleteSupplement('${s.id}')"
                        class="text-slate-400 hover:text-rose-500 dark:text-slate-500 dark:hover:text-rose-400 p-1.5 text-xs shrink-0 rounded hover:bg-rose-500/10 transition"
                        title="ลบ ${s.name} ออกจากรายการ">✕</button>
                </div>
            `;
        }).join('');

        const footerHtml = `
            <div class="col-span-1 sm:col-span-2 flex items-center justify-between pt-1 text-[11px] text-slate-400">
                <span>💡 แตะการ์ดเพื่อติ๊กทานแล้ว หรือกด ✕ เพื่อลบ</span>
                <button type="button" onclick="restoreDefaultSupplements()" class="text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 underline transition">
                    ↺ คืนค่ารายการเริ่มต้น
                </button>
            </div>
        `;

        container.innerHTML = itemsHtml + footerHtml;
    }

    function toggleSupplement(suppId) {
        const appState = getAppStateSafe();
        if (!appState) return;

        const dStr = appState.selectedDate;
        if (!appState.supplementsByDate) appState.supplementsByDate = {};
        if (!appState.supplementsByDate[dStr]) appState.supplementsByDate[dStr] = {};
        const cur = !appState.supplementsByDate[dStr][suppId];
        appState.supplementsByDate[dStr][suppId] = cur;
        saveStateSafe();
        renderSupplements();

        const defaultList = getDefaultSupplementsSafe();
        const allSupps = Array.isArray(appState.supplementList)
            ? appState.supplementList
            : defaultList;

        const supp = allSupps.find(s => s.id === suppId);
        if (cur) {
            const allTaken = allSupps.length > 0 && allSupps.every(s => appState.supplementsByDate[dStr][s.id]);
            if (allTaken) {
                showToastSafe('🎉 เยี่ยมมาก! ทานวิตามิน & อาหารเสริมครบทุกตัวตามเป้าของวันนี้แล้ว');
            } else {
                showToastSafe(`✓ ทาน ${supp?.name || 'วิตามิน'} แล้ว`);
            }
        }
    }

    let _modalOpeningCooldown = 0;

    function openAddSupplementModal() {
        const appState = getAppStateSafe();
        // 1. Auto-uncollapse supplement card if it was collapsed so user sees the list!
        if (appState && appState.collapsedSections && appState.collapsedSections['section_supplements']) {
            appState.collapsedSections['section_supplements'] = false;
            const body = document.getElementById('body_section_supplements');
            const icon = document.getElementById('icon_section_supplements');
            if (body) body.classList.remove('hidden');
            if (icon) icon.textContent = '▲';
        }

        const modal = document.getElementById('addSupplementModal');
        if (!modal) return;
        const inName = document.getElementById('inSuppName');
        const inTime = document.getElementById('inSuppTime');
        const inIcon = document.getElementById('inSuppIcon');
        if (inName) inName.value = '';
        if (inTime) inTime.value = '';
        if (inIcon) inIcon.value = '💊';

        _modalOpeningCooldown = Date.now();
        openModalAnimatedSafe('addSupplementModal', () => { if (inName) inName.focus(); });
    }

    function closeAddSupplementModal() {
        closeModalAnimatedSafe('addSupplementModal');
    }

    function closeAddSupplementModalOnBackdrop(e) {
        // Guard against mobile touch event ghost-click
        if (Date.now() - _modalOpeningCooldown < 350) return;
        if (e && e.target && e.target.id === 'addSupplementModal') {
            closeAddSupplementModal();
        }
    }

    function submitNewSupplement() {
        const appState = getAppStateSafe();
        if (!appState) return;

        const nameInput = document.getElementById('inSuppName');
        const name = nameInput ? nameInput.value.trim() : '';
        const time = (document.getElementById('inSuppTime')?.value || '').trim() || 'ตามเวลาที่สะดวก';
        const icon = (document.getElementById('inSuppIcon')?.value || '').trim() || '💊';
        if (!name) {
            alert('กรุณากรอกชื่อวิตามินหรืออาหารเสริมครับ');
            return;
        }
        if (!Array.isArray(appState.supplementList)) {
            appState.supplementList = [];
        } else {
            appState.supplementList = [...appState.supplementList];
        }
        const newSupp = {
            id: 'supp_' + Date.now(),
            name,
            time,
            icon,
            isCustom: true
        };
        appState.supplementList.push(newSupp);
        saveStateSafe();
        closeAddSupplementModal();

        // Ensure section is expanded so user sees the newly added supplement
        if (appState.collapsedSections && appState.collapsedSections['section_supplements']) {
            appState.collapsedSections['section_supplements'] = false;
            const body = document.getElementById('body_section_supplements');
            const icon = document.getElementById('icon_section_supplements');
            if (body) body.classList.remove('hidden');
            if (icon) icon.textContent = '▲';
        }

        renderSupplements();
        showToastSafe(`✓ เพิ่มอาหารเสริม "${name}" เรียบร้อยแล้ว`);
    }

    function deleteSupplement(suppId) {
        const appState = getAppStateSafe();
        if (!appState) return;

        const list = Array.isArray(appState.supplementList) ? appState.supplementList : [];
        const target = list.find(s => s.id === suppId);
        const targetName = target ? target.name : 'อาหารเสริมนี้';
        showConfirmDialogSafe({
            icon: '💊',
            iconBgClass: 'w-14 h-14 mx-auto rounded-2xl bg-rose-500/15 text-rose-500 flex items-center justify-center text-3xl shadow-xs',
            title: 'ลบรายการวิตามิน / อาหารเสริม',
            message: `ต้องการลบ "${targetName}" ออกจากเช็กลิสต์ประจำวันใช่หรือไม่?`,
            confirmText: 'ลบรายการนี้',
            confirmClass: 'flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition cursor-pointer',
            onConfirm: () => {
                appState.supplementList = list.filter(s => s.id !== suppId);
                saveStateSafe();
                renderSupplements();
                showToastSafe(`✓ ลบ "${targetName}" เรียบร้อยแล้ว`);
            }
        });
    }

    function deleteCustomSupplement(suppId) {
        deleteSupplement(suppId);
    }

    function restoreDefaultSupplements() {
        const appState = getAppStateSafe();
        if (!appState) return;

        const defaultList = getDefaultSupplementsSafe();
        showConfirmDialogSafe({
            icon: '🔄',
            iconBgClass: 'w-14 h-14 mx-auto rounded-2xl bg-indigo-500/15 text-indigo-500 flex items-center justify-center text-3xl shadow-xs',
            title: 'คืนค่าอาหารเสริมเริ่มต้น',
            message: 'ต้องการคืนค่ารายการวิตามิน/อาหารเสริมเริ่มต้น (7 รายการมาตรฐาน) ใช่หรือไม่? รายการที่เพิ่มใหม่จะถูกแทนที่ด้วยชุดมาตรฐาน',
            confirmText: 'คืนค่ามาตรฐาน',
            confirmClass: 'flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition cursor-pointer',
            onConfirm: () => {
                appState.supplementList = JSON.parse(JSON.stringify(defaultList));
                saveStateSafe();
                renderSupplements();
                showToastSafe('✓ คืนค่ารายการอาหารเสริมเริ่มต้นเรียบร้อยแล้ว');
            }
        });
    }

    // Attach to window for global access and backward compatibility
    window.renderSupplements = renderSupplements;
    window.toggleSupplement = toggleSupplement;
    window.openAddSupplementModal = openAddSupplementModal;
    window.closeAddSupplementModal = closeAddSupplementModal;
    window.closeAddSupplementModalOnBackdrop = closeAddSupplementModalOnBackdrop;
    window.submitNewSupplement = submitNewSupplement;
    window.deleteSupplement = deleteSupplement;
    window.deleteCustomSupplement = deleteCustomSupplement;
    window.restoreDefaultSupplements = restoreDefaultSupplements;
})();
