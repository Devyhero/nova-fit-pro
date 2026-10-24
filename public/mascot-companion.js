/**
 * NovaFit Pro - Smart Mascot Companion Engine (v5.9.20)
 * Mascot: "MeowNova the Avocado Cat" (น้องเหมียวโนวา แมวอโวคาโด)
 * 
 * Roles:
 * 1. Role 1 (Smart Reactive Floating Bubble): 100% Zero-Token Client Rule-Based Mood & Cheer-Up Engine
 * 2. Role 2 (One-Tap Shortcut Action Hub): Quick Water (+250ml), AI Snap, AI Chat, Minimize
 * 3. Role 3 (MeowNova AI Health Coach): Context-Aware Advice with 4-Tier Strict Token Protection
 */

(function () {
    'use strict';

    // Mascot Mood Image Assets
    const NOVA_MOOD_IMAGES = {
        happy: 'mascot/nova-happy.png',
        thirsty: 'mascot/nova-thirsty.png',
        proud: 'mascot/nova-proud.png',
        workout: 'mascot/nova-workout.png',
        sleepy: 'mascot/nova-sleepy.png'
    };

    // Mascot Mood Status Colors & Accents
    const NOVA_MOOD_ACCENTS = {
        happy: { ring: 'ring-emerald-400', badge: 'bg-emerald-500', icon: '✨' },
        thirsty: { ring: 'ring-cyan-400', badge: 'bg-cyan-500', icon: '💧' },
        proud: { ring: 'ring-amber-400', badge: 'bg-amber-500', icon: '🏆' },
        workout: { ring: 'ring-rose-400', badge: 'bg-rose-500', icon: '🔥' },
        sleepy: { ring: 'ring-indigo-400', badge: 'bg-indigo-500', icon: '🌙' }
    };

    // Client-Side Keyword Blocklist for Tier 1 Token Protection
    const OFF_TOPIC_REGEX = /(javascript|python|html|css|php|sql|react|vue|node|programming|เขียนโค้ด|ภาษาโค้ด|โปรแกรมเมอร์|อัลกอริทึม|github|vscode|การเมือง|รัฐบาล|นายก|พรรค|สภา|ม็อบ|สงคราม|เลือกตั้ง|เผด็จการ|นโยบายรัฐ|หุ้น|คริปโต|บิตคอยน์|bitcoin|crypto|forex|หวย|บาคาร่า|การพนัน|กู้เงิน|สินเชื่อ|ดูดวง|ไพ่ยิปซี|ราศี|เนื้อคู่|แฟนทิ้ง|อกหัก|จีบสาว|ความรัก|แต่งกลอน|เขียนเรียงความ|ช่วยทำการบ้าน|เฉลยข้อสอบ|วิจัย)/i;

    let _currentMascotMood = 'happy';
    let _speechFadeTimer = null;
    let _isAiChatLoading = false;

    // Helper: Get Current ISO Date
    function getTodayIso() {
        if (typeof window.getTodayStr === 'function') {
            return window.getTodayStr();
        }
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // Helper: Play Sound safely
    function playSfx(name) {
        if (typeof window.playSound === 'function') {
            try {
                window.playSound(name);
            } catch (e) {
                // Ignore audio context restrictions
            }
        }
    }

    // Ensure Companion State Integrity
    function ensureCompanionState() {
        if (!window.state) return;
        if (!window.state.mascotCompanion || typeof window.state.mascotCompanion !== 'object') {
            window.state.mascotCompanion = {
                enabled: true,
                minimized: false,
                lastSpeechDate: '',
                lastSpeechTime: 0,
                chatDailyUsage: {}
            };
        }
        if (!window.state.mascotCompanion.chatDailyUsage) {
            window.state.mascotCompanion.chatDailyUsage = {};
        }
    }

    // ==========================================
    // ROLE 1: SMART REACTIVE MOOD & SPEECH ENGINE
    // ==========================================

    function evaluateNovaMood() {
        ensureCompanionState();
        const now = new Date();
        const hour = now.getHours();
        const todayStr = getTodayIso();
        const st = window.state || {};

        // 1. Water Intake Check (13:00 - 18:30)
        const waterGlasses = (st.waterByDate && st.waterByDate[todayStr]) || 0;
        const weight = Number(st.weight) || 65;
        const targetGlasses = Math.max(6, Math.round((weight * 35) / 250));
        const waterRatio = targetGlasses > 0 ? (waterGlasses / targetGlasses) : 0;

        if (hour >= 13 && hour < 19 && waterRatio < 0.5) {
            return {
                mood: 'thirsty',
                text: `บ่ายแล้ว ดื่มน้ำไปแค่ ${waterGlasses} แก้วเองนะเมี้ยว 💧 แตะที่น้องเพื่อ +1 แก้วได้เลย!`,
                actionHint: 'water'
            };
        }

        // 2. Goal Met / Proud Check
        const todayLogs = (st.logsByDate && st.logsByDate[todayStr]) || [];
        const totalCal = todayLogs.reduce((acc, cur) => acc + (Number(cur.cal) || 0), 0);
        const totalP = todayLogs.reduce((acc, cur) => acc + (Number(cur.p) || 0), 0);
        const calorieGoal = Number(st.calorieGoal) || 2000;
        const proteinTarget = (st.macroTargets && st.macroTargets.p) || Math.round(weight * 1.6);

        if (totalP >= proteinTarget && proteinTarget > 0) {
            return {
                mood: 'proud',
                text: `โปรตีนวันนี้ทะลุ ${totalP}g ครบเป้าหมายแล้ว สุดยอดมากเมี้ยว! 🏆✨`,
                actionHint: 'proud'
            };
        }

        if (totalCal >= calorieGoal * 0.9 && totalCal <= calorieGoal * 1.1) {
            return {
                mood: 'proud',
                text: `แคลอรีวันนี้ ${totalCal.toLocaleString()} kcal ตรงเป้าหมายเป๊ะเลย มีวินัยมากเมี้ยว! 🌟`,
                actionHint: 'proud'
            };
        }

        // 3. Late Night / Sleepy / Fasting Check
        const fasting = st.fasting || {};
        if (hour >= 21 || hour < 6) {
            return {
                mood: 'sleepy',
                text: `ดึกแล้วนะเมี้ยว เข้านอนพักผ่อนให้เพียงพอนะ ร่างกายจะได้ฟื้นฟูเต็มที่ 🌙`,
                actionHint: 'sleep'
            };
        }

        if (fasting.isActive && fasting.startTime) {
            const elapsedHours = (Date.now() - fasting.startTime) / (1000 * 60 * 60);
            if (elapsedHours >= 12) {
                return {
                    mood: 'sleepy',
                    text: `คุณอดอาหาร IF มาแล้ว ${Math.floor(elapsedHours)} ชม. อดทนเก่งมาก ร่างกายเริ่มเผาผลาญไขมันแล้วเมี้ยว ⏳`,
                    actionHint: 'fasting'
                };
            }
        }

        // 4. Workout Hours Check (16:30 - 19:30)
        const workoutsToday = (st.workoutLogsByDate && st.workoutLogsByDate[todayStr]) || [];
        if (workoutsToday.length > 0) {
            return {
                mood: 'workout',
                text: `ออกกำลังกายสำเร็จไปแล้ว! เบิร์นไขมันกระจุยเลย เก่งที่สุดเมี้ยว 🔥`,
                actionHint: 'workout'
            };
        }

        if (hour >= 16 && hour <= 19) {
            return {
                mood: 'workout',
                text: `ช่วงเย็นเหมาะกับการขยับร่างกาย เผาผลาญแคลอรีสุดๆ ไปลุยกันเมี้ยว! 💪🔥`,
                actionHint: 'workout'
            };
        }

        // 5. Default Morning / Energized
        if (hour >= 6 && hour < 12) {
            return {
                mood: 'happy',
                text: `อรุณสวัสดิ์เมี้ยว! เช้านี้อย่าลืมบันทึกมื้อเช้าเพิ่มพลังงานนะ 🥑✨`,
                actionHint: 'happy'
            };
        }

        return {
            mood: 'happy',
            text: `โค้ชเหมียวโนวาพร้อมดูแลสุขภาพคุณแล้วเมี้ยว แตะที่น้องเพื่อสั่งการด่วนได้เลย 🥑`,
            actionHint: 'happy'
        };
    }

    function renderNovaMascot() {
        ensureCompanionState();
        const container = document.getElementById('novaMascotContainer');
        const pill = document.getElementById('novaMascotPill');
        const img = document.getElementById('novaMascotImg');
        const badge = document.getElementById('novaMascotBadge');

        if (!container || !img) return;

        const compState = window.state?.mascotCompanion || {};
        if (compState.enabled === false) {
            container.classList.add('hidden');
            if (pill) pill.classList.add('hidden');
            return;
        }

        // Handle Minimized State
        if (compState.minimized) {
            container.classList.add('hidden');
            if (pill) {
                pill.classList.remove('hidden');
            }
            return;
        } else {
            container.classList.remove('hidden');
            if (pill) pill.classList.add('hidden');
        }

        const moodData = evaluateNovaMood();
        _currentMascotMood = moodData.mood;

        // Update Mascot Face
        const imgSrc = NOVA_MOOD_IMAGES[_currentMascotMood] || NOVA_MOOD_IMAGES.happy;
        img.src = imgSrc;
        img.alt = `MeowNova Cat (${_currentMascotMood})`;

        // Update Mood Badge
        if (badge) {
            const acc = NOVA_MOOD_ACCENTS[_currentMascotMood] || NOVA_MOOD_ACCENTS.happy;
            badge.className = `absolute -top-1 -right-1 w-5 h-5 rounded-full ${acc.badge} text-[10px] text-white flex items-center justify-center shadow-md animate-pulse`;
            badge.textContent = acc.icon;
        }
    }

    function showNovaSpeechBubble(customText, durationMs = 5000) {
        const bubble = document.getElementById('novaSpeechBubble');
        const bubbleText = document.getElementById('novaSpeechBubbleText');
        if (!bubble || !bubbleText) return;

        const moodData = evaluateNovaMood();
        const message = customText || moodData.text;

        bubbleText.textContent = message;
        bubble.classList.remove('hidden', 'opacity-0', 'scale-95');
        bubble.classList.add('opacity-100', 'scale-100');

        if (_speechFadeTimer) {
            clearTimeout(_speechFadeTimer);
        }

        _speechFadeTimer = setTimeout(() => {
            hideNovaSpeechBubble();
        }, durationMs);
    }

    function hideNovaSpeechBubble() {
        const bubble = document.getElementById('novaSpeechBubble');
        if (!bubble) return;
        bubble.classList.remove('opacity-100', 'scale-100');
        bubble.classList.add('opacity-0', 'scale-95');
        setTimeout(() => {
            if (bubble.classList.contains('opacity-0')) {
                bubble.classList.add('hidden');
            }
        }, 300);
    }

    // Toggle Mascot Floating Quick Menu
    function toggleNovaQuickMenu(forceClose = false) {
        const menu = document.getElementById('novaQuickMenu');
        if (!menu) return;

        const isHidden = menu.classList.contains('hidden');
        if (forceClose || !isHidden) {
            menu.classList.add('hidden');
        } else {
            hideNovaSpeechBubble();
            menu.classList.remove('hidden');
            playSfx('pop');
        }
    }

    // Minimize mascot into small edge pill
    function minimizeNovaMascot() {
        ensureCompanionState();
        if (window.state && window.state.mascotCompanion) {
            window.state.mascotCompanion.minimized = true;
            if (typeof window.saveState === 'function') window.saveState();
        }
        toggleNovaQuickMenu(true);
        renderNovaMascot();
        if (typeof window.showToast === 'function') {
            window.showToast('🥑 ซ่อนน้องเหมียวโนวาแล้ว แตะแถบขอบจอเพื่อเรียกกลับมาได้ตลอดนะเมี้ยว');
        }
    }

    // Restore mascot from edge pill
    function restoreNovaMascot() {
        ensureCompanionState();
        if (window.state && window.state.mascotCompanion) {
            window.state.mascotCompanion.minimized = false;
            if (typeof window.saveState === 'function') window.saveState();
        }
        renderNovaMascot();
        showNovaSpeechBubble('สวัสดีเมี้ยว! เหมียวโนวากลับมาดูแลแล้ว 🥑✨', 4000);
        playSfx('pop');
    }

    // ==========================================
    // ROLE 2: ONE-TAP SHORTCUT ACTION HUB
    // ==========================================

    function quickAddWaterFromMascot() {
        toggleNovaQuickMenu(true);
        if (typeof window.addWater === 'function') {
            window.addWater(1);
        } else {
            const today = getTodayIso();
            if (!window.state.waterByDate) window.state.waterByDate = {};
            window.state.waterByDate[today] = (window.state.waterByDate[today] || 0) + 1;
            if (typeof window.saveState === 'function') window.saveState();
            if (typeof window.renderAll === 'function') window.renderAll();
        }

        playSfx('water');
        
        // Mascot cheers
        const img = document.getElementById('novaMascotImg');
        if (img) img.src = NOVA_MOOD_IMAGES.proud;
        showNovaSpeechBubble('ชื่นใจจัง! บันทึกน้ำ +1 แก้ว (250 ml) สำเร็จแล้วเมี้ยว 💧✨', 4500);

        setTimeout(() => {
            renderNovaMascot();
        }, 5000);
    }

    function quickOpenAiSnapFromMascot() {
        toggleNovaQuickMenu(true);
        if (typeof window.openAiSnapModal === 'function') {
            window.openAiSnapModal('photo');
        } else {
            alert('ระบบ AI Snap กำลังโหลด กรุณารอสักครู่ครับ');
        }
    }

    // ==========================================
    // ROLE 3: MEOWNOVA AI HEALTH COACH WITH SMART FALLBACK & 4-TIER GUARD
    // ==========================================

    function getChatDailyQuota() {
        const isAuth = !!window.currentUser;
        const maxQuota = isAuth ? 5 : 3;
        const todayStr = getTodayIso();
        const usageMap = window.state?.mascotCompanion?.chatDailyUsage || {};
        const used = usageMap[todayStr] || 0;
        const remaining = Math.max(0, maxQuota - used);
        return { used, remaining, maxQuota };
    }

    function incrementChatDailyQuota() {
        ensureCompanionState();
        const todayStr = getTodayIso();
        const usage = window.state.mascotCompanion.chatDailyUsage;
        usage[todayStr] = (usage[todayStr] || 0) + 1;
        if (typeof window.saveState === 'function') window.saveState();
        updateChatQuotaUI();
    }

    function updateChatQuotaUI() {
        const badge = document.getElementById('novaChatQuotaBadge');
        if (!badge) return;
        const { remaining, maxQuota } = getChatDailyQuota();
        const isUat = typeof window.isUatEnvironment === 'function' && window.isUatEnvironment();
        
        if (isUat) {
            badge.textContent = '⚡ โควตาไม่จำกัด (UAT Sandbox)';
            badge.className = 'text-[11px] px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-400 font-bold';
        } else {
            badge.textContent = `ถามได้อีก ${remaining}/${maxQuota} ครั้งวันนี้`;
            badge.className = remaining > 0
                ? 'text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold'
                : 'text-[11px] px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-500 font-bold';
        }
    }

    function openNovaChatModal() {
        toggleNovaQuickMenu(true);
        hideNovaSpeechBubble();
        updateChatQuotaUI();

        // Populate initial greeting if empty
        const history = document.getElementById('novaChatHistory');
        if (history && history.children.length === 0) {
            appendMascotMessage('สวัสดีเมี้ยว! โค้ชเหมียวโนวาพร้อมตอบข้อสงสัยเรื่องอาหาร แคลอรี สารอาหาร และการออกกำลังกายให้คุณแล้ว มีอะไรให้น้องช่วยแนะนำไหมเมี้ยว 🥑✨');
        }

        if (typeof window.openModalAnimated === 'function') {
            window.openModalAnimated('novaChatModal');
        } else {
            document.getElementById('novaChatModal')?.classList.remove('hidden');
        }
        playSfx('pop');
    }

    function closeNovaChatModal() {
        if (typeof window.closeModalAnimated === 'function') {
            window.closeModalAnimated('novaChatModal');
        } else {
            document.getElementById('novaChatModal')?.classList.add('hidden');
        }
    }

    function appendUserMessage(text) {
        const history = document.getElementById('novaChatHistory');
        if (!history) return;

        const row = document.createElement('div');
        row.className = 'flex justify-end gap-2 animate-pop';
        row.innerHTML = `
            <div class="max-w-[80%] p-3 rounded-2xl rounded-tr-xs bg-emerald-500 text-white text-xs leading-relaxed shadow-sm font-medium">
                ${escapeHtml(text)}
            </div>
            <div class="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs shrink-0 select-none">
                👤
            </div>
        `;
        history.appendChild(row);
        history.scrollTop = history.scrollHeight;
    }

    function appendMascotMessage(text, isTyping = false) {
        const history = document.getElementById('novaChatHistory');
        if (!history) return;

        const row = document.createElement('div');
        row.className = 'flex items-start gap-2 animate-pop mascot-msg-row';
        row.innerHTML = `
            <div class="w-8 h-8 rounded-full border border-emerald-400/40 bg-emerald-50 dark:bg-emerald-950/40 p-0.5 shrink-0 select-none overflow-hidden shadow-xs">
                <img src="${NOVA_MOOD_IMAGES.happy}" alt="MeowNova" class="w-full h-full object-contain">
            </div>
            <div class="max-w-[82%] p-3 rounded-2xl rounded-tl-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs leading-relaxed shadow-xs">
                ${isTyping ? '<span class="inline-flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce"></span><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.2s]"></span><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.4s]"></span></span>' : formatMascotText(text)}
            </div>
        `;
        history.appendChild(row);
        history.scrollTop = history.scrollHeight;
        return row;
    }

    function escapeHtml(str) {
        return (str || '').replace(/[&<>"']/g, m => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[m]));
    }

    function formatMascotText(text) {
        return escapeHtml(text).replace(/\n/g, '<br>');
    }

    // Dynamic, Context-Aware Offline & Heuristic Advisor (NEVER repeats a static sentence!)
    function generateSmartLocalAdvice(question, stats) {
        const q = (question || '').toLowerCase();
        const { remainCal, totalP, targetP, waterGlasses, targetGlasses } = stats;

        // 1. Shabu / Suki / Buffet
        if (/ชาบู|สุกี้|หมูกระทะ|บุฟเฟต์|ปิ้งย่าง/i.test(q)) {
            return `กินชาบูให้ฟินและไม่อ้วนเมี้ยว: 1. เลือกน้ำซุปใส 2. เน้นเนื้อสัตว์ไม่ติดมัน เช่น สันใน/อกไก่/กุ้ง 3. ทานผักใบเขียวก่อน 4. จิ้มน้ำจิ้มพอประมาณ ตอนนี้แคลอรีคุณเหลืออีก ${remainCal} kcal จัดสรรได้สบายๆ เลยน้า 🍲😋`;
        }

        // 2. Protein deficit & suggestions
        if (/โปรตีน|เนื้อ|ไก่|ไข่|เวย์|whey/i.test(q)) {
            const pGap = Math.max(0, targetP - totalP);
            if (pGap > 0) {
                return `วันนี้โปรตีนทานไปแล้ว ${totalP}g ยังขาดอีก ${pGap}g เมี้ยว! แนะนำเสริมด้วย: ไข่ต้ม 2 ฟอง (~12g P), อกไก่ 100g (~23g P), หรือนมถั่วเหลือง/เวย์โปรตีน จะช่วยซ่อมแซมกล้ามเนื้อได้พอดีเป๊ะเลย 🍗🍳`;
            } else {
                return `สุดยอดมากเมี้ยว! โปรตีนวันนี้ทะลุ ${totalP}g เกินเป้าหมาย ${targetP}g เรียบร้อยแล้ว กล้ามเนื้อฟื้นตัวเต็มที่แน่นอน ทานมื้อต่อไปเน้นผักและคาร์บเชิงซ้อนได้เลยน้า 🌟`;
            }
        }

        // 3. Water Intake
        if (/น้ำ|ดื่ม|กี่แก้ว|กี่ลิตร|กระหาย|hydration/i.test(q)) {
            const wGap = Math.max(0, targetGlasses - waterGlasses);
            return `การดื่มน้ำวันละ 2-3 ลิตรช่วยเร่งการเผาผลาญไขมัน ลดอาการหิวปลอม และช่วยให้ระบบขับถ่ายคล่องตัวเมี้ยว! วันนี้ดื่มไปแล้ว ${waterGlasses} แก้ว (${waterGlasses * 250} ml) จิบเพิ่มอีก ${wGap > 0 ? wGap + ' แก้ว' : 'เรื่อยๆ'} เพื่อความสดชื่นนะเมี้ยว 💧✨`;
        }

        // 4. Workout / Exercise Timing
        if (/ออกกำลัง|เวท|วิ่ง|คาร์ดิโอ|ซ้อม|ยิม|ฟิตเนส|ก่อนหรือหลัง/i.test(q)) {
            return `ถ้าเน้นเบิร์นไขมัน คาร์ดิโอเบาๆ ตอนเช้าก่อนอาหารก็เหมาะมากเมี้ยว! แต่ถ้าเน้นยกเวทสร้างกล้าม แนะนำทานกล้วยหอมหรือขนมปัง 1 แผ่นก่อนเล่น 45 นาที จะช่วยให้มีพลังงานยกได้หนักขึ้นโดยไม่หมดแรงน้า 💪🔥`;
        }

        // 5. Dinner / Evening meal
        if (/เย็น|มื้อเย็น|ค่ำ|อาหารเย็น/i.test(q)) {
            return `มื้อเย็นวันนี้ แคลอรีคงเหลือ ${remainCal} kcal แนะนำเมนูเบาสบายท้อง ย่อยง่าย เช่น เกาเหลาไก่ฉีก, ส้มตำไก่ย่างไม่ติดหนัง, สเต๊กปลา หรือสลัดอกไก่น้ำใส ทานก่อนนอนอย่างน้อย 3 ชม. จะหลับสบายไม่อึดอัดเมี้ยว 🥗🥑`;
        }

        // 6. Late night hunger / cravings
        if (/หิว|ดึก|มื้อดึก|นอนไม่หลับ/i.test(q)) {
            return `ถ้าหิวช่วงดึก แนะนำจิบน้ำอุ่นหรือชาคาโมมายล์ก่อนเมี้ยว ถ้าร่างกายต้องการพลังงานจริงๆ ให้เลือกไข่ต้ม 1 ฟอง, กรีกโยเกิร์ต 1 ถ้วย, หรือนมอัลมอนด์ ไม่เกิน 100 kcal เพื่อไม่ให้รบกวนฮอร์โมนเผาผลาญตอนนอนน้า 🌙`;
        }

        // 7. Carb / Rice / Bread / Starch
        if (/ข้าว|แป้ง|คาร์บ|เส้น|ขนมปัง/i.test(q)) {
            return `คาร์บไม่ใช่ผู้ร้ายน้าเมี้ยว! ร่างกายต้องการคาร์บเป็นพลังงานหลัก แค่เลือกคาร์บเชิงซ้อน เช่น ข้าวกล้อง ข้าวไรซ์เบอร์รี่ หรือมันหวาน จะอิ่มนานและระดับน้ำตาลในเลือดนิ่งขึ้นเมี้ยว 🍠🍚`;
        }

        // 8. Fat / Fried / Oil
        if (/ไขมัน|ของทอด|มัน/i.test(q)) {
            return `ไขมันดีจำเป็นต่อการสร้างฮอร์โมนเมี้ยว! เลือกไขมันจากอโวคาโด น้ำมันมะกอก หรือถั่วเปลือกแข็ง เลี่ยงของทอดน้ำมันซ้ำ แค่นี้หลอดเลือดก็สะอาดหุ่นเฟิร์มแน่นอนน้า 🥑🥜`;
        }

        // 9. IF / Fasting
        if (/if|fasting|อดอาหาร|กี่ชั่วโมง/i.test(q)) {
            return `ช่วง Fasting ร่างกายจะดึงไขมันสะสมมาใช้เป็นพลังงานและซ่อมแซมเซลล์เมี้ยว! ระหว่างอดสามารถดื่มน้ำเปล่า ชาไม่ใส่น้ำตาล และกาแฟดำได้ สู้ๆ นะเมี้ยว อดทนอีกนิดเพื่อหุ่นในฝัน ⏳✨`;
        }

        // 10. Default Context-Aware Answer
        return `สำหรับคำถามนี้ จากเป้าหมายวันนี้แคลอรีคงเหลือ ${remainCal} kcal แนะนำให้เลือกทานอาหารธรรมชาติ (Whole Foods) โปรตีนคุณภาพดี และดื่มน้ำให้เพียงพอ เหมียวโนวาเป็นกำลังใจให้เสมอ ลุยไปด้วยกันนะเมี้ยว 🥑✨`;
    }

    // Ask Question with 4-Tier Guard
    async function handleNovaAskSubmit(overrideText = null) {
        const input = document.getElementById('novaChatInput');
        const question = (overrideText || input?.value || '').trim();
        if (!question || _isAiChatLoading) return;

        if (input && !overrideText) {
            input.value = '';
        }

        // Show User Message
        appendUserMessage(question);

        // ==========================================
        // TIER 1: CLIENT-SIDE KEYWORD BLOCKLIST (0 TOKENS)
        // ==========================================
        if (OFF_TOPIC_REGEX.test(question)) {
            playSfx('pop');
            appendMascotMessage('เหมียว~ โค้ชเหมียวโนวาเชี่ยวชาญเฉพาะเรื่องอาหาร แคลอรี สารอาหาร และการออกกำลังกายเท่านั้นน้าเมี้ยว เรื่องอื่นน้องตอบไม่ได้จริง ๆ ลองถามเกี่ยวกับเมนูวันนี้หรือเป้าหมายสุขภาพดูสิเมี้ยว 🥑✨');
            return;
        }

        // ==========================================
        // TIER 3: DAILY QUOTA CHECK
        // ==========================================
        const isUat = typeof window.isUatEnvironment === 'function' && window.isUatEnvironment();
        const { remaining } = getChatDailyQuota();

        if (!isUat && remaining <= 0) {
            playSfx('pop');
            appendMascotMessage('โควตาคำถามวันนี้ครบกำหนดแล้วน้าเมี้ยว ไว้พรุ่งนี้มาคุยกันใหม่ หรือเปิดดูเคล็ดลับสุขภาพประจำวันในแอปได้เลยนะเมี้ยว! 🥑');
            return;
        }

        // ==========================================
        // TIER 4: BUILD PERSONALIZED CONTEXT
        // ==========================================
        const st = window.state || {};
        const todayStr = getTodayIso();
        const logs = (st.logsByDate && st.logsByDate[todayStr]) || [];
        const totalCal = logs.reduce((a, c) => a + (Number(c.cal) || 0), 0);
        const totalP = logs.reduce((a, c) => a + (Number(c.p) || 0), 0);
        const totalC = logs.reduce((a, c) => a + (Number(c.c) || 0), 0);
        const totalF = logs.reduce((a, c) => a + (Number(c.f) || 0), 0);
        const goalCal = Number(st.calorieGoal) || 2000;
        const remainCal = Math.max(0, goalCal - totalCal);
        const waterGlasses = (st.waterByDate && st.waterByDate[todayStr]) || 0;
        const weight = st.weight || 65;
        const targetP = (st.macroTargets && st.macroTargets.p) || Math.round(weight * 1.6);
        const targetGlasses = Math.max(6, Math.round((weight * 35) / 250));

        const userContextPrompt = `ข้อมูลสุขภาพผู้ใช้วันนี้:
- น้ำหนัก: ${weight} กก.
- เป้าหมายแคลอรี: ${goalCal} kcal | ทานแล้ว: ${totalCal} kcal (เหลือ ${remainCal} kcal)
- โปรตีน: ${totalP}g / คาร์บ: ${totalC}g / ไขมัน: ${totalF}g
- ดื่มน้ำ: ${waterGlasses} แก้ว (${waterGlasses * 250} ml)`;

        // Show typing indicator
        _isAiChatLoading = true;
        const sendBtn = document.getElementById('btnNovaSendChat');
        if (sendBtn) sendBtn.disabled = true;

        const typingRow = appendMascotMessage('', true);

        // ==========================================
        // TIER 2: STRICT SYSTEM PROMPT & GEMINI CALL WITH MULTI-MODEL FALLBACK
        // ==========================================
        try {
            const systemInstruction = `คุณคือ "MeowNova" (เหมียวโนวา) แมวอโวคาโด โค้ชสุขภาพและโภชนาการประจำแอป NovaFit Pro
บุคลิก: อบอุ่น เป็นกันเอง ให้กำลังใจ ใช้คำลงท้ายน่ารักสุภาพสไตล์แมว เช่น "เมี้ยว" หรือ "น้า"
ขอบเขตคำตอบ: ตอบเฉพาะเรื่องอาหาร สารอาหาร (โปรตีน/คาร์บ/ไขมัน) แคลอรี น้ำหนัก การดื่มน้ำ IF และการออกกำลังกายเท่านั้น
ความยาว: ตอบกระชับตรงประเด็น 2-3 ประโยค (ไม่เกิน 70 คำ) และห้ามตอบเรื่องนอกเหนือจากสุขภาพเด็ดขาด`;

            let apiKey = '';
            if (typeof window.getGeminiApiKey === 'function') {
                apiKey = window.getGeminiApiKey();
            } else {
                apiKey = localStorage.getItem('novafit_gemini_api_key') || localStorage.getItem('novafit_system_gemini_api_key') || '';
            }

            const candidateModels = [
                'gemini-2.5-flash',
                'gemini-2.0-flash',
                'gemini-1.5-flash',
                'gemini-1.5-flash-latest'
            ];

            let replyText = null;

            if (apiKey) {
                const fullPrompt = `${systemInstruction}\n\n${userContextPrompt}\n\nคำถามจากผู้ใช้: "${question}"`;

                for (const modelName of candidateModels) {
                    try {
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 10000);
                        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(apiKey)}`;

                        const response = await fetch(url, {
                            method: 'POST',
                            signal: controller.signal,
                            headers: {
                                'Content-Type': 'application/json',
                                'x-goog-api-key': apiKey
                            },
                            body: JSON.stringify({
                                contents: [
                                    {
                                        parts: [{ text: fullPrompt }]
                                    }
                                ],
                                generationConfig: {
                                    temperature: 0.6,
                                    maxOutputTokens: 220
                                }
                            })
                        });
                        clearTimeout(timeoutId);

                        if (!response.ok) {
                            console.warn(`MeowNova: model ${modelName} returned status ${response.status}`);
                            continue;
                        }

                        const data = await response.json();
                        const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (candidate && candidate.trim()) {
                            replyText = candidate.trim();
                            break;
                        }
                    } catch (e) {
                        console.warn(`MeowNova model ${modelName} attempt failed:`, e);
                    }
                }
            }

            // If API didn't return (no key, offline, or temporary API rate limit) -> Run Smart Contextual Local Advisor!
            if (!replyText) {
                await new Promise(r => setTimeout(r, 400));
                replyText = generateSmartLocalAdvice(question, {
                    remainCal,
                    totalP,
                    targetP,
                    waterGlasses,
                    targetGlasses
                });
            }

            typingRow.remove();

            if (replyText) {
                appendMascotMessage(replyText);
                incrementChatDailyQuota();
                playSfx('pop');
            } else {
                appendMascotMessage('ขออภัยด้วยนะเมี้ยว พอดีมีสัญญาณรบกวน ลองแตะถามอีกครั้งดูน้า 🥑');
            }

        } catch (err) {
            console.warn('MeowNova Chat error:', err);
            typingRow.remove();
            // Intelligent fallback with user stats
            const fallbackReply = generateSmartLocalAdvice(question, {
                remainCal,
                totalP,
                targetP,
                waterGlasses,
                targetGlasses
            });
            appendMascotMessage(fallbackReply);
        } finally {
            _isAiChatLoading = false;
            if (sendBtn) sendBtn.disabled = false;
        }
    }

    function askNovaSample(text) {
        handleNovaAskSubmit(text);
    }

    // ==========================================
    // INITIALIZATION & LIFECYCLE
    // ==========================================

    function initNovaMascotCompanion() {
        ensureCompanionState();
        renderNovaMascot();

        // Check if first greeting needed
        setTimeout(() => {
            const comp = window.state?.mascotCompanion;
            if (comp && !comp.minimized && comp.enabled !== false) {
                showNovaSpeechBubble(null, 5500);
            }
        }, 1200);

        // Periodically refresh mood every 5 minutes
        setInterval(() => {
            renderNovaMascot();
        }, 5 * 60 * 1000);
    }

    // Close popups on outside click
    document.addEventListener('click', (e) => {
        const container = document.getElementById('novaMascotContainer');
        const menu = document.getElementById('novaQuickMenu');
        if (container && menu && !menu.classList.contains('hidden')) {
            if (!container.contains(e.target)) {
                menu.classList.add('hidden');
            }
        }
    });

    function toggleMascotCompanion() {
        ensureCompanionState();
        window.state.mascotCompanion.enabled = !(window.state.mascotCompanion.enabled !== false);
        if (window.state.mascotCompanion.enabled) {
            window.state.mascotCompanion.minimized = false;
        }
        if (typeof window.saveState === 'function') window.saveState();
        renderNovaMascot();
        renderMascotMenuBadge();
        if (window.state.mascotCompanion.enabled) {
            if (typeof window.showToast === 'function') window.showToast('🥑 เปิดน้องเหมียวโนวา บับเบิ้ลคู่คิดเรียบร้อย');
            showNovaSpeechBubble('สวัสดีเมี้ยว! เหมียวโนวากลับมาดูแลแล้ว 🥑✨', 4000);
        } else {
            if (typeof window.showToast === 'function') window.showToast('🥑 ปิดการแสดงผลน้องเหมียวโนวาเรียบร้อย');
        }
    }

    function renderMascotMenuBadge() {
        const badge = document.getElementById('mascotMenuBadge');
        if (!badge) return;
        const isEnabled = window.state?.mascotCompanion?.enabled !== false;
        badge.textContent = isEnabled ? 'เปิด' : 'ปิด';
        badge.className = isEnabled
            ? 'text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold'
            : 'text-[10px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 font-bold';
    }

    // Window Exports
    window.evaluateNovaMood = evaluateNovaMood;
    window.renderNovaMascot = renderNovaMascot;
    window.showNovaSpeechBubble = showNovaSpeechBubble;
    window.hideNovaSpeechBubble = hideNovaSpeechBubble;
    window.toggleNovaQuickMenu = toggleNovaQuickMenu;
    window.minimizeNovaMascot = minimizeNovaMascot;
    window.restoreNovaMascot = restoreNovaMascot;
    window.quickAddWaterFromMascot = quickAddWaterFromMascot;
    window.quickOpenAiSnapFromMascot = quickOpenAiSnapFromMascot;
    window.openNovaChatModal = openNovaChatModal;
    window.closeNovaChatModal = closeNovaChatModal;
    window.handleNovaAskSubmit = handleNovaAskSubmit;
    window.askNovaSample = askNovaSample;
    window.toggleMascotCompanion = toggleMascotCompanion;
    window.renderMascotMenuBadge = renderMascotMenuBadge;
    window.generateSmartLocalAdvice = generateSmartLocalAdvice;
    window.initNovaMascotCompanion = initNovaMascotCompanion;

    // Auto-init when DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initNovaMascotCompanion);
    } else {
        setTimeout(initNovaMascotCompanion, 200);
    }

})();
