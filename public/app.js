const APP_VERSION = '5.7.3';
        const STORAGE_KEY = 'fitmacro_pro_v4_state';
        // Note: MEAL_CONFIG, WORKOUT_PRESETS, DEFAULT_MEAL_COMBOS, DEFAULT_SUPPLEMENTS, FOOD_DATABASE are loaded from food-db.js

        function getTodayStr() {
            const now = new Date();
            const offset = now.getTimezoneOffset() * 60000;
            return new Date(now.getTime() - offset).toISOString().split('T')[0];
        }

        function getDefaultMealByTime() {
            const h = new Date().getHours();
            if (h >= 4 && h < 11) return 'breakfast';
            if (h >= 11 && h < 16) return 'lunch';
            if (h >= 16 && h < 21) return 'dinner';
            return 'snack';
        }

        function inferMealFromTime(timeStr) {
            if (!timeStr) return 'breakfast';
            const parts = timeStr.split(':');
            if (parts.length < 2) return 'breakfast';
            const h = parseInt(parts[0], 10);
            if (h >= 4 && h < 11) return 'breakfast';
            if (h >= 11 && h < 16) return 'lunch';
            if (h >= 16 && h < 21) return 'dinner';
            return 'snack';
        }

        let state = {
            version: APP_VERSION,
            theme: 'dark',
            settingsCollapsed: true,
            collapsedSections: {},
            customFormOpen: false,
            selectedDate: getTodayStr(),
            lastActiveDate: getTodayStr(),
            selectedCategory: 'all',
            searchQuery: '',
            lastAddedFoodName: '',
            activeMeal: 'breakfast',
            profileConfigured: false,
            selectedPortion: 1,
            favorites: [],
            bodyTab: 'weight',
            weightsByDate: {},
            workoutsByDate: {},
            dayTypeByDate: {},
            mealCombos: DEFAULT_MEAL_COMBOS,
            supplementList: JSON.parse(JSON.stringify(DEFAULT_SUPPLEMENTS)),
            supplementsByDate: {},
            fasting: {
                isFasting: false,
                plan: '16:8',
                targetHours: 16,
                startTime: null,
                endTime: null,
                history: []
            },
            profile: {
                gender: 'male',
                age: 33,
                weight: 70,
                height: 173,
                activity: 1.55,
                goalDiff: 0,
                macros: { p: 30, c: 40, f: 30 }
            },
            customPresets: [],
            logsByDate: {},
            waterByDate: {}
        };

        // Cache for recommendations so clicking water or theme doesn't reshuffle
        let cachedRecommendations = [];
        let lastRecCacheKey = '';

        function loadState() {
            const todayStr = getTodayStr();
            try {
                const raw = localStorage.getItem(STORAGE_KEY)
                    || localStorage.getItem('fitmacro_pro_v3_state')
                    || localStorage.getItem('fitmacro_pro_v2_state');
                if (raw) {
                    const parsed = JSON.parse(raw);
                    const lastDate = parsed.lastActiveDate || parsed.selectedDate;
                    const isNewDay = lastDate && lastDate !== todayStr;

                    state = {
                        ...state,
                        ...parsed,
                        version: APP_VERSION,
                        collapsedSections: (parsed.collapsedSections && typeof parsed.collapsedSections === 'object') ? parsed.collapsedSections : {},
                        activeMeal: isNewDay ? 'breakfast' : (parsed.activeMeal || 'breakfast'),
                        selectedPortion: Number(parsed.selectedPortion) || 1,
                        favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
                        bodyTab: parsed.bodyTab || 'weight',
                        weightsByDate: (parsed.weightsByDate && typeof parsed.weightsByDate === 'object') ? parsed.weightsByDate : {},
                        workoutsByDate: (parsed.workoutsByDate && typeof parsed.workoutsByDate === 'object') ? parsed.workoutsByDate : {},
                        dayTypeByDate: (parsed.dayTypeByDate && typeof parsed.dayTypeByDate === 'object') ? parsed.dayTypeByDate : {},
                        mealCombos: (Array.isArray(parsed.mealCombos) && parsed.mealCombos.length > 0) ? parsed.mealCombos : DEFAULT_MEAL_COMBOS,
                        supplementList: Array.isArray(parsed.supplementList) ? parsed.supplementList : JSON.parse(JSON.stringify(DEFAULT_SUPPLEMENTS)),
                        supplementsByDate: (parsed.supplementsByDate && typeof parsed.supplementsByDate === 'object') ? parsed.supplementsByDate : {},
                        fasting: (parsed.fasting && typeof parsed.fasting === 'object') ? {
                            isFasting: !!parsed.fasting.isFasting,
                            plan: parsed.fasting.plan || '16:8',
                            targetHours: parsed.fasting.targetHours || 16,
                            startTime: parsed.fasting.startTime || null,
                            endTime: parsed.fasting.endTime || null,
                            history: Array.isArray(parsed.fasting.history) ? parsed.fasting.history : []
                        } : {
                            isFasting: false,
                            plan: '16:8',
                            targetHours: 16,
                            startTime: null,
                            endTime: null,
                            history: []
                        },
                        profile: { ...state.profile, ...(parsed.profile || {}) },
                        profileConfigured: parsed.profileConfigured === true,
                        logsByDate: parsed.logsByDate || {},
                        waterByDate: parsed.waterByDate || {},
                        customPresets: parsed.customPresets || [],
                        lastActiveDate: todayStr,
                        selectedDate: todayStr
                    };

                    // For existing users who already configured their profile, avoid re-prompting
                    if (parsed.profileConfigured === true) {
                        localStorage.setItem('novafit_profile_prompted', 'true');
                    }

                    // Data migration: ensure all logs have meal and base macros
                    if (state.logsByDate) {
                        Object.keys(state.logsByDate).forEach(date => {
                            state.logsByDate[date] = (state.logsByDate[date] || []).map(m => {
                                const id = m.id || ('log_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7));
                                const portion = m.portion || 1;
                                const baseCal = m.baseCal !== undefined ? m.baseCal : Math.round(m.cal / portion);
                                const baseP = m.baseP !== undefined ? m.baseP : Math.round((m.p / portion) * 10) / 10;
                                const baseC = m.baseC !== undefined ? m.baseC : Math.round((m.c / portion) * 10) / 10;
                                const baseF = m.baseF !== undefined ? m.baseF : Math.round((m.f / portion) * 10) / 10;
                                const meal = m.meal || inferMealFromTime(m.time);
                                return {
                                    ...m,
                                    id,
                                    meal,
                                    portion,
                                    baseCal,
                                    baseP,
                                    baseC,
                                    baseF,
                                    cal: Math.round(baseCal * portion),
                                    p: Math.round(baseP * portion * 10) / 10,
                                    c: Math.round(baseC * portion * 10) / 10,
                                    f: Math.round(baseF * portion * 10) / 10
                                };
                            });
                        });
                    }
                } else {
                    // Brand new visitor!
                    window._isFirstTimeVisitor = true;
                    state.settingsCollapsed = false;
                    state.lastActiveDate = todayStr;
                    state.selectedDate = todayStr;
                    state.activeMeal = 'breakfast';
                }
            } catch (e) {
                console.error('Failed to load state:', e);
            }
            // Always set selectedDate and lastActiveDate to TODAY when launching/reloading the app
            state.selectedDate = todayStr;
            state.lastActiveDate = todayStr;
            state.searchQuery = ''; // Always clean search on load to prevent phantom query bugs
            const validCatIds = new Set(['all', 'favorites', 'custom', 'combos', ...(FOOD_DATABASE.categories ? FOOD_DATABASE.categories.map(c => c.id) : [])]);
            if (!validCatIds.has(state.selectedCategory)) state.selectedCategory = 'all';
            if (!state.activeMeal) state.activeMeal = 'breakfast';
            if (!state.selectedPortion) state.selectedPortion = 1;
            if (!Array.isArray(state.favorites)) state.favorites = [];
            if (!Array.isArray(state.mealCombos) || state.mealCombos.length === 0) state.mealCombos = DEFAULT_MEAL_COMBOS;
            if (!Array.isArray(state.supplementList)) state.supplementList = JSON.parse(JSON.stringify(DEFAULT_SUPPLEMENTS));
            if (!state.dayTypeByDate || typeof state.dayTypeByDate !== 'object') state.dayTypeByDate = {};
            if (!state.supplementsByDate || typeof state.supplementsByDate !== 'object') state.supplementsByDate = {};
            if (!state.bodyTab) state.bodyTab = 'weight';
            if (!state.weightsByDate || typeof state.weightsByDate !== 'object') state.weightsByDate = {};
            if (!state.workoutsByDate || typeof state.workoutsByDate !== 'object') state.workoutsByDate = {};
        }

        function saveState() {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
                const badge = document.getElementById('saveBadge');
                if (badge) badge.textContent = '✓ บันทึกแล้ว (' + new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ')';
                window.state = state;
                if (window.triggerCloudSync) {
                    window.triggerCloudSync();
                }
            } catch (e) {
                console.error('Failed to save state:', e);
            }
        }

        function showToast(msg) {
            const container = document.getElementById('toastContainer');
            const el = document.createElement('div');
            el.className = 'bg-slate-900 dark:bg-emerald-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg border border-emerald-400/30 animate-pop';
            el.textContent = msg;
            container.appendChild(el);
            setTimeout(() => { el.remove(); }, 2200);
        }

        function applyTheme() {
            const html = document.documentElement;
            if (state.theme === 'dark') {
                html.classList.add('dark');
                document.getElementById('themeIcon').textContent = '☀️';
            } else {
                html.classList.remove('dark');
                document.getElementById('themeIcon').textContent = '🌙';
            }
        }

        function toggleTheme() {
            state.theme = state.theme === 'dark' ? 'light' : 'dark';
            applyTheme();
            saveState();
        }

        function toggleAllSettings() {
            state.settingsCollapsed = !state.settingsCollapsed;
            renderSettingsCollapseState();
            clearTimeout(window._settingsSaveTimer);
            window._settingsSaveTimer = setTimeout(() => {
                try {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
                } catch (e) {}
            }, 100);
        }

        function renderSettingsCollapseState() {
            const body = document.getElementById('settingsCollapseBody');
            const icon = document.getElementById('toggleSettingsIcon');
            const text = document.getElementById('toggleSettingsText');
            const p = state.profile;
            const bmi = (p.weight / Math.pow(p.height / 100, 2)).toFixed(1);
            const goalLabel = p.goalDiff < 0 ? `ลดไขมัน (${p.goalDiff}%)` : p.goalDiff > 0 ? `เพิ่มกล้าม (+${p.goalDiff}%)` : 'รักษาน้ำหนัก (0%)';

            const compactPills = document.getElementById('compactProfilePills');
            if (compactPills) {
                compactPills.innerHTML = `
                    <span class="px-2.5 py-1 rounded-lg bg-slate-200/70 dark:bg-slate-700 font-medium">${p.gender === 'male' ? '♂ ชาย' : '♀ หญิง'} ${p.age} ปี</span>
                    <span class="px-2.5 py-1 rounded-lg bg-slate-200/70 dark:bg-slate-700 font-medium">นน. ${p.weight} กก. / สูง ${p.height} ซม. (BMI ${bmi})</span>
                    <span class="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold">${goalLabel}</span>
                    <span class="px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 font-semibold">Macro ${p.macros.p}/${p.macros.c}/${p.macros.f}%</span>
                `;
            }

            if (body) {
                body.classList.remove('hidden');
            }
            if (icon) icon.textContent = '⚙️';
            if (text) text.textContent = 'ตั้งค่าข้อมูลร่างกาย & สัดส่วน Macro';
        }

        function toggleToolsMenu() {
            const menu = document.getElementById('toolsDropdownMenu');
            const userMenu = document.getElementById('userDropdown');
            if (userMenu) userMenu.classList.add('hidden');
            if (menu) menu.classList.toggle('hidden');
        }

        let _lastCardToggleTimes = {};
        function toggleCardSection(sectionId) {
            // Food search is permanently open for instant access & zero-freeze on mobile
            if (sectionId === 'section_food_search') return;

            const now = Date.now();
            if (_lastCardToggleTimes[sectionId] && now - _lastCardToggleTimes[sectionId] < 150) return;
            _lastCardToggleTimes[sectionId] = now;

            const body = document.getElementById('body_' + sectionId);
            const icon = document.getElementById('icon_' + sectionId);
            if (!body) return;

            // Determine visibility directly from DOM to prevent state/DOM desync
            const isCurrentlyHidden = body.classList.contains('hidden') || body.classList.contains('is-collapsed');
            const willBeCollapsed = !isCurrentlyHidden;

            if (!state.collapsedSections) state.collapsedSections = {};
            state.collapsedSections[sectionId] = willBeCollapsed;

            // Target card container for viewport position preservation
            const cardId = sectionId.startsWith('section_') ? 'card_' + sectionId.replace('section_', '') : sectionId;
            const card = document.getElementById(cardId) || body.parentElement;

            let cardRectBefore = null;
            if (card) {
                cardRectBefore = card.getBoundingClientRect();
            }

            body.classList.add('accordion-section');
            body.classList.toggle('hidden', willBeCollapsed);
            body.classList.toggle('is-collapsed', willBeCollapsed);

            if (icon) {
                icon.classList.add('accordion-chevron');
                icon.classList.toggle('icon-collapsed', willBeCollapsed);
            }

            // Mobile iOS Safari Viewport & Overscroll Clamping Protection
            // When collapsing large sections, document height shrinks rapidly.
            // Clamping scroll prevents WebKit touch deadlock & overscroll bounce freeze.
            if (willBeCollapsed && card) {
                const maxScrollY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
                if (cardRectBefore && cardRectBefore.top < 0) {
                    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                } else if (window.scrollY > maxScrollY) {
                    window.scrollTo({ top: maxScrollY, behavior: 'instant' });
                }
            }

            // Debounced non-blocking localStorage save
            clearTimeout(window._collapseSaveTimer);
            window._collapseSaveTimer = setTimeout(() => {
                try {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
                } catch (e) {}
            }, 100);
        }

        function renderAllSectionCollapses() {
            if (!state.collapsedSections) state.collapsedSections = {};
            // Food search is permanently open and non-collapsible for maximum stability & zero-freeze on mobile
            if (state.collapsedSections['section_food_search']) {
                delete state.collapsedSections['section_food_search'];
            }
            const foodBody = document.getElementById('body_section_food_search');
            if (foodBody) {
                foodBody.classList.remove('hidden', 'is-collapsed');
            }

            const sections = [
                'section_water',
                'section_meals',
                'section_supplements',
                'section_workout',
                'section_analytics',
                'section_recommendations'
            ];
            sections.forEach(id => {
                const body = document.getElementById('body_' + id);
                const icon = document.getElementById('icon_' + id);
                const isCollapsed = !!state.collapsedSections[id];
                if (body) {
                    body.classList.add('accordion-section');
                    body.classList.toggle('hidden', isCollapsed);
                    body.classList.toggle('is-collapsed', isCollapsed);
                }
                if (icon) {
                    icon.classList.add('accordion-chevron');
                    icon.classList.toggle('icon-collapsed', isCollapsed);
                }
            });
        }

        function toggleCustomForm() {
            state.customFormOpen = !state.customFormOpen;
            const body = document.getElementById('customFoodFormBody');
            const icon = document.getElementById('customFormToggleIcon');
            if (state.customFormOpen) {
                body.classList.remove('hidden');
                icon.textContent = '▲ ซ่อนฟอร์ม';
            } else {
                body.classList.add('hidden');
                icon.textContent = '▼ เปิดฟอร์ม';
            }
        }

        function getEffectiveWeight(dateStr) {
            const d = dateStr || state.selectedDate || getTodayStr();
            if (state.weightsByDate && state.weightsByDate[d] !== undefined && state.weightsByDate[d] !== null && Number(state.weightsByDate[d]) > 0) {
                return { weight: Number(state.weightsByDate[d]), isExact: true, sourceDate: d };
            }
            if (state.weightsByDate) {
                const pastDates = Object.keys(state.weightsByDate)
                    .filter(x => x <= d && Number(state.weightsByDate[x]) > 0)
                    .sort();
                if (pastDates.length > 0) {
                    const lastDate = pastDates[pastDates.length - 1];
                    return { weight: Number(state.weightsByDate[lastDate]), isExact: false, sourceDate: lastDate };
                }
                const allDates = Object.keys(state.weightsByDate)
                    .filter(x => Number(state.weightsByDate[x]) > 0)
                    .sort();
                if (allDates.length > 0) {
                    return { weight: Number(state.weightsByDate[allDates[0]]), isExact: false, sourceDate: allDates[0] };
                }
            }
            return { weight: Number(state.profile.weight) || 70, isExact: false, sourceDate: 'profile' };
        }

        // Calculate BMR, TDEE, Macros & Daily Water Target (with Carb Cycling)
        function getCalculatedTargets(dateStr) {
            const effectiveDate = dateStr || state.selectedDate || getTodayStr();
            const { gender, age, height, activity, goalDiff, macros } = state.profile;
            const weightInfo = getEffectiveWeight(effectiveDate);
            const weight = weightInfo.weight;

            const s = gender === 'male' ? 5 : -161;
            const bmr = Math.round((10 * weight) + (6.25 * height) - (5 * age) + s);
            const tdee = Math.round(bmr * activity);
            let targetCal = Math.round(tdee * (1 + goalDiff / 100));

            // Training Day vs Rest Day (Carb Cycling)
            const dayType = (state.dayTypeByDate && state.dayTypeByDate[effectiveDate]) || 'training';
            let pCal = Math.round(targetCal * (macros.p / 100));
            let cCal = Math.round(targetCal * (macros.c / 100));
            let fCal = Math.round(targetCal * (macros.f / 100));

            if (dayType === 'rest') {
                // Rest Day: preserve 100% protein for muscle recovery, reduce carbs by 15%, calories drop accordingly
                const oldCCal = cCal;
                cCal = Math.round(cCal * 0.85);
                const calDiff = oldCCal - cCal;
                targetCal = targetCal - calDiff;
            }

            // Water calculation: 35ml per kg of body weight + bonus for workout activity
            const activityBonusMl = activity >= 1.725 ? 500 : activity >= 1.55 ? 300 : 0;
            const rawWaterMl = Math.round(weight * 35) + activityBonusMl;
            const waterTargetGlasses = Math.max(6, Math.round(rawWaterMl / 250));
            const waterTargetMl = waterTargetGlasses * 250;

            return {
                weight,
                weightInfo,
                bmr,
                tdee,
                targetCal,
                dayType,
                isRestDay: dayType === 'rest',
                pGram: Math.round(pCal / 4),
                cGram: Math.round(cCal / 4),
                fGram: Math.round(fCal / 9),
                pCal, cCal, fCal,
                waterTargetGlasses,
                waterTargetMl,
                activityBonusMl
            };
        }

        function setDayType(type) {
            const dStr = state.selectedDate;
            if (!state.dayTypeByDate) state.dayTypeByDate = {};
            state.dayTypeByDate[dStr] = type;
            saveState();
            renderAll();
            if (type === 'rest') {
                showToast('🛋️ สลับเป็นวันพัก (ลดคาร์บ 15% • คงโปรตีนซ่อมแซมกล้ามเนื้อ)');
            } else {
                showToast('🏋️ สลับเป็นวันซ้อม (เป้าแคลอรีและคาร์โบไฮเดรตมาตรฐาน)');
            }
        }

        function renderAll() {
            applyTheme();
            renderSettingsCollapseState();
            const p = state.profile;

            const activeBtn = 'bg-emerald-500 text-white border-emerald-500 shadow-sm font-bold';
            const inactiveBtn = 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-emerald-500/50';

            document.getElementById('btnMale').className = `py-1.5 rounded-xl text-xs border transition ${p.gender === 'male' ? activeBtn : inactiveBtn}`;
            document.getElementById('btnFemale').className = `py-1.5 rounded-xl text-xs border transition ${p.gender === 'female' ? activeBtn : inactiveBtn}`;

            document.getElementById('goalCut').className = `py-2 px-2 rounded-xl text-xs border transition ${p.goalDiff === -20 ? activeBtn : inactiveBtn}`;
            document.getElementById('goalMaintain').className = `py-2 px-2 rounded-xl text-xs border transition ${p.goalDiff === 0 ? activeBtn : inactiveBtn}`;
            document.getElementById('goalBulk').className = `py-2 px-2 rounded-xl text-xs border transition ${p.goalDiff === 15 ? activeBtn : inactiveBtn}`;

            const isBal = p.macros.p === 30 && p.macros.c === 40 && p.macros.f === 30;
            const isMus = p.macros.p === 35 && p.macros.c === 40 && p.macros.f === 25;
            const isLow = p.macros.p === 40 && p.macros.c === 20 && p.macros.f === 40;
            document.getElementById('macroPresetBalanced').className = `text-xs py-1.5 px-2 rounded-lg border transition ${isBal ? activeBtn : inactiveBtn}`;
            document.getElementById('macroPresetMuscle').className = `text-xs py-1.5 px-2 rounded-lg border transition ${isMus ? activeBtn : inactiveBtn}`;
            document.getElementById('macroPresetLowCarb').className = `text-xs py-1.5 px-2 rounded-lg border transition ${isLow ? activeBtn : inactiveBtn}`;
            document.getElementById('macroPreset2g').className = `text-xs py-1.5 px-2 rounded-lg border transition ${(!isBal && !isMus && !isLow) ? activeBtn : inactiveBtn}`;

            if (document.activeElement !== document.getElementById('numAge')) document.getElementById('numAge').value = p.age;
            document.getElementById('rangeAge').value = p.age;
            if (document.activeElement !== document.getElementById('numWeight')) document.getElementById('numWeight').value = p.weight;
            document.getElementById('rangeWeight').value = p.weight;
            if (document.activeElement !== document.getElementById('numHeight')) document.getElementById('numHeight').value = p.height;
            document.getElementById('rangeHeight').value = p.height;
            document.getElementById('selActivity').value = p.activity;

            const t = getCalculatedTargets();
            const curWeight = t.weight;
            const bmi = (curWeight / Math.pow(p.height / 100, 2)).toFixed(1);
            document.getElementById('bmiBadge').textContent = `BMI: ${bmi}`;

            document.getElementById('rangeGoalDiff').value = p.goalDiff;
            const sign = p.goalDiff > 0 ? `+${p.goalDiff}%` : `${p.goalDiff}%`;
            document.getElementById('lblCalDiff').textContent = `${sign}`;

            document.getElementById('rangeP').value = p.macros.p;
            document.getElementById('rangeC').value = p.macros.c;
            document.getElementById('rangeF').value = p.macros.f;
            document.getElementById('lblPctP').textContent = `${p.macros.p}%`;
            document.getElementById('lblPctC').textContent = `${p.macros.c}%`;
            document.getElementById('lblPctF').textContent = `${p.macros.f}%`;

            document.getElementById('resBMR').textContent = `${t.bmr.toLocaleString()} kcal`;
            document.getElementById('resTDEE').textContent = `${t.tdee.toLocaleString()} kcal`;
            document.getElementById('resTargetCal').textContent = `${t.targetCal.toLocaleString()} kcal`;

            const dailyDiffKcal = t.targetCal - t.tdee;
            const kgPerWeek = ((dailyDiffKcal * 7) / 7700).toFixed(2);
            document.getElementById('lblWeightTrend').textContent = dailyDiffKcal === 0
                ? 'แนวโน้มน้ำหนัก: คงที่'
                : `แนวโน้มน้ำหนัก: ${dailyDiffKcal > 0 ? '+' : ''}${kgPerWeek} กก./สัปดาห์ (${dailyDiffKcal > 0 ? '+' : ''}${dailyDiffKcal} kcal/วัน)`;

            document.getElementById('donutP').setAttribute('stroke-dasharray', `${p.macros.p} ${100 - p.macros.p}`);
            document.getElementById('donutP').setAttribute('stroke-dashoffset', '0');
            document.getElementById('donutC').setAttribute('stroke-dasharray', `${p.macros.c} ${100 - p.macros.c}`);
            document.getElementById('donutC').setAttribute('stroke-dashoffset', `-${p.macros.p}`);
            document.getElementById('donutF').setAttribute('stroke-dasharray', `${p.macros.f} ${100 - p.macros.f}`);
            document.getElementById('donutF').setAttribute('stroke-dashoffset', `-${p.macros.p + p.macros.c}`);

            document.getElementById('targetPGram').textContent = `${t.pGram}g`;
            document.getElementById('targetPMeta').textContent = `${t.pCal} kcal (${(t.pGram / curWeight).toFixed(1)} g/kg)`;
            document.getElementById('targetCGram').textContent = `${t.cGram}g`;
            document.getElementById('targetCMeta').textContent = `${t.cCal} kcal (${(t.cGram / curWeight).toFixed(1)} g/kg)`;
            document.getElementById('targetFGram').textContent = `${t.fGram}g`;
            document.getElementById('targetFMeta').textContent = `${t.fCal} kcal (${(t.fGram / curWeight).toFixed(1)} g/kg)`;

            // Update Day Type (Training vs Rest) buttons and badge
            const dayType = t.dayType || 'training';
            const btnTraining = document.getElementById('btnDayTraining');
            const btnRest = document.getElementById('btnDayRest');
            const heroBadge = document.getElementById('heroDayTypeBadge');

            if (btnTraining && btnRest) {
                if (dayType === 'rest') {
                    btnTraining.className = 'px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200';
                    btnRest.className = 'px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 shadow-xs bg-indigo-500 text-white';
                } else {
                    btnTraining.className = 'px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 shadow-xs bg-emerald-500 text-white';
                    btnRest.className = 'px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200';
                }
            }

            if (heroBadge) {
                if (dayType === 'rest') {
                    heroBadge.className = 'text-xs px-2.5 py-0.5 rounded-full font-bold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30';
                    heroBadge.innerHTML = '🛋️ วันพัก (Rest Day • คาร์บ -15%)';
                } else {
                    heroBadge.className = 'text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30';
                    heroBadge.innerHTML = '🏋️ วันซ้อม (Training Day • คาร์บปกติ)';
                }
            }

            renderMealSelector();
            renderDateTrackerAndRecommendations(t, false);
            renderFoodDatabaseExplorer();
            renderSupplements();
            renderFastingSection();
            if (window.renderDailyHealthTip) window.renderDailyHealthTip();
            if (window.checkDailyTipNotification) window.checkDailyTipNotification();
            updateVersionBadges();
            renderAllSectionCollapses();
            syncResponsiveLayout();
        }

        function syncResponsiveLayout() {
            const isDesktop = window.innerWidth >= 1024;
            const colLeft = document.getElementById('colDesktopLeft');
            const colRight = document.getElementById('colDesktopRight');
            if (!colLeft || !colRight) return;

            const cardFood = document.getElementById('card_food_search');
            const cardMeals = document.getElementById('card_meals');
            const cardAnalytics = document.getElementById('card_analytics');
            const cardRec = document.getElementById('card_recommendations');
            const cardWater = document.getElementById('card_water');

            if (!cardFood || !cardMeals || !cardAnalytics || !cardRec) return;

            if (isDesktop) {
                if (cardFood.parentElement !== colRight) {
                    colRight.appendChild(cardFood);
                    colRight.appendChild(cardMeals);
                    colRight.appendChild(cardAnalytics);
                    colRight.appendChild(cardRec);
                }
            } else {
                if (cardFood.parentElement !== colLeft) {
                    if (cardWater) {
                        colLeft.insertBefore(cardFood, cardWater);
                        colLeft.insertBefore(cardMeals, cardWater);
                    } else {
                        colLeft.appendChild(cardFood);
                        colLeft.appendChild(cardMeals);
                    }
                    colLeft.appendChild(cardAnalytics);
                    colLeft.appendChild(cardRec);
                }
            }
        }

        function setActiveMeal(mealId) {
            if (MEAL_CONFIG[mealId]) {
                state.activeMeal = mealId;
                saveState();
                renderMealSelector();
                renderFoodDatabaseExplorer();
                const dStr = state.selectedDate;
                const targets = getCalculatedTargets();
                renderDateTrackerAndRecommendations(targets, false);
            }
        }

        function setSelectedPortion(portion) {
            state.selectedPortion = Number(portion) || 1;
            saveState();
            renderMealSelector();
        }

        function toggleFavorite(foodName, event) {
            if (event) {
                event.stopPropagation();
                event.preventDefault();
            }
            if (!Array.isArray(state.favorites)) state.favorites = [];
            const idx = state.favorites.indexOf(foodName);
            if (idx >= 0) {
                state.favorites.splice(idx, 1);
                showToast(`นำ "${foodName}" ออกจากเมนูโปรดแล้ว`);
            } else {
                state.favorites.push(foodName);
                showToast(`⭐ บันทึก "${foodName}" เข้าเมนูโปรดแล้ว`);
            }
            saveState();
            renderFoodDatabaseExplorer();
        }

        function renderMealSelector() {
            const mealBar = document.getElementById('activeMealSelectorBar');
            const portionBar = document.getElementById('portionSelectorBar');
            if (!mealBar || !portionBar) return;

            const meals = [
                { id: 'breakfast', name: 'เช้า', fullName: 'มื้อเช้า', icon: '🌅' },
                { id: 'lunch', name: 'เที่ยง', fullName: 'มื้อเที่ยง', icon: '☀️' },
                { id: 'dinner', name: 'เย็น', fullName: 'มื้อเย็น', icon: '🌙' },
                { id: 'snack', name: 'ของว่าง', fullName: 'ของว่าง', icon: '🍎' }
            ];

            mealBar.innerHTML = meals.map(m => {
                const isActive = state.activeMeal === m.id;
                return `
                    <button type="button" onclick="setActiveMeal('${m.id}')"
                        class="w-full justify-center px-1 sm:px-2.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1 truncate ${isActive
                        ? 'bg-emerald-500 text-white shadow-sm ring-2 ring-emerald-400/50 font-bold'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-emerald-500/40'
                    }">
                        <span class="text-xs shrink-0">${m.icon}</span>
                        <span class="sm:hidden truncate">${m.name}</span>
                        <span class="hidden sm:inline truncate">${m.fullName}</span>
                    </button>
                `;
            }).join('');

            const portions = [
                { val: 0.5, label: '0.5x' },
                { val: 1.0, label: '1x' },
                { val: 1.5, label: '1.5x' },
                { val: 2.0, label: '2x' }
            ];

            portionBar.innerHTML = portions.map(p => {
                const isActive = Number(state.selectedPortion) === p.val;
                return `
                    <button type="button" onclick="setSelectedPortion(${p.val})"
                        class="px-2 sm:px-2.5 py-1 rounded-lg text-xs font-semibold transition text-center ${isActive
                        ? 'bg-teal-500 text-white shadow-sm ring-2 ring-teal-400/50 font-bold'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-teal-500/40'
                    }">
                        ${p.label}
                    </button>
                `;
            }).join('');
        }

        function setGender(g) { state.profile.gender = g; saveState(); renderAll(); }
        function syncProfileInput(field, val) {
            const num = parseFloat(val);
            if (!isNaN(num)) {
                state.profile[field] = num;
                saveState();
                renderAll();
            }
        }
        function updateActivity(val) { state.profile.activity = parseFloat(val); saveState(); renderAll(); }
        function setGoalPreset(diff) { state.profile.goalDiff = diff; saveState(); renderAll(); }
        function updateGoalDiff(val) { state.profile.goalDiff = parseInt(val, 10); saveState(); renderAll(); }

        function setMacroPreset(p, c, f) {
            state.profile.macros = { p, c, f };
            saveState();
            renderAll();
        }

        function setProtein2gPerKg() {
            const t = getCalculatedTargets();
            const targetPGram = Math.round((t.weight || state.profile.weight) * 2);
            let pPct = Math.round(((targetPGram * 4) / t.targetCal) * 100);
            pPct = Math.min(60, Math.max(15, pPct));
            const rem = 100 - pPct;
            const fPct = Math.max(15, Math.round(rem * 0.4));
            const cPct = 100 - pPct - fPct;
            state.profile.macros = { p: pPct, c: cPct, f: fPct };
            saveState();
            renderAll();
        }

        function adjustMacros(changed, newVal) {
            newVal = parseInt(newVal, 10);
            const m = { ...state.profile.macros };
            m[changed] = newVal;
            const others = ['p', 'c', 'f'].filter(k => k !== changed);
            const rem = 100 - newVal;
            const sumOthers = m[others[0]] + m[others[1]];
            if (sumOthers === 0) {
                m[others[0]] = Math.floor(rem / 2);
                m[others[1]] = rem - m[others[0]];
            } else {
                m[others[0]] = Math.max(5, Math.round((m[others[0]] / sumOthers) * rem));
                m[others[1]] = Math.max(5, 100 - newVal - m[others[0]]);
                m[others[0]] = 100 - newVal - m[others[1]];
            }
            state.profile.macros = m;
            saveState();
            renderAll();
        }

        function selectCategory(catId) {
            state.selectedCategory = catId;
            // If user explicitly clicks a category tab while a search query was active, clear search so they view that category normally
            if (state.searchQuery && catId !== 'all') {
                state.searchQuery = '';
                state._prevCategoryBeforeSearch = null;
                const input = document.getElementById('foodSearchInput');
                if (input) input.value = '';
                const btnClear = document.getElementById('btnClearSearch');
                if (btnClear) btnClear.classList.add('hidden');
            }
            renderFoodDatabaseExplorer();
        }

        function onSearchFood(q) {
            state.searchQuery = (q || '').trim().toLowerCase();
            const btnClear = document.getElementById('btnClearSearch');
            if (btnClear) btnClear.classList.toggle('hidden', !state.searchQuery);
            // Universal Search: When user starts searching, automatically expand view across ALL categories
            if (state.searchQuery) {
                if (!state._prevCategoryBeforeSearch) {
                    state._prevCategoryBeforeSearch = state.selectedCategory || 'all';
                }
                state.selectedCategory = 'all';
            } else if (state._prevCategoryBeforeSearch) {
                state.selectedCategory = state._prevCategoryBeforeSearch;
                state._prevCategoryBeforeSearch = null;
            }
            renderFoodDatabaseExplorer();
        }

        function clearFoodSearch() {
            state.searchQuery = '';
            const input = document.getElementById('foodSearchInput');
            if (input) input.value = '';
            const btnClear = document.getElementById('btnClearSearch');
            if (btnClear) btnClear.classList.add('hidden');
            if (state._prevCategoryBeforeSearch) {
                state.selectedCategory = state._prevCategoryBeforeSearch;
                state._prevCategoryBeforeSearch = null;
            }
            renderFoodDatabaseExplorer();
        }

        function getSelectedFoodCountMap() {
            const meals = state.logsByDate[state.selectedDate] || [];
            const map = {};
            meals.forEach(m => {
                map[m.name] = (map[m.name] || 0) + 1;
            });
            return map;
        }

        function deleteCustomPreset(name, event) {
            if (event) event.stopPropagation();
            if (!confirm(`ต้องการลบเมนู "${name}" ออกจากหมวดเมนูส่วนตัวใช่หรือไม่?`)) return;
            state.customPresets = (state.customPresets || []).filter(p => p.name !== name);
            saveState();
            renderFoodDatabaseExplorer();
            showToast(`ลบ "${name}" ออกจากเมนูส่วนตัวแล้ว`);
        }

        function renderFoodDatabaseExplorer() {
            const tabBar = document.getElementById('categoryTabBar');
            const listContainer = document.getElementById('quickFoodList');
            if (!tabBar || !listContainer) return;
            const selectedCounts = getSelectedFoodCountMap();

            // Sync search input and clear button state
            const searchInput = document.getElementById('foodSearchInput');
            if (searchInput && document.activeElement !== searchInput) {
                searchInput.value = state.searchQuery || '';
            }
            const btnClear = document.getElementById('btnClearSearch');
            if (btnClear) {
                btnClear.classList.toggle('hidden', !state.searchQuery);
            }

            const categories = [...FOOD_DATABASE.categories];
            if (state.customPresets && state.customPresets.length > 0) {
                categories.unshift({
                    id: 'custom',
                    name: `📝 เมนูส่วนตัว (${state.customPresets.length})`,
                    foods: state.customPresets.map(f => ({ ...f, isCustom: true }))
                });
            }

            const favCount = Array.isArray(state.favorites) ? state.favorites.length : 0;
            const combosCount = Array.isArray(state.mealCombos) ? state.mealCombos.length : 0;
            const allTabs = [];
            if (favCount > 0) {
                allTabs.push({ id: 'favorites', name: `⭐ เมนูโปรด (${favCount})` });
            }
            if (combosCount > 0) {
                allTabs.push({ id: 'combos', name: `📦 เซ็ตประจำ (${combosCount})` });
            }

            const totalFoodsCount = categories.reduce((sum, c) => sum + c.foods.length, 0);
            document.getElementById('totalFoodCountBadge').textContent = totalFoodsCount;

            allTabs.push({ id: 'all', name: `ทั้งหมด (${totalFoodsCount})` });
            categories.forEach(c => allTabs.push({ id: c.id, name: c.name }));

            tabBar.innerHTML = allTabs.map(cat => {
                const isActive = state.selectedCategory === cat.id;
                return `
                    <button onclick="selectCategory('${cat.id}')"
                        class="whitespace-nowrap text-xs sm:text-sm px-4 py-2 rounded-full font-semibold transition shrink-0 ${isActive
                        ? 'bg-emerald-500 text-white shadow-md ring-2 ring-emerald-400/50'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-emerald-500/40'
                    }">
                        ${cat.name}
                    </button>
                `;
            }).join('');

            const matchesQuery = (foodName, catName) => {
                if (!state.searchQuery) return true;
                const q = state.searchQuery;
                const n = (foodName + ' ' + (catName || '')).toLowerCase();
                if (n.includes(q)) return true;
                // Ramen normalization (ราเมน <-> ราเมง)
                const qNorm = q.replace(/ราเมง/g, 'ราเมน');
                const nNorm = n.replace(/ราเมง/g, 'ราเมน');
                if (nNorm.includes(qNorm)) return true;
                return false;
            };

            // If combos tab is selected, render combo cards directly
            if (state.selectedCategory === 'combos') {
                const combos = state.mealCombos || [];
                const targetMealCfg = MEAL_CONFIG[state.activeMeal] || MEAL_CONFIG.breakfast;
                if (combos.length === 0) {
                    listContainer.innerHTML = `
                        <div class="col-span-2 text-center py-8 space-y-2">
                            <span class="text-3xl block">📦</span>
                            <p class="text-sm font-semibold text-slate-700 dark:text-slate-200">ยังไม่มีเซ็ตอาหารประจำที่บันทึกไว้</p>
                            <p class="text-xs text-slate-400">กดปุ่ม <b>[📦 เซฟเซ็ต]</b> ที่หัวมื้ออาหารในตารางบันทึกรายวันเพื่อเซฟมื้อโปรดได้ทันทีครับ</p>
                        </div>
                    `;
                    return;
                }

                listContainer.innerHTML = combos.map(combo => {
                    const totalCal = Math.round(combo.items.reduce((s, x) => s + x.cal, 0));
                    const totalP = Math.round(combo.items.reduce((s, x) => s + x.p, 0) * 10) / 10;
                    const totalC = Math.round(combo.items.reduce((s, x) => s + x.c, 0) * 10) / 10;
                    const totalF = Math.round(combo.items.reduce((s, x) => s + x.f, 0) * 10) / 10;
                    const mealCfg = MEAL_CONFIG[combo.meal] || MEAL_CONFIG.breakfast;
                    const itemsPreview = combo.items.map(x => `${x.name}${x.portion && x.portion !== 1 ? ` (x${x.portion})` : ''}`).join(', ');

                    return `
                        <div class="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 hover:border-purple-500/50 transition shadow-xs flex flex-col justify-between gap-3 group">
                            <div class="space-y-1.5">
                                <div class="flex items-center justify-between gap-2">
                                    <div class="flex items-center gap-1.5 font-bold text-sm text-slate-800 dark:text-slate-100">
                                        <span class="text-base">📦</span>
                                        <span class="truncate">${combo.name}</span>
                                    </div>
                                    <div class="flex items-center gap-1 shrink-0">
                                        <span class="text-xs px-2 py-0.5 rounded-full font-bold bg-purple-500/15 text-purple-600 dark:text-purple-400">
                                            ${mealCfg.icon} ${mealCfg.name}
                                        </span>
                                        <button onclick="deleteMealCombo('${combo.id}', event)" class="text-slate-400 hover:text-rose-500 p-1 text-xs" title="ลบเซ็ตนี้">
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                                <p class="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                                    ${itemsPreview} (${combo.items.length} รายการ)
                                </p>
                                <div class="flex items-center gap-2 text-xs font-semibold pt-1">
                                    <span class="text-emerald-500 font-bold">${totalCal} kcal</span>
                                    <span class="text-blue-500 dark:text-blue-400">P:${totalP}g</span>
                                    <span class="text-amber-500 dark:text-amber-400">C:${totalC}g</span>
                                    <span class="text-rose-500 dark:text-rose-400">F:${totalF}g</span>
                                </div>
                            </div>

                            <button onclick="applyMealCombo('${combo.id}')"
                                class="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-bold text-xs shadow-xs transition flex items-center justify-center gap-1.5">
                                <span>⚡ ใส่เข้า${targetMealCfg.name} (${combo.items.length} รายการ)</span>
                            </button>
                        </div>
                    `;
                }).join('');
                return;
            }

            let items = [];
            if (state.searchQuery) {
                // UNIVERSAL SEARCH: Always search across ALL categories + custom presets simultaneously!
                const seen = new Set();
                categories.forEach(cat => {
                    cat.foods.forEach(f => {
                        if (!seen.has(f.name) && matchesQuery(f.name, cat.name)) {
                            seen.add(f.name);
                            items.push({ ...f, catName: cat.name });
                        }
                    });
                });
            } else if (state.selectedCategory === 'favorites') {
                const favSet = new Set(state.favorites || []);
                categories.forEach(cat => {
                    cat.foods.forEach(f => {
                        if (favSet.has(f.name)) {
                            items.push({ ...f, catName: cat.name });
                        }
                    });
                });
            } else {
                categories.forEach(cat => {
                    if (state.selectedCategory === 'all' || state.selectedCategory === cat.id) {
                        cat.foods.forEach(f => {
                            items.push({ ...f, catName: cat.name });
                        });
                    }
                });
            }

            if (items.length === 0) {
                const emptyMsg = state.searchQuery
                    ? `🔍 ไม่พบเมนู "${state.searchQuery}" ในคลังอาหารทั้งหมด (ลองพิมพ์คำค้นสั้นลง หรือเปิดฟอร์มกรอกเพิ่มเองด้านล่างได้ครับ)`
                    : (state.selectedCategory === 'favorites'
                        ? 'ยังไม่มีเมนูโปรด กดไอคอน ⭐ ที่มุมของเมนูอาหารเพื่อบันทึกเป็นเมนูโปรดได้เลยครับ'
                        : 'ไม่พบเมนูในหมวดนี้ สามารถเปิดฟอร์มกรอกเพิ่มเองด้านล่างได้เลยครับ');
                listContainer.innerHTML = `<div class="col-span-2 text-center py-6 text-sm text-slate-400">${emptyMsg}</div>`;
                return;
            }

            listContainer.innerHTML = items.map(item => {
                const cal = item.calories || Math.round(item.protein * 4 + item.carbs * 4 + item.fat * 9);
                const serving = item.servingSize ? `<span class="text-xs text-slate-400 font-normal">(${item.servingSize})</span>` : '';
                const safeName = item.name.replace(/'/g, "\\'");
                const count = selectedCounts[item.name] || 0;
                const isJustAdded = state.lastAddedFoodName === item.name;
                const isFav = Array.isArray(state.favorites) && state.favorites.includes(item.name);

                const cardClass = count > 0
                    ? `bg-emerald-500/15 dark:bg-emerald-500/20 border-2 border-emerald-500 shadow-sm ${isJustAdded ? 'ring-2 ring-emerald-400' : ''}`
                    : 'bg-white dark:bg-slate-800 hover:bg-emerald-500/10 border border-slate-200/80 dark:border-slate-700 hover:border-emerald-500/40';

                const countBadge = count > 0
                    ? `<span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-500 text-white ml-1">✓ x${count}</span>`
                    : '';

                const starBtn = `
                    <button type="button" onclick="toggleFavorite('${safeName}', event)"
                        class="p-1 rounded-md hover:bg-slate-200/60 dark:hover:bg-slate-700 transition ${isFav ? 'text-amber-400 text-base font-bold' : 'text-slate-300 dark:text-slate-600 hover:text-amber-400 text-base'}"
                        title="${isFav ? 'นำออกจากเมนูโปรด' : 'กดติดดาวเมนูโปรด'}">
                        ${isFav ? '★' : '☆'}
                    </button>
                `;

                const deleteBtn = item.isCustom
                    ? `<button type="button" onclick="deleteCustomPreset('${safeName}', event)"
                        class="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition text-sm ml-1"
                        title="ลบออกจากเมนูส่วนตัว">
                        🗑️
                    </button>`
                    : '';

                // Quick Meal Picker Button (+มื้อ)
                const mealPickerBtn = `
                    <button type="button" onclick="openFoodMealPicker('${safeName}', ${item.protein}, ${item.carbs}, ${item.fat}, ${cal}, event)"
                        class="p-1.5 px-2 rounded-xl bg-slate-100 dark:bg-slate-700/80 hover:bg-emerald-500 hover:text-white dark:hover:bg-emerald-500 text-slate-600 dark:text-slate-300 transition text-xs font-bold flex items-center gap-1 border border-slate-200/80 dark:border-slate-600 shadow-xs active:scale-95 shrink-0"
                        title="เลือกว่าจะหยอดเมนูนี้ลงมื้อไหน (เช้า/เที่ยง/เย็น/ของว่าง)">
                        <span>🍱</span>
                        <span class="text-[11px] font-semibold">+มื้อ</span>
                    </button>
                `;

                return `
                    <div onclick="addFoodItem('${safeName}', ${item.protein}, ${item.carbs}, ${item.fat}, ${cal})"
                        class="cursor-pointer text-left p-3 rounded-2xl transition flex items-center justify-between gap-2.5 group ${cardClass}">
                        <div class="min-w-0 flex items-center gap-2 flex-1">
                            ${starBtn}
                            <div class="min-w-0 flex-1">
                                <div class="text-sm font-semibold truncate group-hover:text-emerald-500 transition flex items-center flex-wrap gap-1.5">
                                    <span>+ ${item.name}</span> ${serving} ${countBadge}
                                </div>
                                <div class="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                                    <span class="text-blue-500 dark:text-blue-400 font-semibold">P:${item.protein}g</span>
                                    <span class="text-amber-500 dark:text-amber-400 font-semibold">C:${item.carbs}g</span>
                                    <span class="text-rose-500 dark:text-rose-400 font-semibold">F:${item.fat}g</span>
                                    ${item.catName ? `<span class="opacity-70 text-[11px]">• ${item.catName}</span>` : ''}
                                </div>
                            </div>
                        </div>
                        <div class="flex items-center gap-1.5 shrink-0">
                            <span class="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1.5 rounded-xl">
                                ${cal} kcal
                            </span>
                            ${mealPickerBtn}
                            ${deleteBtn}
                        </div>
                    </div>
                `;
            }).join('');
        }

        function renderWaterSection(targets) {
            const dStr = state.selectedDate;
            const waterGlasses = state.waterByDate[dStr] || 0;
            const targetGlasses = targets.waterTargetGlasses;
            const currentMl = waterGlasses * 250;
            const targetMl = targets.waterTargetMl;
            const remGlasses = Math.max(0, targetGlasses - waterGlasses);
            const remMl = Math.max(0, targetMl - currentMl);
            const pctWater = Math.min(100, Math.round((waterGlasses / targetGlasses) * 100));

            document.getElementById('waterRecommendationSubtitle').textContent =
                `แนะนำตามน้ำหนัก ${targets.weight} กก. (35 มล./กก.${targets.activityBonusMl > 0 ? ` + ชดเชยออกกำลังกาย ${targets.activityBonusMl} มล.` : ''}) = ควรดื่มวันละ ${targetMl.toLocaleString()} มล.`;

            document.getElementById('waterCountText').textContent = `${waterGlasses} / ${targetGlasses} แก้ว`;
            document.getElementById('waterMlStatusText').textContent = `ดื่มแล้ว ${currentMl.toLocaleString()} มล. (${pctWater}%)`;
            document.getElementById('waterTargetText').textContent = `เป้าหมาย ${targetMl.toLocaleString()} มล. (${targetGlasses} แก้ว)`;
            document.getElementById('barWater').style.width = `${pctWater}%`;

            const defEl = document.getElementById('waterDeficitText');
            if (remGlasses > 0) {
                defEl.className = 'text-[11px] text-amber-500 font-medium mt-1.5';
                defEl.textContent = `💧 วันนี้ยังดื่มน้ำขาดอีก ${remGlasses} แก้ว (${remMl.toLocaleString()} มล.) คลิกที่รูปแก้วด้านล่างหรือกด + เพื่อบันทึก`;
            } else {
                defEl.className = 'text-[11px] text-emerald-500 font-semibold mt-1.5';
                defEl.textContent = `✅ ยอดเยี่ยม! วันนี้ดื่มน้ำครบตามเป้าหมาย ${targetMl.toLocaleString()} มล. แล้ว`;
            }

            // Render clickable glass icons
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
            document.getElementById('waterGlassIcons').innerHTML = iconsHtml;
        }

        function switchBodyTab(tabName) {
            state.bodyTab = tabName;
            clearTimeout(window._tabSaveTimer);
            window._tabSaveTimer = setTimeout(() => {
                try {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
                } catch (e) {}
            }, 100);
            renderBodyAndWorkoutSection(getCalculatedTargets());
        }

        function submitWeightToday() {
            const input = document.getElementById('inDailyWeight');
            const val = parseFloat(input.value);
            if (isNaN(val) || val < 30 || val > 250) {
                return alert('กรุณากรอกน้ำหนักตัวที่ถูกต้อง (30 - 250 กก.) ครับ');
            }
            const dStr = state.selectedDate;
            const cleanVal = Math.round(val * 10) / 10;
            state.weightsByDate[dStr] = cleanVal;
            state.profile.weight = cleanVal;
            saveState();
            renderAll();
            showToast(`⚖️ บันทึกน้ำหนัก ${cleanVal} กก. สำหรับวันที่ ${dStr} เรียบร้อย`);
        }

        function clearWeightToday() {
            const dStr = state.selectedDate;
            if (state.weightsByDate && state.weightsByDate[dStr]) {
                delete state.weightsByDate[dStr];
                saveState();
                renderAll();
                showToast(`ลบการบันทึกน้ำหนักของวันที่ ${dStr} แล้ว`);
            }
        }

        function addWorkout(name, cal) {
            const dStr = state.selectedDate;
            if (!state.workoutsByDate[dStr]) state.workoutsByDate[dStr] = [];
            const time = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
            state.workoutsByDate[dStr].push({
                id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
                name,
                cal: Math.round(cal),
                time
            });
            saveState();
            renderAll();
            showToast(`🏃 บันทึกกิจกรรม "${name}" (-${cal} kcal) แล้ว`);
        }

        function submitCustomWorkout() {
            const nameInput = document.getElementById('inWorkoutName');
            const calInput = document.getElementById('inWorkoutCal');
            const name = nameInput.value.trim();
            const cal = parseFloat(calInput.value);
            if (!name) return alert('กรุณาระบุกิจกรรมออกกำลังกายครับ');
            if (isNaN(cal) || cal <= 0) return alert('กรุณาระบุพลังงานที่เผาผลาญ (kcal) ครับ');

            addWorkout(name, cal);
            nameInput.value = '';
            calInput.value = '';
        }

        function removeWorkout(id) {
            const dStr = state.selectedDate;
            if (!state.workoutsByDate[dStr]) return;
            state.workoutsByDate[dStr] = state.workoutsByDate[dStr].filter(w => w.id !== id);
            saveState();
            renderAll();
            showToast('ลบรายการออกกำลังกายแล้ว');
        }

        function renderBodyAndWorkoutSection(targets) {
            const dStr = state.selectedDate;
            const isWeightTab = (state.bodyTab || 'weight') === 'weight';

            const tabBtnWeight = document.getElementById('tabBtnWeight');
            const tabBtnWorkout = document.getElementById('tabBtnWorkout');
            const tabWeight = document.getElementById('bodyTabWeight');
            const tabWorkout = document.getElementById('bodyTabWorkout');

            if (isWeightTab) {
                tabBtnWeight.className = 'px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition bg-emerald-500 text-white shadow-xs';
                tabBtnWorkout.className = 'px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition text-slate-600 dark:text-slate-300 hover:text-emerald-500';
                tabWeight.classList.remove('hidden');
                tabWorkout.classList.add('hidden');
            } else {
                tabBtnWeight.className = 'px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition text-slate-600 dark:text-slate-300 hover:text-emerald-500';
                tabBtnWorkout.className = 'px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition bg-orange-500 text-white shadow-xs';
                tabWeight.classList.add('hidden');
                tabWorkout.classList.remove('hidden');
            }

            // Tab 1: Weight logic
            const directWeight = state.weightsByDate ? state.weightsByDate[dStr] : null;
            const inDailyWeight = document.getElementById('inDailyWeight');
            const btnClearWeightToday = document.getElementById('btnClearWeightToday');
            const statusText = document.getElementById('weightStatusText');

            if (directWeight !== undefined && directWeight !== null) {
                inDailyWeight.value = directWeight;
                btnClearWeightToday.classList.remove('hidden');

                const pastDates = Object.keys(state.weightsByDate || {})
                    .filter(d => d < dStr && Number(state.weightsByDate[d]) > 0)
                    .sort();
                let diffStr = '';
                if (pastDates.length > 0) {
                    const prevDate = pastDates[pastDates.length - 1];
                    const prevWeight = Number(state.weightsByDate[prevDate]);
                    const diff = Math.round((directWeight - prevWeight) * 10) / 10;
                    if (diff > 0) {
                        diffStr = ` (📈 +${diff} กก. เทียบกับวันที่ ${prevDate})`;
                    } else if (diff < 0) {
                        diffStr = ` (📉 ${diff} กก. เทียบกับวันที่ ${prevDate})`;
                    } else {
                        diffStr = ` (เท่ากับวันที่ ${prevDate})`;
                    }
                }
                statusText.innerHTML = `<span class="text-emerald-500 font-semibold">✓ บันทึกแล้ว ${directWeight} กก.${diffStr}</span> <span class="text-slate-400 block text-[10px]">ระบบใช้คำนวณ BMR/น้ำดื่มของวันนี้แม่นยำขึ้น</span>`;
            } else {
                const effective = getEffectiveWeight(dStr);
                inDailyWeight.value = '';
                btnClearWeightToday.classList.add('hidden');
                const fromMsg = effective.sourceDate === 'profile'
                    ? `ตั้งต้นจากข้อมูลส่วนตัว (${effective.weight} กก.)`
                    : `อ้างอิงล่าสุดจากวันที่ ${effective.sourceDate} (${effective.weight} กก.)`;
                statusText.innerHTML = `<span class="text-slate-400">ยังไม่ได้บันทึกของวันนี้ (${fromMsg}) ไม่บังคับบันทึกครับ</span>`;
            }

            // Tab 2: Workout logic
            const workouts = (state.workoutsByDate && state.workoutsByDate[dStr]) || [];
            const workoutContainer = document.getElementById('workoutListContainer');
            if (workouts.length === 0) {
                workoutContainer.innerHTML = `
                    <div class="text-center py-2.5 text-[11px] text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                        ยังไม่มีการบันทึกออกกำลังกายวันนี้ (กดปุ่มลัดด้านบนหรือพิมพ์เอง)
                    </div>
                `;
            } else {
                const totalBurned = workouts.reduce((s, w) => s + w.cal, 0);
                workoutContainer.innerHTML = workouts.map(w => `
                    <div class="flex items-center justify-between p-2 rounded-xl bg-orange-500/10 border border-orange-500/20 text-xs">
                        <div class="flex items-center gap-1.5 min-w-0">
                            <span class="font-semibold text-slate-700 dark:text-slate-200 truncate">${w.name}</span>
                            <span class="text-[10px] text-slate-400">${w.time || ''}</span>
                        </div>
                        <div class="flex items-center gap-2 shrink-0">
                            <span class="font-bold text-orange-500">-${w.cal} kcal</span>
                            <button type="button" onclick="removeWorkout('${w.id}')" class="text-rose-500 hover:text-rose-600 text-xs font-bold px-1" title="ลบรายการ">✕</button>
                        </div>
                    </div>
                `).join('') + `
                    <div class="text-right text-[11px] font-bold text-orange-500 pt-0.5">
                        รวมเบิร์นทั้งหมด: -${totalBurned.toLocaleString()} kcal
                    </div>
                `;
            }
        }

        function renderWeeklyAnalytics(targets) {
            const todayStr = getTodayStr();
            const dStr = state.selectedDate;
            const isViewingPast = dStr !== todayStr;

            // Anchor 7-day window to today so current week (including Today) never disappears
            const anchorDateObj = (dStr > todayStr) ? new Date(dStr + 'T00:00:00') : new Date(todayStr + 'T00:00:00');
            const weekBar = document.getElementById('weekHistoryBar');
            const badge = document.getElementById('weeklyConsistencyBadge');
            const avgText = document.getElementById('weeklyAvgCalText');

            // Quick Return to Today Banner inside Analytics
            const returnBanner = document.getElementById('analyticsReturnToTodayBanner');
            const returnDateText = document.getElementById('analyticsSelectedDateText');
            if (returnBanner && returnDateText) {
                if (isViewingPast) {
                    returnBanner.classList.remove('hidden');
                    const curDateObj = new Date(dStr + 'T00:00:00');
                    returnDateText.textContent = curDateObj.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' });
                } else {
                    returnBanner.classList.add('hidden');
                }
            }

            // Top Date Bar Alert Banner
            const topPastBanner = document.getElementById('pastDateAlertBanner');
            const topPastText = document.getElementById('pastDateAlertText');
            if (topPastBanner && topPastText) {
                if (isViewingPast) {
                    topPastBanner.classList.remove('hidden');
                    const curDateObj = new Date(dStr + 'T00:00:00');
                    topPastText.textContent = curDateObj.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                } else {
                    topPastBanner.classList.add('hidden');
                }
            }

            let totalCal7Days = 0;
            let daysWithLogs = 0;
            const targetCal = targets.targetCal;

            const daysData = [];
            let maxChartCal = targetCal * 1.25;

            for (let i = 6; i >= 0; i--) {
                const d = new Date(anchorDateObj);
                d.setDate(d.getDate() - i);
                const offset = d.getTimezoneOffset() * 60000;
                const iso = new Date(d.getTime() - offset).toISOString().split('T')[0];

                const dayLogs = (state.logsByDate && state.logsByDate[iso]) || [];
                const eatenCal = dayLogs.reduce((s, x) => s + x.cal, 0);

                const dayWorkouts = (state.workoutsByDate && state.workoutsByDate[iso]) || [];
                const burnedCal = dayWorkouts.reduce((s, x) => s + x.cal, 0);

                const dayWeight = (state.weightsByDate && state.weightsByDate[iso]) || null;

                if (eatenCal > 0) {
                    totalCal7Days += eatenCal;
                    daysWithLogs++;
                }
                if (eatenCal > maxChartCal) {
                    maxChartCal = eatenCal * 1.1;
                }

                daysData.push({
                    iso,
                    shortDay: iso === todayStr ? 'วันนี้' : d.toLocaleDateString('th-TH', { weekday: 'short' }),
                    dayNum: d.getDate(),
                    eatenCal,
                    burnedCal,
                    dayWeight,
                    isSelected: iso === dStr,
                    isToday: iso === todayStr
                });
            }

            const consistencyPct = Math.round((daysWithLogs / 7) * 100);
            badge.textContent = `ความสม่ำเสมอ: ${consistencyPct}% (${daysWithLogs}/7 วัน)`;
            badge.className = consistencyPct >= 70
                ? 'px-2 py-0.5 rounded-full font-bold text-xs bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                : 'px-2 py-0.5 rounded-full font-bold text-xs bg-amber-500/15 text-amber-600 dark:text-amber-400';

            const avgCal = daysWithLogs > 0 ? Math.round(totalCal7Days / daysWithLogs) : 0;
            avgText.textContent = `เฉลี่ย: ${avgCal.toLocaleString()} kcal/วัน`;

            // Weight Trend Analysis for 7 Days (SVG Polyline)
            const trendBadge = document.getElementById('weeklyWeightTrendBadge');
            const trendContainer = document.getElementById('weekWeightTrendContainer');

            const weightsWithIdx = daysData
                .map((d, idx) => ({ idx, weight: d.dayWeight ? parseFloat(d.dayWeight) : null, iso: d.iso, dayNum: d.dayNum }))
                .filter(w => w.weight !== null && !isNaN(w.weight) && w.weight > 0);

            if (trendBadge) {
                if (weightsWithIdx.length >= 2) {
                    const firstW = weightsWithIdx[0].weight;
                    const lastW = weightsWithIdx[weightsWithIdx.length - 1].weight;
                    const diffW = Math.round((lastW - firstW) * 10) / 10;
                    if (diffW < 0) {
                        trendBadge.className = 'px-2 py-0.5 rounded-full font-bold text-xs bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30';
                        trendBadge.innerHTML = `📉 นน. สัปดาห์นี้: ${diffW} กก.`;
                    } else if (diffW > 0) {
                        trendBadge.className = 'px-2 py-0.5 rounded-full font-bold text-xs bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30';
                        trendBadge.innerHTML = `📈 นน. สัปดาห์นี้: +${diffW} กก.`;
                    } else {
                        trendBadge.className = 'px-2 py-0.5 rounded-full font-bold text-xs bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30';
                        trendBadge.innerHTML = `⚖️ นน. สัปดาห์นี้: คงที่ (±0.0 กก.)`;
                    }
                } else if (weightsWithIdx.length === 1) {
                    trendBadge.className = 'px-2 py-0.5 rounded-full font-bold text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-slate-600';
                    trendBadge.innerHTML = `⚖️ นน. ล่าสุด: ${weightsWithIdx[0].weight} กก.`;
                } else {
                    trendBadge.className = 'px-2 py-0.5 rounded-full font-bold text-xs bg-slate-100 dark:bg-slate-700 text-slate-400 border border-slate-200 dark:border-slate-600';
                    trendBadge.innerHTML = `⚖️ ยังไม่มีบันทึก นน. 7 วันนี้`;
                }
            }

            if (trendContainer) {
                if (weightsWithIdx.length >= 2) {
                    const allW = weightsWithIdx.map(w => w.weight);
                    let minW = Math.min(...allW);
                    let maxW = Math.max(...allW);
                    if (minW === maxW) { minW -= 0.5; maxW += 0.5; }
                    const rangeW = maxW - minW;

                    const points = weightsWithIdx.map(w => {
                        const x = w.idx * 50 + 25;
                        const y = Math.round(34 - ((w.weight - minW) / rangeW) * 22);
                        return { x, y, weight: w.weight, idx: w.idx };
                    });

                    const polylinePoints = points.map(p => `${p.x},${p.y}`).join(' ');

                    const dotsSvg = points.map(p => `
                        <g>
                            <circle cx="${p.x}" cy="${p.y}" r="3.5" fill="#0284c7" stroke="#ffffff" stroke-width="1.5" />
                            <text x="${p.x}" y="${Math.max(10, p.y - 6)}" text-anchor="middle" font-size="8.5" font-weight="bold" fill="#0284c7">${p.weight}</text>
                        </g>
                    `).join('');

                    trendContainer.innerHTML = `
                        <div class="px-2 py-1.5 rounded-xl bg-sky-500/5 dark:bg-sky-500/10 border border-sky-500/15 space-y-1">
                            <div class="flex items-center justify-between text-[11px] text-sky-600 dark:text-sky-400 font-semibold px-1">
                                <span>📈 แนวโน้มน้ำหนักตัว (บันทึก ${weightsWithIdx.length}/7 วัน)</span>
                                <span>${minW.toFixed(1)} - ${maxW.toFixed(1)} กก.</span>
                            </div>
                            <svg viewBox="0 0 350 44" class="w-full h-11 overflow-visible">
                                <defs>
                                    <linearGradient id="trendLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                        <stop offset="0%" stop-color="#0284c7" />
                                        <stop offset="100%" stop-color="#38bdf8" />
                                    </linearGradient>
                                </defs>
                                <polyline fill="none" stroke="url(#trendLineGrad)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" points="${polylinePoints}" />
                                ${dotsSvg}
                            </svg>
                        </div>
                    `;
                } else if (weightsWithIdx.length === 1) {
                    const p = weightsWithIdx[0];
                    trendContainer.innerHTML = `
                        <div class="p-2 rounded-xl bg-slate-100/60 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-center text-xs text-slate-400 flex items-center justify-between">
                            <span>⚖️ บันทึกแล้ว 1 วัน (${p.weight} กก.) ชั่งเพิ่มอีก 1 วันเพื่อแสดงกราฟเส้นแนวโน้ม</span>
                            <button onclick="switchBodyTab('weight')" class="text-sky-500 hover:underline font-bold text-xs">+ บันทึก นน.</button>
                        </div>
                    `;
                } else {
                    trendContainer.innerHTML = `
                        <div class="p-2 rounded-xl bg-slate-100/40 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700/60 text-center text-xs text-slate-400 flex items-center justify-between">
                            <span>⚖️ ชั่งน้ำหนักเพื่อดูกราฟเส้นแนวโน้มคู่กับแคลอรีที่ทาน</span>
                            <button onclick="switchBodyTab('weight')" class="text-emerald-500 hover:underline font-bold text-xs">+ บันทึก นน. วันนี้</button>
                        </div>
                    `;
                }
            }

            const maxBarHeightPx = 60;

            weekBar.innerHTML = daysData.map(d => {
                const heightPct = Math.min(100, Math.round((d.eatenCal / maxChartCal) * 100));
                const barHeightPx = d.eatenCal > 0 ? Math.max(6, Math.round((heightPct / 100) * maxBarHeightPx)) : 4;

                let barColor = 'bg-slate-200 dark:bg-slate-700';
                if (d.eatenCal > 0) {
                    const diff = d.eatenCal - targetCal;
                    if (Math.abs(diff) <= 150) {
                        barColor = 'bg-emerald-500';
                    } else if (diff < -150) {
                        barColor = 'bg-amber-400 dark:bg-amber-500';
                    } else {
                        barColor = 'bg-rose-500';
                    }
                }

                const borderClass = d.isSelected
                    ? 'ring-2 ring-emerald-500 border-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/20 shadow-xs'
                    : (d.isToday ? 'border-emerald-500/50 bg-emerald-500/5 dark:bg-emerald-500/10 hover:border-emerald-500' : 'border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/80 hover:border-emerald-500/50');

                const weightBadge = d.dayWeight
                    ? `<span class="text-[9px] font-bold text-sky-500 block truncate">${d.dayWeight}k</span>`
                    : '';

                return `
                    <button type="button" onclick="onDateChange('${d.iso}')"
                        class="flex flex-col items-center justify-end p-1.5 rounded-xl border transition group h-28 ${borderClass} active:scale-95"
                        title="${d.iso}: ${d.eatenCal.toLocaleString()} kcal (เป้าหมาย ${targetCal.toLocaleString()} kcal)${d.burnedCal > 0 ? ` [เบิร์น -${d.burnedCal} kcal]` : ''}">
                        <div class="w-full flex-1 flex items-end justify-center pb-1">
                            <div class="w-full max-w-[20px] rounded-t-md transition-all duration-300 relative ${barColor}" style="height: ${barHeightPx}px;">
                                ${d.burnedCal > 0 ? '<span class="absolute -top-3 left-1/2 -translate-x-1/2 text-[8px]">🔥</span>' : ''}
                            </div>
                        </div>
                        <div class="text-center w-full pt-1 border-t border-slate-100 dark:border-slate-700/50">
                            <span class="text-[10px] block font-semibold ${d.isSelected ? 'text-emerald-500 font-bold' : (d.isToday ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-500 dark:text-slate-400')}">${d.shortDay} ${d.isToday ? '📍' : d.dayNum}</span>
                            <span class="text-[9px] block font-bold text-slate-700 dark:text-slate-200 truncate">${d.eatenCal > 0 ? d.eatenCal : '-'}</span>
                            ${weightBadge}
                        </div>
                    </button>
                `;
            }).join('');
        }

        function renderDateTrackerAndRecommendations(targets, forceReshuffle = false) {
            const dStr = state.selectedDate;
            document.getElementById('datePicker').value = dStr;

            const dateObj = new Date(dStr + 'T00:00:00');
            const thaiDate = dateObj.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
            document.getElementById('lblThaiDate').textContent = dStr === getTodayStr() ? `${thaiDate} (วันนี้)` : thaiDate;

            renderWaterSection(targets);

            // Render 7-Day Analytics Bar Chart
            renderWeeklyAnalytics(targets);

            // Render Optional Body Weight & Workout Tracker
            renderBodyAndWorkoutSection(targets);

            // Meals Summary
            const meals = state.logsByDate[dStr] || [];
            document.getElementById('mealCount').textContent = meals.length;

            const sumP = Math.round(meals.reduce((s, m) => s + m.p, 0));
            const sumC = Math.round(meals.reduce((s, m) => s + m.c, 0));
            const sumF = Math.round(meals.reduce((s, m) => s + m.f, 0));
            const sumCal = Math.round(meals.reduce((s, m) => s + m.cal, 0));

            const pctCal = Math.min(100, Math.round((sumCal / targets.targetCal) * 100));
            document.getElementById('donutCenterPct').textContent = `${pctCal}%`;

            document.getElementById('progCalText').textContent = `${sumCal.toLocaleString()} / ${targets.targetCal.toLocaleString()} kcal`;
            document.getElementById('progPText').textContent = `${sumP}/${targets.pGram}g`;
            document.getElementById('progCText').textContent = `${sumC}/${targets.cGram}g`;
            document.getElementById('progFText').textContent = `${sumF}/${targets.fGram}g`;

            document.getElementById('barCal').style.width = `${Math.min(100, (sumCal / targets.targetCal) * 100)}%`;
            document.getElementById('barP').style.width = `${Math.min(100, (sumP / targets.pGram) * 100)}%`;
            document.getElementById('barC').style.width = `${Math.min(100, (sumC / targets.cGram) * 100)}%`;
            document.getElementById('barF').style.width = `${Math.min(100, (sumF / targets.fGram) * 100)}%`;

            const remCal = targets.targetCal - sumCal;
            const remP = Math.max(0, targets.pGram - sumP);
            const remC = Math.max(0, targets.cGram - sumC);
            const remF = Math.max(0, targets.fGram - sumF);

            // Workouts & Net Calories calculation
            const dayWorkouts = (state.workoutsByDate && state.workoutsByDate[dStr]) || [];
            const burnedCal = dayWorkouts.reduce((s, w) => s + w.cal, 0);
            const netCal = sumCal - burnedCal;

            const netCalRow = document.getElementById('netCalRow');
            const burnedCalText = document.getElementById('burnedCalText');
            const netCalText = document.getElementById('netCalText');

            if (burnedCal > 0) {
                netCalRow.classList.remove('hidden');
                burnedCalText.textContent = `-${burnedCal.toLocaleString()} kcal`;
                netCalText.textContent = `${netCal.toLocaleString()} kcal`;
            } else {
                netCalRow.classList.add('hidden');
            }

            const waterGlasses = state.waterByDate[dStr] || 0;
            const remWaterGlasses = Math.max(0, targets.waterTargetGlasses - waterGlasses);
            const remWaterMl = remWaterGlasses * 250;

            const waterBadgeHtml = remWaterGlasses > 0
                ? `<span class="px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-600 dark:text-sky-400 font-semibold">💧 น้ำดื่มขาด ${remWaterGlasses} แก้ว (${remWaterMl.toLocaleString()} มล.)</span>`
                : `<span class="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-500 font-semibold">✓ น้ำดื่มครบเป้า</span>`;

            const workoutBadgeHtml = burnedCal > 0
                ? `<span class="px-2 py-0.5 rounded-md bg-orange-500/15 text-orange-600 dark:text-orange-400 font-semibold">🔥 เบิร์นออกกำลัง -${burnedCal.toLocaleString()} kcal (Net: ${netCal.toLocaleString()} kcal)</span>`
                : '';

            // Render Status Pill & Deficit Alert Banner (Including Water Alert)
            const statusPill = document.getElementById('statusPill');
            const alertBanner = document.getElementById('deficitAlertBanner');

            if (sumCal === 0) {
                statusPill.className = 'text-xs px-2.5 py-1 rounded-full font-semibold bg-slate-100 dark:bg-slate-700 text-slate-500';
                statusPill.textContent = '⏳ ยังไม่ได้เริ่มบันทึกมื้ออาหาร';
                alertBanner.className = 'p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs space-y-1.5';
                alertBanner.innerHTML = `
                    <div class="font-bold text-amber-600 dark:text-amber-400">🔔 แจ้งเตือนเป้าหมายวันนี้:</div>
                    <p class="text-slate-600 dark:text-slate-300">วันนี้ยังขาดพลังงาน <b>${targets.targetCal.toLocaleString()} kcal</b> (โปรตีน <b>${targets.pGram}g</b>, คาร์บ <b>${targets.cGram}g</b>, ไขมัน <b>${targets.fGram}g</b>)</p>
                    <div class="flex flex-wrap gap-1.5 pt-0.5">${waterBadgeHtml}${workoutBadgeHtml}</div>
                `;
            } else if (Math.abs(remCal) <= 150 && remP <= 15 && remWaterGlasses === 0) {
                statusPill.className = 'text-xs px-2.5 py-1 rounded-full font-semibold bg-emerald-500/20 text-emerald-500';
                statusPill.textContent = '🎉 ถึงเป้าทั้งอาหารและน้ำดื่ม!';
                alertBanner.className = 'p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs space-y-1';
                alertBanner.innerHTML = `
                    <div class="font-bold text-emerald-600 dark:text-emerald-400">✅ สมบูรณ์แบบมากครับเบนซ์!</div>
                    <p class="text-slate-600 dark:text-slate-300">วันนี้ทานพลังงาน โปรตีน และดื่มน้ำครบตามเป้าหมายทั้งหมดแล้ว</p>
                    <div class="flex flex-wrap gap-1.5 pt-0.5">${workoutBadgeHtml}</div>
                `;
            } else if (remCal > 0) {
                statusPill.className = 'text-xs px-2.5 py-1 rounded-full font-semibold bg-amber-500/20 text-amber-500';
                statusPill.textContent = `⚡ ยังขาดอีก ${remCal.toLocaleString()} kcal`;
                alertBanner.className = 'p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs space-y-1.5';
                alertBanner.innerHTML = `
                    <div class="flex items-center justify-between">
                        <span class="font-bold text-amber-600 dark:text-amber-400">⚠️ สรุปสิ่งที่ยังขาดในวันนี้:</span>
                        <button onclick="openDailyReportModal()" class="text-[11px] underline text-amber-600 dark:text-amber-400 font-semibold">ดูรายงานละเอียด</button>
                    </div>
                    <div class="flex flex-wrap gap-1.5 pt-0.5">
                        <span class="px-2 py-0.5 rounded-md bg-white/80 dark:bg-slate-800 font-semibold text-emerald-600 dark:text-emerald-400">พลังงานขาด ${remCal.toLocaleString()} kcal</span>
                        ${remP > 0 ? `<span class="px-2 py-0.5 rounded-md bg-white/80 dark:bg-slate-800 font-semibold text-blue-500">โปรตีนขาด ${remP}g</span>` : `<span class="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-500 font-semibold">✓ โปรตีนครบ</span>`}
                        ${remC > 0 ? `<span class="px-2 py-0.5 rounded-md bg-white/80 dark:bg-slate-800 font-semibold text-amber-500">คาร์บขาด ${remC}g</span>` : ''}
                        ${remF > 0 ? `<span class="px-2 py-0.5 rounded-md bg-white/80 dark:bg-slate-800 font-semibold text-rose-500">ไขมันขาด ${remF}g</span>` : ''}
                        ${waterBadgeHtml}
                        ${workoutBadgeHtml}
                    </div>
                `;
            } else {
                statusPill.className = 'text-xs px-2.5 py-1 rounded-full font-semibold bg-rose-500/20 text-rose-500';
                statusPill.textContent = `🔥 เกินเป้าหมาย ${Math.abs(remCal).toLocaleString()} kcal`;
                alertBanner.className = 'p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs space-y-1.5';
                alertBanner.innerHTML = `
                    <div class="font-bold text-rose-600 dark:text-rose-400">🚨 แจ้งเตือนแคลอรีเกินเป้าหมาย:</div>
                    <p class="text-slate-600 dark:text-slate-300">วันนี้ทานเกินเป้าหมายไป <b>${Math.abs(remCal).toLocaleString()} kcal</b> ${remP > 0 ? `(โปรตีนยังขาดอีก <b>${remP}g</b>)` : ''}</p>
                    <div class="flex flex-wrap gap-1.5 pt-0.5">${waterBadgeHtml}${workoutBadgeHtml}</div>
                `;
            }

            // Render Smart Food Recommendations (Uses cache unless macros changed or user clicked Reshuffle)
            renderSmartRecommendations(remCal, remP, remC, remF, forceReshuffle);

            // Render Logged Meals List (Grouped by 4 Meals: เช้า, เที่ยง, เย็น, ของว่าง)
            const listEl = document.getElementById('mealListContainer');
            if (meals.length === 0) {
                listEl.innerHTML = `
                    <div class="text-center py-8 px-4 text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl space-y-1.5">
                        <div class="text-2xl">🍽️</div>
                        <p class="font-medium text-slate-600 dark:text-slate-300">ยังไม่มีรายการอาหารในวันที่ ${dStr}</p>
                        <p class="text-[11px] text-slate-400">เลือกมื้อด้านบนแล้วกดคลิกเลือกเมนูจากคลัง หรือสุ่มเมนูแนะนำด้านซ้ายได้เลยครับ</p>
                    </div>
                `;
            } else {
                const mealGroups = {
                    breakfast: { ...MEAL_CONFIG.breakfast, items: [] },
                    lunch: { ...MEAL_CONFIG.lunch, items: [] },
                    dinner: { ...MEAL_CONFIG.dinner, items: [] },
                    snack: { ...MEAL_CONFIG.snack, items: [] }
                };

                meals.forEach(m => {
                    const k = m.meal && mealGroups[m.meal] ? m.meal : 'breakfast';
                    mealGroups[k].items.push(m);
                });

                listEl.innerHTML = Object.keys(mealGroups).map(key => {
                    const group = mealGroups[key];
                    const items = group.items;
                    const groupCal = Math.round(items.reduce((s, x) => s + x.cal, 0));
                    const groupP = Math.round(items.reduce((s, x) => s + x.p, 0) * 10) / 10;
                    const groupC = Math.round(items.reduce((s, x) => s + x.c, 0) * 10) / 10;
                    const groupF = Math.round(items.reduce((s, x) => s + x.f, 0) * 10) / 10;
                    const isActive = state.activeMeal === key;

                    const itemsHtml = items.length === 0
                        ? `
                            <div class="flex items-center justify-between p-3 rounded-xl border border-dashed border-slate-200/80 dark:border-slate-700/80 text-xs sm:text-sm text-slate-400">
                                <span>ยังไม่ได้บันทึก${group.name}</span>
                                <button type="button" onclick="setActiveMeal('${key}'); showToast('เลือกมื้อ ${group.name} เรียบร้อย');" class="text-emerald-500 hover:underline font-semibold flex items-center gap-1">
                                    + เพิ่มเข้ามื้อนี้
                                </button>
                            </div>
                        `
                        : items.map(m => {
                            if (!m.id) m.id = 'log_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
                            const portion = m.portion || 1;
                            const portionBadge = portion !== 1
                                ? `<span class="px-1.5 py-0.5 rounded text-xs font-bold bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-500/30">x${portion}</span>`
                                : '';
                            return `
                                <div class="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-xs hover:border-slate-300 dark:hover:border-slate-600 transition gap-2.5">
                                    <div class="min-w-0 flex-1">
                                        <div class="flex items-center gap-1.5 flex-wrap">
                                            <span class="text-sm font-semibold text-slate-800 dark:text-slate-100">${m.name}</span>
                                            ${portionBadge}
                                            <span class="text-xs text-slate-400">${m.time || ''}</span>
                                        </div>
                                        <div class="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                                            <span class="text-emerald-500 font-bold">${m.cal} kcal</span>
                                            <span class="text-blue-500 dark:text-blue-400 font-semibold">P:${m.p}g</span>
                                            <span class="text-amber-500 dark:text-amber-400 font-semibold">C:${m.c}g</span>
                                            <span class="text-rose-500 dark:text-rose-400 font-semibold">F:${m.f}g</span>
                                        </div>
                                    </div>
                                    <div class="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-700/50">
                                        <!-- Quick Portion Adjusters -->
                                        <div class="flex items-center bg-slate-100 dark:bg-slate-700/70 rounded-lg p-0.5 border border-slate-200/60 dark:border-slate-600/60">
                                            <button type="button" onclick="updateMealItemPortion('${m.id}', -0.5)" class="w-6 h-6 rounded flex items-center justify-center text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition" title="ลดขนาดเสิร์ฟ (-0.5x)">-</button>
                                            <span class="text-xs font-bold px-1.5 min-w-[26px] text-center">${portion}x</span>
                                            <button type="button" onclick="updateMealItemPortion('${m.id}', 0.5)" class="w-6 h-6 rounded flex items-center justify-center text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition" title="เพิ่มขนาดเสิร์ฟ (+0.5x)">+</button>
                                        </div>
                                        <!-- Quick Meal Switcher -->
                                        <select onchange="changeMealCategory('${m.id}', this.value)" class="bg-slate-100 dark:bg-slate-700/70 text-xs rounded-lg px-2 py-1 font-medium border border-slate-200/60 dark:border-slate-600/60 focus:outline-none cursor-pointer" title="ย้ายมื้ออาหาร">
                                            <option value="breakfast" ${m.meal === 'breakfast' ? 'selected' : ''}>🌅 เช้า</option>
                                            <option value="lunch" ${m.meal === 'lunch' ? 'selected' : ''}>☀️ เที่ยง</option>
                                            <option value="dinner" ${m.meal === 'dinner' ? 'selected' : ''}>🌙 เย็น</option>
                                            <option value="snack" ${m.meal === 'snack' ? 'selected' : ''}>🍎 ว่าง</option>
                                        </select>
                                        <!-- Delete Button -->
                                        <button type="button" onclick="removeFoodItem('${m.id}')" class="text-sm text-rose-500 hover:bg-rose-500/10 p-1.5 rounded-lg transition" title="ลบรายการนี้">
                                            ✕
                                        </button>
                                    </div>
                                </div>
                            `;
                        }).join('');

                    return `
                        <div class="p-3.5 sm:p-4 rounded-2xl border transition ${items.length > 0
                            ? 'bg-slate-50/70 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700'
                            : 'bg-slate-50/30 dark:bg-slate-900/20 border-slate-200/50 dark:border-slate-800'
                        }">
                            <!-- Meal Header Row -->
                            <div class="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-200/60 dark:border-slate-700/60">
                                <div class="flex items-center gap-2 flex-wrap">
                                    <span class="text-lg">${group.icon}</span>
                                    <span class="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100">${group.name}</span>
                                    <span class="text-xs sm:text-sm px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                                        ${groupCal} kcal
                                    </span>
                                    ${groupCal > 0 ? `
                                        <div class="flex items-center gap-1.5 text-xs text-slate-400">
                                            <span class="text-blue-500 dark:text-blue-400 font-semibold">P:${groupP}g</span>
                                            <span>•</span>
                                            <span class="text-amber-500 dark:text-amber-400 font-semibold">C:${groupC}g</span>
                                            <span>•</span>
                                            <span class="text-rose-500 dark:text-rose-400 font-semibold">F:${groupF}g</span>
                                        </div>
                                    ` : ''}
                                </div>
                                <div class="flex items-center gap-1.5 flex-wrap">
                                    <button type="button" onclick="copyMealFromYesterday('${key}')"
                                        class="text-xs px-2 py-1 rounded-lg border font-medium transition text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/20 shadow-xs"
                                        title="คัดลอกเฉพาะ${group.name}จากเมื่อวาน">
                                        📋 เมื่อวาน
                                    </button>
                                    ${items.length > 0 ? `
                                        <button type="button" onclick="saveMealAsCombo('${key}')"
                                            class="text-xs px-2 py-1 rounded-lg border font-medium transition text-purple-600 dark:text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/20 shadow-xs"
                                            title="เซฟรายการใน${group.name}นี้เป็นเซ็ตประจำ">
                                            📦 เซฟเซ็ต
                                        </button>
                                    ` : ''}
                                    <button type="button" onclick="setActiveMeal('${key}'); showToast('เลือกมื้อ ${group.name} สำหรับบันทึกแล้ว');"
                                        class="text-xs px-2.5 py-1 rounded-lg border font-medium transition ${isActive
                            ? 'bg-emerald-500 text-white border-emerald-500 font-bold shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-500 hover:border-emerald-500/40'
                        }">
                                        ${isActive ? '✓ มื้อที่เลือก' : 'เลือกมื้อนี้'}
                                    </button>
                                </div>
                            </div>
                            <!-- Meal Items Container -->
                            <div class="space-y-2">
                                ${itemsHtml}
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }

        // ==========================================
        // MEAL COMBOS & YESTERDAY COPYING (v5.0.0)
        // ==========================================
        function copyMealFromYesterday(mealKey) {
            const curDate = new Date(state.selectedDate + 'T00:00:00');
            const prevDate = new Date(curDate.getTime() - 86400000);
            const offset = prevDate.getTimezoneOffset() * 60000;
            const prevIso = new Date(prevDate.getTime() - offset).toISOString().split('T')[0];
            const prevMeals = (state.logsByDate && state.logsByDate[prevIso]) || [];
            const itemsToCopy = prevMeals.filter(m => (m.meal || 'breakfast') === mealKey);

            if (itemsToCopy.length === 0) {
                showToast(`⚠️ ไม่พบรายการ${MEAL_CONFIG[mealKey]?.name || 'มื้อนี้'}ของเมื่อวาน (${prevIso})`);
                return;
            }

            const todayStr = state.selectedDate;
            if (!state.logsByDate[todayStr]) state.logsByDate[todayStr] = [];

            const nowTime = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
            itemsToCopy.forEach(item => {
                const portion = item.portion || 1;
                state.logsByDate[todayStr].push({
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

            saveState();
            renderAll();
            showToast(`✓ คัดลอก${MEAL_CONFIG[mealKey]?.name || ''}จากเมื่อวาน (${itemsToCopy.length} รายการ) เรียบร้อย!`);
        }

        function saveMealAsCombo(mealKey) {
            const todayStr = state.selectedDate;
            const meals = (state.logsByDate && state.logsByDate[todayStr]) || [];
            const items = meals.filter(m => (m.meal || 'breakfast') === mealKey);
            if (items.length === 0) {
                showToast('⚠️ มื้อนี้ยังไม่มีรายการอาหารให้เซฟเป็นเซ็ต');
                return;
            }

            const defaultName = `เซ็ต${MEAL_CONFIG[mealKey]?.name || 'มื้ออาหาร'}ประจำ`;
            const comboName = prompt(`ตั้งชื่อเซ็ตอาหารนี้ (${items.length} รายการ):`, defaultName);
            if (!comboName || !comboName.trim()) return;

            if (!Array.isArray(state.mealCombos)) state.mealCombos = [];

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

            state.mealCombos.push(newCombo);
            saveState();
            renderFoodDatabaseExplorer();
            showToast(`📦 บันทึกเซ็ต "${newCombo.name}" เรียบร้อยแล้ว!`);
        }

        function applyMealCombo(comboId, targetMealKey) {
            const combo = (state.mealCombos || []).find(c => c.id === comboId);
            if (!combo || !combo.items || combo.items.length === 0) return;

            const targetMeal = targetMealKey || state.activeMeal || combo.meal || 'breakfast';
            const todayStr = state.selectedDate;
            if (!state.logsByDate[todayStr]) state.logsByDate[todayStr] = [];

            const nowTime = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
            combo.items.forEach(item => {
                const portion = item.portion || 1;
                state.logsByDate[todayStr].push({
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

            saveState();
            renderAll();
            showToast(`⚡ ใส่เซ็ต "${combo.name}" เข้า${MEAL_CONFIG[targetMeal]?.name || 'มื้ออาหาร'} (${combo.items.length} รายการ) เรียบร้อย!`);
        }

        function deleteMealCombo(comboId, event) {
            if (event) {
                event.stopPropagation();
                event.preventDefault();
            }
            const combo = (state.mealCombos || []).find(c => c.id === comboId);
            if (!combo) return;
            if (!confirm(`ต้องการลบเซ็ต "${combo.name}" ใช่หรือไม่?`)) return;
            state.mealCombos = (state.mealCombos || []).filter(c => c.id !== comboId);
            saveState();
            renderFoodDatabaseExplorer();
            showToast(`ลบเซ็ต "${combo.name}" เรียบร้อยแล้ว`);
        }

        // ==========================================
        // SUPPLEMENT & VITAMIN CHECKLIST (v5.6.6)
        // ==========================================
        function renderSupplements() {
            const container = document.getElementById('supplementListContainer');
            const badge = document.getElementById('suppProgressBadge');
            const bar = document.getElementById('barSupplements');
            if (!container) return;

            const dStr = state.selectedDate;
            const defaultList = (typeof window.DEFAULT_SUPPLEMENTS !== 'undefined' && Array.isArray(window.DEFAULT_SUPPLEMENTS))
                ? window.DEFAULT_SUPPLEMENTS
                : (typeof DEFAULT_SUPPLEMENTS !== 'undefined' ? DEFAULT_SUPPLEMENTS : []);
            const supps = Array.isArray(state.supplementList) ? state.supplementList : defaultList;
            const checkedMap = (state.supplementsByDate && state.supplementsByDate[dStr]) || {};

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
            const dStr = state.selectedDate;
            if (!state.supplementsByDate) state.supplementsByDate = {};
            if (!state.supplementsByDate[dStr]) state.supplementsByDate[dStr] = {};
            const cur = !state.supplementsByDate[dStr][suppId];
            state.supplementsByDate[dStr][suppId] = cur;
            saveState();
            renderSupplements();

            const defaultList = (typeof window.DEFAULT_SUPPLEMENTS !== 'undefined' && Array.isArray(window.DEFAULT_SUPPLEMENTS))
                ? window.DEFAULT_SUPPLEMENTS
                : (typeof DEFAULT_SUPPLEMENTS !== 'undefined' ? DEFAULT_SUPPLEMENTS : []);
            const allSupps = Array.isArray(state.supplementList)
                ? state.supplementList
                : defaultList;

            const supp = allSupps.find(s => s.id === suppId);
            if (cur) {
                const allTaken = allSupps.length > 0 && allSupps.every(s => state.supplementsByDate[dStr][s.id]);
                if (allTaken) {
                    showToast('🎉 เยี่ยมมาก! ทานวิตามิน & อาหารเสริมครบทุกตัวตามเป้าของวันนี้แล้ว');
                } else {
                    showToast(`✓ ทาน ${supp?.name || 'วิตามิน'} แล้ว`);
                }
            }
        }

        let _modalOpeningCooldown = 0;

        function openAddSupplementModal() {
            // 1. Auto-uncollapse supplement card if it was collapsed so user sees the list!
            if (state.collapsedSections && state.collapsedSections['section_supplements']) {
                state.collapsedSections['section_supplements'] = false;
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
            openModalAnimated('addSupplementModal', () => { if (inName) inName.focus(); });
        }

        function closeAddSupplementModal() {
            closeModalAnimated('addSupplementModal');
        }

        function closeAddSupplementModalOnBackdrop(e) {
            // Guard against mobile touch event ghost-click
            if (Date.now() - _modalOpeningCooldown < 350) return;
            if (e && e.target && e.target.id === 'addSupplementModal') {
                closeAddSupplementModal();
            }
        }

        function submitNewSupplement() {
            const nameInput = document.getElementById('inSuppName');
            const name = nameInput ? nameInput.value.trim() : '';
            const time = (document.getElementById('inSuppTime')?.value || '').trim() || 'ตามเวลาที่สะดวก';
            const icon = (document.getElementById('inSuppIcon')?.value || '').trim() || '💊';
            if (!name) {
                alert('กรุณากรอกชื่อวิตามินหรืออาหารเสริมครับ');
                return;
            }
            if (!Array.isArray(state.supplementList)) {
                state.supplementList = [];
            } else {
                state.supplementList = [...state.supplementList];
            }
            const newSupp = {
                id: 'supp_' + Date.now(),
                name,
                time,
                icon,
                isCustom: true
            };
            state.supplementList.push(newSupp);
            saveState();
            closeAddSupplementModal();

            // Ensure section is expanded so user sees the newly added supplement
            if (state.collapsedSections && state.collapsedSections['section_supplements']) {
                state.collapsedSections['section_supplements'] = false;
                const body = document.getElementById('body_section_supplements');
                const icon = document.getElementById('icon_section_supplements');
                if (body) body.classList.remove('hidden');
                if (icon) icon.textContent = '▲';
            }

            renderSupplements();
            showToast(`✓ เพิ่มอาหารเสริม "${name}" เรียบร้อยแล้ว`);
        }

        function deleteSupplement(suppId) {
            const list = Array.isArray(state.supplementList) ? state.supplementList : [];
            const target = list.find(s => s.id === suppId);
            const targetName = target ? target.name : 'อาหารเสริมนี้';
            if (!confirm(`ต้องการลบ "${targetName}" ออกจากรายการใช่หรือไม่?`)) return;
            state.supplementList = list.filter(s => s.id !== suppId);
            saveState();
            renderSupplements();
            showToast(`ลบ "${targetName}" เรียบร้อยแล้ว`);
        }

        function deleteCustomSupplement(suppId) {
            deleteSupplement(suppId);
        }

        function restoreDefaultSupplements() {
            const defaultList = (typeof window.DEFAULT_SUPPLEMENTS !== 'undefined' && Array.isArray(window.DEFAULT_SUPPLEMENTS))
                ? window.DEFAULT_SUPPLEMENTS
                : (typeof DEFAULT_SUPPLEMENTS !== 'undefined' ? DEFAULT_SUPPLEMENTS : []);
            if (!confirm('ต้องการคืนค่ารายการวิตามิน/อาหารเสริมเริ่มต้น (7 รายการมาตรฐาน) ใช่หรือไม่?')) return;
            state.supplementList = JSON.parse(JSON.stringify(defaultList));
            saveState();
            renderSupplements();
            showToast('✓ คืนค่ารายการอาหารเสริมเริ่มต้นเรียบร้อยแล้ว');
        }

        function forceReshuffleRecommendations() {
            const t = getCalculatedTargets();
            const meals = state.logsByDate[state.selectedDate] || [];
            const sumP = Math.round(meals.reduce((s, m) => s + m.p, 0));
            const sumC = Math.round(meals.reduce((s, m) => s + m.c, 0));
            const sumF = Math.round(meals.reduce((s, m) => s + m.f, 0));
            const sumCal = Math.round(meals.reduce((s, m) => s + m.cal, 0));
            renderSmartRecommendations(
                t.targetCal - sumCal,
                Math.max(0, t.pGram - sumP),
                Math.max(0, t.cGram - sumC),
                Math.max(0, t.fGram - sumF),
                true
            );
            showToast('🔄 สุ่มเมนูแนะนำชุดใหม่แล้ว');
        }

        function renderSmartRecommendations(remCal, remP, remC, remF, forceReshuffle = false) {
            const container = document.getElementById('smartRecommendationList');
            const subtitle = document.getElementById('recSubtitle');

            if (remCal <= 50 && remP <= 10) {
                subtitle.textContent = 'คุณทานอาหารครบตามเป้าหมายของวันนี้แล้ว!';
                container.innerHTML = `
                    <div class="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                        🎉 วันนี้สารอาหารครบเป๊ะ! แนะนำจิบน้ำเปล่าให้ครบตามหลอดเป้าหมายด้านบนครับ
                    </div>
                `;
                return;
            }

            const cacheKey = `${state.selectedDate}_${remCal}_${remP}_${remC}`;
            let reasonLabel = '';

            if (remP >= 20 && remCal < 400) {
                reasonLabel = `เน้นโปรตีนลีนไขมันต่ำ (โปรตีนยังขาด ${remP}g แต่แคลอรีเหลือ ${Math.max(0, remCal)} kcal)`;
            } else if (remP >= 25) {
                reasonLabel = `เน้นเติมโปรตีนให้ถึงเป้า (ยังขาดโปรตีนอีก ${remP}g)`;
            } else if (remC >= 30 && remCal >= 200) {
                reasonLabel = `เติมคาร์โบไฮเดรตและพลังงาน (ยังขาดคาร์บ ${remC}g / ${remCal} kcal)`;
            } else {
                reasonLabel = `มื้อเบาๆ พอดีกับแคลอรีที่เหลือ (${Math.max(0, remCal)} kcal)`;
            }

            if (forceReshuffle || cacheKey !== lastRecCacheKey || cachedRecommendations.length === 0) {
                const allFoods = [];
                FOOD_DATABASE.categories.forEach(c => {
                    c.foods.forEach(f => allFoods.push({ ...f, catName: c.name }));
                });

                let candidates = [];
                if (remP >= 20 && remCal < 400) {
                    candidates = allFoods.filter(f => f.protein >= 15 && f.calories <= 320);
                } else if (remP >= 25) {
                    candidates = allFoods.filter(f => f.protein >= 22 && f.calories <= Math.max(350, remCal + 100));
                } else if (remC >= 30 && remCal >= 200) {
                    candidates = allFoods.filter(f => f.carbs >= 25 && f.calories <= remCal + 100 && f.calories >= 100);
                } else {
                    candidates = allFoods.filter(f => f.calories > 40 && f.calories <= Math.max(250, remCal + 50));
                }

                if (candidates.length === 0) {
                    candidates = allFoods.filter(f => f.protein >= 12);
                }

                cachedRecommendations = [...candidates].sort(() => 0.5 - Math.random()).slice(0, 4);
                lastRecCacheKey = cacheKey;
            }

            subtitle.textContent = reasonLabel;
            container.innerHTML = cachedRecommendations.map(item => {
                const safeName = item.name.replace(/'/g, "\\'");
                return `
                    <div class="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-700/40 border border-slate-200/80 dark:border-slate-700 gap-2">
                        <div>
                            <div class="text-sm font-semibold text-slate-800 dark:text-slate-100">${item.name} <span class="text-xs text-slate-400 font-normal">(${item.servingSize})</span></div>
                            <div class="text-xs text-slate-400 mt-1 flex flex-wrap gap-2">
                                <span class="text-emerald-500 font-bold">${item.calories} kcal</span>
                                <span class="text-blue-500 dark:text-blue-400 font-semibold">โปรตีน ${item.protein}g</span>
                                <span class="text-amber-500 dark:text-amber-400 font-medium">คาร์บ ${item.carbs}g</span>
                                <span class="text-rose-500 dark:text-rose-400 font-medium">ไขมัน ${item.fat}g</span>
                            </div>
                        </div>
                        <button onclick="addFoodItem('${safeName}', ${item.protein}, ${item.carbs}, ${item.fat}, ${item.calories})"
                            class="text-xs sm:text-sm px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition shrink-0 shadow-xs">
                            + กินเมนูนี้
                        </button>
                    </div>
                `;
            }).join('');
        }

        // Fixed Water Functions: Only updates water & alert banner without reshuffling food recommendations
        function adjustWater(delta) {
            const dStr = state.selectedDate;
            const cur = state.waterByDate[dStr] || 0;
            state.waterByDate[dStr] = Math.max(0, cur + delta);
            saveState();
            const t = getCalculatedTargets();
            renderDateTrackerAndRecommendations(t, false);
        }

        function setWaterDirect(glasses) {
            const dStr = state.selectedDate;
            const cur = state.waterByDate[dStr] || 0;
            state.waterByDate[dStr] = (cur === glasses) ? glasses - 1 : glasses;
            saveState();
            const t = getCalculatedTargets();
            renderDateTrackerAndRecommendations(t, false);
        }

        function onDateChange(val) {
            if (!val) return;
            const changed = state.selectedDate !== val;
            state.selectedDate = val;
            if (changed) {
                state.activeMeal = 'breakfast';
            }
            saveState();
            renderAll();
        }

        function shiftDate(days) {
            const d = new Date(state.selectedDate + 'T00:00:00');
            d.setDate(d.getDate() + days);
            const offset = d.getTimezoneOffset() * 60000;
            const newDateStr = new Date(d.getTime() - offset).toISOString().split('T')[0];
            if (state.selectedDate !== newDateStr) {
                state.selectedDate = newDateStr;
                state.activeMeal = 'breakfast';
                saveState();
                renderAll();
            }
        }

        function goToToday() {
            state.selectedDate = getTodayStr();
            state.activeMeal = 'breakfast';
            saveState();
            renderAll();
            showToast('📅 กลับสู่วันปัจจุบัน (มื้อเช้า) เรียบร้อย');
        }

        function addFoodItem(name, p, c, f, explicitCal, targetMeal, targetPortion) {
            const dStr = state.selectedDate;
            if (!state.logsByDate[dStr]) state.logsByDate[dStr] = [];

            const meal = targetMeal || state.activeMeal || getDefaultMealByTime();
            const portion = targetPortion !== undefined ? Number(targetPortion) : (Number(state.selectedPortion) || 1);

            const baseCal = explicitCal !== undefined && explicitCal !== null
                ? Math.round(explicitCal)
                : Math.round(p * 4 + c * 4 + f * 9);
            const baseP = Number(p);
            const baseC = Number(c);
            const baseF = Number(f);

            const finalCal = Math.round(baseCal * portion);
            const finalP = Math.round(baseP * portion * 10) / 10;
            const finalC = Math.round(baseC * portion * 10) / 10;
            const finalF = Math.round(baseF * portion * 10) / 10;

            const time = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
            state.logsByDate[dStr].push({
                id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
                name,
                meal,
                portion,
                baseCal, baseP, baseC, baseF,
                cal: finalCal,
                p: finalP,
                c: finalC,
                f: finalF,
                time
            });
            state.lastAddedFoodName = name;
            saveState();
            renderAll();
            const mealName = MEAL_CONFIG[meal]?.name || 'มื้ออาหาร';
            const portionStr = portion !== 1 ? ` (x${portion})` : '';
            showToast(`✅ เพิ่ม "${name}"${portionStr} ลงใน ${mealName} (${finalCal} kcal) แล้ว`);
        }

        // ==========================================
        // Quick Food Meal Picker Modal (v5.3.7)
        // ==========================================
        window._pendingFoodPickerItem = null;
        window._pendingFoodPickerPortion = 1;

        function openFoodMealPicker(name, p, c, f, explicitCal, event) {
            if (event) event.stopPropagation();
            window._pendingFoodPickerItem = { name, p, c, f, explicitCal };
            window._pendingFoodPickerPortion = Number(state.selectedPortion) || 1;

            const titleEl = document.getElementById('foodPickerTitle');
            const subEl = document.getElementById('foodPickerSubtitle');
            if (titleEl) titleEl.textContent = name;
            if (subEl) subEl.textContent = `${explicitCal} kcal | P:${p}g C:${c}g F:${f}g`;

            setFoodPickerPortion(window._pendingFoodPickerPortion);

            // Highlight current active meal with a small badge
            ['breakfast', 'lunch', 'dinner', 'snack'].forEach(m => {
                const badge = document.getElementById(`foodPickerBadge_${m}`);
                if (badge) {
                    badge.classList.toggle('hidden', state.activeMeal !== m);
                }
            });

            const modal = document.getElementById('foodMealPickerModal');
            if (modal) {
                modal.classList.remove('hidden');
                requestAnimationFrame(() => modal.classList.add('modal-open'));
            }
        }

        function setFoodPickerPortion(portion) {
            window._pendingFoodPickerPortion = portion;
            const label = document.getElementById('foodPickerPortionLabel');
            if (label) {
                label.textContent = portion === 1 ? '1x (ปกติ)' : `${portion}x`;
            }
            const btns = document.querySelectorAll('.food-picker-portion-btn');
            btns.forEach(b => {
                const p = parseFloat(b.getAttribute('data-portion'));
                if (p === portion) {
                    b.className = 'food-picker-portion-btn py-1.5 rounded-xl border border-emerald-500 bg-emerald-500 text-white text-xs font-bold shadow-xs';
                } else {
                    b.className = 'food-picker-portion-btn py-1.5 rounded-xl border border-slate-200 dark:border-slate-600 text-xs font-semibold hover:border-emerald-500';
                }
            });
        }

        function submitFoodMealPicker(targetMeal) {
            if (!window._pendingFoodPickerItem) return;
            const { name, p, c, f, explicitCal } = window._pendingFoodPickerItem;
            const portion = window._pendingFoodPickerPortion || 1;
            addFoodItem(name, p, c, f, explicitCal, targetMeal, portion);
            closeFoodMealPickerModal();
        }

        function closeFoodMealPickerModal() {
            const modal = document.getElementById('foodMealPickerModal');
            if (!modal) return;
            modal.classList.remove('modal-open');
            setTimeout(() => {
                modal.classList.add('hidden');
                window._pendingFoodPickerItem = null;
            }, 250);
        }

        function closeFoodMealPickerOnBackdrop(event) {
            if (event.target === event.currentTarget) {
                closeFoodMealPickerModal();
            }
        }

        function updateMealItemPortion(id, delta) {
            const dStr = state.selectedDate;
            if (!state.logsByDate[dStr]) return;
            const item = state.logsByDate[dStr].find(m => m.id === id);
            if (!item) return;

            let curPortion = Number(item.portion) || 1;
            let newPortion = Math.round((curPortion + delta) * 10) / 10;
            if (newPortion < 0.5) {
                if (confirm(`ต้องการลบรายการ "${item.name}" ใช่หรือไม่?`)) {
                    removeFoodItem(id);
                }
                return;
            }
            if (newPortion > 10) newPortion = 10;

            const baseCal = item.baseCal !== undefined ? item.baseCal : Math.round(item.cal / curPortion);
            const baseP = item.baseP !== undefined ? item.baseP : Math.round((item.p / curPortion) * 10) / 10;
            const baseC = item.baseC !== undefined ? item.baseC : Math.round((item.c / curPortion) * 10) / 10;
            const baseF = item.baseF !== undefined ? item.baseF : Math.round((item.f / curPortion) * 10) / 10;

            item.portion = newPortion;
            item.baseCal = baseCal;
            item.baseP = baseP;
            item.baseC = baseC;
            item.baseF = baseF;
            item.cal = Math.round(baseCal * newPortion);
            item.p = Math.round(baseP * newPortion * 10) / 10;
            item.c = Math.round(baseC * newPortion * 10) / 10;
            item.f = Math.round(baseF * newPortion * 10) / 10;

            saveState();
            renderAll();
            showToast(`ปรับปริมาณ "${item.name}" เป็น x${newPortion} (${item.cal} kcal)`);
        }

        function changeMealCategory(id, newMeal) {
            const dStr = state.selectedDate;
            if (!state.logsByDate[dStr]) return;
            const item = state.logsByDate[dStr].find(m => m.id === id);
            if (!item) return;
            item.meal = newMeal;
            saveState();
            renderAll();
            if (window.triggerCloudSync) window.triggerCloudSync(false);
            showToast(`ย้าย "${item.name}" ไปยัง ${MEAL_CONFIG[newMeal]?.name || newMeal} แล้ว`);
        }

        function addCustomFood(saveAsPreset) {
            const name = document.getElementById('inFoodName').value.trim();
            const calInput = parseFloat(document.getElementById('inFoodCal').value);
            const p = parseFloat(document.getElementById('inFoodP').value) || 0;
            const c = parseFloat(document.getElementById('inFoodC').value) || 0;
            const f = parseFloat(document.getElementById('inFoodF').value) || 0;
            if (!name) return alert('กรุณาใส่ชื่อเมนูอาหารครับ');

            const finalCal = !isNaN(calInput) && calInput > 0 ? Math.round(calInput) : Math.round(p * 4 + c * 4 + f * 9);

            if (saveAsPreset) {
                state.customPresets.push({ name, servingSize: 'กำหนดเอง', calories: finalCal, protein: p, carbs: c, fat: f });
            }
            addFoodItem(name, p, c, f, finalCal);
            document.getElementById('inFoodName').value = '';
            document.getElementById('inFoodCal').value = '';
            document.getElementById('inFoodP').value = '';
            document.getElementById('inFoodC').value = '';
            document.getElementById('inFoodF').value = '';
        }

        function removeFoodItem(id) {
            const dStr = state.selectedDate;
            if (!state.logsByDate[dStr]) return;
            state.logsByDate[dStr] = state.logsByDate[dStr].filter(m => m.id && m.id !== id);
            if (window.triggerCloudSync) window.triggerCloudSync(false);
            saveState();
            renderAll();
        }

        function clearSelectedDateMeals() {
            const dStr = state.selectedDate;
            if (!state.logsByDate[dStr] || state.logsByDate[dStr].length === 0) return;
            if (confirm(`ต้องการล้างรายการอาหารทั้งหมดของวันที่ ${dStr} ใช่หรือไม่?`)) {
                delete state.logsByDate[dStr];
                saveState();
                renderAll();
            }
        }

        function copyYesterdayMeals() {
            const d = new Date(state.selectedDate + 'T00:00:00');
            d.setDate(d.getDate() - 1);
            const offset = d.getTimezoneOffset() * 60000;
            const yStr = new Date(d.getTime() - offset).toISOString().split('T')[0];
            const yMeals = state.logsByDate[yStr] || [];
            if (yMeals.length === 0) {
                return alert(`ไม่มีรายการอาหารในวันที่ ${yStr} ให้คัดลอกครับ`);
            }
            if (!state.logsByDate[state.selectedDate]) state.logsByDate[state.selectedDate] = [];
            yMeals.forEach(m => {
                const portion = m.portion || 1;
                state.logsByDate[state.selectedDate].push({
                    ...m,
                    meal: m.meal || inferMealFromTime(m.time),
                    portion: portion,
                    baseCal: m.baseCal !== undefined ? m.baseCal : Math.round(m.cal / portion),
                    baseP: m.baseP !== undefined ? m.baseP : Math.round((m.p / portion) * 10) / 10,
                    baseC: m.baseC !== undefined ? m.baseC : Math.round((m.c / portion) * 10) / 10,
                    baseF: m.baseF !== undefined ? m.baseF : Math.round((m.f / portion) * 10) / 10,
                    id: Date.now().toString() + Math.random().toString(36).slice(2, 6)
                });
            });
            saveState();
            renderAll();
            showToast('📋 คัดลอกมื้ออาหารจากเมื่อวานเรียบร้อย');
        }

        function copyDailySummaryToClipboard() {
            const t = getCalculatedTargets();
            const dStr = state.selectedDate;
            const meals = state.logsByDate[dStr] || [];
            const sumP = Math.round(meals.reduce((s, m) => s + m.p, 0));
            const sumC = Math.round(meals.reduce((s, m) => s + m.c, 0));
            const sumF = Math.round(meals.reduce((s, m) => s + m.f, 0));
            const sumCal = Math.round(meals.reduce((s, m) => s + m.cal, 0));
            const remCal = t.targetCal - sumCal;

            const dayWorkouts = (state.workoutsByDate && state.workoutsByDate[dStr]) || [];
            const burnedCal = dayWorkouts.reduce((s, w) => s + w.cal, 0);
            const netCal = sumCal - burnedCal;

            const waterGlasses = state.waterByDate[dStr] || 0;
            const waterMl = waterGlasses * 250;

            const dateObj = new Date(dStr + 'T00:00:00');
            const thaiDate = dateObj.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

            let calStatus = '';
            if (remCal > 0) calStatus = `(ขาดอีก ${remCal.toLocaleString()} kcal)`;
            else if (remCal < 0) calStatus = `(เกินเป้า ${Math.abs(remCal).toLocaleString()} kcal)`;
            else calStatus = `(ครบเป๊ะ!)`;

            const mealGroups = {
                breakfast: [],
                lunch: [],
                dinner: [],
                snack: []
            };
            meals.forEach(m => {
                const k = m.meal && mealGroups[m.meal] ? m.meal : 'breakfast';
                mealGroups[k].push(m);
            });

            const formatMealLine = (key) => {
                const cfg = MEAL_CONFIG[key];
                const items = mealGroups[key];
                if (items.length === 0) return `${cfg.icon} ${cfg.name}: -`;
                const mealCal = Math.round(items.reduce((s, x) => s + x.cal, 0));
                const itemNames = items.map(x => `${x.name}${x.portion && x.portion !== 1 ? ` (x${x.portion})` : ''}`).join(', ');
                return `${cfg.icon} ${cfg.name} (${mealCal} kcal): ${itemNames}`;
            };

            const dayType = (state.dayTypeByDate && state.dayTypeByDate[dStr]) || 'training';
            const dayTypeLabel = dayType === 'rest' ? '🛋️ วันพัก (Rest Day • คาร์บ -15%)' : '🏋️ วันซ้อม (Training Day • มาตรฐาน)';

            const daySupps = (state.supplementsByDate && state.supplementsByDate[dStr]) || [];
            const allSupps = state.supplementList || [];
            let suppSummary = null;
            if (allSupps.length > 0) {
                const doneCount = allSupps.filter(s => daySupps.includes(s.id)).length;
                suppSummary = `💊 วิตามิน & อาหารเสริม: ${doneCount}/${allSupps.length} รายการ`;
            }

            const recordedWeight = state.weightsByDate && state.weightsByDate[dStr];

            const summaryLines = [
                `📊 บันทึกโภชนาการ NovaFit Pro (by BenzNova)`,
                `📅 วัน${thaiDate}`,
                `โหมด: ${dayTypeLabel}`,
                recordedWeight ? `⚖️ น้ำหนักวันนี้: ${recordedWeight} กก.` : null,
                `━━━━━━━━━━━━━━━━━━━━`,
                `🔥 แคลอรีทาน: ${sumCal.toLocaleString()} / ${t.targetCal.toLocaleString()} kcal ${calStatus}`,
                burnedCal > 0 ? `🏃 เบิร์นออกกำลัง: -${burnedCal.toLocaleString()} kcal (${dayWorkouts.map(w => w.name).join(', ')})` : null,
                burnedCal > 0 ? `🎯 แคลอรีสุทธิ (Net): ${netCal.toLocaleString()} kcal` : null,
                `🥩 โปรตีน: ${sumP} / ${t.pGram} g`,
                `🍚 คาร์โบไฮเดรต: ${sumC} / ${t.cGram} g`,
                `🥑 ไขมัน: ${sumF} / ${t.fGram} g`,
                `💧 น้ำดื่ม: ${waterGlasses} / ${t.waterTargetGlasses} แก้ว (${waterMl.toLocaleString()} / ${t.waterTargetMl.toLocaleString()} มล.)`,
                suppSummary,
                `━━━━━━━━━━━━━━━━━━━━`,
                `🍽️ รายการมื้ออาหาร:`,
                formatMealLine('breakfast'),
                formatMealLine('lunch'),
                formatMealLine('dinner'),
                formatMealLine('snack'),
                `━━━━━━━━━━━━━━━━━━━━`,
                `✨ บันทึกผ่าน NovaFit Pro • by BenzNova`
            ].filter(Boolean);

            const text = summaryLines.join('\n');

            const onCopySuccess = () => {
                showToast('📋 คัดลอกสรุปประจำวันแล้ว! ส่งเข้า LINE ได้ทันที');
            };

            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(onCopySuccess).catch(() => {
                    fallbackCopyText(text, onCopySuccess);
                });
            } else {
                fallbackCopyText(text, onCopySuccess);
            }
        }

        function fallbackCopyText(text, cb) {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            try {
                document.execCommand('copy');
                if (cb) cb();
            } catch (e) {
                alert('ไม่สามารถคัดลอกได้อัตโนมัติ กรุณาลองใหม่อีกครั้งครับ');
            }
            document.body.removeChild(textarea);
        }

        // Daily Deficit Report Modal (Includes Water Intake & Workouts)
        function openDailyReportModal() {
            const t = getCalculatedTargets();
            const dStr = state.selectedDate;
            const meals = state.logsByDate[dStr] || [];
            const sumP = Math.round(meals.reduce((s, m) => s + m.p, 0));
            const sumC = Math.round(meals.reduce((s, m) => s + m.c, 0));
            const sumF = Math.round(meals.reduce((s, m) => s + m.f, 0));
            const sumCal = Math.round(meals.reduce((s, m) => s + m.cal, 0));

            const dayWorkouts = (state.workoutsByDate && state.workoutsByDate[dStr]) || [];
            const burnedCal = dayWorkouts.reduce((s, w) => s + w.cal, 0);
            const netCal = sumCal - burnedCal;

            const waterGlasses = state.waterByDate[dStr] || 0;
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

            const recordedWeight = state.weightsByDate && state.weightsByDate[dStr];
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

            document.getElementById('dailyReportModalContent').innerHTML = `
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
            document.getElementById('dailyReportModal').classList.remove('hidden');
        }

        function closeDailyReportModal() {
            document.getElementById('dailyReportModal').classList.add('hidden');
        }

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
            if (e.target && e.target.id === 'changelogModal') {
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
            showToast('🚀 กำลังติดตั้งเวอร์ชันใหม่...');
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
            try {
                const res = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
                if (!res.ok) return;
                const meta = await res.json();
                if (meta && meta.version && meta.version !== APP_VERSION) {
                    showNewVersionBanner(meta.version);
                }
            } catch (e) {
                // Ignore fetch errors
            }
        }

        // ==========================================
        // Intermittent Fasting (IF) Timer Engine (v5.4.0)
        // ==========================================
        function getFastingPlanTargetHours(plan) {
            if (plan === '18:6') return 18;
            if (plan === '14:10') return 14;
            if (plan === '20:4') return 20;
            return 16; // default 16:8
        }

        function setFastingPlan(plan) {
            if (!state.fasting) state.fasting = {};
            state.fasting.plan = plan;
            state.fasting.targetHours = getFastingPlanTargetHours(plan);
            saveState();
            renderFastingSection();
            showToast(`⏱️ สลับแผนอดอาหารเป็น IF ${plan} (${state.fasting.targetHours} ชม.)`);
        }

        function toggleFastingTimer() {
            if (!state.fasting) state.fasting = { isFasting: false, plan: '16:8', targetHours: 16 };

            if (!state.fasting.isFasting) {
                state.fasting.isFasting = true;
                state.fasting.startTime = Date.now();
                state.fasting.endTime = null;
                saveState();
                renderFastingSection();
                showToast(`🔥 เริ่มนับเวลาอดอาหาร IF ${state.fasting.plan} แล้ว!`);
            } else {
                openFastingCompleteModal();
            }
        }

        function openFastingCompleteModal() {
            const modal = document.getElementById('fastingCompleteModal');
            if (!modal) return;
            if (!state.fasting || !state.fasting.startTime) return;

            const fasting = state.fasting;
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
            if (!state.fasting || !state.fasting.isFasting) {
                closeFastingCompleteModal();
                return;
            }
            const elapsedMs = Date.now() - (state.fasting.startTime || Date.now());
            const elapsedHours = Math.round((elapsedMs / (3600 * 1000)) * 10) / 10;

            state.fasting.isFasting = false;
            state.fasting.endTime = Date.now();
            if (!state.fasting.history) state.fasting.history = [];
            state.fasting.history.unshift({
                plan: state.fasting.plan || '16:8',
                startTime: state.fasting.startTime,
                endTime: state.fasting.endTime,
                elapsedHours
            });
            if (state.fasting.history.length > 20) state.fasting.history.pop();
            saveState();
            renderFastingSection();
            closeFastingCompleteModal();

            showToast(`🎉 สิ้นสุดการอดอาหาร! บันทึกประวัติสำเร็จ (${elapsedHours} ชม.)`);

            if (goToMeal) {
                if (typeof selectMealTab === 'function') {
                    selectMealTab('breakfast');
                }
                const foodSec = document.getElementById('foodSection');
                if (foodSec) {
                    foodSec.scrollIntoView({ behavior: 'smooth' });
                }
            }
        }

        function promptEditFastingStartTime() {
            if (!state.fasting || !state.fasting.isFasting || !state.fasting.startTime) return;
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
            saveState();
            renderFastingSection();
            showToast(`✏️ อัปเดตเวลาเริ่มอดอาหารเป็น ${targetDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} เรียบร้อย`);
        }

        let _lastFastingToggleTime = 0;
        function toggleFastingCollapse(forceState) {
            const now = Date.now();
            if (typeof forceState !== 'boolean' && now - _lastFastingToggleTime < 150) return;
            _lastFastingToggleTime = now;

            const body = document.getElementById('fastingPanelBody');
            const chevron = document.getElementById('fastingChevron');
            const label = document.getElementById('fastingCollapseLabel');
            if (!body) return;

            if (!state.collapsedSections) state.collapsedSections = {};

            let isCollapsed;
            if (typeof forceState === 'boolean') {
                isCollapsed = forceState;
            } else {
                isCollapsed = !body.classList.contains('hidden');
            }

            state.collapsedSections['fasting'] = isCollapsed;

            const panel = document.getElementById('fastingTimerPanel');
            let panelRectBefore = null;
            if (panel) {
                panelRectBefore = panel.getBoundingClientRect();
            }

            if (isCollapsed) {
                body.classList.add('hidden');
                if (chevron) chevron.textContent = '▼';
                if (label) label.textContent = 'แสดง';
                try { localStorage.setItem('novafit_fasting_collapsed', 'true'); } catch (e) {}
            } else {
                body.classList.remove('hidden');
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
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
                } catch (e) {}
            }, 100);
        }
        window.toggleFastingCollapse = toggleFastingCollapse;

        function updateFastingTimerClock() {
            if (!state.fasting || !state.fasting.isFasting) return;

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
        window.updateFastingTimerClock = updateFastingTimerClock;

        function renderFastingSection() {
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
                bodyEl.classList.toggle('hidden', isCollapsed);
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
            if (state.fasting && state.fasting.isFasting) {
                updateFastingTimerClock();
            }
        }, 1000);

        function updateVersionBadges() {
            const hBadge = document.getElementById('headerVersionBadge');
            if (hBadge) hBadge.textContent = `🚀 v${APP_VERSION}`;
            const tBadge = document.getElementById('toolsVersionBadge');
            if (tBadge) tBadge.innerHTML = `<span>🚀</span> ประวัติอัปเดต (v${APP_VERSION})`;
            const alertText = document.getElementById('whatsNewAlertText');
            if (alertText) alertText.textContent = `ยินดีต้อนรับสู่ NovaFit Pro v${APP_VERSION}!`;
        }

        function checkFirstVisitVersionNotes() {
            const LAST_SEEN_KEY = 'novafit_last_seen_version';
            const lastSeen = localStorage.getItem(LAST_SEEN_KEY);
            updateVersionBadges();
            if (lastSeen !== APP_VERSION) {
                localStorage.setItem(LAST_SEEN_KEY, APP_VERSION);
                setTimeout(() => {
                    showToast(`🚀 อัปเดตสู่ NovaFit Pro v${APP_VERSION} เรียบร้อย!`, 4000);
                    if (lastSeen) {
                        openChangelogModal(true);
                    }
                }, 800);
            }
        }

        // ==========================================
        // VISUAL SHARE CARD (Phase 3 - Canvas Engine)
        // ==========================================
        function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
            ctx.beginPath();
            ctx.moveTo(x + radius, y);
            ctx.lineTo(x + width - radius, y);
            ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
            ctx.lineTo(x + width, y + height - radius);
            ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
            ctx.lineTo(x + radius, y + height);
            ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
            ctx.lineTo(x, y + radius);
            ctx.quadraticCurveTo(x, y, x + radius, y);
            ctx.closePath();
            if (fill) ctx.fill();
            if (stroke) ctx.stroke();
        }

        function fitText(ctx, text, maxWidth) {
            if (!text) return '';
            if (ctx.measureText(text).width <= maxWidth) return text;
            let t = text;
            while (t.length > 0 && ctx.measureText(t + '...').width > maxWidth) {
                t = t.slice(0, -1);
            }
            return t + '...';
        }

        async function openShareCardModal() {
            document.getElementById('shareCardModal').classList.remove('hidden');
            if (document.fonts && document.fonts.ready) {
                try { await document.fonts.ready; } catch (e) { }
            }
            renderShareCard();

            // Check Web Share API support
            const btnShare = document.getElementById('btnShareCardNative');
            if (navigator.canShare && navigator.share) {
                btnShare.classList.remove('hidden');
                btnShare.classList.add('flex');
            } else {
                btnShare.classList.add('hidden');
                btnShare.classList.remove('flex');
            }
        }

        function closeShareCardModal() {
            document.getElementById('shareCardModal').classList.add('hidden');
        }

        function renderShareCard() {
            const canvas = document.getElementById('shareCardCanvas');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            const W = 1080;
            const H = 1420;
            canvas.width = W;
            canvas.height = H;

            const t = getCalculatedTargets();
            const dStr = state.selectedDate;
            const meals = state.logsByDate[dStr] || [];
            const sumP = Math.round(meals.reduce((s, m) => s + m.p, 0));
            const sumC = Math.round(meals.reduce((s, m) => s + m.c, 0));
            const sumF = Math.round(meals.reduce((s, m) => s + m.f, 0));
            const sumCal = Math.round(meals.reduce((s, m) => s + m.cal, 0));
            const remCal = t.targetCal - sumCal;

            const dayWorkouts = (state.workoutsByDate && state.workoutsByDate[dStr]) || [];
            const burnedCal = dayWorkouts.reduce((s, w) => s + w.cal, 0);
            const netCal = sumCal - burnedCal;

            const waterGlasses = state.waterByDate[dStr] || 0;
            const waterMl = waterGlasses * 250;
            const recordedWeight = state.weightsByDate && state.weightsByDate[dStr];

            const dateObj = new Date(dStr + 'T00:00:00');
            const thaiDate = dateObj.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

            // 1. Dark Background with subtle ambient gradient
            const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
            bgGrad.addColorStop(0, '#090e17');
            bgGrad.addColorStop(0.5, '#0f172a');
            bgGrad.addColorStop(1, '#090e17');
            ctx.fillStyle = bgGrad;
            ctx.fillRect(0, 0, W, H);

            // Ambient Glow Top-Right (Emerald)
            const glow1 = ctx.createRadialGradient(880, 160, 20, 880, 160, 480);
            glow1.addColorStop(0, 'rgba(16, 185, 129, 0.22)');
            glow1.addColorStop(1, 'rgba(16, 185, 129, 0)');
            ctx.fillStyle = glow1;
            ctx.fillRect(400, 0, W - 400, 600);

            // Ambient Glow Bottom-Left (Cyan)
            const glow2 = ctx.createRadialGradient(200, 1260, 20, 200, 1260, 520);
            glow2.addColorStop(0, 'rgba(6, 182, 212, 0.16)');
            glow2.addColorStop(1, 'rgba(6, 182, 212, 0)');
            ctx.fillStyle = glow2;
            ctx.fillRect(0, 800, 700, 620);

            // Card Outer Border
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
            ctx.lineWidth = 2;
            roundRect(ctx, 24, 24, W - 48, H - 48, 36, false, true);

            // 2. Header
            // NovaFit Pro App Logo Box
            const logoGrad = ctx.createLinearGradient(60, 60, 120, 120);
            logoGrad.addColorStop(0, '#10b981');
            logoGrad.addColorStop(0.5, '#06b6d4');
            logoGrad.addColorStop(1, '#6366f1');
            ctx.fillStyle = logoGrad;
            roundRect(ctx, 60, 60, 56, 56, 16, true, false);

            // Draw Nova Star + Bolt Icon on Canvas
            ctx.save();
            ctx.translate(88, 88);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(0, 0, 20, 0, Math.PI * 2);
            ctx.stroke();

            // 4-point curved Nova star
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(0, -17);
            ctx.bezierCurveTo(0, -6, 6, 0, 17, 0);
            ctx.bezierCurveTo(6, 0, 0, 6, 0, 17);
            ctx.bezierCurveTo(0, 6, -6, 0, -17, 0);
            ctx.bezierCurveTo(-6, 0, 0, -6, 0, -17);
            ctx.closePath();
            ctx.fill();

            // Golden Lightning Bolt Core
            ctx.fillStyle = '#fde047';
            ctx.beginPath();
            ctx.moveTo(2, -9);
            ctx.lineTo(-5, 1);
            ctx.lineTo(1, 1);
            ctx.lineTo(-2, 10);
            ctx.lineTo(6, -1);
            ctx.lineTo(0, -1);
            ctx.closePath();
            ctx.fill();
            ctx.restore();

            // Title & Subtitle
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
            ctx.font = 'bold 34px Prompt, sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.fillText('NovaFit Pro', 132, 90);

            ctx.font = 'bold 12px Prompt, sans-serif';
            ctx.fillStyle = '#06b6d4';
            ctx.fillText('SMART NUTRITION & MACRO REPORT  •  BY BENZNOVA', 134, 114);

            // Date Tag & Day Type Badge
            const dayType = (state.dayTypeByDate && state.dayTypeByDate[dStr]) || 'training';
            const dayTypeTag = dayType === 'rest' ? '🛋️ วันพัก (Rest Day)' : '🏋️ วันซ้อม (Training Day)';
            ctx.font = '500 20px Prompt, sans-serif';
            ctx.fillStyle = '#94a3b8';
            ctx.fillText(`📅 ${thaiDate}  •  ${dayTypeTag}`, 60, 150);

            // Weight Pill (if recorded)
            if (recordedWeight) {
                const wText = `⚖️ น้ำหนัก: ${recordedWeight} กก.`;
                ctx.font = 'bold 18px Prompt, sans-serif';
                const pillW = ctx.measureText(wText).width + 32;
                ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
                ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
                ctx.lineWidth = 1.5;
                roundRect(ctx, W - 60 - pillW, 60, pillW, 46, 23, true, true);
                ctx.fillStyle = '#34d399';
                ctx.textAlign = 'center';
                ctx.fillText(wText, W - 60 - pillW / 2, 85);
            }

            // 3. Calorie Hero Container
            const heroX = 60, heroY = 175, heroW = 960, heroH = 265;
            ctx.fillStyle = 'rgba(30, 41, 59, 0.65)';
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.lineWidth = 1.5;
            roundRect(ctx, heroX, heroY, heroW, heroH, 28, true, true);

            // Donut Chart on Left (Center: X: 195, Y: 307, Radius: 82, LineWidth: 18)
            const cx = 195, cy = 307, cr = 82;
            const pctVal = t.targetCal > 0 ? (sumCal / t.targetCal) : 0;

            // Background Ring
            ctx.beginPath();
            ctx.arc(cx, cy, cr, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
            ctx.lineWidth = 18;
            ctx.lineCap = 'round';
            ctx.stroke();

            // Progress Arc
            if (pctVal > 0) {
                const startAngle = -Math.PI / 2;
                const endAngle = startAngle + Math.min(Math.PI * 2, Math.PI * 2 * pctVal);
                const arcGrad = ctx.createLinearGradient(cx - cr, cy, cx + cr, cy);
                arcGrad.addColorStop(0, '#10b981');
                arcGrad.addColorStop(1, '#06b6d4');
                ctx.beginPath();
                ctx.arc(cx, cy, cr, startAngle, endAngle);
                ctx.strokeStyle = arcGrad;
                ctx.lineWidth = 18;
                ctx.lineCap = 'round';
                ctx.stroke();
            }

            // Donut Center Text
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = 'bold 44px Prompt, sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.fillText(`${Math.round(pctVal * 100)}%`, cx, cy - 8);

            ctx.font = 'bold 13px Prompt, sans-serif';
            ctx.fillStyle = '#94a3b8';
            ctx.fillText('OF GOAL', cx, cy + 26);

            // Calorie Text Stats on Right (x: 320)
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.font = 'bold 18px Prompt, sans-serif';
            ctx.fillStyle = '#94a3b8';
            ctx.fillText('พลังงานที่ทานวันนี้ (Calories)', 320, 205);

            ctx.font = 'bold 54px Prompt, sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.fillText(sumCal.toLocaleString(), 320, 235);

            const calW = ctx.measureText(sumCal.toLocaleString()).width;
            ctx.font = 'bold 24px Prompt, sans-serif';
            ctx.fillStyle = '#94a3b8';
            ctx.fillText(` / ${t.targetCal.toLocaleString()} kcal`, 320 + calW + 6, 260);

            // Status Badge Pill
            let statusText = '';
            let statusBg = 'rgba(16, 185, 129, 0.2)';
            let statusBorder = 'rgba(16, 185, 129, 0.4)';
            let statusColor = '#34d399';

            if (sumCal === 0) {
                statusText = '⏳ ยังไม่ได้เริ่มบันทึกมื้ออาหาร';
                statusBg = 'rgba(148, 163, 184, 0.15)';
                statusBorder = 'rgba(148, 163, 184, 0.3)';
                statusColor = '#94a3b8';
            } else if (Math.abs(remCal) <= 150) {
                statusText = '🎯 พลังงานถึงเป้าหมายพอดีเป๊ะ!';
            } else if (remCal > 150) {
                statusText = `⚡ ขาดอีก ${remCal.toLocaleString()} kcal เพื่อถึงเป้า`;
                statusBg = 'rgba(245, 158, 11, 0.15)';
                statusBorder = 'rgba(245, 158, 11, 0.4)';
                statusColor = '#fbbf24';
            } else {
                statusText = `🔥 เกินเป้าหมาย ${Math.abs(remCal).toLocaleString()} kcal`;
                statusBg = 'rgba(244, 63, 94, 0.15)';
                statusBorder = 'rgba(244, 63, 94, 0.4)';
                statusColor = '#fb7185';
            }

            ctx.font = 'bold 17px Prompt, sans-serif';
            const sWidth = ctx.measureText(statusText).width + 30;
            ctx.fillStyle = statusBg;
            ctx.strokeStyle = statusBorder;
            ctx.lineWidth = 1.2;
            roundRect(ctx, 320, 312, sWidth, 38, 19, true, true);

            ctx.fillStyle = statusColor;
            ctx.fillText(statusText, 335, 321);

            // Workout burned info row if burnedCal > 0
            if (burnedCal > 0) {
                const wLine = `🔥 เบิร์นออกกำลัง -${burnedCal.toLocaleString()} kcal  •  แคลอรีสุทธิ (Net): ${netCal.toLocaleString()} kcal`;
                ctx.font = '600 16px Prompt, sans-serif';
                ctx.fillStyle = '#fb923c';
                ctx.fillText(wLine, 322, 365);
            }

            // 4. Three Macro Cards (Y: 460 - 640)
            const macroY = 460, macroW = 308, macroH = 175, gap = 18;
            const macros = [
                {
                    name: '🥩 โปรตีน (Protein)',
                    gram: sumP,
                    target: t.pGram,
                    cal: Math.round(sumP * 4),
                    pct: t.pGram > 0 ? Math.min(100, Math.round((sumP / t.pGram) * 100)) : 0,
                    bg: 'rgba(59, 130, 246, 0.08)',
                    border: 'rgba(59, 130, 246, 0.28)',
                    color: '#60a5fa',
                    barColor: '#3b82f6'
                },
                {
                    name: '🍚 คาร์บ (Carbs)',
                    gram: sumC,
                    target: t.cGram,
                    cal: Math.round(sumC * 4),
                    pct: t.cGram > 0 ? Math.min(100, Math.round((sumC / t.cGram) * 100)) : 0,
                    bg: 'rgba(245, 158, 11, 0.08)',
                    border: 'rgba(245, 158, 11, 0.28)',
                    color: '#fbbf24',
                    barColor: '#f59e0b'
                },
                {
                    name: '🥑 ไขมัน (Fat)',
                    gram: sumF,
                    target: t.fGram,
                    cal: Math.round(sumF * 9),
                    pct: t.fGram > 0 ? Math.min(100, Math.round((sumF / t.fGram) * 100)) : 0,
                    bg: 'rgba(244, 63, 94, 0.08)',
                    border: 'rgba(244, 63, 94, 0.28)',
                    color: '#fb7185',
                    barColor: '#f43f5e'
                }
            ];

            macros.forEach((m, idx) => {
                const mx = heroX + idx * (macroW + gap);
                ctx.fillStyle = m.bg;
                ctx.strokeStyle = m.border;
                ctx.lineWidth = 1.5;
                roundRect(ctx, mx, macroY, macroW, macroH, 22, true, true);

                // Title
                ctx.textAlign = 'left';
                ctx.textBaseline = 'top';
                ctx.font = 'bold 18px Prompt, sans-serif';
                ctx.fillStyle = m.color;
                ctx.fillText(m.name, mx + 20, macroY + 18);

                // Grams
                ctx.font = 'bold 38px Prompt, sans-serif';
                ctx.fillStyle = '#ffffff';
                ctx.fillText(`${m.gram}g`, mx + 20, macroY + 48);

                const gW = ctx.measureText(`${m.gram}g`).width;
                ctx.font = 'bold 18px Prompt, sans-serif';
                ctx.fillStyle = '#94a3b8';
                ctx.fillText(` / ${m.target}g`, mx + 20 + gW + 4, macroY + 64);

                // Progress Bar
                const barW = macroW - 40;
                const fillW = Math.max(4, Math.min(barW, Math.round((m.pct / 100) * barW)));
                ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
                roundRect(ctx, mx + 20, macroY + 104, barW, 8, 4, true, false);

                ctx.fillStyle = m.barColor;
                roundRect(ctx, mx + 20, macroY + 104, fillW, 8, 4, true, false);

                // Meta row
                ctx.font = '500 15px Prompt, sans-serif';
                ctx.fillStyle = '#94a3b8';
                ctx.fillText(`${m.cal} kcal`, mx + 20, macroY + 126);

                ctx.textAlign = 'right';
                ctx.fillStyle = m.color;
                ctx.fillText(`${m.pct}%`, mx + macroW - 20, macroY + 126);
            });

            // 5. Water Hydration Bar (Y: 655 - 745)
            const waterY = 655, waterW = 960, waterH = 88;
            ctx.fillStyle = 'rgba(14, 165, 233, 0.08)';
            ctx.strokeStyle = 'rgba(14, 165, 233, 0.28)';
            ctx.lineWidth = 1.5;
            roundRect(ctx, heroX, waterY, waterW, waterH, 22, true, true);

            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.font = 'bold 20px Prompt, sans-serif';
            ctx.fillStyle = '#38bdf8';
            ctx.fillText('💧 น้ำดื่มสะอาด (Water Intake)', heroX + 22, waterY + 32);

            ctx.textAlign = 'right';
            ctx.font = 'bold 20px Prompt, sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.fillText(`${waterGlasses} / ${t.waterTargetGlasses} แก้ว  (${waterMl.toLocaleString()} / ${t.waterTargetMl.toLocaleString()} มล.)`, heroX + waterW - 22, waterY + 32);

            // Water bar
            const wPct = t.waterTargetGlasses > 0 ? Math.min(100, Math.round((waterGlasses / t.waterTargetGlasses) * 100)) : 0;
            const wBarW = waterW - 44;
            const wFillW = Math.max(4, Math.min(wBarW, Math.round((wPct / 100) * wBarW)));

            ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
            roundRect(ctx, heroX + 22, waterY + 60, wBarW, 8, 4, true, false);

            const waterGrad = ctx.createLinearGradient(heroX + 22, waterY + 60, heroX + 22 + wBarW, waterY + 60);
            waterGrad.addColorStop(0, '#38bdf8');
            waterGrad.addColorStop(1, '#0284c7');
            ctx.fillStyle = waterGrad;
            roundRect(ctx, heroX + 22, waterY + 60, wFillW, 8, 4, true, false);

            // 6. Four Meals Summary Box (Y: 760 - 1285)
            const mealsY = 760, mealsW = 960, mealsH = 525;
            ctx.fillStyle = 'rgba(30, 41, 59, 0.65)';
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.lineWidth = 1.5;
            roundRect(ctx, heroX, mealsY, mealsW, mealsH, 28, true, true);

            // Header of meals box
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.font = 'bold 22px Prompt, sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.fillText('🍽️ บันทึก 4 มื้ออาหารวันนี้ (Meals Summary)', heroX + 24, mealsY + 22);

            ctx.textAlign = 'right';
            ctx.font = 'bold 16px Prompt, sans-serif';
            ctx.fillStyle = '#10b981';
            ctx.fillText(`รวมทั้งหมด ${meals.length} รายการ`, heroX + mealsW - 24, mealsY + 25);

            // Group meals
            const mealGroups = {
                breakfast: { name: '🌅 มื้อเช้า', items: [] },
                lunch: { name: '☀️ มื้อเที่ยง', items: [] },
                dinner: { name: '🌙 มื้อเย็น', items: [] },
                snack: { name: '🍎 ของว่าง', items: [] }
            };
            meals.forEach(m => {
                const k = m.meal && mealGroups[m.meal] ? m.meal : 'breakfast';
                mealGroups[k].items.push(m);
            });

            const mealKeys = ['breakfast', 'lunch', 'dinner', 'snack'];
            const rowH = 96, rowGap = 12;

            mealKeys.forEach((k, idx) => {
                const grp = mealGroups[k];
                const ry = mealsY + 68 + idx * (rowH + rowGap);
                const rw = mealsW - 48;
                const rx = heroX + 24;

                ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
                ctx.lineWidth = 1;
                roundRect(ctx, rx, ry, rw, rowH, 18, true, true);

                const grpCal = Math.round(grp.items.reduce((s, x) => s + x.cal, 0));

                // Meal title
                ctx.textAlign = 'left';
                ctx.textBaseline = 'top';
                ctx.font = 'bold 20px Prompt, sans-serif';
                ctx.fillStyle = '#ffffff';
                ctx.fillText(grp.name, rx + 18, ry + 16);

                // Meal Calorie Pill
                const calStr = `${grpCal} kcal`;
                ctx.font = 'bold 16px Prompt, sans-serif';
                const calPillW = ctx.measureText(calStr).width + 24;
                ctx.fillStyle = grpCal > 0 ? 'rgba(16, 185, 129, 0.18)' : 'rgba(148, 163, 184, 0.1)';
                ctx.strokeStyle = grpCal > 0 ? 'rgba(16, 185, 129, 0.35)' : 'rgba(148, 163, 184, 0.2)';
                ctx.lineWidth = 1;
                roundRect(ctx, rx + rw - calPillW - 18, ry + 14, calPillW, 30, 15, true, true);

                ctx.textAlign = 'center';
                ctx.fillStyle = grpCal > 0 ? '#34d399' : '#94a3b8';
                ctx.fillText(calStr, rx + rw - calPillW / 2 - 18, ry + 20);

                // Food Items text line
                ctx.textAlign = 'left';
                ctx.font = '400 16px Prompt, sans-serif';
                if (grp.items.length === 0) {
                    ctx.fillStyle = '#64748b';
                    ctx.fillText('— ยังไม่ได้บันทึกรายการในมื้อนี้ —', rx + 18, ry + 56);
                } else {
                    const itemStrs = grp.items.map(x => `${x.name}${x.portion && x.portion !== 1 ? ` (x${x.portion})` : ''}`);
                    const joined = fitText(ctx, itemStrs.join(', '), rw - 36);
                    ctx.fillStyle = '#cbd5e1';
                    ctx.fillText(joined, rx + 18, ry + 56);
                }
            });

            // 7. Footer (Y: 1305 - 1380)
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(heroX, 1315);
            ctx.lineTo(heroX + heroW, 1315);
            ctx.stroke();

            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.font = '500 16px Prompt, sans-serif';
            ctx.fillStyle = '#64748b';
            ctx.fillText('✨ NovaFit Pro • สุขภาพและรูปร่างที่ดีสร้างได้ทุกวัน', heroX, 1350);

            ctx.textAlign = 'right';
            ctx.font = 'bold 16px Prompt, sans-serif';
            ctx.fillStyle = '#10b981';
            ctx.fillText('novafit-pro • by BenzNova', heroX + heroW, 1350);
        }

        function downloadShareCard() {
            const canvas = document.getElementById('shareCardCanvas');
            if (!canvas) return;
            const dStr = state.selectedDate || getTodayStr();
            canvas.toBlob(blob => {
                if (!blob) return;
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `novafit-summary-${dStr}.png`;
                a.click();
                URL.revokeObjectURL(url);
                showToast('📸 ดาวน์โหลดการ์ดรูปภาพสำเร็จแล้ว!');
            }, 'image/png');
        }

        async function copyShareCardImage() {
            const canvas = document.getElementById('shareCardCanvas');
            if (!canvas) return;
            if (!navigator.clipboard || !window.ClipboardItem) {
                downloadShareCard();
                return;
            }
            try {
                canvas.toBlob(async blob => {
                    if (!blob) return;
                    try {
                        await navigator.clipboard.write([
                            new ClipboardItem({ 'image/png': blob })
                        ]);
                        showToast('📋 คัดลอกรูปภาพแล้ว! กด Paste (วาง) ใน LINE ได้ทันที');
                    } catch (err) {
                        console.warn('Clipboard write failed, downloading instead:', err);
                        downloadShareCard();
                    }
                }, 'image/png');
            } catch (e) {
                downloadShareCard();
            }
        }

        async function shareCardNative() {
            const canvas = document.getElementById('shareCardCanvas');
            if (!canvas) return;
            const dStr = state.selectedDate || getTodayStr();
            if (!navigator.canShare || !navigator.share) {
                downloadShareCard();
                return;
            }
            canvas.toBlob(async blob => {
                if (!blob) return;
                try {
                    const file = new File([blob], `novafit-summary-${dStr}.png`, { type: 'image/png' });
                    if (navigator.canShare({ files: [file] })) {
                        await navigator.share({
                            files: [file],
                            title: 'สรุปโภชนาการ NovaFit Pro',
                            text: `สรุปโภชนาการและแคลอรีวันที่ ${dStr} ผ่าน NovaFit Pro (by BenzNova)`
                        });
                    } else {
                        downloadShareCard();
                    }
                } catch (err) {
                    if (err.name !== 'AbortError') {
                        downloadShareCard();
                    }
                }
            }, 'image/png');
        }

        function exportData() {
            const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `novafit-pro-v5.1-backup-${getTodayStr()}.json`;
            a.click();
            URL.revokeObjectURL(url);
        }

        function importData(event) {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const imported = JSON.parse(e.target.result);
                    if (imported && imported.profile) {
                        state = { ...state, ...imported, version: APP_VERSION };
                        saveState();
                        renderAll();
                        showToast('นำเข้าข้อมูลสำเร็จเรียบร้อยครับ!');
                    } else {
                        alert('รูปแบบไฟล์ JSON ไม่ถูกต้องครับ');
                    }
                } catch (err) {
                    alert('ไม่สามารถอ่านไฟล์ JSON ได้ครับ');
                }
            };
            reader.readAsText(file);
        }

        function resetAllData() {
            if (confirm('ต้องการล้างข้อมูลทั้งหมดในเครื่อง (รวมถึงประวัติทุกวัน) เพื่อเริ่มต้นใหม่ใช่หรือไม่?')) {
                localStorage.removeItem(STORAGE_KEY);
                location.reload();
            }
        }

        // --- PWA Installation & Service Worker Integration ---
        let deferredPwaPrompt = null;
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPwaPrompt = e;
            const btn = document.getElementById('btnPwaInstall');
            if (btn) {
                btn.classList.add('ring-2', 'ring-indigo-400', 'animate-pulse');
            }
        });

        window.addEventListener('appinstalled', () => {
            deferredPwaPrompt = null;
            showToast('🎉 ติดตั้ง NovaFit Pro สำเร็จแล้ว! เปิดใช้งานจากหน้าจอโฮมได้เลย');
            const btn = document.getElementById('btnPwaInstall');
            if (btn) btn.style.display = 'none';
        });

        function handlePwaInstallClick() {
            if (deferredPwaPrompt) {
                deferredPwaPrompt.prompt();
                deferredPwaPrompt.userChoice.then((choiceResult) => {
                    if (choiceResult.outcome === 'accepted') {
                        showToast('กำลังติดตั้ง NovaFit Pro ลงในอุปกรณ์ของคุณ...');
                    }
                    deferredPwaPrompt = null;
                });
            } else {
                const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
                if (isIos) {
                    alert('📱 วิธีติดตั้ง NovaFit Pro บน iPhone / iPad (Safari):\n\n1. แตะปุ่มแชร์ ⎋ (Share) ด้านล่างของ Safari\n2. เลื่อนลงแล้วเลือก "เพิ่มไปยังหน้าจอโฮม" (Add to Home Screen)\n3. แตะ "เพิ่ม" (Add)\n\nคุณจะได้แอป NovaFit Pro แบบเต็มจอ ใช้งานออฟไลน์ได้ 100%!');
                } else {
                    alert('📱 วิธีติดตั้ง NovaFit Pro (PWA):\n\n• หากใช้งาน Google Chrome / Edge: กดจุด 3 จุด (⋮) ด้านขวาบน แล้วเลือก "ติดตั้งแอป" หรือ "เพิ่มไปยังหน้าจอหลัก"\n• แอปจะถูกติดตั้งลงอุปกรณ์ ใช้งานแบบเต็มจอและเปิดได้แม้อยู่นอกสัญญาณเน็ต!');
                }
            }
        }

        // Register Service Worker & handle clean update workflow
        if ('serviceWorker' in navigator) {
            let refreshing = false;
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (!refreshing && window._swManualUpdateTriggered) {
                    refreshing = true;
                    window.location.reload();
                }
            });
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('./sw.js').then((reg) => {
                    console.log('NovaFit Pro SW registered:', reg.scope);
                }).catch((err) => {
                    console.warn('NovaFit Pro SW registration failed:', err);
                });
            });
        }

        window.addEventListener('resize', syncResponsiveLayout);

        loadState();
        renderAll();
        checkFirstVisitProfilePrompt();
        checkFirstVisitVersionNotes();
        // Expose globals for Firebase Module integration
        window.state = state;
        window.APP_VERSION = APP_VERSION;
        window.STORAGE_KEY = STORAGE_KEY;
        window.renderAll = renderAll;
        window.showToast = showToast;
        window.saveState = saveState;
        window.toggleToolsMenu = toggleToolsMenu;
        window.toggleCardSection = toggleCardSection;
        window.renderAllSectionCollapses = renderAllSectionCollapses;
        window.syncResponsiveLayout = syncResponsiveLayout;
        window.checkDayRollover = checkDayRollover;
        window.checkFirstVisitProfilePrompt = checkFirstVisitProfilePrompt;
        window.addFoodItem = addFoodItem;
        window.removeFoodItem = removeFoodItem;
        window.changeMealCategory = changeMealCategory;

        // Directly updates lexical state and re-renders UI across all components
        window.applyCloudState = function (cloudState) {
            if (!cloudState || typeof cloudState !== 'object') return;
            const currentSelectedDate = state.selectedDate;
            const currentActiveMeal = state.activeMeal;
            state = {
                ...state,
                ...cloudState,
                selectedDate: currentSelectedDate,
                activeMeal: currentActiveMeal,
                version: APP_VERSION
            };
            window.state = state;
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            } catch (e) { }
            renderAll();
        };

        // Check for updates and new day rollover initially and periodically
        setTimeout(checkForAppUpdates, 2500);
        setInterval(checkForAppUpdates, 180000); // Check every 3 mins
        setInterval(checkDayRollover, 30000); // Check for new day every 30s
        window.addEventListener('focus', checkDayRollover);
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                checkForAppUpdates();
                checkDayRollover();
            }
        });

        // Close Dropdown Menus when clicking outside
        document.addEventListener('click', (e) => {
            const btn = document.getElementById('btnToolsMenu');
            const menu = document.getElementById('toolsDropdownMenu');
            if (btn && menu && !btn.contains(e.target) && !menu.contains(e.target)) {
                menu.classList.add('hidden');
            }

            const pillUser = document.getElementById('userProfilePill');
            const menuUser = document.getElementById('userDropdown');
            if (pillUser && menuUser && !pillUser.contains(e.target) && !menuUser.contains(e.target)) {
                menuUser.classList.add('hidden');
            }
        });

        // Close Modals on Escape Key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeChangelogModal();
                closeDailyReportModal();
                closeShareCardModal();
                closeAddSupplementModal();
            }
        });

