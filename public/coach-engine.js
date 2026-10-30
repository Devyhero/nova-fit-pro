/**
 * NovaFit Pro - Smart Coach Recommendations Engine (v5.9.30)
 * Analyzes remaining macronutrient gaps (calories, protein, carbs, fat),
 * produces clinical heuristic advice and Gemini AI multi-modal meal suggestions,
 * and renders interactive food suggestion cards.
 */

(function () {
    'use strict';

    let _aiCoachAnalysisCache = {};
    let _isAiCoachLoading = false;

    // Safe inter-module helpers
    function getAppStateSafe() {
        return (typeof window !== 'undefined' && window.state) ? window.state : (typeof state !== 'undefined' ? state : null);
    }

    function getCalculatedTargetsSafe(dateStr) {
        if (typeof getCalculatedTargets === 'function') return getCalculatedTargets(dateStr);
        if (typeof window.getCalculatedTargets === 'function') return window.getCalculatedTargets(dateStr);
        return null;
    }

    function showToastSafe(msg) {
        if (typeof showToast === 'function') return showToast(msg);
        if (typeof window.showToast === 'function') return window.showToast(msg);
    }

    function getFoodDatabaseSafe() {
        if (typeof FOOD_DATABASE !== 'undefined' && FOOD_DATABASE.categories) {
            return FOOD_DATABASE;
        }
        if (typeof window.FOOD_DATABASE !== 'undefined' && window.FOOD_DATABASE.categories) {
            return window.FOOD_DATABASE;
        }
        return { categories: [] };
    }

    // ==========================================
    // SMART COACH RECOMMENDATIONS & HEURISTICS
    // ==========================================
    function forceReshuffleRecommendations() {
        if (_isAiCoachLoading) return;
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

        const remCal = t.targetCal - sumCal;
        const remP = Math.max(0, t.pGram - sumP);
        const remC = Math.max(0, t.cGram - sumC);
        const remF = Math.max(0, t.fGram - sumF);

        // Invalidate cache for current state to fetch fresh deep analysis
        const cacheKey = `${dStr}_${remCal}_${remP}_${remC}_${remF}_${meals.length}`;
        delete _aiCoachAnalysisCache[cacheKey];

        renderSmartRecommendations(remCal, remP, remC, remF, true);
    }

    function generateHeuristicCoachAdvice(remCal, remP, remC, remF, sumCal, targetCal, goal) {
        if (remCal <= 50 && remP <= 10) {
            return '🎉 ยอดเยี่ยมมากครับ! วันนี้คุณคุมอาหารและเติมสารอาหารได้ครบตามเป้าหมาย 100% แล้ว แนะนำจิบน้ำเปล่าให้ครบโควตาแล้วพักผ่อนให้เพียงพอ เพื่อให้ร่างกายฟื้นฟูกล้ามเนื้อได้อย่างเต็มที่ครับ';
        }
        if (remCal < -50) {
            const over = Math.abs(remCal);
            if (remP > 15) {
                return `⚠️ วันนี้พลังงานเกินเป้าไป ${over.toLocaleString()} kcal และโปรตีนยังขาดอีก ${remP}g สำหรับมื้อที่เหลือแนะนำเลือก 'โปรตีนบริสุทธิ์ไขมันต่ำมาก' เช่น ไข่ขาวต้ม 3-4 ฟอง หรือเวย์โปรตีนไอโซเลท เพื่อช่วยดึงโปรตีนขึ้นโดยไม่เพิ่มไขมันครับ`;
            }
            return `🔥 วันนี้พลังงานเกินเป้าไป ${over.toLocaleString()} kcal แต่ไม่ต้องกังวลครับ ช่วงเย็นนี้แนะนำเน้นดื่มน้ำเปล่า ผักใบเขียวต้ม และออกกำลังกายเบาๆ พรุ่งนี้กลับมาคุมใหม่อย่างต่อเนื่องได้เลยครับ`;
        }
        if (remP >= 25 && remCal < 380) {
            return `💪 โปรตีนยังขาดอีก ${remP}g แต่มีโควตาแคลอรีเหลือเพียง ${Math.max(0, remCal)} kcal มื้อนี้แนะนำเน้น 'โปรตีนลีนไขมันต่ำ' เช่น สเต็กอกไก่ย่างฉีก, ทูน่าในน้ำแร่ หรือไข่ขาว เพื่อปิดยอดโปรตีนให้ถึงเป้าโดยคาร์บและไขมันไม่ล้นครับ`;
        }
        if (remP >= 20) {
            return `🥩 ร่างกายยังต้องการโปรตีนเพิ่มอีก ${remP}g (พลังงานเหลือ ${remCal.toLocaleString()} kcal) แนะนำเติมอาหารจานหลักที่มีเนื้อสัตว์คุณภาพดี เช่น อกไก่, ปลาแซลมอน หรือไข่ต้ม เพื่อเสริมสร้างกล้ามเนื้อและทำให้อิ่มนานครับ`;
        }
        if (remC >= 35 && remCal >= 250) {
            return `🍚 พลังงานยังเหลืออีก ${remCal.toLocaleString()} kcal และคาร์โบไฮเดรตขาด ${remC}g มื้อต่อไปสามารถทานคาร์โบไฮเดรตเชิงซ้อน เช่น ข้าวกล้อง ข้าวไรซ์เบอร์รี่ หรือมันเทศหวาน เพื่อเติมไกลโคเจนให้ร่างกายสดชื่นครับ`;
        }
        return `🥗 วันนี้คุมอาหารได้ดีมาก พลังงานยังเหลืออีก ${Math.max(0, remCal).toLocaleString()} kcal แนะนำเลือกมื้อเบาๆ ที่ย่อยง่าย เช่น สลัดผักอกไก่ โยเกิร์ต หรือผลไม้หวานน้อย เพื่อปิดยอดวันอย่างสมบูรณ์ครับ`;
    }

    function renderFoodCardsToContainer(container, foodItems) {
        if (!container) return;
        container.innerHTML = foodItems.map(item => {
            const safeName = String(item.name || '')
                .replace(/\\/g, '\\\\')
                .replace(/'/g, "\\'")
                .replace(/"/g, '&quot;');
            const displayName = String(item.name || '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
            const itemP = Number(item.protein) || 0;
            const itemC = Number(item.carbs) || 0;
            const itemF = Number(item.fat) || 0;
            const itemCal = Number(item.calories) || 0;
            const whyHtml = item.why
                ? `<span class="text-[10px] px-2 py-0.5 rounded-md bg-purple-500/15 dark:bg-purple-500/25 text-purple-700 dark:text-purple-300 font-medium border border-purple-500/30 dark:border-purple-500/40">${item.why}</span>`
                : '';
            return `
                <div class="flex items-center justify-between p-3.5 rounded-2xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 border border-slate-200/90 dark:border-slate-700/80 gap-3 transition shadow-2xs hover:border-purple-500/40">
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-1.5 flex-wrap">
                            <span class="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 truncate">${displayName}</span>
                            <span class="text-[11px] text-slate-400 dark:text-slate-400 font-normal">(${item.servingSize || '1 เสิร์ฟ'})</span>
                            ${whyHtml}
                        </div>
                        <div class="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap gap-2.5">
                            <span class="text-emerald-600 dark:text-emerald-400 font-bold">${itemCal} kcal</span>
                            <span class="text-blue-600 dark:text-blue-400 font-semibold">โปรตีน ${itemP}g</span>
                            <span class="text-amber-600 dark:text-amber-400 font-medium">คาร์บ ${itemC}g</span>
                            <span class="text-rose-600 dark:text-rose-400 font-medium">ไขมัน ${itemF}g</span>
                        </div>
                    </div>
                    <div class="flex items-center gap-1.5 shrink-0">
                        <button type="button" onclick="openFoodMealPicker('${safeName}', ${itemP}, ${itemC}, ${itemF}, ${itemCal}, event)"
                            title="เลือกมื้ออาหารที่จะบันทึก"
                            class="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold transition active:scale-95 border border-slate-200 dark:border-slate-600">
                            📋
                        </button>
                        <button type="button" onclick="addFoodItem('${safeName}', ${itemP}, ${itemC}, ${itemF}, ${itemCal})"
                            class="text-xs px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-bold transition shadow-xs flex items-center gap-1">
                            <span>+</span> <span>กินเมนูนี้</span>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderFoodCards(foodItems) {
        const container = document.getElementById('smartRecommendationList');
        renderFoodCardsToContainer(container, foodItems);
    }

    function getHeuristicCandidates(remCal, remP, remC) {
        const allFoods = [];
        const foodDb = getFoodDatabaseSafe();
        if (foodDb && Array.isArray(foodDb.categories)) {
            foodDb.categories.forEach(c => {
                if (Array.isArray(c.foods)) {
                    c.foods.forEach(f => allFoods.push({ ...f, catName: c.name }));
                }
            });
        }
        let candidates = [];
        if (remP >= 20 && remCal < 400) {
            candidates = allFoods.filter(f => f.protein >= 15 && f.calories <= 320);
        } else if (remP >= 25) {
            candidates = allFoods.filter(f => f.protein >= 20 && f.calories <= Math.max(350, remCal + 100));
        } else if (remC >= 30 && remCal >= 200) {
            candidates = allFoods.filter(f => f.carbs >= 25 && f.calories <= remCal + 100 && f.calories >= 100);
        } else {
            candidates = allFoods.filter(f => f.calories > 40 && f.calories <= Math.max(250, remCal + 50));
        }
        if (candidates.length === 0) {
            candidates = allFoods.filter(f => f.protein >= 12);
        }
        return [...candidates].sort(() => 0.5 - Math.random()).slice(0, 4);
    }

    function renderSmartRecommendations(remCal, remP, remC, remF, forceReshuffle = false) {
        const container = document.getElementById('smartRecommendationList');
        const subtitle = document.getElementById('recSubtitle');
        const pillsContainer = document.getElementById('aiCoachMacroPills');
        const statusBadge = document.getElementById('aiCoachStatusBadge');
        const modeLabel = document.getElementById('aiCoachModeLabel');
        const btnReshuffle = document.getElementById('btnReshuffleCoach');

        if (!container || !subtitle) return;

        const appState = getAppStateSafe();
        if (!appState) return;

        const t = getCalculatedTargetsSafe();
        if (!t) return;

        const dStr = appState.selectedDate;
        const meals = (appState.logsByDate && appState.logsByDate[dStr]) || [];
        const sumCal = Math.round(meals.reduce((s, m) => s + m.cal, 0));
        const sumP = Math.round(meals.reduce((s, m) => s + m.p, 0));
        const sumC = Math.round(meals.reduce((s, m) => s + m.c, 0));
        const goal = (appState.profile && appState.profile.goal) || 'loss';

        // 1. Render Macro Gap Quick Badges
        if (pillsContainer) {
            const calBadge = remCal > 0
                ? `<span class="px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/25">⚡ เหลือ ${remCal.toLocaleString()} kcal</span>`
                : `<span class="px-2 py-0.5 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold border border-rose-500/25">🔥 เกิน ${Math.abs(remCal).toLocaleString()} kcal</span>`;

            const pBadge = remP > 0
                ? `<span class="px-2 py-0.5 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 font-semibold border border-blue-500/25">🥩 โปรตีนขาด ${remP}g</span>`
                : `<span class="px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/25">✓ โปรตีนครบ</span>`;

            const cBadge = remC > 0
                ? `<span class="px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold border border-amber-500/25">🍚 คาร์บขาด ${remC}g</span>`
                : `<span class="px-2 py-0.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-medium">✓ คาร์บครบ</span>`;

            const fBadge = remF > 0
                ? `<span class="px-2 py-0.5 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400 font-semibold border border-rose-500/25">🥑 ไขมันขาด ${remF}g</span>`
                : `<span class="px-2 py-0.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-medium">✓ ไขมันครบ</span>`;

            pillsContainer.innerHTML = `${calBadge}${pBadge}${cBadge}${fBadge}`;
        }

        // 2. Goal Complete Check
        if (remCal <= 50 && remP <= 10) {
            if (statusBadge) {
                statusBadge.textContent = '🎉 ถึงเป้าหมายแล้ว';
                statusBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shrink-0';
            }
            if (modeLabel) modeLabel.textContent = 'วิเคราะห์: สารอาหารครบ 100%';
            subtitle.textContent = generateHeuristicCoachAdvice(remCal, remP, remC, remF, sumCal, t.targetCal, goal);
            container.innerHTML = `
                <div class="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-700 dark:text-emerald-300 font-medium flex items-center gap-3">
                    <div class="text-2xl">🎉</div>
                    <div>
                        <div class="font-bold text-sm">สารอาหารและพลังงานครบถ้วนสมบูรณ์!</div>
                        <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">วันนี้ทำได้ยอดเยี่ยมมากครับ แนะนำจิบน้ำเปล่าให้ครบหลอดด้านบน แล้วพักผ่อนให้สบายได้เลย</p>
                    </div>
                </div>
            `;
            return;
        }

        const cacheKey = `${dStr}_${remCal}_${remP}_${remC}_${remF}_${meals.length}`;
        const cachedAi = _aiCoachAnalysisCache[cacheKey];

        // If we already have a cached AI analysis for this exact macro state, use it immediately
        if (cachedAi && !forceReshuffle) {
            subtitle.textContent = cachedAi.coachAdvice;
            if (statusBadge) {
                statusBadge.textContent = '✓ วิเคราะห์โดย Gemini Flash';
                statusBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30 shrink-0';
            }
            if (modeLabel) modeLabel.textContent = `โมเดล: ${cachedAi.model || 'Gemini Flash'}`;
            if (cachedAi.suggestedMenus && cachedAi.suggestedMenus.length > 0) {
                renderFoodCardsToContainer(container, cachedAi.suggestedMenus);
            } else {
                renderFoodCardsToContainer(container, getHeuristicCandidates(remCal, remP, remC));
            }
            return;
        }

        const apiKey = (typeof window.getGeminiApiKey === 'function') ? window.getGeminiApiKey() : '';
        const hasGeminiFn = typeof window.requestGeminiCoachAdvice === 'function';

        // 3. User clicked "✨ วิเคราะห์ใหม่" (forceReshuffle = true) and has API key -> Call Gemini with Loading Skeleton UX
        if (forceReshuffle && apiKey && hasGeminiFn) {
            _isAiCoachLoading = true;
            if (btnReshuffle) {
                btnReshuffle.disabled = true;
                btnReshuffle.innerHTML = `<span class="inline-block animate-spin">✨</span> <span>กำลังวิเคราะห์...</span>`;
            }
            if (statusBadge) {
                statusBadge.textContent = '✨ AI กำลังวิเคราะห์...';
                statusBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 shrink-0 animate-pulse';
            }
            if (modeLabel) modeLabel.textContent = 'กำลังประมวลผลผ่าน Gemini Flash...';

            // Display Shimmering Subtitle
            subtitle.innerHTML = `
                <div class="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-semibold animate-pulse text-xs sm:text-sm">
                    <span class="inline-block w-2.5 h-2.5 rounded-full bg-purple-500 animate-ping shrink-0"></span>
                    <span>AI Macro Coach กำลังคำนวณสัดส่วนสารอาหารคงเหลือและเมนูที่เหมาะสม...</span>
                </div>
            `;

            // Display Shimmering Loading Skeleton Cards
            container.innerHTML = `
                <div class="space-y-2.5 animate-pulse">
                    <div class="p-3.5 rounded-2xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-3">
                        <div class="flex-1 space-y-2">
                            <div class="h-4 bg-slate-200 dark:bg-slate-700 rounded-md w-2/5"></div>
                            <div class="flex gap-2">
                                <div class="h-3 bg-slate-200 dark:bg-slate-700 rounded-md w-14"></div>
                                <div class="h-3 bg-slate-200 dark:bg-slate-700 rounded-md w-16"></div>
                                <div class="h-3 bg-slate-200 dark:bg-slate-700 rounded-md w-14"></div>
                            </div>
                        </div>
                        <div class="w-20 h-8 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>
                    </div>
                    <div class="p-3.5 rounded-2xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-3">
                        <div class="flex-1 space-y-2">
                            <div class="h-4 bg-slate-200 dark:bg-slate-700 rounded-md w-1/2"></div>
                            <div class="flex gap-2">
                                <div class="h-3 bg-slate-200 dark:bg-slate-700 rounded-md w-16"></div>
                                <div class="h-3 bg-slate-200 dark:bg-slate-700 rounded-md w-14"></div>
                                <div class="h-3 bg-slate-200 dark:bg-slate-700 rounded-md w-14"></div>
                            </div>
                        </div>
                        <div class="w-20 h-8 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>
                    </div>
                    <div class="p-3.5 rounded-2xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-3">
                        <div class="flex-1 space-y-2">
                            <div class="h-4 bg-slate-200 dark:bg-slate-700 rounded-md w-1/3"></div>
                            <div class="flex gap-2">
                                <div class="h-3 bg-slate-200 dark:bg-slate-700 rounded-md w-14"></div>
                                <div class="h-3 bg-slate-200 dark:bg-slate-700 rounded-md w-16"></div>
                                <div class="h-3 bg-slate-200 dark:bg-slate-700 rounded-md w-14"></div>
                            </div>
                        </div>
                        <div class="w-20 h-8 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>
                    </div>
                </div>
            `;

            window.requestGeminiCoachAdvice({
                targetCal: t.targetCal,
                pGram: t.pGram,
                cGram: t.cGram,
                fGram: t.fGram,
                consumedCal: sumCal,
                consumedP: sumP,
                consumedC: sumC,
                consumedF: Math.round(meals.reduce((s, m) => s + m.f, 0)),
                remCal,
                remP,
                remC,
                remF,
                goal,
                todayMeals: meals.map(m => `${m.name} (${m.cal} kcal, P:${m.p}g)`)
            }).then(aiRes => {
                _isAiCoachLoading = false;
                if (btnReshuffle) {
                    btnReshuffle.disabled = false;
                    btnReshuffle.innerHTML = `<span>✨</span> <span>วิเคราะห์ใหม่</span>`;
                }
                if (aiRes && aiRes.coachAdvice) {
                    _aiCoachAnalysisCache[cacheKey] = aiRes;
                    subtitle.textContent = aiRes.coachAdvice;
                    if (statusBadge) {
                        statusBadge.textContent = '✓ วิเคราะห์โดย Gemini Flash';
                        statusBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30 shrink-0';
                    }
                    if (modeLabel) modeLabel.textContent = `โมเดล: ${aiRes.model || 'Gemini Flash'}`;
                    if (aiRes.suggestedMenus && aiRes.suggestedMenus.length > 0) {
                        renderFoodCardsToContainer(container, aiRes.suggestedMenus);
                    } else {
                        renderFoodCardsToContainer(container, getHeuristicCandidates(remCal, remP, remC));
                    }
                    showToastSafe('✨ AI Macro Coach วิเคราะห์คำแนะนำสำเร็จ!');
                } else {
                    // Fallback to heuristic
                    subtitle.textContent = generateHeuristicCoachAdvice(remCal, remP, remC, remF, sumCal, t.targetCal, goal);
                    if (statusBadge) {
                        statusBadge.textContent = '✓ โค้ชพร้อมแนะนำ';
                        statusBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shrink-0';
                    }
                    if (modeLabel) modeLabel.textContent = 'วิเคราะห์จากโควตาสารอาหารวันนี้';
                    renderFoodCardsToContainer(container, getHeuristicCandidates(remCal, remP, remC));
                }
            }).catch(err => {
                console.warn('AI Coach background analysis error:', err);
                _isAiCoachLoading = false;
                if (btnReshuffle) {
                    btnReshuffle.disabled = false;
                    btnReshuffle.innerHTML = `<span>✨</span> <span>วิเคราะห์ใหม่</span>`;
                }
                subtitle.textContent = generateHeuristicCoachAdvice(remCal, remP, remC, remF, sumCal, t.targetCal, goal);
                if (statusBadge) {
                    statusBadge.textContent = '✓ โค้ชพร้อมแนะนำ';
                    statusBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shrink-0';
                }
                if (modeLabel) modeLabel.textContent = 'วิเคราะห์จากโควตาสารอาหารวันนี้';
                renderFoodCardsToContainer(container, getHeuristicCandidates(remCal, remP, remC));
            });
            return;
        }

        // 4. Default / Regular Render (Page load, date shift, meal logging)
        subtitle.textContent = generateHeuristicCoachAdvice(remCal, remP, remC, remF, sumCal, t.targetCal, goal);
        if (statusBadge) {
            statusBadge.textContent = '✓ โค้ชพร้อมแนะนำ';
            statusBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shrink-0';
        }
        if (modeLabel) modeLabel.textContent = 'วิเคราะห์จากโควตาสารอาหารวันนี้';
        if (btnReshuffle) {
            btnReshuffle.disabled = false;
            btnReshuffle.innerHTML = `<span>✨</span> <span>วิเคราะห์ใหม่</span>`;
        }
        renderFoodCardsToContainer(container, getHeuristicCandidates(remCal, remP, remC));
        if (forceReshuffle) {
            showToastSafe('✨ สุ่มเมนูแนะนำชุดใหม่เรียบร้อย');
        }
    }

    // Attach to window for global access and backward compatibility
    window.forceReshuffleRecommendations = forceReshuffleRecommendations;
    window.generateHeuristicCoachAdvice = generateHeuristicCoachAdvice;
    window.renderSmartRecommendations = renderSmartRecommendations;
    window.renderFoodCards = renderFoodCards;
    window.getHeuristicCandidates = getHeuristicCandidates;
})();
