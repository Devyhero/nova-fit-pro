/**
 * NovaFit Pro - Living App Companion & Milestone Celebration Engine (v5.9.30)
 * Manages empathy nudges, milestone celebration confetti (60fps Canvas),
 * anti-repetition random message pools, timer loops, and sandbox testing.
 */

(function () {
    'use strict';

    // Safe inter-module helpers
    function getTodayStrSafe() {
        if (typeof getTodayStr === 'function') return getTodayStr();
        if (typeof window.getTodayStr === 'function') return window.getTodayStr();
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        return new Date(now.getTime() - offset).toISOString().split('T')[0];
    }

    function playSoundSafe(sound) {
        if (typeof playSound === 'function') return playSound(sound);
        if (typeof window.playSound === 'function') return window.playSound(sound);
    }

    function getAppStateSafe() {
        return typeof state !== 'undefined' ? state : window.state;
    }

    function getTargetsSafe() {
        if (typeof getCalculatedTargets === 'function') return getCalculatedTargets();
        if (typeof window.getCalculatedTargets === 'function') return window.getCalculatedTargets();
        return { totalCal: 2000, pGram: 130, waterTargetGlasses: 8, waterTargetMl: 2000 };
    }

    function adjustWaterSafe(delta) {
        if (typeof adjustWater === 'function') return adjustWater(delta);
        if (typeof window.adjustWater === 'function') return window.adjustWater(delta);
    }

    function renderMealSelectorSafe() {
        if (typeof renderMealSelector === 'function') return renderMealSelector();
        if (typeof window.renderMealSelector === 'function') return window.renderMealSelector();
    }

    // Companion Internal State & Timers
    let _companionDismissTimer = null;
    let _companionCheckDebounce = null;
    let _currentCompanionNudgeId = null;
    let _currentCompanionConfig = null;
    let _milestoneDismissTimer = null;
    let _confettiAnimationId = null;

    const CHEERFUL_DAILY_QUOTES = [
        { icon: '🌈', msg: 'สวัสดีวันใหม่นะ! มีเราคอยเชียร์อยู่ข้างๆ เสมอ วันนี้มาสร้างสุขภาพที่ดีไปด้วยกัน! ✨' },
        { icon: '🥑', msg: 'สุขภาพดีไม่ได้สร้างได้ในวันเดียว แต่สร้างได้ในทุกคำที่เราเลือกทานในวันนี้ สู้ๆ น้า! 💖' },
        { icon: '🚀', msg: 'ความมีวินัยของคุณวันนี้น่าชื่นชมมาก ไม่ว่าเป้าหมายคืออะไร คุณทำสำเร็จแน่นอน! ⭐' },
        { icon: '💧', msg: 'อย่าลืมจิบน้ำเรื่อยๆ ระหว่างวันนะ จะช่วยให้สมองปลอดโปร่งและสดชื่นตลอดวันเลย 🧠' },
        { icon: '🥗', msg: 'เลือกทานอาหารที่มีประโยชน์ให้ร่างกายวันนี้ ร่างกายจะขอบคุณคุณไปอีกนานเลยนะ 🥦' },
        { icon: '✨', msg: 'ความก้าวหน้าทีละนิดในทุกๆ วัน เมื่อรวมกันจะสร้างความเปลี่ยนแปลงที่ยิ่งใหญ่ เป็นกำลังใจให้เสมอครับ! 🌟' },
        { icon: '🎯', msg: 'ไม่ต้องสมบูรณ์แบบทุกวัน แค่ไม่หยุดพัฒนาตัวเอง คุณก็เก่งขึ้นกว่าเมื่อวานแล้ว ลุยกันต่อเลย! 🏃' },
        { icon: '🌱', msg: 'การดูแลตัวเองคือการลงทุนที่คุ้มค่าที่สุด ทานให้อิ่ม นอนให้อุ่น และใจดีกับตัวเองเยอะๆ นะครับ 💖' },
        { icon: '☀️', msg: 'เริ่มต้นวันใหม่ด้วยรอยยิ้มและพลังบวก วันนี้ขอให้เป็นวันที่สดใสและทานของอร่อยที่มีประโยชน์นะ! 🍳' },
        { icon: '🔥', msg: 'วินัยคือสะพานเชื่อมระหว่างเป้าหมายกับความสำเร็จ และวันนี้คุณกำลังก้าวข้ามสะพานนั้นอยู่นะ สุดยอดมาก! 🏆' },
        { icon: '🌿', msg: 'ฟังเสียงร่างกายตัวเอง ทานเมื่อหิว อิ่มพอดี และเลือกสิ่งดีๆ ให้ตัวเอง คุณทำได้ดีมากๆ แล้วครับ 💚' },
        { icon: '💖', msg: 'ไม่ว่าเมื่อวานจะเป็นอย่างไร วันนี้คือโอกาสใหม่เสมอ ยิ้มรับวันใหม่แล้วไปพิชิตเป้าหมายกันเถอะ! 🌈' }
    ];

    const COMPANION_MESSAGE_TEMPLATES = {
        missing_breakfast: [
            '🥺 ใกล้เที่ยงแล้วยังไม่เห็นมื้อเช้าเลย... งานยุ่งจนลืมทานหรือยังไม่ได้กรอกเอ่ย? แวะเติมพลังงานหน่อยนะค้าบบ 🍳',
            '☀️ มื้อเช้าคือสวิตช์เปิดระบบเผาผลาญของวันนะ! อย่าปล่อยให้ท้องร้อง รีบเติมอาหารดีๆ ให้ร่างกายกันครับ 🥪',
            '🍳 งานกองโตแค่ไหนก็อย่าลืมดูแลตัวเองน้า มีเวลาสัก 5 นาที แวะทานอะไรรองท้องหน่อยนะ เป็นห่วงครับ! 🥛',
            '🍞 กองทัพต้องเดินด้วยท้อง! แวะเติมคาร์บเชิงซ้อนกับโปรตีนยามเช้า สมองจะได้แล่นและมีพลังลุยงานต่อนะ ✨',
            '☕ เช้านี้แวะทานอะไรหรือยังเอ่ย? ถ้าทานแล้วอย่าลืมกดบันทึกไว้น้า เราจะได้ช่วยคำนวณเป้าหมายให้เป๊ะๆ! 🥑',
            '🥑 เติมพลังงานดีๆ มื้อแรกของวันกันครับ สุขภาพที่ดีเริ่มได้ตั้งแต่คำแรกของวันเลยนะ สู้ๆ! 💖'
        ],
        missing_lunch: [
            '🍱 บ่ายแล้วนะ งานยุ่งจนลืมทานข้าวเที่ยงรึเปล่า? พักสายตาจากงานแล้วแวะทานของอร่อยๆ เติมพลังหน่อยนะ! 🥗',
            '🍲 ถึงเวลาพักเบรกแล้ว! วางงานลงสักครู่แล้วไปทานมื้อเที่ยงอร่อยๆ กัน ร่างกายต้องการพลังงานช่วงบ่ายนะค้าบ 🍛',
            '🍛 อย่าปล่อยให้ระดับน้ำตาลตกน้า แวะเติมพลังมื้อกลางวันกันครับ ร่างกายจะได้สดชื่น ไม่เพลียช่วงบ่าย! ☀️',
            '🥗 มื้อเที่ยงคือช่วงเติมพลังหลักของวันเลย! ลองเลือกโปรตีนดีๆ กับผักสดสักจาน แล้วบันทึกลงแอปได้เลยน้า 🍗',
            '🍜 พักเบรกยืดเส้นยืดสาย แล้วแวะทานมื้อเที่ยงกันครับ ทานของอร่อยแล้วมีแรงลุยงานช่วงบ่ายแน่นอน! 🚀',
            '🍱 ถ้าทานข้าวเที่ยงเรียบร้อยแล้ว อย่าลืมแวะมากดบันทึกน้า ระบบกำลังรออัปเดตสารอาหารให้คุณอยู่ครับ 🥦'
        ],
        missing_dinner: [
            '🌙 ค่ำแล้วน้า วันนี้ทานมื้อเย็นหรือยังเอ่ย? อย่าปล่อยให้ท้องหิวจนนอนไม่หลับนะค้าบบ 🍲',
            '🍲 เลิกงานแล้ว แวะทานมื้อค่ำเพื่อฟื้นฟูร่างกายกันครับ เน้นโปรตีนย่อยง่ายและผัก จะช่วยให้นอนหลับสบายนะ 🥗',
            '🌜 วันนี้ใช้พลังงานมาทั้งวันแล้ว ให้รางวัลร่างกายด้วยมื้อค่ำที่มีประโยชน์กันเถอะ อิ่มท้องกำลังดี หลับสบาย 😴',
            '🥣 ค่ำนี้อย่าอดอาหารเย็นเลยน้า เลือกเมนูเบาๆ ย่อยง่าย ร่างกายจะได้นำสารอาหารไปซ่อมแซมส่วนที่สึกหรอคืนนี้ครับ 🐟',
            '🌛 มื้อเย็นทานอะไรดีเอ่ย? ทานแล้วอย่าลืมแวะมาติ๊กบันทึกนะ จะได้รู้ว่าวันนี้ปิดจ็อบแคลอรีไปเท่าไหร่แล้ว 📝',
            '🥗 วันนี้เหนื่อยมาทั้งวัน ขอบคุณตัวเองด้วยอาหารดีๆ สักมื้อ แล้วพักผ่อนให้เต็มที่นะค้าบ 🌙'
        ],
        water_near_target: [
            '🥤 สู้ๆ นะ! ดื่มน้ำไปแล้ว {currentGlasses}/{targetGlasses} แก้ว ({currentWaterMl} ml) ใกล้ถึงเป้าหมายแล้ว อีกแค่ {remainingGlasses} แก้วเท่านั้น! ✨',
            '💧 อีกนิดเดียวจริงๆ! เหลืออีกแค่ {remainingGlasses} แก้วก็จะครบโควตาน้ำวันนี้แล้ว จิบเพิ่มอีกแก้วแล้วฉลองกันเลย! 👏',
            '🧊 ใกล้พิชิตเป้าหมายน้ำดื่มแล้วนะ! ผิวพรรณชุ่มชื้น ไตและตับทำงานแฮปปี้สุดๆ ดื่มอีกนิดเดียวสู้ๆ ค้าบ 🌊',
            '🌊 เก่งมากๆ! ดื่มไปเกิน 75% ของวันแล้ว เติมน้ำอีกแก้วตอนนี้ ร่างกายสดชื่นตื่นตัวพร้อมลุยต่อแน่นอน 🧠',
            '🚰 ดื่มน้ำได้สม่ำเสมอดีมากเลย อีกเพียง {remainingGlasses} แก้วก็จะแตะเป้า 100% แล้ว คว้าชัยชนะกันครับ! 🏆'
        ],
        water_goal_completed: [
            '🎉 ยอดเยี่ยมไปเลย! ดื่มน้ำครบ {currentGlasses}/{targetGlasses} แก้ว ({currentWaterMl} ml) ตามเป้าของวันนี้แล้ว ร่างกายสดชื่น ผิวพรรณสดใส ขอบคุณมากนะ! 💙',
            '🏆 ชนะเลิศเรื่องดื่มน้ำวันนี้! ดื่มครบ {currentGlasses} แก้วแล้ว เซลล์ในร่างกายสดชื่น ระบบเผาผลาญทำงานเต็มสูบ! ✨',
            '💙 สุขภาพดีเริ่มต้นที่น้ำเปล่า! วันนี้คุณดื่มน้ำครบเป้าหมายแล้ว มีวินัยยอดเยี่ยมมาก ขอปรบมือให้ดังๆ เลยครับ 👏',
            '✨ ร่างกายของคุณวันนี้ต้องรักคุณมากแน่ๆ! ดื่มน้ำครบเป้า {targetGlasses} แก้วเรียบร้อย ผิวใส สมองไบรท์แน่นอน 🧠',
            '🌊 ภารกิจดื่มน้ำวันนี้สำเร็จ 100%! รักษาระดับความมีวินัยแบบนี้ไว้นะครับ สุดยอดไปเลย! 🌟'
        ],
        water_afternoon_warning: [
            '🥺 บ่ายสองแล้วน้า วันนี้ดื่มน้ำไปแค่ {currentGlasses} แก้วเอง อย่าลืมจิบน้ำเติมความสดชื่นและช่วยให้สมองปลอดโปร่งหน่อยนะค้าบ 💧',
            '💧 รู้สึกง่วงเพลียช่วงบ่ายรึเปล่า? บางทีร่างกายอาจจะแค่ขาดน้ำนะ แวะจิบน้ำเย็นๆ สักแก้ว แก้ง่วงได้ดีเลย! 🧊',
            '🧊 ช่วงบ่ายเซลล์ต้องการน้ำหล่อเลี้ยงนะค้าบ อย่าปล่อยให้คอแห้ง หยิบแก้วน้ำข้างตัวมาจิบสักนิดกันเถอะ 🥤',
            '⚠️ ระดับน้ำในร่างกายตอนนี้ยังต่ำอยู่น้า แวะเติมน้ำเปล่า 1 แก้ว ช่วยให้เลือดไหลเวียนดีและทำงานต่อได้ลื่นไหลขึ้นครับ 🧠',
            '🌊 พักสายตาจากหน้าจอ 1 นาที แล้วแวะไปเติมน้ำใส่แก้วกันครับ ร่างกายต้องการความชุ่มชื่นอยู่น้า 🚰'
        ],
        cal_near_target: [
            '🔥 อีกนิดเดียว! วันนี้ทานไป {currentCal} / {targetCal} kcal ใกล้ครบเป้าหมายพอดีเป๊ะ (เหลืออีก {calGap} kcal) รักษาสมดุลได้เก่งมากๆ! 👏',
            '🎯 จัดสรรแคลอรีได้ยอดเยี่ยมมาก! เหลือช่องว่างอีกเพียง {calGap} kcal จะแตะเป้าหมายพอดี มีวินัยสุดๆ เลยครับ ⭐',
            '⚖️ การคุมอาหารวันนี้ใกล้ถึงเส้นชัยแล้ว ทานไป {currentCal} kcal ใกล้เคียงเป้าหมายแบบมืออาชีพ นับถือในความตั้งใจเลย! 💖',
            '✨ แคลอรีวันนี้บาลานซ์ได้สวยงามมาก เหลือโควตาเบาๆ อีก {calGap} kcal จะหาของว่างเล็กๆ หรือปิดจ็อบแค่นี้ก็ยอดเยี่ยมครับ 🥑',
            '🚀 ใกล้แตะเป้าหมายพลังงานของวันนี้แล้ว ({currentCal}/{targetCal} kcal) วางแผนอาหารได้ดีมาก สุขภาพดีอยู่ไม่ไกลเกินเอื้อม! 🌟'
        ],
        cal_perfect_hit: [
            '🎯 สุดยอดมาก! วันนี้ควบคุมแคลอรีได้ {currentCal} / {targetCal} kcal ครบตามเป้าหมายของร่างกายพอดีเป๊ะ มีวินัยระดับมือโปรเลย! ⭐',
            '🏆 Perfect Hit! คุณคุมแคลอรีได้ตรงเป้า {targetCal} kcal พอดีเป๊ะ นี่คือตัวอย่างของความสม่ำเสมอที่แท้จริง! 👏',
            '🌟 วันนี้การจัดสรรพลังงานของคุณได้คะแนนเต็ม 100! แคลอรีลงล็อกเป๊ะ ร่างกายกำลังก้าวสู่เป้าหมายอย่างมั่นคงครับ 🚀',
            '💯 ปรบมือรัวๆ ให้เลย! วันนี้ควบคุมแคลอรีได้แม่นยำมาก ({currentCal} kcal) ไม่ขาดไม่เกิน ผลลัพธ์ที่ดีย่อมมาจากวินัยแบบนี้แหละ! 💪',
            '🎉 เป๊ะปังที่สุด! แคลอรีวันนี้แตะเป้าหมาย {targetCal} kcal ได้อย่างสวยงาม วันนี้คุณทำสำเร็จไปอีกหนึ่งก้าวแล้วครับ! 🌈'
        ],
        protein_strong_nudge: [
            '💪 โปรตีนวันนี้แน่นมาก! ได้ไปแล้ว {currentP}g / {targetP}g กล้ามเนื้อได้รับการซ่อมแซมและเติบโตอย่างเต็มที่แน่นอน! 🥩',
            '🥩 โปรตีนเกิน 85% ของเป้าแล้ว! ซ่อมแซมกล้ามเนื้อและช่วยให้อิ่มนาน คุมน้ำหนักได้ง่ายขึ้นเยอะเลย เก่งมากครับ! ⚡',
            '⚡ สายฟิตตัวจริง! วันนี้เติมโปรตีนไปแล้ว {currentP}g กล้ามเนื้อแน่น ระบบเผาผลาญทำงานฟิตปั๋งแน่นอน! 🏋️‍♂️',
            '🍗 เติมโปรตีนได้ถึงใจมากวันนี้ ({currentP}/{targetP}g) ร่างกายได้รับสารอาหารจำเป็นไปฟื้นฟูอย่างเต็มที่ ยอดเยี่ยมที่สุด! 🌟',
            '🍳 โปรตีนแน่นเปรี๊ยะ! การเลือกทานอาหารโปรตีนสูงช่วยคงมวลกล้ามเนื้อและเร่งการเผาผลาญได้ดีเยี่ยม ทำต่อไปนะค้าบ! 💥'
        ]
    };

    function getVariedCompanionMessage(categoryKey, vars = {}) {
        const pool = COMPANION_MESSAGE_TEMPLATES[categoryKey];
        if (!pool || pool.length === 0) return '';
        
        let history = {};
        try {
            const raw = sessionStorage.getItem('novafit_companion_msg_history');
            if (raw) history = JSON.parse(raw);
        } catch(e) {}
        
        const lastUsed = history[categoryKey] !== undefined ? history[categoryKey] : -1;
        let availableIndices = [];
        for (let i = 0; i < pool.length; i++) {
            if (i !== lastUsed) availableIndices.push(i);
        }
        if (availableIndices.length === 0) {
            availableIndices = [0];
        }
        
        const chosenIdx = availableIndices[Math.floor(Math.random() * availableIndices.length)];
        history[categoryKey] = chosenIdx;
        try {
            sessionStorage.setItem('novafit_companion_msg_history', JSON.stringify(history));
        } catch(e) {}
        
        let text = pool[chosenIdx];
        Object.keys(vars).forEach(k => {
            text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(vars[k]));
        });
        return text;
    }

    function showLivingCompanionNudge(config) {
        const bubble = document.getElementById('livingCompanionBubble');
        if (!bubble) return;

        _currentCompanionNudgeId = config.id;
        _currentCompanionConfig = config;
        const mascotIcon = document.getElementById('companionMascotIcon');
        const catEl = document.getElementById('companionNudgeCategory');
        const msgEl = document.getElementById('companionNudgeMessage');
        const actionArea = document.getElementById('companionActionArea');
        const avatarBg = document.getElementById('companionAvatarBg');

        if (mascotIcon) mascotIcon.textContent = config.icon || '🤖';
        if (catEl) catEl.textContent = config.category || 'เพื่อนคู่คิด Nova';
        if (msgEl) msgEl.textContent = config.message || '';
        if (avatarBg && config.avatarGradient) {
            avatarBg.className = `w-8 h-8 rounded-full ${config.avatarGradient} flex items-center justify-center text-lg shadow-xs select-none`;
        }

        if (actionArea) {
            actionArea.innerHTML = '';
            if (config.actionText && typeof config.actionFn === 'function') {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shadow-xs transition active:scale-95 cursor-pointer';
                btn.textContent = config.actionText;
                btn.onclick = () => {
                    config.actionFn();
                    dismissLivingCompanionNudge();
                };
                actionArea.appendChild(btn);
            }

            // Quick Reshuffle Button: "🎲 สุ่มข้อความอื่น"
            const reshuffleBtn = document.createElement('button');
            reshuffleBtn.type = 'button';
            reshuffleBtn.className = 'px-2.5 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-700 dark:text-purple-300 font-bold text-[11px] transition active:scale-95 cursor-pointer flex items-center gap-1 border border-purple-500/20';
            reshuffleBtn.innerHTML = '<span>🎲</span> <span>สุ่มข้อความอื่น</span>';
            reshuffleBtn.title = 'สุ่มดูข้อความรูปแบบอื่นในหมวดนี้';
            reshuffleBtn.onclick = () => {
                reshuffleCurrentCompanionNudge();
            };
            actionArea.appendChild(reshuffleBtn);

            const thanksBtn = document.createElement('button');
            thanksBtn.type = 'button';
            thanksBtn.className = 'px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 font-medium text-[11px] transition cursor-pointer';
            thanksBtn.textContent = 'ขอบคุณนะ ❤️';
            thanksBtn.onclick = () => dismissLivingCompanionNudge();
            actionArea.appendChild(thanksBtn);
        }

        // Record that this nudge ID was shown today
        const today = getTodayStrSafe();
        try {
            const shownKey = `novafit_shown_nudges_${today}`;
            const raw = sessionStorage.getItem(shownKey) || '[]';
            const list = JSON.parse(raw);
            if (!list.includes(config.id)) {
                list.push(config.id);
                sessionStorage.setItem(shownKey, JSON.stringify(list));
            }
            sessionStorage.setItem('novafit_last_nudge_timestamp', String(Date.now()));
        } catch(e) {}

        // Animate Show
        bubble.classList.remove('hidden');
        requestAnimationFrame(() => {
            bubble.classList.remove('translate-y-6', 'opacity-0');
            bubble.classList.add('translate-y-0', 'opacity-100');
        });

        clearTimeout(_companionDismissTimer);
        const duration = config.duration || 9500;
        _companionDismissTimer = setTimeout(() => {
            dismissLivingCompanionNudge();
        }, duration);
    }

    function reshuffleCurrentCompanionNudge() {
        if (!_currentCompanionConfig) return;
        const msgEl = document.getElementById('companionNudgeMessage');
        if (!msgEl) return;

        msgEl.classList.add('opacity-0', 'scale-95');
        setTimeout(() => {
            let newMsg = '';
            if (_currentCompanionConfig.categoryKey) {
                newMsg = getVariedCompanionMessage(_currentCompanionConfig.categoryKey, _currentCompanionConfig.vars || {});
            } else {
                const q = CHEERFUL_DAILY_QUOTES[Math.floor(Math.random() * CHEERFUL_DAILY_QUOTES.length)];
                newMsg = q.msg;
            }
            msgEl.textContent = newMsg;
            msgEl.classList.remove('opacity-0', 'scale-95');

            clearTimeout(_companionDismissTimer);
            _companionDismissTimer = setTimeout(() => {
                dismissLivingCompanionNudge();
            }, 11000);
        }, 140);
    }

    function triggerCelebrationConfetti(duration = 2800) {
        const canvas = document.getElementById('celebrationConfettiCanvas');
        if (!canvas) return;

        try {
            if (navigator.vibrate) navigator.vibrate([40, 60, 90]);
        } catch(e) {}
        playSoundSafe('celebrate');

        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        canvas.classList.remove('hidden');

        const colors = ['#10b981', '#06b6d4', '#f59e0b', '#ec4899', '#8b5cf6', '#3b82f6', '#f43f5e', '#fbbf24'];
        const particleCount = Math.min(85, Math.floor(window.innerWidth / 10));
        const particles = [];

        for (let i = 0; i < particleCount; i++) {
            particles.push({
                x: window.innerWidth * 0.5 + (Math.random() - 0.5) * window.innerWidth * 0.75,
                y: window.innerHeight * 0.35 + (Math.random() - 0.5) * 80,
                w: Math.random() * 8 + 5,
                h: Math.random() * 6 + 4,
                vx: (Math.random() - 0.5) * 15,
                vy: Math.random() * -12 - 5,
                gravity: 0.35 + Math.random() * 0.15,
                drag: 0.985,
                color: colors[Math.floor(Math.random() * colors.length)],
                rotation: Math.random() * 360,
                rotationSpeed: (Math.random() - 0.5) * 14,
                opacity: 1,
                shape: Math.random() > 0.35 ? 'rect' : 'circle'
            });
        }

        const startTime = Date.now();
        cancelAnimationFrame(_confettiAnimationId);

        function frame() {
            const elapsed = Date.now() - startTime;
            if (elapsed > duration) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                canvas.classList.add('hidden');
                return;
            }

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            particles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                p.vy += p.gravity;
                p.vx *= p.drag;
                p.rotation += p.rotationSpeed;
                if (elapsed > duration - 800) {
                    p.opacity = Math.max(0, 1 - (elapsed - (duration - 800)) / 800);
                }

                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate((p.rotation * Math.PI) / 180);
                ctx.globalAlpha = p.opacity;
                ctx.fillStyle = p.color;

                if (p.shape === 'rect') {
                    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
                } else {
                    ctx.beginPath();
                    ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.restore();
            });

            _confettiAnimationId = requestAnimationFrame(frame);
        }

        _confettiAnimationId = requestAnimationFrame(frame);
    }

    function showMilestoneBeatCard(config) {
        const banner = document.getElementById('milestoneCelebrationBanner');
        if (!banner) return;

        const iconEl = document.getElementById('milestoneIcon');
        const titleEl = document.getElementById('milestoneTitle');
        const subEl = document.getElementById('milestoneSubtitle');
        const detailEl = document.getElementById('milestoneDetail');

        if (iconEl) iconEl.textContent = config.icon || '🎉';
        if (titleEl) titleEl.textContent = config.title || 'ยินดีด้วย! พิชิตเป้าหมายสำเร็จ';
        if (subEl) subEl.textContent = config.subtitle || '';
        if (detailEl) detailEl.textContent = config.detail || '';

        banner.classList.remove('hidden');
        requestAnimationFrame(() => {
            banner.classList.remove('-translate-y-12', 'opacity-0');
            banner.classList.add('translate-y-0', 'opacity-100');
        });

        clearTimeout(_milestoneDismissTimer);
        _milestoneDismissTimer = setTimeout(() => {
            dismissMilestoneCelebration();
        }, config.duration || 8500);
    }

    function dismissMilestoneCelebration() {
        clearTimeout(_milestoneDismissTimer);
        const banner = document.getElementById('milestoneCelebrationBanner');
        if (!banner) return;
        banner.classList.remove('translate-y-0', 'opacity-100');
        banner.classList.add('-translate-y-12', 'opacity-0');
        setTimeout(() => {
            banner.classList.add('hidden');
        }, 400);
    }

    function checkMilestoneCelebrations() {
        const appState = getAppStateSafe();
        if (!appState) return;
        const today = getTodayStrSafe();
        if (appState.selectedDate !== today) return;

        const targets = getTargetsSafe();
        const todayLogs = (appState.logsByDate && appState.logsByDate[today]) || [];
        const currentCal = Math.round(todayLogs.reduce((s, x) => s + (Number(x.cal) || 0), 0));
        const currentP = Math.round(todayLogs.reduce((s, x) => s + (Number(x.p) || 0), 0) * 10) / 10;
        const targetCal = Math.round(targets.totalCal);
        const targetP = Math.round(targets.pGram);

        const currentGlasses = (appState.waterByDate && appState.waterByDate[today]) || 0;
        const targetGlasses = targets.waterTargetGlasses || 8;

        const sessionKey = `novafit_celebrated_milestones_${today}`;
        let celebrated = [];
        try {
            celebrated = JSON.parse(sessionStorage.getItem(sessionKey) || '[]');
        } catch(e) {}

        // 1. Water milestone: 100%+
        if (targetGlasses > 0 && currentGlasses >= targetGlasses && !celebrated.includes('water')) {
            celebrated.push('water');
            try { sessionStorage.setItem(sessionKey, JSON.stringify(celebrated)); } catch(e) {}
            triggerCelebrationConfetti();
            showMilestoneBeatCard({
                icon: '🎉',
                title: 'พิชิตเป้าหมายดื่มน้ำครบ 100%!',
                subtitle: `ดื่มครบ ${currentGlasses}/${targetGlasses} แก้ว (${currentGlasses * 250} ml) เรียบร้อย`,
                detail: 'เซลล์ในร่างกายสดชื่น ผิวพรรณเปล่งปลั่ง ระบบเผาผลาญทำงานเต็มประสิทธิภาพ! 💧',
                duration: 8500
            });
            return;
        }

        // 2. Protein milestone: 100%+
        if (targetP > 0 && currentP >= targetP && todayLogs.length > 0 && !celebrated.includes('protein')) {
            celebrated.push('protein');
            try { sessionStorage.setItem(sessionKey, JSON.stringify(celebrated)); } catch(e) {}
            triggerCelebrationConfetti();
            showMilestoneBeatCard({
                icon: '💪',
                title: 'โปรตีนแตะเป้า 100% สำเร็จ!',
                subtitle: `เติมโปรตีนได้ ${currentP}g / ${targetP}g ครบตามเป้าหมายของร่างกาย`,
                detail: 'กล้ามเนื้อได้รับการซ่อมแซมอย่างเต็มที่ อิ่มนาน และช่วยเร่งระบบเผาผลาญ! 🥩',
                duration: 8500
            });
            return;
        }

        // 3. Calorie Perfect Hit: 98% - 105%
        const calRatio = targetCal > 0 ? (currentCal / targetCal) : 0;
        if (calRatio >= 0.98 && calRatio <= 1.05 && todayLogs.length > 0 && !celebrated.includes('calorie')) {
            celebrated.push('calorie');
            try { sessionStorage.setItem(sessionKey, JSON.stringify(celebrated)); } catch(e) {}
            triggerCelebrationConfetti();
            showMilestoneBeatCard({
                icon: '🎯',
                title: 'Perfect Calorie Day!',
                subtitle: `จัดสรรพลังงานได้ ${currentCal} / ${targetCal} kcal ตรงเป้าหมายเป๊ะ`,
                detail: 'การควบคุมพลังงานที่แม่นยำจะสร้างผลลัพธ์การเปลี่ยนแปลงที่ยอดเยี่ยม! ⭐',
                duration: 8500
            });
            return;
        }
    }

    function dismissLivingCompanionNudge() {
        clearTimeout(_companionDismissTimer);
        const bubble = document.getElementById('livingCompanionBubble');
        if (!bubble) return;
        bubble.classList.remove('translate-y-0', 'opacity-100');
        bubble.classList.add('translate-y-6', 'opacity-0');
        setTimeout(() => {
            bubble.classList.add('hidden');
        }, 320);
    }

    function triggerLivingCompanionCheck(delay = 1800, force = false) {
        clearTimeout(_companionCheckDebounce);
        _companionCheckDebounce = setTimeout(() => {
            checkLivingAppNudges(force);
        }, delay);
    }

    function checkLivingAppNudges(force = false) {
        const appState = getAppStateSafe();
        if (!appState) return;
        const today = getTodayStrSafe();
        if (appState.selectedDate !== today && !force) return;

        const now = Date.now();
        try {
            const lastTime = parseInt(sessionStorage.getItem('novafit_last_nudge_timestamp') || '0', 10);
            if (!force && (now - lastTime) < 5 * 60 * 1000) return;
        } catch(e) {}

        let shownList = [];
        try {
            const raw = sessionStorage.getItem(`novafit_shown_nudges_${today}`) || '[]';
            shownList = JSON.parse(raw);
        } catch(e) {}

        const hour = new Date().getHours();
        const minute = new Date().getMinutes();
        const timeDecimal = hour + minute / 60;

        const todayLogs = (appState.logsByDate && appState.logsByDate[today]) || [];
        const targets = getTargetsSafe();
        const currentCal = Math.round(todayLogs.reduce((s, x) => s + (Number(x.cal) || 0), 0));
        const currentP = Math.round(todayLogs.reduce((s, x) => s + (Number(x.p) || 0), 0) * 10) / 10;
        const targetCal = Math.round(targets.totalCal);
        const targetP = Math.round(targets.pGram);

        const currentGlasses = (appState.waterByDate && appState.waterByDate[today]) || 0;
        const targetGlasses = targets.waterTargetGlasses || 8;
        const currentWaterMl = currentGlasses * 250;
        const targetWaterMl = targets.waterTargetMl || (targetGlasses * 250);

        const hasBreakfast = todayLogs.some(x => x.meal === 'breakfast');
        const hasLunch = todayLogs.some(x => x.meal === 'lunch');
        const hasDinner = todayLogs.some(x => x.meal === 'dinner');

        // ── TRIGGER 1: Missing Breakfast (10:30 - 12:45) ──
        if (timeDecimal >= 10.5 && timeDecimal < 12.8 && !hasBreakfast && !shownList.includes('missing_breakfast')) {
            const msg = getVariedCompanionMessage('missing_breakfast');
            showLivingCompanionNudge({
                id: 'missing_breakfast',
                categoryKey: 'missing_breakfast',
                icon: '🥺',
                category: 'ห่วงใยสุขภาพยามเช้า',
                avatarGradient: 'bg-gradient-to-tr from-amber-500 to-rose-400',
                message: msg,
                actionText: '🍳 บันทึกมื้อเช้า',
                actionFn: () => {
                    appState.activeMeal = 'breakfast';
                    renderMealSelectorSafe();
                    const foodSection = document.getElementById('foodSearchCard');
                    if (foodSection) foodSection.scrollIntoView({ behavior: 'smooth' });
                }
            });
            return;
        }

        // ── TRIGGER 2: Missing Lunch (13:30 - 15:45) ──
        if (timeDecimal >= 13.5 && timeDecimal < 15.8 && !hasLunch && !shownList.includes('missing_lunch')) {
            const msg = getVariedCompanionMessage('missing_lunch');
            showLivingCompanionNudge({
                id: 'missing_lunch',
                categoryKey: 'missing_lunch',
                icon: '🍱',
                category: 'พักเติมพลังยามบ่าย',
                avatarGradient: 'bg-gradient-to-tr from-orange-500 to-amber-400',
                message: msg,
                actionText: '🥗 บันทึกมื้อเที่ยง',
                actionFn: () => {
                    appState.activeMeal = 'lunch';
                    renderMealSelectorSafe();
                    const foodSection = document.getElementById('foodSearchCard');
                    if (foodSection) foodSection.scrollIntoView({ behavior: 'smooth' });
                }
            });
            return;
        }

        // ── TRIGGER 3: Missing Dinner (19:30 - 21:45) ──
        if (timeDecimal >= 19.5 && timeDecimal < 21.8 && !hasDinner && !shownList.includes('missing_dinner')) {
            const msg = getVariedCompanionMessage('missing_dinner');
            showLivingCompanionNudge({
                id: 'missing_dinner',
                categoryKey: 'missing_dinner',
                icon: '🌙',
                category: 'มื้อค่ำเพื่อสุขภาพ',
                avatarGradient: 'bg-gradient-to-tr from-indigo-500 to-purple-400',
                message: msg,
                actionText: '🍲 บันทึกมื้อเย็น',
                actionFn: () => {
                    appState.activeMeal = 'dinner';
                    renderMealSelectorSafe();
                    const foodSection = document.getElementById('foodSearchCard');
                    if (foodSection) foodSection.scrollIntoView({ behavior: 'smooth' });
                }
            });
            return;
        }

        // ── TRIGGER 4: Water Near Target (75% - 99%) ──
        const waterRatio = targetGlasses > 0 ? (currentGlasses / targetGlasses) : 0;
        if (waterRatio >= 0.75 && waterRatio < 1.0 && !shownList.includes('water_near_target')) {
            const remainingGlasses = targetGlasses - currentGlasses;
            const msg = getVariedCompanionMessage('water_near_target', {
                currentGlasses,
                targetGlasses,
                currentWaterMl: currentWaterMl.toLocaleString(),
                remainingGlasses
            });
            showLivingCompanionNudge({
                id: 'water_near_target',
                categoryKey: 'water_near_target',
                vars: { currentGlasses, targetGlasses, currentWaterMl: currentWaterMl.toLocaleString(), remainingGlasses },
                icon: '🥤',
                category: 'ดื่มน้ำเพื่อสุขภาพ',
                avatarGradient: 'bg-gradient-to-tr from-cyan-500 to-blue-400',
                message: msg,
                actionText: '+ ดื่มน้ำ 1 แก้ว',
                actionFn: () => {
                    adjustWaterSafe(1);
                }
            });
            return;
        }

        // ── TRIGGER 5: Water Goal Completed (100%+) ──
        if (waterRatio >= 1.0 && !shownList.includes('water_goal_completed')) {
            const msg = getVariedCompanionMessage('water_goal_completed', {
                currentGlasses,
                targetGlasses,
                currentWaterMl: currentWaterMl.toLocaleString()
            });
            showLivingCompanionNudge({
                id: 'water_goal_completed',
                categoryKey: 'water_goal_completed',
                vars: { currentGlasses, targetGlasses, currentWaterMl: currentWaterMl.toLocaleString() },
                icon: '🎉',
                category: 'พิชิตเป้าหมายดื่มน้ำ',
                avatarGradient: 'bg-gradient-to-tr from-emerald-500 to-cyan-400',
                message: msg
            });
            return;
        }

        // ── TRIGGER 6: Afternoon Dehydration Warning (14:00+ and water < 35%) ──
        if (timeDecimal >= 14.0 && waterRatio < 0.35 && !shownList.includes('water_afternoon_warning')) {
            const msg = getVariedCompanionMessage('water_afternoon_warning', { currentGlasses });
            showLivingCompanionNudge({
                id: 'water_afternoon_warning',
                categoryKey: 'water_afternoon_warning',
                vars: { currentGlasses },
                icon: '💧',
                category: 'เตือนจิบน้ำเพื่อความสดชื่น',
                avatarGradient: 'bg-gradient-to-tr from-blue-500 to-indigo-400',
                message: msg,
                actionText: '+ จิบน้ำ 1 แก้ว',
                actionFn: () => {
                    adjustWaterSafe(1);
                }
            });
            return;
        }

        // ── TRIGGER 7: Calories Near Target (85% - 99%) ──
        const calRatio = targetCal > 0 ? (currentCal / targetCal) : 0;
        if (calRatio >= 0.85 && calRatio < 1.0 && !shownList.includes('cal_near_target')) {
            const calGap = targetCal - currentCal;
            const msg = getVariedCompanionMessage('cal_near_target', {
                currentCal,
                targetCal,
                calGap
            });
            showLivingCompanionNudge({
                id: 'cal_near_target',
                categoryKey: 'cal_near_target',
                vars: { currentCal, targetCal, calGap },
                icon: '🔥',
                category: 'ใกล้ถึงเป้าหมายแคลอรี',
                avatarGradient: 'bg-gradient-to-tr from-amber-500 to-emerald-400',
                message: msg
            });
            return;
        }

        // ── TRIGGER 8: Calories Perfect Hit (100% - 105%) ──
        if (calRatio >= 1.0 && calRatio <= 1.05 && !shownList.includes('cal_perfect_hit')) {
            const msg = getVariedCompanionMessage('cal_perfect_hit', {
                currentCal,
                targetCal
            });
            showLivingCompanionNudge({
                id: 'cal_perfect_hit',
                categoryKey: 'cal_perfect_hit',
                vars: { currentCal, targetCal },
                icon: '🎯',
                category: 'Perfect Calorie Day!',
                avatarGradient: 'bg-gradient-to-tr from-emerald-500 to-teal-400',
                message: msg
            });
            return;
        }

        // ── TRIGGER 9: Protein Target Strong (≥ 85% of target) ──
        const pRatio = targetP > 0 ? (currentP / targetP) : 0;
        if (pRatio >= 0.85 && !shownList.includes('protein_strong_nudge')) {
            const msg = getVariedCompanionMessage('protein_strong_nudge', {
                currentP,
                targetP
            });
            showLivingCompanionNudge({
                id: 'protein_strong_nudge',
                categoryKey: 'protein_strong_nudge',
                vars: { currentP, targetP },
                icon: '💪',
                category: 'โปรตีนแน่นเสริมสร้างกล้ามเนื้อ',
                avatarGradient: 'bg-gradient-to-tr from-purple-500 to-indigo-400',
                message: msg
            });
            return;
        }

        // ── TRIGGER 10: Random Cheerful Quote (Once per day on opening) ──
        if (!shownList.includes('daily_cheerful_quote')) {
            const q = CHEERFUL_DAILY_QUOTES[Math.floor(Math.random() * CHEERFUL_DAILY_QUOTES.length)];
            showLivingCompanionNudge({
                id: 'daily_cheerful_quote',
                icon: q.icon,
                category: 'กำลังใจประจำวัน',
                avatarGradient: 'bg-gradient-to-tr from-pink-500 via-purple-500 to-indigo-400',
                message: q.msg
            });
        }
    }

    // Sandbox Test Launcher for Nova Companion
    function openCompanionTestModal() {
        const modal = document.getElementById('companionTestModal');
        if (modal) modal.classList.remove('hidden');
    }

    function closeCompanionTestModal() {
        const modal = document.getElementById('companionTestModal');
        if (modal) modal.classList.add('hidden');
    }

    function triggerTestCompanionNudge(type) {
        const appState = getAppStateSafe();
        const targets = getTargetsSafe();
        const tCal = Math.round(targets.totalCal);
        const tP = Math.round(targets.pGram);
        const tGlasses = targets.waterTargetGlasses || 8;

        switch (type) {
            case 'water_near':
                const wnMsg = getVariedCompanionMessage('water_near_target', {
                    currentGlasses: Math.max(1, tGlasses - 1),
                    targetGlasses: tGlasses,
                    currentWaterMl: (Math.max(1, tGlasses - 1) * 250).toLocaleString(),
                    remainingGlasses: 1
                });
                showLivingCompanionNudge({
                    id: 'test_water_near',
                    icon: '🥤',
                    category: 'ดื่มน้ำเพื่อสุขภาพ',
                    avatarGradient: 'bg-gradient-to-tr from-cyan-500 to-blue-400',
                    message: wnMsg,
                    actionText: '+ ดื่มน้ำ 1 แก้ว',
                    actionFn: () => adjustWaterSafe(1)
                });
                break;
            case 'water_full':
                const wfMsg = getVariedCompanionMessage('water_goal_completed', {
                    currentGlasses: tGlasses,
                    targetGlasses: tGlasses,
                    currentWaterMl: (tGlasses * 250).toLocaleString()
                });
                showLivingCompanionNudge({
                    id: 'test_water_full',
                    icon: '🎉',
                    category: 'พิชิตเป้าหมายดื่มน้ำ',
                    avatarGradient: 'bg-gradient-to-tr from-emerald-500 to-cyan-400',
                    message: wfMsg
                });
                break;
            case 'water_afternoon':
                const waMsg = getVariedCompanionMessage('water_afternoon_warning', {
                    currentGlasses: 2
                });
                showLivingCompanionNudge({
                    id: 'test_water_afternoon',
                    icon: '💧',
                    category: 'เตือนจิบน้ำเพื่อความสดชื่น',
                    avatarGradient: 'bg-gradient-to-tr from-blue-500 to-indigo-400',
                    message: waMsg,
                    actionText: '+ จิบน้ำ 1 แก้ว',
                    actionFn: () => adjustWaterSafe(1)
                });
                break;
            case 'missing_bf':
                const mbfMsg = getVariedCompanionMessage('missing_breakfast');
                showLivingCompanionNudge({
                    id: 'test_missing_bf',
                    icon: '🥺',
                    category: 'ห่วงใยสุขภาพยามเช้า',
                    avatarGradient: 'bg-gradient-to-tr from-amber-500 to-rose-400',
                    message: mbfMsg,
                    actionText: '🍳 บันทึกมื้อเช้า',
                    actionFn: () => {
                        if (appState) appState.activeMeal = 'breakfast';
                        renderMealSelectorSafe();
                    }
                });
                break;
            case 'missing_lunch':
                const mlMsg = getVariedCompanionMessage('missing_lunch');
                showLivingCompanionNudge({
                    id: 'test_missing_lunch',
                    icon: '🍱',
                    category: 'พักเติมพลังยามบ่าย',
                    avatarGradient: 'bg-gradient-to-tr from-orange-500 to-amber-400',
                    message: mlMsg,
                    actionText: '🥗 บันทึกมื้อเที่ยง',
                    actionFn: () => {
                        if (appState) appState.activeMeal = 'lunch';
                        renderMealSelectorSafe();
                    }
                });
                break;
            case 'missing_dinner':
                const mdMsg = getVariedCompanionMessage('missing_dinner');
                showLivingCompanionNudge({
                    id: 'test_missing_dinner',
                    icon: '🌙',
                    category: 'มื้อค่ำเพื่อสุขภาพ',
                    avatarGradient: 'bg-gradient-to-tr from-indigo-500 to-purple-400',
                    message: mdMsg,
                    actionText: '🍲 บันทึกมื้อเย็น',
                    actionFn: () => {
                        if (appState) appState.activeMeal = 'dinner';
                        renderMealSelectorSafe();
                    }
                });
                break;
            case 'cal_near':
                const curC = Math.round(tCal * 0.92);
                const cnMsg = getVariedCompanionMessage('cal_near_target', {
                    currentCal: curC,
                    targetCal: tCal,
                    calGap: tCal - curC
                });
                showLivingCompanionNudge({
                    id: 'test_cal_near',
                    icon: '🔥',
                    category: 'ใกล้ถึงเป้าหมายแคลอรี',
                    avatarGradient: 'bg-gradient-to-tr from-amber-500 to-emerald-400',
                    message: cnMsg
                });
                break;
            case 'cal_perfect':
                const cpMsg = getVariedCompanionMessage('cal_perfect_hit', {
                    currentCal: tCal,
                    targetCal: tCal
                });
                showLivingCompanionNudge({
                    id: 'test_cal_perfect',
                    icon: '🎯',
                    category: 'Perfect Calorie Day!',
                    avatarGradient: 'bg-gradient-to-tr from-emerald-500 to-teal-400',
                    message: cpMsg
                });
                break;
            case 'protein':
                const curP = Math.round(tP * 0.9);
                const pMsg = getVariedCompanionMessage('protein_strong_nudge', {
                    currentP: curP,
                    targetP: tP
                });
                showLivingCompanionNudge({
                    id: 'test_protein',
                    icon: '💪',
                    category: 'โปรตีนแน่นเสริมสร้างกล้ามเนื้อ',
                    avatarGradient: 'bg-gradient-to-tr from-purple-500 to-indigo-400',
                    message: pMsg
                });
                break;
            case 'cheerful':
            default:
                const q = CHEERFUL_DAILY_QUOTES[Math.floor(Math.random() * CHEERFUL_DAILY_QUOTES.length)];
                showLivingCompanionNudge({
                    id: 'test_cheerful_' + Date.now(),
                    icon: q.icon,
                    category: 'กำลังใจประจำวัน',
                    avatarGradient: 'bg-gradient-to-tr from-pink-500 via-purple-500 to-indigo-400',
                    message: q.msg
                });
                break;
        }
    }

    // Window Global Exports
    window.CHEERFUL_DAILY_QUOTES = CHEERFUL_DAILY_QUOTES;
    window.COMPANION_MESSAGE_TEMPLATES = COMPANION_MESSAGE_TEMPLATES;
    window.getVariedCompanionMessage = getVariedCompanionMessage;
    window.showLivingCompanionNudge = showLivingCompanionNudge;
    window.dismissLivingCompanionNudge = dismissLivingCompanionNudge;
    window.reshuffleCurrentCompanionNudge = reshuffleCurrentCompanionNudge;
    window.triggerCelebrationConfetti = triggerCelebrationConfetti;
    window.showMilestoneBeatCard = showMilestoneBeatCard;
    window.dismissMilestoneCelebration = dismissMilestoneCelebration;
    window.checkMilestoneCelebrations = checkMilestoneCelebrations;
    window.triggerLivingCompanionCheck = triggerLivingCompanionCheck;
    window.checkLivingAppNudges = checkLivingAppNudges;
    window.openCompanionTestModal = openCompanionTestModal;
    window.closeCompanionTestModal = closeCompanionTestModal;
    window.triggerTestCompanionNudge = triggerTestCompanionNudge;
})();
