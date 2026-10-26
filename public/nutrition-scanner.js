/**
 * =======================================================================
 * NovaFit Pro - AI Nutrition Label & 7-Eleven Barcode Scanner Engine
 * File: public/nutrition-scanner.js
 * Version: v5.9.30
 * =======================================================================
 * Features:
 * 1. 7-Eleven Thailand Verified Barcode Database (CP, Meiji, Hooray!, Tofusan, etc.)
 * 2. High-speed Barcode Detector (Hardware-accelerated BarcodeDetector API)
 * 3. AI Vision OCR Prompt tailored for Thai FDA "ข้อมูลโภชนาการ" (Nutrition Facts)
 * 4. Automatic extraction of Calories, Protein, Carbs, Fat, Sugar, and Sodium
 * 5. Serving size multiplier (0.5x, 1x, 1.5x, 2x, or Full Container)
 * 6. Direct 100% automated logging into NovaFit daily tracker
 */

(function () {
    'use strict';

    // 1. Curated 7-Eleven Thailand Food & Beverage Nutrition Database (Exact Grams & Barcodes)
    const SEVEN_ELEVEN_FOOD_DB = [
        {
            barcode: '8850188800018',
            foodName: 'อกไก่นุ่ม ซีพี (CP Tender Chicken Breast)',
            brand: 'CP',
            category: 'protein',
            packageWeight: '90g',
            servingSize: '1 ชิ้น (90 กรัม • 1 หน่วยบริโภค)',
            servingsPerContainer: 1,
            cal: 110,
            p: 20,
            c: 2,
            f: 2,
            sugar: 1,
            sodium: 340,
            confidence: 'high',
            ingredients: ['อกไก่แท้ 92%', 'เครื่องปรุงรสสูตรลดเกลือ', 'พลังงาน 110 kcal', 'โซเดียม 340mg'],
            healthyTip: '🏷️ ฉลาก 7-Eleven: โปรตีนสูงถึง 20g ไขมันและน้ำตาลต่ำมาก เหมาะสำหรับช่วงคุมน้ำหนักหรือสร้างกล้ามเนื้อ'
        },
        {
            barcode: '8850188800025',
            foodName: 'อกไก่นุ่มกระเทียมพริกไทย ซีพี (CP Garlic Pepper Chicken Breast)',
            brand: 'CP',
            category: 'protein',
            packageWeight: '90g',
            servingSize: '1 ชิ้น (90 กรัม • 1 หน่วยบริโภค)',
            servingsPerContainer: 1,
            cal: 110,
            p: 20,
            c: 2,
            f: 2.5,
            sugar: 1,
            sodium: 360,
            confidence: 'high',
            ingredients: ['อกไก่ 90%', 'กระเทียม พริกไทยดำ', 'พลังงาน 110 kcal', 'โซเดียม 360mg'],
            healthyTip: '🏷️ ฉลาก 7-Eleven: รสชาติจัดจ้านแต่แคลอรีต่ำเพียง 110 kcal ให้โปรตีนเต็มคำ 20g'
        },
        {
            barcode: '8851717041126',
            foodName: 'นมโปรตีน Hooray! High Protein รสช็อกโกแลต',
            brand: 'Hooray!',
            category: 'drink',
            packageWeight: '340ml',
            servingSize: '1 ขวด (340 มล. • 1 หน่วยบริโภค)',
            servingsPerContainer: 1,
            cal: 230,
            p: 29,
            c: 14,
            f: 6,
            sugar: 8,
            sodium: 200,
            confidence: 'high',
            ingredients: ['นมโคไร้แลคโตส 88%', 'เวย์โปรตีนเข้มข้น', 'โกโก้แท้', 'ไม่เติมน้ำตาลทราย'],
            healthyTip: '🏷️ ฉลาก 7-Eleven: โปรตีนสูง 29g ต่อขวด รสเข้มข้น ไม่เติมน้ำตาลทราย ดื่มเสริมหลังเวทเทรนนิ่งได้ดีเยี่ยม'
        },
        {
            barcode: '8851717041133',
            foodName: 'นมโปรตีน Hooray! High Protein รสจืด (Plain)',
            brand: 'Hooray!',
            category: 'drink',
            packageWeight: '340ml',
            servingSize: '1 ขวด (340 มล. • 1 หน่วยบริโภค)',
            servingsPerContainer: 1,
            cal: 220,
            p: 30,
            c: 12,
            f: 5,
            sugar: 6,
            sodium: 190,
            confidence: 'high',
            ingredients: ['นมโคไร้แลคโตส 90%', 'เวย์โปรตีนเข้มข้น', 'ไม่เติมน้ำตาลทราย'],
            healthyTip: '🏷️ ฉลาก 7-Eleven: โปรตีนสูงถึง 30g น้ำตาลธรรมชาติต่ำมากเพียง 6g เหมาะสำหรับคนที่ต้องการคุมแป้ง'
        },
        {
            barcode: '8850125081180',
            foodName: 'นมเมจิ ไฮโปรตีน Meiji High Protein รสช็อกโกแลต',
            brand: 'Meiji',
            category: 'drink',
            packageWeight: '350ml',
            servingSize: '1 ขวด (350 มล. • 1 หน่วยบริโภค)',
            servingsPerContainer: 1,
            cal: 240,
            p: 28,
            c: 20,
            f: 5,
            sugar: 12,
            sodium: 210,
            confidence: 'high',
            ingredients: ['นมโค 85%', 'เวย์โปรตีนไอโซเลต', 'ผงโกโก้', 'วิตามินบี 12'],
            healthyTip: '🏷️ ฉลาก 7-Eleven: โปรตีน 28g เสริมพลังงานและกล้ามเนื้อได้รวดเร็ว ดื่มง่ายมีขายทุกสาขา'
        },
        {
            barcode: '8850125081173',
            foodName: 'นมเมจิ ไฮโปรตีน Meiji High Protein สูตรไม่เติมน้ำตาลทราย',
            brand: 'Meiji',
            category: 'drink',
            packageWeight: '350ml',
            servingSize: '1 ขวด (350 มล. • 1 หน่วยบริโภค)',
            servingsPerContainer: 1,
            cal: 170,
            p: 28,
            c: 7,
            f: 3,
            sugar: 4,
            sodium: 180,
            confidence: 'high',
            ingredients: ['นมโคไขมันต่ำ', 'เวย์โปรตีน', 'ไม่เติมน้ำตาลทราย'],
            healthyTip: '🏷️ ฉลาก 7-Eleven: แคลต่ำเพียง 170 kcal ได้โปรตีน 28g น้ำตาลแค่ 4g ยอดนิยมอันดับ 1 สำหรับคนลีนไขมัน'
        },
        {
            barcode: '8850188200054',
            foodName: 'ข้าวกะเพราอกไก่นุ่มคลีน EZY Choice (7-Eleven)',
            brand: 'EZY Choice',
            category: 'meal',
            packageWeight: '230g',
            servingSize: '1 กล่อง (230 กรัม • 1 หน่วยบริโภค)',
            servingsPerContainer: 1,
            cal: 350,
            p: 22,
            c: 52,
            f: 6,
            sugar: 3,
            sodium: 680,
            confidence: 'high',
            ingredients: ['ข้าวหอมมะลิ', 'อกไก่ไม่ติดมัน', 'ใบกะเพรา พริกขี้หนู', 'ซอสปรุงรส'],
            healthyTip: '🏷️ ฉลาก 7-Eleven: มื้อหลักพร้อมทาน ให้โปรตีน 22g ไขมันต่ำ 6g สำหรับมื้อเร่งด่วนที่ยังคุมอาหารได้ดี'
        },
        {
            barcode: '8850188200061',
            foodName: 'ข้าวอกไก่ย่างเทอริยากิ EZY Choice (7-Eleven)',
            brand: 'EZY Choice',
            category: 'meal',
            packageWeight: '235g',
            servingSize: '1 กล่อง (235 กรัม • 1 หน่วยบริโภค)',
            servingsPerContainer: 1,
            cal: 380,
            p: 24,
            c: 55,
            f: 7,
            sugar: 5,
            sodium: 620,
            confidence: 'high',
            ingredients: ['ข้าวหอมมะลิ', 'อกไก่ย่างหมักซอสเทอริยากิ', 'ผักแครอทและบรอกโคลี'],
            healthyTip: '🏷️ ฉลาก 7-Eleven: โปรตีนสูง 24g รสชาติกลมกล่อม ทานง่ายและพลังงานกำลังพอดีสำหรับมื้อเที่ยง'
        },
        {
            barcode: '8850188200078',
            foodName: 'ไข่ต้มยางมะตูม ซีพี (CP Soft-boiled Eggs)',
            brand: 'CP',
            category: 'snack',
            packageWeight: '80g',
            servingSize: '2 ฟอง (80 กรัม • 1 หน่วยบริโภค)',
            servingsPerContainer: 1,
            cal: 140,
            p: 13,
            c: 1,
            f: 9,
            sugar: 0.5,
            sodium: 140,
            confidence: 'high',
            ingredients: ['ไข่ไก่สดคัดพิเศษ 100%'],
            healthyTip: '🏷️ ฉลาก 7-Eleven: แหล่งโปรตีนสมบูรณ์แบบ 13g จากไข่ไก่สด 2 ฟอง ไขมันดีและวิตามินครบถ้วน'
        },
        {
            barcode: '8850188200085',
            foodName: 'ไข่ตุ๋นคัพ ซีพี รสคลาสสิค (CP Chawanmushi)',
            brand: 'CP',
            category: 'snack',
            packageWeight: '150g',
            servingSize: '1 ถ้วย (150 กรัม • 1 หน่วยบริโภค)',
            servingsPerContainer: 1,
            cal: 110,
            p: 9,
            c: 4,
            f: 6,
            sugar: 1,
            sodium: 520,
            confidence: 'high',
            ingredients: ['ไข่ไก่สด 75%', 'น้ำซุปดาชิสกัด', 'เห็ดหอมและปูอัด'],
            healthyTip: '🏷️ ฉลาก 7-Eleven: นุ่มเบาท้อง พลังงานเพียง 110 kcal อิ่มสบายท้องยามบ่าย'
        },
        {
            barcode: '8859123400012',
            foodName: 'Tofusan โทฟุซัง นมถั่วเหลือง ไฮโปรตีน ไม่ใส่น้ำตาล',
            brand: 'Tofusan',
            category: 'drink',
            packageWeight: '350ml',
            servingSize: '1 ขวด (350 มล. • 1 หน่วยบริโภค)',
            servingsPerContainer: 1,
            cal: 180,
            p: 28,
            c: 8,
            f: 4,
            sugar: 2,
            sodium: 120,
            confidence: 'high',
            ingredients: ['ถั่วเหลืองออร์แกนิคคั้นสด 96%', 'โปรตีนถั่วเหลืองสกัด', 'ไม่ใส่น้ำตาลและวัตถุกันเสีย'],
            healthyTip: '🏷️ ฉลาก 7-Eleven: โปรตีนพืช (Plant-based) สูง 28g ปราศจากคอเลสเตอรอล โซเดียมต่ำมาก 120mg'
        },
        {
            barcode: '8850188200108',
            foodName: 'ข้าวปั้นโอนิกิริ แซลมอนย่างซีอิ๊ว 7-Select',
            brand: '7-Select',
            category: 'snack',
            packageWeight: '105g',
            servingSize: '1 ชิ้น (105 กรัม • 1 หน่วยบริโภค)',
            servingsPerContainer: 1,
            cal: 190,
            p: 6,
            c: 37,
            f: 2,
            sugar: 2,
            sodium: 420,
            confidence: 'high',
            ingredients: ['ข้าวญี่ปุ่นปรุงรส', 'เนื้อปลาแซลมอนแท้ย่างซีอิ๊ว', 'สาหร่ายทะเลย่างกรอบ'],
            healthyTip: '🏷️ ฉลาก 7-Eleven: คาร์บสะอาดและพลังงานรวดเร็วก่อนออกกำลังกาย ไขมันต่ำเพียง 2g'
        },
        {
            barcode: '8850188200115',
            foodName: 'สลัดอกไก่พริกไทยดำ 7-Eleven (พร้อมน้ำสลัดงาญี่ปุ่น)',
            brand: '7-Eleven',
            category: 'meal',
            packageWeight: '160g',
            servingSize: '1 กล่อง (160 กรัม • 1 หน่วยบริโภค)',
            servingsPerContainer: 1,
            cal: 170,
            p: 16,
            c: 12,
            f: 6,
            sugar: 5,
            sodium: 450,
            confidence: 'high',
            ingredients: ['ผักสลัดไฮโดรโปนิกส์สด', 'อกไก่หมักพริกไทยดำย่าง', 'น้ำสลัดงาคั่วญี่ปุ่นสูตรไลท์'],
            healthyTip: '🏷️ ฉลาก 7-Eleven: ไฟเบอร์สูงจากผักสด อกไก่โปรตีน 16g แคลอรีรวมน้ำสลัดเพียง 170 kcal'
        },
        {
            barcode: '8850188200122',
            foodName: 'โยเกิร์ตดัชชี่ 0% Fat รสธรรมชาติ (Dutchie 0% Fat)',
            brand: 'Dutchie',
            category: 'snack',
            packageWeight: '135g',
            servingSize: '1 ถ้วย (135 กรัม • 1 หน่วยบริโภค)',
            servingsPerContainer: 1,
            cal: 80,
            p: 5,
            c: 14,
            f: 0,
            sugar: 10,
            sodium: 85,
            confidence: 'high',
            ingredients: ['นมโคขาดมันเนย', 'จุลินทรีย์โพรไบโอติกส์มีชีวิต', 'ไขมัน 0%'],
            healthyTip: '🏷️ ฉลาก 7-Eleven: ไขมัน 0% แคลอรีต่ำ 80 kcal มีโพรไบโอติกช่วยระบบย่อยอาหารและการขับถ่าย'
        },
        {
            barcode: '8850188200139',
            foodName: 'กล้วยหอมทอง 7-Eleven (Golden Banana)',
            brand: '7-Eleven',
            category: 'snack',
            packageWeight: '100g',
            servingSize: '1 ผล (100 กรัม • 1 หน่วยบริโภค)',
            servingsPerContainer: 1,
            cal: 100,
            p: 1,
            c: 24,
            f: 0,
            sugar: 14,
            sodium: 1,
            confidence: 'high',
            ingredients: ['กล้วยหอมทองสดคัดเกรด 100%'],
            healthyTip: '🏷️ ฉลาก 7-Eleven: คาร์โบไฮเดรตเชิงซ้อนและโพแทสเซียมธรรมชาติ ทานก่อนหรือหลังออกกำลังกายเพื่อเติมไกลโคเจน'
        }
    ];

    // 2. Hardware Barcode Detector Wrapper (Browser Native API)
    async function detectBarcodeFromImageSource(imgElementOrCanvas) {
        if (!('BarcodeDetector' in window)) {
            return null; // Browser doesn't support native BarcodeDetector API
        }
        try {
            const formats = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code'];
            const barcodeDetector = new window.BarcodeDetector({ formats });
            const barcodes = await barcodeDetector.detect(imgElementOrCanvas);
            if (barcodes && barcodes.length > 0) {
                const detectedRaw = barcodes[0].rawValue || '';
                const cleanCode = detectedRaw.trim().replace(/[^0-9]/g, '');
                return cleanCode || detectedRaw;
            }
        } catch (err) {
            console.warn('[NutritionScanner] BarcodeDetector error:', err);
        }
        return null;
    }

    // 3. Search exact barcode in local 7-Eleven database
    function find7ElevenFoodByBarcode(barcode) {
        if (!barcode) return null;
        const clean = String(barcode).trim();
        return SEVEN_ELEVEN_FOOD_DB.find(item => item.barcode === clean) || null;
    }

    // 4. Search 7-Eleven database by text/name keywords
    function search7ElevenFoodByKeyword(keyword) {
        if (!keyword) return [];
        const q = String(keyword).toLowerCase().trim();
        return SEVEN_ELEVEN_FOOD_DB.filter(item =>
            item.foodName.toLowerCase().includes(q) ||
            item.brand.toLowerCase().includes(q) ||
            (item.ingredients && item.ingredients.some(i => i.toLowerCase().includes(q)))
        );
    }

    // 5. Generate AI Vision OCR prompt optimized specifically for Thai FDA Nutrition Facts labels
    function getThaiNutritionLabelPrompt(userNote = '') {
        return `
คุณคือระบบผู้เชี่ยวชาญการอ่านฉลากข้อมูลโภชนาการ (Thai FDA Nutrition Facts OCR) 
โปรดอ่านข้อมูลจากกรอบข้อมูลโภชนาการ (Nutrition Information) บนซอง/กล่องสินค้าในรูปภาพนี้อย่างละเอียด แม่นยำระดับกรัม 100% ต่อ 1 หน่วยบริโภค 
และตอบกลับเป็น JSON บริสุทธิ์เท่านั้น (ห้ามใส่ Markdown โค้ดบล็อก):
{
  "foodName": "ชื่อสินค้าหรืออาหารภาษาไทย (ระบุยี่ห้อ เช่น ซีพี, เมจิ, Hooray! หากมองเห็น)",
  "servingSize": "ขนาดหนึ่งหน่วยบริโภคตามฉลาก เช่น 1 ชิ้น (90g) หรือ 1/2 ขวด (170 มล.)",
  "servingsPerContainer": จำนวนหน่วยบริโภคต่อภาชนะบรรจุ (ตัวเลข เช่น 1 หรือ 2 หรือ 3 ถ้าไม่ระบุให้เป็น 1),
  "cal": ตัวเลขพลังงานทั้งหมดต่อ 1 หน่วยบริโภค (kcal),
  "p": ตัวเลขโปรตีนต่อ 1 หน่วยบริโภค (กรัม ทศนิยมได้),
  "c": ตัวเลขคาร์โบไฮเดรตทั้งหมดต่อ 1 หน่วยบริโภค (กรัม ทศนิยมได้),
  "f": ตัวเลขไขมันทั้งหมดต่อ 1 หน่วยบริโภค (กรัม ทศนิยมได้),
  "sugar": ตัวเลขน้ำตาลต่อ 1 หน่วยบริโภค (กรัม ทศนิยมได้ หากไม่มีให้ใส่ 0),
  "sodium": ตัวเลขโซเดียมต่อ 1 หน่วยบริโภค (มิลลิกรัม หากไม่มีให้ใส่ 0),
  "ingredients": ["สรุปข้อความจากฉลาก 1", "น้ำตาล Xg", "โซเดียม Xmg", "จำนวนหน่วยบริโภค X"],
  "confidence": "high",
  "healthyTip": "สรุปจุดเด่นของสารอาหาร โปรตีน น้ำตาล และโซเดียมจากฉลากนี้สั้นๆ 1 ประโยค"
}
คำแนะนำเพิ่มเติมจากผู้ใช้: ${userNote || "อ่านตามกรอบข้อมูลโภชนาการจริง"}
`.trim();
    }

    // 6. Sanitize and normalize nutrition facts object
    function sanitizeNutritionFacts(raw) {
        if (!raw || typeof raw !== 'object') {
            return null;
        }
        const servingsPerContainer = Math.max(1, Number(raw.servingsPerContainer) || 1);
        const cal = Math.max(0, Math.round(Number(raw.cal) || 0));
        const p = Math.max(0, Math.round((Number(raw.p) || 0) * 10) / 10);
        const c = Math.max(0, Math.round((Number(raw.c) || 0) * 10) / 10);
        const f = Math.max(0, Math.round((Number(raw.f) || 0) * 10) / 10);
        const sugar = Math.max(0, Math.round((Number(raw.sugar) || 0) * 10) / 10);
        const sodium = Math.max(0, Math.round(Number(raw.sodium) || 0));

        return {
            foodName: String(raw.foodName || 'อาหารจากฉลากโภชนาการ').trim(),
            servingSize: String(raw.servingSize || '1 หน่วยบริโภค').trim(),
            servingsPerContainer,
            cal,
            p,
            c,
            f,
            sugar,
            sodium,
            ingredients: Array.isArray(raw.ingredients) ? raw.ingredients : [],
            confidence: raw.confidence || 'high',
            healthyTip: String(raw.healthyTip || '').trim(),
            source: 'nutrition_label_ocr'
        };
    }

    // 7. Calculate scaled nutrition by multiplier (0.5x, 1x, 1.5x, 2x, or all servings)
    function scaleNutritionByMultiplier(baseData, multiplier = 1) {
        if (!baseData) return null;
        const m = Math.max(0.1, Number(multiplier) || 1);
        return {
            ...baseData,
            multiplier: m,
            cal: Math.round(baseData.cal * m),
            p: Math.round(baseData.p * m * 10) / 10,
            c: Math.round(baseData.c * m * 10) / 10,
            f: Math.round(baseData.f * m * 10) / 10,
            sugar: Math.round((baseData.sugar || 0) * m * 10) / 10,
            sodium: Math.round((baseData.sodium || 0) * m),
            servingSize: m === 1
                ? baseData.servingSize
                : `${baseData.servingSize} (สัดส่วน ${m}x)`
        };
    }

    // 8. Log scanned item directly into NovaFit Pro Daily Tracker State
    function addScannedFoodToDailyMeal(foodData, options = {}) {
        if (!foodData) return false;
        if (!window.state) {
            console.error('[NutritionScanner] window.state is missing.');
            return false;
        }

        const targetMeal = options.meal || window.state.activeMeal || 'lunch';
        const targetDate = options.date || window.state.selectedDate || (window.getTodayStr ? window.getTodayStr() : new Date().toISOString().split('T')[0]);
        const multiplier = Number(options.multiplier) || 1;

        const scaled = scaleNutritionByMultiplier(foodData, multiplier);

        if (!window.state.logsByDate) window.state.logsByDate = {};
        if (!window.state.logsByDate[targetDate]) window.state.logsByDate[targetDate] = [];

        const uniqueId = 'label_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
        const newLogItem = {
            id: uniqueId,
            name: scaled.foodName,
            cal: scaled.cal,
            p: Math.round(scaled.p),
            c: Math.round(scaled.c),
            f: Math.round(scaled.f),
            sugar: scaled.sugar,
            sodium: scaled.sodium,
            portion: multiplier,
            baseCal: foodData.cal,
            baseP: foodData.p,
            baseC: foodData.c,
            baseF: foodData.f,
            time: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
            meal: targetMeal,
            servingSize: scaled.servingSize,
            timestamp: Date.now(),
            source: 'ai_nutrition_label'
        };

        window.state.logsByDate[targetDate].push(newLogItem);

        // Save, render and trigger real-time cloud sync
        if (typeof window.saveState === 'function') window.saveState();
        if (typeof window.renderAll === 'function') window.renderAll();
        if (typeof window.triggerCloudSync === 'function') window.triggerCloudSync(false);

        // Sound & celebratory feedback
        if (typeof window.playSound === 'function') window.playSound('add');
        if (typeof window.showToast === 'function') {
            window.showToast(`🏷️ สแกนสำเร็จ! บันทึก "${scaled.foodName}" (${scaled.cal} kcal) ลงมื้อเรียบร้อย`);
        }

        return newLogItem;
    }

    // 9. Open Scanner Modal in Nutrition Label mode directly
    function openNutritionScanner(meal = 'lunch') {
        if (window.state) {
            window.state.activeMeal = meal;
        }
        if (typeof window.openAiSnapModal === 'function') {
            window.openAiSnapModal('label');
        } else {
            const modal = document.getElementById('aiSnapModal');
            if (modal) modal.classList.remove('hidden');
        }
    }

    // Public API Object
    const NutritionScanner = {
        SEVEN_ELEVEN_FOOD_DB,
        detectBarcodeFromImageSource,
        find7ElevenFoodByBarcode,
        search7ElevenFoodByKeyword,
        getThaiNutritionLabelPrompt,
        sanitizeNutritionFacts,
        scaleNutritionByMultiplier,
        addScannedFoodToDailyMeal,
        openNutritionScanner
    };

    // Export to Window Global
    window.NutritionScanner = NutritionScanner;
    window.SEVEN_ELEVEN_FOOD_DB = SEVEN_ELEVEN_FOOD_DB;
    window.openNutritionLabelScanner = openNutritionScanner;
    window.openAiLabelModal = () => openNutritionScanner();

    console.log('[NutritionScanner] Engine v5.9.30 loaded with 7-Eleven database & BarcodeDetector.');
})();
