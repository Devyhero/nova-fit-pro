#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const indexPath = path.join(ROOT_DIR, 'public', 'index.html');
const appPath = path.join(ROOT_DIR, 'public', 'app.js');

console.log('Applying v5.3.1 Apple-grade Smooth UI & Profile Drawer Enhancements...');

// ==========================================
// 1. UPDATE public/index.html
// ==========================================
let html = fs.readFileSync(indexPath, 'utf8');

// A. Replace CSS <style> block
const oldStyleRegex = /<style>[\s\S]*?<\/style>/i;
const newStyle = `<style>
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

        /* Apple iOS Design System & Spring Physics */
        :root {
            --ios-spring: cubic-bezier(0.32, 0.72, 0, 1);
            --ios-spring-snappy: cubic-bezier(0.16, 1, 0.3, 1);
        }

        /* Apple Native Active Touch Feedback */
        button, .apple-tap, input[type="button"], input[type="submit"] {
            -webkit-tap-highlight-color: transparent;
            touch-action: manipulation;
            transition: transform 0.15s var(--ios-spring-snappy), opacity 0.15s ease, background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
        }
        button:active:not(:disabled), .apple-tap:active, input[type="button"]:active, input[type="submit"]:active {
            transform: scale(0.965);
        }

        /* Apple iOS Modal Backdrop Blur & Transitions */
        .modal-backdrop-smooth {
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.28s var(--ios-spring);
        }
        .modal-backdrop-smooth.modal-open {
            opacity: 1 !important;
            pointer-events: auto !important;
        }

        /* Apple iOS Sheet & Dialog Panel Animation */
        .modal-sheet-panel {
            transform: translateY(100%);
            opacity: 0.5;
            transition: transform 0.34s var(--ios-spring), opacity 0.25s ease;
            will-change: transform, opacity;
        }
        @media (min-width: 640px) {
            .modal-sheet-panel {
                transform: scale(0.95) translateY(12px);
                opacity: 0;
                transition: transform 0.28s var(--ios-spring), opacity 0.25s ease;
            }
        }
        .modal-open .modal-sheet-panel {
            transform: translateY(0) !important;
            opacity: 1 !important;
        }
        @media (min-width: 640px) {
            .modal-open .modal-sheet-panel {
                transform: scale(1) translateY(0) !important;
                opacity: 1 !important;
            }
        }

        /* Apple Accordion Fluid Collapsing & Expanding */
        .accordion-section {
            transition: max-height 0.35s var(--ios-spring), opacity 0.25s ease, padding 0.35s var(--ios-spring);
            max-height: 2500px;
            opacity: 1;
            overflow: visible;
        }
        .accordion-section.is-collapsed {
            max-height: 0 !important;
            opacity: 0 !important;
            padding-top: 0 !important;
            padding-bottom: 0 !important;
            overflow: hidden !important;
            pointer-events: none !important;
        }
        .accordion-chevron {
            display: inline-block;
            transition: transform 0.32s var(--ios-spring);
        }
        .accordion-chevron.icon-collapsed {
            transform: rotate(-90deg);
        }

        @keyframes pop {
            0% { transform: scale(0.96); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
        }
        .animate-pop { animation: pop 0.22s var(--ios-spring-snappy) forwards; }
    </style>`;

if (!oldStyleRegex.test(html)) {
    throw new Error('Could not find <style> block in index.html');
}
html = html.replace(oldStyleRegex, newStyle);

// B. Header: Add dedicated "⚙️ ข้อมูลร่างกาย" button and separate "🛠️ เครื่องมือ"
const oldHeaderToolsRegex = /<!-- Sleek Tools Dropdown Menu -->\s*<div class="relative">\s*<button onclick="toggleToolsMenu\(\)" id="btnToolsMenu"[\s\S]*?<\/button>/;
const newHeaderTools = `<!-- Profile & Macro Settings Drawer Button (Apple iOS Style) -->
                <button type="button" onclick="openProfileSettingsModal()" id="btnHeaderProfileSettings"
                    class="text-xs px-2.5 sm:px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-bold transition flex items-center gap-1.5 shadow-xs active:scale-95"
                    title="ตั้งค่าข้อมูลร่างกาย & สัดส่วน Macro">
                    <span>⚙️</span>
                    <span class="hidden sm:inline">ข้อมูลร่างกาย</span>
                </button>

                <!-- Tools & Share Dropdown Menu -->
                <div class="relative">
                    <button type="button" onclick="toggleToolsMenu()" id="btnToolsMenu"
                        class="text-xs px-2 sm:px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-700/80 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 font-bold transition flex items-center gap-1 shadow-xs active:scale-95"
                        title="เครื่องมือ จัดการข้อมูล และแชร์">
                        <span>🛠️</span>
                        <span class="hidden sm:inline">เครื่องมือ</span>
                        <span class="text-[10px]">▼</span>
                    </button>`;

