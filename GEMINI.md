# Project Guidelines: NovaFit Pro (fitmacro-web)

## Workflow การพัฒนาฟีเจอร์ใหม่ & ระบบ Branching (Git Feature Branch & UAT Workflow)

เพื่อความปลอดภัยสูงสุดของระบบ Production ให้ปฏิบัติตามมาตรฐานนี้เสมอ:

```
[แตก Branch พัฒนาฟีเจอร์] ──► git checkout -b feature/<name>
             │
             ▼
[ตรวจสอบโค้ด 100%]        ──► node scripts/test-preflight.js && node scripts/test-browser-cdp.js
             │
             ▼
[Deploy ขึ้น UAT เพื่อลอง] ──► firebase hosting:channel:deploy uat --expires 30d
             │                (URL: https://fitmacro-pro-benz--uat-ywpcsdbf.web.app)
             ▼
[ผู้ใช้ทดสอบ UAT ผ่านแล้ว]
             │
             ▼
[Merge กลับเข้า main]     ──► git checkout main && git merge feature/<name> && git push origin main
             │
             ▼
[Deploy ขึ้นเว็บจริง PROD]  ──► firebase deploy (URL: https://fitmacro-pro-benz.web.app)
```

## Workflow อัตโนมัติหลังแก้ไขงานเสร็จสิ้นทุกครั้ง (Mandatory Post-Edit Steps)

ทุกครั้งที่มีการแก้ไขโค้ด ปรับปรุงฟีเจอร์ หรือแก้ไขบั๊กในโปรเจกต์นี้เสร็จเรียบร้อยแล้ว **ต้องปฏิบัติตามลำดับขั้นอย่างเคร่งครัด** ดังนี้:

### ขั้นที่ 1: ตรวจสอบความถูกต้องของโค้ด (Mandatory Pre-flight Verification)
- รันสคริปต์ตรวจสอบ:
  ```bash
  node scripts/test-preflight.js
  ```
- **เงื่อนไขสำคัญ**: 
  - สคริปต์นี้จะตรวจสอบ Syntax ของโค้ด JavaScript ทั้งหมด (ทั้งไฟล์เดี่ยวและ inline script ขนาดใหญ่ใน `index.html`), ตรวจสอบความถูกต้องของ JSON ทุกไฟล์, เช็ก Broken Link ของ Assets, ตรวจสอบความสอดคล้องของ Version ระหว่าง `version.json` กับ `sw.js`, และทดสอบความถูกต้องของ Firestore Rules ผ่าน Dry-run
  - **หากผลการตรวจสอบไม่ผ่าน (Exit code != 0 หรือมีข้อผิดพลาด) ห้าม Commit และห้าม Deploy เด็ดขาด!** ต้องแก้ปัญหาให้โค้ดทำงานได้ถูกต้องเรียบร้อยและรันผ่าน 100% ก่อนเท่านั้น

### ขั้นที่ 2: Commit & Push ขึ้น Git
- รันคำสั่ง `git status` เพื่อตรวจสอบไฟล์ที่เปลี่ยนแปลง
- สเตจไฟล์ด้วย `git add .` (หรือเฉพาะไฟล์ที่เกี่ยวข้อง)
- สร้าง commit message ที่สื่อความหมายชัดเจน (เช่น `feat: ...`, `fix: ...`, `test: ...`)
- พุชขึ้น GitHub:
  ```bash
  git push origin main
  ```

### ขั้นที่ 3: Deploy ขึ้น Firebase
- สั่งรันคำสั่ง:
  ```bash
  firebase deploy
  ```
- ตรวจสอบผลการ deploy ว่าสำเร็จเรียบร้อย (URL: https://fitmacro-pro-benz.web.app)

### ขั้นที่ 4: สรุปผลรายงานผู้ใช้
- แจ้งผลการตรวจสอบโค้ด (Pre-flight checks passed)
- แจ้งรายการที่แก้ไข/เพิ่มใหม่
- แจ้งสถานะ Git commit และ push
- แจ้งสถานะการ deploy บน Firebase พร้อมลิงก์เข้าใช้งาน

---

## ดัชนีแผนผังโค้ดประหยัด Token (Token-Saving Architecture Reference)

> เพื่อประหยัดเวลาและ Token ห้ามไล่อ่านโค้ดไฟล์ขนาดใหญ่ (`app.js`, `index.html`) ทั้งไฟล์โดยไม่จำเป็น ให้ตรวจสอบตำแหน่งฟังก์ชันจาก [CODEBASE_MAP.md](file:///Users/benznova/Desktop/fitmacro-web/CODEBASE_MAP.md) หรือดัชนีด้านล่างก่อนเสมอ:

### ตำแหน่งฟังก์ชันหลักใน `public/app.js`:
- **State & Storage**: บรรทัด 1–187 (`state`, `ensureStateIntegrity`, `saveState`, `getTodayStr`)
- **Profile & Macro Calculator**: บรรทัด 188–350 (`calculateMacroTargets`, `getCalculatedTargets`, `toggleTheme`)
- **Date Navigation**: บรรทัด 351–580 (`shiftDate`, `goToToday`, `onDateChange`, `renderDailySummary`)
- **Meals & Daily Tracker**: บรรทัด 581–1150 (`renderAll`, `renderMacros`, `renderMeals`, `deleteFoodLog`, `renderWaterSection`)
- **Food DB & Search**: บรรทัด 1151–1450 (`renderFoodDatabase`, Universal Food Search)
- **Custom Foods & Workouts**: บรรทัด 1451–1740 (`submitCustomFood`, `renderWorkouts`, `addWorkoutLog`)
- **Meal Combos**: บรรทัด 1741–1870 (`copyMealFromYesterday`, `applyMealCombo`)
- **Supplements & Vitamins**: บรรทัด 1871–2055 (`renderSupplements`, `toggleSupplement`, `deleteSupplement`, `restoreDefaultSupplements`)
- **Quick Meal Picker**: บรรทัด 2056–2350 (`openFoodMealPicker`, `submitFoodMealPicker`)
- **Intermittent Fasting (IF)**: บรรทัด 2351–2650 (`toggleFastingTimer`, `renderFastingSection`, `openFastingCompleteModal`)
- **PWA & Version Updates**: บรรทัด 2651–2950 (`initPwaUpdates`, `checkForAppUpdate`, `openChangelogModal`)
- **Weekly Analytics & Charts**: บรรทัด 2951–3250 (`renderWeightChart`, `renderCalorieTrends`)
- **Visual Share Card**: บรรทัด 3251–3550 (`openShareCardModal`, `drawShareCard`)
- **Notifications & Health Tips**: บรรทัด 3551–3890 (`openUserNotificationsModal`, `shuffleDailyTip`)
- **Modals & Window Bindings**: บรรทัด 3891–4085 (`openModalAnimated`, `closeModalAnimated`, `openQuickAddModal`)

### หลักการแยกประวัติการอัปเดต (Changelog Separation):
- **User Side (`index.html` & `version.json`)**: แสดงเฉพาะฟีเจอร์ที่ผู้ใช้ได้ประโยชน์โดยตรง ห้ามมีคำว่า Admin, Dashboard, Firestore rules, หรือโค้ดหลังบ้าน
- **Admin Side (`admin.html` Tab 6 `tabView_system_changelog`)**: บันทึกการอัปเดตสถาปัตยกรรมระบบ, ฟังก์ชันแอดมิน, Security Rules, และระบบหลังบ้านทั้งหมด

