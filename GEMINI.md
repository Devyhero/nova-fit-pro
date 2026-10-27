# Project Guidelines: NovaFit Pro (fitmacro-web)

## 🔄 Two-Device Synchronization Standard (Mac & Windows)

> [!IMPORTANT]
> The project is developed across two machines (primary Mac and work Windows PC). **Always sync latest code from GitHub before making changes** to prevent code regression, overwrites, or Git conflicts.
> 
> * **Official GitHub Repository**: `https://github.com/Devyhero/nova-fit-pro.git`
> * **Git Committer**: Name: `Devyhero` | Email: `benznova01@gmail.com`
> * **Production URL**: `https://fitmacro-pro-benz.web.app`
> * **UAT Channel URL**: `https://fitmacro-pro-benz--uat-ywpcsdbf.web.app`

### Second Device Setup Checklist
When switching to another machine (e.g., Windows PC):
1. Verify remote URL:
   ```bash
   git remote set-url origin https://github.com/Devyhero/nova-fit-pro.git
   ```
2. Configure committer identity:
   ```bash
   git config user.name "Devyhero"
   git config user.email "benznova01@gmail.com"
   ```
3. Pull latest changes from `main`:
   ```bash
   git checkout main && git pull origin main
   ```

---

## 🌿 Mandatory Feature Branch & UAT Workflow

> [!CAUTION]
> **Never develop new features directly on `main`!**
> Every new feature must be developed on an isolated feature branch, tested with automated test suites, and **verified on the UAT channel by the user** before merging to `main` and deploying to Production.

```
[1. Start]           ──► git checkout main && git pull origin main
                             │
                             ▼
[2. New Branch]      ──► git checkout -b feature/<feature-name>
                             │
                             ▼
[3. Code & Test]     ──► node scripts/test-preflight.js && node scripts/test-browser-cdp.js
                             │
                             ▼
[4. Commit & Push]   ──► git add . && git commit -m "feat: ..." && git push -u origin feature/<feature-name>
                             │
                             ▼
[5. Deploy UAT]      ──► firebase hosting:channel:deploy uat --expires 30d
                             │   (URL: https://fitmacro-pro-benz--uat-ywpcsdbf.web.app)
                             ▼
[6. User UAT Test]   ──► Share UAT URL with user (Do NOT touch PROD until approved)
                             │
                             ▼ [Only after explicit user approval]
[7. Merge to main]   ──► git checkout main && git pull origin main && git merge feature/<feature-name>
                             │
                             ▼
[8. Push & Deploy]   ──► git push origin main && firebase deploy
                             │   (URL: https://fitmacro-pro-benz.web.app)
                             ▼
[9. Cleanup Branch]  ──► git branch -d feature/<feature-name>
```

---

## ⚡ Mandatory Pre-Work Steps

Before editing any code, the AI assistant must:
1. **Verify Git consistency**: Ensure `.git` exists and remote points to `Devyhero/nova-fit-pro.git`.
2. **Sync latest code**:
   ```bash
   git checkout main && git pull origin main
   ```
   *If unstaged changes or conflicts exist, notify user immediately before proceeding.*
3. **Branch for new features**: Run `git checkout -b feature/<name>` (never write new features on `main`).

---

## 🚀 Mandatory Feature Delivery Steps

After feature implementation on `feature/<name>`:

### Step 1: 100% Automated Verification
- Run quality checks:
  ```bash
  node scripts/test-preflight.js
  node scripts/test-browser-cdp.js
  ```
- **Rule**: If any test fails, **DO NOT commit or deploy**. Fix all issues until 100% pass.

### Step 2: Codebase Map & Token-Saving Sync (Mandatory)
- Every time code is modified, added, or refactored:
  - **Update line ranges and function names in `CODEBASE_MAP.md` and `GEMINI.md`**.
  - This ensures future tasks can jump directly to specific line ranges without scanning entire files, saving 80–90% of tokens.

### Step 3: Commit & Push to Feature Branch
```bash
git add .
git commit -m "feat(<scope>): ..."
git push -u origin feature/<feature-name>
```

### Step 4: Deploy to UAT Preview Channel
```bash
firebase hosting:channel:deploy uat --expires 30d
```
- Report results and provide UAT URL: `https://fitmacro-pro-benz--uat-ywpcsdbf.web.app`
- **Wait for user confirmation. Never touch Production!**

