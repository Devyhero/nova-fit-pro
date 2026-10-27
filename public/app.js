const APP_VERSION = '5.9.30';
        const STORAGE_KEY = 'fitmacro_pro_v4_state';
        // Note: MEAL_CONFIG, WORKOUT_PRESETS, DEFAULT_MEAL_COMBOS, DEFAULT_SUPPLEMENTS, FOOD_DATABASE are loaded from food-db.js

        function getTodayStr() {
            const now = new Date();
            const offset = now.getTimezoneOffset() * 60000;
            return new Date(now.getTime() - offset).toISOString().split('T')[0];
        }

        function getDefaultMealByTime(date = new Date()) {
            const d = (date instanceof Date && !isNaN(date.getTime())) ? date : new Date();
            const h = d.getHours();
            if (h >= 4 && h < 11) return 'breakfast';   // 04:00 - 10:59: มื้อเช้า
            if (h >= 11 && h < 16) return 'lunch';      // 11:00 - 15:59: มื้อเที่ยง
            if (h >= 16 && h < 21) return 'dinner';     // 16:00 - 20:59: มื้อเย็น
            return 'snack';                             // 21:00 - 03:59: ของว่าง / มื้อดึก
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
                smartProteinCap: true,
                macros: { p: 30, c: 40, f: 30 }
            },
            customPresets: [],
            logsByDate: {},
            waterByDate: {},
            streakFreeze: {
                month: '',
                shieldsRemaining: 2,
                maxShields: 2,
                frozenDates: []
            },
            mascotCompanion: {
                enabled: true,
                minimized: false,
                lastSpeechDate: '',
                lastSpeechTime: 0,
                chatDailyUsage: {}
            }
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
            const isMuted = state.soundEnabled === false;
            
            // 1. Settings Modal Controls
            const icon = document.getElementById('soundIcon');
            const btn = document.getElementById('btnSoundToggle');
            const modalIcon = document.getElementById('soundModalIcon');
            const statusBadge = document.getElementById('soundStatusBadge');
            const toggleText = document.getElementById('soundToggleBtnText');
            
            if (icon) icon.textContent = isMuted ? '🔇' : '🔊';
            if (modalIcon) modalIcon.textContent = isMuted ? '🔇' : '🔊';
            if (btn) btn.title = isMuted ? 'เปิดเสียงเอฟเฟกต์ (Unmute)' : 'ปิดเสียงเอฟเฟกต์ (Mute)';
            if (toggleText) toggleText.textContent = isMuted ? 'เปิดเสียง' : 'ปิดเสียง';
            if (statusBadge) {
                statusBadge.textContent = isMuted ? 'ปิดใช้งาน' : 'เปิดใช้งาน';
                statusBadge.className = isMuted
                    ? 'text-xs px-2.5 py-1 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-bold'
                    : 'text-xs px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold';
            }
            if (btn) {
                btn.className = isMuted
                    ? 'px-3.5 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-1.5'
                    : 'px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-1.5';
            }

            // 2. Tools Dropdown Controls
            const menuIcon = document.getElementById('soundMenuIcon');
            const menuBadge = document.getElementById('soundMenuBadge');
            if (menuIcon) menuIcon.textContent = isMuted ? '🔇' : '🔊';
            if (menuBadge) {
                menuBadge.textContent = isMuted ? 'ปิด' : 'เปิด';
                menuBadge.className = isMuted
                    ? 'text-[10px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 font-bold'
                    : 'text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold';
            }
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
                        activeMeal: getDefaultMealByTime(),
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
                        mascotCompanion: (parsed.mascotCompanion && typeof parsed.mascotCompanion === 'object') ? {
                            enabled: parsed.mascotCompanion.enabled !== false,
                            minimized: !!parsed.mascotCompanion.minimized,
                            lastSpeechDate: parsed.mascotCompanion.lastSpeechDate || '',
                            lastSpeechTime: Number(parsed.mascotCompanion.lastSpeechTime) || 0,
                            chatDailyUsage: parsed.mascotCompanion.chatDailyUsage || {}
                        } : {
                            enabled: true,
                            minimized: false,
                            lastSpeechDate: '',
                            lastSpeechTime: 0,
                            chatDailyUsage: {}
                        },
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
                    state.activeMeal = getDefaultMealByTime();
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
            if (!state.activeMeal) state.activeMeal = getDefaultMealByTime();
            state._lastAutoMealPeriod = state.activeMeal;
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
            if (!state.streakFreeze || typeof state.streakFreeze !== 'object') {
                state.streakFreeze = { month: todayStr.slice(0, 7), shieldsRemaining: 2, maxShields: 2, frozenDates: [] };
            }
            if (!Array.isArray(state.streakFreeze.frozenDates)) state.streakFreeze.frozenDates = [];
            loadCachedCentralFoods();
            if (window.verifyAndSanitizeStreak) window.verifyAndSanitizeStreak();
        }

        function saveState() {
            try {
                if (window.verifyAndSanitizeStreak) window.verifyAndSanitizeStreak();
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

        // [MODULARIZED]: Prestige Avatar Frames, Anti-Cheat & App Tour Guide ➔ public/prestige-wardrobe.js

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
                    if (_preloaderDismissed || window._preloaderDismissed) return;
                    _preloaderPhraseIndex = (_preloaderPhraseIndex + 1) % PRELOADER_PHRASES.length;
                    phraseEl.textContent = PRELOADER_PHRASES[_preloaderPhraseIndex];
                }, 1800);
            }
            // Rapid & reliable safety fallback: dismiss after 1.8s
            setTimeout(() => {
                dismissAppPreloader();
            }, 1800);
        }

        function dismissAppPreloader() {
            if (_preloaderDismissed) return;
            _preloaderDismissed = true;
            window._preloaderDismissed = true;
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
            }, 350);
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
                    badge.className = 'text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold';
                    badge.textContent = 'เปิด';
                } else if (perm === 'denied') {
                    badge.className = 'text-[10px] px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold';
                    badge.textContent = 'บล็อก';
                } else if (perm === 'unsupported') {
                    badge.className = 'text-[10px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 font-bold';
                    badge.textContent = 'ไม่รองรับ';
                } else {
                    badge.className = 'text-[10px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 font-bold';
                    badge.textContent = 'ปิด';
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
            const goalLabel = p.goalDiff === -12 ? 'ลีน+สร้างกล้าม (-12%)' : p.goalDiff < 0 ? `ลดไขมัน (${p.goalDiff}%)` : p.goalDiff > 0 ? `เพิ่มกล้าม (+${p.goalDiff}%)` : 'รักษาน้ำหนัก (0%)';

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

        // 60fps Exact-Height FLIP Accordion Animator (Zero Dead-Zone Lag on Mobile iOS/Android)
        function animateSmoothAccordion(body, willCollapse, alsoToggleHiddenClass = false) {
            if (!body) return;
            body.classList.add('accordion-section');
            clearTimeout(body._accAnimTimer);

            if (willCollapse) {
                const startHeight = body.offsetHeight || body.scrollHeight;
                body.style.transition = 'none';
                body.style.maxHeight = startHeight + 'px';
                void body.offsetHeight; // Commit exact numeric pixel height before collapsing
                body.style.transition = '';

                body.classList.add('accordion-animating', 'is-collapsed');
                if (alsoToggleHiddenClass) body.classList.add('hidden');
                body.style.maxHeight = '0px';

                body._accAnimTimer = setTimeout(() => {
                    body.classList.remove('accordion-animating');
                }, 340);
            } else {
                body.style.transition = 'none';
                body.classList.add('accordion-animating');
                body.classList.remove('hidden', 'is-collapsed');
                body.style.maxHeight = 'none';
                const targetHeight = Math.max(body.offsetHeight || body.scrollHeight, 60);
                body.style.maxHeight = '0px';
                void body.offsetHeight; // Commit 0px start state before expanding
                body.style.transition = '';
                body.style.maxHeight = targetHeight + 'px';

                body._accAnimTimer = setTimeout(() => {
                    body.classList.remove('accordion-animating');
                    if (!body.classList.contains('is-collapsed')) {
                        body.style.maxHeight = 'none';
                    }
                }, 340);
            }
        }
        window.animateSmoothAccordion = animateSmoothAccordion;

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

            animateSmoothAccordion(body, willBeCollapsed, false);

            if (icon) {
                icon.classList.add('accordion-chevron');
                icon.classList.toggle('icon-collapsed', willBeCollapsed);
            }

            // Mobile iOS Safari Viewport & Overscroll Clamping Protection
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
                foodBody.style.maxHeight = 'none';
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
                    if (!body.classList.contains('accordion-animating')) {
                        if (isCollapsed) {
                            body.classList.add('is-collapsed');
                            body.style.maxHeight = '0px';
                        } else {
                            body.classList.remove('hidden', 'is-collapsed');
                            body.style.maxHeight = 'none';
                        }
                    }
                }
                if (icon) {
                    icon.classList.add('accordion-chevron');
                    icon.classList.toggle('icon-collapsed', isCollapsed);
                }
            });

            // Synchronize custom food collapsible form
            const customBody = document.getElementById('customFoodFormBody');
            const customIcon = document.getElementById('customFormToggleIcon');
            if (customBody) {
                customBody.classList.add('accordion-section');
                if (!customBody.classList.contains('accordion-animating')) {
                    if (state.customFormOpen) {
                        customBody.classList.remove('hidden', 'is-collapsed');
                        customBody.style.maxHeight = 'none';
                        if (customIcon) customIcon.textContent = '▲ ซ่อนฟอร์ม';
                    } else {
                        customBody.classList.add('is-collapsed');
                        customBody.style.maxHeight = '0px';
                        if (customIcon) customIcon.textContent = '▼ เปิดฟอร์ม';
                    }
                }
            }
        }

        function toggleCustomForm() {
            const body = document.getElementById('customFoodFormBody');
            const icon = document.getElementById('customFormToggleIcon');
            if (!body) return;

            const isCurrentlyCollapsed = body.classList.contains('hidden') || body.classList.contains('is-collapsed');
            const willOpen = isCurrentlyCollapsed;

            state.customFormOpen = willOpen;
            saveState();

            animateSmoothAccordion(body, !willOpen, false);
            if (willOpen) {
                if (icon) icon.textContent = '▲ ซ่อนฟอร์ม';
                const nameInput = document.getElementById('inFoodName');
                if (nameInput) setTimeout(() => nameInput.focus(), 60);
            } else {
                if (icon) icon.textContent = '▼ เปิดฟอร์ม';
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

        // Calculate BMR, TDEE, Macros & Daily Water Target (Clinical & ISSN Mode-Aware Smart Protein Cap)
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

            // Clinical & Sports Nutrition Mode-Aware Smart Protein Cap:
            // - Balanced mode (30/40/30): 1.6 g/kg for light/sedentary activity (<= 1.375), 1.8 g/kg for active (>= 1.55)
            // - Muscle / Low-Carb mode: 2.0 g/kg for light activity (<= 1.375), 2.2 g/kg ceiling for active training (>= 1.55)
            const smartCapEnabled = state.profile.smartProteinCap !== false;
            const isBalancedMode = macros.p === 30 && macros.c === 40 && macros.f === 30;
            const maxProteinPerKg = isBalancedMode
                ? (activity <= 1.375 ? 1.6 : 1.8)
                : (activity <= 1.375 ? 2.0 : 2.2);
            const maxPGram = Math.round(weight * maxProteinPerKg);
            const rawPGram = Math.round(pCal / 4);
            let proteinCapped = false;
            let surplusToCarbGram = 0;

            if (smartCapEnabled && rawPGram > maxPGram) {
                const cappedPCal = maxPGram * 4;
                const surplusCal = Math.max(0, pCal - cappedPCal);
                pCal = cappedPCal;
                cCal = cCal + surplusCal;
                proteinCapped = true;
                surplusToCarbGram = Math.round(surplusCal / 4);
            }

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

            const pGram = proteinCapped ? maxPGram : Math.round(pCal / 4);
            const cGram = Math.round(cCal / 4);
            const fGram = Math.round(fCal / 9);
            const isBelowBmr = targetCal < bmr;
            const safeGoalDiff = Math.min(0, Math.ceil(((bmr / Math.max(1, tdee)) - 1) * 100));

            return {
                weight,
                weightInfo,
                bmr,
                tdee,
                targetCal,
                isBelowBmr,
                safeGoalDiff,
                dayType,
                isRestDay: dayType === 'rest',
                pGram,
                cGram,
                fGram,
                rawPGram,
                maxPGram,
                maxProteinPerKg,
                proteinCapped,
                surplusToCarbGram,
                smartCapEnabled,
                pCal, cCal, fCal,
                waterTargetGlasses,
                waterTargetMl,
                activityBonusMl
            };
        }

        function applyBmrSafetyFloor() {
            const t = getCalculatedTargets();
            state.profile.goalDiff = t.safeGoalDiff;
            saveState();
            renderAll();
            const updated = getCalculatedTargets();
            showToast(`🛡️ ปรับเป้าหมายแคลอรีสู่เกณฑ์ปลอดภัย (${updated.targetCal.toLocaleString()} kcal ≥ BMR) เรียบร้อยแล้ว`);
        }
        window.applyBmrSafetyFloor = applyBmrSafetyFloor;

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
            const goalRecompEl = document.getElementById('goalRecomp');
            if (goalRecompEl) goalRecompEl.className = `py-2 px-2 rounded-xl text-xs border transition ${p.goalDiff === -12 ? activeBtn : inactiveBtn}`;
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
                : p.goalDiff === -12
                    ? `โหมด Recomp: ลดไขมันพร้อมสร้างกล้ามเนื้อ (${kgPerWeek} กก./สัปดาห์ • ${dailyDiffKcal} kcal/วัน)`
                    : `แนวโน้มน้ำหนัก: ${dailyDiffKcal > 0 ? '+' : ''}${kgPerWeek} กก./สัปดาห์ (${dailyDiffKcal > 0 ? '+' : ''}${dailyDiffKcal} kcal/วัน)`;

            const totalMacroCal = Math.max(1, t.pCal + t.cCal + t.fCal);
            const effP = Math.round((t.pCal / totalMacroCal) * 100);
            const effC = Math.round((t.cCal / totalMacroCal) * 100);
            const effF = Math.max(0, 100 - effP - effC);

            document.getElementById('donutP').setAttribute('stroke-dasharray', `${effP} ${100 - effP}`);
            document.getElementById('donutP').setAttribute('stroke-dashoffset', '0');
            document.getElementById('donutC').setAttribute('stroke-dasharray', `${effC} ${100 - effC}`);
            document.getElementById('donutC').setAttribute('stroke-dashoffset', `-${effP}`);
            document.getElementById('donutF').setAttribute('stroke-dasharray', `${effF} ${100 - effF}`);
            document.getElementById('donutF').setAttribute('stroke-dashoffset', `-${effP + effC}`);

            document.getElementById('targetPGram').textContent = `${t.pGram}g`;
            document.getElementById('targetPMeta').textContent = `${t.pCal} kcal (${(t.pGram / curWeight).toFixed(1)} g/kg)`;
            document.getElementById('targetCGram').textContent = `${t.cGram}g`;
            document.getElementById('targetCMeta').textContent = `${t.cCal} kcal (${(t.cGram / curWeight).toFixed(1)} g/kg)`;
            document.getElementById('targetFGram').textContent = `${t.fGram}g`;
            document.getElementById('targetFMeta').textContent = `${t.fCal} kcal (${(t.fGram / curWeight).toFixed(1)} g/kg)`;

            // Render Smart Protein Cap Status & Reallocation Notice
            const smartCapBtn = document.getElementById('btnToggleSmartCap');
            const smartCapHint = document.getElementById('smartCapActiveHint');
            const dashCapBadge = document.getElementById('dashboardSmartCapBadge');
            const isCapOn = p.smartProteinCap !== false;

            const capLabelStr = (t.maxProteinPerKg || 2.2).toFixed(1);
            if (smartCapBtn) {
                smartCapBtn.textContent = isCapOn ? `✓ เปิดล็อก ≤ ${capLabelStr}g/kg` : 'ปิดล็อกเพดาน';
                smartCapBtn.className = isCapOn
                    ? 'px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 transition cursor-pointer'
                    : 'px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-600 transition cursor-pointer';
            }
            if (smartCapHint) {
                if (t.proteinCapped) {
                    smartCapHint.classList.remove('hidden');
                    smartCapHint.innerHTML = `🛡️ <b>เกณฑ์แพทย์ & โภชนาการทำงาน:</b> ล็อกโปรตีนตามน้ำหนักตัวที่ <b>${t.pGram}g (${capLabelStr} g/kg)</b> จากเดิม ${t.rawPGram}g และโอนพลังงานส่วนเกินไปเพิ่มคาร์บ <b>+${t.surplusToCarbGram}g</b> ให้ร่างกายสดชื่นและทำตามได้จริง`;
                } else {
                    smartCapHint.classList.add('hidden');
                }
            }
            if (dashCapBadge) {
                if (t.proteinCapped) {
                    dashCapBadge.classList.remove('hidden');
                    dashCapBadge.innerHTML = `<span>🛡️</span> <span><b>Smart Cap (${capLabelStr} g/kg):</b> ล็อกโปรตีนที่ <b>${t.pGram}g</b> • โอนส่วนเกินไปเพิ่มคาร์บ <b>+${t.surplusToCarbGram}g</b> ตามเกณฑ์โภชนาการ</span>`;
                } else {
                    dashCapBadge.classList.add('hidden');
                }
            }

            // Medical BMR Safety Guard Banners (v5.9.30)
            const dashBmrGuard = document.getElementById('dashboardBmrSafetyBanner');
            const modalBmrGuard = document.getElementById('modalBmrSafetyBanner');
            const bmrGuardHtml = `<span>⚠️ <b>คำแนะนำทางการแพทย์:</b> เป้าหมายแคลอรี (${t.targetCal.toLocaleString()} kcal) ต่ำกว่า BMR พื้นฐาน (${t.bmr.toLocaleString()} kcal) เสี่ยงต่อระบบเผาผลาญลดลง</span> <button type="button" onclick="applyBmrSafetyFloor()" class="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] shrink-0 transition cursor-pointer shadow-xs">🛡️ ปรับคืนค่าปลอดภัย (${t.safeGoalDiff}%)</button>`;
            if (dashBmrGuard) {
                if (t.isBelowBmr) {
                    dashBmrGuard.classList.remove('hidden');
                    dashBmrGuard.innerHTML = bmrGuardHtml;
                } else {
                    dashBmrGuard.classList.add('hidden');
                }
            }
            if (modalBmrGuard) {
                if (t.isBelowBmr) {
                    modalBmrGuard.classList.remove('hidden');
                    modalBmrGuard.innerHTML = bmrGuardHtml;
                } else {
                    modalBmrGuard.classList.add('hidden');
                }
            }

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
            if (typeof renderFastingSection === 'function') renderFastingSection();
            if (window.renderDailyHealthTip) window.renderDailyHealthTip();
            if (window.checkDailyTipNotification) window.checkDailyTipNotification();
            updateVersionBadges();
            if (typeof renderPrestigeFrames === 'function') renderPrestigeFrames();
            renderAllSectionCollapses();
            syncResponsiveLayout();
            if (typeof window.renderNovaMascot === 'function') {
                window.renderNovaMascot();
            }
            if (typeof window.renderMascotMenuBadge === 'function') {
                window.renderMascotMenuBadge();
            }
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
                // If user explicitly updates weight in Profile Settings, sync active date weight
                // so stale daily weight logs don't override the newly configured profile weight!
                if (field === 'weight' && num > 20 && state.weightsByDate && Object.keys(state.weightsByDate).length > 0) {
                    const activeDate = state.selectedDate || getTodayStr();
                    state.weightsByDate[activeDate] = num;
                }
                saveState();
                renderAll();
            }
        }
        function updateActivity(val) { state.profile.activity = parseFloat(val); saveState(); renderAll(); }
        function setGoalPreset(diff) {
            state.profile.goalDiff = diff;
            if (diff === -12) {
                // Body Recomposition preset: optimal muscle retention + fat loss ratio with Smart Protein Cap
                state.profile.macros = { p: 35, c: 40, f: 25 };
                state.profile.smartProteinCap = true;
                showToast('⚡ ตั้งโหมด Body Recomp (-12%): ลดไขมันพร้อมสร้างกล้ามเนื้อ');
            }
            saveState();
            renderAll();
        }
        function updateGoalDiff(val) { state.profile.goalDiff = parseInt(val, 10); saveState(); renderAll(); }

        function toggleSmartProteinCap() {
            state.profile.smartProteinCap = !(state.profile.smartProteinCap !== false);
            saveState();
            renderAll();
            if (state.profile.smartProteinCap) {
                showToast('🛡️ เปิดระบบล็อกเพดานโปรตีนอัจฉริยะ (ไม่เกิน 2.2 g/kg)');
            } else {
                showToast('⚙️ ปิดการล็อกเพดานโปรตีน (คำนวณตามเปอร์เซ็นต์ดิบ)');
            }
        }
        window.toggleSmartProteinCap = toggleSmartProteinCap;

        function setMacroPreset(p, c, f) {
            state.profile.macros = { p, c, f };
            saveState();
            renderAll();
        }

        function setProtein2gPerKg() {
            const t = getCalculatedTargets();
            const curW = t.weight || state.profile.weight || 70;
            const targetPGram = Math.round(curW * 2);
            let pPct = Math.round(((targetPGram * 4) / t.targetCal) * 100);
            pPct = Math.min(60, Math.max(15, pPct));
            // Standard sports nutrition fat allocation: ~25% of total calories (approx 0.8-1.0 g/kg)
            const fPct = Math.min(35, Math.max(20, Math.round(((curW * 0.9 * 9) / t.targetCal) * 100)));
            const cPct = Math.max(10, 100 - pPct - fPct);
            state.profile.macros = { p: pPct, c: cPct, f: 100 - pPct - cPct };
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
            const wasFocused = input && document.activeElement === input;
            if (input) {
                input.value = '';
                if (wasFocused) {
                    input.focus();
                }
            }
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

        // ==========================================
        // 🗄️ ADMIN CENTRAL FOOD DB LIVE MERGE ENGINE (v5.9.30)
        // ==========================================
        const CENTRAL_FOODS_CACHE_KEY = 'novafit_central_foods_cache';
        function applyCentralFoodsFromCloud(centralItems) {
            if (!Array.isArray(centralItems)) return;
            try {
                localStorage.setItem(CENTRAL_FOODS_CACHE_KEY, JSON.stringify(centralItems));
            } catch (e) {}
            if (!FOOD_DATABASE || !Array.isArray(FOOD_DATABASE.categories)) return;

            // Remove previous dynamic central items before re-merging
            FOOD_DATABASE.categories.forEach(cat => {
                if (Array.isArray(cat.foods)) {
                    cat.foods = cat.foods.filter(f => !f._isCentralAdminFood);
                }
            });

            centralItems.forEach(item => {
                if (!item || !item.name) return;
                const targetCatId = item.category || 'healthy';
                let catObj = FOOD_DATABASE.categories.find(c => c.id === targetCatId) || FOOD_DATABASE.categories[0];
                if (catObj && Array.isArray(catObj.foods)) {
                    const existsIdx = catObj.foods.findIndex(f => f.name === item.name);
                    const formatted = {
                        name: item.name,
                        servingSize: item.servingSize || '1 ที่',
                        calories: Math.round(Number(item.calories ?? item.cal) || 0),
                        protein: Number(item.protein ?? item.p) || 0,
                        carbs: Number(item.carbs ?? item.c) || 0,
                        fat: Number(item.fat ?? item.f) || 0,
                        _isCentralAdminFood: true,
                        _centralId: item.id
                    };
                    if (existsIdx >= 0) {
                        catObj.foods[existsIdx] = formatted;
                    } else {
                        catObj.foods.unshift(formatted);
                    }
                }
            });
            if (typeof renderFoodDatabaseExplorer === 'function') {
                renderFoodDatabaseExplorer();
            }
        }
        window.applyCentralFoodsFromCloud = applyCentralFoodsFromCloud;

        function loadCachedCentralFoods() {
            try {
                const raw = localStorage.getItem(CENTRAL_FOODS_CACHE_KEY);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        applyCentralFoodsFromCloud(parsed);
                    }
                }
            } catch (e) {}
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
        window.focusWeightInputToday = focusWeightInputToday;
        window.checkWeeklyWeighInNudge = checkWeeklyWeighInNudge;

        // [MODULARIZED]: Meal Combos & Visual Editor Engine ➔ public/meal-combos.js

        // [MODULARIZED]: Supplements & Vitamins Engine ➔ public/supplements.js

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
                const isToday = val === getTodayStr();
                state.activeMeal = isToday ? getDefaultMealByTime() : 'breakfast';
                if (isToday) state._lastAutoMealPeriod = state.activeMeal;
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
                const isToday = newDateStr === getTodayStr();
                state.activeMeal = isToday ? getDefaultMealByTime() : 'breakfast';
                if (isToday) state._lastAutoMealPeriod = state.activeMeal;
                saveState();
                renderAll();
            }
        }

        function goToToday() {
            state.selectedDate = getTodayStr();
            state.activeMeal = getDefaultMealByTime();
            state._lastAutoMealPeriod = state.activeMeal;
            saveState();
            renderAll();
            const mealName = MEAL_CONFIG[state.activeMeal]?.name || 'มื้อเช้า';
            showToast(`📅 กลับสู่วันปัจจุบัน (${mealName}) เรียบร้อย`);
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
        // Intermittent Fasting (IF) Timer Engine (v5.9.30)
        // Modularized to public/fasting-engine.js (Zero Token Waste)
        // ==========================================

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
        // VISUAL SHARE CARD (v5.9.30)
        // Modularized to public/share-card.js (Zero Token Waste)
        // ==========================================

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

        // Smooth & immediate preloader dismissal after initial setup
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            setTimeout(dismissAppPreloader, 600);
        } else {
            window.addEventListener('DOMContentLoaded', () => setTimeout(dismissAppPreloader, 600));
            window.addEventListener('load', () => setTimeout(dismissAppPreloader, 600));
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
}

