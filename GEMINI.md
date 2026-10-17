# Project Guidelines: NovaFit Pro (fitmacro-web)

## Workflow อัตโนมัติหลังแก้ไขงานเสร็จสิ้นทุกครั้ง (Mandatory Post-Edit Steps)

ทุกครั้งที่มีการแก้ไขโค้ด ปรับปรุงฟีเจอร์ หรือแก้ไขบั๊กในโปรเจกต์นี้เสร็จเรียบร้อยแล้ว ให้ดำเนินการตามขั้นตอนต่อไปนี้เสมอ:

1. **ตรวจสอบความพร้อมของโค้ด**:
   - ตรวจสอบไฟล์ที่แก้ไขให้ไม่มี syntax error
   - หากเป็นการอัปเดตเวอร์ชันหรือฟีเจอร์สำคัญ ให้ปรับปรุงหมายเลขเวอร์ชันและรายละเอียดใน `public/version.json` และชื่อ cache ใน `public/sw.js` ให้ตรงกัน

2. **Commit & Push ขึ้น Git**:
   - รันคำสั่ง `git status` เพื่อตรวจสอบการเปลี่ยนแปลง
   - เพิ่มไฟล์ด้วย `git add .` (หรือเลือกเฉพาะไฟล์ที่เกี่ยวข้อง)
   - สร้าง commit message ที่สื่อความหมายชัดเจน (เช่น `feat: ...`, `fix: ...`, `refactor: ...`)
   - พุชขึ้น GitHub: `git push origin main`

3. **Deploy ขึ้น Firebase**:
   - สั่งรันคำสั่ง: `firebase deploy`
   - ตรวจสอบว่า Hosting และ Firestore Rules ถูก deploy สำเร็จเรียบร้อย (URL: https://fitmacro-pro-benz.web.app)

4. **สรุปผลให้ผู้ใช้ทราบ**:
   - แจ้งรายการที่แก้ไข
   - แจ้งสถานะ Git commit และ push
   - แจ้งสถานะการ deploy บน Firebase พร้อมระบุลิงก์เข้าใช้งาน