---

## 🌐 Production Release Protocol

**Condition**: Deploy to PROD only after user explicitly states: *"UAT passed, proceed to PROD"* (or equivalent):

1. Switch to `main` and sync:
   ```bash
   git checkout main && git pull origin main
   ```
2. Merge feature branch:
   ```bash
   git merge feature/<feature-name>
   ```
3. Push to GitHub:
   ```bash
   git push origin main
   ```
4. Deploy to Firebase Production:
   ```bash
   firebase deploy
   ```
5. Delete merged feature branch:
   ```bash
   git branch -d feature/<feature-name>
   ```
6. Report completion with Production URL: `https://fitmacro-pro-benz.web.app`

---

## 🏷️ Mandatory Versioning & Dual Changelog Protocol

> [!IMPORTANT]
> For major updates, bump version numbers and maintain strict separation between User-facing and Admin-facing changelogs.

### 1. Strict 5-File Version Alignment
Update version strings across all 5 files:
1. `public/version.json` ➔ `"version": "x.y.z"` and update `"buildDate"` ISO timestamp
2. `public/sw.js` ➔ `CACHE_NAME = 'novafit-pro-vx.y.z-cache'`
3. `public/app.js` ➔ `const APP_VERSION = 'x.y.z';`
4. `public/index.html` ➔ Script query strings `?v=x.y.z` and `#toolsVersionBadge` `(vx.y.z)`
5. `public/admin.html` ➔ Status badge `Current Version: vx.y.z`

### 2. User-Facing Changelog Rules
* **Target Files**: `public/version.json` (`features`), `public/index.html` (`#whatsNewAlertText`, `#changelogModal`).
* **Tone**: Polite, friendly Thai, lively with emojis (🚀, 🤖, 🍎, 💧, ✨, 🎙️). Focus on user value.
* **Prohibited Terms**: Never use technical terms like `Admin`, `Dashboard`, `Firestore Security Rules`, `Cloud Functions`, `API endpoint`, `Service Worker Cache`, `CDP tests`, `Preflight`, or `Backend Architecture`.

### 3. Admin-Facing Changelog Rules
* **Target Location**: `public/admin.html` (Tab 6: `tabView_system_changelog`).
* **Content**: In-depth architectural details, data sanitization in `ensureStateIntegrity()`, security rules, lifecycle hooks, performance optimizations, and function audit references.

---

## 🛡️ Efficiency & Reliability Protocols

### 1. Cross-Platform Line Ending Consistency (Mac ↔ Windows)
- `.gitattributes` enforces `* text=auto eol=lf`.
- On Windows: `git config --global core.autocrlf true` or `input`. Never commit CRLF converted files.

### 2. Backward Compatibility & State Integrity
- When introducing new fields to `state` or `localStorage`:
  - Always provide fallbacks in `ensureStateIntegrity()`.
  - Use optional chaining (`state.feature?.prop || default`). Never access undefined properties directly.

### 3. Minimal Blast Radius & No Wholesale Reformatting
- `app.js` and `index.html` are thousands of lines long:
  - Edit only lines directly related to the task.
  - Never auto-format or re-indent the entire file to avoid bloated diffs and regressions.

### 4. Synchronized CDP Testing
- When modifying UI elements (button IDs, modal flows, logic):
  - Add or update corresponding test cases in `scripts/test-browser-cdp.js`.
  - Both `test-preflight.js` and `test-browser-cdp.js` must pass 100% before UAT deployment.

### 5. Mobile-First Usability
- Touch targets must be at least `44x44px`.
- Zero horizontal overflow on 360px–430px viewports.
- Bottom floating elements must support iOS safe area: `env(safe-area-inset-bottom)`.
- Modals must support smooth touch scrolling without keyboard clipping.
- Hardware APIs (Speech, Share, Clipboard, Camera) must have feature detection and iOS Safari fallbacks.

### 6. Mandatory MD Documentation & Token Saving
- Keep `CODEBASE_MAP.md` and `GEMINI.md` synchronized with exact line ranges.
- Always check the line index before reading code to minimize token consumption.