if (!oldHeaderToolsRegex.test(html)) {
    throw new Error('Could not find header tools menu in index.html');
}
html = html.replace(oldHeaderToolsRegex, newHeaderTools);

// Update tools dropdown changelog label to v5.3.1
html = html.replace(/ประวัติอัปเดต \(v5\.3\.0\)/g, 'ประวัติอัปเดต (v5.3.1)');

// C. Date bar: Add pastDateAlertBanner and remove section 2 (compact profile strip)
const oldDateSectionEndRegex = /<\/div>\s*<\/div>\s*<\/section>\s*<!-- 2\. COMPACT PROFILE & TARGET STRIP[\s\S]*?<\/section>/;
const newDateSectionEnd = `</div>
            </div>

            <!-- Past Date Alert Banner (Visible only when looking at past/different date) -->
            <div id="pastDateAlertBanner" class="hidden mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/80 flex items-center justify-between gap-2 flex-wrap animate-pop">
                <span class="text-xs text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1.5">
                    <span>⚠️</span> กำลังดูข้อมูลย้อนหลัง: <b id="pastDateAlertText" class="font-bold"></b>
                </span>
                <button type="button" onclick="goToToday()" class="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold shadow-xs active:scale-95 transition flex items-center gap-1">
                    <span>⚡ กลับสู่วันปัจจุบัน (วันนี้)</span>
                </button>
            </div>
        </section>`;

if (!oldDateSectionEndRegex.test(html)) {
    throw new Error('Could not find Date Section end and Compact Profile Strip in index.html');
}
html = html.replace(oldDateSectionEndRegex, newDateSectionEnd);

// D. Add "⚙️ ปรับเป้าหมาย" shortcut button in Hero Target Summary card
const oldHeroHeaderRegex = /<h2 class="text-base sm:text-lg font-bold">🎯 เป้าหมายและสถานะวันนี้<\/h2>\s*<span id="heroDayTypeBadge"[\s\S]*?<\/span>/;
const newHeroHeader = `<h2 class="text-base sm:text-lg font-bold">🎯 เป้าหมายและสถานะวันนี้</h2>
                        <span id="heroDayTypeBadge"
                            class="text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                            🏋️ วันซ้อม (มาตรฐาน)
                        </span>
                        <button type="button" onclick="openProfileSettingsModal()"
                            class="text-xs px-2.5 py-0.5 rounded-full font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 transition active:scale-95 flex items-center gap-1 shadow-xs"
                            title="เปิดแผงตั้งค่าข้อมูลร่างกาย & Macro">
                            ⚙️ ปรับเป้าหมาย
                        </button>`;

if (!oldHeroHeaderRegex.test(html)) {
    throw new Error('Could not find Hero target header in index.html');
}
html = html.replace(oldHeroHeaderRegex, newHeroHeader);

// E. Add accordion classes and chevrons to sections
html = html.replace('id="icon_section_water" class="text-xs text-slate-400"', 'id="icon_section_water" class="accordion-chevron text-xs text-slate-400"');
html = html.replace('id="body_section_water" class="p-5 pt-0 space-y-3"', 'id="body_section_water" class="accordion-section p-5 pt-0 space-y-3"');

html = html.replace('id="icon_section_supplements" class="text-xs text-slate-400"', 'id="icon_section_supplements" class="accordion-chevron text-xs text-slate-400"');
html = html.replace('id="body_section_supplements" class="p-5 pt-0 space-y-3"', 'id="body_section_supplements" class="accordion-section p-5 pt-0 space-y-3"');

html = html.replace('id="icon_section_workout" class="text-xs text-slate-400"', 'id="icon_section_workout" class="accordion-chevron text-xs text-slate-400"');
html = html.replace('id="body_section_workout" class="p-4 sm:p-5 pt-0 space-y-3 w-full max-w-full min-w-0 overflow-hidden"', 'id="body_section_workout" class="accordion-section p-4 sm:p-5 pt-0 space-y-3 w-full max-w-full min-w-0 overflow-hidden"');

html = html.replace('id="icon_section_food_search" class="text-xs text-slate-400"', 'id="icon_section_food_search" class="accordion-chevron text-xs text-slate-400"');
html = html.replace('id="body_section_food_search" class="p-3.5 sm:p-5 pt-0 space-y-4 max-w-full overflow-hidden"', 'id="body_section_food_search" class="accordion-section p-3.5 sm:p-5 pt-0 space-y-4 max-w-full overflow-hidden"');

html = html.replace('id="icon_section_meals" class="text-xs text-slate-400"', 'id="icon_section_meals" class="accordion-chevron text-xs text-slate-400"');
html = html.replace('id="body_section_meals" class="p-4 sm:p-5"', 'id="body_section_meals" class="accordion-section p-4 sm:p-5"');

