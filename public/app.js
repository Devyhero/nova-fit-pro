const APP_VERSION = '5.9.11';
        const STORAGE_KEY = 'fitmacro_pro_v4_state';
        // Note: MEAL_CONFIG, WORKOUT_PRESETS, DEFAULT_MEAL_COMBOS, DEFAULT_SUPPLEMENTS, FOOD_DATABASE are loaded from food-db.js

        function getTodayStr() {
            const now = new Date();
            const offset = now.getTimezoneOffset() * 60000;
            return new Date(now.getTime() - offset).toISOString().split('T')[0];
        }

        function getDefaultMealByTime() {
            const h = new Date().getHours();
            if (h >= 4 && h < 11) return 'breakfast';
            if (h >= 11 && h < 16) return 'lunch';
            if (h >= 16 && h < 21) return 'dinner';
            return 'snack';
        }

        function inferMealFromTime(timeStr) {
            if (!timeStr) return 'breakfast';
            const parts = timeStr.split(':');
            if (parts.length < 2) return 'breakfast';
            const h = parseInt(parts[0], 10);
            if (h >= 4 && h < 11) return 'breakfast';
            if (h >= 11 && h < 16) return 'lunch';
            if (h >= 16 && h < 21) return 'dinner';
            return 'snack';
        }

        // Living Companion variables (hoisted for early renderAll calls)
        var _companionDismissTimer = null;
        var _companionCheckDebounce = null;
        var _currentCompanionNudgeId = null;
        var _currentCompanionConfig = null;
        var _milestoneDismissTimer = null;
        var _confettiAnimationId = null;

        let state = {
            version: APP_VERSION,
            theme: 'dark',
            soundEnabled: true,
            settingsCollapsed: true,
            collapsedSections: {},
            customFormOpen: false,
            selectedDate: getTodayStr(),
            lastActiveDate: getTodayStr(),
            selectedCategory: 'all',
            searchQuery: '',
            lastAddedFoodName: '',
            activeMeal: 'breakfast',
            profileConfigured: false,
            userDisplayName: '',
            userAvatarUrl: '',
            selectedPortion: 1,
            favorites: [],
            bodyTab: 'weight',
            weightsByDate: {},
            workoutsByDate: {},
            dayTypeByDate: {},
            mealCombos: DEFAULT_MEAL_COMBOS,
            supplementList: JSON.parse(JSON.stringify(DEFAULT_SUPPLEMENTS)),
            supplementsByDate: {},
            fasting: {
                isFasting: false,
                plan: '16:8',
                targetHours: 16,
                startTime: null,
                endTime: null,
                history: []
            },
            profile: {
                gender: 'male',
                age: 33,
                weight: 70,
                height: 173,
                activity: 1.55,
                goalDiff: 0,
                macros: { p: 30, c: 40, f: 30 }
            },
            customPresets: [],
            logsByDate: {},
            waterByDate: {}
        };

        // Cache for recommendations so clicking water or theme doesn't reshuffle
        let cachedRecommendations = [];

        // ==========================================
        // 🎵 In-App Sound Effects Engine (Web Audio Synthesizer)
        // ==========================================
        let _audioCtx = null;

        function getAudioContext() {
            if (!_audioCtx && (window.AudioContext || window.webkitAudioContext)) {
                const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
                _audioCtx = new AudioCtxClass();
            }
            if (_audioCtx && _audioCtx.state === 'suspended') {
                _audioCtx.resume();
            }
            return _audioCtx;
        }

        // Unlock audio context on initial user tap (iOS Safari requirement)
        window.addEventListener('touchstart', () => getAudioContext(), { once: true, passive: true });
        window.addEventListener('click', () => getAudioContext(), { once: true, passive: true });

        function playSound(type = 'pop') {
            if (state.soundEnabled === false) return;
            try {
                const ctx = getAudioContext();
                if (!ctx) return;

                const now = ctx.currentTime;
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);

                if (type === 'pop') {
                    // Bright cute pop sound (Food logged / item added)
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(540, now);
                    osc.frequency.exponentialRampToValueAtTime(920, now + 0.08);
                    gain.gain.setValueAtTime(0.22, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
                    osc.start(now);
                    osc.stop(now + 0.12);
                } else if (type === 'water') {
                    // Refreshing water droplet sound (Water intake)
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(620, now);
                    osc.frequency.exponentialRampToValueAtTime(1020, now + 0.06);
                    osc.frequency.exponentialRampToValueAtTime(480, now + 0.16);
                    gain.gain.setValueAtTime(0.28, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
                    osc.start(now);
                    osc.stop(now + 0.18);
                } else if (type === 'celebrate') {
                    // Cheerful celebratory 4-tone chime arpeggio (Milestones & Confetti)
                    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
                    notes.forEach((freq, idx) => {
                        const noteOsc = ctx.createOscillator();
                        const noteGain = ctx.createGain();
                        noteOsc.type = 'triangle';
                        noteOsc.frequency.setValueAtTime(freq, now + idx * 0.06);
                        noteGain.gain.setValueAtTime(0.18, now + idx * 0.06);
                        noteGain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.22);
                        noteOsc.connect(noteGain);
                        noteGain.connect(ctx.destination);
                        noteOsc.start(now + idx * 0.06);
                        noteOsc.stop(now + idx * 0.06 + 0.22);
                    });
                } else if (type === 'nudge') {
                    // Sweet bubble chirp (Living Companion nudge)
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(460, now);
                    osc.frequency.exponentialRampToValueAtTime(690, now + 0.09);
                    gain.gain.setValueAtTime(0.16, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
                    osc.start(now);
                    osc.stop(now + 0.14);
                } else if (type === 'delete') {
                    // Subtle soft click drop (Item deleted)
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(340, now);
                    osc.frequency.exponentialRampToValueAtTime(170, now + 0.08);
                    gain.gain.setValueAtTime(0.18, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
                    osc.start(now);
                    osc.stop(now + 0.1);
                }
            } catch (err) {
                console.warn('Audio synthesis note:', err);
            }
        }
        window.playSound = playSound;

        function renderSoundButton() {
            const icon = document.getElementById('soundIcon');
            const btn = document.getElementById('btnSoundToggle');
            const isMuted = state.soundEnabled === false;
            if (icon) icon.textContent = isMuted ? '🔇' : '🔊';
            if (btn) btn.title = isMuted ? 'เปิดเสียงเอฟเฟกต์ (Unmute)' : 'ปิดเสียงเอฟเฟกต์ (Mute)';
        }

        function toggleSound() {
            state.soundEnabled = !(state.soundEnabled !== false);
            saveState();
            renderSoundButton();
            if (state.soundEnabled) {
                playSound('pop');
                showToast('🔊 เปิดเสียงเอฟเฟกต์ในแอปเรียบร้อย');
            } else {
                showToast('🔇 ปิดเสียงเอฟเฟกต์ในแอปเรียบร้อย');
            }
        }
        window.toggleSound = toggleSound;
        window.renderSoundButton = renderSoundButton;

        // Deduplicate meal logs to resolve multi-device sync ghost duplication (e.g. 2261 -> 4311 kcal)
        function cleanDuplicateMealLogs(mealList) {
            if (!Array.isArray(mealList) || mealList.length <= 1) return mealList || [];
            const seenIds = new Set();
            const seenSem = new Set();
            const cleaned = [];

            mealList.forEach(m => {
                if (!m) return;
                // Check exact ID duplicate
                if (m.id && seenIds.has(m.id)) {
                    return;
                }

                // Check semantic duplicate from sync clone (same meal + normalized name + cal + portion)
                const normName = (m.name || '').replace(/เพียว/g, '').trim().toLowerCase();
                const mealKey = m.meal || inferMealFromTime(m.time) || 'breakfast';
                const portion = m.portion || 1;
                const cal = Math.round(Number(m.cal) || 0);
                const semSig = `${mealKey}_${normName}_${cal}_${portion}`;

                if (seenSem.has(semSig)) {
                    return; // Skip sync ghost duplicate!
                }

                if (m.id) seenIds.add(m.id);
                seenSem.add(semSig);
                cleaned.push(m);
            });

            return cleaned;
        }
        window.cleanDuplicateMealLogs = cleanDuplicateMealLogs;
        let lastRecCacheKey = '';

        function loadState() {
            const todayStr = getTodayStr();
            try {
                const raw = localStorage.getItem(STORAGE_KEY)
                    || localStorage.getItem('fitmacro_pro_v3_state')
                    || localStorage.getItem('fitmacro_pro_v2_state');
                if (raw) {
                    const parsed = JSON.parse(raw);
                    const lastDate = parsed.lastActiveDate || parsed.selectedDate;
                    const isNewDay = lastDate && lastDate !== todayStr;

                    state = {
                        ...state,
                        ...parsed,
                        version: APP_VERSION,
                        soundEnabled: parsed.soundEnabled !== false,
                        collapsedSections: (parsed.collapsedSections && typeof parsed.collapsedSections === 'object') ? parsed.collapsedSections : {},
                        activeMeal: isNewDay ? 'breakfast' : (parsed.activeMeal || 'breakfast'),
                        selectedPortion: Number(parsed.selectedPortion) || 1,
                        favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
                        bodyTab: parsed.bodyTab || 'weight',
                        weightsByDate: (parsed.weightsByDate && typeof parsed.weightsByDate === 'object') ? parsed.weightsByDate : {},
                        workoutsByDate: (parsed.workoutsByDate && typeof parsed.workoutsByDate === 'object') ? parsed.workoutsByDate : {},
                        dayTypeByDate: (parsed.dayTypeByDate && typeof parsed.dayTypeByDate === 'object') ? parsed.dayTypeByDate : {},
                        mealCombos: (Array.isArray(parsed.mealCombos) && parsed.mealCombos.length > 0) ? parsed.mealCombos : DEFAULT_MEAL_COMBOS,
                        supplementList: Array.isArray(parsed.supplementList) ? parsed.supplementList : JSON.parse(JSON.stringify(DEFAULT_SUPPLEMENTS)),
                        supplementsByDate: (parsed.supplementsByDate && typeof parsed.supplementsByDate === 'object') ? parsed.supplementsByDate : {},
                        fasting: (parsed.fasting && typeof parsed.fasting === 'object') ? {
                            isFasting: !!parsed.fasting.isFasting,
                            plan: parsed.fasting.plan || '16:8',
                            targetHours: parsed.fasting.targetHours || 16,
                            startTime: parsed.fasting.startTime || null,
                            endTime: parsed.fasting.endTime || null,
                            history: Array.isArray(parsed.fasting.history) ? parsed.fasting.history : []
                        } : {
                            isFasting: false,
                            plan: '16:8',
                            targetHours: 16,
                            startTime: null,
                            endTime: null,
                            history: []
                        },
                        profile: { ...state.profile, ...(parsed.profile || {}) },
                        profileConfigured: parsed.profileConfigured === true,
                        userDisplayName: typeof parsed.userDisplayName === 'string' ? parsed.userDisplayName : '',
                        userAvatarUrl: typeof parsed.userAvatarUrl === 'string' ? parsed.userAvatarUrl : '',
                        logsByDate: parsed.logsByDate || {},
                        waterByDate: parsed.waterByDate || {},
                        customPresets: parsed.customPresets || [],
                        lastActiveDate: todayStr,
                        selectedDate: todayStr
                    };

                    // For existing users who already configured their profile, avoid re-prompting
                    if (parsed.profileConfigured === true) {
                        localStorage.setItem('novafit_profile_prompted', 'true');
                    }

                    // Data migration: ensure all logs have meal and base macros & deduplicate ghost clones
                    if (state.logsByDate) {
                        let hadGhostDuplicates = false;
                        Object.keys(state.logsByDate).forEach(date => {
                            const rawList = state.logsByDate[date] || [];
                            const cleanedList = cleanDuplicateMealLogs(rawList);
                            if (cleanedList.length !== rawList.length) {
                                hadGhostDuplicates = true;
                            }
                            state.logsByDate[date] = cleanedList.map(m => {
                                const id = m.id || ('log_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7));
                                const portion = m.portion || 1;
                                const baseCal = m.baseCal !== undefined ? m.baseCal : Math.round(m.cal / portion);
                                const baseP = m.baseP !== undefined ? m.baseP : Math.round((m.p / portion) * 10) / 10;
                                const baseC = m.baseC !== undefined ? m.baseC : Math.round((m.c / portion) * 10) / 10;
                                const baseF = m.baseF !== undefined ? m.baseF : Math.round((m.f / portion) * 10) / 10;
                                const meal = m.meal || inferMealFromTime(m.time);
                                return {
                                    ...m,
                                    id,
                                    meal,
                                    portion,
                                    baseCal,
                                    baseP,
                                    baseC,
                                    baseF,
                                    cal: Math.round(baseCal * portion),
                                    p: Math.round(baseP * portion * 10) / 10,
                                    c: Math.round(baseC * portion * 10) / 10,
                                    f: Math.round(baseF * portion * 10) / 10
                                };
                            });
                        });
                        if (hadGhostDuplicates) {
                            console.log('Cleaned up ghost duplicate meal logs from multi-device sync');
                            saveState();
                            if (window.triggerCloudSync) window.triggerCloudSync(false);
                        }
                    }
                } else {
                    // Brand new visitor!
                    window._isFirstTimeVisitor = true;
                    state.settingsCollapsed = false;
                    state.lastActiveDate = todayStr;
                    state.selectedDate = todayStr;
                    state.activeMeal = 'breakfast';
                }
            } catch (e) {
                console.error('Failed to load state:', e);
            }
            // Always set selectedDate and lastActiveDate to TODAY when launching/reloading the app
            state.selectedDate = todayStr;
            state.lastActiveDate = todayStr;
            state.searchQuery = ''; // Always clean search on load to prevent phantom query bugs
            const validCatIds = new Set(['all', 'favorites', 'custom', 'combos', ...(FOOD_DATABASE.categories ? FOOD_DATABASE.categories.map(c => c.id) : [])]);
            if (!validCatIds.has(state.selectedCategory)) state.selectedCategory = 'all';
            if (!state.activeMeal) state.activeMeal = 'breakfast';
            if (!state.selectedPortion) state.selectedPortion = 1;
            if (!Array.isArray(state.favorites)) state.favorites = [];
            if (!Array.isArray(state.mealCombos) || state.mealCombos.length === 0) state.mealCombos = DEFAULT_MEAL_COMBOS;
            if (!Array.isArray(state.supplementList)) state.supplementList = JSON.parse(JSON.stringify(DEFAULT_SUPPLEMENTS));
            if (!state.dayTypeByDate || typeof state.dayTypeByDate !== 'object') state.dayTypeByDate = {};
            if (!state.supplementsByDate || typeof state.supplementsByDate !== 'object') state.supplementsByDate = {};
            if (!state.bodyTab) state.bodyTab = 'weight';
            if (!state.weightsByDate || typeof state.weightsByDate !== 'object') state.weightsByDate = {};
            if (!state.workoutsByDate || typeof state.workoutsByDate !== 'object') state.workoutsByDate = {};
            if (typeof state.streakDays !== 'number' || state.streakDays < 0) state.streakDays = 0;
            if (!state.prestigeFrame) state.prestigeFrame = 'novice';
            verifyAndSanitizeStreak();
        }

        function saveState() {
            try {
                verifyAndSanitizeStreak();
                localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
                const badge = document.getElementById('saveBadge');
                if (badge) badge.textContent = '✓ บันทึกแล้ว (' + new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ')';
                window.state = state;
                if (window.renderPrestigeFrames) {
                    window.renderPrestigeFrames();
                }
                if (window.triggerCloudSync) {
                    window.triggerCloudSync();
                }
            } catch (e) {
                console.error('Failed to save state:', e);
            }
        }

        // ==========================================
        // 🏆 PRESTIGE AVATAR FRAMES & ANTI-CHEAT ENGINE (Phase 2 & 3)
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

        function calculateVerifiedStreak(logsByDate, todayStr) {
            if (!logsByDate || typeof logsByDate !== 'object') return 0;
            const hasMeals = (d) => Array.isArray(logsByDate[d]) && logsByDate[d].filter(m => m && m.name && String(m.name).trim() !== '').length >= 1;
            
            const today = new Date(todayStr + 'T00:00:00');
            let current = new Date(today);
            let streak = 0;
            
            if (hasMeals(todayStr)) {
                streak = 1;
                while (true) {
                    current.setDate(current.getDate() - 1);
                    const dStr = current.toISOString().split('T')[0];
                    if (hasMeals(dStr)) {
                        streak++;
                    } else {
                        break;
                    }
                }
            } else {
                current.setDate(current.getDate() - 1);
                const yestStr = current.toISOString().split('T')[0];
                if (hasMeals(yestStr)) {
                    streak = 1;
                    while (true) {
                        current.setDate(current.getDate() - 1);
                        const dStr = current.toISOString().split('T')[0];
                        if (hasMeals(dStr)) {
                            streak++;
                        } else {
                            break;
                        }
                    }
                } else {
                    streak = 0;
                }
            }
            return streak;
        }

        function isFrameUnlocked(tierId, verifiedStreak, isVip) {
            const tier = PRESTIGE_TIERS[tierId];
            if (!tier) return false;
            if (tierId === 'novice') return true;
            if (tierId === 'diamond' && isVip) return true;
            return (Number(verifiedStreak) || 0) >= tier.minDays;
        }

        function verifyAndSanitizeStreak() {
            if (typeof state === 'undefined' || !state) return;
            const todayStr = getTodayStr();
            const verified = calculateVerifiedStreak(state.logsByDate, todayStr);
            const claimed = Number(state.streakDays) || 0;
            
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
                state.streakDays = verified;
            } else {
                state.streakDays = verified;
            }
            
            // Verify active prestige frame legality
            if (!PRESTIGE_TIERS[state.prestigeFrame] || !isFrameUnlocked(state.prestigeFrame, state.streakDays, state.isVip)) {
                if (state.prestigeFrame !== 'novice' && window.recordSecurityAuditLog) {
                    window.recordSecurityAuditLog({
                        type: 'ILLEGAL_FRAME_DOWNGRADE',
                        reason: `Active frame '${state.prestigeFrame}' was not legally unlocked by streak (${state.streakDays} days)`,
                        details: { frame: state.prestigeFrame, verifiedStreak: state.streakDays }
                    });
                }
                state.prestigeFrame = 'novice';
            }
        }

        function openPrestigeWardrobeModal() {
            verifyAndSanitizeStreak();
            renderWardrobeModal();
            openModalAnimated('prestigeWardrobeModal');
        }

        function closePrestigeWardrobeModal() {
            closeModalAnimated('prestigeWardrobeModal');
        }

        function closePrestigeWardrobeModalOnBackdrop(e) {
            if (e && e.target && e.target.id === 'prestigeWardrobeModal') {
                closePrestigeWardrobeModal();
            }
        }

        function equipPrestigeFrame(tierId) {
            verifyAndSanitizeStreak();
            const tier = PRESTIGE_TIERS[tierId];
            if (!tier) return;
            const verifiedStreak = calculateVerifiedStreak(state.logsByDate, getTodayStr());
            const unlocked = isFrameUnlocked(tierId, verifiedStreak, state.isVip);
            
            if (!unlocked) {
                if (window.recordSecurityAuditLog) {
                    window.recordSecurityAuditLog({
                        type: 'UNAUTHORIZED_PRESTIGE_EQUIP',
                        reason: `User attempted to equip locked frame '${tierId}' (requires ${tier.minDays} days, user has ${verifiedStreak})`,
                        details: { attemptedFrame: tierId, reqDays: tier.minDays, verifiedStreak, isVip: !!state.isVip }
                    });
                }
                state.prestigeFrame = 'novice';
                saveState();
                renderPrestigeFrames();
                renderWardrobeModal();
                showToast(`⚠️ ยังไม่สามารถสวมใส่ได้ (ต้องการสตรีคต่อเนื่อง ${tier.minDays} วัน)`);
                return;
            }

            state.prestigeFrame = tierId;
            saveState();
            renderPrestigeFrames();
            renderWardrobeModal();
            showToast(`✨ สวมใส่กรอบ ${tier.name} เรียบร้อยแล้ว!`);
        }

        function renderPrestigeFrames() {
            verifyAndSanitizeStreak();
            const activeTier = PRESTIGE_TIERS[state.prestigeFrame] || PRESTIGE_TIERS.novice;
            const streakCount = Number(state.streakDays) || 0;
            const customAvatar = state.userAvatarUrl || '';
            const customName = state.userDisplayName || '';
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
        }

        function renderWardrobeModal() {
            const streakCount = Number(state.streakDays) || 0;
            const streakEl = document.getElementById('wardrobeCurrentStreakText');
            if (streakEl) streakEl.textContent = `${streakCount} วัน`;

            const activeTier = PRESTIGE_TIERS[state.prestigeFrame] || PRESTIGE_TIERS.novice;
            const activeNameEl = document.getElementById('wardrobeActiveFrameName');
            if (activeNameEl) activeNameEl.textContent = `${activeTier.badgeEmoji} ${activeTier.name}`;

            // 1. Profile Customizer Box in Modal
            const previewAvatarImg = document.getElementById('wardrobePreviewAvatarImg');
            const previewAvatarDef = document.getElementById('wardrobePreviewAvatarDefault');
            const previewFrameImg = document.getElementById('wardrobePreviewFrameImg');
            const displayNameInput = document.getElementById('wardrobeDisplayNameInput');
            const btnRemoveAvatar = document.getElementById('btnRemoveCustomAvatar');

            const googlePhoto = (window.currentUser && window.currentUser.photoURL) || '';
            const currentAvatarSrc = state.userAvatarUrl || googlePhoto || '';

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

            if (displayNameInput && state.userDisplayName !== undefined) {
                if (document.activeElement !== displayNameInput) {
                    displayNameInput.value = state.userDisplayName || '';
                }
            }

            if (btnRemoveAvatar) {
                btnRemoveAvatar.classList.toggle('hidden', !state.userAvatarUrl);
            }

            // 2. Tiers Showcase List with Real PNG Frames and Dynamic Animations (Outer Frame Architecture)
            const listEl = document.getElementById('wardrobeTiersList');
            if (!listEl) return;

            const tiers = Object.values(PRESTIGE_TIERS);
            listEl.innerHTML = tiers.map(tier => {
                const isUnlocked = isFrameUnlocked(tier.id, streakCount, state.isVip);
                const isActive = state.prestigeFrame === tier.id;
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
            const file = event.target.files && event.target.files[0];
            if (!file) return;
            if (!file.type.startsWith('image/')) {
                showToast('⚠️ กรุณาเลือกไฟล์รูปภาพ');
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
                    
                    state.userAvatarUrl = dataUrl;
                    saveState();
                    renderPrestigeFrames();
                    renderWardrobeModal();
                    showToast('📷 เปลี่ยนรูปโปรไฟล์สำเร็จแล้ว!');
                    
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
            const input = document.getElementById('wardrobeDisplayNameInput');
            if (!input) return;
            const newName = input.value.trim();
            if (newName.length > 30) {
                showToast('⚠️ ชื่อต้องมีความยาวไม่เกิน 30 ตัวอักษร');
                return;
            }
            state.userDisplayName = newName;
            saveState();
            renderPrestigeFrames();
            renderWardrobeModal();
            showToast('✏️ บันทึกชื่อแสดงผลเรียบร้อยแล้ว!');
            
            if (window.syncProfileDataToCloud) {
                window.syncProfileDataToCloud();
            }
        }

        function removeCustomAvatarPhoto() {
            state.userAvatarUrl = '';
            saveState();
            
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
            showToast('ลบรูปภาพแล้ว กลับไปใช้รูปเริ่มต้น');
            
            if (window.syncProfileDataToCloud) {
                window.syncProfileDataToCloud();
            }
        }

        function showToast(msg) {
            const container = document.getElementById('toastContainer');
            const el = document.createElement('div');
            el.className = 'bg-slate-900 dark:bg-emerald-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg border border-emerald-400/30 animate-pop';
            el.textContent = msg;
            container.appendChild(el);
            setTimeout(() => { el.remove(); }, 2200);
        }

        function showMiniLoader(message = 'กำลังประมวลผล...') {
            const loader = document.getElementById('novaMiniLoader');
            const textEl = document.getElementById('miniLoaderText');
            if (!loader) return;
            if (textEl && message) textEl.textContent = message;
            loader.classList.remove('hidden');
            requestAnimationFrame(() => {
                loader.classList.remove('opacity-0');
                loader.classList.add('opacity-100');
            });
        }

        function hideMiniLoader() {
            const loader = document.getElementById('novaMiniLoader');
            if (!loader || loader.classList.contains('hidden')) return;
            loader.classList.remove('opacity-100');
            loader.classList.add('opacity-0');
            setTimeout(() => {
                if (loader.classList.contains('opacity-0')) {
                    loader.classList.add('hidden');
                }
            }, 250);
        }

        // NovaFit Chef App Preloader (v5.9.7)
        const PRELOADER_PHRASES = [
            '🍳 กำลังอุ่นกระทะและเตรียมสูตรอาหาร...',
            '🥑 กำลังจัดสรรคาร์บ โปรตีน ไขมัน ให้เป๊ะ...',
            '💪 กำลังตวงโปรตีนให้กล้ามแน่นๆ...',
            '💧 กำลังเตรียมน้ำดื่มเติมความสดชื่น...',
            '✨ พร้อมเสิร์ฟสุขภาพดีให้คุณแล้ว!'
        ];
        let _preloaderPhraseIndex = 0;
        let _preloaderTimer = null;
        let _preloaderDismissed = false;

        function initAppPreloader() {
            const phraseEl = document.getElementById('preloaderPhrase');
            if (phraseEl) {
                _preloaderTimer = setInterval(() => {
                    if (_preloaderDismissed) return;
                    _preloaderPhraseIndex = (_preloaderPhraseIndex + 1) % PRELOADER_PHRASES.length;
                    phraseEl.textContent = PRELOADER_PHRASES[_preloaderPhraseIndex];
                }, 1800);
            }
            // Hard safety fallback: automatically dismiss after 4 seconds
            setTimeout(() => {
                dismissAppPreloader();
            }, 4000);
        }

        function dismissAppPreloader() {
            if (_preloaderDismissed) return;
            _preloaderDismissed = true;
            if (_preloaderTimer) {
                clearInterval(_preloaderTimer);
                _preloaderTimer = null;
            }
            const preloader = document.getElementById('novaAppPreloader');
            if (!preloader) return;
            preloader.style.opacity = '0';
            preloader.style.pointerEvents = 'none';
            preloader.style.transform = 'scale(0.97)';
            setTimeout(() => {
                preloader.style.display = 'none';
                preloader.classList.add('hidden');
            }, 520);
        }

        // ==========================================
        // Web Push Notifications & FCM Engine (v5.9.9)
        // ==========================================
        function getPushPermissionState() {
            if (!('Notification' in window)) return 'unsupported';
            return Notification.permission;
        }

        function updatePushStatusUI() {
            const perm = getPushPermissionState();
            const badge = document.getElementById('pushStatusBadge');
            const btn = document.getElementById('btnTogglePush');

            if (badge) {
                if (perm === 'granted') {
                    badge.className = 'text-xs px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold';
                    badge.textContent = '✓ เปิดใช้งานแล้ว';
                } else if (perm === 'denied') {
                    badge.className = 'text-xs px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold';
                    badge.textContent = '✕ ปิดกั้นในเบราว์เซอร์';
                } else if (perm === 'unsupported') {
                    badge.className = 'text-xs px-2.5 py-1 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 font-bold';
                    badge.textContent = 'ไม่รองรับ';
                } else {
                    badge.className = 'text-xs px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold';
                    badge.textContent = 'ยังไม่ได้เปิด';
                }
            }

            if (btn) {
                if (perm === 'granted') {
                    btn.textContent = '🔔 ส่งข้อความทดสอบ';
                    btn.className = 'px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs shadow-xs transition active:scale-95 cursor-pointer';
                } else {
                    btn.textContent = 'เปิดแจ้งเตือน';
                    btn.className = 'px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-xs transition active:scale-95 cursor-pointer';
                }
            }

            const btnWatch = document.getElementById('btnTestWatchDelay');
            if (btnWatch) {
                btnWatch.classList.toggle('hidden', perm !== 'granted');
            }

            if (perm === 'granted' || perm === 'denied') {
                dismissPushPrompt(false);
            }
        }

        async function requestPushPermission(isUserAction = true) {
            if (!('Notification' in window)) {
                if (isUserAction) alert('เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน Web Push ครับ');
                return false;
            }

            try {
                const permission = await Notification.requestPermission();
                updatePushStatusUI();

                if (permission === 'granted') {
                    dismissPushPrompt(false);
                    if (isUserAction) {
                        showToast('🎉 เปิดการแจ้งเตือนสำเร็จ! รองรับสั่นเตือนบน Apple Watch & สมาร์ตวอทช์');
                    }
                    if (window.syncPushTokenToCloud) {
                        window.syncPushTokenToCloud();
                    }
                    return true;
                } else if (permission === 'denied') {
                    dismissPushPrompt(true);
                    if (isUserAction) {
                        alert('คุณได้ปฏิเสธการแจ้งเตือนไว้ สามารถไปเปิดใหม่ได้ที่ การตั้งค่าเบราว์เซอร์ > การแจ้งเตือน ครับ');
                    }
                    return false;
                }
            } catch (err) {
                console.warn('Push permission request error:', err);
                return false;
            }
        }

        function requestPushPermissionFromBanner() {
            requestPushPermission(true);
        }

        function dismissPushPrompt(recordDismiss = true) {
            const banner = document.getElementById('pushPromptBanner');
            if (!banner) return;
            banner.classList.add('translate-y-20', 'opacity-0');
            setTimeout(() => {
                banner.classList.add('hidden');
            }, 500);
            if (recordDismiss) {
                try {
                    localStorage.setItem('novafit_push_dismissed', Date.now().toString());
                } catch (e) {}
            }
        }

        function checkPushPromptEligibility() {
            if (!('Notification' in window)) return;
            if (Notification.permission !== 'default') return;

            const lastDismiss = localStorage.getItem('novafit_push_dismissed');
            if (lastDismiss) {
                const daysAgo = (Date.now() - parseInt(lastDismiss, 10)) / (1000 * 60 * 60 * 24);
                if (daysAgo < 5) return;
            }

            setTimeout(() => {
                const banner = document.getElementById('pushPromptBanner');
                if (banner && Notification.permission === 'default') {
                    banner.classList.remove('hidden');
                    requestAnimationFrame(() => {
                        banner.classList.remove('translate-y-20', 'opacity-0');
                    });
                }
            }, 3000);
        }

        async function testLocalNotification(customTitle, customBody, delaySeconds = 0) {
            const title = customTitle || 'NovaFit Pro 🥑';
            const body = customBody || '🔔 ทดสอบการแจ้งเตือน! พร้อมสั่นเตือนบนข้อมือ Apple Watch & สมาร์ตวอทช์ของคุณ';

            if (delaySeconds > 0) {
                if (window.showToast) {
                    window.showToast(`⏱️ จะส่งแจ้งเตือนใน ${delaySeconds} วิ... รีบล็อคหน้าจอเพื่อดูบน Apple Watch!`, 4000);
                }
                await new Promise(r => setTimeout(r, delaySeconds * 1000));
            }

            const options = {
                body: body,
                icon: 'icon-192.png',
                badge: 'favicon-32x32.png',
                vibrate: [120, 60, 120],
                tag: 'novafit-notification-' + Date.now(),
                renotify: true,
                data: { url: './' }
            };

            // Priority 1: Service Worker Registration showNotification (Works on iOS 16.4+ PWA & Android)
            if ('serviceWorker' in navigator) {
                try {
                    const reg = await navigator.serviceWorker.ready;
                    if (reg && reg.showNotification) {
                        await reg.showNotification(title, options);
                        console.log('✅ ServiceWorker showNotification delivered:', title);
                        return;
                    }
                } catch (err) {
                    console.warn('ServiceWorker showNotification failed:', err);
                }
            }

            // Priority 2: Fallback for Desktop browsers supporting new Notification() (Never call on iOS)
            const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
            if (!isIos && 'Notification' in window && Notification.permission === 'granted') {
                try {
                    new Notification(title, {
                        body: body,
                        icon: 'icon-192.png'
                    });
                    console.log('✅ Desktop new Notification delivered:', title);
                } catch (err) {
                    console.warn('Desktop new Notification failed:', err);
                }
            }
        }

        function togglePushNotificationPermission() {
            const perm = getPushPermissionState();
            if (perm === 'granted') {
                testLocalNotification();
                showToast('🔔 ส่งข้อความทดสอบไปยังเครื่องของคุณแล้ว!');
            } else {
                requestPushPermission(true);
            }
        }

        function applyTheme() {
            const html = document.documentElement;
            if (state.theme === 'dark') {
                html.classList.add('dark');
                document.getElementById('themeIcon').textContent = '☀️';
            } else {
                html.classList.remove('dark');
                document.getElementById('themeIcon').textContent = '🌙';
            }
        }

        function toggleTheme() {
            state.theme = state.theme === 'dark' ? 'light' : 'dark';
            applyTheme();
            saveState();
        }

        function toggleAllSettings() {
            state.settingsCollapsed = !state.settingsCollapsed;
            renderSettingsCollapseState();
            clearTimeout(window._settingsSaveTimer);
            window._settingsSaveTimer = setTimeout(() => {
                try {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
                } catch (e) {}
            }, 100);
        }

        function renderSettingsCollapseState() {
            const body = document.getElementById('settingsCollapseBody');
            const icon = document.getElementById('toggleSettingsIcon');
            const text = document.getElementById('toggleSettingsText');
            const p = state.profile;
            const bmi = (p.weight / Math.pow(p.height / 100, 2)).toFixed(1);
            const goalLabel = p.goalDiff < 0 ? `ลดไขมัน (${p.goalDiff}%)` : p.goalDiff > 0 ? `เพิ่มกล้าม (+${p.goalDiff}%)` : 'รักษาน้ำหนัก (0%)';

            const compactPills = document.getElementById('compactProfilePills');
            if (compactPills) {
                compactPills.innerHTML = `
                    <span class="px-2.5 py-1 rounded-lg bg-slate-200/70 dark:bg-slate-700 font-medium">${p.gender === 'male' ? '♂ ชาย' : '♀ หญิง'} ${p.age} ปี</span>
                    <span class="px-2.5 py-1 rounded-lg bg-slate-200/70 dark:bg-slate-700 font-medium">นน. ${p.weight} กก. / สูง ${p.height} ซม. (BMI ${bmi})</span>
                    <span class="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold">${goalLabel}</span>
                    <span class="px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 font-semibold">Macro ${p.macros.p}/${p.macros.c}/${p.macros.f}%</span>
                `;
            }

            if (body) {
                body.classList.remove('hidden');
            }
            if (icon) icon.textContent = '⚙️';
            if (text) text.textContent = 'ตั้งค่าข้อมูลร่างกาย & สัดส่วน Macro';
        }

        function toggleToolsMenu() {
            const menu = document.getElementById('toolsDropdownMenu');
            const userMenu = document.getElementById('userDropdown');
            if (userMenu) userMenu.classList.add('hidden');
            if (menu) menu.classList.toggle('hidden');
        }

        let _lastCardToggleTimes = {};
        function toggleCardSection(sectionId) {
            // Food search is permanently open for instant access & zero-freeze on mobile
            if (sectionId === 'section_food_search') return;

            const now = Date.now();
            if (_lastCardToggleTimes[sectionId] && now - _lastCardToggleTimes[sectionId] < 150) return;
            _lastCardToggleTimes[sectionId] = now;

            const body = document.getElementById('body_' + sectionId);
            const icon = document.getElementById('icon_' + sectionId);
            if (!body) return;

            // Determine visibility directly from DOM to prevent state/DOM desync
            const isCurrentlyHidden = body.classList.contains('hidden') || body.classList.contains('is-collapsed');
            const willBeCollapsed = !isCurrentlyHidden;

            if (!state.collapsedSections) state.collapsedSections = {};
            state.collapsedSections[sectionId] = willBeCollapsed;

            // Target card container for viewport position preservation
            const cardId = sectionId.startsWith('section_') ? 'card_' + sectionId.replace('section_', '') : sectionId;
            const card = document.getElementById(cardId) || body.parentElement;

            let cardRectBefore = null;
            if (card) {
                cardRectBefore = card.getBoundingClientRect();
            }

            body.classList.add('accordion-section');
            body.classList.toggle('hidden', willBeCollapsed);
            body.classList.toggle('is-collapsed', willBeCollapsed);

            if (icon) {
                icon.classList.add('accordion-chevron');
                icon.classList.toggle('icon-collapsed', willBeCollapsed);
            }

            // Mobile iOS Safari Viewport & Overscroll Clamping Protection
            // When collapsing large sections, document height shrinks rapidly.
            // Clamping scroll prevents WebKit touch deadlock & overscroll bounce freeze.
            if (willBeCollapsed && card) {
                const maxScrollY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
                if (cardRectBefore && cardRectBefore.top < 0) {
                    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                } else if (window.scrollY > maxScrollY) {
                    window.scrollTo({ top: maxScrollY, behavior: 'instant' });
                }
            }

            // Debounced non-blocking localStorage save
            clearTimeout(window._collapseSaveTimer);
            window._collapseSaveTimer = setTimeout(() => {
                try {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
                } catch (e) {}
            }, 100);
        }

        function renderAllSectionCollapses() {
            if (!state.collapsedSections) state.collapsedSections = {};
            // Food search is permanently open and non-collapsible for maximum stability & zero-freeze on mobile
            if (state.collapsedSections['section_food_search']) {
                delete state.collapsedSections['section_food_search'];
            }
            const foodBody = document.getElementById('body_section_food_search');
            if (foodBody) {
                foodBody.classList.remove('hidden', 'is-collapsed');
            }

            const sections = [
                'section_water',
                'section_meals',
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
                    body.classList.add('accordion-section');
                    body.classList.toggle('hidden', isCollapsed);
                    body.classList.toggle('is-collapsed', isCollapsed);
                }
                if (icon) {
                    icon.classList.add('accordion-chevron');
                    icon.classList.toggle('icon-collapsed', isCollapsed);
                }
            });
        }

        function toggleCustomForm() {
            state.customFormOpen = !state.customFormOpen;
            const body = document.getElementById('customFoodFormBody');
            const icon = document.getElementById('customFormToggleIcon');
            if (state.customFormOpen) {
                body.classList.remove('hidden');
                icon.textContent = '▲ ซ่อนฟอร์ม';
            } else {
                body.classList.add('hidden');
                icon.textContent = '▼ เปิดฟอร์ม';
            }
        }

        function getEffectiveWeight(dateStr) {
            const d = dateStr || state.selectedDate || getTodayStr();
            if (state.weightsByDate && state.weightsByDate[d] !== undefined && state.weightsByDate[d] !== null && Number(state.weightsByDate[d]) > 0) {
                return { weight: Number(state.weightsByDate[d]), isExact: true, sourceDate: d };
            }
            if (state.weightsByDate) {
                const pastDates = Object.keys(state.weightsByDate)
                    .filter(x => x <= d && Number(state.weightsByDate[x]) > 0)
                    .sort();
                if (pastDates.length > 0) {
                    const lastDate = pastDates[pastDates.length - 1];
                    return { weight: Number(state.weightsByDate[lastDate]), isExact: false, sourceDate: lastDate };
                }
                const allDates = Object.keys(state.weightsByDate)
                    .filter(x => Number(state.weightsByDate[x]) > 0)
                    .sort();
                if (allDates.length > 0) {
                    return { weight: Number(state.weightsByDate[allDates[0]]), isExact: false, sourceDate: allDates[0] };
                }
            }
            return { weight: Number(state.profile.weight) || 70, isExact: false, sourceDate: 'profile' };
        }

        // Calculate BMR, TDEE, Macros & Daily Water Target (with Carb Cycling)
        function getCalculatedTargets(dateStr) {
            const effectiveDate = dateStr || state.selectedDate || getTodayStr();
            const { gender, age, height, activity, goalDiff, macros } = state.profile;
            const weightInfo = getEffectiveWeight(effectiveDate);
            const weight = weightInfo.weight;

            const s = gender === 'male' ? 5 : -161;
            const bmr = Math.round((10 * weight) + (6.25 * height) - (5 * age) + s);
            const tdee = Math.round(bmr * activity);
            let targetCal = Math.round(tdee * (1 + goalDiff / 100));

            // Training Day vs Rest Day (Carb Cycling)
            const dayType = (state.dayTypeByDate && state.dayTypeByDate[effectiveDate]) || 'training';
            let pCal = Math.round(targetCal * (macros.p / 100));
            let cCal = Math.round(targetCal * (macros.c / 100));
            let fCal = Math.round(targetCal * (macros.f / 100));

            if (dayType === 'rest') {
                // Rest Day: preserve 100% protein for muscle recovery, reduce carbs by 15%, calories drop accordingly
                const oldCCal = cCal;
                cCal = Math.round(cCal * 0.85);
                const calDiff = oldCCal - cCal;
                targetCal = targetCal - calDiff;
            }

            // Water calculation: 35ml per kg of body weight + bonus for workout activity
            const activityBonusMl = activity >= 1.725 ? 500 : activity >= 1.55 ? 300 : 0;
            const rawWaterMl = Math.round(weight * 35) + activityBonusMl;
            const waterTargetGlasses = Math.max(6, Math.round(rawWaterMl / 250));
            const waterTargetMl = waterTargetGlasses * 250;

            return {
                weight,
                weightInfo,
                bmr,
                tdee,
                targetCal,
                dayType,
                isRestDay: dayType === 'rest',
                pGram: Math.round(pCal / 4),
                cGram: Math.round(cCal / 4),
                fGram: Math.round(fCal / 9),
                pCal, cCal, fCal,
                waterTargetGlasses,
                waterTargetMl,
                activityBonusMl
            };
        }

        function setDayType(type) {
            const dStr = state.selectedDate;
            if (!state.dayTypeByDate) state.dayTypeByDate = {};
            state.dayTypeByDate[dStr] = type;
            saveState();
            renderAll();
            if (type === 'rest') {
                showToast('🛋️ สลับเป็นวันพัก (ลดคาร์บ 15% • คงโปรตีนซ่อมแซมกล้ามเนื้อ)');
            } else {
                showToast('🏋️ สลับเป็นวันซ้อม (เป้าแคลอรีและคาร์โบไฮเดรตมาตรฐาน)');
            }
        }

        function renderAll() {
            applyTheme();
            renderSoundButton();
            renderSettingsCollapseState();
            const p = state.profile;

            const activeBtn = 'bg-emerald-500 text-white border-emerald-500 shadow-sm font-bold';
            const inactiveBtn = 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-emerald-500/50';

            document.getElementById('btnMale').className = `py-1.5 rounded-xl text-xs border transition ${p.gender === 'male' ? activeBtn : inactiveBtn}`;
            document.getElementById('btnFemale').className = `py-1.5 rounded-xl text-xs border transition ${p.gender === 'female' ? activeBtn : inactiveBtn}`;

            document.getElementById('goalCut').className = `py-2 px-2 rounded-xl text-xs border transition ${p.goalDiff === -20 ? activeBtn : inactiveBtn}`;
            document.getElementById('goalMaintain').className = `py-2 px-2 rounded-xl text-xs border transition ${p.goalDiff === 0 ? activeBtn : inactiveBtn}`;
            document.getElementById('goalBulk').className = `py-2 px-2 rounded-xl text-xs border transition ${p.goalDiff === 15 ? activeBtn : inactiveBtn}`;

            const isBal = p.macros.p === 30 && p.macros.c === 40 && p.macros.f === 30;
            const isMus = p.macros.p === 35 && p.macros.c === 40 && p.macros.f === 25;
            const isLow = p.macros.p === 40 && p.macros.c === 20 && p.macros.f === 40;
            document.getElementById('macroPresetBalanced').className = `text-xs py-1.5 px-2 rounded-lg border transition ${isBal ? activeBtn : inactiveBtn}`;
            document.getElementById('macroPresetMuscle').className = `text-xs py-1.5 px-2 rounded-lg border transition ${isMus ? activeBtn : inactiveBtn}`;
            document.getElementById('macroPresetLowCarb').className = `text-xs py-1.5 px-2 rounded-lg border transition ${isLow ? activeBtn : inactiveBtn}`;
            document.getElementById('macroPreset2g').className = `text-xs py-1.5 px-2 rounded-lg border transition ${(!isBal && !isMus && !isLow) ? activeBtn : inactiveBtn}`;

            if (document.activeElement !== document.getElementById('numAge')) document.getElementById('numAge').value = p.age;
            document.getElementById('rangeAge').value = p.age;
            if (document.activeElement !== document.getElementById('numWeight')) document.getElementById('numWeight').value = p.weight;
            document.getElementById('rangeWeight').value = p.weight;
            if (document.activeElement !== document.getElementById('numHeight')) document.getElementById('numHeight').value = p.height;
            document.getElementById('rangeHeight').value = p.height;
            document.getElementById('selActivity').value = p.activity;

            const t = getCalculatedTargets();
            const curWeight = t.weight;
            const bmi = (curWeight / Math.pow(p.height / 100, 2)).toFixed(1);
            document.getElementById('bmiBadge').textContent = `BMI: ${bmi}`;

            document.getElementById('rangeGoalDiff').value = p.goalDiff;
            const sign = p.goalDiff > 0 ? `+${p.goalDiff}%` : `${p.goalDiff}%`;
            document.getElementById('lblCalDiff').textContent = `${sign}`;

            document.getElementById('rangeP').value = p.macros.p;
            document.getElementById('rangeC').value = p.macros.c;
            document.getElementById('rangeF').value = p.macros.f;
            document.getElementById('lblPctP').textContent = `${p.macros.p}%`;
            document.getElementById('lblPctC').textContent = `${p.macros.c}%`;
            document.getElementById('lblPctF').textContent = `${p.macros.f}%`;

            document.getElementById('resBMR').textContent = `${t.bmr.toLocaleString()} kcal`;
            document.getElementById('resTDEE').textContent = `${t.tdee.toLocaleString()} kcal`;
            document.getElementById('resTargetCal').textContent = `${t.targetCal.toLocaleString()} kcal`;

            const dailyDiffKcal = t.targetCal - t.tdee;
            const kgPerWeek = ((dailyDiffKcal * 7) / 7700).toFixed(2);
            document.getElementById('lblWeightTrend').textContent = dailyDiffKcal === 0
                ? 'แนวโน้มน้ำหนัก: คงที่'
                : `แนวโน้มน้ำหนัก: ${dailyDiffKcal > 0 ? '+' : ''}${kgPerWeek} กก./สัปดาห์ (${dailyDiffKcal > 0 ? '+' : ''}${dailyDiffKcal} kcal/วัน)`;

            document.getElementById('donutP').setAttribute('stroke-dasharray', `${p.macros.p} ${100 - p.macros.p}`);
            document.getElementById('donutP').setAttribute('stroke-dashoffset', '0');
            document.getElementById('donutC').setAttribute('stroke-dasharray', `${p.macros.c} ${100 - p.macros.c}`);
            document.getElementById('donutC').setAttribute('stroke-dashoffset', `-${p.macros.p}`);
            document.getElementById('donutF').setAttribute('stroke-dasharray', `${p.macros.f} ${100 - p.macros.f}`);
            document.getElementById('donutF').setAttribute('stroke-dashoffset', `-${p.macros.p + p.macros.c}`);

            document.getElementById('targetPGram').textContent = `${t.pGram}g`;
            document.getElementById('targetPMeta').textContent = `${t.pCal} kcal (${(t.pGram / curWeight).toFixed(1)} g/kg)`;
            document.getElementById('targetCGram').textContent = `${t.cGram}g`;
            document.getElementById('targetCMeta').textContent = `${t.cCal} kcal (${(t.cGram / curWeight).toFixed(1)} g/kg)`;
            document.getElementById('targetFGram').textContent = `${t.fGram}g`;
            document.getElementById('targetFMeta').textContent = `${t.fCal} kcal (${(t.fGram / curWeight).toFixed(1)} g/kg)`;

            // Update Day Type (Training vs Rest) buttons and badge
            const dayType = t.dayType || 'training';
            const btnTraining = document.getElementById('btnDayTraining');
            const btnRest = document.getElementById('btnDayRest');
            const heroBadge = document.getElementById('heroDayTypeBadge');

            if (btnTraining && btnRest) {
                if (dayType === 'rest') {
                    btnTraining.className = 'px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200';
                    btnRest.className = 'px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 shadow-xs bg-indigo-500 text-white';
                } else {
                    btnTraining.className = 'px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 shadow-xs bg-emerald-500 text-white';
                    btnRest.className = 'px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200';
                }
            }

            if (heroBadge) {
                if (dayType === 'rest') {
                    heroBadge.className = 'text-xs px-2.5 py-0.5 rounded-full font-bold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30';
                    heroBadge.innerHTML = '🛋️ วันพัก (Rest Day • คาร์บ -15%)';
                } else {
                    heroBadge.className = 'text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30';
                    heroBadge.innerHTML = '🏋️ วันซ้อม (Training Day • คาร์บปกติ)';
                }
            }

            renderMealSelector();
            renderDateTrackerAndRecommendations(t, false);
            renderFoodDatabaseExplorer();
            renderSupplements();
            renderFastingSection();
            if (window.renderDailyHealthTip) window.renderDailyHealthTip();
            if (window.checkDailyTipNotification) window.checkDailyTipNotification();
            updateVersionBadges();
            renderPrestigeFrames();
            renderAllSectionCollapses();
            syncResponsiveLayout();
            if (typeof triggerLivingCompanionCheck === 'function') {
                triggerLivingCompanionCheck(2000);
            }
        }

        function syncResponsiveLayout() {
            const isDesktop = window.innerWidth >= 1024;
            const colLeft = document.getElementById('colDesktopLeft');
            const colRight = document.getElementById('colDesktopRight');
            if (!colLeft || !colRight) return;

            const cardFood = document.getElementById('card_food_search');
            const cardMeals = document.getElementById('card_meals');
            const cardAnalytics = document.getElementById('card_analytics');
            const cardRec = document.getElementById('card_recommendations');
            const cardWater = document.getElementById('card_water');

            if (!cardFood || !cardMeals || !cardAnalytics || !cardRec) return;

            if (isDesktop) {
                if (cardFood.parentElement !== colRight) {
                    colRight.appendChild(cardFood);
                    colRight.appendChild(cardMeals);
                    colRight.appendChild(cardAnalytics);
                    colRight.appendChild(cardRec);
                }
            } else {
                if (cardFood.parentElement !== colLeft) {
                    if (cardWater) {
                        colLeft.insertBefore(cardFood, cardWater);
                        colLeft.insertBefore(cardMeals, cardWater);
                    } else {
                        colLeft.appendChild(cardFood);
                        colLeft.appendChild(cardMeals);
                    }
                    colLeft.appendChild(cardAnalytics);
                    colLeft.appendChild(cardRec);
                }
            }
        }

        function setActiveMeal(mealId) {
            if (MEAL_CONFIG[mealId]) {
                state.activeMeal = mealId;
                saveState();
                renderMealSelector();
                renderFoodDatabaseExplorer();
                const dStr = state.selectedDate;
                const targets = getCalculatedTargets();
                renderDateTrackerAndRecommendations(targets, false);
            }
        }

        function setSelectedPortion(portion) {
            state.selectedPortion = Number(portion) || 1;
            saveState();
            renderMealSelector();
        }

        function toggleFavorite(foodName, event) {
            if (event) {
                event.stopPropagation();
                event.preventDefault();
            }
            if (!Array.isArray(state.favorites)) state.favorites = [];
            const idx = state.favorites.indexOf(foodName);
            if (idx >= 0) {
                state.favorites.splice(idx, 1);
                showToast(`นำ "${foodName}" ออกจากเมนูโปรดแล้ว`);
            } else {
                state.favorites.push(foodName);
                showToast(`⭐ บันทึก "${foodName}" เข้าเมนูโปรดแล้ว`);
            }
            saveState();
            renderFoodDatabaseExplorer();
        }

        function renderMealSelector() {
            const mealBar = document.getElementById('activeMealSelectorBar');
            const portionBar = document.getElementById('portionSelectorBar');
            if (!mealBar || !portionBar) return;

            const meals = [
                { id: 'breakfast', name: 'เช้า', fullName: 'มื้อเช้า', icon: '🌅' },
                { id: 'lunch', name: 'เที่ยง', fullName: 'มื้อเที่ยง', icon: '☀️' },
                { id: 'dinner', name: 'เย็น', fullName: 'มื้อเย็น', icon: '🌙' },
                { id: 'snack', name: 'ของว่าง', fullName: 'ของว่าง', icon: '🍎' }
            ];

            mealBar.innerHTML = meals.map(m => {
                const isActive = state.activeMeal === m.id;
                return `
                    <button type="button" onclick="setActiveMeal('${m.id}')"
                        class="w-full justify-center px-1 sm:px-2.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1 truncate ${isActive
                        ? 'bg-emerald-500 text-white shadow-sm ring-2 ring-emerald-400/50 font-bold'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-emerald-500/40'
                    }">
                        <span class="text-xs shrink-0">${m.icon}</span>
                        <span class="sm:hidden truncate">${m.name}</span>
                        <span class="hidden sm:inline truncate">${m.fullName}</span>
                    </button>
                `;
            }).join('');

            const portions = [
                { val: 0.5, label: '0.5x' },
                { val: 1.0, label: '1x' },
                { val: 1.5, label: '1.5x' },
                { val: 2.0, label: '2x' }
            ];

            portionBar.innerHTML = portions.map(p => {
                const isActive = Number(state.selectedPortion) === p.val;
                return `
                    <button type="button" onclick="setSelectedPortion(${p.val})"
                        class="px-2 sm:px-2.5 py-1 rounded-lg text-xs font-semibold transition text-center ${isActive
                        ? 'bg-teal-500 text-white shadow-sm ring-2 ring-teal-400/50 font-bold'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-teal-500/40'
                    }">
                        ${p.label}
                    </button>
                `;
            }).join('');
        }

        function setGender(g) { state.profile.gender = g; saveState(); renderAll(); }
        function syncProfileInput(field, val) {
            const num = parseFloat(val);
            if (!isNaN(num)) {
                state.profile[field] = num;
                saveState();
                renderAll();
            }
        }
        function updateActivity(val) { state.profile.activity = parseFloat(val); saveState(); renderAll(); }
        function setGoalPreset(diff) { state.profile.goalDiff = diff; saveState(); renderAll(); }
        function updateGoalDiff(val) { state.profile.goalDiff = parseInt(val, 10); saveState(); renderAll(); }

        function setMacroPreset(p, c, f) {
            state.profile.macros = { p, c, f };
            saveState();
            renderAll();
        }

        function setProtein2gPerKg() {
            const t = getCalculatedTargets();
            const targetPGram = Math.round((t.weight || state.profile.weight) * 2);
            let pPct = Math.round(((targetPGram * 4) / t.targetCal) * 100);
            pPct = Math.min(60, Math.max(15, pPct));
            const rem = 100 - pPct;
            const fPct = Math.max(15, Math.round(rem * 0.4));
            const cPct = 100 - pPct - fPct;
            state.profile.macros = { p: pPct, c: cPct, f: fPct };
            saveState();
            renderAll();
        }

        function adjustMacros(changed, newVal) {
            newVal = parseInt(newVal, 10);
            const m = { ...state.profile.macros };
            m[changed] = newVal;
            const others = ['p', 'c', 'f'].filter(k => k !== changed);
            const rem = 100 - newVal;
            const sumOthers = m[others[0]] + m[others[1]];
            if (sumOthers === 0) {
                m[others[0]] = Math.floor(rem / 2);
                m[others[1]] = rem - m[others[0]];
            } else {
                m[others[0]] = Math.max(5, Math.round((m[others[0]] / sumOthers) * rem));
                m[others[1]] = Math.max(5, 100 - newVal - m[others[0]]);
                m[others[0]] = 100 - newVal - m[others[1]];
            }
            state.profile.macros = m;
            saveState();
            renderAll();
        }

        function selectCategory(catId) {
            state.selectedCategory = catId;
            // If user explicitly clicks a category tab while a search query was active, clear search so they view that category normally
            if (state.searchQuery && catId !== 'all') {
                state.searchQuery = '';
                state._prevCategoryBeforeSearch = null;
                const input = document.getElementById('foodSearchInput');
                if (input) input.value = '';
                const btnClear = document.getElementById('btnClearSearch');
                if (btnClear) btnClear.classList.add('hidden');
            }
            renderFoodDatabaseExplorer();
        }

        function onSearchFood(q) {
            state.searchQuery = (q || '').trim().toLowerCase();
            const btnClear = document.getElementById('btnClearSearch');
            if (btnClear) btnClear.classList.toggle('hidden', !state.searchQuery);
            // Universal Search: When user starts searching, automatically expand view across ALL categories
            if (state.searchQuery) {
                if (!state._prevCategoryBeforeSearch) {
                    state._prevCategoryBeforeSearch = state.selectedCategory || 'all';
                }
                state.selectedCategory = 'all';
            } else if (state._prevCategoryBeforeSearch) {
                state.selectedCategory = state._prevCategoryBeforeSearch;
                state._prevCategoryBeforeSearch = null;
            }
            renderFoodDatabaseExplorer();
        }

        function clearFoodSearch() {
            state.searchQuery = '';
            const input = document.getElementById('foodSearchInput');
            if (input) input.value = '';
            const btnClear = document.getElementById('btnClearSearch');
            if (btnClear) btnClear.classList.add('hidden');
            if (state._prevCategoryBeforeSearch) {
                state.selectedCategory = state._prevCategoryBeforeSearch;
                state._prevCategoryBeforeSearch = null;
            }
            renderFoodDatabaseExplorer();
        }

        function getSelectedFoodCountMap() {
            const meals = state.logsByDate[state.selectedDate] || [];
            const map = {};
            meals.forEach(m => {
                map[m.name] = (map[m.name] || 0) + 1;
            });
            return map;
        }


        // ==========================================
        // UNIFIED CONFIRMATION DIALOG (v5.8.2)
        // ==========================================
        let _confirmDialogCallback = null;

        function showConfirmDialog(options) {
            if (!options) return;

            // Automated test environment compatibility (e.g. window.confirm = () => true)
            if (typeof window.confirm === 'function' && window.confirm.toString().indexOf('[native code]') === -1) {
                const approved = window.confirm(options.message || options.title || 'ยืนยัน?');
                if (approved && typeof options.onConfirm === 'function') {
                    options.onConfirm();
                } else if (!approved && typeof options.onCancel === 'function') {
                    options.onCancel();
                }
                return;
            }

            const modal = document.getElementById('globalConfirmModal');
            if (!modal) {
                if (window.confirm(options.message || options.title || 'ยืนยัน?')) {
                    if (typeof options.onConfirm === 'function') options.onConfirm();
                }
                return;
            }

            const iconEl = document.getElementById('confirmModalIcon');
            const iconBg = document.getElementById('confirmModalIconBg');
            const titleEl = document.getElementById('confirmModalTitle');
            const msgEl = document.getElementById('confirmModalMessage');
            const actionBtn = document.getElementById('btnConfirmAction');
            const cancelBtn = document.getElementById('btnConfirmCancel');

            if (iconEl) iconEl.textContent = options.icon || '🗑️';
            if (iconBg) {
                iconBg.className = options.iconBgClass || 'w-14 h-14 mx-auto rounded-2xl bg-rose-500/15 text-rose-500 flex items-center justify-center text-3xl shadow-xs';
            }
            if (titleEl) titleEl.textContent = options.title || 'ยืนยันการทำรายการ';
            if (msgEl) msgEl.textContent = options.message || 'คุณแน่ใจหรือไม่ว่าต้องการดำเนินการนี้?';
            if (cancelBtn) cancelBtn.textContent = options.cancelText || 'ยกเลิก';

            if (actionBtn) {
                actionBtn.textContent = options.confirmText || 'ยืนยันการลบ';
                actionBtn.className = options.confirmClass || 'flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition cursor-pointer';
            }

            _confirmDialogCallback = options.onConfirm || null;
            openModalAnimated('globalConfirmModal');
        }

        function closeConfirmDialog(confirmed = false) {
            closeModalAnimated('globalConfirmModal');
            if (confirmed && typeof _confirmDialogCallback === 'function') {
                const cb = _confirmDialogCallback;
                _confirmDialogCallback = null;
                cb();
            } else {
                _confirmDialogCallback = null;
            }
        }

        function deleteCustomPreset(name, event) {
            if (event) event.stopPropagation();
            showConfirmDialog({
                icon: '🗑️',
                iconBgClass: 'w-14 h-14 mx-auto rounded-2xl bg-rose-500/15 text-rose-500 flex items-center justify-center text-3xl shadow-xs',
                title: 'ลบเมนูส่วนตัว',
                message: `ต้องการลบเมนู "${name}" ออกจากหมวดเมนูส่วนตัวใช่หรือไม่?`,
                confirmText: 'ลบเมนูส่วนตัว',
                confirmClass: 'flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition cursor-pointer',
                onConfirm: () => {
                    state.customPresets = (state.customPresets || []).filter(p => p.name !== name);
                    saveState();
                    renderFoodDatabaseExplorer();
                    showToast(`✓ ลบ "${name}" ออกจากเมนูส่วนตัวแล้ว`);
                }
            });
        }

        function renderFoodDatabaseExplorer() {
            const tabBar = document.getElementById('categoryTabBar');
            const listContainer = document.getElementById('quickFoodList');
            if (!tabBar || !listContainer) return;
            const selectedCounts = getSelectedFoodCountMap();

            // Sync search input and clear button state
            const searchInput = document.getElementById('foodSearchInput');
            if (searchInput && document.activeElement !== searchInput) {
                searchInput.value = state.searchQuery || '';
            }
            const btnClear = document.getElementById('btnClearSearch');
            if (btnClear) {
                btnClear.classList.toggle('hidden', !state.searchQuery);
            }

            const categories = [...FOOD_DATABASE.categories];
            if (state.customPresets && state.customPresets.length > 0) {
                categories.unshift({
                    id: 'custom',
                    name: `📝 เมนูส่วนตัว (${state.customPresets.length})`,
                    foods: state.customPresets.map(f => ({ ...f, isCustom: true }))
                });
            }

            const favCount = Array.isArray(state.favorites) ? state.favorites.length : 0;
            const combosCount = Array.isArray(state.mealCombos) ? state.mealCombos.length : 0;
            const allTabs = [];
            if (favCount > 0) {
                allTabs.push({ id: 'favorites', name: `⭐ เมนูโปรด (${favCount})` });
            }
            if (combosCount > 0) {
                allTabs.push({ id: 'combos', name: `📦 เซ็ตประจำ (${combosCount})` });
            }

            const totalFoodsCount = categories.reduce((sum, c) => sum + c.foods.length, 0);
            document.getElementById('totalFoodCountBadge').textContent = totalFoodsCount;

            allTabs.push({ id: 'all', name: `ทั้งหมด (${totalFoodsCount})` });
            categories.forEach(c => allTabs.push({ id: c.id, name: c.name }));

            tabBar.innerHTML = allTabs.map(cat => {
                const isActive = state.selectedCategory === cat.id;
                return `
                    <button onclick="selectCategory('${cat.id}')"
                        class="whitespace-nowrap text-xs sm:text-sm px-4 py-2 rounded-full font-semibold transition shrink-0 ${isActive
                        ? 'bg-emerald-500 text-white shadow-md ring-2 ring-emerald-400/50'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-emerald-500/40'
                    }">
                        ${cat.name}
                    </button>
                `;
            }).join('');

            const matchesQuery = (foodName, catName) => {
                if (!state.searchQuery) return true;
                const q = state.searchQuery;
                const n = (foodName + ' ' + (catName || '')).toLowerCase();
                if (n.includes(q)) return true;
                // Ramen normalization (ราเมน <-> ราเมง)
                const qNorm = q.replace(/ราเมง/g, 'ราเมน');
                const nNorm = n.replace(/ราเมง/g, 'ราเมน');
                if (nNorm.includes(qNorm)) return true;
                return false;
            };

            // If combos tab is selected, render combo cards directly (v5.9.1 Mobile-First Polish)
            if (state.selectedCategory === 'combos') {
                const combos = state.mealCombos || [];
                const targetMealCfg = MEAL_CONFIG[state.activeMeal] || MEAL_CONFIG.breakfast;
                const headerHtml = `
                    <div class="col-span-1 sm:col-span-2 flex items-center justify-between pb-1 gap-2 min-w-0">
                        <span class="text-xs text-slate-500 dark:text-slate-400 font-bold truncate">📦 เซ็ตอาหารประจำ (${combos.length} เซ็ต)</span>
                        <button type="button" onclick="openMealComboEditor(null)"
                            class="px-2.5 sm:px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-xs transition flex items-center gap-1 shrink-0 whitespace-nowrap cursor-pointer active:scale-95">
                            <span>+ สร้างเซ็ตใหม่</span>
                        </button>
                    </div>
                `;
                if (combos.length === 0) {
                    listContainer.innerHTML = `
                        ${headerHtml}
                        <div class="col-span-1 sm:col-span-2 text-center py-8 px-3 space-y-2 bg-slate-50/50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                            <span class="text-3xl block">📦</span>
                            <p class="text-sm font-semibold text-slate-700 dark:text-slate-200">ยังไม่มีเซ็ตอาหารประจำที่บันทึกไว้</p>
                            <p class="text-xs text-slate-400">กดปุ่ม <b>[+ สร้างเซ็ตใหม่]</b> ด้านบน หรือกด <b>[📦 เซฟเซ็ต]</b> ที่หัวมื้ออาหารเพื่อสร้างเซ็ตโปรดได้ทันทีครับ</p>
                        </div>
                    `;
                    return;
                }

                const cardsHtml = combos.map(combo => {
                    const totalCal = Math.round(combo.items.reduce((s, x) => s + x.cal, 0));
                    const totalP = Math.round(combo.items.reduce((s, x) => s + x.p, 0) * 10) / 10;
                    const totalC = Math.round(combo.items.reduce((s, x) => s + x.c, 0) * 10) / 10;
                    const totalF = Math.round(combo.items.reduce((s, x) => s + x.f, 0) * 10) / 10;
                    const mealCfg = MEAL_CONFIG[combo.meal] || MEAL_CONFIG.breakfast;
                    const itemsPreview = combo.items.map(x => `${x.name}${x.portion && x.portion !== 1 ? ` (x${x.portion})` : ''}`).join(', ');

                    return `
                        <div class="p-3 sm:p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 hover:border-purple-500/50 transition shadow-xs flex flex-col justify-between gap-2.5">
                            <div class="space-y-1.5 min-w-0">
                                <div class="flex items-center justify-between gap-1.5 min-w-0">
                                    <div class="flex items-center gap-1.5 font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100 min-w-0 flex-1">
                                        <span class="text-base shrink-0">📦</span>
                                        <span class="truncate" title="${combo.name}">${combo.name}</span>
                                    </div>
                                    <div class="flex items-center gap-1 shrink-0">
                                        <span class="text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-bold bg-purple-500/15 text-purple-600 dark:text-purple-400 whitespace-nowrap">
                                            ${mealCfg.icon} ${mealCfg.name}
                                        </span>
                                        <button type="button" onclick="deleteMealCombo('${combo.id}', event)" class="w-6 h-6 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 flex items-center justify-center text-xs transition cursor-pointer" title="ลบเซ็ตนี้">
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                                <p class="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                                    ${itemsPreview} <span class="font-semibold text-slate-400 dark:text-slate-500">(${combo.items.length} รายการ)</span>
                                </p>
                                <div class="flex items-center flex-wrap gap-x-2 gap-y-0.5 text-xs font-semibold pt-0.5">
                                    <span class="text-emerald-500 font-bold whitespace-nowrap">${totalCal} kcal</span>
                                    <span class="text-blue-500 dark:text-blue-400 whitespace-nowrap">P:${totalP}g</span>
                                    <span class="text-amber-500 dark:text-amber-400 whitespace-nowrap">C:${totalC}g</span>
                                    <span class="text-rose-500 dark:text-rose-400 whitespace-nowrap">F:${totalF}g</span>
                                </div>
                            </div>

                            <div class="flex items-center gap-1.5 pt-1 min-w-0">
                                <button type="button" onclick="openMealComboEditor('${combo.id}', event)"
                                    class="h-8.5 px-2.5 sm:px-3 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 font-bold text-xs transition flex items-center justify-center gap-1 shrink-0 whitespace-nowrap cursor-pointer active:scale-95">
                                    <span>✏️ แก้ไข</span>
                                </button>
                                <button type="button" onclick="applyMealCombo('${combo.id}')"
                                    class="h-8.5 flex-1 px-2.5 sm:px-3 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-bold text-xs shadow-xs transition flex items-center justify-center gap-1.5 whitespace-nowrap truncate cursor-pointer active:scale-95">
                                    <span>⚡ ใส่เข้า${targetMealCfg.name}</span>
                                </button>
                            </div>
                        </div>
                    `;
                }).join('');

                listContainer.innerHTML = headerHtml + cardsHtml;
                return;
            }

            let items = [];
            if (state.searchQuery) {
                // UNIVERSAL SEARCH: Always search across ALL categories + custom presets simultaneously!
                const seen = new Set();
                categories.forEach(cat => {
                    cat.foods.forEach(f => {
                        if (!seen.has(f.name) && matchesQuery(f.name, cat.name)) {
                            seen.add(f.name);
                            items.push({ ...f, catName: cat.name });
                        }
                    });
                });

                // ALSO SEARCH SMART CACHE & AI MEMORY (v5.8.6)
                try {
                    const rawCache = localStorage.getItem('novafit_ai_food_cache');
                    if (rawCache) {
                        const parsedCache = JSON.parse(rawCache);
                        Object.values(parsedCache).forEach(entry => {
                            const entryItems = Array.isArray(entry.items) ? entry.items : [];
                            entryItems.forEach(food => {
                                if (food && food.foodName && !seen.has(food.foodName) && matchesQuery(food.foodName, 'แคช AI')) {
                                    seen.add(food.foodName);
                                    items.push({
                                        name: food.foodName,
                                        protein: Math.round(Number(food.p) || 0),
                                        carbs: Math.round(Number(food.c) || 0),
                                        fat: Math.round(Number(food.f) || 0),
                                        calories: Math.round(Number(food.cal) || 0),
                                        servingSize: food.servingSize || '1 ที่',
                                        catName: '⚡ คลังจำ AI',
                                        isAiCache: true
                                    });
                                }
                            });
                        });
                    }
                } catch (cacheErr) {
                    console.warn('Cache search error:', cacheErr);
                }

                // ALSO SEARCH RECENT SNAP PHOTOS (v5.8.6)
                try {
                    const rawPhotos = localStorage.getItem('novafit_recent_photos');
                    if (rawPhotos) {
                        const parsedPhotos = JSON.parse(rawPhotos);
                        parsedPhotos.forEach(pDish => {
                            if (pDish && pDish.foodName && !seen.has(pDish.foodName) && matchesQuery(pDish.foodName, 'สแกนรูป')) {
                                seen.add(pDish.foodName);
                                items.push({
                                    name: pDish.foodName,
                                    protein: Math.round(Number(pDish.p) || 0),
                                    carbs: Math.round(Number(pDish.c) || 0),
                                    fat: Math.round(Number(pDish.f) || 0),
                                    calories: Math.round(Number(pDish.cal) || 0),
                                    servingSize: pDish.servingSize || '1 ที่',
                                    catName: '📸 สแกนล่าสุด',
                                    isAiCache: true
                                });
                            }
                        });
                    }
                } catch (photoErr) {}
            } else if (state.selectedCategory === 'favorites') {
                const favSet = new Set(state.favorites || []);
                categories.forEach(cat => {
                    cat.foods.forEach(f => {
                        if (favSet.has(f.name)) {
                            items.push({ ...f, catName: cat.name });
                        }
                    });
                });
            } else {
                categories.forEach(cat => {
                    if (state.selectedCategory === 'all' || state.selectedCategory === cat.id) {
                        cat.foods.forEach(f => {
                            items.push({ ...f, catName: cat.name });
                        });
                    }
                });
            }

            if (items.length === 0) {
                const emptyMsg = state.searchQuery
                    ? `🔍 ไม่พบเมนู "${state.searchQuery}" ในคลังอาหารทั้งหมด (ลองพิมพ์คำค้นสั้นลง หรือเปิดฟอร์มกรอกเพิ่มเองด้านล่างได้ครับ)`
                    : (state.selectedCategory === 'favorites'
                        ? 'ยังไม่มีเมนูโปรด กดไอคอน ⭐ ที่มุมของเมนูอาหารเพื่อบันทึกเป็นเมนูโปรดได้เลยครับ'
                        : 'ไม่พบเมนูในหมวดนี้ สามารถเปิดฟอร์มกรอกเพิ่มเองด้านล่างได้เลยครับ');
                listContainer.innerHTML = `<div class="col-span-2 text-center py-6 text-sm text-slate-400">${emptyMsg}</div>`;
                return;
            }

            listContainer.innerHTML = items.map(item => {
                const cal = item.calories || Math.round(item.protein * 4 + item.carbs * 4 + item.fat * 9);
                const serving = item.servingSize ? `<span class="text-xs text-slate-400 font-normal">(${item.servingSize})</span>` : '';
                const safeName = item.name.replace(/'/g, "\\'");
                const count = selectedCounts[item.name] || 0;
                const isJustAdded = state.lastAddedFoodName === item.name;
                const isFav = Array.isArray(state.favorites) && state.favorites.includes(item.name);

                const cardClass = count > 0
                    ? `bg-emerald-500/15 dark:bg-emerald-500/20 border-2 border-emerald-500 shadow-sm ${isJustAdded ? 'ring-2 ring-emerald-400' : ''}`
                    : 'bg-white dark:bg-slate-800 hover:bg-emerald-500/10 border border-slate-200/80 dark:border-slate-700 hover:border-emerald-500/40';

                const countBadge = count > 0
                    ? `<span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-500 text-white ml-1">✓ x${count}</span>`
                    : '';

                const starBtn = `
                    <button type="button" onclick="toggleFavorite('${safeName}', event)"
                        class="p-1 rounded-md hover:bg-slate-200/60 dark:hover:bg-slate-700 transition ${isFav ? 'text-amber-400 text-base font-bold' : 'text-slate-300 dark:text-slate-600 hover:text-amber-400 text-base'}"
                        title="${isFav ? 'นำออกจากเมนูโปรด' : 'กดติดดาวเมนูโปรด'}">
                        ${isFav ? '★' : '☆'}
                    </button>
                `;

                const deleteBtn = item.isCustom
                    ? `<button type="button" onclick="deleteCustomPreset('${safeName}', event)"
                        class="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition text-sm ml-1"
                        title="ลบออกจากเมนูส่วนตัว">
                        🗑️
                    </button>`
                    : '';

                // Quick Meal Picker Button (+มื้อ)
                const mealPickerBtn = `
                    <button type="button" onclick="openFoodMealPicker('${safeName}', ${item.protein}, ${item.carbs}, ${item.fat}, ${cal}, event)"
                        class="p-1.5 px-2 rounded-xl bg-slate-100 dark:bg-slate-700/80 hover:bg-emerald-500 hover:text-white dark:hover:bg-emerald-500 text-slate-600 dark:text-slate-300 transition text-xs font-bold flex items-center gap-1 border border-slate-200/80 dark:border-slate-600 shadow-xs active:scale-95 shrink-0"
                        title="เลือกว่าจะหยอดเมนูนี้ลงมื้อไหน (เช้า/เที่ยง/เย็น/ของว่าง)">
                        <span>🍱</span>
                        <span class="text-[11px] font-semibold">+มื้อ</span>
                    </button>
                `;

                return `
                    <div onclick="addFoodItem('${safeName}', ${item.protein}, ${item.carbs}, ${item.fat}, ${cal})"
                        class="cursor-pointer text-left p-3 rounded-2xl transition flex items-center justify-between gap-2.5 group ${cardClass}">
                        <div class="min-w-0 flex items-center gap-2 flex-1">
                            ${starBtn}
                            <div class="min-w-0 flex-1">
                                <div class="text-sm font-semibold truncate group-hover:text-emerald-500 transition flex items-center flex-wrap gap-1.5">
                                    <span>+ ${item.name}</span> ${serving} ${countBadge}
                                </div>
                                <div class="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                                    <span class="text-blue-500 dark:text-blue-400 font-semibold">P:${item.protein}g</span>
                                    <span class="text-amber-500 dark:text-amber-400 font-semibold">C:${item.carbs}g</span>
                                    <span class="text-rose-500 dark:text-rose-400 font-semibold">F:${item.fat}g</span>
                                    ${item.isAiCache ? '<span class="px-1.5 py-0.2 rounded-md font-bold text-[10px] bg-purple-500/15 text-purple-600 dark:text-purple-400">⚡ AI</span>' : ''}
                                    ${item.catName ? `<span class="opacity-70 text-[11px]">• ${item.catName}</span>` : ''}
                                </div>
                            </div>
                        </div>
                        <div class="flex items-center gap-1.5 shrink-0">
                            <span class="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1.5 rounded-xl">
                                ${cal} kcal
                            </span>
                            ${mealPickerBtn}
                            ${deleteBtn}
                        </div>
                    </div>
                `;
            }).join('');
        }

        function renderWaterSection(targets) {
            const dStr = state.selectedDate;
            const waterGlasses = state.waterByDate[dStr] || 0;
            const targetGlasses = targets.waterTargetGlasses;
            const currentMl = waterGlasses * 250;
            const targetMl = targets.waterTargetMl;
            const remGlasses = Math.max(0, targetGlasses - waterGlasses);
            const remMl = Math.max(0, targetMl - currentMl);
            const pctWater = Math.min(100, Math.round((waterGlasses / targetGlasses) * 100));

            document.getElementById('waterRecommendationSubtitle').textContent =
                `แนะนำตามน้ำหนัก ${targets.weight} กก. (35 มล./กก.${targets.activityBonusMl > 0 ? ` + ชดเชยออกกำลังกาย ${targets.activityBonusMl} มล.` : ''}) = ควรดื่มวันละ ${targetMl.toLocaleString()} มล.`;

            document.getElementById('waterCountText').textContent = `${waterGlasses} / ${targetGlasses} แก้ว`;
            document.getElementById('waterMlStatusText').textContent = `ดื่มแล้ว ${currentMl.toLocaleString()} มล. (${pctWater}%)`;
            document.getElementById('waterTargetText').textContent = `เป้าหมาย ${targetMl.toLocaleString()} มล. (${targetGlasses} แก้ว)`;
            document.getElementById('barWater').style.width = `${pctWater}%`;

            const defEl = document.getElementById('waterDeficitText');
            if (remGlasses > 0) {
                defEl.className = 'text-[11px] text-amber-500 font-medium mt-1.5';
                defEl.textContent = `💧 วันนี้ยังดื่มน้ำขาดอีก ${remGlasses} แก้ว (${remMl.toLocaleString()} มล.) คลิกที่รูปแก้วด้านล่างหรือกด + เพื่อบันทึก`;
            } else {
                defEl.className = 'text-[11px] text-emerald-500 font-semibold mt-1.5';
                defEl.textContent = `✅ ยอดเยี่ยม! วันนี้ดื่มน้ำครบตามเป้าหมาย ${targetMl.toLocaleString()} มล. แล้ว`;
            }

            // Render clickable glass icons
            const totalIcons = Math.max(targetGlasses, waterGlasses);
            let iconsHtml = '';
            for (let i = 1; i <= totalIcons; i++) {
                const filled = i <= waterGlasses;
                iconsHtml += `
                    <button onclick="setWaterDirect(${i})" title="ตั้งค่าเป็น ${i} แก้ว (${i * 250} มล.)"
                        class="w-7 h-8 rounded-lg flex items-center justify-center text-xs font-bold border transition ${filled
                        ? 'bg-sky-500 text-white border-sky-400 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-700/50 text-slate-400 border-slate-200 dark:border-slate-700 hover:border-sky-400'
                    }">
                        💧
                    </button>
                `;
            }
            document.getElementById('waterGlassIcons').innerHTML = iconsHtml;
        }

        function switchBodyTab(tabName) {
            state.bodyTab = tabName;
            clearTimeout(window._tabSaveTimer);
            window._tabSaveTimer = setTimeout(() => {
                try {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
                } catch (e) {}
            }, 100);
            renderBodyAndWorkoutSection(getCalculatedTargets());
        }

        function submitWeightToday() {
            const input = document.getElementById('inDailyWeight');
            const val = parseFloat(input.value);
            if (isNaN(val) || val < 30 || val > 250) {
                return alert('กรุณากรอกน้ำหนักตัวที่ถูกต้อง (30 - 250 กก.) ครับ');
            }
            const dStr = state.selectedDate;
            const cleanVal = Math.round(val * 10) / 10;
            state.weightsByDate[dStr] = cleanVal;
            state.profile.weight = cleanVal;
            saveState();
            renderAll();
            showToast(`⚖️ บันทึกน้ำหนัก ${cleanVal} กก. สำหรับวันที่ ${dStr} เรียบร้อย`);
        }

        function clearWeightToday() {
            const dStr = state.selectedDate;
            if (state.weightsByDate && state.weightsByDate[dStr]) {
                delete state.weightsByDate[dStr];
                saveState();
                renderAll();
                showToast(`ลบการบันทึกน้ำหนักของวันที่ ${dStr} แล้ว`);
            }
        }

        function addWorkout(name, cal) {
            const dStr = state.selectedDate;
            if (!state.workoutsByDate[dStr]) state.workoutsByDate[dStr] = [];
            const time = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
            state.workoutsByDate[dStr].push({
                id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
                name,
                cal: Math.round(cal),
                time
            });
            saveState();
            renderAll();
            showToast(`🏃 บันทึกกิจกรรม "${name}" (-${cal} kcal) แล้ว`);
        }

        function submitCustomWorkout() {
            const nameInput = document.getElementById('inWorkoutName');
            const calInput = document.getElementById('inWorkoutCal');
            const name = nameInput.value.trim();
            const cal = parseFloat(calInput.value);
            if (!name) return alert('กรุณาระบุกิจกรรมออกกำลังกายครับ');
            if (isNaN(cal) || cal <= 0) return alert('กรุณาระบุพลังงานที่เผาผลาญ (kcal) ครับ');

            addWorkout(name, cal);
            nameInput.value = '';
            calInput.value = '';
        }

        function removeWorkout(id) {
            const dStr = state.selectedDate;
            if (!state.workoutsByDate[dStr]) return;
            state.workoutsByDate[dStr] = state.workoutsByDate[dStr].filter(w => w.id !== id);
            saveState();
            renderAll();
            showToast('ลบรายการออกกำลังกายแล้ว');
        }

        function renderBodyAndWorkoutSection(targets) {
            const dStr = state.selectedDate;
            const isWeightTab = (state.bodyTab || 'weight') === 'weight';

            const tabBtnWeight = document.getElementById('tabBtnWeight');
            const tabBtnWorkout = document.getElementById('tabBtnWorkout');
            const tabWeight = document.getElementById('bodyTabWeight');
            const tabWorkout = document.getElementById('bodyTabWorkout');

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

            // Tab 1: Weight logic
            const directWeight = state.weightsByDate ? state.weightsByDate[dStr] : null;
            const inDailyWeight = document.getElementById('inDailyWeight');
            const btnClearWeightToday = document.getElementById('btnClearWeightToday');
            const statusText = document.getElementById('weightStatusText');

            if (directWeight !== undefined && directWeight !== null) {
                inDailyWeight.value = directWeight;
                btnClearWeightToday.classList.remove('hidden');

                const pastDates = Object.keys(state.weightsByDate || {})
                    .filter(d => d < dStr && Number(state.weightsByDate[d]) > 0)
                    .sort();
                let diffStr = '';
                if (pastDates.length > 0) {
                    const prevDate = pastDates[pastDates.length - 1];
                    const prevWeight = Number(state.weightsByDate[prevDate]);
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
                const effective = getEffectiveWeight(dStr);
                inDailyWeight.value = '';
                btnClearWeightToday.classList.add('hidden');
                const fromMsg = effective.sourceDate === 'profile'
                    ? `ตั้งต้นจากข้อมูลส่วนตัว (${effective.weight} กก.)`
                    : `อ้างอิงล่าสุดจากวันที่ ${effective.sourceDate} (${effective.weight} กก.)`;
                statusText.innerHTML = `<span class="text-slate-400">ยังไม่ได้บันทึกของวันนี้ (${fromMsg}) ไม่บังคับบันทึกครับ</span>`;
            }

            // Tab 2: Workout logic
            const workouts = (state.workoutsByDate && state.workoutsByDate[dStr]) || [];
            const workoutContainer = document.getElementById('workoutListContainer');
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

        function renderWeeklyAnalytics(targets) {
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
            badge.textContent = `ความสม่ำเสมอ: ${consistencyPct}% (${daysWithLogs}/7 วัน)`;
            badge.className = consistencyPct >= 70
                ? 'px-2 py-0.5 rounded-full font-bold text-xs bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                : 'px-2 py-0.5 rounded-full font-bold text-xs bg-amber-500/15 text-amber-600 dark:text-amber-400';

            const avgCal = daysWithLogs > 0 ? Math.round(totalCal7Days / daysWithLogs) : 0;
            avgText.textContent = `เฉลี่ย: ${avgCal.toLocaleString()} kcal/วัน`;

            // Weight Trend Analysis for 7 Days (SVG Polyline) - With Carry-Forward (v5.9.0)
            const trendBadge = document.getElementById('weeklyWeightTrendBadge');
            const trendContainer = document.getElementById('weekWeightTrendContainer');

            const weightsWithIdx = daysData.map((d, idx) => {
                const directW = (state.weightsByDate && state.weightsByDate[d.iso]) ? parseFloat(state.weightsByDate[d.iso]) : null;
                if (directW !== null && !isNaN(directW) && directW > 0) {
                    return { idx, weight: directW, isExact: true, iso: d.iso, dayNum: d.dayNum };
                }
                const eff = getEffectiveWeight(d.iso);
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

        function renderDateTrackerAndRecommendations(targets, forceReshuffle = false) {
            const dStr = state.selectedDate;
            document.getElementById('datePicker').value = dStr;

            const dateObj = new Date(dStr + 'T00:00:00');
            const thaiDate = dateObj.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
            document.getElementById('lblThaiDate').textContent = dStr === getTodayStr() ? `${thaiDate} (วันนี้)` : thaiDate;

            renderWaterSection(targets);

            // Render 7-Day Analytics Bar Chart
            renderWeeklyAnalytics(targets);

            // Render Optional Body Weight & Workout Tracker
            renderBodyAndWorkoutSection(targets);

            // Meals Summary
            const meals = state.logsByDate[dStr] || [];
            document.getElementById('mealCount').textContent = meals.length;

            const sumP = Math.round(meals.reduce((s, m) => s + m.p, 0));
            const sumC = Math.round(meals.reduce((s, m) => s + m.c, 0));
            const sumF = Math.round(meals.reduce((s, m) => s + m.f, 0));
            const sumCal = Math.round(meals.reduce((s, m) => s + m.cal, 0));

            const pctCal = Math.min(100, Math.round((sumCal / targets.targetCal) * 100));
            document.getElementById('donutCenterPct').textContent = `${pctCal}%`;

            document.getElementById('progCalText').textContent = `${sumCal.toLocaleString()} / ${targets.targetCal.toLocaleString()} kcal`;
            document.getElementById('progPText').textContent = `${sumP}/${targets.pGram}g`;
            document.getElementById('progCText').textContent = `${sumC}/${targets.cGram}g`;
            document.getElementById('progFText').textContent = `${sumF}/${targets.fGram}g`;

            document.getElementById('barCal').style.width = `${Math.min(100, (sumCal / targets.targetCal) * 100)}%`;
            document.getElementById('barP').style.width = `${Math.min(100, (sumP / targets.pGram) * 100)}%`;
            document.getElementById('barC').style.width = `${Math.min(100, (sumC / targets.cGram) * 100)}%`;
            document.getElementById('barF').style.width = `${Math.min(100, (sumF / targets.fGram) * 100)}%`;

            const remCal = targets.targetCal - sumCal;
            const remP = Math.max(0, targets.pGram - sumP);
            const remC = Math.max(0, targets.cGram - sumC);
            const remF = Math.max(0, targets.fGram - sumF);

            // Workouts & Net Calories calculation
            const dayWorkouts = (state.workoutsByDate && state.workoutsByDate[dStr]) || [];
            const burnedCal = dayWorkouts.reduce((s, w) => s + w.cal, 0);
            const netCal = sumCal - burnedCal;

            const netCalRow = document.getElementById('netCalRow');
            const burnedCalText = document.getElementById('burnedCalText');
            const netCalText = document.getElementById('netCalText');

            if (burnedCal > 0) {
                netCalRow.classList.remove('hidden');
                burnedCalText.textContent = `-${burnedCal.toLocaleString()} kcal`;
                netCalText.textContent = `${netCal.toLocaleString()} kcal`;
            } else {
                netCalRow.classList.add('hidden');
            }

            const waterGlasses = state.waterByDate[dStr] || 0;
            const remWaterGlasses = Math.max(0, targets.waterTargetGlasses - waterGlasses);
            const remWaterMl = remWaterGlasses * 250;

            const waterBadgeHtml = remWaterGlasses > 0
                ? `<span class="px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-600 dark:text-sky-400 font-semibold">💧 น้ำดื่มขาด ${remWaterGlasses} แก้ว (${remWaterMl.toLocaleString()} มล.)</span>`
                : `<span class="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-500 font-semibold">✓ น้ำดื่มครบเป้า</span>`;

            const workoutBadgeHtml = burnedCal > 0
                ? `<span class="px-2 py-0.5 rounded-md bg-orange-500/15 text-orange-600 dark:text-orange-400 font-semibold">🔥 เบิร์นออกกำลัง -${burnedCal.toLocaleString()} kcal (Net: ${netCal.toLocaleString()} kcal)</span>`
                : '';

            // Render Status Pill & Deficit Alert Banner (Including Water Alert)
            const statusPill = document.getElementById('statusPill');
            const alertBanner = document.getElementById('deficitAlertBanner');

            if (sumCal === 0) {
                statusPill.className = 'text-xs px-2.5 py-1 rounded-full font-semibold bg-slate-100 dark:bg-slate-700 text-slate-500';
                statusPill.textContent = '⏳ ยังไม่ได้เริ่มบันทึกมื้ออาหาร';
                alertBanner.className = 'p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs space-y-1.5';
                alertBanner.innerHTML = `
                    <div class="font-bold text-amber-600 dark:text-amber-400">🔔 แจ้งเตือนเป้าหมายวันนี้:</div>
                    <p class="text-slate-600 dark:text-slate-300">วันนี้ยังขาดพลังงาน <b>${targets.targetCal.toLocaleString()} kcal</b> (โปรตีน <b>${targets.pGram}g</b>, คาร์บ <b>${targets.cGram}g</b>, ไขมัน <b>${targets.fGram}g</b>)</p>
                    <div class="flex flex-wrap gap-1.5 pt-0.5">${waterBadgeHtml}${workoutBadgeHtml}</div>
                `;
            } else if (Math.abs(remCal) <= 150 && remP <= 15 && remWaterGlasses === 0) {
                statusPill.className = 'text-xs px-2.5 py-1 rounded-full font-semibold bg-emerald-500/20 text-emerald-500';
                statusPill.textContent = '🎉 ถึงเป้าทั้งอาหารและน้ำดื่ม!';
                alertBanner.className = 'p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs space-y-1';
                alertBanner.innerHTML = `
                    <div class="font-bold text-emerald-600 dark:text-emerald-400">✅ สมบูรณ์แบบมากครับเบนซ์!</div>
                    <p class="text-slate-600 dark:text-slate-300">วันนี้ทานพลังงาน โปรตีน และดื่มน้ำครบตามเป้าหมายทั้งหมดแล้ว</p>
                    <div class="flex flex-wrap gap-1.5 pt-0.5">${workoutBadgeHtml}</div>
                `;
            } else if (remCal > 0) {
                statusPill.className = 'text-xs px-2.5 py-1 rounded-full font-semibold bg-amber-500/20 text-amber-500';
                statusPill.textContent = `⚡ ยังขาดอีก ${remCal.toLocaleString()} kcal`;
                alertBanner.className = 'p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs space-y-1.5';
                alertBanner.innerHTML = `
                    <div class="flex items-center justify-between">
                        <span class="font-bold text-amber-600 dark:text-amber-400">⚠️ สรุปสิ่งที่ยังขาดในวันนี้:</span>
                        <button onclick="openDailyReportModal()" class="text-[11px] underline text-amber-600 dark:text-amber-400 font-semibold">ดูรายงานละเอียด</button>
                    </div>
                    <div class="flex flex-wrap gap-1.5 pt-0.5">
                        <span class="px-2 py-0.5 rounded-md bg-white/80 dark:bg-slate-800 font-semibold text-emerald-600 dark:text-emerald-400">พลังงานขาด ${remCal.toLocaleString()} kcal</span>
                        ${remP > 0 ? `<span class="px-2 py-0.5 rounded-md bg-white/80 dark:bg-slate-800 font-semibold text-blue-500">โปรตีนขาด ${remP}g</span>` : `<span class="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-500 font-semibold">✓ โปรตีนครบ</span>`}
                        ${remC > 0 ? `<span class="px-2 py-0.5 rounded-md bg-white/80 dark:bg-slate-800 font-semibold text-amber-500">คาร์บขาด ${remC}g</span>` : ''}
                        ${remF > 0 ? `<span class="px-2 py-0.5 rounded-md bg-white/80 dark:bg-slate-800 font-semibold text-rose-500">ไขมันขาด ${remF}g</span>` : ''}
                        ${waterBadgeHtml}
                        ${workoutBadgeHtml}
                    </div>
                `;
            } else {
                statusPill.className = 'text-xs px-2.5 py-1 rounded-full font-semibold bg-rose-500/20 text-rose-500';
                statusPill.textContent = `🔥 เกินเป้าหมาย ${Math.abs(remCal).toLocaleString()} kcal`;
                alertBanner.className = 'p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs space-y-1.5';
                alertBanner.innerHTML = `
                    <div class="font-bold text-rose-600 dark:text-rose-400">🚨 แจ้งเตือนแคลอรีเกินเป้าหมาย:</div>
                    <p class="text-slate-600 dark:text-slate-300">วันนี้ทานเกินเป้าหมายไป <b>${Math.abs(remCal).toLocaleString()} kcal</b> ${remP > 0 ? `(โปรตีนยังขาดอีก <b>${remP}g</b>)` : ''}</p>
                    <div class="flex flex-wrap gap-1.5 pt-0.5">${waterBadgeHtml}${workoutBadgeHtml}</div>
                `;
            }

            // Render Smart Food Recommendations (Uses cache unless macros changed or user clicked Reshuffle)
            renderSmartRecommendations(remCal, remP, remC, remF, forceReshuffle);

            // Check Milestone Celebrations (Confetti & Celebration Beats)
            if (typeof checkMilestoneCelebrations === 'function') {
                checkMilestoneCelebrations();
            }

            // Render Logged Meals List (Grouped by 4 Meals: เช้า, เที่ยง, เย็น, ของว่าง)
            const listEl = document.getElementById('mealListContainer');
            if (meals.length === 0) {
                listEl.innerHTML = `
                    <div class="text-center py-8 px-4 text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl space-y-1.5">
                        <div class="text-2xl">🍽️</div>
                        <p class="font-medium text-slate-600 dark:text-slate-300">ยังไม่มีรายการอาหารในวันที่ ${dStr}</p>
                        <p class="text-[11px] text-slate-400">เลือกมื้อด้านบนแล้วกดคลิกเลือกเมนูจากคลัง หรือสุ่มเมนูแนะนำด้านซ้ายได้เลยครับ</p>
                    </div>
                `;
            } else {
                const mealGroups = {
                    breakfast: { ...MEAL_CONFIG.breakfast, items: [] },
                    lunch: { ...MEAL_CONFIG.lunch, items: [] },
                    dinner: { ...MEAL_CONFIG.dinner, items: [] },
                    snack: { ...MEAL_CONFIG.snack, items: [] }
                };

                meals.forEach(m => {
                    const k = m.meal && mealGroups[m.meal] ? m.meal : 'breakfast';
                    mealGroups[k].items.push(m);
                });

                listEl.innerHTML = Object.keys(mealGroups).map(key => {
                    const group = mealGroups[key];
                    const items = group.items;
                    const groupCal = Math.round(items.reduce((s, x) => s + x.cal, 0));
                    const groupP = Math.round(items.reduce((s, x) => s + x.p, 0) * 10) / 10;
                    const groupC = Math.round(items.reduce((s, x) => s + x.c, 0) * 10) / 10;
                    const groupF = Math.round(items.reduce((s, x) => s + x.f, 0) * 10) / 10;
                    const isActive = state.activeMeal === key;

                    const itemsHtml = items.length === 0
                        ? `
                            <div class="flex items-center justify-between p-3 rounded-xl border border-dashed border-slate-200/80 dark:border-slate-700/80 text-xs sm:text-sm text-slate-400">
                                <span>ยังไม่ได้บันทึก${group.name}</span>
                                <button type="button" onclick="setActiveMeal('${key}'); showToast('เลือกมื้อ ${group.name} เรียบร้อย');" class="text-emerald-500 hover:underline font-semibold flex items-center gap-1">
                                    + เพิ่มเข้ามื้อนี้
                                </button>
                            </div>
                        `
                        : items.map(m => {
                            if (!m.id) m.id = 'log_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
                            const portion = m.portion || 1;
                            const portionBadge = portion !== 1
                                ? `<span class="px-1.5 py-0.5 rounded text-xs font-bold bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-500/30">x${portion}</span>`
                                : '';
                            return `
                                <div class="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-xs hover:border-slate-300 dark:hover:border-slate-600 transition gap-2.5">
                                    <div class="min-w-0 flex-1">
                                        <div class="flex items-center gap-1.5 flex-wrap">
                                            <span class="text-sm font-semibold text-slate-800 dark:text-slate-100">${m.name}</span>
                                            ${portionBadge}
                                            <span class="text-xs text-slate-400">${m.time || ''}</span>
                                        </div>
                                        <div class="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                                            <span class="text-emerald-500 font-bold">${m.cal} kcal</span>
                                            <span class="text-blue-500 dark:text-blue-400 font-semibold">P:${m.p}g</span>
                                            <span class="text-amber-500 dark:text-amber-400 font-semibold">C:${m.c}g</span>
                                            <span class="text-rose-500 dark:text-rose-400 font-semibold">F:${m.f}g</span>
                                        </div>
                                    </div>
                                    <div class="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-700/50">
                                        <!-- Quick Portion Adjusters -->
                                        <div class="flex items-center bg-slate-100 dark:bg-slate-700/70 rounded-lg p-0.5 border border-slate-200/60 dark:border-slate-600/60">
                                            <button type="button" onclick="updateMealItemPortion('${m.id}', -0.5)" class="w-6 h-6 rounded flex items-center justify-center text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition" title="ลดขนาดเสิร์ฟ (-0.5x)">-</button>
                                            <span class="text-xs font-bold px-1.5 min-w-[26px] text-center">${portion}x</span>
                                            <button type="button" onclick="updateMealItemPortion('${m.id}', 0.5)" class="w-6 h-6 rounded flex items-center justify-center text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition" title="เพิ่มขนาดเสิร์ฟ (+0.5x)">+</button>
                                        </div>
                                        <!-- Quick Meal Switcher -->
                                        <select onchange="changeMealCategory('${m.id}', this.value)" class="bg-slate-100 dark:bg-slate-700/70 text-xs rounded-lg px-2 py-1 font-medium border border-slate-200/60 dark:border-slate-600/60 focus:outline-none cursor-pointer" title="ย้ายมื้ออาหาร">
                                            <option value="breakfast" ${m.meal === 'breakfast' ? 'selected' : ''}>🌅 เช้า</option>
                                            <option value="lunch" ${m.meal === 'lunch' ? 'selected' : ''}>☀️ เที่ยง</option>
                                            <option value="dinner" ${m.meal === 'dinner' ? 'selected' : ''}>🌙 เย็น</option>
                                            <option value="snack" ${m.meal === 'snack' ? 'selected' : ''}>🍎 ว่าง</option>
                                        </select>
                                        <!-- Delete Button -->
                                        <button type="button" onclick="removeFoodItem('${m.id}')" class="text-sm text-rose-500 hover:bg-rose-500/10 p-1.5 rounded-lg transition" title="ลบรายการนี้">
                                            ✕
                                        </button>
                                    </div>
                                </div>
                            `;
                        }).join('');

                    return `
                        <div class="p-3.5 sm:p-4 rounded-2xl border transition ${items.length > 0
                            ? 'bg-slate-50/70 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700'
                            : 'bg-slate-50/30 dark:bg-slate-900/20 border-slate-200/50 dark:border-slate-800'
                        }">
                            <!-- Meal Header Row -->
                            <div class="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-200/60 dark:border-slate-700/60">
                                <div class="flex items-center gap-2 flex-wrap">
                                    <span class="text-lg">${group.icon}</span>
                                    <span class="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100">${group.name}</span>
                                    <span class="text-xs sm:text-sm px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                                        ${groupCal} kcal
                                    </span>
                                    ${groupCal > 0 ? `
                                        <div class="flex items-center gap-1.5 text-xs text-slate-400">
                                            <span class="text-blue-500 dark:text-blue-400 font-semibold">P:${groupP}g</span>
                                            <span>•</span>
                                            <span class="text-amber-500 dark:text-amber-400 font-semibold">C:${groupC}g</span>
                                            <span>•</span>
                                            <span class="text-rose-500 dark:text-rose-400 font-semibold">F:${groupF}g</span>
                                        </div>
                                    ` : ''}
                                </div>
                                <div class="flex items-center gap-1.5 flex-wrap">
                                    <button type="button" onclick="copyMealFromYesterday('${key}')"
                                        class="text-xs px-2 py-1 rounded-lg border font-medium transition text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/20 shadow-xs whitespace-nowrap active:scale-95"
                                        title="คัดลอกเฉพาะ${group.name}จากเมื่อวาน">
                                        📋 เมื่อวาน
                                    </button>
                                    ${items.length > 0 ? `
                                        <button type="button" onclick="saveMealAsCombo('${key}')"
                                            class="text-xs px-2 py-1 rounded-lg border font-medium transition text-purple-600 dark:text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/20 shadow-xs whitespace-nowrap active:scale-95"
                                            title="เซฟรายการใน${group.name}นี้เป็นเซ็ตประจำ">
                                            📦 เซฟเซ็ต
                                        </button>
                                    ` : ''}
                                    <button type="button" onclick="setActiveMeal('${key}'); showToast('เลือกมื้อ ${group.name} สำหรับบันทึกแล้ว');"
                                        class="text-xs px-2.5 py-1 rounded-lg border font-medium transition whitespace-nowrap active:scale-95 ${isActive
                            ? 'bg-emerald-500 text-white border-emerald-500 font-bold shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-500 hover:border-emerald-500/40'
                        }">
                                        ${isActive ? '✓ มื้อที่เลือก' : 'เลือกมื้อนี้'}
                                    </button>
                                </div>
                            </div>
                            <!-- Meal Items Container -->
                            <div class="space-y-2">
                                ${itemsHtml}
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }

        // ==========================================
        // MEAL COMBOS & YESTERDAY COPYING (v5.0.0)
        // ==========================================
        function copyMealFromYesterday(mealKey) {
            const curDate = new Date(state.selectedDate + 'T00:00:00');
            const prevDate = new Date(curDate.getTime() - 86400000);
            const offset = prevDate.getTimezoneOffset() * 60000;
            const prevIso = new Date(prevDate.getTime() - offset).toISOString().split('T')[0];
            const prevMeals = (state.logsByDate && state.logsByDate[prevIso]) || [];
            const itemsToCopy = prevMeals.filter(m => (m.meal || 'breakfast') === mealKey);

            if (itemsToCopy.length === 0) {
                showToast(`⚠️ ไม่พบรายการ${MEAL_CONFIG[mealKey]?.name || 'มื้อนี้'}ของเมื่อวาน (${prevIso})`);
                return;
            }

            const todayStr = state.selectedDate;
            if (!state.logsByDate[todayStr]) state.logsByDate[todayStr] = [];

            const nowTime = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
            itemsToCopy.forEach(item => {
                const portion = item.portion || 1;
                state.logsByDate[todayStr].push({
                    id: 'meal_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                    name: item.name,
                    portion,
                    baseCal: item.baseCal !== undefined ? item.baseCal : item.cal,
                    baseP: item.baseP !== undefined ? item.baseP : item.p,
                    baseC: item.baseC !== undefined ? item.baseC : item.c,
                    baseF: item.baseF !== undefined ? item.baseF : item.f,
                    cal: item.cal,
                    p: item.p,
                    c: item.c,
                    f: item.f,
                    meal: mealKey,
                    time: nowTime
                });
            });

            saveState();
            renderAll();
            showToast(`✓ คัดลอก${MEAL_CONFIG[mealKey]?.name || ''}จากเมื่อวาน (${itemsToCopy.length} รายการ) เรียบร้อย!`);
        }

        function saveMealAsCombo(mealKey) {
            const todayStr = state.selectedDate;
            const meals = (state.logsByDate && state.logsByDate[todayStr]) || [];
            const items = meals.filter(m => (m.meal || 'breakfast') === mealKey);
            if (items.length === 0) {
                showToast('⚠️ มื้อนี้ยังไม่มีรายการอาหารให้เซฟเป็นเซ็ต');
                return;
            }

            const defaultName = `เซ็ต${MEAL_CONFIG[mealKey]?.name || 'มื้ออาหาร'}ประจำ`;
            const comboName = prompt(`ตั้งชื่อเซ็ตอาหารนี้ (${items.length} รายการ):`, defaultName);
            if (!comboName || !comboName.trim()) return;

            if (!Array.isArray(state.mealCombos)) state.mealCombos = [];

            const newCombo = {
                id: 'combo_' + Date.now(),
                name: comboName.trim(),
                meal: mealKey,
                items: items.map(x => ({
                    name: x.name,
                    portion: x.portion || 1,
                    baseCal: x.baseCal !== undefined ? x.baseCal : x.cal,
                    baseP: x.baseP !== undefined ? x.baseP : x.p,
                    baseC: x.baseC !== undefined ? x.baseC : x.c,
                    baseF: x.baseF !== undefined ? x.baseF : x.f,
                    cal: x.cal,
                    p: x.p,
                    c: x.c,
                    f: x.f
                }))
            };

            state.mealCombos.push(newCombo);
            saveState();
            renderFoodDatabaseExplorer();
            showToast(`📦 บันทึกเซ็ต "${newCombo.name}" เรียบร้อยแล้ว!`);
        }

        function applyMealCombo(comboId, targetMealKey) {
            const combo = (state.mealCombos || []).find(c => c.id === comboId);
            if (!combo || !combo.items || combo.items.length === 0) return;

            const targetMeal = targetMealKey || state.activeMeal || combo.meal || 'breakfast';
            const todayStr = state.selectedDate;
            if (!state.logsByDate[todayStr]) state.logsByDate[todayStr] = [];

            const nowTime = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
            combo.items.forEach(item => {
                const portion = item.portion || 1;
                state.logsByDate[todayStr].push({
                    id: 'meal_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                    name: item.name,
                    portion,
                    baseCal: item.baseCal !== undefined ? item.baseCal : item.cal,
                    baseP: item.baseP !== undefined ? item.baseP : item.p,
                    baseC: item.baseC !== undefined ? item.baseC : item.c,
                    baseF: item.baseF !== undefined ? item.baseF : item.f,
                    cal: item.cal,
                    p: item.p,
                    c: item.c,
                    f: item.f,
                    meal: targetMeal,
                    time: nowTime
                });
            });

            saveState();
            renderAll();
            showToast(`⚡ ใส่เซ็ต "${combo.name}" เข้า${MEAL_CONFIG[targetMeal]?.name || 'มื้ออาหาร'} (${combo.items.length} รายการ) เรียบร้อย!`);
        }

        function deleteMealCombo(comboId, event) {
            if (event) {
                event.stopPropagation();
                event.preventDefault();
            }
            const combo = (state.mealCombos || []).find(c => c.id === comboId);
            if (!combo) return;
            showConfirmDialog({
                icon: '🍱',
                iconBgClass: 'w-14 h-14 mx-auto rounded-2xl bg-rose-500/15 text-rose-500 flex items-center justify-center text-3xl shadow-xs',
                title: 'ลบเซ็ตอาหาร (Meal Combo)',
                message: `ต้องการลบเซ็ตอาหาร "${combo.name}" ใช่หรือไม่?`,
                confirmText: 'ลบเซ็ตอาหาร',
                confirmClass: 'flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition cursor-pointer',
                onConfirm: () => {
                    state.mealCombos = (state.mealCombos || []).filter(c => c.id !== comboId);
                    saveState();
                    renderFoodDatabaseExplorer();
                    showToast(`✓ ลบเซ็ต "${combo.name}" เรียบร้อยแล้ว`);
                }
            });
        }

        // ==========================================
        // MEAL COMBOS MANAGER & WEEKLY WEIGHT (v5.9.0)
        // ==========================================
        let _editingComboId = null;
        let _editingComboItems = [];

        function checkWeeklyWeighInNudge() {
            const banner = document.getElementById('weeklyWeighInNudgeBanner');
            if (!banner) return;

            const dates = Object.keys(state.weightsByDate || {})
                .filter(d => Number(state.weightsByDate[d]) > 0)
                .sort();

            const todayStr = getTodayStr();
            const todayRecorded = state.weightsByDate && Number(state.weightsByDate[todayStr]) > 0;
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
            const card = document.getElementById('card_body');
            const section = document.getElementById('section_body');
            if (section && section.classList.contains('hidden')) {
                toggleCardSection('section_body');
            }
            const input = document.getElementById('inDailyWeight');
            if (input) {
                input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                input.focus();
                input.select();
            }
        }

        function openMealComboEditor(comboId, event) {
            if (event) {
                event.stopPropagation();
                event.preventDefault();
            }
            _editingComboId = comboId;
            const modal = document.getElementById('mealComboEditModal');
            if (!modal) return;

            const titleEl = document.getElementById('comboEditModalTitle');
            const nameInput = document.getElementById('comboEditName');
            const mealSelect = document.getElementById('comboEditMeal');

            if (comboId) {
                const combo = (state.mealCombos || []).find(c => c.id === comboId);
                if (!combo) return;
                _editingComboItems = JSON.parse(JSON.stringify(combo.items || []));
                if (titleEl) titleEl.textContent = `✏️ จัดการเซ็ต: ${combo.name}`;
                if (nameInput) nameInput.value = combo.name;
                if (mealSelect) mealSelect.value = combo.meal || 'breakfast';
            } else {
                _editingComboItems = [];
                if (titleEl) titleEl.textContent = '✨ สร้างเซ็ตอาหารประจำใหม่';
                if (nameInput) nameInput.value = 'เซ็ตอาหารประจำของฉัน';
                if (mealSelect) mealSelect.value = state.activeMeal || 'breakfast';
            }

            populateComboFoodSelectDropdown();
            clearComboFoodSearch();
            renderComboEditorItems();
            modal.classList.remove('hidden');
        }

        function closeMealComboEditor() {
            const modal = document.getElementById('mealComboEditModal');
            if (modal) modal.classList.add('hidden');
            _editingComboId = null;
            _editingComboItems = [];
        }


        function getAllAvailableFoodsList() {
            const allFoods = [];
            const seen = new Set();

            (state.customPresets || []).forEach(f => {
                if (f && f.name && !seen.has(f.name.toLowerCase())) {
                    seen.add(f.name.toLowerCase());
                    allFoods.push({ name: f.name, cal: f.calories, p: f.protein, c: f.carbs, f: f.fat, cat: 'เมนูส่วนตัว' });
                }
            });

            (FOOD_DATABASE.categories || []).forEach(cat => {
                (cat.foods || []).forEach(f => {
                    if (f && f.name && !seen.has(f.name.toLowerCase())) {
                        seen.add(f.name.toLowerCase());
                        allFoods.push({ name: f.name, cal: f.calories, p: f.protein, c: f.carbs, f: f.fat, cat: cat.name });
                    }
                });
            });

            return allFoods;
        }

        function onComboFoodSearchInput(rawQuery) {
            const q = (rawQuery || '').trim().toLowerCase();
            const resultsContainer = document.getElementById('comboFoodSearchResults');
            const clearBtn = document.getElementById('comboFoodSearchClearBtn');
            if (clearBtn) clearBtn.classList.toggle('hidden', !q);
            if (!resultsContainer) return;

            if (!q) {
                resultsContainer.classList.add('hidden');
                resultsContainer.innerHTML = '';
                return;
            }

            const allFoods = getAllAvailableFoodsList();
            const qNorm = q.replace(/ราเมง/g, 'ราเมน');

            const matches = allFoods.filter(f => {
                const text = (f.name + ' ' + (f.cat || '')).toLowerCase();
                const textNorm = text.replace(/ราเมง/g, 'ราเมน');
                return text.includes(q) || textNorm.includes(qNorm);
            }).slice(0, 20);

            if (matches.length === 0) {
                resultsContainer.classList.remove('hidden');
                resultsContainer.innerHTML = `
                    <div class="py-3 text-center text-xs text-slate-400">
                        ไม่พบเมนู "${rawQuery}" ในคลัง (สามารถพิมพ์กรอกด้านล่างเพื่อเพิ่มเองได้ครับ)
                    </div>
                `;
                return;
            }

            resultsContainer.classList.remove('hidden');
            resultsContainer.innerHTML = matches.map(f => {
                const safeFoodStr = encodeURIComponent(JSON.stringify(f));
                return `
                    <div onclick="addFoodObjectToComboEditor('${safeFoodStr}')"
                        class="p-2 rounded-xl hover:bg-purple-500/10 active:bg-purple-500/20 cursor-pointer flex items-center justify-between gap-2 border border-slate-100 dark:border-slate-700/60 transition group">
                        <div class="min-w-0 flex-1">
                            <div class="flex items-center gap-1.5 min-w-0">
                                <span class="font-bold text-xs text-slate-800 dark:text-slate-100 truncate group-hover:text-purple-600 dark:group-hover:text-purple-400">${f.name}</span>
                                <span class="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 shrink-0 whitespace-nowrap">${f.cat}</span>
                            </div>
                            <div class="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                                <span class="text-emerald-500 font-semibold">${f.cal} kcal</span>
                                <span>P:${f.p}g</span>
                                <span>C:${f.c}g</span>
                                <span>F:${f.f}g</span>
                            </div>
                        </div>
                        <button type="button" class="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-[10px] shrink-0 pointer-events-none shadow-2xs whitespace-nowrap">
                            + เพิ่ม
                        </button>
                    </div>
                `;
            }).join('');
        }

        function clearComboFoodSearch() {
            const input = document.getElementById('comboFoodSearchInput');
            if (input) {
                input.value = '';
            }
            onComboFoodSearchInput('');
        }

        function addFoodObjectToComboEditor(encodedFood) {
            try {
                const food = JSON.parse(decodeURIComponent(encodedFood));
                _editingComboItems.push({
                    name: food.name,
                    portion: 1,
                    baseCal: food.cal,
                    baseP: food.p,
                    baseC: food.c,
                    baseF: food.f,
                    cal: food.cal,
                    p: food.p,
                    c: food.c,
                    f: food.f
                });
                renderComboEditorItems();
                clearComboFoodSearch();
                showToast(`✓ เพิ่ม "${food.name}" เข้าเซ็ตแล้ว`);
            } catch (e) {
                console.error('Error adding food to combo:', e);
            }
        }

        function quickAddChipToCombo(foodName) {
            const allFoods = getAllAvailableFoodsList();
            const food = allFoods.find(f => f.name.toLowerCase() === foodName.toLowerCase()) || allFoods.find(f => f.name.includes(foodName));
            if (food) {
                addFoodObjectToComboEditor(encodeURIComponent(JSON.stringify(food)));
            } else {
                showToast(`ไม่พบเมนู ${foodName}`);
            }
        }

        function populateComboFoodSelectDropdown() {
            const select = document.getElementById('comboAddFoodSelect');
            if (!select) return;

            const allFoods = [];
            const seen = new Set();

            (state.customPresets || []).forEach(f => {
                if (!seen.has(f.name)) {
                    seen.add(f.name);
                    allFoods.push({ name: f.name, cal: f.calories, p: f.protein, c: f.carbs, f: f.fat, cat: 'เมนูส่วนตัว' });
                }
            });

            (FOOD_DATABASE.categories || []).forEach(cat => {
                (cat.foods || []).forEach(f => {
                    if (!seen.has(f.name)) {
                        seen.add(f.name);
                        allFoods.push({ name: f.name, cal: f.calories, p: f.protein, c: f.carbs, f: f.fat, cat: cat.name });
                    }
                });
            });

            select.innerHTML = '<option value="">-- เลือกเมนูจากคลังอาหาร --</option>' + allFoods.map(f => `
                <option value="${encodeURIComponent(JSON.stringify(f))}">${f.name} (${f.cal} kcal · P:${f.p}g) [${f.cat}]</option>
            `).join('');
        }

        function addSelectedFoodToComboEditor() {
            const select = document.getElementById('comboAddFoodSelect');
            if (!select || !select.value) return alert('กรุณาเลือกเมนูจากคลังอาหารครับ');
            try {
                const food = JSON.parse(decodeURIComponent(select.value));
                _editingComboItems.push({
                    name: food.name,
                    portion: 1,
                    baseCal: food.cal,
                    baseP: food.p,
                    baseC: food.c,
                    baseF: food.f,
                    cal: food.cal,
                    p: food.p,
                    c: food.c,
                    f: food.f
                });
                renderComboEditorItems();
                select.value = '';
            } catch (e) {
                console.error(e);
            }
        }

        function addManualFoodToComboEditor() {
            const inName = document.getElementById('comboManualFoodName');
            const inCal = document.getElementById('comboManualFoodCal');
            const inP = document.getElementById('comboManualFoodP');
            const inC = document.getElementById('comboManualFoodC');
            const inF = document.getElementById('comboManualFoodF');

            const name = (inName?.value || '').trim();
            if (!name) return alert('กรุณากรอกชื่อเมนูอาหารครับ');

            const p = parseFloat(inP?.value) || 0;
            const c = parseFloat(inC?.value) || 0;
            const f = parseFloat(inF?.value) || 0;
            const calInput = parseFloat(inCal?.value);
            const cal = (!isNaN(calInput) && calInput > 0) ? Math.round(calInput) : Math.round(p * 4 + c * 4 + f * 9);

            _editingComboItems.push({
                name,
                portion: 1,
                baseCal: cal,
                baseP: p,
                baseC: c,
                baseF: f,
                cal,
                p,
                c,
                f
            });

            if (inName) inName.value = '';
            if (inCal) inCal.value = '';
            if (inP) inP.value = '';
            if (inC) inC.value = '';
            if (inF) inF.value = '';

            renderComboEditorItems();
        }

        function removeComboEditorItem(idx) {
            _editingComboItems.splice(idx, 1);
            renderComboEditorItems();
        }

        function adjustComboEditorItemPortion(idx, delta) {
            if (!_editingComboItems[idx]) return;
            const it = _editingComboItems[idx];
            let current = it.portion || 1;
            let next = Math.max(0.5, Math.round((current + delta) * 10) / 10);
            it.portion = next;
            it.cal = Math.round(it.baseCal * next);
            it.p = Math.round(it.baseP * next * 10) / 10;
            it.c = Math.round(it.baseC * next * 10) / 10;
            it.f = Math.round(it.baseF * next * 10) / 10;
            renderComboEditorItems();
        }

        function renderComboEditorItems() {
            const container = document.getElementById('comboEditItemsContainer');
            const summaryEl = document.getElementById('comboEditSummaryStrip');
            const countBadge = document.getElementById('comboEditCountBadge');
            if (!container) return;

            if (countBadge) countBadge.textContent = `${_editingComboItems.length} รายการ`;

            let totalCal = 0, totalP = 0, totalC = 0, totalF = 0;
            _editingComboItems.forEach(it => {
                totalCal += (it.cal || 0);
                totalP += (it.p || 0);
                totalC += (it.c || 0);
                totalF += (it.f || 0);
            });
            totalP = Math.round(totalP * 10) / 10;
            totalC = Math.round(totalC * 10) / 10;
            totalF = Math.round(totalF * 10) / 10;

            if (summaryEl) {
                summaryEl.innerHTML = `
                    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs font-bold gap-1 px-1">
                        <span class="text-slate-600 dark:text-slate-300 whitespace-nowrap">สารอาหารรวมในเซ็ต:</span>
                        <div class="flex items-center flex-wrap gap-2 text-xs">
                            <span class="text-emerald-500 font-bold whitespace-nowrap">${totalCal} kcal</span>
                            <span class="text-blue-500 whitespace-nowrap">P:${totalP}g</span>
                            <span class="text-amber-500 whitespace-nowrap">C:${totalC}g</span>
                            <span class="text-rose-500 whitespace-nowrap">F:${totalF}g</span>
                        </div>
                    </div>
                `;
            }

            if (_editingComboItems.length === 0) {
                container.innerHTML = `
                    <div class="py-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                        ยังไม่มีเมนูในเซ็ตนี้ เลือกเมนูด้านล่างเพื่อเพิ่มเข้าเซ็ตได้เลยครับ
                    </div>
                `;
                return;
            }

            container.innerHTML = _editingComboItems.map((it, idx) => `
                <div class="p-2 sm:p-2.5 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-200/70 dark:border-slate-600/70 flex items-center justify-between gap-2 min-w-0">
                    <div class="min-w-0 flex-1">
                        <div class="font-bold text-xs text-slate-800 dark:text-slate-100 truncate">${it.name}</div>
                        <div class="flex items-center flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                            <span class="text-emerald-600 dark:text-emerald-400 font-semibold whitespace-nowrap">${it.cal} kcal</span>
                            <span class="whitespace-nowrap">P:${it.p}g</span>
                            <span class="whitespace-nowrap">C:${it.c}g</span>
                            <span class="whitespace-nowrap">F:${it.f}g</span>
                        </div>
                    </div>
                    <div class="flex items-center gap-1.5 shrink-0">
                        <div class="flex items-center border border-slate-200 dark:border-slate-600 rounded-lg overflow-hidden bg-white dark:bg-slate-800 text-xs">
                            <button type="button" onclick="adjustComboEditorItemPortion(${idx}, -0.5)" class="w-6 h-6 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold cursor-pointer">-</button>
                            <span class="px-1.5 font-bold text-slate-700 dark:text-slate-200 text-[10px] sm:text-[11px] whitespace-nowrap">x${it.portion || 1}</span>
                            <button type="button" onclick="adjustComboEditorItemPortion(${idx}, 0.5)" class="w-6 h-6 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold cursor-pointer">+</button>
                        </div>
                        <button type="button" onclick="removeComboEditorItem(${idx})" class="w-6 h-6 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 flex items-center justify-center text-xs transition cursor-pointer" title="ลบออกจากเซ็ต">
                            🗑️
                        </button>
                    </div>
                </div>
            `).join('');
        }

        function saveMealComboEditor() {
            const nameInput = document.getElementById('comboEditName');
            const mealSelect = document.getElementById('comboEditMeal');
            const name = (nameInput?.value || '').trim();
            const meal = mealSelect?.value || 'breakfast';

            if (!name) return alert('กรุณาตั้งชื่อเซ็ตอาหารครับ');
            if (_editingComboItems.length === 0) return alert('กรุณาเพิ่มรายการอาหารอย่างน้อย 1 รายการในเซ็ตครับ');

            if (!Array.isArray(state.mealCombos)) state.mealCombos = [];

            if (_editingComboId) {
                const idx = state.mealCombos.findIndex(c => c.id === _editingComboId);
                if (idx >= 0) {
                    state.mealCombos[idx] = {
                        ...state.mealCombos[idx],
                        name,
                        meal,
                        items: _editingComboItems
                    };
                    showToast(`✓ อัปเดตเซ็ต "${name}" เรียบร้อยแล้ว`);
                }
            } else {
                const newCombo = {
                    id: 'combo_' + Date.now(),
                    name,
                    meal,
                    items: _editingComboItems
                };
                state.mealCombos.push(newCombo);
                showToast(`📦 สร้างเซ็ต "${name}" เรียบร้อยแล้ว!`);
            }

            saveState();
            closeMealComboEditor();
            renderFoodDatabaseExplorer();
        }

        window.openMealComboEditor = openMealComboEditor;
        window.onComboFoodSearchInput = onComboFoodSearchInput;
        window.clearComboFoodSearch = clearComboFoodSearch;
        window.addFoodObjectToComboEditor = addFoodObjectToComboEditor;
        window.quickAddChipToCombo = quickAddChipToCombo;
        window.closeMealComboEditor = closeMealComboEditor;
        window.addSelectedFoodToComboEditor = addSelectedFoodToComboEditor;
        window.addManualFoodToComboEditor = addManualFoodToComboEditor;
        window.removeComboEditorItem = removeComboEditorItem;
        window.adjustComboEditorItemPortion = adjustComboEditorItemPortion;
        window.saveMealComboEditor = saveMealComboEditor;
        window.focusWeightInputToday = focusWeightInputToday;
        window.checkWeeklyWeighInNudge = checkWeeklyWeighInNudge;


        // ==========================================
        // SUPPLEMENT & VITAMIN CHECKLIST (v5.6.6)
        // ==========================================
        function renderSupplements() {
            const container = document.getElementById('supplementListContainer');
            const badge = document.getElementById('suppProgressBadge');
            const bar = document.getElementById('barSupplements');
            if (!container) return;

            const dStr = state.selectedDate;
            const defaultList = (typeof window.DEFAULT_SUPPLEMENTS !== 'undefined' && Array.isArray(window.DEFAULT_SUPPLEMENTS))
                ? window.DEFAULT_SUPPLEMENTS
                : (typeof DEFAULT_SUPPLEMENTS !== 'undefined' ? DEFAULT_SUPPLEMENTS : []);
            const supps = Array.isArray(state.supplementList) ? state.supplementList : defaultList;
            const checkedMap = (state.supplementsByDate && state.supplementsByDate[dStr]) || {};

            let takenCount = 0;
            supps.forEach(s => {
                if (checkedMap[s.id]) takenCount++;
            });

            if (badge) {
                badge.textContent = `${takenCount}/${supps.length} ทานแล้ว`;
                badge.className = takenCount === supps.length && supps.length > 0
                    ? 'text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                    : 'text-xs px-2.5 py-0.5 rounded-full font-bold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20';
            }

            if (bar) {
                const pct = supps.length > 0 ? Math.round((takenCount / supps.length) * 100) : 0;
                bar.style.width = `${pct}%`;
            }

            if (supps.length === 0) {
                container.innerHTML = `
                    <div class="col-span-1 sm:col-span-2 text-center py-6 px-4 bg-slate-50/60 dark:bg-slate-700/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                        <div class="text-2xl mb-1.5">💊</div>
                        <div class="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">ยังไม่มีรายการวิตามินหรืออาหารเสริม</div>
                        <div class="text-[11px] text-slate-400 dark:text-slate-500 mb-3">กดปุ่ม "+ เพิ่มวิตามิน" เพื่อบันทึกตัวที่คุณทาน หรือคืนค่าเริ่มต้นได้เลย</div>
                        <div class="flex items-center justify-center gap-2 flex-wrap">
                            <button type="button" onclick="openAddSupplementModal()" class="text-xs px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold shadow-xs transition">
                                + เพิ่มวิตามิน
                            </button>
                            <button type="button" onclick="restoreDefaultSupplements()" class="text-xs px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg font-medium transition">
                                ↺ คืนค่าเริ่มต้น (7 รายการ)
                            </button>
                        </div>
                    </div>
                `;
                return;
            }

            const itemsHtml = supps.map(s => {
                const isTaken = !!checkedMap[s.id];
                const bgClass = isTaken
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-slate-800 dark:text-slate-100 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-700/40 border-slate-200/80 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300';
                const checkIcon = isTaken
                    ? '<span class="w-5 h-5 rounded-md bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-xs">✓</span>'
                    : '<span class="w-5 h-5 rounded-md border border-slate-300 dark:border-slate-500 flex items-center justify-center text-xs shrink-0"></span>';

                return `
                    <div class="flex items-center justify-between p-2.5 rounded-xl border transition ${bgClass} gap-2 cursor-pointer group"
                        onclick="toggleSupplement('${s.id}')">
                        <div class="flex items-center gap-2 min-w-0">
                            ${checkIcon}
                            <div class="min-w-0">
                                <div class="text-xs font-semibold truncate flex items-center gap-1 ${isTaken ? 'line-through text-slate-400' : ''}">
                                    <span>${s.icon || '💊'}</span>
                                    <span>${s.name}</span>
                                </div>
                                <div class="text-[10px] text-slate-400 truncate">${s.time || 'พร้อมอาหาร'}</div>
                            </div>
                        </div>
                        <button type="button" onclick="event.stopPropagation(); deleteSupplement('${s.id}')"
                            class="text-slate-400 hover:text-rose-500 dark:text-slate-500 dark:hover:text-rose-400 p-1.5 text-xs shrink-0 rounded hover:bg-rose-500/10 transition"
                            title="ลบ ${s.name} ออกจากรายการ">✕</button>
                    </div>
                `;
            }).join('');

            const footerHtml = `
                <div class="col-span-1 sm:col-span-2 flex items-center justify-between pt-1 text-[11px] text-slate-400">
                    <span>💡 แตะการ์ดเพื่อติ๊กทานแล้ว หรือกด ✕ เพื่อลบ</span>
                    <button type="button" onclick="restoreDefaultSupplements()" class="text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 underline transition">
                        ↺ คืนค่ารายการเริ่มต้น
                    </button>
                </div>
            `;

            container.innerHTML = itemsHtml + footerHtml;
        }

        function toggleSupplement(suppId) {
            const dStr = state.selectedDate;
            if (!state.supplementsByDate) state.supplementsByDate = {};
            if (!state.supplementsByDate[dStr]) state.supplementsByDate[dStr] = {};
            const cur = !state.supplementsByDate[dStr][suppId];
            state.supplementsByDate[dStr][suppId] = cur;
            saveState();
            renderSupplements();

            const defaultList = (typeof window.DEFAULT_SUPPLEMENTS !== 'undefined' && Array.isArray(window.DEFAULT_SUPPLEMENTS))
                ? window.DEFAULT_SUPPLEMENTS
                : (typeof DEFAULT_SUPPLEMENTS !== 'undefined' ? DEFAULT_SUPPLEMENTS : []);
            const allSupps = Array.isArray(state.supplementList)
                ? state.supplementList
                : defaultList;

            const supp = allSupps.find(s => s.id === suppId);
            if (cur) {
                const allTaken = allSupps.length > 0 && allSupps.every(s => state.supplementsByDate[dStr][s.id]);
                if (allTaken) {
                    showToast('🎉 เยี่ยมมาก! ทานวิตามิน & อาหารเสริมครบทุกตัวตามเป้าของวันนี้แล้ว');
                } else {
                    showToast(`✓ ทาน ${supp?.name || 'วิตามิน'} แล้ว`);
                }
            }
        }

        let _modalOpeningCooldown = 0;

        function openAddSupplementModal() {
            // 1. Auto-uncollapse supplement card if it was collapsed so user sees the list!
            if (state.collapsedSections && state.collapsedSections['section_supplements']) {
                state.collapsedSections['section_supplements'] = false;
                const body = document.getElementById('body_section_supplements');
                const icon = document.getElementById('icon_section_supplements');
                if (body) body.classList.remove('hidden');
                if (icon) icon.textContent = '▲';
            }

            const modal = document.getElementById('addSupplementModal');
            if (!modal) return;
            const inName = document.getElementById('inSuppName');
            const inTime = document.getElementById('inSuppTime');
            const inIcon = document.getElementById('inSuppIcon');
            if (inName) inName.value = '';
            if (inTime) inTime.value = '';
            if (inIcon) inIcon.value = '💊';

            _modalOpeningCooldown = Date.now();
            openModalAnimated('addSupplementModal', () => { if (inName) inName.focus(); });
        }

        function closeAddSupplementModal() {
            closeModalAnimated('addSupplementModal');
        }

        function closeAddSupplementModalOnBackdrop(e) {
            // Guard against mobile touch event ghost-click
            if (Date.now() - _modalOpeningCooldown < 350) return;
            if (e && e.target && e.target.id === 'addSupplementModal') {
                closeAddSupplementModal();
            }
        }

        function submitNewSupplement() {
            const nameInput = document.getElementById('inSuppName');
            const name = nameInput ? nameInput.value.trim() : '';
            const time = (document.getElementById('inSuppTime')?.value || '').trim() || 'ตามเวลาที่สะดวก';
            const icon = (document.getElementById('inSuppIcon')?.value || '').trim() || '💊';
            if (!name) {
                alert('กรุณากรอกชื่อวิตามินหรืออาหารเสริมครับ');
                return;
            }
            if (!Array.isArray(state.supplementList)) {
                state.supplementList = [];
            } else {
                state.supplementList = [...state.supplementList];
            }
            const newSupp = {
                id: 'supp_' + Date.now(),
                name,
                time,
                icon,
                isCustom: true
            };
            state.supplementList.push(newSupp);
            saveState();
            closeAddSupplementModal();

            // Ensure section is expanded so user sees the newly added supplement
            if (state.collapsedSections && state.collapsedSections['section_supplements']) {
                state.collapsedSections['section_supplements'] = false;
                const body = document.getElementById('body_section_supplements');
                const icon = document.getElementById('icon_section_supplements');
                if (body) body.classList.remove('hidden');
                if (icon) icon.textContent = '▲';
            }

            renderSupplements();
            showToast(`✓ เพิ่มอาหารเสริม "${name}" เรียบร้อยแล้ว`);
        }

        function deleteSupplement(suppId) {
            const list = Array.isArray(state.supplementList) ? state.supplementList : [];
            const target = list.find(s => s.id === suppId);
            const targetName = target ? target.name : 'อาหารเสริมนี้';
            showConfirmDialog({
                icon: '💊',
                iconBgClass: 'w-14 h-14 mx-auto rounded-2xl bg-rose-500/15 text-rose-500 flex items-center justify-center text-3xl shadow-xs',
                title: 'ลบรายการวิตามิน / อาหารเสริม',
                message: `ต้องการลบ "${targetName}" ออกจากเช็กลิสต์ประจำวันใช่หรือไม่?`,
                confirmText: 'ลบรายการนี้',
                confirmClass: 'flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition cursor-pointer',
                onConfirm: () => {
                    state.supplementList = list.filter(s => s.id !== suppId);
                    saveState();
                    renderSupplements();
                    showToast(`✓ ลบ "${targetName}" เรียบร้อยแล้ว`);
                }
            });
        }

        function deleteCustomSupplement(suppId) {
            deleteSupplement(suppId);
        }

        function restoreDefaultSupplements() {
            const defaultList = (typeof window.DEFAULT_SUPPLEMENTS !== 'undefined' && Array.isArray(window.DEFAULT_SUPPLEMENTS))
                ? window.DEFAULT_SUPPLEMENTS
                : (typeof DEFAULT_SUPPLEMENTS !== 'undefined' ? DEFAULT_SUPPLEMENTS : []);
            showConfirmDialog({
                icon: '🔄',
                iconBgClass: 'w-14 h-14 mx-auto rounded-2xl bg-indigo-500/15 text-indigo-500 flex items-center justify-center text-3xl shadow-xs',
                title: 'คืนค่าอาหารเสริมเริ่มต้น',
                message: 'ต้องการคืนค่ารายการวิตามิน/อาหารเสริมเริ่มต้น (7 รายการมาตรฐาน) ใช่หรือไม่? รายการที่เพิ่มใหม่จะถูกแทนที่ด้วยชุดมาตรฐาน',
                confirmText: 'คืนค่ามาตรฐาน',
                confirmClass: 'flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition cursor-pointer',
                onConfirm: () => {
                    state.supplementList = JSON.parse(JSON.stringify(defaultList));
                    saveState();
                    renderSupplements();
                    showToast('✓ คืนค่ารายการอาหารเสริมเริ่มต้นเรียบร้อยแล้ว');
                }
            });
        }

        let _aiCoachAnalysisCache = {};
        let _isAiCoachLoading = false;

        function forceReshuffleRecommendations() {
            if (_isAiCoachLoading) return;
            const t = getCalculatedTargets();
            const meals = state.logsByDate[state.selectedDate] || [];
            const sumP = Math.round(meals.reduce((s, m) => s + m.p, 0));
            const sumC = Math.round(meals.reduce((s, m) => s + m.c, 0));
            const sumF = Math.round(meals.reduce((s, m) => s + m.f, 0));
            const sumCal = Math.round(meals.reduce((s, m) => s + m.cal, 0));

            const remCal = t.targetCal - sumCal;
            const remP = Math.max(0, t.pGram - sumP);
            const remC = Math.max(0, t.cGram - sumC);
            const remF = Math.max(0, t.fGram - sumF);

            // Invalidate cache for current state to fetch fresh deep analysis
            const cacheKey = `${state.selectedDate}_${remCal}_${remP}_${remC}_${remF}_${meals.length}`;
            delete _aiCoachAnalysisCache[cacheKey];

            renderSmartRecommendations(remCal, remP, remC, remF, true);
        }

        function generateHeuristicCoachAdvice(remCal, remP, remC, remF, sumCal, targetCal, goal) {
            if (remCal <= 50 && remP <= 10) {
                return '🎉 ยอดเยี่ยมมากครับ! วันนี้คุณคุมอาหารและเติมสารอาหารได้ครบตามเป้าหมาย 100% แล้ว แนะนำจิบน้ำเปล่าให้ครบโควตาแล้วพักผ่อนให้เพียงพอ เพื่อให้ร่างกายฟื้นฟูกล้ามเนื้อได้อย่างเต็มที่ครับ';
            }
            if (remCal < -50) {
                const over = Math.abs(remCal);
                if (remP > 15) {
                    return `⚠️ วันนี้พลังงานเกินเป้าไป ${over.toLocaleString()} kcal และโปรตีนยังขาดอีก ${remP}g สำหรับมื้อที่เหลือแนะนำเลือก 'โปรตีนบริสุทธิ์ไขมันต่ำมาก' เช่น ไข่ขาวต้ม 3-4 ฟอง หรือเวย์โปรตีนไอโซเลท เพื่อช่วยดึงโปรตีนขึ้นโดยไม่เพิ่มไขมันครับ`;
                }
                return `🔥 วันนี้พลังงานเกินเป้าไป ${over.toLocaleString()} kcal แต่ไม่ต้องกังวลครับ ช่วงเย็นนี้แนะนำเน้นดื่มน้ำเปล่า ผักใบเขียวต้ม และออกกำลังกายเบาๆ พรุ่งนี้กลับมาคุมใหม่อย่างต่อเนื่องได้เลยครับ`;
            }
            if (remP >= 25 && remCal < 380) {
                return `💪 โปรตีนยังขาดอีก ${remP}g แต่มีโควตาแคลอรีเหลือเพียง ${Math.max(0, remCal)} kcal มื้อนี้แนะนำเน้น 'โปรตีนลีนไขมันต่ำ' เช่น สเต็กอกไก่ย่างฉีก, ทูน่าในน้ำแร่ หรือไข่ขาว เพื่อปิดยอดโปรตีนให้ถึงเป้าโดยคาร์บและไขมันไม่ล้นครับ`;
            }
            if (remP >= 20) {
                return `🥩 ร่างกายยังต้องการโปรตีนเพิ่มอีก ${remP}g (พลังงานเหลือ ${remCal.toLocaleString()} kcal) แนะนำเติมอาหารจานหลักที่มีเนื้อสัตว์คุณภาพดี เช่น อกไก่, ปลาแซลมอน หรือไข่ต้ม เพื่อเสริมสร้างกล้ามเนื้อและทำให้อิ่มนานครับ`;
            }
            if (remC >= 35 && remCal >= 250) {
                return `🍚 พลังงานยังเหลืออีก ${remCal.toLocaleString()} kcal และคาร์โบไฮเดรตขาด ${remC}g มื้อต่อไปสามารถทานคาร์โบไฮเดรตเชิงซ้อน เช่น ข้าวกล้อง ข้าวไรซ์เบอร์รี่ หรือมันเทศหวาน เพื่อเติมไกลโคเจนให้ร่างกายสดชื่นครับ`;
            }
            return `🥗 วันนี้คุมอาหารได้ดีมาก พลังงานยังเหลืออีก ${Math.max(0, remCal).toLocaleString()} kcal แนะนำเลือกมื้อเบาๆ ที่ย่อยง่าย เช่น สลัดผักอกไก่ โยเกิร์ต หรือผลไม้หวานน้อย เพื่อปิดยอดวันอย่างสมบูรณ์ครับ`;
        }

        function renderSmartRecommendations(remCal, remP, remC, remF, forceReshuffle = false) {
            const container = document.getElementById('smartRecommendationList');
            const subtitle = document.getElementById('recSubtitle');
            const pillsContainer = document.getElementById('aiCoachMacroPills');
            const statusBadge = document.getElementById('aiCoachStatusBadge');
            const modeLabel = document.getElementById('aiCoachModeLabel');
            const btnReshuffle = document.getElementById('btnReshuffleCoach');

            if (!container || !subtitle) return;

            const t = getCalculatedTargets();
            const meals = state.logsByDate[state.selectedDate] || [];
            const sumCal = Math.round(meals.reduce((s, m) => s + m.cal, 0));
            const sumP = Math.round(meals.reduce((s, m) => s + m.p, 0));
            const sumC = Math.round(meals.reduce((s, m) => s + m.c, 0));
            const sumF = Math.round(meals.reduce((s, m) => s + m.f, 0));
            const goal = (state.profile && state.profile.goal) || 'loss';

            // 1. Render Macro Gap Quick Badges
            if (pillsContainer) {
                const calBadge = remCal > 0
                    ? `<span class="px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/25">⚡ เหลือ ${remCal.toLocaleString()} kcal</span>`
                    : `<span class="px-2 py-0.5 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold border border-rose-500/25">🔥 เกิน ${Math.abs(remCal).toLocaleString()} kcal</span>`;

                const pBadge = remP > 0
                    ? `<span class="px-2 py-0.5 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 font-semibold border border-blue-500/25">🥩 โปรตีนขาด ${remP}g</span>`
                    : `<span class="px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/25">✓ โปรตีนครบ</span>`;

                const cBadge = remC > 0
                    ? `<span class="px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold border border-amber-500/25">🍚 คาร์บขาด ${remC}g</span>`
                    : `<span class="px-2 py-0.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-medium">✓ คาร์บครบ</span>`;

                const fBadge = remF > 0
                    ? `<span class="px-2 py-0.5 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400 font-semibold border border-rose-500/25">🥑 ไขมันขาด ${remF}g</span>`
                    : `<span class="px-2 py-0.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-medium">✓ ไขมันครบ</span>`;

                pillsContainer.innerHTML = `${calBadge}${pBadge}${cBadge}${fBadge}`;
            }

            // 2. Goal Complete Check
            if (remCal <= 50 && remP <= 10) {
                if (statusBadge) {
                    statusBadge.textContent = '🎉 ถึงเป้าหมายแล้ว';
                    statusBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shrink-0';
                }
                if (modeLabel) modeLabel.textContent = 'วิเคราะห์: สารอาหารครบ 100%';
                subtitle.textContent = generateHeuristicCoachAdvice(remCal, remP, remC, remF, sumCal, t.targetCal, goal);
                container.innerHTML = `
                    <div class="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-700 dark:text-emerald-300 font-medium flex items-center gap-3">
                        <div class="text-2xl">🎉</div>
                        <div>
                            <div class="font-bold text-sm">สารอาหารและพลังงานครบถ้วนสมบูรณ์!</div>
                            <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">วันนี้ทำได้ยอดเยี่ยมมากครับ แนะนำจิบน้ำเปล่าให้ครบหลอดด้านบน แล้วพักผ่อนให้สบายได้เลย</p>
                        </div>
                    </div>
                `;
                return;
            }

            // Helper to render food cards
            function renderFoodCards(foodItems) {
                container.innerHTML = foodItems.map(item => {
                    const safeName = item.name.replace(/'/g, "\\'");
                    const whyHtml = item.why
                        ? `<span class="text-[10px] px-2 py-0.5 rounded-md bg-purple-500/15 dark:bg-purple-500/25 text-purple-700 dark:text-purple-300 font-medium border border-purple-500/30 dark:border-purple-500/40">${item.why}</span>`
                        : '';
                    return `
                        <div class="flex items-center justify-between p-3.5 rounded-2xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 border border-slate-200/90 dark:border-slate-700/80 gap-3 transition shadow-2xs hover:border-purple-500/40">
                            <div class="min-w-0 flex-1">
                                <div class="flex items-center gap-1.5 flex-wrap">
                                    <span class="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 truncate">${item.name}</span>
                                    <span class="text-[11px] text-slate-400 dark:text-slate-400 font-normal">(${item.servingSize || '1 เสิร์ฟ'})</span>
                                    ${whyHtml}
                                </div>
                                <div class="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap gap-2.5">
                                    <span class="text-emerald-600 dark:text-emerald-400 font-bold">${item.calories} kcal</span>
                                    <span class="text-blue-600 dark:text-blue-400 font-semibold">โปรตีน ${item.protein}g</span>
                                    <span class="text-amber-600 dark:text-amber-400 font-medium">คาร์บ ${item.carbs}g</span>
                                    <span class="text-rose-600 dark:text-rose-400 font-medium">ไขมัน ${item.fat}g</span>
                                </div>
                            </div>
                            <div class="flex items-center gap-1.5 shrink-0">
                                <button type="button" onclick="openFoodMealPicker('${safeName}', ${item.protein}, ${item.carbs}, ${item.fat}, ${item.calories}, event)"
                                    title="เลือกมื้ออาหารที่จะบันทึก"
                                    class="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold transition active:scale-95 border border-slate-200 dark:border-slate-600">
                                    📋
                                </button>
                                <button type="button" onclick="addFoodItem('${safeName}', ${item.protein}, ${item.carbs}, ${item.fat}, ${item.calories})"
                                    class="text-xs px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-bold transition shadow-xs flex items-center gap-1">
                                    <span>+</span> <span>กินเมนูนี้</span>
                                </button>
                            </div>
                        </div>
                    `;
                }).join('');
            }

            // Helper to get curated heuristic candidates
            function getHeuristicCandidates() {
                const allFoods = [];
                if (typeof FOOD_DATABASE !== 'undefined' && FOOD_DATABASE.categories) {
                    FOOD_DATABASE.categories.forEach(c => {
                        c.foods.forEach(f => allFoods.push({ ...f, catName: c.name }));
                    });
                }
                let candidates = [];
                if (remP >= 20 && remCal < 400) {
                    candidates = allFoods.filter(f => f.protein >= 15 && f.calories <= 320);
                } else if (remP >= 25) {
                    candidates = allFoods.filter(f => f.protein >= 20 && f.calories <= Math.max(350, remCal + 100));
                } else if (remC >= 30 && remCal >= 200) {
                    candidates = allFoods.filter(f => f.carbs >= 25 && f.calories <= remCal + 100 && f.calories >= 100);
                } else {
                    candidates = allFoods.filter(f => f.calories > 40 && f.calories <= Math.max(250, remCal + 50));
                }
                if (candidates.length === 0) {
                    candidates = allFoods.filter(f => f.protein >= 12);
                }
                return [...candidates].sort(() => 0.5 - Math.random()).slice(0, 4);
            }

            const cacheKey = `${state.selectedDate}_${remCal}_${remP}_${remC}_${remF}_${meals.length}`;
            const cachedAi = _aiCoachAnalysisCache[cacheKey];

            // If we already have a cached AI analysis for this exact macro state, use it immediately
            if (cachedAi && !forceReshuffle) {
                subtitle.textContent = cachedAi.coachAdvice;
                if (statusBadge) {
                    statusBadge.textContent = '✓ วิเคราะห์โดย Gemini Flash';
                    statusBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30 shrink-0';
                }
                if (modeLabel) modeLabel.textContent = `โมเดล: ${cachedAi.model || 'Gemini Flash'}`;
                if (cachedAi.suggestedMenus && cachedAi.suggestedMenus.length > 0) {
                    renderFoodCards(cachedAi.suggestedMenus);
                } else {
                    renderFoodCards(getHeuristicCandidates());
                }
                return;
            }

            const apiKey = (typeof window.getGeminiApiKey === 'function') ? window.getGeminiApiKey() : '';
            const hasGeminiFn = typeof window.requestGeminiCoachAdvice === 'function';

            // 3. User clicked "✨ วิเคราะห์ใหม่" (forceReshuffle = true) and has API key -> Call Gemini with Loading Skeleton UX
            if (forceReshuffle && apiKey && hasGeminiFn) {
                _isAiCoachLoading = true;
                if (btnReshuffle) {
                    btnReshuffle.disabled = true;
                    btnReshuffle.innerHTML = `<span class="inline-block animate-spin">✨</span> <span>กำลังวิเคราะห์...</span>`;
                }
                if (statusBadge) {
                    statusBadge.textContent = '✨ AI กำลังวิเคราะห์...';
                    statusBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 shrink-0 animate-pulse';
                }
                if (modeLabel) modeLabel.textContent = 'กำลังประมวลผลผ่าน Gemini Flash...';

                // Display Shimmering Subtitle
                subtitle.innerHTML = `
                    <div class="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-semibold animate-pulse text-xs sm:text-sm">
                        <span class="inline-block w-2.5 h-2.5 rounded-full bg-purple-500 animate-ping shrink-0"></span>
                        <span>AI Macro Coach กำลังคำนวณสัดส่วนสารอาหารคงเหลือและเมนูที่เหมาะสม...</span>
                    </div>
                `;

                // Display Shimmering Loading Skeleton Cards
                container.innerHTML = `
                    <div class="space-y-2.5 animate-pulse">
                        <div class="p-3.5 rounded-2xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-3">
                            <div class="flex-1 space-y-2">
                                <div class="h-4 bg-slate-200 dark:bg-slate-700 rounded-md w-2/5"></div>
                                <div class="flex gap-2">
                                    <div class="h-3 bg-slate-200 dark:bg-slate-700 rounded-md w-14"></div>
                                    <div class="h-3 bg-slate-200 dark:bg-slate-700 rounded-md w-16"></div>
                                    <div class="h-3 bg-slate-200 dark:bg-slate-700 rounded-md w-14"></div>
                                </div>
                            </div>
                            <div class="w-20 h-8 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>
                        </div>
                        <div class="p-3.5 rounded-2xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-3">
                            <div class="flex-1 space-y-2">
                                <div class="h-4 bg-slate-200 dark:bg-slate-700 rounded-md w-1/2"></div>
                                <div class="flex gap-2">
                                    <div class="h-3 bg-slate-200 dark:bg-slate-700 rounded-md w-16"></div>
                                    <div class="h-3 bg-slate-200 dark:bg-slate-700 rounded-md w-14"></div>
                                    <div class="h-3 bg-slate-200 dark:bg-slate-700 rounded-md w-14"></div>
                                </div>
                            </div>
                            <div class="w-20 h-8 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>
                        </div>
                        <div class="p-3.5 rounded-2xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-3">
                            <div class="flex-1 space-y-2">
                                <div class="h-4 bg-slate-200 dark:bg-slate-700 rounded-md w-1/3"></div>
                                <div class="flex gap-2">
                                    <div class="h-3 bg-slate-200 dark:bg-slate-700 rounded-md w-14"></div>
                                    <div class="h-3 bg-slate-200 dark:bg-slate-700 rounded-md w-16"></div>
                                    <div class="h-3 bg-slate-200 dark:bg-slate-700 rounded-md w-14"></div>
                                </div>
                            </div>
                            <div class="w-20 h-8 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>
                        </div>
                    </div>
                `;

                window.requestGeminiCoachAdvice({
                    targetCal: t.targetCal,
                    pGram: t.pGram,
                    cGram: t.cGram,
                    fGram: t.fGram,
                    consumedCal: sumCal,
                    consumedP: sumP,
                    consumedC: sumC,
                    consumedF: sumF,
                    remCal,
                    remP,
                    remC,
                    remF,
                    goal,
                    todayMeals: meals.map(m => `${m.name} (${m.cal} kcal, P:${m.p}g)`)
                }).then(aiRes => {
                    _isAiCoachLoading = false;
                    if (btnReshuffle) {
                        btnReshuffle.disabled = false;
                        btnReshuffle.innerHTML = `<span>✨</span> <span>วิเคราะห์ใหม่</span>`;
                    }
                    if (aiRes && aiRes.coachAdvice) {
                        _aiCoachAnalysisCache[cacheKey] = aiRes;
                        subtitle.textContent = aiRes.coachAdvice;
                        if (statusBadge) {
                            statusBadge.textContent = '✓ วิเคราะห์โดย Gemini Flash';
                            statusBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30 shrink-0';
                        }
                        if (modeLabel) modeLabel.textContent = `โมเดล: ${aiRes.model || 'Gemini Flash'}`;
                        if (aiRes.suggestedMenus && aiRes.suggestedMenus.length > 0) {
                            renderFoodCards(aiRes.suggestedMenus);
                        } else {
                            renderFoodCards(getHeuristicCandidates());
                        }
                        showToast('✨ AI Macro Coach วิเคราะห์คำแนะนำสำเร็จ!');
                    } else {
                        // Fallback to heuristic
                        subtitle.textContent = generateHeuristicCoachAdvice(remCal, remP, remC, remF, sumCal, t.targetCal, goal);
                        if (statusBadge) {
                            statusBadge.textContent = '✓ โค้ชพร้อมแนะนำ';
                            statusBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shrink-0';
                        }
                        if (modeLabel) modeLabel.textContent = 'วิเคราะห์จากโควตาสารอาหารวันนี้';
                        renderFoodCards(getHeuristicCandidates());
                    }
                }).catch(err => {
                    console.warn('AI Coach background analysis error:', err);
                    _isAiCoachLoading = false;
                    if (btnReshuffle) {
                        btnReshuffle.disabled = false;
                        btnReshuffle.innerHTML = `<span>✨</span> <span>วิเคราะห์ใหม่</span>`;
                    }
                    subtitle.textContent = generateHeuristicCoachAdvice(remCal, remP, remC, remF, sumCal, t.targetCal, goal);
                    if (statusBadge) {
                        statusBadge.textContent = '✓ โค้ชพร้อมแนะนำ';
                        statusBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shrink-0';
                    }
                    if (modeLabel) modeLabel.textContent = 'วิเคราะห์จากโควตาสารอาหารวันนี้';
                    renderFoodCards(getHeuristicCandidates());
                });
                return;
            }

            // 4. Default / Regular Render (Page load, date shift, meal logging)
            // Zero latency, zero quota consumed: use Smart Heuristic Engine!
            subtitle.textContent = generateHeuristicCoachAdvice(remCal, remP, remC, remF, sumCal, t.targetCal, goal);
            if (statusBadge) {
                statusBadge.textContent = '✓ โค้ชพร้อมแนะนำ';
                statusBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shrink-0';
            }
            if (modeLabel) modeLabel.textContent = 'วิเคราะห์จากโควตาสารอาหารวันนี้';
            if (btnReshuffle) {
                btnReshuffle.disabled = false;
                btnReshuffle.innerHTML = `<span>✨</span> <span>วิเคราะห์ใหม่</span>`;
            }
            renderFoodCards(getHeuristicCandidates());
            if (forceReshuffle) {
                showToast('✨ สุ่มเมนูแนะนำชุดใหม่เรียบร้อย');
            }
        }

        function adjustWater(delta) {
            const dStr = state.selectedDate;
            const cur = state.waterByDate[dStr] || 0;
            state.waterByDate[dStr] = Math.max(0, cur + delta);
            if (delta > 0) playSound('water'); else playSound('delete');
            saveState();
            const t = getCalculatedTargets();
            renderDateTrackerAndRecommendations(t, false);
            if (typeof triggerLivingCompanionCheck === 'function') {
                triggerLivingCompanionCheck(600, true);
            }
        }

        function setWaterDirect(glasses) {
            const dStr = state.selectedDate;
            const cur = state.waterByDate[dStr] || 0;
            state.waterByDate[dStr] = (cur === glasses) ? glasses - 1 : glasses;
            playSound('water');
            saveState();
            const t = getCalculatedTargets();
            renderDateTrackerAndRecommendations(t, false);
            if (typeof triggerLivingCompanionCheck === 'function') {
                triggerLivingCompanionCheck(600, true);
            }
        }

        function onDateChange(val) {
            if (!val) return;
            const changed = state.selectedDate !== val;
            state.selectedDate = val;
            if (changed) {
                state.activeMeal = 'breakfast';
            }
            saveState();
            renderAll();
        }

        function shiftDate(days) {
            const d = new Date(state.selectedDate + 'T00:00:00');
            d.setDate(d.getDate() + days);
            const offset = d.getTimezoneOffset() * 60000;
            const newDateStr = new Date(d.getTime() - offset).toISOString().split('T')[0];
            if (state.selectedDate !== newDateStr) {
                state.selectedDate = newDateStr;
                state.activeMeal = 'breakfast';
                saveState();
                renderAll();
            }
        }

        function goToToday() {
            state.selectedDate = getTodayStr();
            state.activeMeal = 'breakfast';
            saveState();
            renderAll();
            showToast('📅 กลับสู่วันปัจจุบัน (มื้อเช้า) เรียบร้อย');
        }

        function addFoodItem(name, p, c, f, explicitCal, targetMeal, targetPortion) {
            const dStr = state.selectedDate;
            if (!state.logsByDate[dStr]) state.logsByDate[dStr] = [];

            const meal = targetMeal || state.activeMeal || getDefaultMealByTime();
            const portion = targetPortion !== undefined ? Number(targetPortion) : (Number(state.selectedPortion) || 1);

            const baseCal = explicitCal !== undefined && explicitCal !== null
                ? Math.round(explicitCal)
                : Math.round(p * 4 + c * 4 + f * 9);
            const baseP = Number(p);
            const baseC = Number(c);
            const baseF = Number(f);

            const finalCal = Math.round(baseCal * portion);
            const finalP = Math.round(baseP * portion * 10) / 10;
            const finalC = Math.round(baseC * portion * 10) / 10;
            const finalF = Math.round(baseF * portion * 10) / 10;

            const time = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
            state.logsByDate[dStr].push({
                id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
                name,
                meal,
                portion,
                baseCal, baseP, baseC, baseF,
                cal: finalCal,
                p: finalP,
                c: finalC,
                f: finalF,
                time
            });
            state.lastAddedFoodName = name;
            saveState();
            playSound('pop');
            renderAll();
            const mealName = MEAL_CONFIG[meal]?.name || 'มื้ออาหาร';
            const portionStr = portion !== 1 ? ` (x${portion})` : '';
            showToast(`✅ เพิ่ม "${name}"${portionStr} ลงใน ${mealName} (${finalCal} kcal) แล้ว`);
        }

        // ==========================================
        // Quick Food Meal Picker Modal (v5.3.7)
        // ==========================================
        window._pendingFoodPickerItem = null;
        window._pendingFoodPickerPortion = 1;

        function openFoodMealPicker(name, p, c, f, explicitCal, event) {
            if (event) event.stopPropagation();
            window._pendingFoodPickerItem = { name, p, c, f, explicitCal };
            window._pendingFoodPickerPortion = Number(state.selectedPortion) || 1;

            const titleEl = document.getElementById('foodPickerTitle');
            const subEl = document.getElementById('foodPickerSubtitle');
            if (titleEl) titleEl.textContent = name;
            if (subEl) subEl.textContent = `${explicitCal} kcal | P:${p}g C:${c}g F:${f}g`;

            setFoodPickerPortion(window._pendingFoodPickerPortion);

            // Highlight current active meal with a small badge
            ['breakfast', 'lunch', 'dinner', 'snack'].forEach(m => {
                const badge = document.getElementById(`foodPickerBadge_${m}`);
                if (badge) {
                    badge.classList.toggle('hidden', state.activeMeal !== m);
                }
            });

            const modal = document.getElementById('foodMealPickerModal');
            if (modal) {
                modal.classList.remove('hidden');
                requestAnimationFrame(() => modal.classList.add('modal-open'));
            }
        }

        function setFoodPickerPortion(portion) {
            window._pendingFoodPickerPortion = portion;
            const label = document.getElementById('foodPickerPortionLabel');
            if (label) {
                label.textContent = portion === 1 ? '1x (ปกติ)' : `${portion}x`;
            }
            const btns = document.querySelectorAll('.food-picker-portion-btn');
            btns.forEach(b => {
                const p = parseFloat(b.getAttribute('data-portion'));
                if (p === portion) {
                    b.className = 'food-picker-portion-btn py-1.5 rounded-xl border border-emerald-500 bg-emerald-500 text-white text-xs font-bold shadow-xs';
                } else {
                    b.className = 'food-picker-portion-btn py-1.5 rounded-xl border border-slate-200 dark:border-slate-600 text-xs font-semibold hover:border-emerald-500';
                }
            });
        }

        function submitFoodMealPicker(targetMeal) {
            if (!window._pendingFoodPickerItem) return;
            const { name, p, c, f, explicitCal } = window._pendingFoodPickerItem;
            const portion = window._pendingFoodPickerPortion || 1;
            addFoodItem(name, p, c, f, explicitCal, targetMeal, portion);
            closeFoodMealPickerModal();
        }

        function closeFoodMealPickerModal() {
            const modal = document.getElementById('foodMealPickerModal');
            if (!modal) return;
            modal.classList.remove('modal-open');
            setTimeout(() => {
                modal.classList.add('hidden');
                window._pendingFoodPickerItem = null;
            }, 250);
        }

        function closeFoodMealPickerOnBackdrop(event) {
            if (event.target === event.currentTarget) {
                closeFoodMealPickerModal();
            }
        }

        function updateMealItemPortion(id, delta) {
            const dStr = state.selectedDate;
            if (!state.logsByDate[dStr]) return;
            const item = state.logsByDate[dStr].find(m => m.id === id);
            if (!item) return;

            let curPortion = Number(item.portion) || 1;
            let newPortion = Math.round((curPortion + delta) * 10) / 10;
            if (newPortion < 0.5) {
                if (confirm(`ต้องการลบรายการ "${item.name}" ใช่หรือไม่?`)) {
                    removeFoodItem(id);
                }
                return;
            }
            if (newPortion > 10) newPortion = 10;

            const baseCal = item.baseCal !== undefined ? item.baseCal : Math.round(item.cal / curPortion);
            const baseP = item.baseP !== undefined ? item.baseP : Math.round((item.p / curPortion) * 10) / 10;
            const baseC = item.baseC !== undefined ? item.baseC : Math.round((item.c / curPortion) * 10) / 10;
            const baseF = item.baseF !== undefined ? item.baseF : Math.round((item.f / curPortion) * 10) / 10;

            item.portion = newPortion;
            item.baseCal = baseCal;
            item.baseP = baseP;
            item.baseC = baseC;
            item.baseF = baseF;
            item.cal = Math.round(baseCal * newPortion);
            item.p = Math.round(baseP * newPortion * 10) / 10;
            item.c = Math.round(baseC * newPortion * 10) / 10;
            item.f = Math.round(baseF * newPortion * 10) / 10;

            saveState();
            renderAll();
            showToast(`ปรับปริมาณ "${item.name}" เป็น x${newPortion} (${item.cal} kcal)`);
        }

        function changeMealCategory(id, newMeal) {
            const dStr = state.selectedDate;
            if (!state.logsByDate[dStr]) return;
            const item = state.logsByDate[dStr].find(m => m.id === id);
            if (!item) return;
            item.meal = newMeal;
            saveState();
            renderAll();
            if (window.triggerCloudSync) window.triggerCloudSync(false);
            showToast(`ย้าย "${item.name}" ไปยัง ${MEAL_CONFIG[newMeal]?.name || newMeal} แล้ว`);
        }

        function addCustomFood(saveAsPreset) {
            const name = document.getElementById('inFoodName').value.trim();
            const calInput = parseFloat(document.getElementById('inFoodCal').value);
            const p = parseFloat(document.getElementById('inFoodP').value) || 0;
            const c = parseFloat(document.getElementById('inFoodC').value) || 0;
            const f = parseFloat(document.getElementById('inFoodF').value) || 0;
            if (!name) return alert('กรุณาใส่ชื่อเมนูอาหารครับ');

            const finalCal = !isNaN(calInput) && calInput > 0 ? Math.round(calInput) : Math.round(p * 4 + c * 4 + f * 9);

            if (saveAsPreset) {
                state.customPresets.push({ name, servingSize: 'กำหนดเอง', calories: finalCal, protein: p, carbs: c, fat: f });
            }
            addFoodItem(name, p, c, f, finalCal);
            document.getElementById('inFoodName').value = '';
            document.getElementById('inFoodCal').value = '';
            document.getElementById('inFoodP').value = '';
            document.getElementById('inFoodC').value = '';
            document.getElementById('inFoodF').value = '';
        }

        function removeFoodItem(id) {
            const dStr = state.selectedDate;
            if (!state.logsByDate[dStr]) return;
            state.logsByDate[dStr] = state.logsByDate[dStr].filter(m => m.id && m.id !== id);
            playSound('delete');
            if (window.triggerCloudSync) window.triggerCloudSync(false);
            saveState();
            renderAll();
        }

        function clearSelectedDateMeals() {
            const dStr = state.selectedDate;
            if (!state.logsByDate[dStr] || state.logsByDate[dStr].length === 0) return;
            showConfirmDialog({
                icon: '⚠️',
                iconBgClass: 'w-14 h-14 mx-auto rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center text-3xl shadow-xs',
                title: 'ล้างรายการอาหารของวัน',
                message: `ต้องการล้างรายการอาหารทั้งหมดของวันที่ ${dStr} ใช่หรือไม่? รายการอาหารของวันนี้จะถูกลบทั้งหมด`,
                confirmText: 'ล้างข้อมูลวันนี้',
                confirmClass: 'flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition cursor-pointer',
                onConfirm: () => {
                    delete state.logsByDate[dStr];
                    saveState();
                    renderAll();
                    if (window.triggerCloudSync) window.triggerCloudSync(false);
                    showToast(`✓ ล้างรายการอาหารของวันที่ ${dStr} เรียบร้อยแล้ว`);
                }
            });
        }

        function copyYesterdayMeals() {
            const d = new Date(state.selectedDate + 'T00:00:00');
            d.setDate(d.getDate() - 1);
            const offset = d.getTimezoneOffset() * 60000;
            const yStr = new Date(d.getTime() - offset).toISOString().split('T')[0];
            const yMeals = state.logsByDate[yStr] || [];
            if (yMeals.length === 0) {
                return alert(`ไม่มีรายการอาหารในวันที่ ${yStr} ให้คัดลอกครับ`);
            }
            if (!state.logsByDate[state.selectedDate]) state.logsByDate[state.selectedDate] = [];
            yMeals.forEach(m => {
                const portion = m.portion || 1;
                state.logsByDate[state.selectedDate].push({
                    ...m,
                    meal: m.meal || inferMealFromTime(m.time),
                    portion: portion,
                    baseCal: m.baseCal !== undefined ? m.baseCal : Math.round(m.cal / portion),
                    baseP: m.baseP !== undefined ? m.baseP : Math.round((m.p / portion) * 10) / 10,
                    baseC: m.baseC !== undefined ? m.baseC : Math.round((m.c / portion) * 10) / 10,
                    baseF: m.baseF !== undefined ? m.baseF : Math.round((m.f / portion) * 10) / 10,
                    id: Date.now().toString() + Math.random().toString(36).slice(2, 6)
                });
            });
            saveState();
            renderAll();
            showToast('📋 คัดลอกมื้ออาหารจากเมื่อวานเรียบร้อย');
        }

        function copyDailySummaryToClipboard() {
            const t = getCalculatedTargets();
            const dStr = state.selectedDate;
            const meals = state.logsByDate[dStr] || [];
            const sumP = Math.round(meals.reduce((s, m) => s + m.p, 0));
            const sumC = Math.round(meals.reduce((s, m) => s + m.c, 0));
            const sumF = Math.round(meals.reduce((s, m) => s + m.f, 0));
            const sumCal = Math.round(meals.reduce((s, m) => s + m.cal, 0));
            const remCal = t.targetCal - sumCal;

            const dayWorkouts = (state.workoutsByDate && state.workoutsByDate[dStr]) || [];
            const burnedCal = dayWorkouts.reduce((s, w) => s + w.cal, 0);
            const netCal = sumCal - burnedCal;

            const waterGlasses = state.waterByDate[dStr] || 0;
            const waterMl = waterGlasses * 250;

            const dateObj = new Date(dStr + 'T00:00:00');
            const thaiDate = dateObj.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

            let calStatus = '';
            if (remCal > 0) calStatus = `(ขาดอีก ${remCal.toLocaleString()} kcal)`;
            else if (remCal < 0) calStatus = `(เกินเป้า ${Math.abs(remCal).toLocaleString()} kcal)`;
            else calStatus = `(ครบเป๊ะ!)`;

            const mealGroups = {
                breakfast: [],
                lunch: [],
                dinner: [],
                snack: []
            };
            meals.forEach(m => {
                const k = m.meal && mealGroups[m.meal] ? m.meal : 'breakfast';
                mealGroups[k].push(m);
            });

            const formatMealLine = (key) => {
                const cfg = MEAL_CONFIG[key];
                const items = mealGroups[key];
                if (items.length === 0) return `${cfg.icon} ${cfg.name}: -`;
                const mealCal = Math.round(items.reduce((s, x) => s + x.cal, 0));
                const itemNames = items.map(x => `${x.name}${x.portion && x.portion !== 1 ? ` (x${x.portion})` : ''}`).join(', ');
                return `${cfg.icon} ${cfg.name} (${mealCal} kcal): ${itemNames}`;
            };

            const dayType = (state.dayTypeByDate && state.dayTypeByDate[dStr]) || 'training';
            const dayTypeLabel = dayType === 'rest' ? '🛋️ วันพัก (Rest Day • คาร์บ -15%)' : '🏋️ วันซ้อม (Training Day • มาตรฐาน)';

            const daySupps = (state.supplementsByDate && state.supplementsByDate[dStr]) || [];
            const allSupps = state.supplementList || [];
            let suppSummary = null;
            if (allSupps.length > 0) {
                const doneCount = allSupps.filter(s => daySupps.includes(s.id)).length;
                suppSummary = `💊 วิตามิน & อาหารเสริม: ${doneCount}/${allSupps.length} รายการ`;
            }

            const recordedWeight = state.weightsByDate && state.weightsByDate[dStr];

            const summaryLines = [
                `📊 บันทึกโภชนาการ NovaFit Pro (by BenzNova)`,
                `📅 วัน${thaiDate}`,
                `โหมด: ${dayTypeLabel}`,
                recordedWeight ? `⚖️ น้ำหนักวันนี้: ${recordedWeight} กก.` : null,
                `━━━━━━━━━━━━━━━━━━━━`,
                `🔥 แคลอรีทาน: ${sumCal.toLocaleString()} / ${t.targetCal.toLocaleString()} kcal ${calStatus}`,
                burnedCal > 0 ? `🏃 เบิร์นออกกำลัง: -${burnedCal.toLocaleString()} kcal (${dayWorkouts.map(w => w.name).join(', ')})` : null,
                burnedCal > 0 ? `🎯 แคลอรีสุทธิ (Net): ${netCal.toLocaleString()} kcal` : null,
                `🥩 โปรตีน: ${sumP} / ${t.pGram} g`,
                `🍚 คาร์โบไฮเดรต: ${sumC} / ${t.cGram} g`,
                `🥑 ไขมัน: ${sumF} / ${t.fGram} g`,
                `💧 น้ำดื่ม: ${waterGlasses} / ${t.waterTargetGlasses} แก้ว (${waterMl.toLocaleString()} / ${t.waterTargetMl.toLocaleString()} มล.)`,
                suppSummary,
                `━━━━━━━━━━━━━━━━━━━━`,
                `🍽️ รายการมื้ออาหาร:`,
                formatMealLine('breakfast'),
                formatMealLine('lunch'),
                formatMealLine('dinner'),
                formatMealLine('snack'),
                `━━━━━━━━━━━━━━━━━━━━`,
                `✨ บันทึกผ่าน NovaFit Pro • by BenzNova`
            ].filter(Boolean);

            const text = summaryLines.join('\n');

            const onCopySuccess = () => {
                showToast('📋 คัดลอกสรุปประจำวันแล้ว! ส่งเข้า LINE ได้ทันที');
            };

            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(onCopySuccess).catch(() => {
                    fallbackCopyText(text, onCopySuccess);
                });
            } else {
                fallbackCopyText(text, onCopySuccess);
            }
        }

        function fallbackCopyText(text, cb) {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            try {
                document.execCommand('copy');
                if (cb) cb();
            } catch (e) {
                alert('ไม่สามารถคัดลอกได้อัตโนมัติ กรุณาลองใหม่อีกครั้งครับ');
            }
            document.body.removeChild(textarea);
        }

        // Daily Deficit Report Modal (Includes Water Intake & Workouts)
        function openDailyReportModal() {
            const t = getCalculatedTargets();
            const dStr = state.selectedDate;
            const meals = state.logsByDate[dStr] || [];
            const sumP = Math.round(meals.reduce((s, m) => s + m.p, 0));
            const sumC = Math.round(meals.reduce((s, m) => s + m.c, 0));
            const sumF = Math.round(meals.reduce((s, m) => s + m.f, 0));
            const sumCal = Math.round(meals.reduce((s, m) => s + m.cal, 0));

            const dayWorkouts = (state.workoutsByDate && state.workoutsByDate[dStr]) || [];
            const burnedCal = dayWorkouts.reduce((s, w) => s + w.cal, 0);
            const netCal = sumCal - burnedCal;

            const waterGlasses = state.waterByDate[dStr] || 0;
            const waterMl = waterGlasses * 250;
            const diffWaterMl = t.waterTargetMl - waterMl;

            const diffCal = t.targetCal - sumCal;
            const diffP = t.pGram - sumP;
            const diffC = t.cGram - sumC;
            const diffF = t.fGram - sumF;

            const rowHtml = (label, eaten, target, diff, unit, color) => {
                const status = diff > 0
                    ? `<span class="text-amber-500 font-bold">ขาดอีก ${diff.toLocaleString()} ${unit}</span>`
                    : diff < 0
                        ? `<span class="text-rose-500 font-bold">เกินมา ${Math.abs(diff).toLocaleString()} ${unit}</span>`
                        : `<span class="text-emerald-500 font-bold">ครบเป๊ะ!</span>`;
                return `
                    <div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                        <div>
                            <span class="font-bold ${color}">${label}</span>
                            <span class="text-slate-400 block text-[11px]">ทำได้ ${eaten.toLocaleString()} / เป้าหมาย ${target.toLocaleString()} ${unit}</span>
                        </div>
                        <div class="text-right">${status}</div>
                    </div>
                `;
            };

            const waterStatus = diffWaterMl > 0
                ? `<span class="text-amber-500 font-bold">ขาดอีก ${Math.round(diffWaterMl / 250)} แก้ว (${diffWaterMl.toLocaleString()} มล.)</span>`
                : `<span class="text-emerald-500 font-bold">ดื่มครบเป้าแล้ว! (${waterGlasses} แก้ว)</span>`;

            const recordedWeight = state.weightsByDate && state.weightsByDate[dStr];
            const weightRowHtml = recordedWeight
                ? `
                    <div class="flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                        <div>
                            <span class="font-bold text-emerald-600 dark:text-emerald-400">⚖️ น้ำหนักตัวที่บันทึกวันนี้</span>
                            <span class="text-slate-400 block text-[11px]">ใช้คำนวณอัตราเผาผลาญประจำวัน</span>
                        </div>
                        <div class="text-right font-bold text-emerald-500">${recordedWeight} กก.</div>
                    </div>
                `
                : '';

            const workoutRowHtml = burnedCal > 0
                ? `
                    <div class="flex items-center justify-between p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20">
                        <div>
                            <span class="font-bold text-orange-500">🏃 กิจกรรมออกกำลังกาย (เบิร์น)</span>
                            <span class="text-slate-400 block text-[11px]">${dayWorkouts.map(w => `${w.name} (-${w.cal})`).join(', ')}</span>
                        </div>
                        <div class="text-right">
                            <span class="text-orange-500 font-bold block">-${burnedCal.toLocaleString()} kcal</span>
                            <span class="text-[10px] text-slate-400 font-medium">Net: ${netCal.toLocaleString()} kcal</span>
                        </div>
                    </div>
                `
                : '';

            document.getElementById('dailyReportModalContent').innerHTML = `
                <p class="text-slate-500 dark:text-slate-400">สรุปข้อมูลของวันที่ <b>${dStr}</b> (${meals.length} รายการอาหาร):</p>
                <div class="space-y-2">
                    ${weightRowHtml}
                    ${rowHtml('🔥 พลังงานรวม (Calories)', sumCal, t.targetCal, diffCal, 'kcal', 'text-emerald-500')}
                    ${workoutRowHtml}
                    ${rowHtml('🥩 โปรตีน (Protein)', sumP, t.pGram, diffP, 'g', 'text-blue-500')}
                    ${rowHtml('🍚 คาร์โบไฮเดรต (Carbs)', sumC, t.cGram, diffC, 'g', 'text-amber-500')}
                    ${rowHtml('🥑 ไขมัน (Fat)', sumF, t.fGram, diffF, 'g', 'text-rose-500')}
                    <div class="flex items-center justify-between p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20">
                        <div>
                            <span class="font-bold text-sky-500">💧 น้ำดื่มสะอาด (Water)</span>
                            <span class="text-slate-400 block text-[11px]">ดื่มแล้ว ${waterMl.toLocaleString()} / เป้าหมาย ${t.waterTargetMl.toLocaleString()} มล.</span>
                        </div>
                        <div class="text-right">${waterStatus}</div>
                    </div>
                </div>
            `;
            document.getElementById('dailyReportModal').classList.remove('hidden');
        }

        function closeDailyReportModal() {
            document.getElementById('dailyReportModal').classList.add('hidden');
        }

        function openChangelogModal(isNewUpdate = false) {
            const alertEl = document.getElementById('whatsNewAlert');
            if (alertEl) {
                alertEl.classList.toggle('hidden', !isNewUpdate);
            }
            const modal = document.getElementById('changelogModal');
            if (modal) {
                modal.classList.remove('hidden');
                document.body.style.overflow = 'hidden';
            }
        }

        function closeChangelogModal() {
            const modal = document.getElementById('changelogModal');
            if (modal) {
                modal.classList.add('hidden');
                document.body.style.overflow = '';
            }
        }

        function closeChangelogModalOnBackdrop(e) {
            if (e.target && e.target.id === 'changelogModal') {
                closeChangelogModal();
            }
        }

        function showNewVersionBanner(newVersion) {
            const banner = document.getElementById('newVersionBanner');
            const tag = document.getElementById('newVersionTag');
            if (banner) {
                if (tag) tag.textContent = `v${newVersion}`;
                banner.classList.remove('hidden');
            }
        }

        function dismissNewVersionBanner() {
            const banner = document.getElementById('newVersionBanner');
            if (banner) banner.classList.add('hidden');
        }

        async function applyAppUpdate() {
            window._swManualUpdateTriggered = true;
            showToast('🚀 กำลังติดตั้งเวอร์ชันใหม่...');
            try {
                if ('serviceWorker' in navigator) {
                    const reg = await navigator.serviceWorker.getRegistration();
                    if (reg) {
                        if (reg.waiting) {
                            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
                        }
                        await reg.update().catch(() => {});
                        if (reg.waiting) {
                            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
                        }
                    }
                }
                if ('caches' in window) {
                    const keys = await caches.keys();
                    await Promise.all(keys.map(k => caches.delete(k)));
                }
            } catch (e) {
                console.warn('Update error:', e);
            }
            const url = new URL(window.location.href);
            url.searchParams.set('v_reload', Date.now().toString());
            window.location.replace(url.href);
        }

        async function checkForAppUpdates() {
            try {
                const res = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
                if (!res.ok) return;
                const meta = await res.json();
                if (meta && meta.version && meta.version !== APP_VERSION) {
                    showNewVersionBanner(meta.version);
                }
            } catch (e) {
                // Ignore fetch errors
            }
        }

        // ==========================================
        // Intermittent Fasting (IF) Timer Engine (v5.4.0)
        // ==========================================
        function getFastingPlanTargetHours(plan) {
            if (plan === '18:6') return 18;
            if (plan === '14:10') return 14;
            if (plan === '20:4') return 20;
            return 16; // default 16:8
        }

        function setFastingPlan(plan) {
            if (!state.fasting) state.fasting = {};
            state.fasting.plan = plan;
            state.fasting.targetHours = getFastingPlanTargetHours(plan);
            saveState();
            renderFastingSection();
            showToast(`⏱️ สลับแผนอดอาหารเป็น IF ${plan} (${state.fasting.targetHours} ชม.)`);
        }

        function toggleFastingTimer() {
            if (!state.fasting) state.fasting = { isFasting: false, plan: '16:8', targetHours: 16 };

            if (!state.fasting.isFasting) {
                state.fasting.isFasting = true;
                state.fasting.startTime = Date.now();
                state.fasting.endTime = null;
                saveState();
                renderFastingSection();
                showToast(`🔥 เริ่มนับเวลาอดอาหาร IF ${state.fasting.plan} แล้ว!`);
            } else {
                openFastingCompleteModal();
            }
        }

        function openFastingCompleteModal() {
            const modal = document.getElementById('fastingCompleteModal');
            if (!modal) return;
            if (!state.fasting || !state.fasting.startTime) return;

            const fasting = state.fasting;
            const plan = fasting.plan || '16:8';
            const targetHours = fasting.targetHours || getFastingPlanTargetHours(plan);
            const startMs = fasting.startTime;
            const nowMs = Date.now();
            const elapsedMs = Math.max(0, nowMs - startMs);
            const targetMs = targetHours * 3600 * 1000;
            const pct = Math.min(100, Math.round((elapsedMs / targetMs) * 100));

            const elapsedSecs = Math.floor(elapsedMs / 1000);
            const eh = Math.floor(elapsedSecs / 3600);
            const em = Math.floor((elapsedSecs % 3600) / 60);

            const startDate = new Date(startMs);
            const now = new Date(nowMs);
            const startStr = startDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
            const endStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

            const planBadge = document.getElementById('fastingModalPlanBadge');
            if (planBadge) planBadge.textContent = `แผน IF ${plan} (เป้าหมาย ${targetHours} ชม.)`;

            const durationEl = document.getElementById('fastingModalDuration');
            if (durationEl) durationEl.textContent = `${eh} ชม. ${em} นาที`;

            const progressEl = document.getElementById('fastingModalProgressBar');
            if (progressEl) progressEl.style.width = `${pct}%`;

            const progressText = document.getElementById('fastingModalProgressText');
            if (progressText) progressText.textContent = `${pct}% ของเป้าหมาย`;

            const rangeEl = document.getElementById('fastingModalTimeRange');
            if (rangeEl) rangeEl.textContent = `เริ่ม ${startStr} น. → สิ้นสุด ${endStr} น.`;

            const statusBadge = document.getElementById('fastingModalStatusBadge');
            const headerTitle = document.getElementById('fastingModalTitle');
            const headerSub = document.getElementById('fastingModalSubtitle');

            if (elapsedMs >= targetMs) {
                const overMs = elapsedMs - targetMs;
                const oh = Math.floor(overMs / (3600 * 1000));
                const om = Math.floor((overMs % (3600 * 1000)) / (60 * 1000));
                if (statusBadge) {
                    statusBadge.className = 'text-xs px-3 py-1 rounded-full font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25';
                    statusBadge.textContent = '🏆 บรรลุเป้าหมายครบถ้วน!';
                }
                if (headerTitle) headerTitle.textContent = '🎉 ยินดีด้วย! ทำตามเป้าหมายสำเร็จ';
                if (headerSub) headerSub.textContent = `คุณอดอาหารครบ ${targetHours} ชม. ตามแผนเรียบร้อย${oh > 0 || om > 0 ? ` (เกินเป้าหมายมา ${oh} ชม. ${om} นาที)` : ''} ร่างกายได้รับประโยชน์จากการทำ IF เต็มที่ครับ!`;
            } else {
                const remHours = Math.ceil((targetMs - elapsedMs) / (3600 * 1000) * 10) / 10;
                if (statusBadge) {
                    statusBadge.className = 'text-xs px-3 py-1 rounded-full font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25';
                    statusBadge.textContent = '⏱️ สรุปเวลาก่อนสิ้นสุด';
                }
                if (headerTitle) headerTitle.textContent = 'ต้องการสิ้นสุดการอดอาหารตอนนี้ใช่หรือไม่?';
                if (headerSub) headerSub.textContent = `ทำเวลาได้ ${eh} ชม. ${em} นาที (ขาดอีกประมาณ ${remHours} ชม. จะครบตามเป้าหมาย ${plan})`;
            }

            // Milestone indicators based on hours completed
            const m1 = document.getElementById('fastingMilestone_1');
            const m2 = document.getElementById('fastingMilestone_2');
            const m3 = document.getElementById('fastingMilestone_3');
            const m4 = document.getElementById('fastingMilestone_4');

            if (m1) m1.className = eh >= 1 ? 'flex items-center gap-2 p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold' : 'flex items-center gap-2 p-2 rounded-xl bg-slate-100 dark:bg-slate-700/60 text-slate-400';
            if (m2) m2.className = eh >= 4 ? 'flex items-center gap-2 p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold' : 'flex items-center gap-2 p-2 rounded-xl bg-slate-100 dark:bg-slate-700/60 text-slate-400';
            if (m3) m3.className = eh >= 12 ? 'flex items-center gap-2 p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold' : 'flex items-center gap-2 p-2 rounded-xl bg-slate-100 dark:bg-slate-700/60 text-slate-400';
            if (m4) m4.className = eh >= 16 ? 'flex items-center gap-2 p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold' : 'flex items-center gap-2 p-2 rounded-xl bg-slate-100 dark:bg-slate-700/60 text-slate-400';

            modal.classList.remove('hidden');
        }

        function closeFastingCompleteModal() {
            const modal = document.getElementById('fastingCompleteModal');
            if (modal) modal.classList.add('hidden');
        }

        function confirmFinishFasting(goToMeal = false) {
            if (!state.fasting || !state.fasting.isFasting) {
                closeFastingCompleteModal();
                return;
            }
            const elapsedMs = Date.now() - (state.fasting.startTime || Date.now());
            const elapsedHours = Math.round((elapsedMs / (3600 * 1000)) * 10) / 10;

            state.fasting.isFasting = false;
            if (typeof triggerCelebrationConfetti === 'function') {
                triggerCelebrationConfetti();
                showMilestoneBeatCard({
                    icon: '⏱️',
                    title: 'พิชิตเป้าหมาย Fasting สำเร็จ!',
                    subtitle: `อดอาหารได้ครบ ${elapsedHours} ชม. ตามเป้าหมายเรียบร้อยแล้ว`,
                    detail: 'ระบบเผาผลาญปรับตัวและดึงไขมันสะสมมาใช้ได้อย่างเต็มที่ ร่างกายพักผ่อนเต็มอิ่ม! ✨'
                });
            }
            state.fasting.endTime = Date.now();
            if (!state.fasting.history) state.fasting.history = [];
            state.fasting.history.unshift({
                plan: state.fasting.plan || '16:8',
                startTime: state.fasting.startTime,
                endTime: state.fasting.endTime,
                elapsedHours
            });
            if (state.fasting.history.length > 20) state.fasting.history.pop();
            saveState();
            renderFastingSection();
            closeFastingCompleteModal();

            showToast(`🎉 สิ้นสุดการอดอาหาร! บันทึกประวัติสำเร็จ (${elapsedHours} ชม.)`);

            if (goToMeal) {
                if (typeof selectMealTab === 'function') {
                    selectMealTab('breakfast');
                }
                const foodSec = document.getElementById('foodSection');
                if (foodSec) {
                    foodSec.scrollIntoView({ behavior: 'smooth' });
                }
            }
        }

        function promptEditFastingStartTime() {
            if (!state.fasting || !state.fasting.isFasting || !state.fasting.startTime) return;
            const currentStart = new Date(state.fasting.startTime);
            const defaultTimeStr = currentStart.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
            const newTime = prompt('กรุณาระบุเวลาที่เริ่มอดอาหารจริง (เช่น 20:00 หรือ 21:30):', defaultTimeStr);
            if (!newTime || !newTime.includes(':')) return;

            const [hh, mm] = newTime.split(':').map(x => parseInt(x, 10));
            if (isNaN(hh) || isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
                alert('รูปแบบเวลาไม่ถูกต้อง กรุณาระบุ เช่น 20:30');
                return;
            }

            const now = new Date();
            const targetDate = new Date();
            targetDate.setHours(hh, mm, 0, 0);
            if (targetDate.getTime() > now.getTime()) {
                targetDate.setDate(targetDate.getDate() - 1);
            }
            state.fasting.startTime = targetDate.getTime();
            saveState();
            renderFastingSection();
            showToast(`✏️ อัปเดตเวลาเริ่มอดอาหารเป็น ${targetDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} เรียบร้อย`);
        }

        let _lastFastingToggleTime = 0;
        function toggleFastingCollapse(forceState) {
            const now = Date.now();
            if (typeof forceState !== 'boolean' && now - _lastFastingToggleTime < 150) return;
            _lastFastingToggleTime = now;

            const body = document.getElementById('fastingPanelBody');
            const chevron = document.getElementById('fastingChevron');
            const label = document.getElementById('fastingCollapseLabel');
            if (!body) return;

            if (!state.collapsedSections) state.collapsedSections = {};

            let isCollapsed;
            if (typeof forceState === 'boolean') {
                isCollapsed = forceState;
            } else {
                isCollapsed = !body.classList.contains('hidden');
            }

            state.collapsedSections['fasting'] = isCollapsed;

            const panel = document.getElementById('fastingTimerPanel');
            let panelRectBefore = null;
            if (panel) {
                panelRectBefore = panel.getBoundingClientRect();
            }

            if (isCollapsed) {
                body.classList.add('hidden');
                if (chevron) chevron.textContent = '▼';
                if (label) label.textContent = 'แสดง';
                try { localStorage.setItem('novafit_fasting_collapsed', 'true'); } catch (e) {}
            } else {
                body.classList.remove('hidden');
                if (chevron) chevron.textContent = '▲';
                if (label) label.textContent = 'ซ่อน';
                try { localStorage.setItem('novafit_fasting_collapsed', 'false'); } catch (e) {}
            }

            // Mobile iOS Safari Viewport & Overscroll Clamping Protection
            if (isCollapsed && panel) {
                const maxScrollY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
                if (panelRectBefore && panelRectBefore.top < 0) {
                    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                } else if (window.scrollY > maxScrollY) {
                    window.scrollTo({ top: maxScrollY, behavior: 'instant' });
                }
            }

            // Immediately update status badge text if fasting is active
            if (state.fasting && state.fasting.isFasting) {
                updateFastingTimerClock();
            }

            clearTimeout(window._collapseSaveTimer);
            window._collapseSaveTimer = setTimeout(() => {
                try {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
                } catch (e) {}
            }, 100);
        }
        window.toggleFastingCollapse = toggleFastingCollapse;

        function updateFastingTimerClock() {
            if (!state.fasting || !state.fasting.isFasting) return;

            const fasting = state.fasting;
            const plan = fasting.plan || '16:8';
            const targetHours = fasting.targetHours || getFastingPlanTargetHours(plan);
            const startMs = fasting.startTime || Date.now();
            const elapsedMs = Math.max(0, Date.now() - startMs);
            const targetMs = targetHours * 3600 * 1000;
            const remainingMs = targetMs - elapsedMs;
            const pct = Math.min(100, Math.round((elapsedMs / targetMs) * 100));

            const elapsedSecs = Math.floor(elapsedMs / 1000);
            const eh = Math.floor(elapsedSecs / 3600);
            const em = Math.floor((elapsedSecs % 3600) / 60);
            const es = elapsedSecs % 60;
            const clockStr = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}:${String(es).padStart(2, '0')}`;

            const clockEl = document.getElementById('fastingTimerClock');
            const progressEl = document.getElementById('fastingProgressBar');
            const remainingEl = document.getElementById('fastingRemainingText');
            const statusBadge = document.getElementById('fastingStatusBadge');

            if (clockEl) clockEl.textContent = clockStr;
            if (progressEl) progressEl.style.width = `${pct}%`;

            const isCollapsed = state.collapsedSections && state.collapsedSections['fasting'] !== undefined
                ? !!state.collapsedSections['fasting']
                : (localStorage.getItem('novafit_fasting_collapsed') === 'true');

            if (remainingMs > 0) {
                const remSecs = Math.ceil(remainingMs / 1000);
                const rh = Math.floor(remSecs / 3600);
                const rm = Math.floor((remSecs % 3600) / 60);
                if (statusBadge) {
                    statusBadge.textContent = isCollapsed ? `🔥 ${clockStr} (${pct}%)` : `🔥 กำลังอดอาหาร (${pct}%)`;
                }
                if (remainingEl) remainingEl.textContent = `เหลืออีก ${rh} ชม. ${rm} นาที จะครบ ${targetHours} ชม.`;
            } else {
                const overSecs = Math.floor(Math.abs(remainingMs) / 1000);
                const oh = Math.floor(overSecs / 3600);
                const om = Math.floor((overSecs % 3600) / 60);
                if (statusBadge) {
                    statusBadge.textContent = '🎉 ครบเป้าหมายแล้ว!';
                }
                if (remainingEl) remainingEl.textContent = `ครบ ${targetHours} ชม. แล้ว (เกินมา ${oh} ชม. ${om} นาที) พร้อมเริ่มมื้อแรกได้เลยครับ`;
            }
        }
        window.updateFastingTimerClock = updateFastingTimerClock;

        function renderFastingSection() {
            const fasting = state.fasting || { isFasting: false, plan: '16:8', targetHours: 16 };
            const plan = fasting.plan || '16:8';
            const targetHours = fasting.targetHours || getFastingPlanTargetHours(plan);

            // Sync Plan Badge
            const planBadge = document.getElementById('fastingPlanBadge');
            if (planBadge) planBadge.textContent = plan;

            // Sync Collapsible State
            if (!state.collapsedSections) state.collapsedSections = {};
            const isCollapsed = state.collapsedSections['fasting'] !== undefined
                ? !!state.collapsedSections['fasting']
                : (localStorage.getItem('novafit_fasting_collapsed') === 'true');
            state.collapsedSections['fasting'] = isCollapsed;

            const bodyEl = document.getElementById('fastingPanelBody');
            const chevronEl = document.getElementById('fastingChevron');
            const labelEl = document.getElementById('fastingCollapseLabel');
            if (bodyEl) {
                bodyEl.classList.toggle('hidden', isCollapsed);
            }
            if (chevronEl) {
                chevronEl.textContent = isCollapsed ? '▼' : '▲';
            }
            if (labelEl) {
                labelEl.textContent = isCollapsed ? 'แสดง' : 'ซ่อน';
            }

            // Update plan buttons
            ['16:8', '18:6', '14:10', '20:4'].forEach(pKey => {
                const btn = document.getElementById('btnFastingPlan_' + pKey.replace(':', '_'));
                if (btn) {
                    const isActive = plan === pKey;
                    btn.className = `px-2 py-1 rounded-xl text-xs font-bold transition ${isActive 
                        ? 'bg-purple-600 text-white shadow-xs' 
                        : 'bg-white/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:border-purple-500/50'}`;
                }
            });

            const statusBadge = document.getElementById('fastingStatusBadge');
            const clockEl = document.getElementById('fastingTimerClock');
            const progressEl = document.getElementById('fastingProgressBar');
            const remainingEl = document.getElementById('fastingRemainingText');
            const rangeEl = document.getElementById('fastingTimeRangeText');
            const toggleBtn = document.getElementById('btnToggleFasting');
            const editBtn = document.getElementById('btnEditFastingStart');

            if (!fasting.isFasting) {
                if (statusBadge) {
                    statusBadge.className = 'text-xs px-2.5 py-0.5 rounded-full font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300';
                    statusBadge.textContent = '🍽️ ช่วงทานอาหาร';
                }
                if (clockEl) clockEl.textContent = '00:00:00';
                if (progressEl) progressEl.style.width = '0%';
                if (remainingEl) remainingEl.textContent = `แตะ "เริ่มอดอาหาร" เพื่อเริ่มนับเวลาเป้าหมาย ${targetHours} ชม.`;
                if (rangeEl) rangeEl.textContent = 'แตะที่นี่เพื่อซ่อน/ขยาย';
                if (toggleBtn) {
                    toggleBtn.className = 'px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs shadow-xs transition active:scale-95 flex items-center gap-1.5';
                    toggleBtn.innerHTML = '<span>⏱️ เริ่มอดอาหาร (Start Fast)</span>';
                }
                if (editBtn) editBtn.classList.add('hidden');
                return;
            }

            // Is Fasting
            const startMs = fasting.startTime || Date.now();
            const targetMs = targetHours * 3600 * 1000;
            const startDate = new Date(startMs);
            const targetDate = new Date(startMs + targetMs);
            const startStr = startDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
            const targetStr = targetDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

            if (rangeEl) rangeEl.textContent = `เริ่ม ${startStr} น. → เป้าหมาย ${targetStr} น.`;
            if (statusBadge) {
                statusBadge.className = 'text-xs px-2.5 py-0.5 rounded-full font-bold bg-purple-500/20 text-purple-600 dark:text-purple-400 animate-pulse';
            }
            if (toggleBtn) {
                toggleBtn.className = 'px-4 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-amber-600 hover:from-rose-600 hover:to-amber-700 text-white font-bold text-xs shadow-xs transition active:scale-95 flex items-center gap-1.5';
                toggleBtn.innerHTML = '<span>🏁 สิ้นสุดการอดอาหาร (End Fast)</span>';
            }
            if (editBtn) editBtn.classList.remove('hidden');

            updateFastingTimerClock();
        }

        // Fasting Timer Ticker (Tick every second ONLY clock and progress, no DOM churn)
        setInterval(() => {
            if (state.fasting && state.fasting.isFasting) {
                updateFastingTimerClock();
            }
        }, 1000);

        function updateVersionBadges() {
            const hBadge = document.getElementById('headerVersionBadge');
            if (hBadge) hBadge.textContent = `🚀 v${APP_VERSION}`;
            const tBadge = document.getElementById('toolsVersionBadge');
            if (tBadge) tBadge.innerHTML = `<span>🚀</span> ประวัติอัปเดต (v${APP_VERSION})`;
            const alertText = document.getElementById('whatsNewAlertText');
            if (alertText) alertText.textContent = `ยินดีต้อนรับสู่ NovaFit Pro v${APP_VERSION}!`;
        }

        function checkFirstVisitVersionNotes() {
            const LAST_SEEN_KEY = 'novafit_last_seen_version';
            const lastSeen = localStorage.getItem(LAST_SEEN_KEY);
            updateVersionBadges();
            if (lastSeen !== APP_VERSION) {
                localStorage.setItem(LAST_SEEN_KEY, APP_VERSION);
                setTimeout(() => {
                    showToast(`🚀 อัปเดตสู่ NovaFit Pro v${APP_VERSION} เรียบร้อย!`, 4000);
                    if (lastSeen) {
                        openChangelogModal(true);
                    }
                }, 800);
            }
        }

        // ==========================================
        // VISUAL SHARE CARD (Phase 3 - Canvas Engine)
        // ==========================================
        function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
            ctx.beginPath();
            ctx.moveTo(x + radius, y);
            ctx.lineTo(x + width - radius, y);
            ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
            ctx.lineTo(x + width, y + height - radius);
            ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
            ctx.lineTo(x + radius, y + height);
            ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
            ctx.lineTo(x, y + radius);
            ctx.quadraticCurveTo(x, y, x + radius, y);
            ctx.closePath();
            if (fill) ctx.fill();
            if (stroke) ctx.stroke();
        }

        function fitText(ctx, text, maxWidth) {
            if (!text) return '';
            if (ctx.measureText(text).width <= maxWidth) return text;
            let t = text;
            while (t.length > 0 && ctx.measureText(t + '...').width > maxWidth) {
                t = t.slice(0, -1);
            }
            return t + '...';
        }

        async function openShareCardModal() {
            document.getElementById('shareCardModal').classList.remove('hidden');
            if (document.fonts && document.fonts.ready) {
                try { await document.fonts.ready; } catch (e) { }
            }
            renderShareCard();

            // Check Web Share API support
            const btnShare = document.getElementById('btnShareCardNative');
            if (navigator.canShare && navigator.share) {
                btnShare.classList.remove('hidden');
                btnShare.classList.add('flex');
            } else {
                btnShare.classList.add('hidden');
                btnShare.classList.remove('flex');
            }
        }

        function closeShareCardModal() {
            document.getElementById('shareCardModal').classList.add('hidden');
        }

        function renderShareCard() {
            const canvas = document.getElementById('shareCardCanvas');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            const W = 1080;
            const H = 1420;
            canvas.width = W;
            canvas.height = H;

            const t = getCalculatedTargets();
            const dStr = state.selectedDate;
            const meals = state.logsByDate[dStr] || [];
            const sumP = Math.round(meals.reduce((s, m) => s + m.p, 0));
            const sumC = Math.round(meals.reduce((s, m) => s + m.c, 0));
            const sumF = Math.round(meals.reduce((s, m) => s + m.f, 0));
            const sumCal = Math.round(meals.reduce((s, m) => s + m.cal, 0));
            const remCal = t.targetCal - sumCal;

            const dayWorkouts = (state.workoutsByDate && state.workoutsByDate[dStr]) || [];
            const burnedCal = dayWorkouts.reduce((s, w) => s + w.cal, 0);
            const netCal = sumCal - burnedCal;

            const waterGlasses = state.waterByDate[dStr] || 0;
            const waterMl = waterGlasses * 250;
            const recordedWeight = state.weightsByDate && state.weightsByDate[dStr];

            const dateObj = new Date(dStr + 'T00:00:00');
            const thaiDate = dateObj.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

            // 1. Dark Background with subtle ambient gradient
            const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
            bgGrad.addColorStop(0, '#090e17');
            bgGrad.addColorStop(0.5, '#0f172a');
            bgGrad.addColorStop(1, '#090e17');
            ctx.fillStyle = bgGrad;
            ctx.fillRect(0, 0, W, H);

            // Ambient Glow Top-Right (Emerald)
            const glow1 = ctx.createRadialGradient(880, 160, 20, 880, 160, 480);
            glow1.addColorStop(0, 'rgba(16, 185, 129, 0.22)');
            glow1.addColorStop(1, 'rgba(16, 185, 129, 0)');
            ctx.fillStyle = glow1;
            ctx.fillRect(400, 0, W - 400, 600);

            // Ambient Glow Bottom-Left (Cyan)
            const glow2 = ctx.createRadialGradient(200, 1260, 20, 200, 1260, 520);
            glow2.addColorStop(0, 'rgba(6, 182, 212, 0.16)');
            glow2.addColorStop(1, 'rgba(6, 182, 212, 0)');
            ctx.fillStyle = glow2;
            ctx.fillRect(0, 800, 700, 620);

            // Card Outer Border
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
            ctx.lineWidth = 2;
            roundRect(ctx, 24, 24, W - 48, H - 48, 36, false, true);

            // 2. Header
            // NovaFit Pro App Logo Box
            const logoGrad = ctx.createLinearGradient(60, 60, 120, 120);
            logoGrad.addColorStop(0, '#10b981');
            logoGrad.addColorStop(0.5, '#06b6d4');
            logoGrad.addColorStop(1, '#6366f1');
            ctx.fillStyle = logoGrad;
            roundRect(ctx, 60, 60, 56, 56, 16, true, false);

            // Draw Nova Star + Bolt Icon on Canvas
            ctx.save();
            ctx.translate(88, 88);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(0, 0, 20, 0, Math.PI * 2);
            ctx.stroke();

            // 4-point curved Nova star
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(0, -17);
            ctx.bezierCurveTo(0, -6, 6, 0, 17, 0);
            ctx.bezierCurveTo(6, 0, 0, 6, 0, 17);
            ctx.bezierCurveTo(0, 6, -6, 0, -17, 0);
            ctx.bezierCurveTo(-6, 0, 0, -6, 0, -17);
            ctx.closePath();
            ctx.fill();

            // Golden Lightning Bolt Core
            ctx.fillStyle = '#fde047';
            ctx.beginPath();
            ctx.moveTo(2, -9);
            ctx.lineTo(-5, 1);
            ctx.lineTo(1, 1);
            ctx.lineTo(-2, 10);
            ctx.lineTo(6, -1);
            ctx.lineTo(0, -1);
            ctx.closePath();
            ctx.fill();
            ctx.restore();

            // Title & Subtitle
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
            ctx.font = 'bold 34px Prompt, sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.fillText('NovaFit Pro', 132, 90);

            ctx.font = 'bold 12px Prompt, sans-serif';
            ctx.fillStyle = '#06b6d4';
            ctx.fillText('SMART NUTRITION & MACRO REPORT  •  BY BENZNOVA', 134, 114);

            // Date Tag & Day Type Badge
            const dayType = (state.dayTypeByDate && state.dayTypeByDate[dStr]) || 'training';
            const dayTypeTag = dayType === 'rest' ? '🛋️ วันพัก (Rest Day)' : '🏋️ วันซ้อม (Training Day)';
            ctx.font = '500 20px Prompt, sans-serif';
            ctx.fillStyle = '#94a3b8';
            ctx.fillText(`📅 ${thaiDate}  •  ${dayTypeTag}`, 60, 150);

            // Weight Pill (if recorded)
            let pillW = 0;
            if (recordedWeight) {
                const wText = `⚖️ น้ำหนัก: ${recordedWeight} กก.`;
                ctx.font = 'bold 18px Prompt, sans-serif';
                pillW = ctx.measureText(wText).width + 32;
                ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
                ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
                ctx.lineWidth = 1.5;
                roundRect(ctx, W - 60 - pillW, 60, pillW, 46, 23, true, true);
                ctx.fillStyle = '#34d399';
                ctx.textAlign = 'center';
                ctx.fillText(wText, W - 60 - pillW / 2, 85);
            }

            // Prestige Frame & Streak Badge on Share Card
            const activeTier = PRESTIGE_TIERS[state.prestigeFrame] || PRESTIGE_TIERS.novice;
            const streakCount = Number(state.streakDays) || 0;
            const streakText = `🏆 ${activeTier.name} • 🔥 ${streakCount} วัน`;
            ctx.font = 'bold 18px Prompt, sans-serif';
            const sW = ctx.measureText(streakText).width + 32;
            const sX = recordedWeight ? (W - 60 - pillW - 12 - sW) : (W - 60 - sW);
            ctx.fillStyle = 'rgba(168, 85, 247, 0.15)';
            ctx.strokeStyle = 'rgba(168, 85, 247, 0.4)';
            ctx.lineWidth = 1.5;
            roundRect(ctx, sX, 60, sW, 46, 23, true, true);
            ctx.fillStyle = '#c084fc';
            ctx.textAlign = 'center';
            ctx.fillText(streakText, sX + sW / 2, 85);

            // 3. Calorie Hero Container
            const heroX = 60, heroY = 175, heroW = 960, heroH = 265;
            ctx.fillStyle = 'rgba(30, 41, 59, 0.65)';
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.lineWidth = 1.5;
            roundRect(ctx, heroX, heroY, heroW, heroH, 28, true, true);

            // Donut Chart on Left (Center: X: 195, Y: 307, Radius: 82, LineWidth: 18)
            const cx = 195, cy = 307, cr = 82;
            const pctVal = t.targetCal > 0 ? (sumCal / t.targetCal) : 0;

            // Background Ring
            ctx.beginPath();
            ctx.arc(cx, cy, cr, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
            ctx.lineWidth = 18;
            ctx.lineCap = 'round';
            ctx.stroke();

            // Progress Arc
            if (pctVal > 0) {
                const startAngle = -Math.PI / 2;
                const endAngle = startAngle + Math.min(Math.PI * 2, Math.PI * 2 * pctVal);
                const arcGrad = ctx.createLinearGradient(cx - cr, cy, cx + cr, cy);
                arcGrad.addColorStop(0, '#10b981');
                arcGrad.addColorStop(1, '#06b6d4');
                ctx.beginPath();
                ctx.arc(cx, cy, cr, startAngle, endAngle);
                ctx.strokeStyle = arcGrad;
                ctx.lineWidth = 18;
                ctx.lineCap = 'round';
                ctx.stroke();
            }

            // Donut Center Text
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = 'bold 44px Prompt, sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.fillText(`${Math.round(pctVal * 100)}%`, cx, cy - 8);

            ctx.font = 'bold 13px Prompt, sans-serif';
            ctx.fillStyle = '#94a3b8';
            ctx.fillText('OF GOAL', cx, cy + 26);

            // Calorie Text Stats on Right (x: 320)
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.font = 'bold 18px Prompt, sans-serif';
            ctx.fillStyle = '#94a3b8';
            ctx.fillText('พลังงานที่ทานวันนี้ (Calories)', 320, 205);

            ctx.font = 'bold 54px Prompt, sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.fillText(sumCal.toLocaleString(), 320, 235);

            const calW = ctx.measureText(sumCal.toLocaleString()).width;
            ctx.font = 'bold 24px Prompt, sans-serif';
            ctx.fillStyle = '#94a3b8';
            ctx.fillText(` / ${t.targetCal.toLocaleString()} kcal`, 320 + calW + 6, 260);

            // Status Badge Pill
            let statusText = '';
            let statusBg = 'rgba(16, 185, 129, 0.2)';
            let statusBorder = 'rgba(16, 185, 129, 0.4)';
            let statusColor = '#34d399';

            if (sumCal === 0) {
                statusText = '⏳ ยังไม่ได้เริ่มบันทึกมื้ออาหาร';
                statusBg = 'rgba(148, 163, 184, 0.15)';
                statusBorder = 'rgba(148, 163, 184, 0.3)';
                statusColor = '#94a3b8';
            } else if (Math.abs(remCal) <= 150) {
                statusText = '🎯 พลังงานถึงเป้าหมายพอดีเป๊ะ!';
            } else if (remCal > 150) {
                statusText = `⚡ ขาดอีก ${remCal.toLocaleString()} kcal เพื่อถึงเป้า`;
                statusBg = 'rgba(245, 158, 11, 0.15)';
                statusBorder = 'rgba(245, 158, 11, 0.4)';
                statusColor = '#fbbf24';
            } else {
                statusText = `🔥 เกินเป้าหมาย ${Math.abs(remCal).toLocaleString()} kcal`;
                statusBg = 'rgba(244, 63, 94, 0.15)';
                statusBorder = 'rgba(244, 63, 94, 0.4)';
                statusColor = '#fb7185';
            }

            ctx.font = 'bold 17px Prompt, sans-serif';
            const sWidth = ctx.measureText(statusText).width + 30;
            ctx.fillStyle = statusBg;
            ctx.strokeStyle = statusBorder;
            ctx.lineWidth = 1.2;
            roundRect(ctx, 320, 312, sWidth, 38, 19, true, true);

            ctx.fillStyle = statusColor;
            ctx.fillText(statusText, 335, 321);

            // Workout burned info row if burnedCal > 0
            if (burnedCal > 0) {
                const wLine = `🔥 เบิร์นออกกำลัง -${burnedCal.toLocaleString()} kcal  •  แคลอรีสุทธิ (Net): ${netCal.toLocaleString()} kcal`;
                ctx.font = '600 16px Prompt, sans-serif';
                ctx.fillStyle = '#fb923c';
                ctx.fillText(wLine, 322, 365);
            }

            // 4. Three Macro Cards (Y: 460 - 640)
            const macroY = 460, macroW = 308, macroH = 175, gap = 18;
            const macros = [
                {
                    name: '🥩 โปรตีน (Protein)',
                    gram: sumP,
                    target: t.pGram,
                    cal: Math.round(sumP * 4),
                    pct: t.pGram > 0 ? Math.min(100, Math.round((sumP / t.pGram) * 100)) : 0,
                    bg: 'rgba(59, 130, 246, 0.08)',
                    border: 'rgba(59, 130, 246, 0.28)',
                    color: '#60a5fa',
                    barColor: '#3b82f6'
                },
                {
                    name: '🍚 คาร์บ (Carbs)',
                    gram: sumC,
                    target: t.cGram,
                    cal: Math.round(sumC * 4),
                    pct: t.cGram > 0 ? Math.min(100, Math.round((sumC / t.cGram) * 100)) : 0,
                    bg: 'rgba(245, 158, 11, 0.08)',
                    border: 'rgba(245, 158, 11, 0.28)',
                    color: '#fbbf24',
                    barColor: '#f59e0b'
                },
                {
                    name: '🥑 ไขมัน (Fat)',
                    gram: sumF,
                    target: t.fGram,
                    cal: Math.round(sumF * 9),
                    pct: t.fGram > 0 ? Math.min(100, Math.round((sumF / t.fGram) * 100)) : 0,
                    bg: 'rgba(244, 63, 94, 0.08)',
                    border: 'rgba(244, 63, 94, 0.28)',
                    color: '#fb7185',
                    barColor: '#f43f5e'
                }
            ];

            macros.forEach((m, idx) => {
                const mx = heroX + idx * (macroW + gap);
                ctx.fillStyle = m.bg;
                ctx.strokeStyle = m.border;
                ctx.lineWidth = 1.5;
                roundRect(ctx, mx, macroY, macroW, macroH, 22, true, true);

                // Title
                ctx.textAlign = 'left';
                ctx.textBaseline = 'top';
                ctx.font = 'bold 18px Prompt, sans-serif';
                ctx.fillStyle = m.color;
                ctx.fillText(m.name, mx + 20, macroY + 18);

                // Grams
                ctx.font = 'bold 38px Prompt, sans-serif';
                ctx.fillStyle = '#ffffff';
                ctx.fillText(`${m.gram}g`, mx + 20, macroY + 48);

                const gW = ctx.measureText(`${m.gram}g`).width;
                ctx.font = 'bold 18px Prompt, sans-serif';
                ctx.fillStyle = '#94a3b8';
                ctx.fillText(` / ${m.target}g`, mx + 20 + gW + 4, macroY + 64);

                // Progress Bar
                const barW = macroW - 40;
                const fillW = Math.max(4, Math.min(barW, Math.round((m.pct / 100) * barW)));
                ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
                roundRect(ctx, mx + 20, macroY + 104, barW, 8, 4, true, false);

                ctx.fillStyle = m.barColor;
                roundRect(ctx, mx + 20, macroY + 104, fillW, 8, 4, true, false);

                // Meta row
                ctx.font = '500 15px Prompt, sans-serif';
                ctx.fillStyle = '#94a3b8';
                ctx.fillText(`${m.cal} kcal`, mx + 20, macroY + 126);

                ctx.textAlign = 'right';
                ctx.fillStyle = m.color;
                ctx.fillText(`${m.pct}%`, mx + macroW - 20, macroY + 126);
            });

            // 5. Water Hydration Bar (Y: 655 - 745)
            const waterY = 655, waterW = 960, waterH = 88;
            ctx.fillStyle = 'rgba(14, 165, 233, 0.08)';
            ctx.strokeStyle = 'rgba(14, 165, 233, 0.28)';
            ctx.lineWidth = 1.5;
            roundRect(ctx, heroX, waterY, waterW, waterH, 22, true, true);

            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.font = 'bold 20px Prompt, sans-serif';
            ctx.fillStyle = '#38bdf8';
            ctx.fillText('💧 น้ำดื่มสะอาด (Water Intake)', heroX + 22, waterY + 32);

            ctx.textAlign = 'right';
            ctx.font = 'bold 20px Prompt, sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.fillText(`${waterGlasses} / ${t.waterTargetGlasses} แก้ว  (${waterMl.toLocaleString()} / ${t.waterTargetMl.toLocaleString()} มล.)`, heroX + waterW - 22, waterY + 32);

            // Water bar
            const wPct = t.waterTargetGlasses > 0 ? Math.min(100, Math.round((waterGlasses / t.waterTargetGlasses) * 100)) : 0;
            const wBarW = waterW - 44;
            const wFillW = Math.max(4, Math.min(wBarW, Math.round((wPct / 100) * wBarW)));

            ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
            roundRect(ctx, heroX + 22, waterY + 60, wBarW, 8, 4, true, false);

            const waterGrad = ctx.createLinearGradient(heroX + 22, waterY + 60, heroX + 22 + wBarW, waterY + 60);
            waterGrad.addColorStop(0, '#38bdf8');
            waterGrad.addColorStop(1, '#0284c7');
            ctx.fillStyle = waterGrad;
            roundRect(ctx, heroX + 22, waterY + 60, wFillW, 8, 4, true, false);

            // 6. Four Meals Summary Box (Y: 760 - 1285)
            const mealsY = 760, mealsW = 960, mealsH = 525;
            ctx.fillStyle = 'rgba(30, 41, 59, 0.65)';
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.lineWidth = 1.5;
            roundRect(ctx, heroX, mealsY, mealsW, mealsH, 28, true, true);

            // Header of meals box
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.font = 'bold 22px Prompt, sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.fillText('🍽️ บันทึก 4 มื้ออาหารวันนี้ (Meals Summary)', heroX + 24, mealsY + 22);

            ctx.textAlign = 'right';
            ctx.font = 'bold 16px Prompt, sans-serif';
            ctx.fillStyle = '#10b981';
            ctx.fillText(`รวมทั้งหมด ${meals.length} รายการ`, heroX + mealsW - 24, mealsY + 25);

            // Group meals
            const mealGroups = {
                breakfast: { name: '🌅 มื้อเช้า', items: [] },
                lunch: { name: '☀️ มื้อเที่ยง', items: [] },
                dinner: { name: '🌙 มื้อเย็น', items: [] },
                snack: { name: '🍎 ของว่าง', items: [] }
            };
            meals.forEach(m => {
                const k = m.meal && mealGroups[m.meal] ? m.meal : 'breakfast';
                mealGroups[k].items.push(m);
            });

            const mealKeys = ['breakfast', 'lunch', 'dinner', 'snack'];
            const rowH = 96, rowGap = 12;

            mealKeys.forEach((k, idx) => {
                const grp = mealGroups[k];
                const ry = mealsY + 68 + idx * (rowH + rowGap);
                const rw = mealsW - 48;
                const rx = heroX + 24;

                ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
                ctx.lineWidth = 1;
                roundRect(ctx, rx, ry, rw, rowH, 18, true, true);

                const grpCal = Math.round(grp.items.reduce((s, x) => s + x.cal, 0));

                // Meal title
                ctx.textAlign = 'left';
                ctx.textBaseline = 'top';
                ctx.font = 'bold 20px Prompt, sans-serif';
                ctx.fillStyle = '#ffffff';
                ctx.fillText(grp.name, rx + 18, ry + 16);

                // Meal Calorie Pill
                const calStr = `${grpCal} kcal`;
                ctx.font = 'bold 16px Prompt, sans-serif';
                const calPillW = ctx.measureText(calStr).width + 24;
                ctx.fillStyle = grpCal > 0 ? 'rgba(16, 185, 129, 0.18)' : 'rgba(148, 163, 184, 0.1)';
                ctx.strokeStyle = grpCal > 0 ? 'rgba(16, 185, 129, 0.35)' : 'rgba(148, 163, 184, 0.2)';
                ctx.lineWidth = 1;
                roundRect(ctx, rx + rw - calPillW - 18, ry + 14, calPillW, 30, 15, true, true);

                ctx.textAlign = 'center';
                ctx.fillStyle = grpCal > 0 ? '#34d399' : '#94a3b8';
                ctx.fillText(calStr, rx + rw - calPillW / 2 - 18, ry + 20);

                // Food Items text line
                ctx.textAlign = 'left';
                ctx.font = '400 16px Prompt, sans-serif';
                if (grp.items.length === 0) {
                    ctx.fillStyle = '#64748b';
                    ctx.fillText('— ยังไม่ได้บันทึกรายการในมื้อนี้ —', rx + 18, ry + 56);
                } else {
                    const itemStrs = grp.items.map(x => `${x.name}${x.portion && x.portion !== 1 ? ` (x${x.portion})` : ''}`);
                    const joined = fitText(ctx, itemStrs.join(', '), rw - 36);
                    ctx.fillStyle = '#cbd5e1';
                    ctx.fillText(joined, rx + 18, ry + 56);
                }
            });

            // 7. Footer (Y: 1305 - 1380)
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(heroX, 1315);
            ctx.lineTo(heroX + heroW, 1315);
            ctx.stroke();

            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.font = '500 16px Prompt, sans-serif';
            ctx.fillStyle = '#64748b';
            ctx.fillText('✨ NovaFit Pro • สุขภาพและรูปร่างที่ดีสร้างได้ทุกวัน', heroX, 1350);

            ctx.textAlign = 'right';
            ctx.font = 'bold 16px Prompt, sans-serif';
            ctx.fillStyle = '#10b981';
            ctx.fillText('novafit-pro • by BenzNova', heroX + heroW, 1350);
        }

        function downloadShareCard() {
            const canvas = document.getElementById('shareCardCanvas');
            if (!canvas) return;
            const dStr = state.selectedDate || getTodayStr();
            canvas.toBlob(blob => {
                if (!blob) return;
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `novafit-summary-${dStr}.png`;
                a.click();
                URL.revokeObjectURL(url);
                showToast('📸 ดาวน์โหลดการ์ดรูปภาพสำเร็จแล้ว!');
            }, 'image/png');
        }

        async function copyShareCardImage() {
            const canvas = document.getElementById('shareCardCanvas');
            if (!canvas) return;
            if (!navigator.clipboard || !window.ClipboardItem) {
                downloadShareCard();
                return;
            }
            try {
                canvas.toBlob(async blob => {
                    if (!blob) return;
                    try {
                        await navigator.clipboard.write([
                            new ClipboardItem({ 'image/png': blob })
                        ]);
                        showToast('📋 คัดลอกรูปภาพแล้ว! กด Paste (วาง) ใน LINE ได้ทันที');
                    } catch (err) {
                        console.warn('Clipboard write failed, downloading instead:', err);
                        downloadShareCard();
                    }
                }, 'image/png');
            } catch (e) {
                downloadShareCard();
            }
        }

        async function shareCardNative() {
            const canvas = document.getElementById('shareCardCanvas');
            if (!canvas) return;
            const dStr = state.selectedDate || getTodayStr();
            if (!navigator.canShare || !navigator.share) {
                downloadShareCard();
                return;
            }
            canvas.toBlob(async blob => {
                if (!blob) return;
                try {
                    const file = new File([blob], `novafit-summary-${dStr}.png`, { type: 'image/png' });
                    if (navigator.canShare({ files: [file] })) {
                        await navigator.share({
                            files: [file],
                            title: 'สรุปโภชนาการ NovaFit Pro',
                            text: `สรุปโภชนาการและแคลอรีวันที่ ${dStr} ผ่าน NovaFit Pro (by BenzNova)`
                        });
                    } else {
                        downloadShareCard();
                    }
                } catch (err) {
                    if (err.name !== 'AbortError') {
                        downloadShareCard();
                    }
                }
            }, 'image/png');
        }

        function exportData() {
            const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `novafit-pro-v5.1-backup-${getTodayStr()}.json`;
            a.click();
            URL.revokeObjectURL(url);
        }

        function importData(event) {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const imported = JSON.parse(e.target.result);
                    if (imported && imported.profile) {
                        state = { ...state, ...imported, version: APP_VERSION };
                        saveState();
                        renderAll();
                        showToast('นำเข้าข้อมูลสำเร็จเรียบร้อยครับ!');
                    } else {
                        alert('รูปแบบไฟล์ JSON ไม่ถูกต้องครับ');
                    }
                } catch (err) {
                    alert('ไม่สามารถอ่านไฟล์ JSON ได้ครับ');
                }
            };
            reader.readAsText(file);
        }

        function resetAllData() {
            showConfirmDialog({
                icon: '⚠️',
                iconBgClass: 'w-14 h-14 mx-auto rounded-2xl bg-rose-500/15 text-rose-500 flex items-center justify-center text-3xl shadow-xs',
                title: 'ล้างข้อมูลทั้งหมดในเครื่อง',
                message: 'ต้องการล้างข้อมูลทั้งหมดในเครื่อง (รวมถึงประวัติทุกวัน) เพื่อเริ่มต้นใหม่ใช่หรือไม่? (การกระทำนี้ไม่สามารถย้อนกลับได้)',
                confirmText: 'ล้างข้อมูลทั้งหมด',
                confirmClass: 'flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition cursor-pointer',
                onConfirm: () => {
                    localStorage.removeItem(STORAGE_KEY);
                    location.reload();
                }
            });
        }

        // --- PWA Installation & Service Worker Integration ---
        let deferredPwaPrompt = null;
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPwaPrompt = e;
            const btn = document.getElementById('btnPwaInstall');
            if (btn) {
                btn.classList.add('ring-2', 'ring-indigo-400', 'animate-pulse');
            }
        });

        window.addEventListener('appinstalled', () => {
            deferredPwaPrompt = null;
            showToast('🎉 ติดตั้ง NovaFit Pro สำเร็จแล้ว! เปิดใช้งานจากหน้าจอโฮมได้เลย');
            const btn = document.getElementById('btnPwaInstall');
            if (btn) btn.style.display = 'none';
        });

        function handlePwaInstallClick() {
            if (deferredPwaPrompt) {
                deferredPwaPrompt.prompt();
                deferredPwaPrompt.userChoice.then((choiceResult) => {
                    if (choiceResult.outcome === 'accepted') {
                        showToast('กำลังติดตั้ง NovaFit Pro ลงในอุปกรณ์ของคุณ...');
                    }
                    deferredPwaPrompt = null;
                });
            } else {
                const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
                if (isIos) {
                    alert('📱 วิธีติดตั้ง NovaFit Pro บน iPhone / iPad (Safari):\n\n1. แตะปุ่มแชร์ ⎋ (Share) ด้านล่างของ Safari\n2. เลื่อนลงแล้วเลือก "เพิ่มไปยังหน้าจอโฮม" (Add to Home Screen)\n3. แตะ "เพิ่ม" (Add)\n\nคุณจะได้แอป NovaFit Pro แบบเต็มจอ ใช้งานออฟไลน์ได้ 100%!');
                } else {
                    alert('📱 วิธีติดตั้ง NovaFit Pro (PWA):\n\n• หากใช้งาน Google Chrome / Edge: กดจุด 3 จุด (⋮) ด้านขวาบน แล้วเลือก "ติดตั้งแอป" หรือ "เพิ่มไปยังหน้าจอหลัก"\n• แอปจะถูกติดตั้งลงอุปกรณ์ ใช้งานแบบเต็มจอและเปิดได้แม้อยู่นอกสัญญาณเน็ต!');
                }
            }
        }

        // Register Service Worker & handle clean update workflow
        if ('serviceWorker' in navigator) {
            let refreshing = false;
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (!refreshing && window._swManualUpdateTriggered) {
                    refreshing = true;
                    window.location.reload();
                }
            });
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('./sw.js').then((reg) => {
                    console.log('NovaFit Pro SW registered:', reg.scope);
                }).catch((err) => {
                    console.warn('NovaFit Pro SW registration failed:', err);
                });
            });
        }

        window.addEventListener('resize', syncResponsiveLayout);

        loadState();
        renderAll();
        checkFirstVisitProfilePrompt();
        checkFirstVisitVersionNotes();
        initAppPreloader();
        updatePushStatusUI();
        checkPushPromptEligibility();

        // Smooth preloader dismissal after initial setup
        if (document.readyState === 'complete') {
            setTimeout(dismissAppPreloader, 900);
        } else {
            window.addEventListener('load', () => {
                setTimeout(dismissAppPreloader, 900);
            });
        }

        // Expose globals for Firebase Module integration
        window.state = state;
        window.APP_VERSION = APP_VERSION;
        window.STORAGE_KEY = STORAGE_KEY;
        window.renderAll = renderAll;
        window.showToast = showToast;
        window.showMiniLoader = showMiniLoader;
        window.hideMiniLoader = hideMiniLoader;
        window.dismissAppPreloader = dismissAppPreloader;
        window.initAppPreloader = initAppPreloader;
        window.getPushPermissionState = getPushPermissionState;
        window.updatePushStatusUI = updatePushStatusUI;
        window.requestPushPermission = requestPushPermission;
        window.requestPushPermissionFromBanner = requestPushPermissionFromBanner;
        window.dismissPushPrompt = dismissPushPrompt;
        window.checkPushPromptEligibility = checkPushPromptEligibility;
        window.testLocalNotification = testLocalNotification;
        window.togglePushNotificationPermission = togglePushNotificationPermission;
        window.saveState = saveState;
        window.toggleToolsMenu = toggleToolsMenu;
        window.toggleCardSection = toggleCardSection;
        window.renderAllSectionCollapses = renderAllSectionCollapses;
        window.syncResponsiveLayout = syncResponsiveLayout;
        window.checkDayRollover = checkDayRollover;
        window.checkFirstVisitProfilePrompt = checkFirstVisitProfilePrompt;
        window.addFoodItem = addFoodItem;
        window.removeFoodItem = removeFoodItem;
        window.changeMealCategory = changeMealCategory;

        // Directly updates lexical state and re-renders UI across all components
        window.applyCloudState = function (cloudState, isInitialOrRestore = true) {
            if (!cloudState || typeof cloudState !== 'object') return;
            const currentSelectedDate = state.selectedDate;
            const currentActiveMeal = state.activeMeal;

            // Smart Non-Destructive Bidirectional Merge:
            // 1. Logs:
            let mergedLogs = { ...(cloudState.logsByDate || {}) };
            const localLogs = state.logsByDate || {};

            if (isInitialOrRestore) {
                // Initial load / offline restore: preserve past dates missing from cloud, and merge unique items
                const normalizeMealItem = n => (n || '').replace(/เพียว/g, '').trim().toLowerCase();

                Object.keys(localLogs).forEach(date => {
                    const localList = localLogs[date];
                    if (!Array.isArray(localList) || localList.length === 0) return;

                    if (!mergedLogs[date] || !Array.isArray(mergedLogs[date]) || mergedLogs[date].length === 0) {
                        mergedLogs[date] = [...localList];
                    } else {
                        const cloudList = [...mergedLogs[date]];
                        const cloudIds = new Set(cloudList.map(m => m.id).filter(Boolean));
                        
                        // Count occurrences of normalized (meal + name) in cloud
                        const cloudSigCounts = {};
                        cloudList.forEach(m => {
                            const sig = `${m.meal || 'breakfast'}_${normalizeMealItem(m.name)}`;
                            cloudSigCounts[sig] = (cloudSigCounts[sig] || 0) + 1;
                        });

                        localList.forEach(item => {
                            const sig = `${item.meal || 'breakfast'}_${normalizeMealItem(item.name)}`;
                            const hasId = item.id && cloudIds.has(item.id);
                            // Avoid duplicates: only add if this food isn't already present in cloud for this meal
                            if (!hasId && (!cloudSigCounts[sig] || cloudSigCounts[sig] === 0)) {
                                cloudList.push(item);
                                cloudSigCounts[sig] = 1;
                            }
                        });
                        mergedLogs[date] = cloudList;
                    }
                });
            } else {
                // Live real-time update from another active device: Cloud is authoritative.
                // Ensures deletions and edits on another device immediately apply without resurrecting!
                mergedLogs = { ...(cloudState.logsByDate || {}) };
            }

            // Sanitize & deduplicate merged logs across all dates to prevent ghost clones
            if (typeof window.cleanDuplicateMealLogs === 'function') {
                Object.keys(mergedLogs).forEach(date => {
                    mergedLogs[date] = window.cleanDuplicateMealLogs(mergedLogs[date]);
                });
            }

            // 2. Profile: Cloud profile wins if it has configured weight > 0
            const cloudWeight = Number(cloudState.profile?.weight) || 0;
            const localWeight = Number(state.profile?.weight) || 0;
            const finalProfile = (cloudWeight > 0)
                ? { ...state.profile, ...cloudState.profile }
                : (localWeight > 0 ? state.profile : (cloudState.profile || state.profile));

            // 3. Water: Math.max per date
            const mergedWater = { ...(cloudState.waterByDate || {}) };
            const localWater = state.waterByDate || {};
            Object.keys(localWater).forEach(date => {
                mergedWater[date] = Math.max(mergedWater[date] || 0, localWater[date] || 0);
            });

            // 4. Weight History: Union by date
            const weightMap = new Map();
            (Array.isArray(cloudState.weightHistory) ? cloudState.weightHistory : []).forEach(w => {
                if (w && w.date) weightMap.set(w.date, w);
            });
            (Array.isArray(state.weightHistory) ? state.weightHistory : []).forEach(w => {
                if (w && w.date && !weightMap.has(w.date)) weightMap.set(w.date, w);
            });
            const mergedWeightHistory = Array.from(weightMap.values()).sort((a, b) => (a.date || '').localeCompare(b.date || ''));

            // 5. Supplements: Cloud wins if non-empty, otherwise local
            const cloudSupps = Array.isArray(cloudState.supplementList) ? cloudState.supplementList : [];
            const localSupps = Array.isArray(state.supplementList) ? state.supplementList : [];
            const finalSupps = cloudSupps.length > 0 ? cloudSupps : localSupps;

            // 6. Custom Foods: Union by name
            const mergedCustomFoods = [
                ...(Array.isArray(cloudState.customFoods) ? cloudState.customFoods : [])
            ];
            const cloudCustomNames = new Set(mergedCustomFoods.map(f => f.name));
            (Array.isArray(state.customFoods) ? state.customFoods : []).forEach(f => {
                if (f && f.name && !cloudCustomNames.has(f.name)) mergedCustomFoods.push(f);
            });

            state = {
                ...state,
                ...cloudState,
                logsByDate: mergedLogs,
                profile: finalProfile,
                waterByDate: mergedWater,
                weightHistory: mergedWeightHistory,
                supplementList: finalSupps,
                customFoods: mergedCustomFoods,
                selectedDate: currentSelectedDate,
                activeMeal: currentActiveMeal,
                version: APP_VERSION
            };

            window.state = state;
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            } catch (e) { }

            renderAll();
        };

        // Check for updates and new day rollover initially and periodically
        setTimeout(checkForAppUpdates, 2500);
        setInterval(checkForAppUpdates, 180000); // Check every 3 mins
        setInterval(checkDayRollover, 30000); // Check for new day every 30s
        window.addEventListener('focus', checkDayRollover);
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                checkForAppUpdates();
                checkDayRollover();
            }
        });

        // Close Dropdown Menus when clicking outside
        document.addEventListener('click', (e) => {
            const btn = document.getElementById('btnToolsMenu');
            const menu = document.getElementById('toolsDropdownMenu');
            if (btn && menu && !btn.contains(e.target) && !menu.contains(e.target)) {
                menu.classList.add('hidden');
            }

            const pillUser = document.getElementById('userProfilePill');
            const menuUser = document.getElementById('userDropdown');
            if (pillUser && menuUser && !pillUser.contains(e.target) && !menuUser.contains(e.target)) {
                menuUser.classList.add('hidden');
            }
        });

        // Close Modals on Escape Key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeChangelogModal();
                closeDailyReportModal();
                closeShareCardModal();
                closeAddSupplementModal();
            }
        });

