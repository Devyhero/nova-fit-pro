# Project Guidelines: NovaFit Pro (fitmacro-web)

## Workflow รองรับการทำงานสลับ 2 เครื่อง (2-Device Synchronization Standard)

> [!IMPORTANT]
> เนื่องจากผู้ใช้พัฒนาโปรเจกต์สลับกันระหว่างคอมพิวเตอร์ 2 เครื่อง (เช่น Mac เครื่องหลัก และ Windows เครื่องทำงาน) **ก่อนเริ่มแตะต้องหรือแก้ไขโค้ดทุกครั้ง ต้องดึงโค้ดล่าสุดจาก GitHub เสมอ** เพื่อป้องกันบั๊กโค้ดย้อนกลับ (Code Overwrite / Regression) หรือ Git Conflict
> 
> * **Official GitHub Repository**: `https://github.com/Devyhero/nova-fit-pro.git`
> * **Git Committer**: Name: `Devyhero` | Email: `benznova01@gmail.com`
> * **Production URL**: `https://fitmacro-pro-benz.web.app`
> * **UAT Channel URL**: `https://fitmacro-pro-benz--uat-ywpcsdbf.web.app`

### การตั้งค่าเมื่อสลับไปทำงานบนคอมพิวเตอร์เครื่องอื่น (Second Device Sync Checklist)
เมื่อเปิดโปรเจกต์บนเครื่องอื่น (เช่น คอมพิวเตอร์ Windows เครื่องทำงาน):
1. ตรวจสอบ Remote URL ให้ชี้มาที่บัญชีใหม่:
   ```bash
   git remote set-url origin https://github.com/Devyhero/nova-fit-pro.git
   ```
2. ตั้งค่าชื่อและอีเมล Committer ให้ตรงกัน:
   ```bash
   git config user.name "Devyhero"
   git config user.email "benznova01@gmail.com"
   ```
3. ดึงโค้ดล่าสุดจากสาขา `main` ก่อนเริ่มงานทุกครั้ง:
   ```bash
   git checkout main && git pull origin main
   ```

## กฎเหล็กการพัฒนาฟีเจอร์ใหม่ & ระบบ Branching (Mandatory Feature Branch & UAT Workflow)

> [!CAUTION]
> **ห้ามแก้ไขหรือพัฒนาฟีเจอร์ใหม่บน Branch `main` โดยตรงเด็ดขาด!** 
> ทุกฟีเจอร์ใหม่ต้องแตก Branch พัฒนาแยกอิสระ และ**ต้องผ่านการทดสอบบน UAT Channel จนผู้ใช้ยืนยันว่าผ่านแล้วเท่านั้น** จึงจะอนุญาตให้ Merge เข้า `main` แล้วขึ้น Production จริง (PROD) ได้

```
[1. เริ่มต้น]           ──► git checkout main && git pull origin main
                             │
                             ▼
[2. แตก Branch ใหม่]    ──► git checkout -b feature/<feature-name>
                             │
                             ▼
[3. เขียนโค้ด & ทดสอบ] ──► node scripts/test-preflight.js && node scripts/test-browser-cdp.js
                             │
                             ▼
[4. บันทึก & พุช Branch] ─► git add . && git commit -m "feat: ..." && git push -u origin feature/<feature-name>
                             │
                             ▼
[5. Deploy ขึ้น UAT]    ──► firebase hosting:channel:deploy uat --expires 30d
                             │   (URL: https://fitmacro-pro-benz--uat-ywpcsdbf.web.app)
                             ▼
[6. รอผู้ใช้ทดสอบ UAT]  ──► ส่งลิงก์ UAT ให้ผู้ใช้ลองเล่นจริง (ห้ามขึ้น PROD เด็ดขาดจนกว่าผู้ใช้จะอนุมัติ)
                             │
                             ▼ [เมื่อผู้ใช้ยืนยันว่า UAT ผ่านแล้วเท่านั้น]
[7. Merge เข้า main]    ──► git checkout main && git pull origin main && git merge feature/<feature-name>
                             │
                             ▼
[8. พุช main & ขึ้น PROD] ─► git push origin main && firebase deploy
                             │   (URL: https://fitmacro-pro-benz.web.app)
                             ▼
[9. ลบ Feature Branch]  ──► git branch -d feature/<feature-name>
```