// ==========================================
// NEW v5.3.1: APPLE-GRADE SMOOTH MODALS & PROFILE DRAWER
// ==========================================

function openModalAnimated(modalId, onOpened) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
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
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.style.display = 'none';
        document.body.style.overflow = '';
        if (typeof onClosed === 'function') onClosed();
    }, 280);
}

function openProfileSettingsModal() {
    openModalAnimated('profileSettingsModal');
}

function closeProfileSettingsModal() {
    closeModalAnimated('profileSettingsModal');
    state.profileConfigured = true;
    localStorage.setItem('novafit_profile_prompted', 'true');
    if (window.currentUser) {
        localStorage.setItem('novafit_profile_prompted_' + window.currentUser.uid, 'true');
        if (window.saveProfileConfiguredToCloud) {
            window.saveProfileConfiguredToCloud();
        } else if (window.triggerCloudSync) {
            window.triggerCloudSync(true);
        }
    }
    saveState();
}

function checkFirstVisitProfilePrompt() {
    const hasPrompted = localStorage.getItem('novafit_profile_prompted');
    if (!hasPrompted && window._isFirstTimeVisitor) {
        localStorage.setItem('novafit_profile_prompted', 'true');
        setTimeout(() => {
            openProfileSettingsModal();
            showToast('👋 ยินดีต้อนรับสู่ NovaFit Pro! กรุณากรอกข้อมูลร่างกายเพื่อเริ่มต้นใช้งาน');
        }, 500);
    }
}

