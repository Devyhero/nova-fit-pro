# 🗺️ NovaFit Pro (fitmacro-web) - Codebase Map & Architecture Reference

> **Purpose**: Single source of truth for code positions, state structure, and functions. **Saves 80–90% of tokens** by allowing instant targeted lookups without scanning large source files.

---

## 📂 1. File Directory Map

| File | Approximate Size | Responsibility |
|---|---|---|
| `public/index.html` | ~420 KB (4,674 lines) | User interface, section accordions, all modal templates, SW bootstrap |
| `public/app.js` | ~165 KB (2,789 lines) | Core business logic, macro calculation, meals logging, modals |
| `public/web-push.js` | ~8 KB (198 lines) | Web push notifications permission, FCM integration, status UI & local watch tests |
| `public/water-tracker.js` | ~7 KB (152 lines) | Water intake calculator, targets, clickable glass icons, progress bar & hydration advice |
| `public/body-tracker.js` | ~30 KB (606 lines) | Body weight tracking, workout logging, burned cal deduction & 7-day weekly analytics chart |
| `public/coach-engine.js` | ~24 KB (405 lines) | Smart Coach recommendations, remaining macro heuristics, Gemini AI analysis & food cards |
| `public/sound-effects.js` | ~8 KB (171 lines) | Procedural Web Audio synthesizer, sound effects (pop, water, celebrate, nudge, delete), mute/unmute state & buttons |
| `public/daily-report.js` | ~12 KB (266 lines) | Daily nutrition & deficit report modal, release changelog modal, PWA update prompt & version badges |
| `public/data-backup.js` | ~7 KB (158 lines) | JSON data backup export, backup file restore, factory reset & PWA install prompts |
| `public/quick-add.js` | ~10 KB (242 lines) | Apple-grade smooth animated modal controller, profile drawer, onboarding prompt & quick meal logger |
| `public/meal-combos.js` | ~35 KB (618 lines) | Meal combos (sets), yesterday copying & visual portion editor modal |
| `public/living-companion.js` | ~50 KB (893 lines) | Living companion empathy nudges, milestone celebration confetti, quotes & timers |
| `public/prestige-wardrobe.js` | ~45 KB (845 lines) | Prestige avatar frames, anti-cheat streak engine, app tour guide & profile customizer |
| `public/share-card.js` | ~30 KB (612 lines) | High-resolution 1080x1420 HTML5 Canvas daily summary share card generator |
| `public/fasting-engine.js` | ~20 KB (431 lines) | Intermittent Fasting (IF) timer engine, progress rings, stage notifications |
| `public/meal-combos.js` | ~30 KB (618 lines) | Meal combos (sets), copy meal from yesterday, visual ingredient portion editor |
| `public/supplements.js` | ~15 KB (319 lines) | Daily vitamin & supplement checklist, custom supplement modal, restore defaults |
| `public/food-db.js` | ~50 KB | 280+ food items database, categories, `DEFAULT_SUPPLEMENTS`, meal presets |
| `public/health-tips.js` | ~88 KB | Daily health tips engine (65+ items), randomized rotator |
| `public/health-tips.json`| ~75 KB | Raw health and nutrition tips dataset for offline/PWA cache |
| `public/ai-snap.js`     | ~97 KB | AI Vision food scanning (Gemini Flash Vision) & multi-modal intake |
| `public/nutrition-scanner.js` | ~16 KB | 7-Eleven Barcode DB & AI Nutrition Facts Label Scanner OCR |
| `public/firebase-sync.js`| ~56 KB | Realtime Firestore sync (`users/{uid}`), Google Auth, offline state |
| `public/mascot-companion.js` | ~55 KB | Nova mascot companion engine, 3 roles, 5-mood sprite state, 4-tier token guard |
| `public/admin.html` | ~260 KB | Admin dashboard with 6 management tabs |
| `public/admin.js` | ~188 KB | Admin auth, user inspection, DAU/Peak metrics, push messaging, audit logs |
| `public/sw.js` | ~7 KB | PWA Service Worker, precaching, cache-busting, skipWaiting lifecycle |
| `public/version.json` | ~2 KB | App version manifest for PWA update checks |
| `scripts/test-preflight.js` | ~10 KB | Syntax checker, HTML tag balance, asset verification, version alignment |
| `scripts/test-browser-cdp.js`| ~148 KB | 50 automated browser E2E tests via Chrome DevTools Protocol |
| `firestore.rules` | ~3.7 KB | Firestore security rules (role-based user vs admin permissions) |
| `GEMINI.md` | ~8.5 KB | Core AI workflow rules, 2-device sync standards, release protocols |