html = html.replace('id="icon_section_analytics" class="text-xs text-slate-400"', 'id="icon_section_analytics" class="accordion-chevron text-xs text-slate-400"');
html = html.replace('id="body_section_analytics" class="p-5 pt-0 space-y-3"', 'id="body_section_analytics" class="accordion-section p-5 pt-0 space-y-3"');

html = html.replace('id="icon_section_recommendations" class="text-xs text-slate-400"', 'id="icon_section_recommendations" class="accordion-chevron text-xs text-slate-400"');
html = html.replace('id="body_section_recommendations" class="p-5 pt-0 space-y-3"', 'id="body_section_recommendations" class="accordion-section p-5 pt-0 space-y-3"');

// F. In Analytics body, add Quick Return to Today banner
const oldAnalyticsBodyStart = '<div id="body_section_analytics" class="accordion-section p-5 pt-0 space-y-3">\n                    <div class="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">';
const newAnalyticsBodyStart = `<div id="body_section_analytics" class="accordion-section p-5 pt-0 space-y-3">
                    <!-- Quick Return to Today Banner inside Analytics -->
                    <div id="analyticsReturnToTodayBanner" class="hidden p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-between gap-2 animate-pop">
                        <span class="text-xs text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-1">
                            <span>📅 กำลังดูสถิติย้อนหลัง:</span>
                            <span id="analyticsSelectedDateText" class="font-bold underline"></span>
                        </span>
                        <button type="button" onclick="goToToday()"
                            class="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-xs active:scale-95 transition flex items-center gap-1">
                            <span>⚡ กลับสู่วันนี้</span>
                        </button>
                    </div>

                    <div class="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">`;

if (html.includes(oldAnalyticsBodyStart)) {
    html = html.replace(oldAnalyticsBodyStart, newAnalyticsBodyStart);
}

// G. Upgrade profileSettingsModal to Apple iOS Sheet / Modal
const oldProfileModalRegex = /<!-- MODAL 6: Profile & Macro Settings Drawer[\s\S]*?<div id="profileSettingsModal"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/;

// Let's inspect the entire profileSettingsModal block to replace cleanly
const profileModalStartIdx = html.indexOf('<div id="profileSettingsModal"');
const profileModalEndIdx = html.indexOf('<!-- Core Food Database -->');

if (profileModalStartIdx === -1 || profileModalEndIdx === -1) {
    throw new Error('Could not locate profileSettingsModal boundaries');
}

