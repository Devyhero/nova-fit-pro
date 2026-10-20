# 🗺️ NovaFit Pro (fitmacro-web) - Codebase Map & Architecture Reference

> **วัตถุประสงค์ของไฟล์นี้**: เป็นแผนผังอ้างอิงตำแหน่งโค้ด โครงสร้าง State และฟังก์ชันทั้งหมดในโปรเจกต์แบบ Single Source of Truth ช่วยให้นักพัฒนาและ AI Assistant รู้ตำแหน่งโค้ดทันที **ไม่ต้องเสียเวลาและ Token สแกนไฟล์ขนาดใหญ่ซ้ำๆ**

---

## 📂 1. โครงสร้างไฟล์และความรับผิดชอบ (File Directory Map)

| ไฟล์ | ขนาดโดยประมาณ | หน้าที่หลัก |
|---|---|---|
| `public/index.html` | ~185 KB | หน้าเว็บหลักสำหรับผู้ใช้ (User UI), Section Accordions, Modals ทั้งหมด, Service Worker bootstrap |
| `public/app.js` | ~220 KB | Business Logic หลัก, การคำนวณ Macro, ระบบบันทึกอาหาร, IF Timer, วิตามิน, Modals |
| `public/food-db.js` | ~50 KB | ฐานข้อมูลอาหาร (280+ รายการ), หมวดหมู่อาหาร, ค่าวิตามินมาตรฐาน (`DEFAULT_SUPPLEMENTS`), Meal Combos |
| `public/health-tips.js` | ~88 KB | เอนจินเกร็ดความรู้สุขภาพ (Daily Health Tips) 65+ รายการ, การสุ่มเรื่อง, การแสดงผล |
| `public/health-tips.json`| ~75 KB | ข้อมูลดิบเกร็ดความรู้สุขภาพและโภชนาการสำหรับดึงผ่าน API/Offline |
| `public/firebase-sync.js`| ~28 KB | ซิงค์ข้อมูลกับ Firebase Firestore แบบ Realtime (`users/{uid}`), Google Auth, สถานะออนไลน์ |
| `public/admin.html` | ~58 KB | หน้าแดชบอร์ดเฉพาะผู้ดูแลระบบ (Admin Dashboard) มี 5 แท็บหลัก |
| `public/admin.js` | ~52 KB | ตรวจสอบสิทธิ์แอดมิน, โหลดข้อมูลผู้ใช้ทั้งหมด, คำนวณสถิติ DAU/Peak Hours, ระบบส่งข้อความ, Audit Logs |
| `public/sw.js` | ~3.2 KB | Service Worker PWA, Precache ทรัพยากร, Cache-busting, Skip Waiting |
| `public/version.json` | ~1.0 KB | ตัวระบุเลขเวอร์ชันสำหรับ PWA ตรวจสอบอัปเดตแบบเรียลไทม์ (ฝั่ง User) |
| `scripts/test-preflight.js` | ~10 KB | สคริปต์ตรวจ Syntax JS/JSON, โครงสร้างแท็ก HTML, Broken Assets, Version Alignment, Firestore Dry-run |
| `scripts/test-browser-cdp.js`| ~25 KB | การทดสอบ Browser E2E ผ่าน Chrome DevTools Protocol ทั้งหมด 20 การทดสอบ |
| `firestore.rules` | ~1.5 KB | กฎความปลอดภัย Firestore (แยกระหว่างสิทธิ์ผู้ใช้ทั่วไป และผู้ดูแลระบบ) |
| `GEMINI.md` | ~3.5 KB | ข้อกำหนดการทำงานอัตโนมัติ (Pre-flight -> Git -> Deploy -> Report) |

---

## 🧠 2. สถาปัตยกรรม State (`state` ใน `public/app.js`)

ข้อมูลถูกเก็บใน `localStorage.getItem('fitmacro_pro_v4_state')` และซิงค์ไปยัง Firestore `users/{uid}`:

