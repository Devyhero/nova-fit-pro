#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const PORT = 8195;

const server = http.createServer((req, res) => {
    let filePath = path.join(PUBLIC_DIR, req.url.split('?')[0]);
    if (filePath.endsWith(path.sep) || req.url === '/') {
        filePath = path.join(PUBLIC_DIR, 'index.html');
    }
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.svg': 'image/svg+xml'
    };

    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404);
            res.end('Not found');
        } else {
            res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
            res.end(content);
        }
    });
});

server.listen(PORT, async () => {
    console.log(`Test server running at http://localhost:${PORT}`);

    let chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    if (process.platform === 'win32') {
        const winChromePaths = [
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
            'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
        ];
        chromePath = winChromePaths.find(p => fs.existsSync(p)) || 'chrome';
    }
    const testUserDataDir = path.join(require('os').tmpdir(), 'novafit-chrome-test');
    try { fs.rmSync(testUserDataDir, { recursive: true, force: true }); } catch (e) {}
    const chrome = spawn(chromePath, [
        '--headless=new',
        '--disable-gpu',
        '--remote-debugging-port=9227',
        `--user-data-dir=${testUserDataDir}`,
        '--no-first-run',
        '--no-default-browser-check',
        `http://localhost:${PORT}`
    ]);

    const httpGet = (url) => new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });

    try {
        let targets = null;
        for (let attempt = 0; attempt < 25; attempt++) {
            await new Promise(r => setTimeout(r, 400));
            try {
                targets = await httpGet('http://127.0.0.1:9227/json');
                if (targets && targets.length > 0) break;
            } catch (e) {}
        }
        if (!targets || !Array.isArray(targets)) {
            throw new Error('Chrome remote debugging did not respond at http://127.0.0.1:9227/json');
        }
        const pageTarget = targets.find(t => t.type === 'page' && t.url.includes(PORT.toString()));
        if (!pageTarget || !pageTarget.webSocketDebuggerUrl) {
            throw new Error('No page target found for http://localhost:' + PORT);
        }

        const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
        await new Promise((resolve, reject) => {
            ws.onopen = resolve;
            ws.onerror = reject;
        });

        let msgId = 1;
        const sendCdp = (method, params = {}) => new Promise((resolve, reject) => {
            const id = msgId++;
            const handler = (evt) => {
                const res = JSON.parse(evt.data);
                if (res.id === id) {
                    ws.removeEventListener('message', handler);
                    if (res.error) reject(res.error);
                    else resolve(res.result);
                }
            };
            ws.addEventListener('message', handler);
            ws.send(JSON.stringify({ id, method, params }));
        });

        const evalJs = async (expr, retries = 3) => {
            try {
                const res = await sendCdp('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
                if (res.exceptionDetails) {
                    console.error('JS EVAL ERROR:', res.exceptionDetails);
                }
                return res.result ? res.result.value : null;
            } catch (err) {
                if (retries > 0 && err && err.message && err.message.includes('Execution context was destroyed')) {
                    await new Promise(r => setTimeout(r, 400));
                    return evalJs(expr, retries - 1);
                }
                throw err;
            }
        };

        // Enable Page & Runtime and navigate to ensure fresh lifecycle
        await sendCdp('Page.enable');
        await sendCdp('Runtime.enable');
        await sendCdp('Page.navigate', { url: `http://localhost:${PORT}/` });

        // Wait for page load and initialization
        for (let i = 0; i < 50; i++) {
            try {
                const ready = await evalJs('document.readyState === "complete" && !!document.getElementById("btnToolsProfileSettings")');
                if (ready) break;
            } catch (e) {}
            await new Promise(r => setTimeout(r, 250));
        }
        await new Promise(r => setTimeout(r, 600));

        // Test 1: Check Header Profile Drawer Button
        console.log('DEBUG URL:', await evalJs('location.href'), 'readyState:', await evalJs('document.readyState'));
        console.log('--- Test 1: Header Profile Drawer Button ---');
        const hasHeaderBtn = await evalJs('!!document.getElementById("btnToolsProfileSettings")');
        console.log('Header profile settings button exists:', hasHeaderBtn);
        if (!hasHeaderBtn) throw new Error('Missing #btnHeaderProfileSettings');

        // Test 2: Check Old Section 2 (Compact Profile Strip) is Removed from Main Screen
        console.log('--- Test 2: Old Profile Strip Removed ---');
        const oldStripInMain = await evalJs('!!document.querySelector("main section[onclick*=\\"openProfileSettingsModal\\"]")');
        console.log('Old profile strip in main screen exists:', oldStripInMain);
        if (oldStripInMain) throw new Error('Old section 2 profile strip is still in main screen!');

        // Test 3: Open Profile Settings Modal & Verify Inputs are NOT hidden
        console.log('--- Test 3: Open Profile Settings Drawer ---');
        await evalJs('openProfileSettingsModal()');
        await evalJs('new Promise(r => setTimeout(r, 350))');
        const modalOpenClass = await evalJs('document.getElementById("profileSettingsModal").classList.contains("modal-open")');
        const settingsBodyHidden = await evalJs('document.getElementById("settingsCollapseBody").classList.contains("hidden")');
        const numWeightVal = await evalJs('document.getElementById("numWeight").value');
        console.log('Modal has .modal-open:', modalOpenClass);
        console.log('settingsCollapseBody is hidden:', settingsBodyHidden);
        console.log('numWeight input value:', numWeightVal);
        if (!modalOpenClass || settingsBodyHidden) throw new Error('Profile drawer failed to open or body is hidden');

        // Test 4: Live Input Sync in Drawer
        console.log('--- Test 4: Live Input Sync & Calculation ---');
        await evalJs('syncProfileInput("weight", 70)');
        const updatedWeight = await evalJs('state.profile.weight');
        const targetCalText = await evalJs('document.getElementById("resTargetCal").textContent');
        console.log('Updated state weight:', updatedWeight);
        console.log('Updated Target Calories text:', targetCalText);
        if (updatedWeight !== 70) throw new Error('Profile weight not updated');

        // Test 5: Close Profile Drawer
        console.log('--- Test 5: Close Profile Drawer ---');
        await evalJs('closeProfileSettingsModal()');
        await new Promise(r => setTimeout(r, 450));
        const modalHidden = await evalJs('document.getElementById("profileSettingsModal").classList.contains("hidden")');
        console.log('Profile modal hidden after close:', modalHidden);
        if (!modalHidden) throw new Error('Profile modal did not close');

        // Test 6: Weekly Analytics Past Date Click & Return to Today
        console.log('--- Test 6: Weekly Analytics Date Selection ---');
        const todayStr = await evalJs('getTodayStr()');
        console.log('Today ISO date:', todayStr);

        // Click past date (shift -2 days)
        await evalJs('shiftDate(-2)');
        await evalJs('new Promise(r => setTimeout(r, 200))');
        const selectedPastDate = await evalJs('state.selectedDate');
        const returnBannerHidden = await evalJs('document.getElementById("analyticsReturnToTodayBanner").classList.contains("hidden")');
        const topPastBannerHidden = await evalJs('document.getElementById("pastDateAlertBanner").classList.contains("hidden")');
        const weekBarsCount = await evalJs('document.getElementById("weekHistoryBar").children.length');
        console.log('Selected date after shift -2:', selectedPastDate);
        console.log('Analytics return banner visible (not hidden):', !returnBannerHidden);
        console.log('Top date alert banner visible (not hidden):', !topPastBannerHidden);
        console.log('Week bars count (still 7 days):', weekBarsCount);
        if (returnBannerHidden || topPastBannerHidden || weekBarsCount !== 7) {
            throw new Error('Past date UX failed: banners not shown or 7 days broken');
        }

        // Test 7: Click "Return to Today"
        console.log('--- Test 7: Return to Today ---');
        await evalJs('goToToday()');
        await evalJs('new Promise(r => setTimeout(r, 200))');
        const returnDate = await evalJs('state.selectedDate');
        const returnBannerHiddenAfter = await evalJs('document.getElementById("analyticsReturnToTodayBanner").classList.contains("hidden")');
        console.log('Date after goToToday():', returnDate);
        console.log('Return banner hidden after returning to today:', returnBannerHiddenAfter);
        if (returnDate !== todayStr || !returnBannerHiddenAfter) {
            throw new Error('Failed to return to today');
        }

        // Test 8: Fluid Accordion Toggle
        console.log('--- Test 8: Accordion Section Animation ---');
        await evalJs('toggleCardSection("section_water")');
        const waterCollapsed = await evalJs('document.getElementById("body_section_water").classList.contains("is-collapsed")');
        const waterChevronRotated = await evalJs('document.getElementById("icon_section_water").classList.contains("icon-collapsed")');
        console.log('Water section has .is-collapsed:', waterCollapsed);
        console.log('Water chevron has .icon-collapsed:', waterChevronRotated);
        if (!waterCollapsed || !waterChevronRotated) {
            throw new Error('Accordion collapsible failed');
        }

        // Test 9: Mobile Viewport Stability (Workout Collapsed & Food Search Permanently Open)
        console.log('--- Test 9: Mobile Viewport Stability (Workout Collapsed & Food Search Permanently Open) ---');
        await evalJs('toggleCardSection("section_workout")');
        await new Promise(r => setTimeout(r, 200));

        const collapseStatus = await evalJs(`(() => {
            const sections = Array.from(document.querySelectorAll('main section'));
            const rects = sections.map(s => {
                const r = s.getBoundingClientRect();
                return {
                    title: s.querySelector('h2, h3')?.textContent?.trim()?.slice(0, 25) || '',
                    height: Math.round(r.height),
                    visible: r.height > 0 && r.width > 0
                };
            });
            const allVisible = rects.every(r => r.visible);
            const foodBody = document.getElementById('body_section_food_search');
            const workoutBody = document.getElementById('body_section_workout');
            const foodCard = foodBody.parentElement;
            const workoutCard = workoutBody.parentElement;

            return {
                allVisible,
                rects,
                foodBodyHidden: foodBody.classList.contains('hidden'),
                workoutBodyHidden: workoutBody.classList.contains('hidden'),
                foodCardHeight: Math.round(foodCard.getBoundingClientRect().height),
                workoutCardHeight: Math.round(workoutCard.getBoundingClientRect().height),
                hasHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
            };
        })()`);

        console.log('All sections remain visible after collapse:', collapseStatus.allVisible);
        console.log('Food search body hidden (should be false - permanently open):', collapseStatus.foodBodyHidden);
        console.log('Workout body hidden (should be true):', collapseStatus.workoutBodyHidden);
        console.log('Food card height:', collapseStatus.foodCardHeight);
        console.log('Workout card collapsed height:', collapseStatus.workoutCardHeight);
        console.log('Has horizontal overflow:', collapseStatus.hasHorizontalOverflow);

        if (!collapseStatus.allVisible || collapseStatus.foodBodyHidden || !collapseStatus.workoutBodyHidden || collapseStatus.hasHorizontalOverflow) {
            throw new Error('Mobile collapse stability test failed: sections clipped or overflowed');
        }

        // Test 10: Zero-contents Architecture & Responsive Desktop Sync
        console.log('--- Test 10: Zero-contents Architecture & Responsive Desktop Sync ---');
        const contentsCount = await evalJs('document.querySelectorAll(".contents").length');
        console.log('Count of .contents elements in DOM (should be 0):', contentsCount);
        if (contentsCount !== 0) {
            throw new Error('Found .contents elements in DOM! Must be 0.');
        }

        // Test desktop layout sync
        await evalJs('(() => { Object.defineProperty(window, "innerWidth", { value: 1280, configurable: true }); syncResponsiveLayout(); })()');
        const desktopLeftCount = await evalJs('document.getElementById("colDesktopLeft").children.length');
        const desktopRightCount = await evalJs('document.getElementById("colDesktopRight").children.length');
        console.log('Desktop left column card count:', desktopLeftCount);
        console.log('Desktop right column card count:', desktopRightCount);
        if (desktopLeftCount !== 4 || desktopRightCount !== 4) {
            throw new Error(`Desktop sync failed: Left=${desktopLeftCount}, Right=${desktopRightCount}`);
        }

        // Restore mobile layout
        await evalJs('(() => { Object.defineProperty(window, "innerWidth", { value: 390, configurable: true }); syncResponsiveLayout(); })()');
        const mobileCardCount = await evalJs('document.getElementById("colDesktopLeft").children.length');
        console.log('Mobile column card count (should be 8):', mobileCardCount);
        if (mobileCardCount !== 8) {
            throw new Error(`Mobile restore failed: Count=${mobileCardCount}`);
        }

        // Test 11: Automatic Breakfast Rollover on Date Change & New Day
        console.log('--- Test 11: Automatic Breakfast Rollover on Date Change & New Day ---');
        // Set meal to dinner first
        await evalJs('setActiveMeal("dinner")');
        let currentMeal = await evalJs('state.activeMeal');
        console.log('Active meal set to dinner:', currentMeal === 'dinner');
        if (currentMeal !== 'dinner') throw new Error('Failed to set active meal to dinner');

        // Change date to past day - should automatically revert to breakfast
        await evalJs('onDateChange("2026-10-15")');
        currentMeal = await evalJs('state.activeMeal');
        console.log('Active meal after date change to 2026-10-15 (should be breakfast):', currentMeal);
        if (currentMeal !== 'breakfast') throw new Error('Active meal did not reset to breakfast on date change');

        // Set meal to snack, then trigger day rollover
        await evalJs('setActiveMeal("snack")');
        await evalJs('(() => { state.lastActiveDate = "2026-10-18"; checkDayRollover(); })()');
        currentMeal = await evalJs('state.activeMeal');
        console.log('Active meal after simulated day rollover (should be breakfast):', currentMeal);
        if (currentMeal !== 'breakfast') throw new Error('Active meal did not reset to breakfast on day rollover');

        // Test 12: First-time Visitor Profile Modal Auto-Prompt Logic
        console.log('--- Test 12: First-time Visitor Onboarding Prompt Logic ---');
        // Simulate save & confirm profile settings (v5.9.13 mandatory lock)
        await evalJs('if (typeof saveAndConfirmProfileSettings === "function") saveAndConfirmProfileSettings(); else if (typeof closeProfileSettingsModal === "function") closeProfileSettingsModal();');
        const profilePrompted = await evalJs('localStorage.getItem("novafit_profile_prompted")');
        console.log('novafit_profile_prompted is recorded:', !!profilePrompted);
        if (!profilePrompted) throw new Error('novafit_profile_prompted was not set');

        // Test 13: Universal Food Search across all categories
        console.log('--- Test 13: Universal Food Search Across All Categories ---');
        // First select a specific category
        await evalJs('selectCategory("cat_dessert")');
        let selectedCat = await evalJs('state.selectedCategory');
        console.log('Selected category set to cat_dessert:', selectedCat);

        // Search for "ไข่" (which has items in protein/dishes/street categories, not just dessert)
        await evalJs('onSearchFood("ไข่")');
        const searchResultsCount = await evalJs('document.querySelectorAll("#quickFoodList > div").length');
        const activeSearchCat = await evalJs('state.selectedCategory');
        console.log('Search results count for "ไข่":', searchResultsCount);
        console.log('Category auto-expanded to all:', activeSearchCat === 'all');
        if (searchResultsCount === 0 || activeSearchCat !== 'all') {
            throw new Error(`Universal search failed: count=${searchResultsCount}, cat=${activeSearchCat}`);
        }

        // Clear search
        await evalJs('clearFoodSearch()');
        const restoredCat = await evalJs('state.selectedCategory');
        console.log('Restored category after search clear:', restoredCat);
        if (restoredCat !== 'cat_dessert') {
            throw new Error('Category was not restored after search clear');
        }

        // Test 14: Quick Meal Picker Modal & Direct Meal Selection
        console.log('--- Test 14: Quick Food Meal Picker Modal ---');
        await evalJs('openFoodMealPicker("ไข่ต้ม", 7, 0.5, 5, 75)');
        await new Promise(r => setTimeout(r, 200));
        const pickerModalVisible = await evalJs('!document.getElementById("foodMealPickerModal").classList.contains("hidden")');
        const pickerTitle = await evalJs('document.getElementById("foodPickerTitle").textContent');
        console.log('Quick meal picker modal visible:', pickerModalVisible);
        console.log('Quick meal picker title:', pickerTitle);
        if (!pickerModalVisible || pickerTitle !== 'ไข่ต้ม') {
            throw new Error('Quick meal picker modal failed to open correctly');
        }

        // Add to dinner via picker
        await evalJs('submitFoodMealPicker("dinner")');
        await new Promise(r => setTimeout(r, 200));
        const lastLog = await evalJs('(() => { const logs = state.logsByDate[state.selectedDate] || []; return logs[logs.length - 1]; })()');
        console.log('Added log meal via picker:', lastLog ? lastLog.meal : null);
        console.log('Added log name via picker:', lastLog ? lastLog.name : null);
        if (!lastLog || lastLog.name !== 'ไข่ต้ม' || lastLog.meal !== 'dinner') {
            throw new Error('Quick meal picker failed to add item to selected meal (dinner)');
        }

        // Test 15: Intermittent Fasting (IF) Timer Engine
        console.log('--- Test 15: Intermittent Fasting (IF) Timer Engine ---');
        // Set plan to 18:6
        await evalJs('setFastingPlan("18:6")');
        let fastingPlan = await evalJs('state.fasting.plan');
        let fastingHours = await evalJs('state.fasting.targetHours');
        console.log('Fasting plan set to 18:6:', fastingPlan === '18:6');
        console.log('Fasting target hours is 18:', fastingHours === 18);
        if (fastingPlan !== '18:6' || fastingHours !== 18) {
            throw new Error(`Fasting plan switch failed: plan=${fastingPlan}, hours=${fastingHours}`);
        }

        // Toggle start fasting
        await evalJs('toggleFastingTimer()');
        let isFastingActive = await evalJs('state.fasting.isFasting');
        let fastingClockText = await evalJs('document.getElementById("fastingTimerClock").textContent');
        console.log('Fasting is active:', isFastingActive);
        console.log('Fasting clock text:', fastingClockText);
        if (!isFastingActive || !fastingClockText) {
            throw new Error('Fasting timer start failed');
        }

        // Test 16: Dynamic Version Badges & Admin Access
        console.log('--- Test 16: Dynamic Version Badges & Admin Access ---');
        const curAppVer = await evalJs('typeof APP_VERSION !== "undefined" ? APP_VERSION : "5.7.0"');
        const headerBadgeText = await evalJs('document.getElementById("headerVersionBadge").textContent');
        const toolsBadgeText = await evalJs('document.getElementById("toolsVersionBadge").textContent');
        console.log('Header version badge text:', headerBadgeText);
        console.log('Tools version badge text:', toolsBadgeText);
        if (!headerBadgeText.includes(curAppVer) || !toolsBadgeText.includes(curAppVer)) {
            throw new Error(`Version badge text mismatch! Header=${headerBadgeText}, Tools=${toolsBadgeText}, Expected=${curAppVer}`);
        }

        // Test 17: IF Collapsible Tab Accordion & Mobile Scroll Clamping
        console.log('--- Test 17: IF Collapsible Tab Accordion & Mobile Scroll Clamping ---');
        await evalJs('toggleFastingCollapse(true)');
        let isBodyHidden = await evalJs('document.getElementById("fastingPanelBody").classList.contains("hidden")');
        let chevronText = await evalJs('document.getElementById("fastingChevron").textContent');
        let collapsedStorage = await evalJs('localStorage.getItem("novafit_fasting_collapsed")');
        console.log('Fasting body hidden on collapse:', isBodyHidden);
        console.log('Fasting chevron text:', chevronText);
        console.log('Fasting collapsed in storage:', collapsedStorage);
        if (!isBodyHidden || chevronText !== '▼' || collapsedStorage !== 'true') {
            throw new Error('Fasting collapse test failed');
        }

        // Expand back
        await evalJs('toggleFastingCollapse(false)');
        let isBodyVisible = await evalJs('!document.getElementById("fastingPanelBody").classList.contains("hidden")');
        console.log('Fasting body expanded on toggle:', isBodyVisible);
        if (!isBodyVisible) {
            throw new Error('Fasting expand test failed');
        }

        // Test Real Header Click Collapse & Expand on IF panel
        await new Promise(r => setTimeout(r, 200));
        await evalJs('document.getElementById("fastingTimerHeader").click()');
        let clickCollapsed = await evalJs('document.getElementById("fastingPanelBody").classList.contains("hidden")');
        console.log('Fasting header click collapsed:', clickCollapsed);
        if (!clickCollapsed) {
            throw new Error('Clicking fastingTimerHeader failed to collapse');
        }

        await new Promise(r => setTimeout(r, 200));
        await evalJs('document.getElementById("fastingTimerHeader").click()');
        let clickExpanded = await evalJs('!document.getElementById("fastingPanelBody").classList.contains("hidden")');
        console.log('Fasting header click re-expanded:', clickExpanded);
        if (!clickExpanded) {
            throw new Error('Clicking fastingTimerHeader failed to re-expand');
        }

        // Test Food Menu Permanently Open & Safe on Click (Zero Freeze Architecture)
        const isFoodHidden = await evalJs('document.getElementById("body_section_food_search").classList.contains("hidden")');
        console.log('Food menu is permanently open (hidden === false):', !isFoodHidden);
        if (isFoodHidden) {
            throw new Error('Food search menu should remain permanently open');
        }

        // Clicking food search card header must safely remain open without freezing or collapsing
        await evalJs('document.querySelector("#card_food_search > div").click()');
        let foodStillOpen = await evalJs('!document.getElementById("body_section_food_search").classList.contains("hidden")');
        console.log('Food menu remains safely open on header click:', foodStillOpen);
        if (!foodStillOpen) {
            throw new Error('Food menu collapsed unexpectedly');
        }

        // Test Meals section accordion collapse & expand with scroll simulation while IF timer is ticking
        await evalJs('window.scrollTo(0, 300)');
        await evalJs('toggleCardSection("section_meals")');
        let mealsHidden = await evalJs('document.getElementById("body_section_meals").classList.contains("hidden")');
        console.log('Meals section collapsed successfully:', mealsHidden);
        if (!mealsHidden) {
            throw new Error('Meals section failed to collapse');
        }

        // Verify scroll clamping on mobile viewport
        const scrollAfter = await evalJs('window.scrollY');
        const maxScrollY = await evalJs('Math.max(0, document.documentElement.scrollHeight - window.innerHeight)');
        console.log('Scroll position after collapse (should be <= maxScrollY):', scrollAfter, 'maxScrollY:', maxScrollY);
        if (scrollAfter > maxScrollY) {
            throw new Error(`Scroll position ${scrollAfter} exceeds maxScrollY ${maxScrollY} (deadlock risk)`);
        }

        // Re-expand meals section
        await new Promise(r => setTimeout(r, 200));
        await evalJs('toggleCardSection("section_meals")');
        let mealsRestored = await evalJs('!document.getElementById("body_section_meals").classList.contains("hidden")');
        console.log('Meals section restored successfully:', mealsRestored);
        if (!mealsRestored) {
            throw new Error('Meals section failed to restore');
        }

        // Test 18: Daily Health Tip Widget & User Notification Bell
        console.log('--- Test 18: Daily Health Tip Widget & User Notification Bell ---');
        const hasTipWidget = await evalJs('!!document.getElementById("dailyHealthTipWidget")');
        const tipTitle = await evalJs('document.getElementById("healthTipTitle").textContent');
        console.log('Health tip widget exists:', hasTipWidget);
        console.log('Current health tip title:', tipTitle);
        if (!hasTipWidget || !tipTitle) {
            throw new Error('Health tip widget missing or empty');
        }

        // Test shuffling health tip
        await evalJs('shuffleHealthTip()');
        const shuffledTitle = await evalJs('document.getElementById("healthTipTitle").textContent');
        console.log('Shuffled health tip title:', shuffledTitle);
        if (!shuffledTitle) {
            throw new Error('Shuffling health tip failed');
        }

        // Test Notification Bell & Inbox Modal
        const hasNotifBtn = await evalJs('!!document.getElementById("btnUserNotifications")');
        console.log('Notification bell button exists in header:', hasNotifBtn);
        if (!hasNotifBtn) {
            throw new Error('Notification bell button missing in header');
        }

        await evalJs('openUserNotificationsModal()');
        const isNotifModalOpen = await evalJs('!document.getElementById("userNotificationsModal").classList.contains("hidden")');
        console.log('Notifications modal open after click:', isNotifModalOpen);
        if (!isNotifModalOpen) {
            throw new Error('User notifications modal open failed');
        }
        await evalJs('closeUserNotificationsModal()');

        // Test 19: Fasting Complete & Celebration Modal
        console.log('--- Test 19: Fasting Complete & Celebration Modal ---');
        const hasFastingModal = await evalJs('!!document.getElementById("fastingCompleteModal")');
        console.log('Fasting Complete Modal exists in DOM:', hasFastingModal);
        if (!hasFastingModal) {
            throw new Error('Fasting Complete Modal element is missing in DOM');
        }

        // Open fasting modal
        await evalJs('openFastingCompleteModal()');
        const isFastingModalOpen = await evalJs('!document.getElementById("fastingCompleteModal").classList.contains("hidden")');
        const durationText = await evalJs('document.getElementById("fastingModalDuration").textContent');
        const modalPlanText = await evalJs('document.getElementById("fastingModalPlanBadge").textContent');
        console.log('Fasting complete modal is visible:', isFastingModalOpen);
        console.log('Fasting duration displayed:', durationText);
        console.log('Fasting plan displayed:', modalPlanText);
        if (!isFastingModalOpen || !durationText || !modalPlanText) {
            throw new Error('Fasting Complete Modal failed to open or populate data');
        }

        // Close fasting complete modal
        await evalJs('closeFastingCompleteModal()');
        const isFastingModalClosed = await evalJs('document.getElementById("fastingCompleteModal").classList.contains("hidden")');
        console.log('Fasting complete modal closed:', isFastingModalClosed);
        if (!isFastingModalClosed) {
            throw new Error('Fasting Complete Modal failed to close');
        }

        // Test 20: Supplements Management (Add, Delete Any, Empty State & Restore Defaults)
        console.log('--- Test 20: Supplement Management (Add, Delete Any & Restore Defaults) ---');
        await evalJs('renderSupplements()');
        const initialSuppCount = await evalJs('(state.supplementList || []).length');
        console.log('Initial supplement count:', initialSuppCount);

        // Add custom supplement
        await evalJs(`
            state.supplementList.push({
                id: 'supp_test_omega',
                name: 'โอเมก้า 3 พรีเมียม',
                time: 'หลังอาหารเช้า',
                icon: '🐟',
                isCustom: true
            });
            saveState();
            renderSupplements();
        `);
        const afterAddCount = await evalJs('(state.supplementList || []).length');
        console.log('Supplement count after adding:', afterAddCount);
        if (afterAddCount !== initialSuppCount + 1) {
            throw new Error(`Supplement add failed! Expected ${initialSuppCount + 1}, got ${afterAddCount}`);
        }

        // Verify that delete button exists for all items
        const suppContainerHtml = await evalJs('document.getElementById("supplementListContainer").innerHTML');
        if (!suppContainerHtml.includes('deleteSupplement(')) {
            throw new Error('Delete button with deleteSupplement() handler not found in supplement list HTML');
        }

        // Test delete item without confirm prompt mock
        await evalJs(`(() => {
            const origConfirm = window.confirm;
            window.confirm = () => true;
            try {
                deleteSupplement('supp_test_omega');
            } finally {
                window.confirm = origConfirm;
            }
        })()`);
        const afterDeleteCount = await evalJs('(state.supplementList || []).length');
        console.log('Supplement count after deleting test item:', afterDeleteCount);
        if (afterDeleteCount !== initialSuppCount) {
            throw new Error(`Supplement delete failed! Expected ${initialSuppCount}, got ${afterDeleteCount}`);
        }

        // Test delete default item (e.g. first item)
        await evalJs(`(() => {
            const firstId = state.supplementList[0].id;
            const origConfirm = window.confirm;
            window.confirm = () => true;
            try {
                deleteSupplement(firstId);
            } finally {
                window.confirm = origConfirm;
            }
        })()`);
        const afterDelDefaultCount = await evalJs('(state.supplementList || []).length');
        console.log('Supplement count after deleting default item:', afterDelDefaultCount);
        if (afterDelDefaultCount !== initialSuppCount - 1) {
            throw new Error(`Deleting default supplement failed! Expected ${initialSuppCount - 1}, got ${afterDelDefaultCount}`);
        }

        // Test restore default supplements
        await evalJs(`(() => {
            const origConfirm = window.confirm;
            window.confirm = () => true;
            try {
                restoreDefaultSupplements();
            } finally {
                window.confirm = origConfirm;
            }
        })()`);
        const restoredCount = await evalJs('(state.supplementList || []).length');
        console.log('Supplement count after restoreDefaultSupplements:', restoredCount);
        if (restoredCount !== 7) {
            throw new Error(`Restore default supplements failed! Expected 7, got ${restoredCount}`);
        }

        // Test 21: AI Snap & Log Modal, Simulation & Meal Save
        console.log('--- Test 21: AI Snap & Log Modal, Simulation & Meal Save ---');
        const hasAiModal = await evalJs('!!document.getElementById("aiSnapModal")');
        console.log('AI Snap Modal exists in DOM:', hasAiModal);
        if (!hasAiModal) {
            throw new Error('AI Snap Modal element is missing in DOM');
        }

        // Open AI Snap Modal
        await evalJs('openAiSnapModal()');
        const isAiModalOpen = await evalJs('!document.getElementById("aiSnapModal").classList.contains("hidden")');
        console.log('AI Snap Modal is visible:', isAiModalOpen);
        if (!isAiModalOpen) {
            throw new Error('AI Snap Modal failed to open');
        }

        // Test Demo Simulation Render
        await evalJs(`
            renderAiAnalysisResult({
                foodName: 'ข้าวกะเพราหมูสับไข่ดาว (AI Test)',
                servingSize: '1 จาน (350 กรัม)',
                cal: 620,
                p: 26,
                c: 65,
                f: 28,
                ingredients: ['ข้าวสวย', 'หมูสับ', 'ไข่ดาว'],
                healthyTip: 'อร่อยและโปรตีนดี'
            }, true);
        `);

        const isResultVisible = await evalJs('!document.getElementById("aiSnapResultState").classList.contains("hidden")');
        const aiFoodNameVal = await evalJs('document.getElementById("aiResFoodName").value');
        console.log('AI Snap result card visible:', isResultVisible);
        console.log('AI Snap food name populated:', aiFoodNameVal);
        if (!isResultVisible || aiFoodNameVal !== 'ข้าวกะเพราหมูสับไข่ดาว (AI Test)') {
            throw new Error('AI Snap failed to render analysis results');
        }

        // Save AI meal into logs
        const logsBefore = await evalJs('(state.logsByDate[state.selectedDate] || []).length');
        await evalJs('saveAiAnalyzedMeal()');
        const logsAfter = await evalJs('(state.logsByDate[state.selectedDate] || []).length');
        console.log('Logs count before AI save:', logsBefore, 'after:', logsAfter);
        if (logsAfter !== logsBefore + 1) {
            throw new Error(`Saving AI meal failed! Expected ${logsBefore + 1}, got ${logsAfter}`);
        }

        const savedAiItem = await evalJs('state.logsByDate[state.selectedDate].find(m => m.name === "ข้าวกะเพราหมูสับไข่ดาว (AI Test)")');
        console.log('Saved AI item has valid id:', !!(savedAiItem && savedAiItem.id));
        if (!savedAiItem || !savedAiItem.id) {
            throw new Error('AI saved item must have a valid id');
        }

        // Test changing meal category on the saved AI item
        await evalJs(`changeMealCategory('${savedAiItem.id}', 'dinner')`);
        const itemMealAfter = await evalJs(`state.logsByDate[state.selectedDate].find(m => m.id === '${savedAiItem.id}').meal`);
        console.log('Saved AI item meal changed to dinner:', itemMealAfter === 'dinner');
        if (itemMealAfter !== 'dinner') {
            throw new Error('Failed to change meal category on AI item');
        }

        // Test deleting the saved AI item
        await evalJs(`removeFoodItem('${savedAiItem.id}')`);
        const logsAfterDelete = await evalJs('(state.logsByDate[state.selectedDate] || []).length');
        console.log('Logs count after deleting AI item:', logsAfterDelete);
        if (logsAfterDelete !== logsBefore) {
            throw new Error(`Failed to delete AI item with id ${savedAiItem.id}`);
        }

        // Test 22: AI Snap Anti-Abuse, Rate Limiting (15/day) & UAT Unlimited Bypass
        console.log('--- Test 22: AI Snap Anti-Abuse, Quotas & UAT Environment Bypass ---');
        const isUatEnv = await evalJs('isUatEnvironment()');
        console.log('Current testing environment is detected as UAT/Localhost:', isUatEnv);
        if (!isUatEnv) {
            throw new Error('Localhost should be detected as UAT/Dev environment');
        }

        // In UAT environment, isAiQuotaExceeded() must be false even if 20 scans were used
        await evalJs(`(() => {
            const today = getTodayStr();
            state.aiDailyScans = { [today]: 20 };
        })()`);
        const isQuotaExceededOnUat = await evalJs('isAiQuotaExceeded()');
        console.log('Is quota exceeded on UAT when usage is 20 (should be false - unlimited):', isQuotaExceededOnUat);
        if (isQuotaExceededOnUat !== false) {
            throw new Error('UAT environment must allow unlimited scans without quota blocks');
        }

        // Quota usage increment check
        const initialUsage = await evalJs('getTodayAiScanUsage()');
        await evalJs('incrementAiScanUsage()');
        const updatedUsage = await evalJs('getTodayAiScanUsage()');
        console.log('AI scan usage incremented:', initialUsage, '->', updatedUsage);
        if (updatedUsage !== initialUsage + 1) {
            throw new Error(`incrementAiScanUsage failed! Expected ${initialUsage + 1}, got ${updatedUsage}`);
        }

        // Test non-UAT simulation: Auth check
        const nonUatAuthCheck = await evalJs(`(() => {
            // Mock non-UAT and logged out
            const origUat = window.isUatEnvironment;
            const origUser = window.currentUser;
            window.isUatEnvironment = () => false;
            window.currentUser = null;
            try {
                openAiSnapModal();
                const authRequiredVisible = !document.getElementById('aiSnapAuthRequiredState').classList.contains('hidden');
                return authRequiredVisible;
            } finally {
                window.isUatEnvironment = origUat;
                window.currentUser = origUser;
            }
        })()`);
        console.log('Non-UAT unauthenticated user is shown Auth Required state:', nonUatAuthCheck);
        if (!nonUatAuthCheck) {
            throw new Error('Non-UAT unauthenticated users must be prompted to log in');
        }

        // Test non-UAT simulation: Daily Quota 15 limit exceeded check
        const nonUatQuotaCheck = await evalJs(`(() => {
            // Mock non-UAT, logged in as normal user, usage >= 15
            const origUat = window.isUatEnvironment;
            const origUser = window.currentUser;
            window.isUatEnvironment = () => false;
            window.currentUser = { email: 'normal_user@example.com' };
            const today = getTodayStr();
            state.aiDailyScans = { [today]: 15 };
            try {
                openAiSnapModal();
                const quotaExceededVisible = !document.getElementById('aiSnapQuotaExceededState').classList.contains('hidden');
                return quotaExceededVisible;
            } finally {
                window.isUatEnvironment = origUat;
                window.currentUser = origUser;
            }
        })()`);
        console.log('Non-UAT user with 15 scans is shown Quota Exceeded state:', nonUatQuotaCheck);
        if (!nonUatQuotaCheck) {
            throw new Error('Non-UAT users with >= 15 scans must be blocked by quota exceeded state');
        }

        await evalJs('closeAiSnapModal()');
        await new Promise(r => setTimeout(r, 350));

        // Test 23: AI Macro Coach & Nutrition Advisory Engine (v5.8.0)
        console.log('--- Test 23: AI Macro Coach & Nutrition Advisory Engine ---');
        const coachSectionExists = await evalJs('!!document.getElementById("card_recommendations")');
        console.log('AI Coach section card exists:', coachSectionExists);
        if (!coachSectionExists) throw new Error('Missing #card_recommendations');

        const coachSubtitle = await evalJs('document.getElementById("recSubtitle").textContent');
        console.log('Coach advice subtitle populated:', !!coachSubtitle);
        if (!coachSubtitle || coachSubtitle.length < 5) throw new Error('AI Coach advice subtitle not populated');

        const macroPillsHtml = await evalJs('document.getElementById("aiCoachMacroPills").innerHTML');
        console.log('Macro gap pills rendered:', macroPillsHtml.includes('โปรตีน'));
        if (!macroPillsHtml.includes('โปรตีน')) throw new Error('AI Coach macro pills must render protein status');

        const recItemsCount = await evalJs('document.querySelectorAll("#smartRecommendationList > div").length');
        console.log('Recommended food items count:', recItemsCount);
        if (recItemsCount === 0) throw new Error('Smart recommendations list must contain candidate foods');

        // Test triggering forceReshuffleRecommendations
        await evalJs('forceReshuffleRecommendations()');
        const statusAfterReshuffle = await evalJs('document.getElementById("aiCoachStatusBadge").textContent');
        console.log('Coach status badge active:', !!statusAfterReshuffle);
        if (!statusAfterReshuffle) throw new Error('AI Coach status badge not active after reshuffle');

        // Test 24: Safe Cloud Sync & Data Merge Integrity (v5.8.1)
        console.log('--- Test 24: Safe Cloud Sync & Non-Destructive Data Merge ---');
        const hasExportFn = await evalJs('typeof window.exportUserDataBackup === "function"');
        console.log('exportUserDataBackup function exists:', hasExportFn);
        if (!hasExportFn) throw new Error('Missing window.exportUserDataBackup');

        const mergeResult = await evalJs(`(() => {
            const mockCloud = {
                logsByDate: {
                    '2026-10-01': [{ id: 'cloud_item_1', name: 'สลัดอกไก่ (Cloud Past)', cal: 250, p: 30, c: 5, f: 5 }]
                },
                profile: { weight: 72, height: 175 }
            };
            window.applyCloudState(mockCloud);
            const pastItemExists = !!(state.logsByDate['2026-10-01'] && state.logsByDate['2026-10-01'].length > 0);
            return pastItemExists;
        })()`);
        console.log('Cloud past data retained via non-destructive merge:', mergeResult);
        if (!mergeResult) throw new Error('applyCloudState must retain past cloud logs');

        // Test 25: Unified Confirmation Modal (v5.8.2)
        console.log('--- Test 25: Unified Custom Confirm Modal ---');
        const modalExists = await evalJs('!!document.getElementById("globalConfirmModal")');
        if (!modalExists) throw new Error('Missing #globalConfirmModal DOM element');

        await evalJs(`(() => {
            window.__testModalConfirmed = false;
            showConfirmDialog({
                icon: '💊',
                title: 'ทดสอบการยืนยัน',
                message: 'คุณต้องการดำเนินการนี้หรือไม่?',
                confirmText: 'ยืนยันการลบ',
                onConfirm: () => { window.__testModalConfirmed = true; }
            });
        })()`);

        const isModalVisible = await evalJs('!document.getElementById("globalConfirmModal").classList.contains("hidden")');
        const modalTitle = await evalJs('document.getElementById("confirmModalTitle").textContent.trim()');
        const modalIcon = await evalJs('document.getElementById("confirmModalIcon").textContent.trim()');
        console.log('Confirm modal visible:', isModalVisible, '| Title:', modalTitle, '| Icon:', modalIcon);
        if (!isModalVisible || modalTitle !== 'ทดสอบการยืนยัน' || modalIcon !== '💊') {
            throw new Error('Confirm modal failed to render expected title, icon or visibility');
        }

        // Test confirming action
        await evalJs('closeConfirmDialog(true)');
        const wasCallbackFired = await evalJs('window.__testModalConfirmed === true');
        console.log('Confirm dialog callback executed:', wasCallbackFired);
        if (!wasCallbackFired) throw new Error('Confirm dialog onConfirm callback was not triggered');

                // Test 26: AI Smart Text & Voice Log Engine (v5.8.3)
        console.log('--- Test 26: AI Smart Text & Voice Log Engine ---');
        
        // 1. Verify UI buttons exist
        const voiceButtonsExist = await evalJs(`(() => {
            const mainBtn = !!document.getElementById('btnAiVoiceMain');
            const toolsBtn = !!document.getElementById('btnAiVoiceTools');
            const voiceTab = !!document.getElementById('tabBtnAiVoice');
            const photoTab = !!document.getElementById('tabBtnAiPhoto');
            const voicePane = !!document.getElementById('aiVoiceTabPane');
            return { mainBtn, toolsBtn, voiceTab, photoTab, voicePane };
        })()`);
        console.log('Voice buttons and elements exist:', voiceButtonsExist);
        if (!voiceButtonsExist.mainBtn || !voiceButtonsExist.voiceTab || !voiceButtonsExist.voicePane) {
            throw new Error('AI Voice UI elements are missing from DOM');
        }

        // 2. Open modal in voice tab
        await evalJs('openAiSnapModal("voice")');
        const modalTabState = await evalJs(`(() => {
            const modal = document.getElementById('aiSnapModal');
            const isOpen = !modal.classList.contains('hidden');
            const isVoiceVisible = !document.getElementById('aiVoiceTabPane').classList.contains('hidden');
            const isPhotoHidden = document.getElementById('aiPhotoTabPane').classList.contains('hidden');
            return { isOpen, isVoiceVisible, isPhotoHidden };
        })()`);
        console.log('AI Modal opened in voice tab:', modalTabState);
        if (!modalTabState.isOpen || !modalTabState.isVoiceVisible || !modalTabState.isPhotoHidden) {
            throw new Error('AI Modal failed to open directly in voice tab');
        }

        // 3. Tab switching test
        await evalJs('switchAiModalTab("photo")');
        const switchedToPhoto = await evalJs(`(() => {
            const isPhotoVisible = !document.getElementById('aiPhotoTabPane').classList.contains('hidden');
            const isVoiceHidden = document.getElementById('aiVoiceTabPane').classList.contains('hidden');
            return isPhotoVisible && isVoiceHidden;
        })()`);
        if (!switchedToPhoto) throw new Error('Tab switching to photo failed');

        await evalJs('switchAiModalTab("voice")');

        // 4. Test Sample Pill & Text Input
        await evalJs('setAiVoiceSample("ข้าวมันไก่ต้ม 1 จาน กับ โค้กซีโร่ 1 กระป๋อง")');
        const inputValue = await evalJs('document.getElementById("aiVoiceTextInput").value');
        console.log('Voice input set with sample pill:', inputValue);
        if (!inputValue.includes('ข้าวมันไก่ต้ม')) {
            throw new Error('setAiVoiceSample failed to set textarea value');
        }

        // 5. Run Voice / Text Analysis
        await evalJs('analyzeAiVoiceText()');
        let analysisDone = false;
        for (let i = 0; i < 20; i++) {
            await new Promise(r => setTimeout(r, 200));
            analysisDone = await evalJs(`(() => {
                const resSection = document.getElementById('aiVoiceResultState');
                return resSection && !resSection.classList.contains('hidden');
            })()`);
            if (analysisDone) break;
        }
        console.log('Voice analysis completed and result section shown:', analysisDone);
        if (!analysisDone) throw new Error('Voice analysis timed out or failed to render result section');

        // 6. Verify Multi-Item parsing results
        const voiceResultData = await evalJs(`(() => {
            const items = (window._currentAiVoiceResult || window._aiVoiceCurrentResult)?.items || [];
            const cards = document.querySelectorAll('#aiVoiceItemsListContainer > div').length;
            const totalCal = parseInt(document.getElementById('aiVoiceTotalCal').textContent) || 0;
            return { itemCount: items.length, cards, totalCal };
        })()`);
        console.log('Voice Multi-Item parsing verified:', voiceResultData);
        if (voiceResultData.itemCount < 2 || voiceResultData.cards < 2 || voiceResultData.totalCal <= 0) {
            throw new Error('Multi-item parser failed to detect at least 2 items or sum calories');
        }

        // 7. Delete an item from result list
        const initialVoiceCount = voiceResultData.itemCount;
        await evalJs('removeAiVoiceResultItem(1)');
        const voiceAfterDeleteCount = await evalJs('(window._currentAiVoiceResult || window._aiVoiceCurrentResult)?.items?.length || 0');
        console.log('After item deletion count:', voiceAfterDeleteCount, 'from initial:', initialVoiceCount);
        if (voiceAfterDeleteCount !== initialVoiceCount - 1) {
            throw new Error('removeAiVoiceResultItem failed to reduce items count');
        }

        // 8. Save meals to diary
        const initialDateLogsCount = await evalJs('state.logsByDate[state.selectedDate]?.length || 0');
        await evalJs('saveAiVoiceAnalyzedMeals()');
        await new Promise(r => setTimeout(r, 350));
        const afterSaveDateLogsCount = await evalJs('state.logsByDate[state.selectedDate]?.length || 0');
        const isModalClosed = await evalJs('document.getElementById("aiSnapModal").classList.contains("hidden")');
        console.log('Meals saved from voice log:', { initialDateLogsCount, afterSaveDateLogsCount, isModalClosed });
        if (afterSaveDateLogsCount <= initialDateLogsCount || !isModalClosed) {
            throw new Error('saveAiVoiceAnalyzedMeals failed to log meals to state or close modal');
        }

        // Test 27: Ghost Duplicate Meal Logs Automatic Cleanup (e.g. 2261 -> 4311 kcal bug fix)
        console.log('--- Test 27: Ghost Duplicate Meal Logs Automatic Cleanup ---');
        const dedupResult = await evalJs(`(() => {
            const today = state.selectedDate;
            // Inject simulated ghost duplicates from sync
            const testList = [
                { id: 'item_1', name: 'ข้าวกะเพราหมูสับ', meal: 'lunch', cal: 620, p: 26, c: 65, f: 28, portion: 1 },
                { id: 'item_2', name: 'ข้าวกะเพราหมูสับ', meal: 'lunch', cal: 620, p: 26, c: 65, f: 28, portion: 1 }, // duplicate!
                { id: 'item_3', name: 'ไข่ต้ม', meal: 'breakfast', cal: 75, p: 6, c: 1, f: 5, portion: 1 },
                { id: 'item_4', name: 'ไข่ต้ม', meal: 'breakfast', cal: 75, p: 6, c: 1, f: 5, portion: 1 } // duplicate!
            ];
            const cleaned = window.cleanDuplicateMealLogs(testList);
            const initialCal = testList.reduce((s, m) => s + m.cal, 0);
            const cleanedCal = cleaned.reduce((s, m) => s + m.cal, 0);
            return {
                initialCount: testList.length,
                cleanedCount: cleaned.length,
                initialCal,
                cleanedCal
            };
        })()`);
        console.log('Ghost duplicate cleanup results:', dedupResult);
        if (dedupResult.initialCount !== 4 || dedupResult.cleanedCount !== 2 || dedupResult.cleanedCal !== 695) {
            throw new Error(`cleanDuplicateMealLogs failed! Expected 2 items / 695 kcal, got ${dedupResult.cleanedCount} items / ${dedupResult.cleanedCal} kcal`);
        }

        // Test 28: AI Smart Text Input, Sample Pill Setter & Clear Cycle
        console.log('--- Test 28: AI Smart Text Input & Clear Cycle ---');
        const textClearTest = await evalJs(`(() => {
            // 1. Set text into textarea
            const input = document.getElementById('aiVoiceTextInput');
            input.value = 'ข้าวหมูแดง 1 จาน';

            // 2. Call clearAiVoiceText — should clear text
            window.clearAiVoiceText();
            const valAfterClear = input.value;

            // 3. Test sample setter
            window.setAiVoiceSample('ข้าวมันไก่พิเศษ 1 จาน');
            const valAfterSample = input.value;

            // 4. Safe stubs check
            let safeStubsOk = true;
            try {
                window.startAiVoiceRecording();
                window.stopAiVoiceRecording();
                window.toggleAiVoiceRecording();
            } catch(e) {
                safeStubsOk = false;
            }

            return {
                valAfterClear,
                valAfterSample,
                safeStubsOk
            };
        })()`);
        console.log('AI Smart Text clear and sample test:', textClearTest);
        if (textClearTest.valAfterClear !== '' || textClearTest.valAfterSample !== 'ข้าวมันไก่พิเศษ 1 จาน' || !textClearTest.safeStubsOk) {
            throw new Error('AI Smart Text clear or sample test failed');
        }

        // Test 29: Living App Companion Empathy Nudge System
        console.log('--- Test 29: Living App Companion Empathy Nudge System ---');
        const companionTest = await evalJs(`(() => {
            const bubble = document.getElementById('livingCompanionBubble');
            if (!bubble) return { hasBubble: false };

            // Trigger sample nudge
            window.showLivingCompanionNudge({
                id: 'test_nudge',
                icon: '🥑',
                category: 'ทดสอบแอพมีชีวิต',
                message: 'สวัสดีจ้า ทดสอบเพื่อนคู่คิดทำงานสมบูรณ์แบบ',
                actionText: 'รับทราบ',
                actionFn: () => {}
            });

            const isShown = !bubble.classList.contains('hidden');
            const msg = document.getElementById('companionNudgeMessage')?.textContent || '';
            const icon = document.getElementById('companionMascotIcon')?.textContent || '';
            const hasAction = document.querySelectorAll('#companionActionArea button').length >= 2;

            // Dismiss
            window.dismissLivingCompanionNudge();

            return {
                hasBubble: true,
                isShown,
                msgMatches: msg.includes('สวัสดีจ้า'),
                iconMatches: icon === '🥑',
                hasAction
            };
        })()`);
        console.log('Living App Companion test:', companionTest);
        if (!companionTest.hasBubble || !companionTest.isShown || !companionTest.msgMatches || !companionTest.iconMatches || !companionTest.hasAction) {
            throw new Error('Living App Companion test failed');
        }

        // Test 30: Smart Cloud & Local Food Cache Engine (v5.8.5)
        console.log('--- Test 30: Smart Cloud & Local Food Cache Engine ---');
        const cacheTestResult = await evalJs(`(() => {
            // 1. Verify Normalizer
            const raw = '  ข้าวมันไก่ไม่หนัง 1 จาน ครับ! ';
            const norm = window.normalizeFoodCacheKey(raw);
            const normMatches = norm === 'ข้าวมันไก่ไม่หนัง 1 จาน';

            // 2. Verify UI elements exist
            const cacheBadge = document.getElementById('aiVoiceCacheBadge');
            const recomputeRow = document.getElementById('aiVoiceCacheRecomputeRow');
            const hasElements = !!cacheBadge && !!recomputeRow;

            // 3. Save item to smart cache
            window.saveAiFoodSmartCache('ข้าวมันไก่พิเศษ 1 จาน', {
                summaryTitle: 'ข้าวมันไก่พิเศษ',
                suggestedMeal: 'lunch',
                totalCal: 550,
                totalP: 32,
                totalC: 60,
                totalF: 15,
                items: [{ foodName: 'ข้าวมันไก่', servingSize: '1 จาน', cal: 550, p: 32, c: 60, f: 15 }],
                healthyTip: 'พลังงานครบถ้วน'
            });

            // 4. Query from cache
            let localHitOk = false;
            try {
                const rawCache = localStorage.getItem('novafit_ai_food_cache');
                const parsed = JSON.parse(rawCache || '{}');
                const matchedKey = window.generateFoodCacheDocId ? window.generateFoodCacheDocId('ข้าวมันไก่พิเศษ 1 จาน') : 'ข้าวมันไก่พิเศษ 1 จาน';
                localHitOk = !!parsed[matchedKey];
            } catch(e) {}

            return {
                normMatches,
                hasElements,
                localHitOk,
                hasReAnalyzeFn: typeof window.reAnalyzeAiVoiceWithGemini === 'function'
            };
        })()`);
        console.log('Smart Cache Test Result:', cacheTestResult);
        if (!cacheTestResult.normMatches || !cacheTestResult.hasElements || !cacheTestResult.localHitOk || !cacheTestResult.hasReAnalyzeFn) {
            throw new Error('Smart Cache Engine verification failed: ' + JSON.stringify(cacheTestResult));
        }

        // Test 31: Admin Table Pagination Engine

        console.log('--- Test 31: Admin Table Pagination Engine ---');
        await sendCdp('Page.navigate', { url: 'http://localhost:8195/admin.html' });
        
        let isReady = false;
        for (let i = 0; i < 25; i++) {
            await new Promise(r => setTimeout(r, 200));
            try {
                isReady = await evalJs('typeof window.renderPaginationControls === "function" && !!document.getElementById("usersPagination")');
                if (isReady) break;
            } catch (e) {}
        }
        console.log('Admin page loaded and pagination engine ready:', isReady);

        const usersPagExists = await evalJs('!!document.getElementById("usersPagination")');
        const aiLogsPagExists = await evalJs('!!document.getElementById("aiScanLogsPagination")');
        const msgLogsPagExists = await evalJs('!!document.getElementById("messageLogsPagination")');
        const customPresetsPagExists = await evalJs('!!document.getElementById("customPresetsPagination")');

        console.log('Admin pagination containers exist:', { usersPagExists, aiLogsPagExists, msgLogsPagExists, customPresetsPagExists });
        if (!usersPagExists || !aiLogsPagExists || !msgLogsPagExists || !customPresetsPagExists) {
            throw new Error('Missing admin pagination container elements');
        }

        const paginationRenderTest = await evalJs(`(() => {
            window.renderPaginationControls({
                containerId: 'usersPagination',
                totalItems: 45,
                currentPage: 2,
                pageSize: 10,
                onPageChange: 'changeUsersPage',
                onPageSizeChange: 'changeUsersPageSize'
            });
            const text = document.getElementById('usersPagination').textContent;
            return text.includes('11') && text.includes('20') && text.includes('45');
        })()`);
        console.log('Pagination control rendered correct slice text:', paginationRenderTest);
        if (!paginationRenderTest) throw new Error('Pagination control failed to render expected item range text');

        // Test 32: Admin AI Scan Logs Table Data Mapping Test
        console.log('--- Test 32: Admin AI Scan Logs Table Data Mapping ---');
        const aiScanTableTest = await evalJs(`(() => {
            window._currentAiScanLogs = [
                {
                    id: 'test_doc_1',
                    timestamp: 1729400000000,
                    userPhoto: 'icon.svg',
                    userName: 'สมชาย รักสุขภาพ',
                    userEmail: 'somchai@gmail.com',
                    foodName: 'ข้าวกะเพราไก่ไข่ดาว',
                    cal: 550,
                    p: 35,
                    c: 50,
                    f: 18,
                    environment: 'uat'
                }
            ];
            window._aiLogsCurrentPage = 1;
            window._aiLogsPageSize = 10;
            window.renderAiScanLogsSlice();
            const rowHtml = document.getElementById('adminAiScanLogsTableBody').innerHTML;
            const hasFood = rowHtml.includes('ข้าวกะเพราไก่ไข่ดาว');
            const hasUser = rowHtml.includes('สมชาย รักสุขภาพ');
            const hasCal = rowHtml.includes('550 kcal');
            const hasMacros = rowHtml.includes('P:35g C:50g F:18g');
            const hasUat = rowHtml.includes('UAT');
            return { hasFood, hasUser, hasCal, hasMacros, hasUat };
        })()`);
        console.log('AI Scan table rendered properly with real data:', aiScanTableTest);
        if (!aiScanTableTest.hasFood || !aiScanTableTest.hasUser || !aiScanTableTest.hasCal || !aiScanTableTest.hasMacros || !aiScanTableTest.hasUat) {
            throw new Error('AI scan logs table rendering failed to display mapped data!');
        }

        // Verify Admin Token Savings elements exist on admin.html
        const adminCacheStatsTest = await evalJs(`(() => {
            const hasTokensSavedCard = !!document.getElementById('statAiTokensSaved');
            const hasUniqueFoods = !!document.getElementById('statCachedUniqueFoods');
            const hasTopDishes = !!document.getElementById('topCachedDishesList');
            return { hasTokensSavedCard, hasUniqueFoods, hasTopDishes };
        })()`);
        console.log('Admin Token Savings elements exist on admin.html:', adminCacheStatsTest);
        if (!adminCacheStatsTest.hasTokensSavedCard || !adminCacheStatsTest.hasUniqueFoods || !adminCacheStatsTest.hasTopDishes) {
            throw new Error('Admin Token Savings elements missing from DOM!');
        }

        // Test 33: Visual Photo Recents & Universal Search Cache Integration (v5.8.6)
        console.log('--- Test 33: Visual Photo Recents & Universal Search Cache Integration ---');
        await sendCdp('Page.navigate', { url: 'http://localhost:8195/' });
        let isMainReady = false;
        for (let i = 0; i < 25; i++) {
            await new Promise(r => setTimeout(r, 200));
            try {
                isMainReady = await evalJs('typeof window.saveToRecentPhotos === "function" && typeof window.onSearchFood === "function"');
                if (isMainReady) break;
            } catch (e) {}
        }
        console.log('Main app page reloaded and ready:', isMainReady);
        
        // 1. Verify Visual Photo Recents saving and rendering
        const recentsTest = await evalJs(`(() => {
            saveToRecentPhotos({
                foodName: 'สเต็กอกไก่พริกไทยดำ (Test Photo)',
                cal: 290,
                p: 45,
                c: 5,
                f: 8,
                servingSize: '1 จาน'
            });
            renderAiSnapRecentDishes();
            const sectionVisible = !document.getElementById('aiSnapRecentDishesSection').classList.contains('hidden');
            const listHtml = document.getElementById('aiSnapRecentDishesList').innerHTML;
            const hasDish = listHtml.includes('สเต็กอกไก่พริกไทยดำ');
            const hasCal = listHtml.includes('290 kcal');
            return { sectionVisible, hasDish, hasCal };
        })()`);
        console.log('Visual Photo Recents rendering verified:', recentsTest);
        if (!recentsTest.sectionVisible || !recentsTest.hasDish || !recentsTest.hasCal) {
            throw new Error('Visual photo recents failed to render saved dishes!');
        }

        // 2. Verify Universal Search retrieves from Cache
        const cacheSearchTest = await evalJs(`(() => {
            const sampleCache = {
                'salmon-salad-test': {
                    items: [
                        { foodName: 'สลัดแซลมอนย่างเทอริยากิ (Cache)', p: 30, c: 15, f: 12, cal: 310, servingSize: '1 จาน' }
                    ]
                }
            };
            localStorage.setItem('novafit_ai_food_cache', JSON.stringify(sampleCache));
            onSearchFood('แซลมอนย่าง');
            const searchHtml = document.getElementById('quickFoodList').innerHTML;
            const hasCachedFood = searchHtml.includes('สลัดแซลมอนย่างเทอริยากิ');
            const hasCacheBadge = searchHtml.includes('⚡ AI') || searchHtml.includes('⚡ คลังจำ AI');
            clearFoodSearch();
            return { hasCachedFood, hasCacheBadge };
        })()`);
        console.log('Universal Search with Cache verified:', cacheSearchTest);
        if (!cacheSearchTest.hasCachedFood || !cacheSearchTest.hasCacheBadge) {
            throw new Error('Universal search failed to retrieve and display cached meal!');
        }

        // Test 34: Guest Activity Tracking & Admin User Segment Filtering (Phase 1 - v5.9.4)
        console.log('--- Test 34: Guest Activity Tracking & Admin User Segment Filtering (Phase 1) ---');
        const guestTrackingTest = await evalJs(`(() => {
            const hasGuestFn = typeof window.syncGuestSession === 'function';
            const hasFrame = window.state && window.state.prestigeFrame === 'novice';
            const hasStreak = window.state && typeof window.state.streakDays === 'number';
            return { hasGuestFn, hasFrame, hasStreak };
        })()`);
        console.log('Guest session & Prestige Frame foundation verified:', guestTrackingTest);
        if (!guestTrackingTest.hasGuestFn || !guestTrackingTest.hasFrame || !guestTrackingTest.hasStreak) {
            throw new Error('Guest tracking function or prestige frame state schema missing!');
        }

        // Test Admin User Type Filtering
        await sendCdp('Page.navigate', { url: 'http://localhost:8195/admin.html' });
        let isAdminReady = false;
        for (let i = 0; i < 25; i++) {
            await new Promise(r => setTimeout(r, 200));
            try {
                isAdminReady = await evalJs('typeof window.setUserTypeFilter === "function" && typeof window.renderAdminOverview === "function" && !!document.getElementById("btnFilterUserGuest")');
                if (isAdminReady) break;
            } catch (e) {}
        }
        console.log('Admin page loaded for guest filter test:', isAdminReady);
        const adminGuestFilterTest = await evalJs(`(() => {
            const btnAll = document.getElementById('btnFilterUserAll');
            const btnGoogle = document.getElementById('btnFilterUserGoogle');
            const btnGuest = document.getElementById('btnFilterUserGuest');
            const hasFilterFn = typeof window.setUserTypeFilter === 'function';

            // Simulate mixed user dataset
            window.allUsersData = [
                { uid: 'u_goog_1', isGuest: false, displayName: 'สมชาย รักดี', email: 'somchai@gmail.com', updatedAt: new Date().toISOString() },
                { uid: 'guest_dev_1', isGuest: true, displayName: 'ผู้ใช้ทั่วไป (iOS)', platform: 'iOS', updatedAt: new Date().toISOString() }
            ];
            window.renderAdminOverview();
            
            // Check counts
            const totalText = document.getElementById('countFilterAll').textContent;
            const googleText = document.getElementById('countFilterGoogle').textContent;
            const guestText = document.getElementById('countFilterGuest').textContent;

            // Trigger filter guest
            window.setUserTypeFilter('guest');
            const tbodyHtml = document.getElementById('usersTableBody').innerHTML;
            const hasGuestRow = tbodyHtml.includes('ผู้ใช้ทั่วไป (iOS)') && tbodyHtml.includes('⚪ Guest');
            const noGoogleRow = !tbodyHtml.includes('somchai@gmail.com');

            return {
                buttonsExist: !!(btnAll && btnGoogle && btnGuest && hasFilterFn),
                totalText,
                googleText,
                guestText,
                hasGuestRow,
                noGoogleRow
            };
        })()`);
        console.log('Admin Guest & Google Filter verified:', adminGuestFilterTest);
        if (!adminGuestFilterTest.buttonsExist || !adminGuestFilterTest.hasGuestRow || !adminGuestFilterTest.noGoogleRow) {
            throw new Error('Admin guest user filtering failed!');
        }

        console.log('--- Test 35: Prestige Avatar Frames, Verified Streak & Anti-Cheat Engine (Phase 2 & 3) ---');
        // Part A: Test Admin Security Logs Tab (we are already on admin.html)
        const adminSecurityTest = await evalJs(`(() => {
            const hasTabBtn = !!document.getElementById('tabBtn_security_logs');
            const hasTabView = !!document.getElementById('tabView_security_logs');
            const hasTotalCounter = !!document.getElementById('countSecurityTotal');
            const hasFrameCounter = !!document.getElementById('countSecurityFrameTamper');
            const hasStreakCounter = !!document.getElementById('countSecurityStreakTamper');

            // Switch to security_logs tab
            window.switchAdminTab('security_logs');
            const isTabActive = !document.getElementById('tabView_security_logs').classList.contains('hidden');

            // Mock security logs data
            window.allSecurityLogsData = [
                {
                    id: 'sec_test_1',
                    type: 'UNAUTHORIZED_PRESTIGE_EQUIP',
                    reason: 'User attempted to equip locked frame diamond without required streak (100 days)',
                    timestamp: new Date().toISOString(),
                    platform: 'iOS',
                    deviceId: 'dev_iphone_tamper_1',
                    userEmail: 'guest',
                    details: { attemptedFrame: 'diamond', reqDays: 100, verifiedStreak: 2 }
                },
                {
                    id: 'sec_test_2',
                    type: 'STREAK_SPOOF_TAMPER',
                    reason: 'Claimed streak (999 days) exceeds verified consecutive meal days (1 days)',
                    timestamp: new Date().toISOString(),
                    platform: 'Desktop',
                    deviceId: 'dev_mac_hacker_2',
                    userEmail: 'hacker@example.com',
                    details: { claimed: 999, verified: 1 }
                }
            ];
            window.loadAdminSecurityLogs();

            const totalText = document.getElementById('countSecurityTotal').textContent;
            const frameText = document.getElementById('countSecurityFrameTamper').textContent;
            const streakText = document.getElementById('countSecurityStreakTamper').textContent;
            const tbodyHtml = document.getElementById('securityLogsTableBody').innerHTML;

            const hasUnauthorizedRow = tbodyHtml.includes('พยายามสวมกรอบผิดกฎ') && tbodyHtml.includes('diamond');
            const hasStreakRow = tbodyHtml.includes('ปลอมแปลงสตรีค') && tbodyHtml.includes('hacker@example.com');
            const hasDefenseBadge = tbodyHtml.includes('สกัดกั้น &amp; รีเซ็ตสำเร็จ') || tbodyHtml.includes('สกัดกั้น & รีเซ็ตสำเร็จ');

            return {
                elementsExist: hasTabBtn && hasTabView && hasTotalCounter && hasFrameCounter && hasStreakCounter,
                isTabActive,
                totalText,
                frameText,
                streakText,
                hasUnauthorizedRow,
                hasStreakRow,
                hasDefenseBadge
            };
        })()`);
        console.log('Admin Security Audit Tab verified:', adminSecurityTest);
        if (!adminSecurityTest.elementsExist || !adminSecurityTest.isTabActive || !adminSecurityTest.hasUnauthorizedRow || !adminSecurityTest.hasStreakRow) {
            throw new Error('Admin Security Audit verification failed!');
        }

        // Part B: Navigate back to Main App and test Streak Math & Anti-Cheat Guards
        await sendCdp('Page.navigate', { url: 'http://localhost:8195/' });
        let isMainAppReady = false;
        for (let i = 0; i < 25; i++) {
            await new Promise(r => setTimeout(r, 200));
            try {
                isMainAppReady = await evalJs('typeof window.calculateVerifiedStreak === "function" && typeof window.equipPrestigeFrame === "function" && !!document.getElementById("btnGuestWardrobe")');
                if (isMainAppReady) break;
            } catch (e) {}
        }
        console.log('Main app ready for Prestige Frame test:', isMainAppReady);

        const prestigeEngineTest = await evalJs(`(() => {
            const todayStr = window.getTodayStr();
            const dObj = new Date(todayStr + 'T00:00:00');
            dObj.setDate(dObj.getDate() - 1);
            const yestStr = dObj.toISOString().split('T')[0];
            dObj.setDate(dObj.getDate() - 1);
            const day2Str = dObj.toISOString().split('T')[0];

            // 1. Test mathematical streak calculation
            const emptyLogs = {};
            const streakZero = window.calculateVerifiedStreak(emptyLogs, todayStr);

            const oneDayLogs = { [todayStr]: [{ name: 'อกไก่ต้ม', cal: 150 }] };
            const streakOne = window.calculateVerifiedStreak(oneDayLogs, todayStr);

            const twoDayLogs = {
                [yestStr]: [{ name: 'ไข่ต้ม', cal: 75 }],
                [todayStr]: [{ name: 'อกไก่ต้ม', cal: 150 }]
            };
            const streakTwo = window.calculateVerifiedStreak(twoDayLogs, todayStr);

            const threeDayLogs = {
                [day2Str]: [{ name: 'สลัด', cal: 120 }],
                [yestStr]: [{ name: 'ไข่ต้ม', cal: 75 }],
                [todayStr]: [{ name: 'อกไก่ต้ม', cal: 150 }]
            };
            const streakThree = window.calculateVerifiedStreak(threeDayLogs, todayStr);

            // 2. Test Anti-Cheat: Spoof tampering rejection
            window.state.streakDays = 999;
            window.state.logsByDate = oneDayLogs;
            window.verifyAndSanitizeStreak();
            const sanitizedStreak = window.state.streakDays; // Must be clamped to 1!

            // 3. Test Unauthorized Frame Equip Rejection
            window.state.prestigeFrame = 'novice';
            window.state.isVip = false;
            window.equipPrestigeFrame('diamond'); // Requires 100 days
            const frameAfterIllegalEquip = window.state.prestigeFrame; // Must NOT be diamond!

            // 4. Test Legitimate Frame Unlock & Equip
            window.state.logsByDate = threeDayLogs;
            window.verifyAndSanitizeStreak();
            window.equipPrestigeFrame('bronze'); // Requires 3 days
            const frameAfterLegalEquip = window.state.prestigeFrame; // Must be bronze!

            // 5. Test Wardrobe Modal opening & rendering
            window.openPrestigeWardrobeModal();
            const wardrobeModal = document.getElementById('prestigeWardrobeModal');
            const wardrobeList = document.getElementById('wardrobeTiersList');
            const isWardrobeOpen = !wardrobeModal.classList.contains('hidden');
            const wardrobeHasBronze = wardrobeList.innerHTML.includes('Bronze Sprout') && wardrobeList.innerHTML.includes('ใช้งานอยู่');
            window.closePrestigeWardrobeModal();

            return {
                streakZero,
                streakOne,
                streakTwo,
                streakThree,
                sanitizedStreak,
                frameAfterIllegalEquip,
                frameAfterLegalEquip,
                isWardrobeOpen,
                wardrobeHasBronze
            };
        })()`);
        console.log('Prestige Engine & Anti-Cheat verified:', prestigeEngineTest);

        if (prestigeEngineTest.streakZero !== 0 ||
            prestigeEngineTest.streakOne !== 1 ||
            prestigeEngineTest.streakTwo !== 2 ||
            prestigeEngineTest.streakThree !== 3 ||
            prestigeEngineTest.sanitizedStreak !== 1 ||
            prestigeEngineTest.frameAfterIllegalEquip === 'diamond' ||
            prestigeEngineTest.frameAfterLegalEquip !== 'bronze' ||
            !prestigeEngineTest.isWardrobeOpen ||
            !prestigeEngineTest.wardrobeHasBronze) {
            throw new Error('Prestige Avatar Frame & Anti-Cheat Engine test failed!');
        }

        // Test 36: Mobile Header Title Clearance, Custom Profile Picture & Name Edit, and Real PNG Prestige Frames with Dynamic Animations (v5.9.6)
        console.log('--- Test 36: Profile Edit, Mobile Header Clearance & PNG Frame Animations ---');
        const v596Test = await evalJs(`(() => {
            // 1. Mobile Header title clearance
            const userNameEl = document.getElementById('userName');
            const hasMobileHiddenClass = userNameEl && userNameEl.classList.contains('hidden') && userNameEl.classList.contains('sm:inline');

            // 2. Custom Display Name edit
            const inputName = document.getElementById('wardrobeDisplayNameInput');
            if (inputName) inputName.value = 'โค้ชเบนซ์ Nova';
            window.saveProfileDisplayName();
            const savedDisplayName = window.state.userDisplayName;
            const headerDisplayName = userNameEl ? userNameEl.textContent : '';

            // 3. Custom Avatar Photo
            const sampleAvatar = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
            window.state.userAvatarUrl = sampleAvatar;
            window.saveState();
            window.renderPrestigeFrames();
            window.renderWardrobeModal();

            const guestImg = document.getElementById('guestAvatarImg');
            const guestDef = document.getElementById('guestAvatarDefault');
            const guestImgVisible = guestImg && !guestImg.classList.contains('hidden');
            const guestDefHidden = guestDef && guestDef.classList.contains('hidden');

            // Remove photo test
            window.removeCustomAvatarPhoto();
            const photoRemoved = window.state.userAvatarUrl === '';
            const guestDefRestored = guestDef && !guestDef.classList.contains('hidden');

            // 4. Real PNG Frame Overlays with dynamic animation effects
            const noviceFrame = window.PRESTIGE_TIERS.novice.frameImg;
            const noviceEffect = window.PRESTIGE_TIERS.novice.effectClass;
            const bronzeFrame = window.PRESTIGE_TIERS.bronze.frameImg;
            const bronzeEffect = window.PRESTIGE_TIERS.bronze.effectClass;
            const goldFrame = window.PRESTIGE_TIERS.gold.frameImg;
            const goldEffect = window.PRESTIGE_TIERS.gold.effectClass;

            window.equipPrestigeFrame('novice');
            const guestFrameEl = document.getElementById('guestAvatarFrame');
            const guestFrameSrcNovice = guestFrameEl ? guestFrameEl.src : '';
            const guestFrameClassNovice = guestFrameEl ? guestFrameEl.className : '';

            window.equipPrestigeFrame('bronze');
            const guestFrameSrcBronze = guestFrameEl ? guestFrameEl.src : '';
            const guestFrameClassBronze = guestFrameEl ? guestFrameEl.className : '';

            const wardrobeList = document.getElementById('wardrobeTiersList');
            const hasPngImagesInList = wardrobeList && wardrobeList.innerHTML.includes('frames/frame-novice.png') && wardrobeList.innerHTML.includes('frames/frame-bronze.png');
            const hasEffectsInList = wardrobeList && wardrobeList.innerHTML.includes('effect-novice') && wardrobeList.innerHTML.includes('effect-bronze');

            return {
                hasMobileHiddenClass,
                savedDisplayName,
                headerDisplayName,
                guestImgVisible,
                guestDefHidden,
                photoRemoved,
                guestDefRestored,
                noviceFrame,
                noviceEffect,
                bronzeFrame,
                bronzeEffect,
                goldFrame,
                goldEffect,
                guestFrameSrcNovice,
                guestFrameClassNovice,
                guestFrameSrcBronze,
                guestFrameClassBronze,
                hasPngImagesInList,
                hasEffectsInList
            };
        })()`);
        console.log('v5.9.6 Features verified:', v596Test);

        if (!v596Test.hasMobileHiddenClass ||
            v596Test.savedDisplayName !== 'โค้ชเบนซ์ Nova' ||
            v596Test.headerDisplayName !== 'โค้ชเบนซ์ Nova' ||
            !v596Test.guestImgVisible ||
            !v596Test.guestDefHidden ||
            !v596Test.photoRemoved ||
            !v596Test.guestDefRestored ||
            v596Test.noviceFrame !== 'frames/frame-novice.png' ||
            v596Test.noviceEffect !== 'effect-novice' ||
            v596Test.bronzeFrame !== 'frames/frame-bronze.png' ||
            v596Test.bronzeEffect !== 'effect-bronze' ||
            !v596Test.guestFrameSrcNovice.includes('frames/frame-novice.png') ||
            !v596Test.guestFrameClassNovice.includes('effect-novice') ||
            !v596Test.guestFrameSrcBronze.includes('frames/frame-bronze.png') ||
            !v596Test.guestFrameClassBronze.includes('effect-bronze') ||
            !v596Test.hasPngImagesInList ||
            !v596Test.hasEffectsInList) {
            throw new Error('Test 36: Mobile Header, Profile Edit and PNG Frames integration failed: ' + JSON.stringify(v596Test));
        }

        // Test 37: Nova Chef App Preloader, Action Micro-Loader & Modal-Floating High-Z Toast System (v5.9.7)
        console.log('--- Test 37: Nova Chef Preloader, Mini Loader & High-Z Toast ---');
        const v597Test = await evalJs(`(() => {
            // 1. Toast Container Elevated Stacking
            const toastContainer = document.getElementById('toastContainer');
            const hasHighZ = toastContainer && toastContainer.className.includes('z-[100000]');
            const isCenteredMobile = toastContainer && toastContainer.className.includes('left-1/2');

            // 2. Toast Generation
            window.showToast('✨ ทดสอบ Toast v5.9.7');
            const hasToastEl = toastContainer && toastContainer.children.length > 0;

            // 3. App Preloader & Dismissal
            const preloader = document.getElementById('novaAppPreloader');
            const hasPreloader = !!preloader;
            const preloaderZ = preloader && preloader.className.includes('z-[99999]');
            const phraseEl = document.getElementById('preloaderPhrase');
            const hasPhrase = !!phraseEl;
            window.dismissAppPreloader();

            // 4. Action Micro-Loader
            const miniLoader = document.getElementById('novaMiniLoader');
            const hasMiniLoader = !!miniLoader;
            window.showMiniLoader('🔄 กำลังทดสอบระบบซิงค์...');
            const miniLoaderVisible = miniLoader && !miniLoader.classList.contains('hidden');
            const miniText = document.getElementById('miniLoaderText')?.textContent;
            window.hideMiniLoader();

            // 5. Version Alignment
            const appVersion = window.APP_VERSION;
            const toolsBadge = document.getElementById('toolsVersionBadge')?.textContent;

            return {
                hasHighZ,
                isCenteredMobile,
                hasToastEl,
                hasPreloader,
                preloaderZ,
                hasPhrase,
                hasMiniLoader,
                miniLoaderVisible,
                miniText,
                appVersion,
                toolsBadge
            };
        })()`);
        console.log('v5.9.7 Features verified:', v597Test);

        if (!v597Test.hasHighZ ||
            !v597Test.isCenteredMobile ||
            !v597Test.hasToastEl ||
            !v597Test.hasPreloader ||
            !v597Test.preloaderZ ||
            !v597Test.hasPhrase ||
            !v597Test.hasMiniLoader ||
            !v597Test.miniLoaderVisible ||
            v597Test.miniText !== '🔄 กำลังทดสอบระบบซิงค์...') {
            throw new Error('Test 37: Preloader, Mini Loader and High-Z Toast failed: ' + JSON.stringify(v597Test));
        }

        // Test 38: Avocado Cat Mascot Logo, Mobile/Desktop Favicons & PWA Manifest Icons (v5.9.8)
        console.log('--- Test 38: Avocado Cat Mascot Logo, Favicons & PWA Icons ---');
        const v598Test = await evalJs(`(() => {
            // 1. Header brand logo
            const headerLogoImg = document.querySelector('header img[src="icon-192.png"]');
            const hasHeaderLogo = !!headerLogoImg;

            // 2. Favicons in document head
            const appleIcon = document.querySelector('link[rel="apple-touch-icon"][href="apple-touch-icon.png"]');
            const fav32 = document.querySelector('link[rel="icon"][sizes="32x32"][href="favicon-32x32.png"]');
            const fav16 = document.querySelector('link[rel="icon"][sizes="16x16"][href="favicon-16x16.png"]');
            const favIco = document.querySelector('link[rel="icon"][href="favicon.ico"]');
            const manifestLink = document.querySelector('link[rel="manifest"][href="manifest.json"]');

            // 3. Version alignment
            const appVersion = window.APP_VERSION;
            const toolsBadge = document.getElementById('toolsVersionBadge')?.textContent;

            return {
                hasHeaderLogo,
                hasAppleIcon: !!appleIcon,
                hasFav32: !!fav32,
                hasFav16: !!fav16,
                hasFavIco: !!favIco,
                hasManifest: !!manifestLink,
                appVersion,
                toolsBadge
            };
        })()`);
        console.log('v5.9.8 Features verified:', v598Test);

        if (!v598Test.hasHeaderLogo ||
            !v598Test.hasAppleIcon ||
            !v598Test.hasFav32 ||
            !v598Test.hasFav16 ||
            !v598Test.hasFavIco ||
            !v598Test.hasManifest ||
            v598Test.appVersion !== '5.9.13' ||
            !v598Test.toolsBadge?.includes('v5.9.13')) {
            throw new Error('Test 38: Mascot logo, favicons, or version alignment failed: ' + JSON.stringify(v598Test));
        }

        // Test 39: Web Push Notifications (FCM), Smart Watch Mirroring & Admin Push Hub (v5.9.9)
        console.log('--- Test 39: Web Push Notifications & Admin Push Hub (v5.9.9) ---');
        // Part A: Client Push Notification UI & Lifecycle
        const clientPushTest = await evalJs(`(() => {
            const pushBanner = document.getElementById('pushPromptBanner');
            const hasBanner = !!pushBanner;
            const bannerMascot = pushBanner ? pushBanner.querySelector('img[src="icon-192.png"]') : null;
            const hasBannerMascot = !!bannerMascot;

            const fnGetState = typeof window.getPushPermissionState === 'function';
            const fnRequest = typeof window.requestPushPermission === 'function';
            const fnDismiss = typeof window.dismissPushPrompt === 'function';
            const fnTestNotif = typeof window.testLocalNotification === 'function';
            const fnToggle = typeof window.togglePushNotificationPermission === 'function';

            // Test banner dismiss animation & hiding
            if (fnDismiss) {
                window.dismissPushPrompt(false);
            }
            const bannerDismissing = pushBanner && (pushBanner.classList.contains('opacity-0') || pushBanner.classList.contains('translate-y-20'));

            // Check Profile Settings Drawer Push Toggle
            const pushToggle = document.getElementById('btnTogglePush');
            const hasPushToggle = !!pushToggle;

            return {
                hasBanner,
                hasBannerMascot,
                fnGetState,
                fnRequest,
                fnDismiss,
                fnTestNotif,
                fnToggle,
                bannerDismissing,
                hasPushToggle
            };
        })()`);
        console.log('Client Push UI & Methods verified:', clientPushTest);

        if (!clientPushTest.hasBanner ||
            !clientPushTest.hasBannerMascot ||
            !clientPushTest.fnGetState ||
            !clientPushTest.fnRequest ||
            !clientPushTest.fnDismiss ||
            !clientPushTest.fnTestNotif ||
            !clientPushTest.fnToggle ||
            !clientPushTest.bannerDismissing ||
            !clientPushTest.hasPushToggle) {
            throw new Error('Test 39 Part A: Client Push Notification components failed: ' + JSON.stringify(clientPushTest));
        }

        // Part B: Admin Push Notification Control Hub
        console.log('--- Test 39 Part B: Admin Push Notification Control Hub ---');
        await sendCdp('Page.navigate', { url: 'http://localhost:8195/admin.html' });
        let isPushAdminReady = false;
        for (let i = 0; i < 25; i++) {
            await new Promise(r => setTimeout(r, 200));
            try {
                isPushAdminReady = await evalJs('typeof window.switchAdminTab === "function" && !!document.getElementById("tabBtn_push_hub")');
                if (isPushAdminReady) break;
            } catch (e) {}
        }

        const adminPushTest = await evalJs(`(() => {
            const tabBtn = document.getElementById('tabBtn_push_hub');
            const hasTabBtn = !!tabBtn;

            // Switch to push hub tab
            window.switchAdminTab('push_hub');
            const pushView = document.getElementById('tabView_push_hub');
            const isPushViewVisible = pushView && !pushView.classList.contains('hidden');

            // Check KPIs
            const kpiTotal = document.getElementById('pushKpiTotalDevices');
            const kpiIos = document.getElementById('pushKpiIosDevices');
            const kpiAndroid = document.getElementById('pushKpiAndroidDevices');
            const kpiGuestMember = document.getElementById('pushKpiGuestVsMember');
            const hasKpis = !!(kpiTotal && kpiIos && kpiAndroid && kpiGuestMember);

            // Check Slots Container
            const slotsContainer = document.getElementById('pushSlotsContainer');
            const hasSlotsContainer = !!slotsContainer;

            // Render slots & verify default meal times
            if (window.renderAdminPushSlots) {
                window.renderAdminPushSlots();
            }
            const hasBreakfastSlot = slotsContainer && slotsContainer.innerHTML.includes('มื้อเช้า');
            const hasLunchSlot = slotsContainer && slotsContainer.innerHTML.includes('มื้อเที่ยง');
            const hasDinnerSlot = slotsContainer && slotsContainer.innerHTML.includes('มื้อเย็น');
            const hasStreakSlot = slotsContainer && slotsContainer.innerHTML.includes('เตือนรักษาสถิติ');
            const hasHydrationSlot = slotsContainer && slotsContainer.innerHTML.includes('เตือนจิบน้ำ');

            // Test adding custom message to breakfast slot
            const breakfastInput = document.getElementById('newMsgInput_breakfast');
            if (breakfastInput && window.addPushSlotMessage) {
                breakfastInput.value = 'ทดสอบข้อความมื้อเช้าพิเศษ 🥑';
                window.addPushSlotMessage('breakfast');
            }
            const hasAddedMessage = slotsContainer && slotsContainer.innerHTML.includes('ทดสอบข้อความมื้อเช้าพิเศษ');

            // Check broadcast controls
            const audienceSelect = document.getElementById('broadcastTargetAudience');
            const broadcastTitle = document.getElementById('broadcastPushTitle');
            const broadcastBody = document.getElementById('broadcastPushBody');
            const hasBroadcastInputs = !!(audienceSelect && broadcastTitle && broadcastBody);

            const fnSaveSched = typeof window.saveAdminPushSchedule === 'function';
            const fnSendBroadcast = typeof window.sendAdminPushBroadcast === 'function';
            const fnGenAi = typeof window.generateAiPushMessage === 'function';
            const fnTestSlotNow = typeof window.testPushSlotNow === 'function';

            return {
                hasTabBtn,
                isPushViewVisible,
                hasKpis,
                hasSlotsContainer,
                hasBreakfastSlot,
                hasLunchSlot,
                hasDinnerSlot,
                hasStreakSlot,
                hasHydrationSlot,
                hasAddedMessage,
                hasBroadcastInputs,
                fnSaveSched,
                fnSendBroadcast,
                fnGenAi,
                fnTestSlotNow
            };
        })()`);
        console.log('Admin Push Hub verified:', adminPushTest);

        if (!adminPushTest.hasTabBtn ||
            !adminPushTest.isPushViewVisible ||
            !adminPushTest.hasKpis ||
            !adminPushTest.hasSlotsContainer ||
            !adminPushTest.hasBreakfastSlot ||
            !adminPushTest.hasLunchSlot ||
            !adminPushTest.hasDinnerSlot ||
            !adminPushTest.hasStreakSlot ||
            !adminPushTest.hasHydrationSlot ||
            !adminPushTest.hasAddedMessage ||
            !adminPushTest.hasBroadcastInputs ||
            !adminPushTest.fnSaveSched ||
            !adminPushTest.fnSendBroadcast ||
            !adminPushTest.fnGenAi ||
            !adminPushTest.fnTestSlotNow) {
            throw new Error('Test 39 Part B: Admin Push Hub failed: ' + JSON.stringify(adminPushTest));
        }

        // Test 40: In-App Web Audio API Sound Effects Synthesizer Engine (v5.9.11)
        console.log('--- Test 40: Web Audio API Sound Effects Synthesizer Engine (v5.9.11) ---');
        await sendCdp('Page.navigate', { url: 'http://localhost:8195/' });
        let isMainAppReadyForSound = false;
        for (let i = 0; i < 25; i++) {
            await new Promise(r => setTimeout(r, 200));
            try {
                isMainAppReadyForSound = await evalJs('typeof window.playSound === "function" && !!document.getElementById("btnSoundToggle")');
                if (isMainAppReadyForSound) break;
            } catch (e) {}
        }

        const soundTest = await evalJs(`(() => {
            const btnSound = document.getElementById('btnSoundToggle');
            const soundIcon = document.getElementById('soundIcon');
            const hasBtn = !!btnSound;
            const hasIcon = !!soundIcon;
            const fnPlaySound = typeof window.playSound === 'function';
            const fnToggleSound = typeof window.toggleSound === 'function';
            const fnRenderSound = typeof window.renderSoundButton === 'function';
            
            // Check initial state
            const initialIcon = soundIcon ? soundIcon.textContent.trim() : '';
            
            // Toggle to mute
            if (fnToggleSound) window.toggleSound();
            const iconAfterMute = soundIcon ? soundIcon.textContent.trim() : '';
            const stateMuted = window.state ? window.state.soundEnabled === false : false;
            
            // Toggle back to unmute
            if (fnToggleSound) window.toggleSound();
            const iconAfterUnmute = soundIcon ? soundIcon.textContent.trim() : '';
            const stateUnmuted = window.state ? window.state.soundEnabled === true : false;
            
            // Test synthesizer triggers (safely without crashing)
            let playSoundPopOk = false;
            let playSoundWaterOk = false;
            try {
                if (fnPlaySound) {
                    window.playSound('pop');
                    playSoundPopOk = true;
                    window.playSound('water');
                    playSoundWaterOk = true;
                }
            } catch (e) {
                console.error(e);
            }

            return {
                hasBtn,
                hasIcon,
                fnPlaySound,
                fnToggleSound,
                fnRenderSound,
                initialIcon,
                iconAfterMute,
                stateMuted,
                iconAfterUnmute,
                stateUnmuted,
                playSoundPopOk,
                playSoundWaterOk
            };
        })()`);
        console.log('Sound effects engine verified:', soundTest);

        if (!soundTest.hasBtn ||
            !soundTest.hasIcon ||
            !soundTest.fnPlaySound ||
            !soundTest.fnToggleSound ||
            soundTest.iconAfterMute !== '🔇' ||
            !soundTest.stateMuted ||
            soundTest.iconAfterUnmute !== '🔊' ||
            !soundTest.stateUnmuted ||
            !soundTest.playSoundPopOk) {
            throw new Error('Test 40: Sound effects synthesizer engine failed: ' + JSON.stringify(soundTest));
        }

        // Test 41: App Tour Modal & Interactive Guide Engine (v5.9.12)
        console.log('--- Test 41: App Tour Modal & Interactive Guide Engine (v5.9.12) ---');
        const tourTest = await evalJs(`(() => {
            const modal = document.getElementById('appTourModal');
            const btnAppTour = document.getElementById('btnAppTour');
            const hasModal = !!modal;
            const hasBtn = !!btnAppTour;
            const fnOpen = typeof window.openAppTourModal === 'function';
            const fnClose = typeof window.closeAppTourModal === 'function';
            const fnNext = typeof window.nextTourSlide === 'function';
            const fnPrev = typeof window.prevTourSlide === 'function';
            const fnGoTo = typeof window.goToTourSlide === 'function';

            // Test opening tour
            if (fnOpen) window.openAppTourModal();
            const isOpen = modal && !modal.classList.contains('hidden');
            const titleEl = document.getElementById('tourSlideTitle');
            const title1 = titleEl ? titleEl.textContent.trim() : '';

            // Test next slide
            if (fnNext) window.nextTourSlide();
            const title2 = titleEl ? titleEl.textContent.trim() : '';

            // Test prev slide
            if (fnPrev) window.prevTourSlide();
            const titleBack1 = titleEl ? titleEl.textContent.trim() : '';

            // Test closing
            if (fnClose) window.closeAppTourModal();
            const isClosing = modal && !modal.classList.contains('modal-open');

            return {
                hasModal,
                hasBtn,
                fnOpen,
                fnClose,
                fnNext,
                isOpen,
                title1,
                title2,
                titleBack1,
                isClosing
            };
        })()`);
        console.log('App Tour engine verified:', tourTest);

        if (!tourTest.hasModal ||
            !tourTest.hasBtn ||
            !tourTest.fnOpen ||
            !tourTest.isOpen ||
            !tourTest.title1.includes('ยินดีต้อนรับ') ||
            !tourTest.title2.includes('ถ่ายรูปอาหาร') ||
            !tourTest.titleBack1.includes('ยินดีต้อนรับ') ||
            !tourTest.isClosing) {
            throw new Error('Test 41: App Tour interactive guide failed: ' + JSON.stringify(tourTest));
        }

        ws.close();
        console.log('========================================');
        console.log('🎉 ALL BROWSER CDP INTEGRATION TESTS PASSED 100%!');
        console.log('========================================');
    } catch (err) {
        console.error('❌ Browser integration test failed:', err);
        process.exitCode = 1;
    } finally {
        chrome.kill();
        server.close();
    }
});
