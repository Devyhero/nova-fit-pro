# 🗺️ NovaFit Pro (fitmacro-web) - Codebase Map & Architecture Reference

> **Purpose**: Single source of truth for code positions, state structure, and functions. **Saves 80–90% of tokens** by allowing instant targeted lookups without scanning large source files.

---

## 📂 1. File Directory Map

| File | Approximate Size | Responsibility |
|---|---|---|
| `public/index.html` | ~420 KB | User interface, section accordions, all modal templates, SW bootstrap |
| `public/app.js` | ~430 KB (7,651 lines) | Core business logic, macro calculation, meals logging, IF timer, wardrobe, modals |
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
| **L1 – L585** | **State Definition, Web Audio Synthesizer & Core Storage** | `APP_VERSION`, default `state`, `playSound()`, `cleanDuplicateMealLogs()`, `loadState()`, `saveState()` |
| **L586 – L683** | **Streak Freeze Shield & Anti-Cheat Streak Engine** | `calculateVerifiedStreak()`, `isDayCovered()`, `verifyAndSanitizeStreak()`, `isFrameUnlocked()` |
| **L684 – L1101** | **Prestige Wardrobe Modal & App Tour Guide** | `openPrestigeWardrobeModal()`, `equipPrestigeFrame()`, `renderPrestigeFrames()`, `renderWardrobeModal()`, `openAppTourModal()`, `renderTourSlide()` |
| **L1102 – L1295**| **Avatar Photo Upload & UI Preloader** | `handleAvatarPhotoSelected()`, `saveProfileDisplayName()`, `removeCustomAvatarPhoto()`, `showToast()`, `showMiniLoader()`, `initAppPreloader()` |
| **L1296 – L1473**| **Web Push Notifications Engine** | `getPushPermissionState()`, `requestPushPermission()`, `dismissPushPrompt()`, `checkPushPromptEligibility()`, `testLocalNotification()`, `togglePushNotificationPermission()` |
| **L1474 – L1724**| **Theme & FLIP Smooth Accordion Engine** | `toggleTheme()`, `toggleAllSettings()`, `animateSmoothAccordion()`, `toggleCardSection()`, `renderAllSectionCollapses()` |
| **L1725 – L2173**| **Profile Targets & Clinical Macro Calculator** | `getEffectiveWeight()`, `getCalculatedTargets()`, `applyBmrSafetyFloor()`, `setDayType()`, `renderAll()` |
| **L2174 – L2278**| **Macro Presets & Universal Food Search** | `setActiveMeal()`, `setSelectedPortion()`, `setMacroPreset()`, `setProtein2gPerKg()`, `adjustMacros()`, `selectCategory()`, `onSearchFood()` |
| **L2279 – L2721**| **Custom Confirm Dialog & Cloud Food DB Sync** | `showConfirmDialog()`, `deleteCustomPreset()`, `applyCentralFoodsFromCloud()`, `renderFoodDatabaseExplorer()` |
| **L2722 – L3456**| **Water Tracker, Body Weight & Workouts** | `renderWaterSection()`, `submitWeightToday()`, `addWorkout()`, `renderBodyAndWorkoutSection()`, `renderWeeklyAnalytics()` |
| **L3457 – L3650**| **Daily Tracker & Meal Combo Engine** | `renderDateTrackerAndRecommendations()`, `copyMealFromYesterday()`, `saveMealAsCombo()`, `applyMealCombo()`, `deleteMealCombo()` |
| **L3651 – L4044**| **Meal Combo Full Visual Editor** | `openMealComboEditor()`, `onComboFoodSearchInput()`, `addFoodObjectToComboEditor()`, `renderComboEditorItems()`, `saveMealComboEditor()` |
| **L4045 – L4283**| **Supplements & Vitamins CRUD** | `renderSupplements()`, `toggleSupplement()`, `openAddSupplementModal()`, `submitNewSupplement()`, `deleteSupplement()`, `restoreDefaultSupplements()` |
| **L4284 – L4611**| **Smart Coach Recommendations & Food Cards** | `forceReshuffleRecommendations()`, `generateHeuristicCoachAdvice()`, `renderSmartRecommendations()`, `renderFoodCards()` |
| **L4612 – L5031**| **Water Adjustments, Date Navigation & Daily Meals CRUD** | `adjustWater()`, `onDateChange()`, `shiftDate()`, `goToToday()`, `addFoodItem()`, `openFoodMealPicker()`, `removeFoodItem()`, `copyDailySummaryToClipboard()` |
| **L5032 – L5266**| **Daily Report Modal, Changelog, PWA Update Prompt & Version Badges** | `openDailyReportModal()`, `openChangelogModal()`, `showNewVersionBanner()`, `checkForAppUpdates()`, `updateVersionBadges()` |
| **MODULARIZED** | **Intermittent Fasting (IF) Engine** | Extracted to `public/fasting-engine.js` (431 lines): `getFastingPlanTargetHours()`, `setFastingPlan()`, `toggleFastingTimer()`, `openFastingCompleteModal()`, `confirmFinishFasting()`, `renderFastingSection()` |
| **L5267 – L5822**| **Visual Share Card (HTML5 Canvas Drawing)** | `openShareCardModal()`, `renderShareCard()`, `downloadShareCard()`, `copyShareCardImage()`, `shareCardNative()` |
| **L5823 – L6129**| **Data Backup / Restore & Firebase Cloud Sync Adapter** | `exportData()`, `importData()`, `resetAllData()`, `handlePwaInstallClick()`, `applyCloudState()` |
| **L6130 – L6416**| **Apple-Grade Modals, Profile Drawer & Quick Add** | `openModalAnimated()`, `closeModalAnimated()`, `openProfileSettingsModal()`, `saveAndConfirmProfileSettings()`, `openQuickAddModal()`, `submitQuickAddMeal()` |
| **L6417 – L6755**| **Living App Companion & Milestone Confetti Cannon** | `getVariedCompanionMessage()`, `showLivingCompanionNudge()`, `triggerCelebrationConfetti()`, `showMilestoneBeatCard()`, `dismissMilestoneCelebration()`, `checkMilestoneCelebrations()` |
| **L6756 – L7179**| **Living Companion Loop & Sandbox Test Modal** | `triggerLivingCompanionCheck()`, `checkLivingAppNudges()`, `openCompanionTestModal()`, `triggerTestCompanionNudge()` |
| **L7180 – L7254**| **Window Global Handlers & Dynamic Exports** | `window.xxx` bindings for inline HTML event handlers |