---

## Workflow อัตโนมัติก่อนเริ่มงานทุกครั้ง (Mandatory Pre-Work Steps)

ทุกครั้งที่ผู้ใช้ส่งคำสั่งหรือเริ่มงานใหม่ **ผู้ช่วย AI ต้องปฏิบัติตามลำดับขั้นนี้ก่อนแตะต้องไฟล์เสมอ**:
1. **ตรวจสอบความสอดคล้องของ Git**: ตรวจสอบว่าโปรเจกต์มี `.git` และ Remote เชื่อมต่ออยู่
2. **ดึงโค้ดล่าสุด (Sync Latest Code)**:
   ```bash
   git checkout main && git pull origin main
   ```
   *หากมีไฟล์ค้างหรือมี Conflict ให้แจ้งเตือนผู้ใช้ทันทีก่อนดำเนินการต่อ*
3. **หากเป็นฟีเจอร์ใหม่**: สั่งแตก Branch ทันที `git checkout -b feature/<name>` ห้ามเขียนโค้ดบน `main`

---

## Workflow อัตโนมัติหลังพัฒนาฟีเจอร์เสร็จสิ้น (Mandatory Feature Delivery Steps)

เมื่อพัฒนาฟีเจอร์บน Branch `feature/<name>` เรียบร้อยแล้ว:

### ขั้นที่ 1: ตรวจสอบความถูกต้องของโค้ด 100%
- รันสคริปต์ตรวจสอบ:
  ```bash
  node scripts/test-preflight.js
  node scripts/test-browser-cdp.js
  ```
- **เงื่อนไขสำคัญ**: หากมีข้อผิดพลาดหรือ Test ไม่ผ่าน **ห้าม Commit และห้าม Deploy เด็ดขาด!** ต้องแก้ไขให้ผ่าน 100% ก่อน

### ขั้นที่ 2: Commit & Push ขึ้น Feature Branch
- สเตจและคอมมิต:
  ```bash
  git add .
  git commit -m "feat(<scope>): ..."
  git push -u origin feature/<feature-name>
  ```

### ขั้นที่ 3: Deploy ขึ้นช่องทางทดสอบ UAT (Preview Channel)
- สั่งรันคำสั่ง:
  ```bash
  firebase hosting:channel:deploy uat --expires 30d
  ```
- สรุปผลรายงานผู้ใช้ พร้อมแนบลิงก์ UAT: `https://fitmacro-pro-benz--uat-ywpcsdbf.web.app`
- **หยุดรอผลการทดสอบจากผู้ใช้ ห้ามแตะต้อง Production!**

---

## Workflow การนำขึ้น Production จริง (PROD Release Protocol)

**เงื่อนไขเดียวที่จะขึ้น PROD ได้**: ผู้ใช้ส่งข้อความยืนยันว่า *"ทดสอบ UAT ผ่านแล้ว ขึ้น PROD ได้เลย"* เท่านั้น:

1. สลับกลับมาที่ main และดึงโค้ดล่าสุด:
   ```bash
   git checkout main && git pull origin main
   ```
2. ทำการ Merge โค้ดจาก Feature Branch:
   ```bash
   git merge feature/<feature-name>
   ```
3. พุชขึ้น main บน GitHub:
   ```bash
   git push origin main
   ```
4. Deploy ขึ้นเซิร์ฟเวอร์จริง (Production):
   ```bash
   firebase deploy
   ```
5. ลบ Branch ฟีเจอร์ที่รวมเสร็จแล้ว:
   ```bash
   git branch -d feature/<feature-name>
   ```
6. รายงานสรุปผลให้ผู้ใช้ทราบ พร้อมลิงก์เว็บจริง: `https://fitmacro-pro-benz.web.app`

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