```javascript
state = {
    version: '5.6.6',                  // เลขเวอร์ชันปัจจุบัน
    theme: 'dark' | 'light',           // ธีมหน้าจอ
    selectedDate: 'YYYY-MM-DD',        // วันที่กำลังเลือกดูข้อมูล (รีเซ็ตเป็นวันนี้เสมอเมื่อเปิดแอป)
    lastActiveDate: 'YYYY-MM-DD',      // วันที่ใช้งานล่าสุด
    activeMeal: 'breakfast' | 'lunch' | 'dinner' | 'snack', // มื้อที่เลือกอยู่
    selectedPortion: 1,                // ตัวคูณขนาดเสิร์ฟ
    selectedCategory: 'all',           // หมวดหมู่อาหารที่เลือกในคลัง
    searchQuery: '',                   // คำค้นหาอาหาร (ล้างเป็นค่าว่างเสมอเมื่อเริ่มแอป)
    profileConfigured: true | false,   // ผู้ใช้ตั้งค่าโปรไฟล์แล้วหรือยัง
    profile: {
        gender, age, height, weight, activityLevel, goal,
        formula, customTdee, customP, customC, customF
    },
    logsByDate: {                      // รายการอาหารที่บันทึกแยกตามวัน
        "YYYY-MM-DD": [ { name, p, c, f, cal, portion, meal, servingSize, timestamp } ]
    },
    supplementList: [                  // รายการวิตามิน & อาหารเสริมทั้งหมด (รองรับ Full CRUD)
        { id, name, time, icon, isCustom }
    ],
    supplementsByDate: {               // ติ๊กทานวิตามินในแต่ละวัน
        "YYYY-MM-DD": { "supp_id": true }
    },
    waterByDate: { "YYYY-MM-DD": 2500 }, // ปริมาณน้ำดื่ม (ml)
    weightsByDate: { "YYYY-MM-DD": 70 }, // น้ำหนักตัวที่ชั่งในแต่ละวัน (kg)
    workoutsByDate: {                  // รายการออกกำลังกายในแต่ละวัน
        "YYYY-MM-DD": [ { name, duration, calBurned, timestamp } ]
    },
    dayTypeByDate: { "YYYY-MM-DD": 'training' | 'rest' }, // ประเภทของวัน
    fasting: {                         // ระบบจับเวลาอดอาหาร (Intermittent Fasting)
        isFasting: false,
        plan: '16:8' | '18:6' | '14:10' | '20:4',
        targetHours: 16,
        startTime: timestamp,
        endTime: timestamp,
        history: [ { startTime, endTime, targetHours, plan, durationHours, achieved } ]
    },
    mealCombos: [ ... ],               // เซ็ตอาหารสำเร็จรูป
    favorites: [ ... ],                // อาหารที่กดดาวชื่นชอบ
    collapsedSections: { ... }         // การพับ/ขยาย Accordion แต่ละ Section
}
```

---

## 📍 3. ดัชนีตำแหน่งโค้ดใน `public/app.js` (Code Index by Line Range)

| ช่วงบรรทัด | โมดูล / ฟังก์ชัน | คำอธิบาย & ฟังก์ชันสำคัญ |
|---|---|---|
| **L1 - L187** | **State Definition & Integrity** | `APP_VERSION`, `state` default, `ensureStateIntegrity()`, `saveState()`, `getTodayStr()` |
| **L188 - L350** | **Profile & Macro Calculator** | `calculateMacroTargets()`, `getCalculatedTargets()`, `toggleTheme()`, Accordion Smooth Clamp |
| **L351 - L580** | **Date Navigation & Calendar** | `shiftDate()`, `goToToday()`, `onDateChange()`, `renderWeeklyAnalytics()`, `renderDailySummary()` |
| **L581 - L1150**| **Daily Meals & Macro Dashboard**| `renderAll()`, `renderMacros()`, `renderMeals()`, `deleteFoodLog()`, `renderWaterSection()` |
| **L1151 - L1450**| **Food Database & Search Engine**| `renderFoodDatabase()`, Universal Food Search ข้ามทุกหมวด, Favorites Star toggle |
| **L1451 - L1740**| **Custom Foods & Workouts** | `submitCustomFood()`, `renderWorkouts()`, `addWorkoutLog()`, `deleteWorkoutLog()` |
| **L1741 - L1870**| **Meal Combos & Yesterday Copy** | `copyMealFromYesterday()`, `applyMealCombo()`, `saveCurrentMealAsCombo()` |
| **L1871 - L2055**| **Supplements & Vitamins** | `renderSupplements()`, `toggleSupplement()`, `deleteSupplement()`, `restoreDefaultSupplements()`, `openAddSupplementModal()` |
| **L2056 - L2350**| **Food Meal Picker Modal** | `openFoodMealPicker()`, `setFoodPickerPortion()`, `submitFoodMealPicker()` |
| **L2351 - L2650**| **Intermittent Fasting (IF) Engine**| `toggleFastingTimer()`, `renderFastingSection()`, `openFastingCompleteModal()`, `confirmFinishFasting()` |
| **L2651 - L2950**| **PWA Updates & Changelog Modal**| `initPwaUpdates()`, `checkForAppUpdate()`, `updateVersionBadges()`, `openChangelogModal()` |
| **L2951 - L3250**| **Analytics & Trends Charts** | `renderWeightChart()`, `renderCalorieTrends()` |
| **L3251 - L3550**| **Visual Share Card (Canvas)** | `openShareCardModal()`, `drawShareCard()`, `downloadShareCard()`, `copyShareCardImage()` |
| **L3551 - L3890**| **Notifications Inbox & Health Tips**| `openUserNotificationsModal()`, `renderUserNotifications()`, `shuffleDailyTip()` |
| **L3891 - L4085**| **Modal Engine & Window Exports** | `openModalAnimated()`, `closeModalAnimated()`, `openQuickAddModal()`, Global `window` bindings |

---

## 🪟 4. ทะเบียนหน้าต่าง Modal ทั้งหมด (Modal Registry)