const newProfileModal = `<div id="profileSettingsModal"
        class="hidden fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-hidden modal-backdrop-smooth"
        onclick="closeProfileSettingsOnBackdrop(event)">
        <div onclick="event.stopPropagation()"
            class="modal-sheet-panel relative bg-white dark:bg-slate-800 border-t sm:border border-slate-200 dark:border-slate-700 rounded-t-[32px] sm:rounded-3xl max-w-3xl w-full p-4 sm:p-6 shadow-2xl space-y-4 my-0 sm:my-auto max-h-[92vh] flex flex-col">
            <!-- iOS Drag Handle for mobile -->
            <div class="w-12 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full mx-auto -mt-1 mb-1 sm:hidden"></div>

            <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3 shrink-0">
                <div class="flex items-center gap-2.5">
                    <div class="w-9 h-9 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-lg font-bold">
                        ⚙️
                    </div>
                    <div>
                        <h3 class="font-bold text-base sm:text-lg leading-tight text-slate-900 dark:text-slate-100">ตั้งค่าข้อมูลร่างกาย & สัดส่วน Macro</h3>
                        <p class="text-xs text-slate-400">คำนวณอัตโนมัติด้วยสมการ Mifflin-St Jeor ตามเป้าหมายของคุณ</p>
                    </div>
                </div>
                <button type="button" onclick="closeProfileSettingsModal()"
                    class="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-300 font-bold flex items-center justify-center text-sm transition active:scale-90"
                    title="ปิด">✕</button>
            </div>

            <!-- Active Profile Summary Pills inside Drawer -->
            <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700/60 shrink-0">
                <div class="text-[11px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">สถานะร่างกายปัจจุบัน</div>
                <div id="compactProfilePills" class="flex flex-wrap items-center gap-1.5 text-xs"></div>
            </div>

            <div class="overflow-y-auto pr-1 flex-1">
                <div id="settingsCollapseBody"
                    class="p-1 grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                <!-- 1. ข้อมูลร่างกาย & กิจกรรม -->
                <div
                    class="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/70 dark:border-slate-700 space-y-4">
                    <div class="flex items-center justify-between">
                        <h3 class="text-sm font-bold">1. ข้อมูลร่างกาย & กิจกรรม</h3>
                        <span id="bmiBadge"
                            class="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700">BMI: 22.9</span>
                    </div>

                    <div class="grid grid-cols-2 gap-2">
                        <button type="button" id="btnMale" onclick="setGender('male')"
                            class="py-1.5 rounded-xl font-medium text-xs border transition">♂ ผู้ชาย</button>
                        <button type="button" id="btnFemale" onclick="setGender('female')"
                            class="py-1.5 rounded-xl font-medium text-xs border transition">♀ ผู้หญิง</button>
                    </div>

                    <div class="space-y-3">
                        <div>
                            <div class="flex justify-between text-xs mb-1">
                                <span class="text-slate-500 dark:text-slate-400">อายุ (ปี)</span>
                                <input type="number" id="numAge" min="15" max="90"
                                    class="w-14 text-right font-semibold bg-transparent border-b border-slate-300 dark:border-slate-600 focus:outline-none"
                                    oninput="syncProfileInput('age', this.value)">
                            </div>
                            <input type="range" id="rangeAge" min="15" max="90" class="w-full"
                                oninput="syncProfileInput('age', this.value)">
                        </div>

                        <div>
                            <div class="flex justify-between text-xs mb-1">
                                <span class="text-slate-500 dark:text-slate-400">น้ำหนัก (กก.)</span>
                                <input type="number" id="numWeight" min="35" max="180" step="0.5"
                                    class="w-16 text-right font-semibold bg-transparent border-b border-slate-300 dark:border-slate-600 focus:outline-none"
                                    oninput="syncProfileInput('weight', this.value)">
                            </div>
                            <input type="range" id="rangeWeight" min="35" max="150" step="0.5" class="w-full"
                                oninput="syncProfileInput('weight', this.value)">
                        </div>

                        <div>
                            <div class="flex justify-between text-xs mb-1">
                                <span class="text-slate-500 dark:text-slate-400">ส่วนสูง (ซม.)</span>
                                <input type="number" id="numHeight" min="130" max="220"
                                    class="w-14 text-right font-semibold bg-transparent border-b border-slate-300 dark:border-slate-600 focus:outline-none"
                                    oninput="syncProfileInput('height', this.value)">
                            </div>
                            <input type="range" id="rangeHeight" min="130" max="210" class="w-full"
                                oninput="syncProfileInput('height', this.value)">
                        </div>

                        <div>
                            <label class="block text-xs text-slate-500 dark:text-slate-400 mb-1">ระดับกิจกรรม</label>
                            <select id="selActivity" onchange="updateActivity(this.value)"
                                class="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none">
                                <option value="1.2">นั่งทำงานอยู่กับที่ (x1.2)</option>
                                <option value="1.375">ออกกำลังกายเบาๆ 1-3 วัน/สัปดาห์ (x1.375)</option>
                                <option value="1.55">ออกกำลังกายปานกลาง/เวท 3-5 วัน (x1.55)</option>
                                <option value="1.725">ออกกำลังกายหนัก 6-7 วัน/สัปดาห์ (x1.725)</option>
                                <option value="1.9">นักกีฬา / ซ้อมหนักเช้า-เย็น (x1.9)</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- 2. เป้าหมายแคลอรี -->
                <div
                    class="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/70 dark:border-slate-700 space-y-4">
                    <h3 class="text-sm font-bold">2. เป้าหมายแคลอรี (Goal)</h3>
                    <div class="grid grid-cols-3 gap-2">
                        <button type="button" onclick="setGoalPreset(-20)" id="goalCut"
                            class="py-2 px-2 rounded-xl text-xs font-semibold border transition">
                            🔥 ลดไขมัน (-20%)
                        </button>
                        <button type="button" onclick="setGoalPreset(0)" id="goalMaintain"
                            class="py-2 px-2 rounded-xl text-xs font-semibold border transition">
                            ⚖️ รักษาน้ำหนัก (0%)
                        </button>
                        <button type="button" onclick="setGoalPreset(15)" id="goalBulk"
                            class="py-2 px-2 rounded-xl text-xs font-semibold border transition">
                            💪 เพิ่มกล้าม (+15%)
                        </button>
                    </div>

                    <div class="pt-2">
                        <div class="flex justify-between text-xs mb-1">
                            <span class="text-slate-500 dark:text-slate-400">ปรับความเข้มข้นแคลอรี</span>
                            <span id="lblCalDiff" class="font-bold text-emerald-500">0%</span>
                        </div>
                        <input type="range" id="rangeGoalDiff" min="-35" max="35" step="1" class="w-full"
                            oninput="updateGoalDiff(this.value)">
                        <p id="lblWeightTrend" class="text-xs text-slate-400 mt-1 text-right">แนวโน้มน้ำหนัก: คงที่</p>
                    </div>
                </div>

                <!-- 3. สัดส่วนสารอาหารหลัก -->
                <div
                    class="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/70 dark:border-slate-700 space-y-3">
                    <div class="flex items-center justify-between">
                        <h3 class="text-sm font-bold">3. สัดส่วนสารอาหารหลัก (Macros)</h3>
                        <span class="text-xs text-slate-400">รวม 100%</span>
                    </div>

                    <div class="grid grid-cols-2 gap-1.5">
                        <button id="macroPresetBalanced" onclick="setMacroPreset(30,40,30)"
                            class="text-xs py-1.5 px-2 rounded-lg border font-medium transition">สมดุล 30/40/30</button>
                        <button id="macroPresetMuscle" onclick="setMacroPreset(35,40,25)"
                            class="text-xs py-1.5 px-2 rounded-lg border font-medium transition">สร้างกล้าม 35/40/25</button>
                        <button id="macroPresetLowCarb" onclick="setMacroPreset(40,20,40)"
                            class="text-xs py-1.5 px-2 rounded-lg border font-medium transition">โลว์คาร์บ 40/20/40</button>
                        <button id="macroPreset2g" onclick="setProtein2gPerKg()"
                            class="text-xs py-1.5 px-2 rounded-lg border font-semibold transition">โปรตีน 2g/นน.ตัว</button>
                    </div>

                    <div class="space-y-2 text-xs pt-1">
                        <div>
                            <div class="flex justify-between mb-0.5">
                                <span class="font-medium text-blue-500">🥩 โปรตีน (Protein)</span>
                                <span id="lblPctP" class="font-bold">30%</span>
                            </div>
                            <input type="range" id="rangeP" min="10" max="70" class="w-full"
                                oninput="adjustMacros('p', this.value)">
                        </div>
                        <div>
                            <div class="flex justify-between mb-0.5">
                                <span class="font-medium text-amber-500">🍚 คาร์โบไฮเดรต (Carbs)</span>
                                <span id="lblPctC" class="font-bold">40%</span>
                            </div>
                            <input type="range" id="rangeC" min="5" max="75" class="w-full"
                                oninput="adjustMacros('c', this.value)">
                        </div>
                        <div>
                            <div class="flex justify-between mb-0.5">
                                <span class="font-medium text-rose-500">🥑 ไขมันดี (Fat)</span>
                                <span id="lblPctF" class="font-bold">30%</span>
                            </div>
                            <input type="range" id="rangeF" min="10" max="70" class="w-full"
                                oninput="adjustMacros('f', this.value)">
                        </div>
                    </div>
                </div>
                </div>
            </div>

            <div class="pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 shrink-0">
                <span class="text-[11px] text-slate-400 hidden sm:inline">การเปลี่ยนแปลงทั้งหมดจะถูกบันทึกอัตโนมัติ</span>
                <button type="button" onclick="closeProfileSettingsModal()"
                    class="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-xs sm:text-sm font-bold shadow-xs transition flex items-center justify-center gap-1.5">
                    ✓ เรียบร้อย (บันทึก & ปิด)
                </button>
            </div>
        </div>
    </div>\n\n    `;

