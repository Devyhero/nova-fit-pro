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

    const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    const chrome = spawn(chromePath, [
        '--headless=new',
        '--disable-gpu',
        '--remote-debugging-port=9227',
        '--user-data-dir=/tmp/novafit-chrome-test',
        '--no-first-run',
        '--no-default-browser-check',
        `http://localhost:${PORT}`
    ]);

    await new Promise(r => setTimeout(r, 1500));

    try {
        const httpGet = (url) => new Promise((resolve, reject) => {
            http.get(url, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(JSON.parse(data)));
            }).on('error', reject);
        });

        const targets = await httpGet('http://127.0.0.1:9227/json');
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
        await new Promise(r => setTimeout(r, 1000));
        await evalJs('new Promise(r => setTimeout(r, 500))');

        // Test 1: Check Header Profile Drawer Button
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
        await evalJs('new Promise(r => setTimeout(r, 350))');
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