| Modal DOM ID | สคริปต์ควบคุม | ฟังก์ชันเปิด / ปิด | หน้าที่ |
|---|---|---|---|
| `profileSettingsModal` | `app.js` | `openProfileSettingsModal()` / `closeProfileSettingsModal()` | ตั้งค่าโปรไฟล์ น้ำหนัก ส่วนสูง เป้าหมายโภชนาการ |
| `changelogModal` | `app.js` | `openChangelogModal()` / `closeChangelogModal()` | ดูประวัติอัปเดตฟังก์ชันสำหรับผู้ใช้ (User-Centric) |
| `dailyReportModal` | `app.js` | `openDailyReportModal()` / `closeDailyReportModal()` | สรุปโภชนาการประจำวัน |
| `addSupplementModal` | `app.js` | `openAddSupplementModal()` / `closeAddSupplementModal()` | เพิ่มวิตามิน/อาหารเสริม พร้อมปุ่มลัด Emoji |
| `quickAddModal` | `app.js` | `openQuickAddModal()` / `closeQuickAddModal()` | บันทึกแคลอรีและโปรตีนด่วน (Quick Add) |
| `foodMealPickerModal` | `app.js` | `openFoodMealPicker(...)` / `closeFoodMealPickerModal()` | แตะเลือกมื้ออาหารจากคลัง (เช้า/เที่ยง/เย็น/ว่าง) |
| `fastingCompleteModal` | `app.js` | `openFastingCompleteModal()` / `closeFastingCompleteModal()` | สรุปความสำเร็จการทำ IF & ระดับ Autophagy |
| `userNotificationsModal`| `app.js` | `openUserNotificationsModal()` / `closeUserNotificationsModal()` | กล่องจดหมายแจ้งเตือนจากแอดมิน BenzNova |
| `shareCardModal` | `app.js` | `openShareCardModal()` / `closeShareCardModal()` | การ์ดรูปภาพสรุปผลแคลอรีและสารอาหารสำหรับแชร์ |
| `userInspectModal` | `admin.js` | `inspectUser(uid)` / `closeUserInspectModal()` | ส่องสมุดบันทึกอาหาร น้ำหนัก น้ำดื่มรายคน (หน้าแอดมิน) |
| `sendMessageModal` | `admin.js` | `openSendMessageModal(...)` / `closeSendMessageModal()` | ส่งข้อความหาผู้ใช้รายคน หรือบรอดแคสต์ทุกคน (หน้าแอดมิน) |

---

## 🛡️ 5. สถาปัตยกรรมหน้าแอดมิน (`admin.html` & `admin.js`)

หน้าแอดมินมี 5 แท็บหลัก ควบคุมผ่านฟังก์ชัน `switchAdminTab(tabId)`:

1. **`tabBtn_users` (`tabView_users`)**: รายชื่อผู้ใช้ทั้งหมด, ค้นหาตามชื่อ/อีเมล, ปุ่มส่องสมุดบันทึกรายคน, ปุ่มเปิดส่งข้อความ
2. **`tabBtn_analytics` (`tabView_analytics`)**: สถิติเชิงลึก DAU, อัตราส่วนอุปกรณ์ (Mobile vs Desktop), Peak Hours บันทึกอาหาร
3. **`tabBtn_foods` (`tabView_foods`)**: เมนูอาหารยอดนิยม 10 อันดับแรกที่ผู้ใช้กินบ่อยที่สุด
4. **`tabBtn_custom_presets` (`tabView_custom_presets`)**: คลังเมนูอาหารที่ผู้ใช้สร้างขึ้นเองในระบบ
5. **`tabBtn_message_logs` (`tabView_message_logs`)**: ประวัติการส่งข้อความแจ้งเตือนทั้งหมด (Mobile Responsive Cards บนมือถือ, ตาราง 6 คอลัมน์บนคอมพิวเตอร์)
6. **`tabBtn_system_changelog` (`tabView_system_changelog`)**: บันทึกการอัปเดตระบบ & หลังบ้านของผู้ดูแลระบบ (แยกขาดจากฝั่ง User)

---

## 🔒 6. หลักการแยกประวัติอัปเดต (Changelog Separation Rules)

- **ฝั่ง User (`index.html` และ `version.json`)**:
  - ✅ **แสดงเฉพาะ**: ฟีเจอร์ที่ผู้ใช้กดเล่นได้จริง, ผลประโยชน์ทางสุขภาพ, ความลื่นไหลในการใช้งาน
  - ❌ **ห้ามแสดง**: Admin Dashboard, บัญชีแอดมิน, Audit Logs, Firestore rules, โค้ดหลังบ้าน
- **ฝั่ง Admin (`admin.html` Tab 6: `tabView_system_changelog`)**:
  - ✅ **บันทึกทุกเรื่อง**: การปรับปรุงสถาปัตยกรรม, Security Rules, การพัฒนาเอนจินหลังบ้าน, ฟังก์ชันแอดมิน

---

## 🚀 7. กฎเหล็กหลังแก้ไขโค้ดทุกครั้ง (Mandatory Workflow)

```bash
# 1. ตรวจสอบโค้ด 100% (ห้ามข้ามเด็ดขาด)
node scripts/test-preflight.js
node scripts/test-browser-cdp.js

# 2. บันทึกและพุช Git
git add .
git commit -m "feat/fix: ..."
git push origin main

# 3. Deploy ขึ้น Firebase
firebase deploy
```
