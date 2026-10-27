/**
 * NovaFit Pro - Meal Combos & Visual Editor Engine (v5.9.30)
 * Manages custom meal combos (sets), copying meals from yesterday,
 * visual multi-item portion editor modal, search in database, and applying combos.
 */

(function () {
    'use strict';

    // Safe inter-module helpers
    function getAppStateSafe() {
        return typeof state !== 'undefined' ? state : window.state;
    }

    function saveStateSafe() {
        if (typeof saveState === 'function') return saveState();
        if (typeof window.saveState === 'function') return window.saveState();
    }

    function showToastSafe(msg) {
        if (typeof showToast === 'function') return showToast(msg);
        if (typeof window.showToast === 'function') return window.showToast(msg);
    }

    function renderAllSafe() {
        if (typeof renderAll === 'function') return renderAll();
        if (typeof window.renderAll === 'function') return window.renderAll();
    }

    function renderFoodDatabaseExplorerSafe() {
        if (typeof renderFoodDatabaseExplorer === 'function') return renderFoodDatabaseExplorer();
        if (typeof window.renderFoodDatabaseExplorer === 'function') return window.renderFoodDatabaseExplorer();
    }

    function showConfirmDialogSafe(opts) {
        if (typeof showConfirmDialog === 'function') return showConfirmDialog(opts);
        if (typeof window.showConfirmDialog === 'function') return window.showConfirmDialog(opts);
        if (confirm(opts.message || 'ยืนยันการดำเนินการ')) {
            if (opts.onConfirm) opts.onConfirm();
        }
    }

    function getMealConfigSafe() {
        return typeof MEAL_CONFIG !== 'undefined' ? MEAL_CONFIG : (window.MEAL_CONFIG || {});
    }

    function getFoodDatabaseSafe() {
        return typeof FOOD_DATABASE !== 'undefined' ? FOOD_DATABASE : (window.FOOD_DATABASE || { categories: [] });
    }

    // ==========================================
    // MEAL COMBOS & YESTERDAY COPYING (v5.0.0)
    // ==========================================
    function copyMealFromYesterday(mealKey) {
        const appState = getAppStateSafe();
        if (!appState) return;
        const mealConfig = getMealConfigSafe();

        const curDate = new Date(appState.selectedDate + 'T00:00:00');
        const prevDate = new Date(curDate.getTime() - 86400000);
        const offset = prevDate.getTimezoneOffset() * 60000;
        const prevIso = new Date(prevDate.getTime() - offset).toISOString().split('T')[0];
        const prevMeals = (appState.logsByDate && appState.logsByDate[prevIso]) || [];
        const itemsToCopy = prevMeals.filter(m => (m.meal || 'breakfast') === mealKey);

        if (itemsToCopy.length === 0) {
            showToastSafe(`⚠️ ไม่พบรายการ${mealConfig[mealKey]?.name || 'มื้อนี้'}ของเมื่อวาน (${prevIso})`);
            return;
        }

        const todayStr = appState.selectedDate;
        if (!appState.logsByDate) appState.logsByDate = {};
        if (!appState.logsByDate[todayStr]) appState.logsByDate[todayStr] = [];

        const nowTime = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
        itemsToCopy.forEach(item => {
            const portion = item.portion || 1;
            appState.logsByDate[todayStr].push({
                id: 'meal_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                name: item.name,
                portion,
                baseCal: item.baseCal !== undefined ? item.baseCal : item.cal,
                baseP: item.baseP !== undefined ? item.baseP : item.p,
                baseC: item.baseC !== undefined ? item.baseC : item.c,
                baseF: item.baseF !== undefined ? item.baseF : item.f,
                cal: item.cal,
                p: item.p,
                c: item.c,
                f: item.f,
                meal: mealKey,
                time: nowTime
            });
        });

        saveStateSafe();
        renderAllSafe();
        showToastSafe(`✓ คัดลอก${mealConfig[mealKey]?.name || ''}จากเมื่อวาน (${itemsToCopy.length} รายการ) เรียบร้อย!`);
    }

    function saveMealAsCombo(mealKey) {
        const appState = getAppStateSafe();
        if (!appState) return;
        const mealConfig = getMealConfigSafe();

        const todayStr = appState.selectedDate;
        const meals = (appState.logsByDate && appState.logsByDate[todayStr]) || [];
        const items = meals.filter(m => (m.meal || 'breakfast') === mealKey);
        if (items.length === 0) {
            showToastSafe('⚠️ มื้อนี้ยังไม่มีรายการอาหารให้เซฟเป็นเซ็ต');
            return;
        }

        const defaultName = `เซ็ต${mealConfig[mealKey]?.name || 'มื้ออาหาร'}ประจำ`;
        const comboName = prompt(`ตั้งชื่อเซ็ตอาหารนี้ (${items.length} รายการ):`, defaultName);
        if (!comboName || !comboName.trim()) return;

        if (!Array.isArray(appState.mealCombos)) appState.mealCombos = [];

        const newCombo = {
            id: 'combo_' + Date.now(),
            name: comboName.trim(),
            meal: mealKey,
            items: items.map(x => ({
                name: x.name,
                portion: x.portion || 1,
                baseCal: x.baseCal !== undefined ? x.baseCal : x.cal,
                baseP: x.baseP !== undefined ? x.baseP : x.p,
                baseC: x.baseC !== undefined ? x.baseC : x.c,
                baseF: x.baseF !== undefined ? x.baseF : x.f,
                cal: x.cal,
                p: x.p,
                c: x.c,
                f: x.f
            }))
        };

        appState.mealCombos.push(newCombo);
        saveStateSafe();
        renderFoodDatabaseExplorerSafe();
        showToastSafe(`📦 บันทึกเซ็ต "${newCombo.name}" เรียบร้อยแล้ว!`);
    }

    function applyMealCombo(comboId, targetMealKey) {
        const appState = getAppStateSafe();
        if (!appState) return;
        const mealConfig = getMealConfigSafe();

        const combo = (appState.mealCombos || []).find(c => c.id === comboId);
        if (!combo || !combo.items || combo.items.length === 0) return;

        const targetMeal = targetMealKey || appState.activeMeal || combo.meal || 'breakfast';
        const todayStr = appState.selectedDate;
        if (!appState.logsByDate) appState.logsByDate = {};
        if (!appState.logsByDate[todayStr]) appState.logsByDate[todayStr] = [];

        const nowTime = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
        combo.items.forEach(item => {
            const portion = item.portion || 1;
            appState.logsByDate[todayStr].push({
                id: 'meal_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                name: item.name,
                portion,
                baseCal: item.baseCal !== undefined ? item.baseCal : item.cal,
                baseP: item.baseP !== undefined ? item.baseP : item.p,
                baseC: item.baseC !== undefined ? item.baseC : item.c,
                baseF: item.baseF !== undefined ? item.baseF : item.f,
                cal: item.cal,
                p: item.p,
                c: item.c,
                f: item.f,
                meal: targetMeal,
                time: nowTime
            });
        });

        saveStateSafe();
        renderAllSafe();
        showToastSafe(`⚡ ใส่เซ็ต "${combo.name}" เข้า${mealConfig[targetMeal]?.name || 'มื้ออาหาร'} (${combo.items.length} รายการ) เรียบร้อย!`);
    }

    function deleteMealCombo(comboId, event) {
        if (event) {
            event.stopPropagation();
            event.preventDefault();
        }
        const appState = getAppStateSafe();
        if (!appState) return;
        const combo = (appState.mealCombos || []).find(c => c.id === comboId);
        if (!combo) return;

        showConfirmDialogSafe({
            icon: '🍱',
            iconBgClass: 'w-14 h-14 mx-auto rounded-2xl bg-rose-500/15 text-rose-500 flex items-center justify-center text-3xl shadow-xs',
            title: 'ลบเซ็ตอาหาร (Meal Combo)',
            message: `ต้องการลบเซ็ตอาหาร "${combo.name}" ใช่หรือไม่?`,
            confirmText: 'ลบเซ็ตอาหาร',
            confirmClass: 'flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition cursor-pointer',
            onConfirm: () => {
                appState.mealCombos = (appState.mealCombos || []).filter(c => c.id !== comboId);
                saveStateSafe();
                renderFoodDatabaseExplorerSafe();
                showToastSafe(`✓ ลบเซ็ต "${combo.name}" เรียบร้อยแล้ว`);
            }
        });
    }

    // ==========================================
    // MEAL COMBOS VISUAL EDITOR MODAL (v5.9.0)
    // ==========================================
    let _editingComboId = null;
    let _editingComboItems = [];

    function openMealComboEditor(comboId, event) {
        if (event) {
            event.stopPropagation();
            event.preventDefault();
        }
        _editingComboId = comboId;
        const modal = document.getElementById('mealComboEditModal');
        if (!modal) return;

        const appState = getAppStateSafe();
        const titleEl = document.getElementById('comboEditModalTitle');
        const nameInput = document.getElementById('comboEditName');
        const mealSelect = document.getElementById('comboEditMeal');

        if (comboId && appState) {
            const combo = (appState.mealCombos || []).find(c => c.id === comboId);
            if (!combo) return;
            _editingComboItems = JSON.parse(JSON.stringify(combo.items || []));
            if (titleEl) titleEl.textContent = `✏️ จัดการเซ็ต: ${combo.name}`;
            if (nameInput) nameInput.value = combo.name;
            if (mealSelect) mealSelect.value = combo.meal || 'breakfast';
        } else {
            _editingComboItems = [];
            if (titleEl) titleEl.textContent = '✨ สร้างเซ็ตอาหารประจำใหม่';
            if (nameInput) nameInput.value = 'เซ็ตอาหารประจำของฉัน';
            if (mealSelect) mealSelect.value = (appState && appState.activeMeal) || 'breakfast';
        }

        populateComboFoodSelectDropdown();
        clearComboFoodSearch();
        renderComboEditorItems();
        modal.classList.remove('hidden');
    }

    function closeMealComboEditor() {
        const modal = document.getElementById('mealComboEditModal');
        if (modal) modal.classList.add('hidden');
        _editingComboId = null;
        _editingComboItems = [];
    }

    function getAllAvailableFoodsList() {
        const appState = getAppStateSafe();
        const foodDb = getFoodDatabaseSafe();
        const allFoods = [];
        const seen = new Set();

        if (appState && Array.isArray(appState.customPresets)) {
            appState.customPresets.forEach(f => {
                if (f && f.name && !seen.has(f.name.toLowerCase())) {
                    seen.add(f.name.toLowerCase());
                    allFoods.push({ name: f.name, cal: f.calories, p: f.protein, c: f.carbs, f: f.fat, cat: 'เมนูส่วนตัว' });
                }
            });
        }

        (foodDb.categories || []).forEach(cat => {
            (cat.foods || []).forEach(f => {
                if (f && f.name && !seen.has(f.name.toLowerCase())) {
                    seen.add(f.name.toLowerCase());
                    allFoods.push({ name: f.name, cal: f.calories, p: f.protein, c: f.carbs, f: f.fat, cat: cat.name });
                }
            });
        });

        return allFoods;
    }

    function onComboFoodSearchInput(rawQuery) {
        const q = (rawQuery || '').trim().toLowerCase();
        const resultsContainer = document.getElementById('comboFoodSearchResults');
        const clearBtn = document.getElementById('comboFoodSearchClearBtn');
        if (clearBtn) clearBtn.classList.toggle('hidden', !q);
        if (!resultsContainer) return;

        if (!q) {
            resultsContainer.classList.add('hidden');
            resultsContainer.innerHTML = '';
            return;
        }

        const allFoods = getAllAvailableFoodsList();
        const qNorm = q.replace(/ราเมง/g, 'ราเมน');

        const matches = allFoods.filter(f => {
            const text = (f.name + ' ' + (f.cat || '')).toLowerCase();
            const textNorm = text.replace(/ราเมง/g, 'ราเมน');
            return text.includes(q) || textNorm.includes(qNorm);
        }).slice(0, 20);

        if (matches.length === 0) {
            resultsContainer.classList.remove('hidden');
            resultsContainer.innerHTML = `
                <div class="py-3 text-center text-xs text-slate-400">
                    ไม่พบเมนู "${rawQuery}" ในคลัง (สามารถพิมพ์กรอกด้านล่างเพื่อเพิ่มเองได้ครับ)
                </div>
            `;
            return;
        }

        resultsContainer.classList.remove('hidden');
        resultsContainer.innerHTML = matches.map(f => {
            const safeFoodStr = encodeURIComponent(JSON.stringify(f));
            return `
                <div onclick="addFoodObjectToComboEditor('${safeFoodStr}')"
                    class="p-2 rounded-xl hover:bg-purple-500/10 active:bg-purple-500/20 cursor-pointer flex items-center justify-between gap-2 border border-slate-100 dark:border-slate-700/60 transition group">
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-1.5 min-w-0">
                            <span class="font-bold text-xs text-slate-800 dark:text-slate-100 truncate group-hover:text-purple-600 dark:group-hover:text-purple-400">${f.name}</span>
                            <span class="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 shrink-0 whitespace-nowrap">${f.cat}</span>
                        </div>
                        <div class="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                            <span class="text-emerald-500 font-semibold">${f.cal} kcal</span>
                            <span>P:${f.p}g</span>
                            <span>C:${f.c}g</span>
                            <span>F:${f.f}g</span>
                        </div>
                    </div>
                    <button type="button" class="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-[10px] shrink-0 pointer-events-none shadow-2xs whitespace-nowrap">
                        + เพิ่ม
                    </button>
                </div>
            `;
        }).join('');
    }

    function clearComboFoodSearch() {
        const input = document.getElementById('comboFoodSearchInput');
        if (input) {
            input.value = '';
        }
        onComboFoodSearchInput('');
    }

    function addFoodObjectToComboEditor(encodedFood) {
        try {
            const food = JSON.parse(decodeURIComponent(encodedFood));
            _editingComboItems.push({
                name: food.name,
                portion: 1,
                baseCal: food.cal,
                baseP: food.p,
                baseC: food.c,
                baseF: food.f,
                cal: food.cal,
                p: food.p,
                c: food.c,
                f: food.f
            });
            renderComboEditorItems();
            clearComboFoodSearch();
            showToastSafe(`✓ เพิ่ม "${food.name}" เข้าเซ็ตแล้ว`);
        } catch (e) {
            console.error('Error adding food to combo:', e);
        }
    }

    function quickAddChipToCombo(foodName) {
        const allFoods = getAllAvailableFoodsList();
        const food = allFoods.find(f => f.name.toLowerCase() === foodName.toLowerCase()) || allFoods.find(f => f.name.includes(foodName));
        if (food) {
            addFoodObjectToComboEditor(encodeURIComponent(JSON.stringify(food)));
        } else {
            showToastSafe(`ไม่พบเมนู ${foodName}`);
        }
    }

    function populateComboFoodSelectDropdown() {
        const select = document.getElementById('comboAddFoodSelect');
        if (!select) return;

        const appState = getAppStateSafe();
        const foodDb = getFoodDatabaseSafe();
        const allFoods = [];
        const seen = new Set();

        if (appState && Array.isArray(appState.customPresets)) {
            appState.customPresets.forEach(f => {
                if (f && !seen.has(f.name)) {
                    seen.add(f.name);
                    allFoods.push({ name: f.name, cal: f.calories, p: f.protein, c: f.carbs, f: f.fat, cat: 'เมนูส่วนตัว' });
                }
            });
        }

        (foodDb.categories || []).forEach(cat => {
            (cat.foods || []).forEach(f => {
                if (f && !seen.has(f.name)) {
                    seen.add(f.name);
                    allFoods.push({ name: f.name, cal: f.calories, p: f.protein, c: f.carbs, f: f.fat, cat: cat.name });
                }
            });
        });

        select.innerHTML = '<option value="">-- เลือกเมนูจากคลังอาหาร --</option>' + allFoods.map(f => `
            <option value="${encodeURIComponent(JSON.stringify(f))}">${f.name} (${f.cal} kcal · P:${f.p}g) [${f.cat}]</option>
        `).join('');
    }

    function addSelectedFoodToComboEditor() {
        const select = document.getElementById('comboAddFoodSelect');
        if (!select || !select.value) return alert('กรุณาเลือกเมนูจากคลังอาหารครับ');
        try {
            const food = JSON.parse(decodeURIComponent(select.value));
            _editingComboItems.push({
                name: food.name,
                portion: 1,
                baseCal: food.cal,
                baseP: food.p,
                baseC: food.c,
                baseF: food.f,
                cal: food.cal,
                p: food.p,
                c: food.c,
                f: food.f
            });
            renderComboEditorItems();
            select.value = '';
        } catch (e) {
            console.error(e);
        }
    }

    function addManualFoodToComboEditor() {
        const inName = document.getElementById('comboManualFoodName');
        const inCal = document.getElementById('comboManualFoodCal');
        const inP = document.getElementById('comboManualFoodP');
        const inC = document.getElementById('comboManualFoodC');
        const inF = document.getElementById('comboManualFoodF');

        const name = (inName?.value || '').trim();
        if (!name) return alert('กรุณากรอกชื่อเมนูอาหารครับ');

        const p = parseFloat(inP?.value) || 0;
        const c = parseFloat(inC?.value) || 0;
        const f = parseFloat(inF?.value) || 0;
        const calInput = parseFloat(inCal?.value);
        const cal = (!isNaN(calInput) && calInput > 0) ? Math.round(calInput) : Math.round(p * 4 + c * 4 + f * 9);

        _editingComboItems.push({
            name,
            portion: 1,
            baseCal: cal,
            baseP: p,
            baseC: c,
            baseF: f,
            cal,
            p,
            c,
            f
        });

        if (inName) inName.value = '';
        if (inCal) inCal.value = '';
        if (inP) inP.value = '';
        if (inC) inC.value = '';
        if (inF) inF.value = '';

        renderComboEditorItems();
    }

    function removeComboEditorItem(idx) {
        _editingComboItems.splice(idx, 1);
        renderComboEditorItems();
    }

    function adjustComboEditorItemPortion(idx, delta) {
        if (!_editingComboItems[idx]) return;
        const it = _editingComboItems[idx];
        let current = it.portion || 1;
        let next = Math.max(0.5, Math.round((current + delta) * 10) / 10);
        it.portion = next;
        it.cal = Math.round(it.baseCal * next);
        it.p = Math.round(it.baseP * next * 10) / 10;
        it.c = Math.round(it.baseC * next * 10) / 10;
        it.f = Math.round(it.baseF * next * 10) / 10;
        renderComboEditorItems();
    }

    function renderComboEditorItems() {
        const container = document.getElementById('comboEditItemsContainer');
        const summaryEl = document.getElementById('comboEditSummaryStrip');
        const countBadge = document.getElementById('comboEditCountBadge');
        if (!container) return;

        if (countBadge) countBadge.textContent = `${_editingComboItems.length} รายการ`;

        let totalCal = 0, totalP = 0, totalC = 0, totalF = 0;
        _editingComboItems.forEach(it => {
            totalCal += (it.cal || 0);
            totalP += (it.p || 0);
            totalC += (it.c || 0);
            totalF += (it.f || 0);
        });
        totalP = Math.round(totalP * 10) / 10;
        totalC = Math.round(totalC * 10) / 10;
        totalF = Math.round(totalF * 10) / 10;

        if (summaryEl) {
            summaryEl.innerHTML = `
                <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs font-bold gap-1 px-1">
                    <span class="text-slate-600 dark:text-slate-300 whitespace-nowrap">สารอาหารรวมในเซ็ต:</span>
                    <div class="flex items-center flex-wrap gap-2 text-xs">
                        <span class="text-emerald-500 font-bold whitespace-nowrap">${totalCal} kcal</span>
                        <span class="text-blue-500 whitespace-nowrap">P:${totalP}g</span>
                        <span class="text-amber-500 whitespace-nowrap">C:${totalC}g</span>
                        <span class="text-rose-500 whitespace-nowrap">F:${totalF}g</span>
                    </div>
                </div>
            `;
        }

        if (_editingComboItems.length === 0) {
            container.innerHTML = `
                <div class="py-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                    ยังไม่มีเมนูในเซ็ตนี้ เลือกเมนูด้านล่างเพื่อเพิ่มเข้าเซ็ตได้เลยครับ
                </div>
            `;
            return;
        }

        container.innerHTML = _editingComboItems.map((it, idx) => `
            <div class="p-2 sm:p-2.5 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-200/70 dark:border-slate-600/70 flex items-center justify-between gap-2 min-w-0">
                <div class="min-w-0 flex-1">
                    <div class="font-bold text-xs text-slate-800 dark:text-slate-100 truncate">${it.name}</div>
                    <div class="flex items-center flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                        <span class="text-emerald-600 dark:text-emerald-400 font-semibold whitespace-nowrap">${it.cal} kcal</span>
                        <span class="whitespace-nowrap">P:${it.p}g</span>
                        <span class="whitespace-nowrap">C:${it.c}g</span>
                        <span class="whitespace-nowrap">F:${it.f}g</span>
                    </div>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                    <div class="flex items-center border border-slate-200 dark:border-slate-600 rounded-lg overflow-hidden bg-white dark:bg-slate-800 text-xs">
                        <button type="button" onclick="adjustComboEditorItemPortion(${idx}, -0.5)" class="w-6 h-6 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold cursor-pointer">-</button>
                        <span class="px-1.5 font-bold text-slate-700 dark:text-slate-200 text-[10px] sm:text-[11px] whitespace-nowrap">x${it.portion || 1}</span>
                        <button type="button" onclick="adjustComboEditorItemPortion(${idx}, 0.5)" class="w-6 h-6 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold cursor-pointer">+</button>
                    </div>
                    <button type="button" onclick="removeComboEditorItem(${idx})" class="w-6 h-6 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 flex items-center justify-center text-xs transition cursor-pointer" title="ลบออกจากเซ็ต">
                        🗑️
                    </button>
                </div>
            </div>
        `).join('');
    }

    function saveMealComboEditor() {
        const nameInput = document.getElementById('comboEditName');
        const mealSelect = document.getElementById('comboEditMeal');
        const name = (nameInput?.value || '').trim();
        const meal = mealSelect?.value || 'breakfast';

        if (!name) return alert('กรุณาตั้งชื่อเซ็ตอาหารครับ');
        if (_editingComboItems.length === 0) return alert('กรุณาเพิ่มรายการอาหารอย่างน้อย 1 รายการในเซ็ตครับ');

        const appState = getAppStateSafe();
        if (!appState) return;
        if (!Array.isArray(appState.mealCombos)) appState.mealCombos = [];

        if (_editingComboId) {
            const idx = appState.mealCombos.findIndex(c => c.id === _editingComboId);
            if (idx >= 0) {
                appState.mealCombos[idx] = {
                    ...appState.mealCombos[idx],
                    name,
                    meal,
                    items: _editingComboItems
                };
                showToastSafe(`✓ อัปเดตเซ็ต "${name}" เรียบร้อยแล้ว`);
            }
        } else {
            const newCombo = {
                id: 'combo_' + Date.now(),
                name,
                meal,
                items: _editingComboItems
            };
            appState.mealCombos.push(newCombo);
            showToastSafe(`📦 สร้างเซ็ต "${name}" เรียบร้อยแล้ว!`);
        }

        saveStateSafe();
        closeMealComboEditor();
        renderFoodDatabaseExplorerSafe();
    }

    // Window Global Exports
    window.copyMealFromYesterday = copyMealFromYesterday;
    window.saveMealAsCombo = saveMealAsCombo;
    window.applyMealCombo = applyMealCombo;
    window.deleteMealCombo = deleteMealCombo;
    window.openMealComboEditor = openMealComboEditor;
    window.closeMealComboEditor = closeMealComboEditor;
    window.getAllAvailableFoodsList = getAllAvailableFoodsList;
    window.onComboFoodSearchInput = onComboFoodSearchInput;
    window.clearComboFoodSearch = clearComboFoodSearch;
    window.addFoodObjectToComboEditor = addFoodObjectToComboEditor;
    window.quickAddChipToCombo = quickAddChipToCombo;
    window.populateComboFoodSelectDropdown = populateComboFoodSelectDropdown;
    window.addSelectedFoodToComboEditor = addSelectedFoodToComboEditor;
    window.addManualFoodToComboEditor = addManualFoodToComboEditor;
    window.removeComboEditorItem = removeComboEditorItem;
    window.adjustComboEditorItemPortion = adjustComboEditorItemPortion;
    window.renderComboEditorItems = renderComboEditorItems;
    window.saveMealComboEditor = saveMealComboEditor;
})();