### 7. Modular Feature Isolation Architecture (Zero Bloat Standard)
- **Never add large new features directly into `public/app.js`!**
- Always create a dedicated standalone module file (e.g., `public/<feature-name>.js`).
- Register the script tag in `public/index.html` (before `app.js`).
- Precache the new script in `public/sw.js` (`PRECACHE_ASSETS`).
- Include the new file in `scripts/test-preflight.js` (`jsFiles`).
- Bind handlers to `window.<functionName>` to ensure 100% backward compatibility with inline HTML `onclick` events.
- This guarantees `app.js` stays slim, saves 80–90% of tokens in future chats, and isolates regressions.

---

## 📍 Token-Saving Code Index (`public/app.js` - Updated v5.9.30)

> Check line ranges here before reading code. Use targeted line ranges with `read_file` to save 80–90% of tokens.

- **L1 – L440**: State Definition, Web Audio Synthesizer & Core Storage (`state`, `playSound`, `loadState`, `saveState`, `getTodayStr`)
- **[MODULARIZED]**: Prestige Avatar Frames, Anti-Cheat & App Tour Guide ➔ `public/prestige-wardrobe.js` (845 lines)
- **L442 – L521**: Toast, UI Preloader & Mini Loader (`showToast`, `showMiniLoader`, `hideMiniLoader`, `initAppPreloader`, `dismissAppPreloader`)
- **[MODULARIZED]**: Web Push Notifications & FCM Engine ➔ `public/web-push.js` (198 lines)
- **L523 – L773**: Theme & Smooth Accordions (`toggleTheme`, `animateSmoothAccordion`, `toggleCardSection`, `renderAllSectionCollapses`)
- **L774 – L1222**: Profile Targets & Clinical Macro Calculator (`getCalculatedTargets`, `applyBmrSafetyFloor`, `setDayType`, `renderAll`)
- **L1223 – L1327**: Macro Presets & Universal Food Search (`setMacroPreset`, `setProtein2gPerKg`, `adjustMacros`, `selectCategory`, `onSearchFood`)
- **L1328 – L1770**: Custom Confirm Dialog & Cloud Food DB Sync (`showConfirmDialog`, `applyCentralFoodsFromCloud`, `renderFoodDatabaseExplorer`)
- **[MODULARIZED]**: Water Tracker & Hydration Engine ➔ `public/water-tracker.js` (152 lines)
- **L1784 – L2512**: Body Weight & Workouts / Weekly Analytics (`switchBodyTab`, `submitWeightToday`, `addWorkout`, `renderBodyAndWorkoutSection`, `renderWeeklyAnalytics`)
- **L2513 – L2568**: Weekly Weigh-In Nudge & Focus (`checkWeeklyWeighInNudge`, `focusWeightInputToday`)
- **[MODULARIZED]**: Meal Combos & Visual Editor Engine ➔ `public/meal-combos.js` (618 lines)
- **[MODULARIZED]**: Supplements & Vitamins Engine ➔ `public/supplements.js` (319 lines)
- **L2571 – L2900**: Smart Coach Recommendations & Food Cards (`forceReshuffleRecommendations`, `generateHeuristicCoachAdvice`, `renderSmartRecommendations`)
- **L2901 – L3256**: Date Navigation & Daily Meals CRUD (`onDateChange`, `shiftDate`, `goToToday`, `addFoodItem`, `openFoodMealPicker`, `removeFoodItem`)
- **L3257 – L3467**: Daily Report Modal, Changelog, PWA Updates & Version Badges (`openDailyReportModal`, `openChangelogModal`, `showNewVersionBanner`, `checkForAppUpdates`, `updateVersionBadges`)
- **[MODULARIZED]**: Intermittent Fasting (IF) Engine ➔ `public/fasting-engine.js` (431 lines)
- **[MODULARIZED]**: Visual Share Card (HTML5 Canvas) ➔ `public/share-card.js` (612 lines)
- **L3468 – L3774**: Data Backup & Cloud Sync Adapter (`exportData`, `importData`, `resetAllData`, `applyCloudState`)
- **L3775 – L3969**: Apple-Grade Modals, Profile Drawer & Quick Add (`openModalAnimated`, `closeModalAnimated`, `openProfileSettingsModal`, `openQuickAddModal`)
- **[MODULARIZED]**: Living App Companion & Milestone Confetti ➔ `public/living-companion.js` (893 lines)
- **L3970 – L4011**: Window Global Exports (Global `window.xxx` bindings)