---

## 🧠 2. State Architecture (`state` in `public/app.js`)

Persisted in `localStorage.getItem('fitmacro_pro_v4_state')` and synchronized to Firestore `users/{uid}`:

```javascript
state = {
    version: '5.9.30',                 // Current semantic version
    theme: 'dark' | 'light',           // App theme
    selectedDate: 'YYYY-MM-DD',        // Active viewing date (resets to today on boot)
    lastActiveDate: 'YYYY-MM-DD',      // Last recorded activity date
    activeMeal: 'breakfast' | 'lunch' | 'dinner' | 'snack', // Currently active meal slot
    selectedPortion: 1,                // Active food portion multiplier
    selectedCategory: 'all',           // Active category in food database explorer
    searchQuery: '',                   // Food search query string
    profileConfigured: true | false,   // Whether user has completed profile setup
    profile: {
        gender, age, height, weight, activity, goal,
        formula, customTdee, customP, customC, customF,
        smartProteinCap: true          // Clinical protein ceiling (1.6 - 2.2 g/kg)
    },
    logsByDate: {                      // Daily meal logs
        "YYYY-MM-DD": [ { name, p, c, f, cal, portion, meal, servingSize, timestamp } ]
    },
    supplementList: [                  // Full CRUD supplements & vitamins
        { id, name, time, icon, isCustom }
    ],
    supplementsByDate: {               // Supplement checkboxes per date
        "YYYY-MM-DD": { "supp_id": true }
    },
    waterByDate: { "YYYY-MM-DD": 2500 }, // Water intake in ml
    weightsByDate: { "YYYY-MM-DD": 70 }, // Body weight tracking in kg
    workoutsByDate: {                  // Workouts logged per date
        "YYYY-MM-DD": [ { name, duration, calBurned, timestamp } ]
    },
    dayTypeByDate: { "YYYY-MM-DD": 'training' | 'rest' },
    fasting: {                         // Intermittent Fasting engine
        isFasting: false,
        plan: '16:8' | '18:6' | '14:10' | '20:4',
        targetHours: 16,
        startTime: timestamp,
        endTime: timestamp,
        history: [ { startTime, endTime, targetHours, plan, durationHours, achieved } ]
    },
    streakFreeze: {                    // Streak Freeze Shield system
        month: 'YYYY-MM',
        shieldsRemaining: 2,
        maxShields: 2,
        frozenDates: []
    },
    prestige: {                        // Prestige avatar frames & verified streak
        frameId: 'novice',
        verifiedStreak: 0,
        unlockedFrames: ['novice']
    },
    mealCombos: [ ... ],               // Custom meal combos
    favorites: [ ... ],                // Starred food items
    collapsedSections: { ... }         // Accordion open/collapsed states
}
```

---

## 📍 3. Code Index by Line Range in `public/app.js` (Updated v5.9.30)

> [!TIP]
> Before modifying or reading any code, check this index and use `read_file` with specific line ranges to minimize token consumption.