html = html.substring(0, profileModalStartIdx) + newProfileModal + html.substring(profileModalEndIdx);

// H. Upgrade other modals: quickAddModal and addSupplementModal to modal-backdrop-smooth and modal-sheet-panel
html = html.replace(
    'id="quickAddModal"\n        class="hidden fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"\n        onclick="closeQuickAddOnBackdrop(event)">\n        <div onclick="event.stopPropagation()"\n            class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4 animate-pop">',
    'id="quickAddModal"\n        class="hidden fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 modal-backdrop-smooth"\n        onclick="closeQuickAddOnBackdrop(event)">\n        <div onclick="event.stopPropagation()"\n            class="modal-sheet-panel bg-white dark:bg-slate-800 border-t sm:border border-slate-200 dark:border-slate-700 rounded-t-[32px] sm:rounded-3xl max-w-sm w-full p-5 shadow-2xl space-y-4 my-0 sm:my-auto">'
);

html = html.replace(
    'id="addSupplementModal"\n        class="hidden fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"\n        onclick="closeAddSupplementModalOnBackdrop(event)">\n        <div onclick="event.stopPropagation()"\n            class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4 animate-pop">',
    'id="addSupplementModal"\n        class="hidden fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 modal-backdrop-smooth"\n        onclick="closeAddSupplementModalOnBackdrop(event)">\n        <div onclick="event.stopPropagation()"\n            class="modal-sheet-panel bg-white dark:bg-slate-800 border-t sm:border border-slate-200 dark:border-slate-700 rounded-t-[32px] sm:rounded-3xl max-w-sm w-full p-5 shadow-2xl space-y-4 my-0 sm:my-auto">'
);

// I. Bump script version query strings to v=5.3.1
html = html.replace(/food-db\.js\?v=5\.3\.0/g, 'food-db.js?v=5.3.1');
html = html.replace(/app\.js\?v=5\.3\.0/g, 'app.js?v=5.3.1');
html = html.replace(/firebase-sync\.js\?v=5\.3\.0/g, 'firebase-sync.js?v=5.3.1');

fs.writeFileSync(indexPath, html, 'utf8');
console.log('✔ public/index.html updated successfully');

// ==========================================
// 2. UPDATE public/app.js
// ==========================================
let app = fs.readFileSync(appPath, 'utf8');

