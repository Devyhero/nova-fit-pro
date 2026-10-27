/**
 * NovaFit Pro - Prestige Avatar Frames, Anti-Cheat Streak Engine & App Tour Guide (v5.9.30)
 * Manages verified streak calculations, streak freeze shield recovery,
 * prestige avatar frames (Novice -> Bronze -> Silver -> Gold -> Diamond),
 * interactive onboarding tour guide, and custom avatar/profile customizer.
 */

(function () {
    // Safe inter-module access helpers
    function getTodayStrSafe() {
        if (typeof getTodayStr === 'function') return getTodayStr();
        if (typeof window.getTodayStr === 'function') return window.getTodayStr();
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        return new Date(now.getTime() - offset).toISOString().split('T')[0];
    }

    function saveStateSafe() {
        if (typeof saveState === 'function') return saveState();
        if (typeof window.saveState === 'function') return window.saveState();
    }

    function showToastSafe(msg) {
        if (typeof showToast === 'function') return showToast(msg);
        if (typeof window.showToast === 'function') return window.showToast(msg);
    }

    function playSoundSafe(sound) {
        if (typeof playSound === 'function') return playSound(sound);
        if (typeof window.playSound === 'function') return window.playSound(sound);
    }

    function openModalAnimatedSafe(id) {
        if (typeof openModalAnimated === 'function') return openModalAnimated(id);
        if (typeof window.openModalAnimated === 'function') return window.openModalAnimated(id);
        const el = document.getElementById(id);
        if (el) el.classList.remove('hidden');
    }

    function closeModalAnimatedSafe(id) {
        if (typeof closeModalAnimated === 'function') return closeModalAnimated(id);
        if (typeof window.closeModalAnimated === 'function') return window.closeModalAnimated(id);
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    }

    // ==========================================
    // 🏆 PRESTIGE AVATAR FRAMES & ANTI-CHEAT ENGINE
    // ==========================================
    const PRESTIGE_TIERS = {
        novice: {
            id: 'novice',
            name: 'Novice',
            title: '⚪ Novice (ระดับเริ่มต้น)',
            minDays: 0,
            badgeEmoji: '⚪',
            desc: 'ขอบเงินเมทัลลิกเรียบหรู มินิมอล สบายตา ได้ทันทีทุกคนเมื่อเริ่มต้นใช้งาน',
            frameImg: 'frames/frame-novice.png',
            effectClass: 'effect-novice',
            frameClass: 'avatar-frame-novice',
            colorBadge: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
        },
        bronze: {
            id: 'bronze',
            name: 'Bronze Sprout',
            title: '🟢 Bronze Sprout (ต้นกล้ามีวินัย • 3 วัน)',
            minDays: 3,
            badgeEmoji: '🌱',
            desc: 'กรอบนีออนสีเขียวมรกตเรืองแสง พร้อมประกายใบไม้ธรรมชาติ สื่อถึงจุดเริ่มต้นของการมีวินัยสุขภาพ',
            frameImg: 'frames/frame-bronze.png',
            effectClass: 'effect-bronze',
            frameClass: 'avatar-frame-bronze',
            colorBadge: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
        },
        silver: {
            id: 'silver',
            name: 'Silver Striker',
            title: '🔵 Silver Striker (นักสู้สายฟ้า • 7 วัน)',
            minDays: 7,
            badgeEmoji: '⚡',
            desc: 'วงแหวนสีฟ้าไซยานอลตัดน้ำเงินคราม เปล่งประกายแสงความเร็วและดาววิบวับ สื่อถึงพลังงานและความคล่องตัว',
            frameImg: 'frames/frame-silver.png',
            effectClass: 'effect-silver',
            frameClass: 'avatar-frame-silver',
            colorBadge: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400'
        },
        gold: {
            id: 'gold',
            name: 'Gold Champion',
            title: '🟡 Gold Champion (แชมเปียนไฟลุก • 30 วัน)',
            minDays: 30,
            badgeEmoji: '👑',
            desc: 'เปลวไฟสีทองคำประกายส้มแอมเบอร์ลุกโชนอย่างสง่างาม 360° พร้อมมงกุฎแชมเปียน สื่อถึงการสร้างนิสัยและวินัยเหล็ก',
            frameImg: 'frames/frame-gold.png',
            effectClass: 'effect-gold',
            frameClass: 'avatar-frame-gold',
            colorBadge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
        },
        diamond: {
            id: 'diamond',
            name: 'Diamond Nova',
            title: '🟣 Diamond Nova (เพชรนีออนโฮโลแกรม • VIP / 100 วัน)',
            minDays: 100,
            badgeEmoji: '💎',
            desc: 'กรอบเพชรคอสมิกสีรุ้งเหลือบแสง (Holographic Iridescent) ประดับดาวประกายเพชร สื่อถึงระดับตำนานและผู้สนับสนุน VIP',
            frameImg: 'frames/frame-diamond.png',
            effectClass: 'effect-diamond',
            frameClass: 'avatar-frame-diamond',
            colorBadge: 'bg-purple-500/15 text-purple-600 dark:text-purple-400'
        }
    };

    // ==========================================
    // 🧊 STREAK FREEZE SHIELD & RECOVERY ENGINE (v5.9.30)
    // ==========================================
    function ensureStreakFreezeIntegrity(logsByDate, todayStr) {
        const appState = typeof state !== 'undefined' ? state : window.state;
        if (!appState) return;
        const curMonth = (todayStr || getTodayStrSafe()).slice(0, 7);
        if (!appState.streakFreeze || typeof appState.streakFreeze !== 'object') {
            appState.streakFreeze = { month: curMonth, shieldsRemaining: 2, maxShields: 2, frozenDates: [] };
        }
        if (!Array.isArray(appState.streakFreeze.frozenDates)) {
            appState.streakFreeze.frozenDates = [];
        }
        if (appState.streakFreeze.month !== curMonth) {
            appState.streakFreeze.month = curMonth;
            appState.streakFreeze.shieldsRemaining = 2;
            appState.streakFreeze.maxShields = 2;
        }

        const hasMeals = (d) => logsByDate && Array.isArray(logsByDate[d]) && logsByDate[d].filter(m => m && m.name && String(m.name).trim() !== '').length >= 1;

        // 1. Refund shield if user logged a make-up meal on a previously frozen date!
        const remainingFrozen = [];
        appState.streakFreeze.frozenDates.forEach(d => {
            if (hasMeals(d)) {
                appState.streakFreeze.shieldsRemaining = Math.min(appState.streakFreeze.maxShields || 2, (Number(appState.streakFreeze.shieldsRemaining) || 0) + 1);
            } else {
                remainingFrozen.push(d);
            }
        });
        appState.streakFreeze.frozenDates = remainingFrozen;

        // 2. Auto-apply Streak Freeze Shield if user missed yesterday but had an active streak on the day before yesterday
        const toLocalDateStr = (d) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };
        const today = new Date((todayStr || getTodayStrSafe()) + 'T00:00:00');
        const yest = new Date(today);
        yest.setDate(yest.getDate() - 1);
        const yestStr = toLocalDateStr(yest);

        const dayBeforeYest = new Date(today);
        dayBeforeYest.setDate(dayBeforeYest.getDate() - 2);
        const dayBeforeYestStr = toLocalDateStr(dayBeforeYest);

        if (!hasMeals(yestStr) &&
            !appState.streakFreeze.frozenDates.includes(yestStr) &&
            hasMeals(dayBeforeYestStr) &&
            Number(appState.streakFreeze.shieldsRemaining) > 0) {
            appState.streakFreeze.shieldsRemaining = Math.max(0, Number(appState.streakFreeze.shieldsRemaining) - 1);
            appState.streakFreeze.frozenDates.push(yestStr);
        }
    }

    function jumpToYesterdayAndLog() {
        const appState = typeof state !== 'undefined' ? state : window.state;
        const today = new Date(getTodayStrSafe() + 'T00:00:00');
        today.setDate(today.getDate() - 1);
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const yestStr = `${year}-${month}-${day}`;

        if (appState) appState.selectedDate = yestStr;
        closePrestigeWardrobeModal();
        if (typeof renderAll === 'function') renderAll();
        else if (window.renderAll) window.renderAll();
        const searchCard = document.getElementById('card_food_search') || document.getElementById('foodSearchInput');
        if (searchCard) searchCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        showToastSafe(`📝 สลับไปเมื่อวาน (${yestStr}) แล้ว! บันทึกอาหาร 1 เมนูเพื่อกู้สตรีคและรับโล่น้ำแข็งคืนได้เลย`);
    }

    function calculateVerifiedStreak(logsByDate, todayStr) {
        if (!logsByDate || typeof logsByDate !== 'object') return 0;
        ensureStreakFreezeIntegrity(logsByDate, todayStr);
        const appState = typeof state !== 'undefined' ? state : window.state;
        const hasMeals = (d) => Array.isArray(logsByDate[d]) && logsByDate[d].filter(m => m && m.name && String(m.name).trim() !== '').length >= 1;
        const frozenSet = new Set((appState && appState.streakFreeze && Array.isArray(appState.streakFreeze.frozenDates)) ? appState.streakFreeze.frozenDates : []);
        const isDayCovered = (d) => hasMeals(d) || frozenSet.has(d);
        
        const toLocalDateStr = (d) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        const today = new Date(todayStr + 'T00:00:00');
        let current = new Date(today);
        let streak = 0;
        let realMealDays = 0;
        
        if (hasMeals(todayStr)) {
            streak = 1;
            realMealDays = 1;
            while (true) {
                current.setDate(current.getDate() - 1);
                const dStr = toLocalDateStr(current);
                if (isDayCovered(dStr)) {
                    streak++;
                    if (hasMeals(dStr)) realMealDays++;
                } else {
                    break;
                }
            }
        } else {
            current.setDate(current.getDate() - 1);
            const yestStr = toLocalDateStr(current);
            if (isDayCovered(yestStr)) {
                streak = 1;
                if (hasMeals(yestStr)) realMealDays++;
                while (true) {
                    current.setDate(current.getDate() - 1);
                    const dStr = toLocalDateStr(current);
                    if (isDayCovered(dStr)) {
                        streak++;
                        if (hasMeals(dStr)) realMealDays++;
                    } else {
                        break;
                    }
                }
            } else {
                streak = 0;
            }
        }
        return realMealDays > 0 ? streak : 0;
    }

    function isFrameUnlocked(tierId, verifiedStreak, isVip) {
        const tier = PRESTIGE_TIERS[tierId];
        if (!tier) return false;
        if (tierId === 'novice') return true;
        if (tierId === 'diamond' && isVip) return true;
        return (Number(verifiedStreak) || 0) >= tier.minDays;
    }

    function verifyAndSanitizeStreak() {
        const appState = typeof state !== 'undefined' ? state : window.state;
        if (!appState) return;
        const todayStr = getTodayStrSafe();
        const verified = calculateVerifiedStreak(appState.logsByDate, todayStr);
        const claimed = Number(appState.streakDays) || 0;
        
        // Anti-cheat verification: streak cannot artificially exceed mathematically verified active days
        if (claimed > verified) {
            // False-positive guard: Only log security audit if claimed streak is substantially higher (>= 2 days higher),
            // not normal streak decay/expiration when user misses today or yesterday.
            if (claimed >= 2 && claimed > verified + 1 && window.recordSecurityAuditLog) {
                window.recordSecurityAuditLog({
                    type: 'STREAK_SPOOF_TAMPER',
                    reason: `Claimed streak (${claimed} days) exceeds verified consecutive meal days (${verified} days)`,
                    details: { claimed, verified, todayStr }
                });
            }
            appState.streakDays = verified;
        } else {
            appState.streakDays = verified;
        }
        
        // Verify active prestige frame legality
        if (!PRESTIGE_TIERS[appState.prestigeFrame] || !isFrameUnlocked(appState.prestigeFrame, appState.streakDays, appState.isVip)) {
            if (appState.prestigeFrame !== 'novice' && window.recordSecurityAuditLog) {
                window.recordSecurityAuditLog({
                    type: 'ILLEGAL_FRAME_DOWNGRADE',
                    reason: `Active frame '${appState.prestigeFrame}' was not legally unlocked by streak (${appState.streakDays} days)`,
                    details: { frame: appState.prestigeFrame, verifiedStreak: appState.streakDays }
                });
            }
            appState.prestigeFrame = 'novice';
        }
    }

    function openPrestigeWardrobeModal() {
        verifyAndSanitizeStreak();
        renderWardrobeModal();
        openModalAnimatedSafe('prestigeWardrobeModal');
    }

    function closePrestigeWardrobeModal() {
        closeModalAnimatedSafe('prestigeWardrobeModal');
    }

    function closePrestigeWardrobeModalOnBackdrop(e) {
        if (e && e.target && e.target.id === 'prestigeWardrobeModal') {
            closePrestigeWardrobeModal();
        }
    }

    // ==========================================
    // APP TOUR & INTERACTIVE GUIDE ENGINE (v5.9.19)
    // ==========================================
    const TOUR_SLIDES = [
        {
            icon: '🥑',
            tag: 'สเต็ป 1 จาก 6 • ยินดีต้อนรับ',
            title: 'ยินดีต้อนรับสู่ NovaFit Pro!',
            desc: 'เพื่อนคู่คิดด้านโภชนาการและการออกกำลังกาย ช่วยคุณคำนวณแคลอรีและสารอาหารหลัก (Macro) รายบุคคลตามเป้าหมายอย่างแม่นยำ',
            tipTitle: '💡 เคล็ดลับการเริ่มต้น',
            tipContent: 'เริ่มต้นด้วยการตั้งค่าส่วนสูง น้ำหนักตัว และเป้าหมายของคุณ เพื่อให้ระบบคำนวณ TDEE และสัดส่วนอาหารที่แม่นยำที่สุด'
        },
        {
            icon: '📲',
            tag: 'สเต็ป 2 จาก 6 • ติดตั้งลงหน้าจอโฮม',
            title: 'วิธีติดตั้งลงหน้าจอโฮม (Home Screen)',
            desc: 'เปิดใช้งานแบบเต็มหน้าจอ (Full Screen) เหมือนแอปจริงบนมือถือ รวดเร็ว ลื่นไหล ไม่เกะกะแถบเบราว์เซอร์ และรับแจ้งเตือนได้ดีที่สุด',
            tipTitle: '📌 ขั้นตอนติดตั้งง่ายๆ ใน 2 วินาที',
            tipContent: '<div class="space-y-1.5 text-[11px]"><div class="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60"><b class="text-emerald-600 dark:text-emerald-400">🍏 สำหรับ iPhone / iPad (Safari):</b><br>แตะปุ่มแชร์ <b>⎋ (Share)</b> ที่แถบล่าง ➔ เลื่อนลงเลือก <b>"เพิ่มไปยังหน้าจอโฮม" (Add to Home Screen ➕)</b> ➔ แตะ "เพิ่ม"</div><div class="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60"><b class="text-sky-600 dark:text-sky-400">🤖 สำหรับ Android (Chrome):</b><br>แตะจุดสามจุด <b>⋮</b> มุมบนขวา ➔ เลือก <b>"ติดตั้งแอป" (Install)</b> หรือ <b>"เพิ่มลงในหน้าจอหลัก ➕"</b></div></div><button type="button" onclick="handlePwaInstallClick()" class="w-full mt-2 py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 text-white font-bold text-xs shadow-xs transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"><span>📲</span> <span>แตะเพื่อติดตั้งแอปลงเครื่องทันที</span></button>'
        },
        {
            icon: '📸',
            tag: 'สเต็ป 3 จาก 6 • สแกนอาหาร AI',
            title: 'ถ่ายรูปอาหาร บันทึกแคลอรีทันใจ',
            desc: 'แตะปุ่ม "📸 สแกนอาหารด้วย AI" เพื่อถ่ายรูปจานข้าวของคุณ AI อัจฉริยะจะช่วยประเมินชื่ออาหาร แคลอรี และสารอาหารให้ทันทีใน 2 วินาที',
            tipTitle: '⚡ คลังอาหารกว่า 280+ รายการ',
            tipContent: 'สามารถค้นหาหรือแตะปุ่ม "+" เพื่อบันทึกอาหารไทยยอดฮิต หรือกด "➕ กรอกเพิ่มเมนูเอง" หากเป็นสูตรส่วนตัวของคุณ'
        },
        {
            icon: '💧',
            tag: 'สเต็ป 4 จาก 6 • จิบน้ำ & IF',
            title: 'ติดตามการดื่มน้ำ & นาฬิกา IF',
            desc: 'แตะ +250 มล. เมื่อดื่มน้ำเพื่อเติมหลอดความชุ่มชื้น พร้อมระบบจับเวลาทำ Intermittent Fasting (IF 16:8 ถึง 20:4) นับถอยหลังช่วง Fasting และ Feasting แบบเรียลไทม์',
            tipTitle: '🔔 แจ้งเตือนเตือนจิบน้ำอัจฉริยะ',
            tipContent: 'ระบบจะวิเคราะห์การดื่มน้ำช่วงบ่าย หากดื่มน้อยกว่า 50% จะมีข้อความส่งกำลังใจชวนจิบน้ำถึงหน้าจอล็อค'
        },
        {
            icon: '🏆',
            tag: 'สเต็ป 5 จาก 6 • สตรีค & กรอบโปรไฟล์',
            title: 'สะสมสตรีค & กรอบเกียรติยศ',
            desc: 'บันทึกอาหารจริงทุกวันเพื่อสะสมสตรีคต่อเนื่อง ปลดล็อกกรอบโปรไฟล์ 5 ลำดับขั้น (เริ่มต้น ➔ ทองแดง ➔ เงิน ➔ ทอง ➔ เพชร) อวดความมีวินัยของคุณ',
            tipTitle: '🛡️ ระบบป้องกันสตรีคปลอดภัย',
            tipContent: 'สตรีคจะนับจากการบันทึกมื้ออาหารจริงเท่านั้น แตะที่รูปโปรไฟล์เพื่อเปิดตู้เสื้อผ้าแต่งตัวกรอบได้ตลอดเวลา'
        },
        {
            icon: '🔔',
            tag: 'สเต็ป 6 จาก 6 • แจ้งเตือนอัจฉริยะ',
            title: 'เชื่อมต่อแจ้งเตือน & สมาร์ตวอทช์',
            desc: 'เปิดรับแจ้งเตือนเพื่อรับข้อความเตือนกินข้าวกลางวัน เย็น และเตือนเซฟสตรีค รองรับการสั่นเตือนบน Apple Watch & สมาร์ตวอทช์',
            tipTitle: '🔊 เสียงและระบบสั่น',
            tipContent: 'สามารถเปิด/ปิดการแจ้งเตือนและเสียงเอฟเฟกต์ (Sound FX) ได้อย่างอิสระในเมนูปุ่ม "⚙️ จัดการ"'
        }
    ];

    let currentTourSlideIndex = 0;

    function renderTourSlide() {
        const slide = TOUR_SLIDES[currentTourSlideIndex];
        if (!slide) return;

        const iconEl = document.getElementById('tourSlideIcon');
        const tagEl = document.getElementById('tourSlideTag');
        const titleEl = document.getElementById('tourSlideTitle');
        const descEl = document.getElementById('tourSlideDesc');
        const tipTitleEl = document.getElementById('tourSlideTipTitle');
        const tipContentEl = document.getElementById('tourSlideTipContent');
        const btnPrev = document.getElementById('btnTourPrev');
        const btnNext = document.getElementById('btnTourNext');
        const btnNextText = document.getElementById('btnTourNextText');
        const dotsContainer = document.getElementById('tourDotsContainer');

        if (iconEl) iconEl.textContent = slide.icon;
        if (tagEl) tagEl.textContent = slide.tag;
        if (titleEl) titleEl.textContent = slide.title;
        if (descEl) descEl.textContent = slide.desc;
        if (tipTitleEl) tipTitleEl.innerHTML = `<span>💡</span> ${slide.tipTitle}`;
        if (tipContentEl) tipContentEl.innerHTML = slide.tipContent;

        // Previous button state
        if (btnPrev) {
            if (currentTourSlideIndex === 0) {
                btnPrev.classList.add('opacity-40', 'pointer-events-none');
            } else {
                btnPrev.classList.remove('opacity-40', 'pointer-events-none');
            }
        }

        // Next button text
        const isLast = currentTourSlideIndex === TOUR_SLIDES.length - 1;
        if (btnNextText) {
            btnNextText.textContent = isLast ? 'เริ่มใช้งานทันที! 🚀' : 'ถัดไป';
        }

        // Update Dots dynamically
        if (dotsContainer) {
            dotsContainer.innerHTML = TOUR_SLIDES.map((_, idx) => `
                <button type="button" onclick="goToTourSlide(${idx})" class="${idx === currentTourSlideIndex ? 'w-6 h-2 rounded-full bg-emerald-500 transition-all cursor-pointer' : 'w-2 h-2 rounded-full bg-slate-200 dark:bg-slate-700 transition-all cursor-pointer'}"></button>
            `).join('');
        }
    }

    function openAppTourModal() {
        currentTourSlideIndex = 0;
        renderTourSlide();
        openModalAnimatedSafe('appTourModal');
        playSoundSafe('pop');
    }

    function closeAppTourModal() {
        const appState = typeof state !== 'undefined' ? state : window.state;
        closeModalAnimatedSafe('appTourModal');
        localStorage.setItem('novafit_tour_seen', 'true');
        if (window.currentUser) {
            localStorage.setItem('novafit_tour_seen_' + window.currentUser.uid, 'true');
        }
        if (window.saveTourSeenToCloud) {
            window.saveTourSeenToCloud();
        }
        // If user hasn't configured profile yet, prompt them right after tour!
        if (appState && !appState.profileConfigured) {
            setTimeout(() => {
                if (typeof openProfileSettingsModal === 'function') openProfileSettingsModal();
                else if (window.openProfileSettingsModal) window.openProfileSettingsModal();
                showToastSafe('⚙️ สเต็ปสำคัญ: กรอกข้อมูลร่างกายและกด "✓ บันทึกข้อมูลเรียบร้อย" เพื่อเริ่มใช้งาน');
            }, 400);
        }
    }

    function closeAppTourModalOnBackdrop(e) {
        if (e && e.target && e.target.id === 'appTourModal') {
            closeAppTourModal();
        }
    }

    function nextTourSlide() {
        if (currentTourSlideIndex < TOUR_SLIDES.length - 1) {
            currentTourSlideIndex++;
            renderTourSlide();
            playSoundSafe('pop');
        } else {
            closeAppTourModal();
            playSoundSafe('celebrate');
            showToastSafe('🎉 พร้อมแล้ว! เริ่มบันทึกอาหารเพื่อสุขภาพที่ดีของคุณได้เลย');
        }
    }

    function prevTourSlide() {
        if (currentTourSlideIndex > 0) {
            currentTourSlideIndex--;
            renderTourSlide();
            playSoundSafe('pop');
        }
    }

    function goToTourSlide(index) {
        if (index >= 0 && index < TOUR_SLIDES.length) {
            currentTourSlideIndex = index;
            renderTourSlide();
            playSoundSafe('pop');
        }
    }

    function equipPrestigeFrame(tierId) {
        const appState = typeof state !== 'undefined' ? state : window.state;
        if (!appState) return;
        verifyAndSanitizeStreak();
        const tier = PRESTIGE_TIERS[tierId];
        if (!tier) return;
        const verifiedStreak = calculateVerifiedStreak(appState.logsByDate, getTodayStrSafe());
        const unlocked = isFrameUnlocked(tierId, verifiedStreak, appState.isVip);
        
        if (!unlocked) {
            if (window.recordSecurityAuditLog) {
                window.recordSecurityAuditLog({
                    type: 'UNAUTHORIZED_PRESTIGE_EQUIP',
                    reason: `User attempted to equip locked frame '${tierId}' (requires ${tier.minDays} days, user has ${verifiedStreak})`,
                    details: { attemptedFrame: tierId, reqDays: tier.minDays, verifiedStreak, isVip: !!appState.isVip }
                });
            }
            appState.prestigeFrame = 'novice';
            saveStateSafe();
            renderPrestigeFrames();
            renderWardrobeModal();
            showToastSafe(`⚠️ ยังไม่สามารถสวมใส่ได้ (ต้องการสตรีคต่อเนื่อง ${tier.minDays} วัน)`);
            return;
        }

        appState.prestigeFrame = tierId;
        saveStateSafe();
        renderPrestigeFrames();
        renderWardrobeModal();
        showToastSafe(`✨ สวมใส่กรอบ ${tier.name} เรียบร้อยแล้ว!`);
    }

    function renderPrestigeFrames() {
        const appState = typeof state !== 'undefined' ? state : window.state;
        if (!appState) return;
        verifyAndSanitizeStreak();
        const activeTier = PRESTIGE_TIERS[appState.prestigeFrame] || PRESTIGE_TIERS.novice;
        const streakCount = Number(appState.streakDays) || 0;
        const customAvatar = appState.userAvatarUrl || '';
        const customName = appState.userDisplayName || '';
        const googlePhoto = (window.currentUser && window.currentUser.photoURL) || '';
        const effectiveAvatar = customAvatar || googlePhoto;
        
        // Header: User (Google)
        const userAvatarImg = document.getElementById('userAvatar');
        const userAvatarFrame = document.getElementById('userAvatarFrame');
        const userStreakBadge = document.getElementById('userStreakBadgeCount');
        const userNameEl = document.getElementById('userName');
        const dropdownFullName = document.getElementById('dropdownUserFullName');
        
        if (userAvatarImg) {
            userAvatarImg.src = effectiveAvatar || 'https://www.gravatar.com/avatar/?d=mp';
        }
        if (userAvatarFrame) {
            userAvatarFrame.src = activeTier.frameImg;
            userAvatarFrame.className = `absolute -inset-2 sm:-inset-2.5 w-[calc(100%+16px)] sm:w-[calc(100%+20px)] h-[calc(100%+16px)] sm:h-[calc(100%+20px)] max-w-none pointer-events-none select-none object-contain ${activeTier.effectClass}`;
        }
        if (userStreakBadge) {
            userStreakBadge.textContent = streakCount;
        }
        if (userNameEl) {
            const effectiveName = customName || (window.currentUser && window.currentUser.displayName ? window.currentUser.displayName.split(' ')[0] : 'ผู้ใช้');
            userNameEl.textContent = effectiveName;
        }
        if (dropdownFullName) {
            const effectiveFullName = customName || (window.currentUser && window.currentUser.displayName) || 'ผู้ใช้งาน NovaFit Pro';
            dropdownFullName.textContent = effectiveFullName;
        }

        // Header: Guest
        const guestAvatarImg = document.getElementById('guestAvatarImg');
        const guestAvatarDefault = document.getElementById('guestAvatarDefault');
        const guestAvatarFrame = document.getElementById('guestAvatarFrame');
        const guestStreakBadge = document.getElementById('guestStreakBadgeCount');
        
        if (guestAvatarImg && guestAvatarDefault) {
            if (effectiveAvatar) {
                guestAvatarImg.src = effectiveAvatar;
                guestAvatarImg.classList.remove('hidden');
                guestAvatarDefault.classList.add('hidden');
            } else {
                guestAvatarImg.src = '';
                guestAvatarImg.classList.add('hidden');
                guestAvatarDefault.classList.remove('hidden');
            }
        }
        if (guestAvatarFrame) {
            guestAvatarFrame.src = activeTier.frameImg;
            guestAvatarFrame.className = `absolute -inset-2 sm:-inset-2.5 w-[calc(100%+16px)] sm:w-[calc(100%+20px)] h-[calc(100%+16px)] sm:h-[calc(100%+20px)] max-w-none pointer-events-none select-none object-contain ${activeTier.effectClass}`;
        }
        if (guestStreakBadge) {
            guestStreakBadge.textContent = streakCount;
        }

        // Sync user avatar to companion chat history if rendered - v5.9.23
        if (typeof window.refreshUserAvatarsInChat === 'function') {
            window.refreshUserAvatarsInChat();
        }
    }

    function renderWardrobeModal() {
        const appState = typeof state !== 'undefined' ? state : window.state;
        if (!appState) return;
        const streakCount = Number(appState.streakDays) || 0;
        const streakEl = document.getElementById('wardrobeCurrentStreakText');
        if (streakEl) streakEl.textContent = `${streakCount} วัน`;

        const sf = appState.streakFreeze || { shieldsRemaining: 2, maxShields: 2, frozenDates: [] };
        const shieldCountEl = document.getElementById('wardrobeStreakFreezeCount');
        const frozenNoteEl = document.getElementById('wardrobeFrozenDatesNote');
        if (shieldCountEl) {
            shieldCountEl.textContent = `🧊 โล่น้ำแข็ง: ${sf.shieldsRemaining ?? 2}/${sf.maxShields || 2}`;
        }
        if (frozenNoteEl) {
            if (Array.isArray(sf.frozenDates) && sf.frozenDates.length > 0) {
                frozenNoteEl.classList.remove('hidden');
                frozenNoteEl.innerHTML = `🧊 ปกป้องสตรีควันที่ <b>${sf.frozenDates.slice(-2).join(', ')}</b> อัตโนมัติ • บันทึกย้อนหลังเพื่อรับโล่คืนได้!`;
            } else {
                frozenNoteEl.classList.add('hidden');
            }
        }

        const activeTier = PRESTIGE_TIERS[appState.prestigeFrame] || PRESTIGE_TIERS.novice;
        const activeNameEl = document.getElementById('wardrobeActiveFrameName');
        if (activeNameEl) activeNameEl.textContent = `${activeTier.badgeEmoji} ${activeTier.name}`;

        // 1. Profile Customizer Box in Modal
        const previewAvatarImg = document.getElementById('wardrobePreviewAvatarImg');
        const previewAvatarDef = document.getElementById('wardrobePreviewAvatarDefault');
        const previewFrameImg = document.getElementById('wardrobePreviewFrameImg');
        const displayNameInput = document.getElementById('wardrobeDisplayNameInput');
        const btnRemoveAvatar = document.getElementById('btnRemoveCustomAvatar');

        const googlePhoto = (window.currentUser && window.currentUser.photoURL) || '';
        const currentAvatarSrc = appState.userAvatarUrl || googlePhoto || '';

        if (previewAvatarImg && previewAvatarDef) {
            if (currentAvatarSrc && !currentAvatarSrc.includes('gravatar.com/avatar/?d=mp')) {
                previewAvatarImg.src = currentAvatarSrc;
                previewAvatarImg.classList.remove('hidden');
                previewAvatarDef.classList.add('hidden');
            } else {
                previewAvatarImg.src = '';
                previewAvatarImg.classList.add('hidden');
                previewAvatarDef.classList.remove('hidden');
            }
        }

        if (previewFrameImg) {
            previewFrameImg.src = activeTier.frameImg;
            previewFrameImg.className = `absolute -inset-5 sm:-inset-5.5 w-[calc(100%+40px)] sm:w-[calc(100%+44px)] h-[calc(100%+40px)] sm:h-[calc(100%+44px)] max-w-none pointer-events-none select-none object-contain ${activeTier.effectClass}`;
        }

        if (displayNameInput && appState.userDisplayName !== undefined) {
            if (document.activeElement !== displayNameInput) {
                displayNameInput.value = appState.userDisplayName || '';
            }
        }

        if (btnRemoveAvatar) {
            btnRemoveAvatar.classList.toggle('hidden', !appState.userAvatarUrl);
        }

        // 2. Tiers Showcase List with Real PNG Frames and Dynamic Animations (Outer Frame Architecture)
        const listEl = document.getElementById('wardrobeTiersList');
        if (!listEl) return;

        const tiers = Object.values(PRESTIGE_TIERS);
        listEl.innerHTML = tiers.map(tier => {
            const isUnlocked = isFrameUnlocked(tier.id, streakCount, appState.isVip);
            const isActive = appState.prestigeFrame === tier.id;
            const progressPct = tier.minDays === 0 ? 100 : Math.min(100, Math.round((streakCount / tier.minDays) * 100));
            
            let actionBtnHtml = '';
            if (isActive) {
                actionBtnHtml = `
                    <button type="button" disabled class="px-3.5 py-1.5 rounded-xl bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/40 font-bold text-xs flex items-center gap-1 cursor-default">
                        <span>✓</span> ใช้งานอยู่
                    </button>
                `;
            } else if (isUnlocked) {
                actionBtnHtml = `
                    <button type="button" onclick="equipPrestigeFrame('${tier.id}')" class="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-sm transition active:scale-95 cursor-pointer">
                        สวมใส่
                    </button>
                `;
            } else {
                const daysLeft = tier.minDays - streakCount;
                actionBtnHtml = `
                    <button type="button" disabled class="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700/60 text-slate-400 font-bold text-xs flex items-center gap-1 cursor-not-allowed">
                        <span>🔒</span> ขาดอีก ${daysLeft} วัน
                    </button>
                `;
            }

            return `
                <div class="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border ${isActive ? 'border-purple-500 shadow-md ring-2 ring-purple-500/20' : 'border-slate-200 dark:border-slate-700'} flex items-center gap-3 transition">
                    <!-- Left: Real PNG Frame Overlay with dynamic CSS Animation (Outer Frame Architecture) -->
                    <div class="shrink-0 p-1">
                        <div class="relative flex items-center justify-center shrink-0 my-0.5 mx-1.5">
                            <div class="relative w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden flex items-center justify-center bg-slate-800 shadow-xs">
                                ${currentAvatarSrc && !currentAvatarSrc.includes('gravatar.com/avatar/?d=mp') ? `
                                    <img src="${currentAvatarSrc}" class="w-full h-full object-cover">
                                ` : `
                                    <div class="w-full h-full text-white flex items-center justify-center font-bold text-xs"><span>👤</span></div>
                                `}
                            </div>
                            <img src="${tier.frameImg}" class="absolute -inset-3 w-[calc(100%+24px)] h-[calc(100%+24px)] max-w-none pointer-events-none select-none object-contain ${tier.effectClass}" alt="${tier.name}">
                        </div>
                    </div>

                    <!-- Center: Info & Progress -->
                    <div class="min-w-0 flex-1 space-y-1">
                        <div class="flex items-center gap-2 flex-wrap">
                            <h4 class="font-extrabold text-xs sm:text-sm text-slate-800 dark:text-slate-100">${tier.title}</h4>
                            ${isUnlocked ? `<span class="text-[9px] font-bold px-1.5 py-0.5 rounded-full ${tier.colorBadge}">ปลดล็อกแล้ว</span>` : ''}
                        </div>
                        <p class="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">${tier.desc}</p>
                        ${tier.minDays > 0 ? `
                            <div class="space-y-0.5 pt-0.5">
                                <div class="flex items-center justify-between text-[10px] text-slate-400">
                                    <span>ความคืบหน้า</span>
                                    <span class="font-bold text-slate-600 dark:text-slate-300">${Math.min(streakCount, tier.minDays)} / ${tier.minDays} วัน (${progressPct}%)</span>
                                </div>
                                <div class="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                    <div class="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-300" style="width: ${progressPct}%"></div>
                                </div>
                            </div>
                        ` : ''}
                    </div>

                    <!-- Right: Action Button -->
                    <div class="shrink-0">
                        ${actionBtnHtml}
                    </div>
                </div>
            `;
        }).join('');
    }

    function handleAvatarPhotoSelected(event) {
        const appState = typeof state !== 'undefined' ? state : window.state;
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            showToastSafe('⚠️ กรุณาเลือกไฟล์รูปภาพ');
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const size = 256;
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext('2d');
                const minDim = Math.min(img.width, img.height);
                const sx = (img.width - minDim) / 2;
                const sy = (img.height - minDim) / 2;
                
                ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                
                if (appState) appState.userAvatarUrl = dataUrl;
                saveStateSafe();
                renderPrestigeFrames();
                renderWardrobeModal();
                showToastSafe('📷 เปลี่ยนรูปโปรไฟล์สำเร็จแล้ว!');
                
                if (window.syncProfileDataToCloud) {
                    window.syncProfileDataToCloud();
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
        event.target.value = '';
    }

    function saveProfileDisplayName() {
        const appState = typeof state !== 'undefined' ? state : window.state;
        const input = document.getElementById('wardrobeDisplayNameInput');
        if (!input) return;
        const newName = input.value.trim();
        if (newName.length > 30) {
            showToastSafe('⚠️ ชื่อต้องมีความยาวไม่เกิน 30 ตัวอักษร');
            return;
        }
        if (appState) appState.userDisplayName = newName;
        saveStateSafe();
        renderPrestigeFrames();
        renderWardrobeModal();
        showToastSafe('✏️ บันทึกชื่อแสดงผลเรียบร้อยแล้ว!');
        
        if (window.syncProfileDataToCloud) {
            window.syncProfileDataToCloud();
        }
    }

    function removeCustomAvatarPhoto() {
        const appState = typeof state !== 'undefined' ? state : window.state;
        if (appState) appState.userAvatarUrl = '';
        saveStateSafe();
        
        const googlePhoto = (window.currentUser && window.currentUser.photoURL) || '';
        const userAvatarImg = document.getElementById('userAvatar');
        const guestAvatarImg = document.getElementById('guestAvatarImg');
        const guestAvatarDefault = document.getElementById('guestAvatarDefault');
        const previewAvatarImg = document.getElementById('wardrobePreviewAvatarImg');
        const previewAvatarDef = document.getElementById('wardrobePreviewAvatarDefault');
        const btnRemoveAvatar = document.getElementById('btnRemoveCustomAvatar');

        if (userAvatarImg) {
            userAvatarImg.src = googlePhoto || 'https://www.gravatar.com/avatar/?d=mp';
        }

        if (guestAvatarImg && guestAvatarDefault) {
            if (googlePhoto) {
                guestAvatarImg.src = googlePhoto;
                guestAvatarImg.classList.remove('hidden');
                guestAvatarDefault.classList.add('hidden');
            } else {
                guestAvatarImg.src = '';
                guestAvatarImg.classList.add('hidden');
                guestAvatarDefault.classList.remove('hidden');
            }
        }

        if (previewAvatarImg && previewAvatarDef) {
            if (googlePhoto) {
                previewAvatarImg.src = googlePhoto;
                previewAvatarImg.classList.remove('hidden');
                previewAvatarDef.classList.add('hidden');
            } else {
                previewAvatarImg.src = '';
                previewAvatarImg.classList.add('hidden');
                previewAvatarDef.classList.remove('hidden');
            }
        }

        if (btnRemoveAvatar) {
            btnRemoveAvatar.classList.add('hidden');
        }

        renderPrestigeFrames();
        renderWardrobeModal();
        showToastSafe('ลบรูปภาพแล้ว กลับไปใช้รูปเริ่มต้น');
        
        if (window.syncProfileDataToCloud) {
            window.syncProfileDataToCloud();
        }
    }

    // Window Global Exports
    window.PRESTIGE_TIERS = PRESTIGE_TIERS;
    window.ensureStreakFreezeIntegrity = ensureStreakFreezeIntegrity;
    window.jumpToYesterdayAndLog = jumpToYesterdayAndLog;
    window.calculateVerifiedStreak = calculateVerifiedStreak;
    window.verifyAndSanitizeStreak = verifyAndSanitizeStreak;
    window.isFrameUnlocked = isFrameUnlocked;
    window.equipPrestigeFrame = equipPrestigeFrame;
    window.openPrestigeWardrobeModal = openPrestigeWardrobeModal;
    window.closePrestigeWardrobeModal = closePrestigeWardrobeModal;
    window.closePrestigeWardrobeModalOnBackdrop = closePrestigeWardrobeModalOnBackdrop;
    window.renderPrestigeFrames = renderPrestigeFrames;
    window.renderWardrobeModal = renderWardrobeModal;
    window.handleAvatarPhotoSelected = handleAvatarPhotoSelected;
    window.saveProfileDisplayName = saveProfileDisplayName;
    window.removeCustomAvatarPhoto = removeCustomAvatarPhoto;
    window.TOUR_SLIDES = TOUR_SLIDES;
    window.renderTourSlide = renderTourSlide;
    window.openAppTourModal = openAppTourModal;
    window.closeAppTourModal = closeAppTourModal;
    window.closeAppTourModalOnBackdrop = closeAppTourModalOnBackdrop;
    window.nextTourSlide = nextTourSlide;
    window.prevTourSlide = prevTourSlide;
    window.goToTourSlide = goToTourSlide;
})();