// ==========================================
// NEW v5.3.1: APPLE-GRADE SMOOTH MODALS & PROFILE DRAWER
// ==========================================

function openModalAnimated(modalId, onOpened) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    if (modal._closeTimer) {
        clearTimeout(modal._closeTimer);
        modal._closeTimer = null;
    }
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
    if (modal._closeTimer) {
        clearTimeout(modal._closeTimer);
    }
    modal._closeTimer = setTimeout(() => {
        modal.classList.add('hidden');
        modal.style.display = 'none';
        document.body.style.overflow = '';
        if (typeof onClosed === 'function') onClosed();
        modal._closeTimer = null;
    }, 280);
}

function openProfileSettingsModal() {
    openModalAnimated('profileSettingsModal');
}

function closeProfileSettingsModal() {
    closeModalAnimated('profileSettingsModal');
    state.profileConfigured = true;
    localStorage.setItem('novafit_profile_prompted', 'true');
    if (window.currentUser) {
        localStorage.setItem('novafit_profile_prompted_' + window.currentUser.uid, 'true');
        if (window.saveProfileConfiguredToCloud) {
            window.saveProfileConfiguredToCloud();
        } else if (window.triggerCloudSync) {
            window.triggerCloudSync(true);
        }
    }
    saveState();
}

function checkFirstVisitProfilePrompt() {
    const hasPrompted = localStorage.getItem('novafit_profile_prompted');
    if (!hasPrompted && window._isFirstTimeVisitor) {
        localStorage.setItem('novafit_profile_prompted', 'true');
        setTimeout(() => {
            openProfileSettingsModal();
            showToast('👋 ยินดีต้อนรับสู่ NovaFit Pro! กรุณากรอกข้อมูลร่างกายเพื่อเริ่มต้นใช้งาน');
        }, 500);
    }
}