| Line Range | Module / Component | Key Functions |
|---|---|---|
| **L1 – L96** | **State Definition, Default State & App Bootstrap** | `APP_VERSION`, default `state`, `cleanDuplicateMealLogs()` |
| **MODULARIZED** | **Sound Effects & Web Audio Synthesizer** | Extracted to `public/sound-effects.js` (171 lines): `getAudioContext()`, `playSound()`, `renderSoundButton()`, `toggleSound()` |
| **L98 – L299** | **Storage Engine & Core State** | `loadState()`, `saveState()` |
| **MODULARIZED** | **Prestige Wardrobe, Anti-Cheat Streak & App Tour Guide** | Extracted to `public/prestige-wardrobe.js` (845 lines) |
| **L301 – L400** | **Toast, UI Preloader & Mini Loader** | `showToast()`, `showMiniLoader()`, `hideMiniLoader()`, `initAppPreloader()`, `dismissAppPreloader()` |
| **MODULARIZED** | **Web Push Notifications & FCM Engine** | Extracted to `public/web-push.js` (198 lines) |
| **L402 – L664** | **Theme & FLIP Smooth Accordion Engine** | `applyTheme()`, `toggleTheme()`, `toggleAllSettings()`, `animateSmoothAccordion()`, `toggleCardSection()`, `renderAllSectionCollapses()` |
| **L665 – L1093**| **Profile Targets & Clinical Macro Calculator** | `getEffectiveWeight()`, `getCalculatedTargets()`, `applyBmrSafetyFloor()`, `setDayType()`, `renderAll()` |
| **L1094 – L1213**| **Macro Presets & Universal Food Search** | `setActiveMeal()`, `setSelectedPortion()`, `setMacroPreset()`, `setProtein2gPerKg()`, `adjustMacros()`, `selectCategory()`, `onSearchFood()` |
| **L1214 – L1675**| **Custom Confirm Dialog & Cloud Food DB Sync** | `showConfirmDialog()`, `deleteCustomPreset()`, `applyCentralFoodsFromCloud()`, `renderFoodDatabaseExplorer()` |
| **MODULARIZED** | **Water Tracker & Hydration Engine** | Extracted to `public/water-tracker.js` (152 lines) |
| **MODULARIZED** | **Body Weight, Workouts & Weekly Analytics Engine** | Extracted to `public/body-tracker.js` (606 lines) |
| **L1680 – L1950**| **Date Tracker & Nutrition Progress Coordinator** | `renderDateTrackerAndRecommendations()` (daily donut, macronutrient progress bars, net calories) |
| **MODULARIZED** | **Meal Combos & Visual Editor Engine** | Extracted to `public/meal-combos.js` (618 lines) |
| **MODULARIZED** | **Supplements & Vitamins Engine** | Extracted to `public/supplements.js` (319 lines) |
| **MODULARIZED** | **Smart Coach Recommendations Engine** | Extracted to `public/coach-engine.js` (405 lines) |
| **L1995 – L2355**| **Date Navigation & Daily Meals CRUD** | `onDateChange()`, `shiftDate()`, `goToToday()`, `addFoodItem()`, `openFoodMealPicker()`, `removeFoodItem()`, `copyDailySummaryToClipboard()` |
| **MODULARIZED** | **Daily Report, Changelog & App Updates Engine** | Extracted to `public/daily-report.js` (266 lines): `openDailyReportModal()`, `openChangelogModal()`, `showNewVersionBanner()`, `checkForAppUpdates()`, `updateVersionBadges()` |
| **MODULARIZED** | **Intermittent Fasting (IF) Engine** | Extracted to `public/fasting-engine.js` (431 lines) |
| **MODULARIZED** | **Visual Share Card (HTML5 Canvas Drawing)** | Extracted to `public/share-card.js` (612 lines) |
| **MODULARIZED** | **Data Backup, Restore & PWA Engine** | Extracted to `public/data-backup.js` (158 lines): `exportData()`, `importData()`, `resetAllData()`, `handlePwaInstallClick()` |
| **L2360 – L2760**| **Service Worker Bootstrap, Cloud State Merge Adapter & Day Rollover** | `applyCloudState()`, `autoSyncMealByTime()`, `checkDayRollover()` |
| **MODULARIZED** | **Apple-Grade Modals & Profile Drawer** | Extracted to `public/quick-add.js` (242 lines): `openModalAnimated()`, `closeModalAnimated()`, `openProfileSettingsModal()`, `openQuickAddModal()`, `submitQuickAddMeal()` |
| **MODULARIZED** | **Living App Companion & Milestone Confetti Cannon** | Extracted to `public/living-companion.js` (893 lines) |
| **L2761 – L2789**| **Window Global Handlers & Dynamic Exports** | `window.xxx` bindings for inline HTML event handlers |

---

## 🪟 4. Modal Registry

