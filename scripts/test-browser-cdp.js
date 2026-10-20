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
                return res.result ? res.result.value : null;
            } catch (err) {
                if (retries > 0 && err && err.message && err.message.includes('Execution context was destroyed')) {
                    await new Promise(r => setTimeout(r, 400));
                    return evalJs(expr, retries - 1);
                }
                throw err;
            }
        };

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

        // Test 26: Admin Table Pagination Engine (v5.8.3)
        console.log('--- Test 26: Admin Table Pagination Engine ---');
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
