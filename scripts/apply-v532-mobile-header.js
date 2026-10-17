#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const indexPath = path.join(ROOT_DIR, 'public', 'index.html');
const appPath = path.join(ROOT_DIR, 'public', 'app.js');
const swPath = path.join(ROOT_DIR, 'public', 'sw.js');
const versionPath = path.join(ROOT_DIR, 'public', 'version.json');
const testCdpPath = path.join(ROOT_DIR, 'scripts', 'test-browser-cdp.js');

console.log('Applying v5.3.2 Mobile-first Header Optimization...');

// 1. UPDATE public/version.json
const versionData = {
    version: "5.3.2",
    buildDate: "2026-10-17T12:05:00+07:00",
    title: "NovaFit Pro v5.3.2 - Mobile-first Header Optimization & Unified Tools Settings",
    features: [
        "📱 Mobile-first Header: ย้ายปุ่มตั้งค่าร่างกายเข้าไปรวมในเมนูเครื่องมือ ⚙️ เพื่อแก้ปัญหาปุ่มเบียดกันบนจอมือถือ และป้องกันการแสดงผล Login ทับกับการซิงค์ข้อมูล",
        "⚙️ จัดการครบจบในเมนูเดียว: แตะ '⚙️ จัดการ' มุมบนขวาเพื่อตั้งค่าร่างกาย, สัดส่วน Macro, คัดลอกสรุป LINE, แชร์การ์ด หรือสำรองข้อมูล",
        "🎯 ปุ่มปรับเป้าหมายในหน้าแรก: แตะปุ่ม '⚙️ ปรับเป้าหมาย' ในกล่องเป้าหมายประจำวัน เพื่อเปิดแผงตั้งค่าได้ทันทีโดยไม่ต้องเปิดเมนู",
        "✨ ล็อกขนาด Header บนจอมือถือ: ซ่อนป้ายข้อความซิงค์ยาวๆ บนจอมือถือ คงไว้เฉพาะจุดไฟเขียวบนรูปโปรไฟล์ ป้องกันการทับซ้อน 100%"
    ]
};
fs.writeFileSync(versionPath, JSON.stringify(versionData, null, 2), 'utf8');
console.log('✔ public/version.json updated to 5.3.2');

// 2. UPDATE public/sw.js
let sw = fs.readFileSync(swPath, 'utf8');
sw = sw.replace(/v5\.3\.1/g, 'v5.3.2');
fs.writeFileSync(swPath, sw, 'utf8');
console.log('✔ public/sw.js updated to 5.3.2');

// 3. UPDATE public/app.js
let app = fs.readFileSync(appPath, 'utf8');
app = app.replace(/const APP_VERSION = '5\.3\.1';/, "const APP_VERSION = '5.3.2';");
fs.writeFileSync(appPath, app, 'utf8');
console.log('✔ public/app.js updated to 5.3.2');

// 4. UPDATE public/index.html
let html = fs.readFileSync(indexPath, 'utf8');

// A. Add CSS rule to keep #cloudStatusBadge hidden on mobile (< 768px)
const cssMarker = '/* Apple iOS Modal Backdrop Blur & Transitions */';
const mobileHeaderCss = `/* Mobile-first Header Cleanliness: hide text sync badge on mobile to prevent crowding */
        @media (max-width: 767px) {
            #cloudStatusBadge {
                display: none !important;
            }
        }

        /* Apple iOS Modal Backdrop Blur & Transitions */`;
html = html.replace(cssMarker, mobileHeaderCss);

// B. Remove btnHeaderProfileSettings and add Profile Settings as first item in toolsDropdownMenu
const oldHeaderRightSection = `<!-- Profile & Macro Settings Drawer Button (Apple iOS Style) -->
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
                    </button>

                    <!-- Tools Dropdown Popover -->
                    <div id="toolsDropdownMenu"
                        class="hidden absolute right-0 mt-2 w-60 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xl p-2.5 z-50 text-xs space-y-1 animate-pop">
                        <div class="px-2.5 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            แชร์ & รายงาน
                        </div>`;

const newHeaderRightSection = `<!-- Tools & Profile Settings Unified Menu -->
                <div class="relative">
                    <button type="button" onclick="toggleToolsMenu()" id="btnToolsMenu"
                        class="text-xs px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-700/80 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 font-bold transition flex items-center gap-1 shadow-xs active:scale-95"
                        title="เมนูตั้งค่าร่างกาย เครื่องมือ และการแชร์">
                        <span>⚙️</span>
                        <span class="hidden sm:inline">จัดการ</span>
                        <span class="text-[10px]">▼</span>
                    </button>

                    <!-- Tools Dropdown Popover -->
                    <div id="toolsDropdownMenu"
                        class="hidden absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xl p-2.5 z-50 text-xs space-y-1.5 animate-pop">
                        
                        <!-- 1. Profile & Macro Settings (Prominent Card at the Top) -->
                        <div class="px-2.5 py-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center justify-between">
                            <span>ร่างกาย & เป้าหมาย</span>
                            <span class="text-[9px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-full font-bold">หลัก</span>
                        </div>
                        <button type="button" onclick="openProfileSettingsModal(); toggleToolsMenu();" id="btnToolsProfileSettings"
                            class="w-full text-left p-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-2.5 transition active:scale-95 border border-emerald-500/25">
                            <span class="text-base p-1.5 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0">⚙️</span>
                            <div class="min-w-0 flex-1">
                                <div class="leading-tight font-bold text-xs truncate">ตั้งค่าข้อมูลร่างกาย & Macro</div>
                                <div class="text-[10px] font-normal text-slate-500 dark:text-slate-400 truncate">น้ำหนัก ส่วนสูง และสัดส่วนอาหาร</div>
                            </div>
                        </button>

                        <div class="border-t border-slate-100 dark:border-slate-700/80 my-1 pt-1.5 px-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            แชร์ & รายงาน
                        </div>`;

if (!html.includes(oldHeaderRightSection)) {
    throw new Error('Could not find oldHeaderRightSection in index.html');
}
html = html.replace(oldHeaderRightSection, newHeaderRightSection);

// C. Update version query strings to v=5.3.2
html = html.replace(/v5\.3\.1/g, 'v5.3.2');

fs.writeFileSync(indexPath, html, 'utf8');
console.log('✔ public/index.html updated to 5.3.2');

// 5. UPDATE scripts/test-browser-cdp.js
let testCdp = fs.readFileSync(testCdpPath, 'utf8');
testCdp = testCdp.replace(
    /const hasHeaderBtn = await evalJs\('!!document\.getElementById\("btnHeaderProfileSettings"\)'\);/,
    'const hasHeaderBtn = await evalJs(\'!!document.getElementById("btnToolsProfileSettings")\');'
);
fs.writeFileSync(testCdpPath, testCdp, 'utf8');
console.log('✔ scripts/test-browser-cdp.js updated');

console.log('All v5.3.2 updates completed successfully.');