function checkDayRollover() {
    const todayStr = getTodayStr();
    if (state.lastActiveDate && state.lastActiveDate !== todayStr) {
        console.log('🌅 New day detected! Auto-switching to:', todayStr, 'with breakfast active');
        state.lastActiveDate = todayStr;
        state.selectedDate = todayStr;
        state.activeMeal = 'breakfast';
        saveState();
        renderAll();
        showToast('🌅 อรุณสวัสดิ์วันใหม่! สลับไปมื้อเช้าให้อัตโนมัติแล้ว');
    }
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

function submitQuickAddMeal() {
    const nameInput = document.getElementById("inQuickName");
    const name = (nameInput?.value || "").trim() || "⚡ มื้อด่วน (Quick Add)";
    const cal = Number(document.getElementById("inQuickCal")?.value) || 0;
    const p = Number(document.getElementById("inQuickP")?.value) || 0;
    let c = Number(document.getElementById("inQuickC")?.value);
    let f = Number(document.getElementById("inQuickF")?.value);

    if (cal <= 0 && p <= 0) {
        alert("กรุณากรอกแคลอรีหรือโปรตีนครับ");
        return;
    }

    if (isNaN(c) || c < 0) c = 0;
    if (isNaN(f) || f < 0) f = 0;

    const mealKey = state.activeMeal || "breakfast";
    const quickItem = {
        name,
        cal: Math.round(cal),
        p: Math.round(p * 10) / 10,
        c: Math.round(c * 10) / 10,
        f: Math.round(f * 10) / 10,
        portion: 1,
        meal: mealKey,
        servingSize: "1 ที่",
        timestamp: Date.now()
    };

    const dStr = state.selectedDate;
    if (!state.logsByDate) state.logsByDate = {};
    if (!state.logsByDate[dStr]) state.logsByDate[dStr] = [];
    state.logsByDate[dStr].push(quickItem);

    saveState();
    closeQuickAddModal();
    renderAll();
    showToast(`⚡ บันทึก "${name}" (${quickItem.cal} kcal) ลงใน${MEAL_CONFIG[mealKey]?.name || "มื้อนี้"}แล้ว`);
}

function copyYesterdayActiveMeal() {
    const mealKey = state.activeMeal || "breakfast";
    copyMealFromYesterday(mealKey);
}

// ==========================================
// ==========================================
// Living App Companion Engine (v5.9.2)
// "แอพมีชีวิต" - Smart In-App Companionship & Empathy Nudges
// ==========================================

var CHEERFUL_DAILY_QUOTES = [
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

// Rich Message Pool for Dynamic Living Companion (5-6 distinct variations per category)
var COMPANION_MESSAGE_TEMPLATES = {
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

// Anti-repetition Random Message Selector
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
    // Replace placeholders
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
    const today = getTodayStr();
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


// ==========================================
// Celebration Confetti Cannon & Milestone Beats Engine (v5.9.3)
// Lightweight 60fps Canvas Confetti & Milestone Reward System
// ==========================================

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

    // Haptic vibration feedback on mobile devices
    try {
        if (navigator.vibrate) navigator.vibrate([40, 60, 90]);
    } catch(e) {}
    playSound('celebrate');

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
    const today = getTodayStr();
    if (state.selectedDate !== today) return;

    const targets = getCalculatedTargets();
    const todayLogs = (state.logsByDate && state.logsByDate[today]) || [];
    const currentCal = Math.round(todayLogs.reduce((s, x) => s + (Number(x.cal) || 0), 0));
    const currentP = Math.round(todayLogs.reduce((s, x) => s + (Number(x.p) || 0), 0) * 10) / 10;
    const targetCal = Math.round(targets.totalCal);
    const targetP = Math.round(targets.pGram);

    const currentGlasses = (state.waterByDate && state.waterByDate[today]) || 0;
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
    const today = getTodayStr();
    if (state.selectedDate !== today && !force) return;

    // Cooldown check: don't show another nudge within 5 minutes (unless force=true)
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

    // Daily Logs & Target
    const todayLogs = (state.logsByDate && state.logsByDate[today]) || [];
    const targets = getCalculatedTargets();
    const currentCal = Math.round(todayLogs.reduce((s, x) => s + (Number(x.cal) || 0), 0));
    const currentP = Math.round(todayLogs.reduce((s, x) => s + (Number(x.p) || 0), 0) * 10) / 10;
    const targetCal = Math.round(targets.totalCal);
    const targetP = Math.round(targets.pGram);

    // Water data
    const currentGlasses = (state.waterByDate && state.waterByDate[today]) || 0;
    const targetGlasses = targets.waterTargetGlasses || 8;
    const currentWaterMl = currentGlasses * 250;
    const targetWaterMl = targets.waterTargetMl || (targetGlasses * 250);

    // Check Meal Presence
    const hasBreakfast = todayLogs.some(x => x.meal === 'breakfast');
    const hasLunch = todayLogs.some(x => x.meal === 'lunch');
    const hasDinner = todayLogs.some(x => x.meal === 'dinner');

    // ── TRIGGER 1: Missing Breakfast (10:30 - 12:45) ──
    if (timeDecimal >= 10.5 && timeDecimal < 12.8 && !hasBreakfast && !shownList.includes('missing_breakfast')) {
        const msg = getVariedCompanionMessage('missing_breakfast');
        showLivingCompanionNudge({
            id: 'missing_breakfast',
            categoryKey: 'missing_breakfast',
            categoryKey: 'missing_breakfast',
            icon: '🥺',
            category: 'ห่วงใยสุขภาพยามเช้า',
            avatarGradient: 'bg-gradient-to-tr from-amber-500 to-rose-400',
            message: msg,
            actionText: '🍳 บันทึกมื้อเช้า',
            actionFn: () => {
                state.activeMeal = 'breakfast';
                renderMealSelector();
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
            categoryKey: 'missing_lunch',
            icon: '🍱',
            category: 'พักเติมพลังยามบ่าย',
            avatarGradient: 'bg-gradient-to-tr from-orange-500 to-amber-400',
            message: msg,
            actionText: '🥗 บันทึกมื้อเที่ยง',
            actionFn: () => {
                state.activeMeal = 'lunch';
                renderMealSelector();
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
            categoryKey: 'missing_dinner',
            icon: '🌙',
            category: 'มื้อค่ำเพื่อสุขภาพ',
            avatarGradient: 'bg-gradient-to-tr from-indigo-500 to-purple-400',
            message: msg,
            actionText: '🍲 บันทึกมื้อเย็น',
            actionFn: () => {
                state.activeMeal = 'dinner';
                renderMealSelector();
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
            categoryKey: 'water_near_target',
            vars: { currentGlasses, targetGlasses, currentWaterMl: currentWaterMl.toLocaleString(), remainingGlasses },
            icon: '🥤',
            category: 'ดื่มน้ำเพื่อสุขภาพ',
            avatarGradient: 'bg-gradient-to-tr from-cyan-500 to-blue-400',
            message: msg,
            actionText: '+ ดื่มน้ำ 1 แก้ว',
            actionFn: () => {
                adjustWater(1);
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
            categoryKey: 'water_afternoon_warning',
            vars: { currentGlasses },
            icon: '💧',
            category: 'เตือนจิบน้ำเพื่อความสดชื่น',
            avatarGradient: 'bg-gradient-to-tr from-blue-500 to-indigo-400',
            message: msg,
            actionText: '+ จิบน้ำ 1 แก้ว',
            actionFn: () => {
                adjustWater(1);
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
    const targets = getCalculatedTargets();
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
                actionFn: () => adjustWater(1)
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
                actionFn: () => adjustWater(1)
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
                    state.activeMeal = 'breakfast';
                    renderMealSelector();
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
                    state.activeMeal = 'lunch';
                    renderMealSelector();
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
                    state.activeMeal = 'dinner';
                    renderMealSelector();
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

// Ensure state and core handlers are attached to window
window.state = state;
window.openProfileSettingsModal = openProfileSettingsModal;
window.closeProfileSettingsModal = closeProfileSettingsModal;
window.closeProfileSettingsOnBackdrop = closeProfileSettingsOnBackdrop;
window.openQuickAddModal = openQuickAddModal;
window.closeQuickAddModal = closeQuickAddModal;
window.closeQuickAddOnBackdrop = closeQuickAddOnBackdrop;
window.submitQuickAddMeal = submitQuickAddMeal;
window.copyYesterdayActiveMeal = copyYesterdayActiveMeal;
window.openFoodMealPicker = openFoodMealPicker;
window.closeFoodMealPickerModal = closeFoodMealPickerModal;
window.closeFoodMealPickerOnBackdrop = closeFoodMealPickerOnBackdrop;
window.setFoodPickerPortion = setFoodPickerPortion;
window.submitFoodMealPicker = submitFoodMealPicker;
window.getFastingPlanTargetHours = getFastingPlanTargetHours;
window.setFastingPlan = setFastingPlan;
window.toggleFastingTimer = toggleFastingTimer;
window.openFastingCompleteModal = openFastingCompleteModal;
window.closeFastingCompleteModal = closeFastingCompleteModal;
window.confirmFinishFasting = confirmFinishFasting;
window.promptEditFastingStartTime = promptEditFastingStartTime;
window.renderFastingSection = renderFastingSection;
window.updateVersionBadges = updateVersionBadges;
window.renderSupplements = renderSupplements;
window.toggleSupplement = toggleSupplement;
window.openAddSupplementModal = openAddSupplementModal;
window.closeAddSupplementModal = closeAddSupplementModal;
window.closeAddSupplementModalOnBackdrop = closeAddSupplementModalOnBackdrop;
window.submitNewSupplement = submitNewSupplement;
window.deleteSupplement = deleteSupplement;
window.deleteCustomSupplement = deleteCustomSupplement;
window.restoreDefaultSupplements = restoreDefaultSupplements;

window.forceReshuffleRecommendations = forceReshuffleRecommendations;
window.renderSmartRecommendations = renderSmartRecommendations;
window.showConfirmDialog = showConfirmDialog;
window.closeConfirmDialog = closeConfirmDialog;

// Living App Companion Engine
window.showLivingCompanionNudge = showLivingCompanionNudge;
window.dismissLivingCompanionNudge = dismissLivingCompanionNudge;
window.triggerLivingCompanionCheck = triggerLivingCompanionCheck;
window.checkLivingAppNudges = checkLivingAppNudges;
window.openCompanionTestModal = openCompanionTestModal;
window.closeCompanionTestModal = closeCompanionTestModal;
window.triggerTestCompanionNudge = triggerTestCompanionNudge;
window.triggerCelebrationConfetti = triggerCelebrationConfetti;
window.showMilestoneBeatCard = showMilestoneBeatCard;
window.dismissMilestoneCelebration = dismissMilestoneCelebration;
window.reshuffleCurrentCompanionNudge = reshuffleCurrentCompanionNudge;
window.checkMilestoneCelebrations = checkMilestoneCelebrations;

// Prestige Avatar Frames & Anti-Cheat Engine (Phase 2 & 3)
window.PRESTIGE_TIERS = PRESTIGE_TIERS;
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
window.showMiniLoader = showMiniLoader;
window.hideMiniLoader = hideMiniLoader;
window.dismissAppPreloader = dismissAppPreloader;
window.getPushPermissionState = getPushPermissionState;
window.updatePushStatusUI = updatePushStatusUI;
window.requestPushPermission = requestPushPermission;
window.requestPushPermissionFromBanner = requestPushPermissionFromBanner;
window.dismissPushPrompt = dismissPushPrompt;
window.checkPushPromptEligibility = checkPushPromptEligibility;
window.testLocalNotification = testLocalNotification;
window.togglePushNotificationPermission = togglePushNotificationPermission;