// A. Update renderSettingsCollapseState
const oldRenderCollapseRegex = /function renderSettingsCollapseState\(\) \{[\s\S]*?if \(state\.settingsCollapsed\) \{[\s\S]*?text\.textContent = 'ซ่อนแผงตั้งค่าร่างกาย';\s*\}\s*\}/;
const newRenderCollapse = `function renderSettingsCollapseState() {
            const body = document.getElementById('settingsCollapseBody');
            const icon = document.getElementById('toggleSettingsIcon');
            const text = document.getElementById('toggleSettingsText');
            const p = state.profile;
            const bmi = (p.weight / Math.pow(p.height / 100, 2)).toFixed(1);
            const goalLabel = p.goalDiff < 0 ? \`ลดไขมัน (\${p.goalDiff}%)\` : p.goalDiff > 0 ? \`เพิ่มกล้าม (+\${p.goalDiff}%)\` : 'รักษาน้ำหนัก (0%)';

            const compactPills = document.getElementById('compactProfilePills');
            if (compactPills) {
                compactPills.innerHTML = \`
                    <span class="px-2.5 py-1 rounded-lg bg-slate-200/70 dark:bg-slate-700 font-medium">\${p.gender === 'male' ? '♂ ชาย' : '♀ หญิง'} \${p.age} ปี</span>
                    <span class="px-2.5 py-1 rounded-lg bg-slate-200/70 dark:bg-slate-700 font-medium">นน. \${p.weight} กก. / สูง \${p.height} ซม. (BMI \${bmi})</span>
                    <span class="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold">\${goalLabel}</span>
                    <span class="px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 font-semibold">Macro \${p.macros.p}/\${p.macros.c}/\${p.macros.f}%</span>
                \`;
            }

            if (body) {
                body.classList.remove('hidden');
            }
            if (icon) icon.textContent = '⚙️';
            if (text) text.textContent = 'ตั้งค่าข้อมูลร่างกาย & สัดส่วน Macro';
        }`;

if (!oldRenderCollapseRegex.test(app)) {
    throw new Error('Could not find renderSettingsCollapseState in app.js');
}
app = app.replace(oldRenderCollapseRegex, newRenderCollapse);

// B. Update toggleCardSection for Apple fluid accordion
const oldToggleCardSectionRegex = /function toggleCardSection\(sectionId\) \{[\s\S]*?\/\/ 2\. Debounced non-blocking localStorage save/;
const newToggleCardSection = `function toggleCardSection(sectionId) {
            if (!state.collapsedSections) state.collapsedSections = {};
            const isNowCollapsed = !state.collapsedSections[sectionId];
            state.collapsedSections[sectionId] = isNowCollapsed;

            // Fluid Apple-grade Accordion Toggle
            const body = document.getElementById('body_' + sectionId);
            const icon = document.getElementById('icon_' + sectionId);
            if (body) {
                body.classList.remove('hidden');
                body.classList.add('accordion-section');
                if (isNowCollapsed) {
                    body.classList.add('is-collapsed');
                } else {
                    body.classList.remove('is-collapsed');
                }
            }
            if (icon) {
                icon.classList.add('accordion-chevron');
                if (isNowCollapsed) {
                    icon.classList.add('icon-collapsed');
                } else {
                    icon.classList.remove('icon-collapsed');
                }
            }

            // 2. Debounced non-blocking localStorage save`;

if (!oldToggleCardSectionRegex.test(app)) {
    throw new Error('Could not find toggleCardSection in app.js');
}
app = app.replace(oldToggleCardSectionRegex, newToggleCardSection);

// C. Update renderAllSectionCollapses
const oldRenderAllCollapsesRegex = /function renderAllSectionCollapses\(\) \{[\s\S]*?sections\.forEach\(id => \{[\s\S]*?\}\);\s*\}/;
const newRenderAllCollapses = `function renderAllSectionCollapses() {
            if (!state.collapsedSections) state.collapsedSections = {};
            const sections = [
                'section_water',
                'section_meals',
                'section_food_search',
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
                    body.classList.remove('hidden');
                    body.classList.add('accordion-section');
                    if (isCollapsed) {
                        body.classList.add('is-collapsed');
                    } else {
                        body.classList.remove('is-collapsed');
                    }
                }
                if (icon) {
                    icon.classList.add('accordion-chevron');
                    if (isCollapsed) {
                        icon.classList.add('icon-collapsed');
                    } else {
                        icon.classList.remove('icon-collapsed');
                    }
                }
            });
        }`;

if (!oldRenderAllCollapsesRegex.test(app)) {
    throw new Error('Could not find renderAllSectionCollapses in app.js');
}
app = app.replace(oldRenderAllCollapsesRegex, newRenderAllCollapses);

// D. Update renderWeeklyAnalytics: anchor to Today so 7 days do not disappear, and show return to today banner
const oldRenderWeeklyAnalyticsRegex = /function renderWeeklyAnalytics\(targets\) \{[\s\S]*?for \(let i = 6; i >= 0; i--\) \{[\s\S]*?const borderClass = d\.isSelected[\s\S]*?\}\)\.join\(''\);\s*\}/;

