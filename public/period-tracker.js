/**
 * NovaFit Pro - Smart Menstrual & Hormone Cycle Tracker Engine (v5.9.34)
 * Provides female users with medical-grade period tracking, 4-phase hormonal cycle analysis,
 * nutritional & training synchronization, daily flow/symptom logging, and cycle predictions.
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

    function showToastSafe(msg) {
        if (typeof showToast === 'function') return showToast(msg);
        if (typeof window.showToast === 'function') return window.showToast(msg);
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

    // Supported symptoms with icons and Thai titles
    const PERIOD_SYMPTOMS = [
        { id: 'cramps', label: 'ปวดท้องน้อย', icon: '😣' },
        { id: 'bloating', label: 'ตัวบวมน้ำ', icon: '🎈' },
        { id: 'cravings', label: 'อยากของหวาน/แป้ง', icon: '🍫' },
        { id: 'fatigue', label: 'อ่อนเพลีย/ง่วง', icon: '🥱' },
        { id: 'mood', label: 'อารมณ์อ่อนไหว', icon: '🎭' },
        { id: 'headache', label: 'ปวดศีรษะ', icon: '🤕' },
        { id: 'energetic', label: 'สดชื่น/แรงดี', icon: '⚡' },
        { id: 'backpain', label: 'ปวดเมื่อยหลัง', icon: '🦴' }
    ];

    const PERIOD_FLOWS = [
        { id: 'spotting', label: 'กะปริดกะปรอย', icon: '💧' },
        { id: 'light', label: 'มาน้อย', icon: '🩸' },
        { id: 'medium', label: 'ปานกลาง', icon: '🩸🩸' },
        { id: 'heavy', label: 'มามาก', icon: '🩸🩸🩸' }
    ];

    /**
     * Compute difference in whole calendar days between two YYYY-MM-DD strings (date2 - date1)
     */
    function diffInDays(dateStr1, dateStr2) {
        if (!dateStr1 || !dateStr2) return 0;
        const d1 = new Date(dateStr1 + 'T00:00:00');
        const d2 = new Date(dateStr2 + 'T00:00:00');
        return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
    }

    /**
     * Format ISO date string into friendly Thai short date (e.g. "15 พ.ย.")
     */
    function formatThaiShortDate(dateStr) {
        if (!dateStr) return '';
        try {
            const parts = dateStr.split('-');
            if (parts.length < 3) return dateStr;
            const day = parseInt(parts[2], 10);
            const thaiMonths = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
            const m = parseInt(parts[1], 10);
            return `${day} ${thaiMonths[m] || ''}`;
        } catch (e) {
            return dateStr;
        }
    }

    /**
     * Add days to an ISO date string
     */
    function addDaysToDate(dateStr, days) {
        const d = new Date(dateStr + 'T00:00:00');
        d.setDate(d.getDate() + days);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    /**
     * Calculate 4-phase cycle information for a given date
     */
    function calculateCycleInfo(dateStr) {
        const appState = getAppStateSafe();
        if (!appState) return null;

        const tracker = appState.periodTracker || { cycleLength: 28, periodDuration: 5, lastPeriodStart: '' };
        const cycleLength = Math.max(21, Math.min(45, Number(tracker.cycleLength) || 28));
        const periodDuration = Math.max(2, Math.min(10, Number(tracker.periodDuration) || 5));
        const lastStart = tracker.lastPeriodStart || '';

        if (!lastStart) {
            return {
                isConfigured: false,
                cycleLength,
                periodDuration,
                lastStart: '',
                currentCycleDay: 1,
                phase: 'unknown',
                phaseName: 'ยังไม่ได้ระบุวันแรกของรอบเดือน',
                phaseBadgeClass: 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
                daysUntilNext: null,
                nextPeriodDate: null,
                tipTitle: '🌸 เริ่มต้นบันทึกรอบเดือนของคุณ',
                tipDesc: 'กดปุ่มด้านล่างเพื่อระบุวันแรกของประจำเดือนรอบล่าสุด ระบบจะคำนวณระยะรอบเดือนและมอบคำแนะนำโภชนาการให้ทันทีค่ะ'
            };
        }

        const daysSinceLast = diffInDays(lastStart, dateStr);
        let cycleDay = 1;
        if (daysSinceLast >= 0) {
            cycleDay = (daysSinceLast % cycleLength) + 1;
        } else {
            // Viewing date is prior to lastPeriodStart
            const negMod = ((daysSinceLast % cycleLength) + cycleLength) % cycleLength;
            cycleDay = negMod + 1;
        }

        const daysUntilNext = cycleLength - (cycleDay - 1);
        const nextPeriodDate = addDaysToDate(dateStr, daysUntilNext);

        // Determine which of the 4 phases
        let phase = '';
        let phaseName = '';
        let phaseIcon = '';
        let phaseColor = '';
        let phaseBadgeClass = '';
        let tipTitle = '';
        let tipDesc = '';
        let nutritionAdvice = '';
        let workoutAdvice = '';

        if (cycleDay <= periodDuration) {
            phase = 'menstrual';
            phaseName = 'ช่วงมีประจำเดือน (Menstrual Phase)';
            phaseIcon = '🩸';
            phaseColor = 'rose';
            phaseBadgeClass = 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25';
            tipTitle = '🩸 ช่วงมีรอบเดือน: บวมน้ำ 1-2 กก. เป็นเรื่องธรรมชาติ ดื่มน้ำสะอาด 2.5-3 ลิตร & เน้นธาตุเหล็ก';
            tipDesc = 'ฮอร์โมนเอสโตรเจนและโปรเจสเตอโรนลดต่ำสุด ร่างกายอาจมีน้ำหนักสวิงจากอาการบวมน้ำ (Water Retention) อย่าตกใจตัวเลขบนตาชั่งนะคะ ให้พักผ่อนอย่างเต็มอิ่ม';
            nutritionAdvice = '🥩 เน้นอาหารที่มีธาตุเหล็กและวิตามินซี (อกไก่, ไข่, ตับ, ผักโขม) ลดของเค็ม/โซเดียมสูง ดื่มน้ำอุ่นสม่ำเสมอ';
            workoutAdvice = '🧘‍♀️ ผ่อนคลายด้วยโยคะ ยืดเหยียด หรือเดินเบาๆ หลีกเลี่ยงการฝึกหนักเกินกำลังใน 1-2 วันแรก';
        } else if (cycleDay <= 13) {
            phase = 'follicular';
            phaseName = 'ช่วงฟอลลิคูลาร์ (Follicular Phase)';
            phaseIcon = '🌱';
            phaseColor = 'emerald';
            phaseBadgeClass = 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25';
            tipTitle = '🌱 ช่วงเวลาทองของพลัง & การสร้างกล้ามเนื้อ (High Strength Window)';
            tipDesc = 'ฮอร์โมนเอสโตรเจนกำลังไต่ระดับขึ้น พลังงานสดชื่น อารมณ์แจ่มใส ร่างกายไวต่ออินซูลินและเผาผลาญคาร์โบไฮเดรตได้ดีเยี่ยมที่สุดของรอบเดือน';
            nutritionAdvice = '🍚 ทานคาร์โบไฮเดรตเชิงซ้อนได้ดี (ข้าวกล้อง, ข้าวโอ๊ต, ฟักทอง) ควบคู่กับโปรตีนตามเป้าหมายเพื่อเสริมสร้างกล้ามเนื้อ';
            workoutAdvice = '🏋️‍♀️ ช่วงที่แข็งแรงที่สุด! เหมาะกับการยกเวทเทรนนิ่งแบบเพิ่มน้ำหนัก (Progressive Overload) และคาร์ดิโอเข้มข้น';
        } else if (cycleDay <= 16) {
            phase = 'ovulation';
            phaseName = 'ช่วงไข่ตก (Ovulation Phase)';
            phaseIcon = '✨';
            phaseColor = 'purple';
            phaseBadgeClass = 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/25';
            tipTitle = '✨ ช่วงพลังงานสูงสุด: กล้ามเนื้อฟื้นตัวเร็ว ร่างกายแข็งแรงเต็มที่';
            tipDesc = 'เอสโตรเจนและเทสโทสเตอโรนขึ้นสู่จุดสูงสุด ความมั่นใจและความแข็งแรงเต็มร้อย อุณหภูมิร่างกายเริ่มสูงขึ้นเล็กน้อย';
            nutritionAdvice = '🥑 เสริมไขมันดี (อะโวคาโด, ปลาแซลมอน, เมล็ดเจีย, ถั่วอัลมอนด์) และสารต้านอนุมูลอิสระเพื่อความสมดุลของฮอร์โมน';
            workoutAdvice = '🔥 ทำ Personal Record (PR) ท่าสควอทหรือเดดลิฟต์ได้ดี แต่ระวังข้อต่อเพราะฮอร์โมนอาจทำให้เส้นเอ็นยืดหยุ่นกว่าปกติ';
        } else {
            phase = 'luteal';
            phaseName = 'ช่วงลูเทียล / ก่อนมีรอบเดือน (Luteal / PMS Phase)';
            phaseIcon = '🍂';
            phaseColor = 'amber';
            phaseBadgeClass = 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25';
            tipTitle = '🍂 ช่วงเผาผลาญสูงขึ้น (+100-200 kcal) แต่ระวังความอยากหวาน & อาการ PMS';
            tipDesc = 'ฮอร์โมนโปรเจสเตอโรนสูงขึ้น อุณหภูมิร่างกายและอัตราการเผาผลาญพื้นฐาน (BMR) ขยับสูงขึ้นเล็กน้อย ร่างกายจึงส่งสัญญาณอยากแป้งและของหวาน';
            nutritionAdvice = '🍫 เพิ่มโปรตีนและไฟเบอร์สูงเพื่อคุมความอิ่ม ทานแมกนีเซียม (ดาร์กช็อกโกแลต 70%+, กล้วยหอม) บรรเทาอาการอยากของหวานและหงุดหงิด';
            workoutAdvice = '🚶‍♀️ ออกกำลังกายระดับปานกลาง (Moderate intensity) เช่น บอดี้เวท พิลาทิส คาร์ดิโอเบาๆ และนอนหลับให้ครบ 7-8 ชม.';
        }

        return {
            isConfigured: true,
            cycleLength,
            periodDuration,
            lastStart,
            currentCycleDay: cycleDay,
            phase,
            phaseName,
            phaseIcon,
            phaseColor,
            phaseBadgeClass,
            daysUntilNext,
            nextPeriodDate,
            tipTitle,
            tipDesc,
            nutritionAdvice,
            workoutAdvice
        };
    }

    /**
     * Render the Period Tracker UI inside #card_period_tracker
     */
    function renderPeriodTracker() {
        const appState = getAppStateSafe();
        if (!appState) return;

        const isFemale = appState.profile && appState.profile.gender === 'female';
        const card = document.getElementById('card_period_tracker');
        const holder = document.getElementById('femaleFeatureHolder');
        const colLeft = document.getElementById('colDesktopLeft');
        const cardSupp = document.getElementById('card_supplements');
        const cardWater = document.getElementById('card_water');

        if (!card) return;

        // If user is male: safely stow the card away in holder or hide
        if (!isFemale) {
            card.classList.add('hidden');
            if (holder && card.parentElement !== holder) {
                holder.appendChild(card);
            }
            return;
        }

        // User is female: Ensure card is mounted in colDesktopLeft
        if (colLeft && card.parentElement !== colLeft) {
            if (cardSupp) {
                colLeft.insertBefore(card, cardSupp);
            } else if (cardWater && cardWater.nextSibling) {
                colLeft.insertBefore(card, cardWater.nextSibling);
            } else {
                colLeft.appendChild(card);
            }
        }
        card.classList.remove('hidden');

        // Ensure state integrity for periodTracker & periodByDate
        if (!appState.periodTracker) {
            appState.periodTracker = {
                cycleLength: 28,
                periodDuration: 5,
                lastPeriodStart: ''
            };
        }
        if (!appState.periodByDate) {
            appState.periodByDate = {};
        }

        const selectedDate = appState.selectedDate || new Date().toISOString().split('T')[0];
        const dayData = appState.periodByDate[selectedDate] || { isPeriod: false, flow: '', symptoms: [], notes: '' };
        const cycleInfo = calculateCycleInfo(selectedDate);

        // Header status badge
        const badgeEl = document.getElementById('periodStatusBadge');
        if (badgeEl && cycleInfo) {
            if (!cycleInfo.isConfigured) {
                badgeEl.className = 'text-xs px-2.5 py-0.5 rounded-full font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25';
                badgeEl.textContent = '🌸 รอตั้งค่ารอบเดือน';
            } else if (dayData.isPeriod) {
                badgeEl.className = 'text-xs px-2.5 py-0.5 rounded-full font-bold bg-rose-500 text-white shadow-xs';
                badgeEl.textContent = `🩸 มีรอบเดือน (วันที่ ${cycleInfo.currentCycleDay})`;
            } else {
                badgeEl.className = `text-xs px-2.5 py-0.5 rounded-full font-bold ${cycleInfo.phaseBadgeClass}`;
                badgeEl.textContent = `${cycleInfo.phaseIcon} วันที่ ${cycleInfo.currentCycleDay}/${cycleInfo.cycleLength}`;
            }
        }

        // Subtitle / Next predicted date countdown
        const subtitleEl = document.getElementById('periodCycleSubtitle');
        if (subtitleEl && cycleInfo) {
            if (!cycleInfo.isConfigured) {
                subtitleEl.textContent = 'บันทึกวันแรกของรอบเดือนเพื่อคาดการณ์วันถัดไป & ปรับโภชนาการ';
            } else if (cycleInfo.currentCycleDay <= cycleInfo.periodDuration || dayData.isPeriod) {
                subtitleEl.innerHTML = `กำลังอยู่ในช่วงมีประจำเดือน • คาดว่าจะสิ้นสุดในอีก <b class="text-rose-600 dark:text-rose-400 font-bold">${Math.max(1, cycleInfo.periodDuration - cycleInfo.currentCycleDay + 1)} วัน</b>`;
            } else {
                const nextThaiDate = formatThaiShortDate(cycleInfo.nextPeriodDate);
                subtitleEl.innerHTML = `รอบถัดไปคาดว่าจะมาในอีก <b class="text-rose-600 dark:text-rose-400 font-bold">${cycleInfo.daysUntilNext} วัน</b> (ประมาณ ${nextThaiDate})`;
            }
        }

        // Cycle Progress Bar
        const barEl = document.getElementById('periodCycleProgressBar');
        if (barEl && cycleInfo) {
            if (!cycleInfo.isConfigured) {
                barEl.style.width = '0%';
            } else {
                const pct = Math.min(100, Math.round((cycleInfo.currentCycleDay / cycleInfo.cycleLength) * 100));
                barEl.style.width = `${pct}%`;
            }
        }

        // Phase Insights & Health Card
        const phaseBoxEl = document.getElementById('periodPhaseInfoBox');
        if (phaseBoxEl && cycleInfo) {
            if (!cycleInfo.isConfigured) {
                phaseBoxEl.innerHTML = `
                    <div class="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 space-y-2">
                        <div class="flex items-center gap-2">
                            <span class="text-xl">🌸</span>
                            <div>
                                <h4 class="text-xs sm:text-sm font-bold text-rose-700 dark:text-rose-300">เริ่มต้นใช้งานระบบติดตามรอบเดือน</h4>
                                <p class="text-[11px] text-slate-600 dark:text-slate-300">บันทึกวันแรกของประจำเดือนรอบล่าสุด เพื่อให้ NovaFit Pro ช่วยปรับโภชนาการและพลังงานให้เหมาะสมค่ะ</p>
                            </div>
                        </div>
                        <div class="pt-1 flex flex-wrap gap-2">
                            <button type="button" onclick="setPeriodTodayAsStart()"
                                class="px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs shadow-xs transition active:scale-95 flex items-center gap-1.5">
                                🩸 ประจำเดือนเริ่มมาวันนี้ (${formatThaiShortDate(selectedDate)})
                            </button>
                            <button type="button" onclick="openPeriodSettingsModal()"
                                class="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-700 border border-rose-200 dark:border-rose-700/60 text-rose-600 dark:text-rose-400 font-bold text-xs transition active:scale-95 flex items-center gap-1">
                                ⚙️ ระบุวันมารอบล่าสุด
                            </button>
                        </div>
                    </div>
                `;
            } else {
                phaseBoxEl.innerHTML = `
                    <div class="p-3 sm:p-3.5 rounded-xl bg-gradient-to-br from-rose-50/70 via-pink-50/40 to-white dark:from-slate-800/90 dark:via-rose-950/20 dark:to-slate-800 border border-rose-200/80 dark:border-rose-900/50 space-y-2.5">
                        <div class="flex items-start justify-between gap-2">
                            <div class="flex items-center gap-2">
                                <span class="text-lg">${cycleInfo.phaseIcon}</span>
                                <div>
                                    <div class="flex items-center gap-2 flex-wrap">
                                        <span class="text-xs font-bold text-rose-700 dark:text-rose-300">${cycleInfo.phaseName}</span>
                                        <span class="text-[10px] px-2 py-0.5 rounded-full font-bold ${cycleInfo.phaseBadgeClass}">Day ${cycleInfo.currentCycleDay}/${cycleInfo.cycleLength}</span>
                                    </div>
                                    <p class="text-[11px] text-slate-600 dark:text-slate-300 font-medium leading-relaxed mt-0.5">${cycleInfo.tipTitle}</p>
                                </div>
                            </div>
                            <button type="button" onclick="openPeriodSettingsModal()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs p-1 rounded-md transition" title="ตั้งค่ารอบเดือน">
                                ⚙️
                            </button>
                        </div>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px] text-slate-600 dark:text-slate-300">
                            <div class="p-2 rounded-lg bg-white/80 dark:bg-slate-700/60 border border-slate-200/60 dark:border-slate-700">
                                <span class="font-bold text-rose-600 dark:text-rose-400 block mb-0.5">🥗 แนะนำโภชนาการ:</span>
                                <span>${cycleInfo.nutritionAdvice}</span>
                            </div>
                            <div class="p-2 rounded-lg bg-white/80 dark:bg-slate-700/60 border border-slate-200/60 dark:border-slate-700">
                                <span class="font-bold text-indigo-600 dark:text-indigo-400 block mb-0.5">🏋️‍♀️ แนะนำการฝึก:</span>
                                <span>${cycleInfo.workoutAdvice}</span>
                            </div>
                        </div>
                    </div>
                `;
            }
        }

        // Daily Period Toggle Button for selectedDate
        const toggleBtn = document.getElementById('btnTogglePeriodDay');
        if (toggleBtn) {
            if (dayData.isPeriod) {
                toggleBtn.className = 'w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 text-white font-bold text-xs sm:text-sm shadow-sm transition active:scale-98 flex items-center justify-center gap-2';
                toggleBtn.innerHTML = `<span>🩸</span> <span>มีประจำเดือนในวันนี้ (${formatThaiShortDate(selectedDate)}) • แตะเพื่อยกเลิก</span>`;
            } else {
                toggleBtn.className = 'w-full py-2.5 px-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 dark:hover:bg-rose-900/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-300 font-bold text-xs sm:text-sm shadow-xs transition active:scale-98 flex items-center justify-center gap-2';
                toggleBtn.innerHTML = `<span>➕</span> <span>บันทึกประจำเดือนสำหรับวันนี้ (${formatThaiShortDate(selectedDate)})</span>`;
            }
        }

        // Flow Level Container
        const flowContainer = document.getElementById('periodFlowSection');
        const flowButtonsContainer = document.getElementById('periodFlowButtons');
        if (flowContainer && flowButtonsContainer) {
            if (dayData.isPeriod) {
                flowContainer.classList.remove('hidden');
                flowButtonsContainer.innerHTML = PERIOD_FLOWS.map(f => {
                    const isSelected = dayData.flow === f.id;
                    const btnClass = isSelected
                        ? 'py-2 px-2.5 rounded-xl text-xs font-bold bg-rose-500 text-white shadow-xs border border-rose-600 transition active:scale-95'
                        : 'py-2 px-2.5 rounded-xl text-xs font-medium bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:border-rose-400 transition active:scale-95';
                    return `
                        <button type="button" onclick="setPeriodFlow('${f.id}')" class="${btnClass}">
                            <span class="block text-sm">${f.icon}</span>
                            <span class="block text-[11px] mt-0.5">${f.label}</span>
                        </button>
                    `;
                }).join('');
            } else {
                flowContainer.classList.add('hidden');
            }
        }

        // Symptoms Container
        const symptomsContainer = document.getElementById('periodSymptomsGrid');
        if (symptomsContainer) {
            const currentSymptoms = Array.isArray(dayData.symptoms) ? dayData.symptoms : [];
            symptomsContainer.innerHTML = PERIOD_SYMPTOMS.map(s => {
                const isChecked = currentSymptoms.includes(s.id);
                const chipClass = isChecked
                    ? 'py-1.5 px-2.5 rounded-xl text-xs font-bold bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-400 dark:border-rose-600 shadow-2xs flex items-center gap-1.5 transition active:scale-95'
                    : 'py-1.5 px-2.5 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-rose-300 transition active:scale-95 flex items-center gap-1.5';
                return `
                    <button type="button" onclick="togglePeriodSymptom('${s.id}')" class="${chipClass}">
                        <span>${s.icon}</span>
                        <span>${s.label}</span>
                        ${isChecked ? '<span class="text-[10px] font-black ml-auto">✓</span>' : ''}
                    </button>
                `;
            }).join('');
        }

        // Daily Notes
        const notesInput = document.getElementById('periodNotesInput');
        if (notesInput && document.activeElement !== notesInput) {
            notesInput.value = dayData.notes || '';
        }
    }

    /**
     * Toggle period on/off for active date
     */
    function togglePeriodToday() {
        const appState = getAppStateSafe();
        if (!appState) return;

        const dateStr = appState.selectedDate || new Date().toISOString().split('T')[0];
        if (!appState.periodByDate) appState.periodByDate = {};
        if (!appState.periodTracker) {
            appState.periodTracker = { cycleLength: 28, periodDuration: 5, lastPeriodStart: '' };
        }

        const existing = appState.periodByDate[dateStr] || { isPeriod: false, flow: '', symptoms: [], notes: '' };
        const willBePeriod = !existing.isPeriod;

        existing.isPeriod = willBePeriod;
        if (willBePeriod) {
            if (!existing.flow) existing.flow = 'medium';
            // If lastPeriodStart is empty or current date is after or equal, update lastPeriodStart
            if (!appState.periodTracker.lastPeriodStart || dateStr >= appState.periodTracker.lastPeriodStart) {
                appState.periodTracker.lastPeriodStart = dateStr;
            }
            playSoundSafe('pop');
            showToastSafe(`🩸 บันทึกประจำเดือนวันที่ ${formatThaiShortDate(dateStr)} เรียบร้อย`);
        } else {
            playSoundSafe('pop');
            showToastSafe(`ลบบันทึกประจำเดือนวันที่ ${formatThaiShortDate(dateStr)}`);
        }

        appState.periodByDate[dateStr] = existing;
        saveStateSafe();
        renderPeriodTracker();
    }

    /**
     * Set selected date as new cycle start date
     */
    function setPeriodTodayAsStart() {
        const appState = getAppStateSafe();
        if (!appState) return;

        const dateStr = appState.selectedDate || new Date().toISOString().split('T')[0];
        if (!appState.periodTracker) {
            appState.periodTracker = { cycleLength: 28, periodDuration: 5, lastPeriodStart: '' };
        }
        if (!appState.periodByDate) appState.periodByDate = {};

        appState.periodTracker.lastPeriodStart = dateStr;
        const dayData = appState.periodByDate[dateStr] || { isPeriod: false, flow: '', symptoms: [], notes: '' };
        dayData.isPeriod = true;
        if (!dayData.flow) dayData.flow = 'medium';
        appState.periodByDate[dateStr] = dayData;

        saveStateSafe();
        playSoundSafe('celebrate');
        showToastSafe(`🌸 เริ่มรอบเดือนใหม่ตั้งแต่วันที่ ${formatThaiShortDate(dateStr)}`);
        renderPeriodTracker();
    }

    /**
     * Set bleeding flow level for active date
     */
    function setPeriodFlow(flowId) {
        const appState = getAppStateSafe();
        if (!appState) return;

        const dateStr = appState.selectedDate || new Date().toISOString().split('T')[0];
        if (!appState.periodByDate) appState.periodByDate = {};
        const dayData = appState.periodByDate[dateStr] || { isPeriod: true, flow: '', symptoms: [], notes: '' };

        dayData.isPeriod = true;
        dayData.flow = flowId;
        appState.periodByDate[dateStr] = dayData;

        playSoundSafe('pop');
        saveStateSafe();
        renderPeriodTracker();
    }

    /**
     * Toggle symptom chip for active date
     */
    function togglePeriodSymptom(symptomId) {
        const appState = getAppStateSafe();
        if (!appState) return;

        const dateStr = appState.selectedDate || new Date().toISOString().split('T')[0];
        if (!appState.periodByDate) appState.periodByDate = {};
        const dayData = appState.periodByDate[dateStr] || { isPeriod: false, flow: '', symptoms: [], notes: '' };

        let symptoms = Array.isArray(dayData.symptoms) ? [...dayData.symptoms] : [];
        const idx = symptoms.indexOf(symptomId);
        if (idx >= 0) {
            symptoms.splice(idx, 1);
        } else {
            symptoms.push(symptomId);
        }

        dayData.symptoms = symptoms;
        appState.periodByDate[dateStr] = dayData;

        playSoundSafe('pop');
        saveStateSafe();
        renderPeriodTracker();
    }

    /**
     * Save notes typed by user
     */
    function onPeriodNotesInput(text) {
        const appState = getAppStateSafe();
        if (!appState) return;

        const dateStr = appState.selectedDate || new Date().toISOString().split('T')[0];
        if (!appState.periodByDate) appState.periodByDate = {};
        const dayData = appState.periodByDate[dateStr] || { isPeriod: false, flow: '', symptoms: [], notes: '' };

        dayData.notes = text || '';
        appState.periodByDate[dateStr] = dayData;

        clearTimeout(window._periodNotesTimer);
        window._periodNotesTimer = setTimeout(() => {
            saveStateSafe();
        }, 400);
    }

    /**
     * Open Period Settings Modal
     */
    function openPeriodSettingsModal() {
        const appState = getAppStateSafe();
        if (!appState) return;

        const tracker = appState.periodTracker || { cycleLength: 28, periodDuration: 5, lastPeriodStart: '' };
        const cycleLenEl = document.getElementById('inputCycleLength');
        const periodDurEl = document.getElementById('inputPeriodDuration');
        const lastStartEl = document.getElementById('inputLastPeriodStart');

        if (cycleLenEl) cycleLenEl.value = tracker.cycleLength || 28;
        if (periodDurEl) periodDurEl.value = tracker.periodDuration || 5;
        if (lastStartEl) lastStartEl.value = tracker.lastPeriodStart || appState.selectedDate || '';

        openModalAnimatedSafe('periodSettingsModal');
    }

    /**
     * Close Period Settings Modal
     */
    function closePeriodSettingsModal() {
        closeModalAnimatedSafe('periodSettingsModal');
    }

    /**
     * Save cycle settings from modal
     */
    function savePeriodSettings() {
        const appState = getAppStateSafe();
        if (!appState) return;

        const cycleLenEl = document.getElementById('inputCycleLength');
        const periodDurEl = document.getElementById('inputPeriodDuration');
        const lastStartEl = document.getElementById('inputLastPeriodStart');

        const cycleLength = Math.max(21, Math.min(45, parseInt(cycleLenEl?.value, 10) || 28));
        const periodDuration = Math.max(2, Math.min(10, parseInt(periodDurEl?.value, 10) || 5));
        const lastPeriodStart = lastStartEl?.value ? lastStartEl.value.trim() : '';

        appState.periodTracker = {
            cycleLength,
            periodDuration,
            lastPeriodStart
        };

        if (lastPeriodStart && appState.periodByDate) {
            const dayData = appState.periodByDate[lastPeriodStart] || { isPeriod: false, flow: '', symptoms: [], notes: '' };
            dayData.isPeriod = true;
            if (!dayData.flow) dayData.flow = 'medium';
            appState.periodByDate[lastPeriodStart] = dayData;
        }

        saveStateSafe();
        closePeriodSettingsModal();
        playSoundSafe('celebrate');
        showToastSafe('บันทึกการตั้งค่ารอบเดือนเรียบร้อย 🌸');
        renderPeriodTracker();
    }

    // Export functions to window
    if (typeof window !== 'undefined') {
        window.renderPeriodTracker = renderPeriodTracker;
        window.calculateCycleInfo = calculateCycleInfo;
        window.togglePeriodToday = togglePeriodToday;
        window.setPeriodTodayAsStart = setPeriodTodayAsStart;
        window.setPeriodFlow = setPeriodFlow;
        window.togglePeriodSymptom = togglePeriodSymptom;
        window.onPeriodNotesInput = onPeriodNotesInput;
        window.openPeriodSettingsModal = openPeriodSettingsModal;
        window.closePeriodSettingsModal = closePeriodSettingsModal;
        window.savePeriodSettings = savePeriodSettings;
    }

})();