function dismissProfileSettingsModal() {
    closeModalAnimated('profileSettingsModal');
    // If user hasn't confirmed profile yet, inform them gently
    if (!state.profileConfigured) {
        showToast('ℹ️ ข้อมูลร่างกายยังไม่ได้รับการบันทึก ระบบจะแสดงหน้านี้อีกครั้งจนกว่าจะกด "✓ บันทึกข้อมูลเรียบร้อย"');
    }
}

function saveAndConfirmProfileSettings() {
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
    closeModalAnimated('profileSettingsModal');
    if (typeof playSound === 'function') playSound('pop');
    showToast('✓ บันทึกข้อมูลร่างกายและเป้าหมายสำเร็จแล้ว!');
}

function checkFirstVisitProfilePrompt() {
    const tourSeen = localStorage.getItem('novafit_tour_seen');
    // 1. If brand new visitor hasn't seen the tour, show App Tour first!
    if (!tourSeen) {
        setTimeout(() => {
            openAppTourModal();
        }, 500);
        return;
    }

    // 2. If profile is not yet confirmed (profileConfigured !== true), keep prompting until user saves!
    if (!state.profileConfigured) {
        setTimeout(() => {
            openProfileSettingsModal();
            showToast('⚙️ กรุณาตรวจสอบและกด "✓ บันทึกข้อมูลเรียบร้อย" เพื่อเริ่มคำนวณเป้าหมายส่วนตัว');
        }, 500);
    }
}