function checkDayRollover() {
    const todayStr = getTodayStr();
    if (state.lastActiveDate && state.lastActiveDate !== todayStr) {
        console.log('🌅 New day detected! Auto-switching to:', todayStr, 'with breakfast active');
        state.lastActiveDate = todayStr;
        state.selectedDate = todayStr;
        state.activeMeal = 'breakfast';
        saveState();
        renderAll();
        showToast('🌅 อรุณสวัสดิ์วันใหม่! สลับไปมื้อเช้าให้อัตโนมัติแล้ว');
    }
}

function closeProfileSettingsOnBackdrop(e) {
    if (e && e.target && e.target.id === 'profileSettingsModal') {
        closeProfileSettingsModal();
    }
}

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

    const mealKey = state.activeMeal || "breakfast";
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

    const dStr = state.selectedDate;
    if (!state.logsByDate) state.logsByDate = {};
    if (!state.logsByDate[dStr]) state.logsByDate[dStr] = [];
    state.logsByDate[dStr].push(quickItem);

    saveState();
    closeQuickAddModal();
    renderAll();
    showToast(`⚡ บันทึก "${name}" (${quickItem.cal} kcal) ลงใน${MEAL_CONFIG[mealKey]?.name || "มื้อนี้"}แล้ว`);
}

