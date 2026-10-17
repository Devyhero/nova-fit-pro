# Project Guidelines: NovaFit Pro (fitmacro-web)

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
