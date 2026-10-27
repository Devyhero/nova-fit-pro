/**
 * NovaFit Pro - Body Weight & Workouts Engine (v5.9.30)
 * Manages body weight logging, daily weigh-in history & weekly nudge,
 * workout logging (presets & custom), burned calories deduction,
 * and 7-day weekly analytics chart with weight trend polyline.
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

    function getTodayStrSafe() {
        if (typeof getTodayStr === 'function') return getTodayStr();
        if (typeof window.getTodayStr === 'function') return window.getTodayStr();
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        return new Date(now.getTime() - offset).toISOString().split('T')[0];
    }

    function getCalculatedTargetsSafe(dateStr) {
        if (typeof getCalculatedTargets === 'function') return getCalculatedTargets(dateStr);
        if (typeof window.getCalculatedTargets === 'function') return window.getCalculatedTargets(dateStr);
        return null;
    }

    function renderAllSafe() {
        if (typeof renderAll === 'function') return renderAll();
        if (typeof window.renderAll === 'function') return window.renderAll();
    }

    function getEffectiveWeightSafe(dateStr) {
        if (typeof getEffectiveWeight === 'function') return getEffectiveWeight(dateStr);
        if (typeof window.getEffectiveWeight === 'function') return window.getEffectiveWeight(dateStr);
        const appState = getAppStateSafe();
        const d = dateStr || (appState && appState.selectedDate) || getTodayStrSafe();
        if (appState && appState.weightsByDate && appState.weightsByDate[d] !== undefined && appState.weightsByDate[d] !== null && Number(appState.weightsByDate[d]) > 0) {
            return { weight: Number(appState.weightsByDate[d]), isExact: true, sourceDate: d };
        }
        if (appState && appState.weightsByDate) {
            const pastDates = Object.keys(appState.weightsByDate)
                .filter(x => x <= d && Number(appState.weightsByDate[x]) > 0)
                .sort();
            if (pastDates.length > 0) {
                const lastDate = pastDates[pastDates.length - 1];
                return { weight: Number(appState.weightsByDate[lastDate]), isExact: false, sourceDate: lastDate };
            }
        }
        return { weight: Number(appState?.profile?.weight) || 70, isExact: false, sourceDate: 'profile' };
    }

    function toggleCardSectionSafe(sectionId) {
        if (typeof toggleCardSection === 'function') return toggleCardSection(sectionId);
        if (typeof window.toggleCardSection === 'function') return window.toggleCardSection(sectionId);
    }

    // ==========================================
    // BODY WEIGHT & WORKOUTS TAB ENGINE
    // ==========================================
    function switchBodyTab(tabName) {
        const appState = getAppStateSafe();
        if (!appState) return;

        appState.bodyTab = tabName;
        clearTimeout(window._tabSaveTimer);
        window._tabSaveTimer = setTimeout(() => {
            try {
                const storageKey = typeof STORAGE_KEY !== 'undefined' ? STORAGE_KEY : (window.STORAGE_KEY || 'fitmacro_pro_v4_state');
                localStorage.setItem(storageKey, JSON.stringify(appState));
            } catch (e) {}
        }, 100);

        const targets = getCalculatedTargetsSafe();
        renderBodyAndWorkoutSection(targets);
    }

    function submitWeightToday() {
        const appState = getAppStateSafe();
        if (!appState) return;

        const input = document.getElementById('inDailyWeight');
        if (!input) return;
        const val = parseFloat(input.value);
        if (isNaN(val) || val < 30 || val > 250) {
            return alert('กรุณากรอกน้ำหนักตัวที่ถูกต้อง (30 - 250 กก.) ครับ');
        }

        const dStr = appState.selectedDate;
        const cleanVal = Math.round(val * 10) / 10;
        if (!appState.weightsByDate) appState.weightsByDate = {};
        appState.weightsByDate[dStr] = cleanVal;
        if (appState.profile) appState.profile.weight = cleanVal;

        saveStateSafe();
        renderAllSafe();
        showToastSafe(`⚖️ บันทึกน้ำหนัก ${cleanVal} กก. สำหรับวันที่ ${dStr} เรียบร้อย`);
    }

    function clearWeightToday() {
        const appState = getAppStateSafe();
        if (!appState) return;

        const dStr = appState.selectedDate;
        if (appState.weightsByDate && appState.weightsByDate[dStr]) {
            delete appState.weightsByDate[dStr];
            saveStateSafe();
            renderAllSafe();
            showToastSafe(`ลบการบันทึกน้ำหนักของวันที่ ${dStr} แล้ว`);
        }
    }

    function addWorkout(name, cal) {
        const appState = getAppStateSafe();
        if (!appState) return;

        const dStr = appState.selectedDate;
        if (!appState.workoutsByDate) appState.workoutsByDate = {};
        if (!appState.workoutsByDate[dStr]) appState.workoutsByDate[dStr] = [];
        const time = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

        appState.workoutsByDate[dStr].push({
            id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
            name,
            cal: Math.round(cal),
            time
        });

        saveStateSafe();
        renderAllSafe();
        showToastSafe(`🏃 บันทึกกิจกรรม "${name}" (-${cal} kcal) แล้ว`);
    }

    function submitCustomWorkout() {
        const nameInput = document.getElementById('inWorkoutName');
        const calInput = document.getElementById('inWorkoutCal');
        if (!nameInput || !calInput) return;

        const name = nameInput.value.trim();
        const cal = parseFloat(calInput.value);
        if (!name) return alert('กรุณาระบุกิจกรรมออกกำลังกายครับ');
        if (isNaN(cal) || cal <= 0) return alert('กรุณาระบุพลังงานที่เผาผลาญ (kcal) ครับ');

        addWorkout(name, cal);
        nameInput.value = '';
        calInput.value = '';
    }

    function removeWorkout(id) {
        const appState = getAppStateSafe();
        if (!appState) return;

        const dStr = appState.selectedDate;
        if (!appState.workoutsByDate || !appState.workoutsByDate[dStr]) return;
        appState.workoutsByDate[dStr] = appState.workoutsByDate[dStr].filter(w => w.id !== id);

        saveStateSafe();
        renderAllSafe();
        showToastSafe('ลบรายการออกกำลังกายแล้ว');
    }

    function renderBodyAndWorkoutSection(targets) {
        const appState = getAppStateSafe();
        if (!appState) return;

        const dStr = appState.selectedDate;
        const isWeightTab = (appState.bodyTab || 'weight') === 'weight';

        const tabBtnWeight = document.getElementById('tabBtnWeight');
        const tabBtnWorkout = document.getElementById('tabBtnWorkout');
        const tabWeight = document.getElementById('bodyTabWeight');
        const tabWorkout = document.getElementById('bodyTabWorkout');

        if (tabBtnWeight && tabBtnWorkout && tabWeight && tabWorkout) {
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
        }

        // Tab 1: Weight logic
        const directWeight = appState.weightsByDate ? appState.weightsByDate[dStr] : null;
        const inDailyWeight = document.getElementById('inDailyWeight');
        const btnClearWeightToday = document.getElementById('btnClearWeightToday');
        const statusText = document.getElementById('weightStatusText');

        if (inDailyWeight && btnClearWeightToday && statusText) {
            if (directWeight !== undefined && directWeight !== null) {
                inDailyWeight.value = directWeight;
                btnClearWeightToday.classList.remove('hidden');

                const pastDates = Object.keys(appState.weightsByDate || {})
                    .filter(d => d < dStr && Number(appState.weightsByDate[d]) > 0)
                    .sort();
                let diffStr = '';
                if (pastDates.length > 0) {
                    const prevDate = pastDates[pastDates.length - 1];
                    const prevWeight = Number(appState.weightsByDate[prevDate]);
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
                const effective = getEffectiveWeightSafe(dStr);
                inDailyWeight.value = '';
                btnClearWeightToday.classList.add('hidden');
                const fromMsg = effective.sourceDate === 'profile'
                    ? `ตั้งต้นจากข้อมูลส่วนตัว (${effective.weight} กก.)`
                    : `อ้างอิงล่าสุดจากวันที่ ${effective.sourceDate} (${effective.weight} กก.)`;
                statusText.innerHTML = `<span class="text-slate-400">ยังไม่ได้บันทึกของวันนี้ (${fromMsg}) ไม่บังคับบันทึกครับ</span>`;
            }
        }

        // Tab 2: Workout logic
        const workouts = (appState.workoutsByDate && appState.workoutsByDate[dStr]) || [];
        const workoutContainer = document.getElementById('workoutListContainer');
        if (workoutContainer) {
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
    }

    // ==========================================
    // 7-DAY WEEKLY ANALYTICS & WEIGHT TREND
    // ==========================================
    function renderWeeklyAnalytics(targets) {
        const appState = getAppStateSafe();
        if (!appState) return;

        const todayStr = getTodayStrSafe();
        const dStr = appState.selectedDate;
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
        const targetCal = targets ? targets.targetCal : 2000;

        const daysData = [];
        let maxChartCal = targetCal * 1.25;

        for (let i = 6; i >= 0; i--) {
            const d = new Date(anchorDateObj);
            d.setDate(d.getDate() - i);
            const offset = d.getTimezoneOffset() * 60000;
            const iso = new Date(d.getTime() - offset).toISOString().split('T')[0];

            const dayLogs = (appState.logsByDate && appState.logsByDate[iso]) || [];
            const eatenCal = dayLogs.reduce((s, x) => s + x.cal, 0);

            const dayWorkouts = (appState.workoutsByDate && appState.workoutsByDate[iso]) || [];
            const burnedCal = dayWorkouts.reduce((s, x) => s + x.cal, 0);

            const dayWeight = (appState.weightsByDate && appState.weightsByDate[iso]) || null;

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

        if (badge) {
            const consistencyPct = Math.round((daysWithLogs / 7) * 100);
            badge.textContent = `ความสม่ำเสมอ: ${consistencyPct}% (${daysWithLogs}/7 วัน)`;
            badge.className = consistencyPct >= 70
                ? 'px-2 py-0.5 rounded-full font-bold text-xs bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                : 'px-2 py-0.5 rounded-full font-bold text-xs bg-amber-500/15 text-amber-600 dark:text-amber-400';
        }

        if (avgText) {
            const avgCal = daysWithLogs > 0 ? Math.round(totalCal7Days / daysWithLogs) : 0;
            avgText.textContent = `เฉลี่ย: ${avgCal.toLocaleString()} kcal/วัน`;
        }

        // Weight Trend Analysis for 7 Days (SVG Polyline) - With Carry-Forward (v5.9.0)
        const trendBadge = document.getElementById('weeklyWeightTrendBadge');
        const trendContainer = document.getElementById('weekWeightTrendContainer');

        const weightsWithIdx = daysData.map((d, idx) => {
            const directW = (appState.weightsByDate && appState.weightsByDate[d.iso]) ? parseFloat(appState.weightsByDate[d.iso]) : null;
            if (directW !== null && !isNaN(directW) && directW > 0) {
                return { idx, weight: directW, isExact: true, iso: d.iso, dayNum: d.dayNum };
            }
            const eff = getEffectiveWeightSafe(d.iso);
            const effW = (eff && eff.weight) ? parseFloat(eff.weight) : null;
            return {
                idx,
                weight: (effW !== null && !isNaN(effW) && effW > 0) ? effW : null,
                isExact: false,
                sourceDate: eff ? eff.sourceDate : null,
                iso: d.iso,
                dayNum: d.dayNum
            };
        }).filter(w => w.weight !== null && !isNaN(w.weight) && w.weight > 0);

        const exactWeights = weightsWithIdx.filter(w => w.isExact);

        if (trendBadge) {
            if (exactWeights.length >= 2) {
                const firstW = exactWeights[0].weight;
                const lastW = exactWeights[exactWeights.length - 1].weight;
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
            } else if (exactWeights.length === 1) {
                trendBadge.className = 'px-2 py-0.5 rounded-full font-bold text-xs bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30';
                trendBadge.innerHTML = `⚖️ นน. สัปดาห์นี้: ${exactWeights[0].weight} กก.`;
            } else if (weightsWithIdx.length > 0) {
                const lastEff = weightsWithIdx[weightsWithIdx.length - 1];
                trendBadge.className = 'px-2 py-0.5 rounded-full font-bold text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-slate-600';
                trendBadge.innerHTML = `⚖️ นน. อ้างอิง: ${lastEff.weight} กก. (ใช้น้ำหนักเดิม)`;
            } else {
                trendBadge.className = 'px-2 py-0.5 rounded-full font-bold text-xs bg-slate-100 dark:bg-slate-700 text-slate-400 border border-slate-200 dark:border-slate-600';
                trendBadge.innerHTML = `⚖️ ยังไม่มีบันทึก นน.`;
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
                    return { x, y, weight: w.weight, idx: w.idx, isExact: w.isExact };
                });

                const polylinePoints = points.map(p => `${p.x},${p.y}`).join(' ');

                const dotsSvg = points.map(p => {
                    if (p.isExact) {
                        return `
                            <g>
                                <circle cx="${p.x}" cy="${p.y}" r="3.5" fill="#0284c7" stroke="#ffffff" stroke-width="1.5" />
                                <text x="${p.x}" y="${Math.max(10, p.y - 6)}" text-anchor="middle" font-size="8.5" font-weight="bold" fill="#0284c7">${p.weight}</text>
                            </g>
                        `;
                    } else {
                        return `
                            <g>
                                <circle cx="${p.x}" cy="${p.y}" r="2.5" fill="#e0f2fe" stroke="#38bdf8" stroke-width="1.2" stroke-dasharray="2,2" />
                                <text x="${p.x}" y="${Math.max(10, p.y - 6)}" text-anchor="middle" font-size="7.5" font-weight="normal" fill="#94a3b8">${p.weight}</text>
                            </g>
                        `;
                    }
                }).join('');

                trendContainer.innerHTML = `
                    <div class="px-2 py-1.5 rounded-xl bg-sky-500/5 dark:bg-sky-500/10 border border-sky-500/15 space-y-1">
                        <div class="flex items-center justify-between text-[11px] text-sky-600 dark:text-sky-400 font-semibold px-1">
                            <span>📈 แนวโน้มน้ำหนักตัว (${exactWeights.length > 0 ? `ชั่งจริง ${exactWeights.length}/7 วัน · วันอื่นใช้น้ำหนักเดิม` : `ใช้น้ำหนักเดิม ${weightsWithIdx[weightsWithIdx.length - 1].weight} กก.`})</span>
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
                        <span>⚖️ น้ำหนัก ${p.weight} กก. (ชั่งสัปดาห์ละครั้งได้สบายๆ ระบบใช้น้ำหนักเดิมให้อัตโนมัติ)</span>
                        <button onclick="focusWeightInputToday()" class="text-sky-500 hover:underline font-bold text-xs">+ อัปเดต นน.</button>
                    </div>
                `;
            } else {
                trendContainer.innerHTML = `
                    <div class="p-2 rounded-xl bg-slate-100/40 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700/60 text-center text-xs text-slate-400 flex items-center justify-between">
                        <span>⚖️ ชั่งน้ำหนักสัปดาห์ละครั้งเพื่อดูกราฟแนวโน้ม</span>
                        <button onclick="focusWeightInputToday()" class="text-emerald-500 hover:underline font-bold text-xs">+ บันทึก นน. วันนี้</button>
                    </div>
                `;
            }
        }

        checkWeeklyWeighInNudge();

        if (weekBar) {
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
    }

    // ==========================================
    // WEEKLY WEIGH-IN NUDGE & FOCUS
    // ==========================================
    function checkWeeklyWeighInNudge() {
        const appState = getAppStateSafe();
        if (!appState) return;

        const banner = document.getElementById('weeklyWeighInNudgeBanner');
        if (!banner) return;

        const dates = Object.keys(appState.weightsByDate || {})
            .filter(d => Number(appState.weightsByDate[d]) > 0)
            .sort();

        const todayStr = getTodayStrSafe();
        const todayRecorded = appState.weightsByDate && Number(appState.weightsByDate[todayStr]) > 0;
        if (todayRecorded) {
            banner.classList.add('hidden');
            return;
        }

        let daysSinceLast = 999;
        let lastDateStr = null;
        if (dates.length > 0) {
            lastDateStr = dates[dates.length - 1];
            const lastDate = new Date(lastDateStr + 'T00:00:00');
            const todayDate = new Date(todayStr + 'T00:00:00');
            daysSinceLast = Math.round((todayDate - lastDate) / (1000 * 60 * 60 * 24));
        }

        if (daysSinceLast >= 7) {
            banner.classList.remove('hidden');
            const textSpan = document.getElementById('weeklyWeighInNudgeText');
            if (textSpan) {
                textSpan.textContent = dates.length > 0
                    ? `ครบ 1 สัปดาห์แล้ว! (ชั่งครั้งล่าสุดเมื่อ ${daysSinceLast} วันก่อน) มาอัปเดตน้ำหนักล่าสุดกันครับ`
                    : `มาเริ่มบันทึกน้ำหนักตัวสัปดาห์ละครั้ง เพื่อติดตามผลลัพธ์และคำนวณแคลอรีแม่นยำขึ้นครับ`;
            }
        } else {
            banner.classList.add('hidden');
        }
    }

    function focusWeightInputToday() {
        switchBodyTab('weight');
        const section = document.getElementById('section_body');
        if (section && section.classList.contains('hidden')) {
            toggleCardSectionSafe('section_body');
        }
        const input = document.getElementById('inDailyWeight');
        if (input) {
            input.scrollIntoView({ behavior: 'smooth', block: 'center' });
            input.focus();
            input.select();
        }
    }

    // Attach to window for global access and backward compatibility
    window.switchBodyTab = switchBodyTab;
    window.submitWeightToday = submitWeightToday;
    window.clearWeightToday = clearWeightToday;
    window.addWorkout = addWorkout;
    window.submitCustomWorkout = submitCustomWorkout;
    window.removeWorkout = removeWorkout;
    window.renderBodyAndWorkoutSection = renderBodyAndWorkoutSection;
    window.renderWeeklyAnalytics = renderWeeklyAnalytics;
    window.checkWeeklyWeighInNudge = checkWeeklyWeighInNudge;
    window.focusWeightInputToday = focusWeightInputToday;
})();