---

## 🪟 4. Modal Registry

| Modal DOM ID | Controller | Open / Close Functions | Purpose |
|---|---|---|---|
| `profileSettingsModal` | `app.js` (L6554) | `openProfileSettingsModal()` / `closeProfileSettingsModal()` | User profile, biometric targets, macro preferences |
| `changelogModal` | `app.js` (L5128) | `openChangelogModal()` / `closeChangelogModal()` | User-centric release notes & feature highlights |
| `dailyReportModal` | `app.js` (L5032) | `openDailyReportModal()` / `closeDailyReportModal()` | Daily nutrition summary table & macro breakdown |
| `aiSnapModal`      | `ai-snap.js` / `nutrition-scanner.js` | `openAiSnapModal()` / `openNutritionLabelScanner()` / `closeAiSnapModal()` | Food image & 7-Eleven nutrition label & barcode scanner |
| `addSupplementModal` | `app.js` (L4164) | `openAddSupplementModal()` / `closeAddSupplementModal()` | Add vitamin/supplement with quick emoji presets |
| `quickAddModal` | `app.js` (L6644) | `openQuickAddModal()` / `closeQuickAddModal()` | Quick calorie and protein logger |
| `foodMealPickerModal` | `app.js` (L4723) | `openFoodMealPicker(...)` / `closeFoodMealPickerModal()` | Food meal slot selector (breakfast/lunch/dinner/snack) |
| `fastingCompleteModal` | `fasting-engine.js` (L38) | `openFastingCompleteModal()` / `closeFastingCompleteModal()` | Fasting session complete celebration & autophagy report |
| `userNotificationsModal`| `app.js` | `openUserNotificationsModal()` / `closeUserNotificationsModal()` | In-app notification inbox from coach/admin |
| `shareCardModal` | `app.js` (L5657) | `openShareCardModal()` / `closeShareCardModal()` | Canvas graphic daily summary share card |
| `prestigeWardrobeModal` | `app.js` (L684) | `openPrestigeWardrobeModal()` / `closePrestigeWardrobeModal()` | Avatar frames wardrobe & verified streak tiers |
| `appTourModal` | `app.js` (L801) | `openAppTourModal()` / `closeAppTourModal()` | 6-slide onboarding and PWA install guide |
| `mealComboEditorModal` | `app.js` (L3651) | `openMealComboEditor()` / `closeMealComboEditor()` | Visual meal combo builder and item portion editor |
| `companionTestModal` | `app.js` (L7407) | `openCompanionTestModal()` / `closeCompanionTestModal()` | Sandbox test launcher for Nova companion nudges |
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