const newRenderWeeklyAnalytics = `function renderWeeklyAnalytics(targets) {
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
            badge.textContent = \`ความสม่ำเสมอ: \${consistencyPct}% (\${daysWithLogs}/7 วัน)\`;
            badge.className = consistencyPct >= 70
                ? 'px-2 py-0.5 rounded-full font-bold text-xs bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                : 'px-2 py-0.5 rounded-full font-bold text-xs bg-amber-500/15 text-amber-600 dark:text-amber-400';

            const avgCal = daysWithLogs > 0 ? Math.round(totalCal7Days / daysWithLogs) : 0;
            avgText.textContent = \`เฉลี่ย: \${avgCal.toLocaleString()} kcal/วัน\`;

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
                        trendBadge.innerHTML = \`📉 นน. สัปดาห์นี้: \${diffW} กก.\`;
                    } else if (diffW > 0) {
                        trendBadge.className = 'px-2 py-0.5 rounded-full font-bold text-xs bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30';
                        trendBadge.innerHTML = \`📈 นน. สัปดาห์นี้: +\${diffW} กก.\`;
                    } else {
                        trendBadge.className = 'px-2 py-0.5 rounded-full font-bold text-xs bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30';
                        trendBadge.innerHTML = \`⚖️ นน. สัปดาห์นี้: คงที่ (±0.0 กก.)\`;
                    }
                } else if (weightsWithIdx.length === 1) {
                    trendBadge.className = 'px-2 py-0.5 rounded-full font-bold text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-slate-600';
                    trendBadge.innerHTML = \`⚖️ นน. ล่าสุด: \${weightsWithIdx[0].weight} กก.\`;
                } else {
                    trendBadge.className = 'px-2 py-0.5 rounded-full font-bold text-xs bg-slate-100 dark:bg-slate-700 text-slate-400 border border-slate-200 dark:border-slate-600';
                    trendBadge.innerHTML = \`⚖️ ยังไม่มีบันทึก นน. 7 วันนี้\`;
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

                    const polylinePoints = points.map(p => \`\${p.x},\${p.y}\`).join(' ');

                    const dotsSvg = points.map(p => \`
                        <g>
                            <circle cx="\${p.x}" cy="\${p.y}" r="3.5" fill="#0284c7" stroke="#ffffff" stroke-width="1.5" />
                            <text x="\${p.x}" y="\${Math.max(10, p.y - 6)}" text-anchor="middle" font-size="8.5" font-weight="bold" fill="#0284c7">\${p.weight}</text>
                        </g>
                    \`).join('');

                    trendContainer.innerHTML = \`
                        <div class="px-2 py-1.5 rounded-xl bg-sky-500/5 dark:bg-sky-500/10 border border-sky-500/15 space-y-1">
                            <div class="flex items-center justify-between text-[11px] text-sky-600 dark:text-sky-400 font-semibold px-1">
                                <span>📈 แนวโน้มน้ำหนักตัว (บันทึก \${weightsWithIdx.length}/7 วัน)</span>
                                <span>\${minW.toFixed(1)} - \${maxW.toFixed(1)} กก.</span>
                            </div>
                            <svg viewBox="0 0 350 44" class="w-full h-11 overflow-visible">
                                <defs>
                                    <linearGradient id="trendLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                        <stop offset="0%" stop-color="#0284c7" />
                                        <stop offset="100%" stop-color="#38bdf8" />
                                    </linearGradient>
                                </defs>
                                <polyline fill="none" stroke="url(#trendLineGrad)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" points="\${polylinePoints}" />
                                \${dotsSvg}
                            </svg>
                        </div>
                    \`;
                } else if (weightsWithIdx.length === 1) {
                    const p = weightsWithIdx[0];
                    trendContainer.innerHTML = \`
                        <div class="p-2 rounded-xl bg-slate-100/60 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-center text-xs text-slate-400 flex items-center justify-between">
                            <span>⚖️ บันทึกแล้ว 1 วัน (\${p.weight} กก.) ชั่งเพิ่มอีก 1 วันเพื่อแสดงกราฟเส้นแนวโน้ม</span>
                            <button onclick="switchBodyTab('weight')" class="text-sky-500 hover:underline font-bold text-xs">+ บันทึก นน.</button>
                        </div>
                    \`;
                } else {
                    trendContainer.innerHTML = \`
                        <div class="p-2 rounded-xl bg-slate-100/40 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700/60 text-center text-xs text-slate-400 flex items-center justify-between">
                            <span>⚖️ ชั่งน้ำหนักเพื่อดูกราฟเส้นแนวโน้มคู่กับแคลอรีที่ทาน</span>
                            <button onclick="switchBodyTab('weight')" class="text-emerald-500 hover:underline font-bold text-xs">+ บันทึก นน. วันนี้</button>
                        </div>
                    \`;
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
                    ? \`<span class="text-[9px] font-bold text-sky-500 block truncate">\${d.dayWeight}k</span>\`
                    : '';

                return \`
                    <button type="button" onclick="onDateChange('\${d.iso}')"
                        class="flex flex-col items-center justify-end p-1.5 rounded-xl border transition group h-28 \${borderClass} active:scale-95"
                        title="\${d.iso}: \${d.eatenCal.toLocaleString()} kcal (เป้าหมาย \${targetCal.toLocaleString()} kcal)\${d.burnedCal > 0 ? \` [เบิร์น -\${d.burnedCal} kcal]\` : ''}">
                        <div class="w-full flex-1 flex items-end justify-center pb-1">
                            <div class="w-full max-w-[20px] rounded-t-md transition-all duration-300 relative \${barColor}" style="height: \${barHeightPx}px;">
                                \${d.burnedCal > 0 ? '<span class="absolute -top-3 left-1/2 -translate-x-1/2 text-[8px]">🔥</span>' : ''}
                            </div>
                        </div>
                        <div class="text-center w-full pt-1 border-t border-slate-100 dark:border-slate-700/50">
                            <span class="text-[10px] block font-semibold \${d.isSelected ? 'text-emerald-500 font-bold' : (d.isToday ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-500 dark:text-slate-400')}">\${d.shortDay} \${d.isToday ? '📍' : d.dayNum}</span>
                            <span class="text-[9px] block font-bold text-slate-700 dark:text-slate-200 truncate">\${d.eatenCal > 0 ? d.eatenCal : '-'}</span>
                            \${weightBadge}
                        </div>
                    </button>
                \`;
            }).join('');
        }`;