function copyYesterdayActiveMeal() {
    const mealKey = state.activeMeal || "breakfast";
    copyMealFromYesterday(mealKey);
}

// Ensure state and core handlers are attached to window
window.state = state;
window.openProfileSettingsModal = openProfileSettingsModal;
window.closeProfileSettingsModal = closeProfileSettingsModal;
window.closeProfileSettingsOnBackdrop = closeProfileSettingsOnBackdrop;
window.openQuickAddModal = openQuickAddModal;
window.closeQuickAddModal = closeQuickAddModal;
window.closeQuickAddOnBackdrop = closeQuickAddOnBackdrop;
window.submitQuickAddMeal = submitQuickAddMeal;
window.copyYesterdayActiveMeal = copyYesterdayActiveMeal;
window.openFoodMealPicker = openFoodMealPicker;
window.closeFoodMealPickerModal = closeFoodMealPickerModal;
window.closeFoodMealPickerOnBackdrop = closeFoodMealPickerOnBackdrop;
window.setFoodPickerPortion = setFoodPickerPortion;
window.submitFoodMealPicker = submitFoodMealPicker;
window.getFastingPlanTargetHours = getFastingPlanTargetHours;
window.setFastingPlan = setFastingPlan;
window.toggleFastingTimer = toggleFastingTimer;
window.openFastingCompleteModal = openFastingCompleteModal;
window.closeFastingCompleteModal = closeFastingCompleteModal;
window.confirmFinishFasting = confirmFinishFasting;
window.promptEditFastingStartTime = promptEditFastingStartTime;
window.renderFastingSection = renderFastingSection;
window.updateVersionBadges = updateVersionBadges;
window.renderSupplements = renderSupplements;
window.toggleSupplement = toggleSupplement;
window.openAddSupplementModal = openAddSupplementModal;
window.closeAddSupplementModal = closeAddSupplementModal;
window.closeAddSupplementModalOnBackdrop = closeAddSupplementModalOnBackdrop;
window.submitNewSupplement = submitNewSupplement;
window.deleteSupplement = deleteSupplement;
window.deleteCustomSupplement = deleteCustomSupplement;
window.restoreDefaultSupplements = restoreDefaultSupplements;
