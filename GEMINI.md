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

## กฎเหล็กการตัดรอบเวอร์ชันและการแยกประวัติอัปเดต (Mandatory Versioning & Dual Changelog Protocol)

> [!IMPORTANT]
> ทุกครั้งที่มีการพัฒนาฟีเจอร์หรือแก้ไขบั๊กใหญ่และเตรียมปล่อยอัปเดต **ต้องตัดรอบเวอร์ชัน (Bump Version) และบันทึกประวัติการเปลี่ยนแปลง (Changelog) โดยแยกออกจากกันอย่างเด็ดขาดระหว่างฝั่งผู้ใช้ (User) และฝั่งผู้ดูแลระบบ (Admin)**

### 1. ความสอดคล้องของเลขเวอร์ชัน 100% (Strict 5-File Version Alignment)
เมื่อตัดรอบเวอร์ชันใหม่ ต้องอัปเดตเลขเวอร์ชันให้ตรงกันทั้ง 5 ไฟล์เสมอ:
1. `public/version.json` ➔ `"version": "x.y.z"` และอัปเดต `"buildDate"` ให้เป็นเวลาปัจจุบัน
2. `public/sw.js` ➔ `CACHE_NAME = 'novafit-pro-vx.y.z-cache'`
3. `public/app.js` ➔ `const APP_VERSION = 'x.y.z';`
4. `public/index.html` ➔ ปรับ Query String สคริปต์ทั้งหมดเป็น `?v=x.y.z` และป้าย `#toolsVersionBadge` เป็น `(vx.y.z)`
5. `public/admin.html` ➔ ปรับป้ายสถานะ `Current Version: vx.y.z`

---

### 2. กฎการบันทึกประวัติฝั่งผู้ใช้งานทั่วไป (User-Facing Changelog Rules)
* **ตำแหน่งที่ต้องอัปเดต**: 
  - `public/version.json` (ฟิลด์ `features`)
  - `public/index.html` (กล่องการแจ้งเตือน `#whatsNewAlertText` และป็อปอัปประวัติการอัปเดต `#changelogModal`)
* **ภาษาและโทนเสียง (Tone of Voice)**: 
  - ใช้ภาษาไทยที่สุภาพ เข้าใจง่าย สนุกสนาน และมีชีวิตชีวา เน้นประโยชน์ต่อผู้ใช้ (User Value & Benefits)
  - มีอีโมจิน่ารักประกอบ เช่น 🚀, 🤖, 🍎, 💧, ✨, 🎙️
* **ข้อห้ามเด็ดขาด (Strict Restrictions)**:
  - ❌ **ห้ามมีคำศัพท์เชิงเทคนิคหลังบ้านเด็ดขาด**: ห้ามมีคำว่า `Admin`, `Dashboard`, `Firestore Security Rules`, `Cloud Functions`, `API endpoint`, `Service Worker Cache`, `CDP tests`, `Preflight`, `Database Index`, หรือ `Backend Architecture`
  - เน้นบอกสิ่งที่ผู้ใช้ "สัมผัสได้จริง" เช่น "ระบบบับเบิ้ลเพื่อนคู่คิดส่งกำลังใจ", "แก้ไขการคำนวณแคลอรี่ให้แม่นยำยิ่งขึ้น", "พิมพ์และสั่งการด้วยเสียงได้ต่อเนื่องลื่นไหล"

---

### 3. กฎการบันทึกประวัติฝั่งผู้ดูแลระบบและหลังบ้าน (Admin-Facing Changelog Rules)
* **ตำแหน่งที่ต้องอัปเดต**: 
  - `public/admin.html` (แท็บที่ 6: `tabView_system_changelog`)
* **ภาษาและเนื้อหา (Technical & Architectural Details)**:
  - บันทึกรายละเอียดเชิงลึกทางวิศวกรรมและสถาปัตยกรรมระบบ (System Architecture)
  - บันทึกการเปลี่ยนแปลง Logic การทำงาน เช่น การ Sanitize ข้อมูลใน `ensureStateIntegrity()`, Pagination Engine, Security Rules, Web Speech API State Lifecycle, การ Optimize การเรนเดอร์ DOM และ Performance
  - ระบุชื่อฟังก์ชันหรือโมดูลที่เกี่ยวข้องชัดเจน เพื่อให้ย้อนรอยตรวจสอบระบบ (Audit & Debug) ได้ง่ายในอนาคต

---

## กฎเหล็กการพัฒนาเพื่อประสิทธิภาพและลดข้อผิดพลาด (Efficiency & Reliability Protocols)

### 1. 🛡️ การจัดการ Line Endings ข้ามระบบ Mac ↔ Windows (Cross-Platform Line Ending Consistency)
- เพื่อป้องกันปัญหา Git Diff บวมทั้งไฟล์จากความต่างของ CRLF (Windows) และ LF (Mac):
  - โครงการมีไฟล์ `.gitattributes` บังคับ `* text=auto eol=lf` สำหรับไฟล์ Text ทุกประเภท
  - เมื่อทำงานบน Windows ให้ตั้งค่า Git รองรับ: `git config --global core.autocrlf true` หรือ `input`
  - ห้าม Commit ไฟล์ที่ถูกแปลง Line Ending ปะปนเข้ามาเด็ดขาด

### 2. 🧩 การรักษาความเข้ากันได้ของ State ย้อนหลัง (Safe State & Zero-Crash Backward Compatibility)
- ทุกครั้งที่มีการเพิ่มฟิลด์ใหม่ใน Object `state` หรือ `localStorage`:
  - **ต้องกำหนดค่าเริ่มต้น (Default Fallback) ในฟังก์ชัน `ensureStateIntegrity()` เสมอ**
  - ป้องกันข้อผิดพลาดกรณีผู้ใช้เดิมมี Cache หรือ LocalStorage เก่า โดยใช้ Optional Chaining หรือ Guard เช่น `state.newFeature?.subProperty || defaultValue`
  - ห้ามเรียกใช้งาน property ใหม่โดยไม่ผ่าน Guard เด็ดขาด เพื่อป้องกันปัญหาหน้าจอขาว

### 3. 🎯 การจำกัดขอบเขตการแก้ไขโค้ด (Minimal Blast Radius & No Wholesale Reformatting)
- เนื่องจากไฟล์หลัก (`app.js`, `index.html`) มีขนาดใหญ่หลายพันบรรทัด:
  - แก้ไขเฉพาะบรรทัดและบล็อกที่เกี่ยวข้องกับงานโดยตรงเท่านั้น
  - ห้ามสั่ง Auto-format หรือ Re-indent โค้ดทั้งไฟล์โดยไม่จำเป็น เพื่อป้องกัน Git Diff บวม สิ้นเปลือง Token และกระทบฟังก์ชันอื่นที่เสถียรอยู่แล้ว

### 4. 🧪 การปรับปรุงชุดทดสอบอัตโนมัติควบคู่กับการพัฒนา (Synchronized CDP Testing)
- เมื่อมีการสร้างฟีเจอร์ใหม่ หรือปรับโครงสร้าง UI (เช่น แก้ไข ID ของปุ่ม, ปรับ Flow ของ Modal):
  - ต้องเพิ่มหรืออัปเดต Test Case ใน [`scripts/test-browser-cdp.js`](file:///Users/benznova/Desktop/fitmacro-web/scripts/test-browser-cdp.js) ควบคู่กันทันที
  - ก่อนส่งมอบงานและ Deploy ขึ้น UAT ต้องรัน `node scripts/test-preflight.js` และ `node scripts/test-browser-cdp.js` ให้ผ่าน 100% เสมอ

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