if (!oldRenderWeeklyAnalyticsRegex.test(app)) {
    throw new Error('Could not find renderWeeklyAnalytics in app.js');
}
app = app.replace(oldRenderWeeklyAnalyticsRegex, newRenderWeeklyAnalytics);

// E. Add generic modal helpers openModalAnimated & closeModalAnimated and update modal functions
const oldProfileModalFnsRegex = /\/\/ ==========================================\s*\/\/ NEW v5\.3\.0: PROFILE SETTINGS DRAWER & QUICK ADD[\s\S]*?function submitQuickAddMeal/;

const newProfileModalFns = `// ==========================================
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

function submitQuickAddMeal`;

if (!oldProfileModalFnsRegex.test(app)) {
    throw new Error('Could not find profile modal functions in app.js');
}
app = app.replace(oldProfileModalFnsRegex, newProfileModalFns);

// F. Update other modals (addSupplementModal, dailyReportModal, changelogModal, shareCardModal) to use openModalAnimated & closeModalAnimated
app = app.replace(
    /modal\.classList\.remove\('hidden'\);\s*modal\.style\.display = 'flex';\s*document\.body\.style\.overflow = 'hidden';\s*setTimeout\(\(\) => \{\s*if \(inName\) inName\.focus\(\);\s*\}, 100\);/g,
    "openModalAnimated('addSupplementModal', () => { if (inName) inName.focus(); });"
);

app = app.replace(
    /function closeAddSupplementModal\(\) \{\s*const modal = document\.getElementById\('addSupplementModal'\);[\s\S]*?document\.body\.style\.overflow = '';\s*\}\s*\}/,
    "function closeAddSupplementModal() {\n            closeModalAnimated('addSupplementModal');\n        }"
);

// G. Ensure renderAll doesn't clobber active typing input
app = app.replace(
    "document.getElementById('numAge').value = p.age;",
    "if (document.activeElement !== document.getElementById('numAge')) document.getElementById('numAge').value = p.age;"
);
app = app.replace(
    "document.getElementById('numWeight').value = p.weight;",
    "if (document.activeElement !== document.getElementById('numWeight')) document.getElementById('numWeight').value = p.weight;"
);
app = app.replace(
    "document.getElementById('numHeight').value = p.height;",
    "if (document.activeElement !== document.getElementById('numHeight')) document.getElementById('numHeight').value = p.height;"
);

// H. Make goToToday show quick toast
app = app.replace(
    /function goToToday\(\) \{\s*state\.selectedDate = getTodayStr\(\);\s*saveState\(\);\s*renderAll\(\);\s*\}/,
    "function goToToday() {\n            state.selectedDate = getTodayStr();\n            saveState();\n            renderAll();\n            showToast('📅 กลับสู่วันปัจจุบัน (วันนี้) เรียบร้อย');\n        }"
);

fs.writeFileSync(appPath, app, 'utf8');
console.log('✔ public/app.js updated successfully');

console.log('All updates written to disk. Ready for preflight verification!');