function autoSyncMealByTime() {
    if (state.selectedDate !== getTodayStr()) return;
    const currentPeriod = getDefaultMealByTime();
    if (state._lastAutoMealPeriod && state._lastAutoMealPeriod !== currentPeriod) {
        console.log(`⏰ Time period shifted from ${state._lastAutoMealPeriod} to ${currentPeriod}, auto-selecting meal`);
        state.activeMeal = currentPeriod;
        state._lastAutoMealPeriod = currentPeriod;
        saveState();
        renderMealSelector();
        renderFoodDatabaseExplorer();
        const targets = getCalculatedTargets();
        renderDateTrackerAndRecommendations(targets, false);
    }
}

function checkDayRollover() {
    const todayStr = getTodayStr();
    if (state.lastActiveDate && state.lastActiveDate !== todayStr) {
        console.log('🌅 New day detected! Auto-switching to:', todayStr);
        state.lastActiveDate = todayStr;
        state.selectedDate = todayStr;
        state.activeMeal = getDefaultMealByTime();
        state._lastAutoMealPeriod = state.activeMeal;
        saveState();
        renderAll();
        const mealName = MEAL_CONFIG[state.activeMeal]?.name || 'มื้อเช้า';
        showToast(`🌅 อรุณสวัสดิ์วันใหม่! สลับไป${mealName}ให้อัตโนมัติแล้ว`);
    } else {
        autoSyncMealByTime();
    }
}

function closeProfileSettingsOnBackdrop(e) {
    if (e && e.target && e.target.id === 'profileSettingsModal') {
        dismissProfileSettingsModal();
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

// [MODULARIZED]: Living App Companion Engine ➔ public/living-companion.js

// Ensure state and core handlers are attached to window
window.state = state;
window.openProfileSettingsModal = openProfileSettingsModal;
window.closeProfileSettingsModal = closeProfileSettingsModal;
window.dismissProfileSettingsModal = dismissProfileSettingsModal;
window.saveAndConfirmProfileSettings = saveAndConfirmProfileSettings;
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
// Fasting functions exported in fasting-engine.js
window.updateVersionBadges = updateVersionBadges;
// Supplement functions exported via public/supplements.js

window.forceReshuffleRecommendations = forceReshuffleRecommendations;
window.renderSmartRecommendations = renderSmartRecommendations;
window.showConfirmDialog = showConfirmDialog;
window.closeConfirmDialog = closeConfirmDialog;


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
window.getDefaultMealByTime = getDefaultMealByTime;
window.autoSyncMealByTime = autoSyncMealByTime;