| Modal DOM ID | Controller | Open / Close Functions | Purpose |
|---|---|---|---|
| `profileSettingsModal` | `app.js` | `openProfileSettingsModal()` / `closeProfileSettingsModal()` | User profile, biometric targets, macro preferences |
| `changelogModal` | `app.js` | `openChangelogModal()` / `closeChangelogModal()` | User-centric release notes & feature highlights |
| `dailyReportModal` | `app.js` | `openDailyReportModal()` / `closeDailyReportModal()` | Daily nutrition summary table & macro breakdown |
| `aiSnapModal`      | `ai-snap.js` / `nutrition-scanner.js` | `openAiSnapModal()` / `openNutritionLabelScanner()` / `closeAiSnapModal()` | Food image & 7-Eleven nutrition label & barcode scanner |
| `addSupplementModal` | `supplements.js` | `openAddSupplementModal()` / `closeAddSupplementModal()` | Add vitamin/supplement with quick emoji presets |
| `quickAddModal` | `app.js` | `openQuickAddModal()` / `closeQuickAddModal()` | Quick calorie and protein logger |
| `foodMealPickerModal` | `app.js` | `openFoodMealPicker(...)` / `closeFoodMealPickerModal()` | Food meal slot selector (breakfast/lunch/dinner/snack) |
| `fastingCompleteModal` | `fasting-engine.js` | `openFastingCompleteModal()` / `closeFastingCompleteModal()` | Fasting session complete celebration & autophagy report |
| `prestigeWardrobeModal` | `prestige-wardrobe.js` | `openPrestigeWardrobeModal()` / `closePrestigeWardrobeModal()` | Avatar frames wardrobe & verified streak stats |
| `shareCardModal` | `share-card.js` | `openShareCardModal()` / `closeShareCardModal()` | Visual share card preview & export dialog |
| `mealComboEditModal` | `meal-combos.js` | `openMealComboEditor()` / `closeMealComboEditor()` | Visual multi-item portion adjustment & combo creator |
| `userNotificationsModal`| `app.js` | `openUserNotificationsModal()` / `closeUserNotificationsModal()` | In-app notification inbox from coach/admin |
| `shareCardModal` | `share-card.js` (L38) | `openShareCardModal()` / `closeShareCardModal()` | Canvas graphic daily summary share card |
| `prestigeWardrobeModal` | `prestige-wardrobe.js` | `openPrestigeWardrobeModal()` / `closePrestigeWardrobeModal()` | Avatar frames wardrobe & verified streak tiers |
| `appTourModal` | `prestige-wardrobe.js` | `openAppTourModal()` / `closeAppTourModal()` | 6-slide onboarding and PWA install guide |
| `mealComboEditorModal` | `meal-combos.js` | `openMealComboEditor()` / `closeMealComboEditor()` | Visual meal combo builder and item portion editor |
| `companionTestModal` | `living-companion.js` | `openCompanionTestModal()` / `closeCompanionTestModal()` | Sandbox test launcher for Nova companion nudges |
| `confirmDialog` | `app.js` (L2279) | `showConfirmDialog()` / `closeConfirmDialog()` | Unified custom alert/confirm dialog |
| `userInspectModal` | `admin.js` | `inspectUser(uid)` / `closeUserInspectModal()` | User diary inspection modal (Admin only) |
| `sendMessageModal` | `admin.js` | `openSendMessageModal(...)` / `closeSendMessageModal()` | Push/in-app message composer (Admin only) |

---

## 🛡️ 5. Admin Dashboard Architecture (`admin.html` & `admin.js`)

Admin tab views switched via `switchAdminTab(tabId)`:
1. **`tabBtn_users` (`tabView_users`)**: User registry, live search, diary inspector, direct message triggers.
2. **`tabBtn_analytics` (`tabView_analytics`)**: Deep analytics, DAU metrics, device split (Mobile vs Desktop), Peak meal logging hours.
3. **`tabBtn_foods` (`tabView_foods`)**: Top 10 most logged foods across all users.
4. **`tabBtn_custom_presets` (`tabView_custom_presets`)**: User-created custom food presets.
5. **`tabBtn_message_logs` (`tabView_message_logs`)**: Notification dispatch audit logs.
6. **`tabBtn_system_changelog` (`tabView_system_changelog`)**: Technical & architectural release log.

---

## 🔒 6. Changelog Separation Rules

* **User Facing (`index.html` & `version.json`)**:
  * Show tangible features, health benefits, UI responsiveness.
  * Never mention technical terms (Admin, Firestore Rules, Cloud Functions, Indexes, CDP tests).
* **Admin Facing (`admin.html` Tab 6)**:
  * Document all architectural refactors, security rules, performance optimizations, and function audit references.

---

## 🚀 7. Mandatory Post-Code Workflow

```bash
# 1. Automated Verification (100% pass required)
node scripts/test-preflight.js
node scripts/test-browser-cdp.js

# 2. Commit & Push to Feature Branch
git add .
git commit -m "feat/fix: ..."
git push -u origin feature/<feature-name>

# 3. Deploy to UAT Channel
firebase hosting:channel:deploy uat --expires 30d
```
