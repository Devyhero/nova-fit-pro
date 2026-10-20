// ==========================================
// NovaFit Pro - Food & Nutrition Database (v5.2.1)
// Complete Database with 14 Categories (280+ Items)
// ==========================================

const MEAL_CONFIG = {
    breakfast: { id: 'breakfast', name: 'มื้อเช้า', icon: '🌅', color: 'text-amber-500' },
    lunch: { id: 'lunch', name: 'มื้อเที่ยง', icon: '☀️', color: 'text-emerald-500' },
    dinner: { id: 'dinner', name: 'มื้อเย็น', icon: '🌙', color: 'text-indigo-400' },
    snack: { id: 'snack', name: 'ของว่าง', icon: '🍎', color: 'text-rose-400' }
};

const WORKOUT_PRESETS = [
    { name: 'วิ่ง 30 นาที', cal: 250 },
    { name: 'เวทเทรนนิ่ง 45 นาที', cal: 200 },
    { name: 'เดิน 5,000 ก้าว', cal: 150 },
    { name: 'ปั่นจักรยาน 30 นาที', cal: 220 }
];

const DEFAULT_MEAL_COMBOS = [
    {
        id: 'combo_muscle_morning',
        name: 'เซ็ตเช้าสร้างกล้าม (Oats & Whey)',
        meal: 'breakfast',
        items: [
            { name: 'ข้าวโอ๊ต (Rolled Oats)', portion: 1, baseCal: 193, baseP: 6.5, baseC: 34, baseF: 3.5, cal: 193, p: 6.5, c: 34, f: 3.5 },
            { name: 'เวย์โปรตีน (Whey Protein)', portion: 1, baseCal: 125, baseP: 25, baseC: 3, baseF: 1.5, cal: 125, p: 25, c: 3, f: 1.5 },
            { name: 'ไข่ต้ม', portion: 1, baseCal: 140, baseP: 12, baseC: 1, baseF: 10, cal: 140, p: 12, c: 1, f: 10 }
        ]
    },
    {
        id: 'combo_quick_mooping',
        name: 'เซ็ตสตรีทฟู้ดหมูปิ้งพลังงาน',
        meal: 'breakfast',
        items: [
            { name: 'ข้าวเหนียวหมูปิ้ง (ชุด 2 ไม้ + ข้าวเหนียว 1 ห่อ)', portion: 1, baseCal: 370, baseP: 20, baseC: 44, baseF: 18, cal: 370, p: 20, c: 44, f: 18 },
            { name: 'นมถั่วเหลือง / ไวตามิ้ลค์ (Vitamilk)', portion: 1, baseCal: 150, baseP: 7, baseC: 22, baseF: 4, cal: 150, p: 7, c: 22, f: 4 }
        ]
    },
    {
        id: 'combo_clean_chicken',
        name: 'เซ็ตมื้อเที่ยงคลีนอกไก่ลีน',
        meal: 'lunch',
        items: [
            { name: 'อกไก่ย่าง', portion: 1, baseCal: 250, baseP: 45, baseC: 0, baseF: 5, cal: 250, p: 45, c: 0, f: 5 },
            { name: 'ข้าวกล้องหุงสุก', portion: 1, baseCal: 165, baseP: 3.8, baseC: 35, baseF: 1.2, cal: 165, p: 3.8, c: 35, f: 1.2 },
            { name: 'สลัดอกไก่', portion: 1, baseCal: 300, baseP: 30, baseC: 15, baseF: 12, cal: 300, p: 30, c: 15, f: 12 }
        ]
    }
];

const DEFAULT_SUPPLEMENTS = Object.freeze([
    Object.freeze({ id: 'supp_whey', name: 'เวย์โปรตีน (Whey)', time: 'หลังซ้อม / ตื่นนอน', icon: '🥛' }),
    Object.freeze({ id: 'supp_creatine', name: 'ครีเอทีน (Creatine 5g)', time: 'พร้อมน้ำดื่ม / หลังซ้อม', icon: '⚡' }),
    Object.freeze({ id: 'supp_vitc', name: 'วิตามิน C (1,000mg)', time: 'หลังอาหารเช้า', icon: '🍊' }),
    Object.freeze({ id: 'supp_vitd', name: 'วิตามิน D3 + K2', time: 'พร้อมมื้อเช้า', icon: '☀️' }),
    Object.freeze({ id: 'supp_fishoil', name: 'น้ำมันปลา (Omega-3)', time: 'พร้อมมื้ออาหาร', icon: '🐟' }),
    Object.freeze({ id: 'supp_zinc', name: 'ซิงค์ (Zinc)', time: 'หลังอาหารกลางวัน/เย็น', icon: '🛡️' }),
    Object.freeze({ id: 'supp_magnesium', name: 'แมกนีเซียม (Magnesium)', time: 'ก่อนนอน 30 นาที', icon: '🌙' })
]);

const FOOD_DATABASE = {
    "categories": [
        {
            "id": "healthy",
            "name": "💪 โปรตีนและสุขภาพ",
            "foods": [
                { "name": "อกไก่ย่าง", "servingSize": "150 กรัม", "calories": 250, "protein": 45, "carbs": 0, "fat": 5 },
                { "name": "เวย์โปรตีน (Whey Protein)", "servingSize": "1 สกู๊ป", "calories": 125, "protein": 25, "carbs": 3, "fat": 1.5 },
                { "name": "ไข่ต้ม", "servingSize": "2 ฟอง", "calories": 140, "protein": 12, "carbs": 1, "fat": 10 },
                { "name": "ปลาเผา", "servingSize": "200 กรัม", "calories": 300, "protein": 50, "carbs": 0, "fat": 8 },
                { "name": "สลัดอกไก่", "servingSize": "1 จาน", "calories": 300, "protein": 30, "carbs": 15, "fat": 12 },
                { "name": "ทูน่าในน้ำแร่", "servingSize": "1 กระป๋อง", "calories": 120, "protein": 26, "carbs": 0, "fat": 1 },
                { "name": "ข้าวโอ๊ต (Rolled Oats)", "servingSize": "50 กรัม", "calories": 193, "protein": 6.5, "carbs": 34, "fat": 3.5 },
                { "name": "โอเวอร์ไนท์โอ๊ต (Overnight Oats)", "servingSize": "1 ถ้วย", "calories": 310, "protein": 18, "carbs": 42, "fat": 7 },
                { "name": "กรีกโยเกิร์ต (Greek Yogurt)", "servingSize": "150 กรัม", "calories": 111, "protein": 15, "carbs": 6, "fat": 3 },
                { "name": "ข้าวกล้องหุงสุก", "servingSize": "150 กรัม", "calories": 165, "protein": 3.8, "carbs": 35, "fat": 1.2 },
                { "name": "ข้าวสวยหุงสุก", "servingSize": "150 กรัม", "calories": 195, "protein": 4, "carbs": 42, "fat": 0.5 },
                { "name": "อัลมอนด์อบ / แอลมอนด์ (Almonds)", "servingSize": "1 กำมือ (30 กรัม)", "calories": 165, "protein": 6, "carbs": 6, "fat": 14 },
                { "name": "เม็ดมะม่วงหิมพานต์ (Cashews)", "servingSize": "1 กำมือ (30 กรัม)", "calories": 160, "protein": 5, "carbs": 9, "fat": 13 },
                { "name": "เนยถั่ว (Peanut Butter)", "servingSize": "1 ช้อนโต๊ะ (16 กรัม)", "calories": 95, "protein": 4, "carbs": 3, "fat": 8 },
                { "name": "ถั่วแระญี่ปุ่น (Edamame)", "servingSize": "1 ถ้วย (100 กรัม)", "calories": 122, "protein": 11, "carbs": 10, "fat": 5 },
                { "name": "วิตามินรวม (Multivitamin)", "servingSize": "1 เม็ด", "calories": 0, "protein": 0, "carbs": 0, "fat": 0 },
                { "name": "วิตามินซี (Vitamin C 1,000mg)", "servingSize": "1 เม็ด", "calories": 0, "protein": 0, "carbs": 0, "fat": 0 },
                { "name": "น้ำมันปลา โอเมก้า 3 (Fish Oil)", "servingSize": "1 แคปซูล", "calories": 10, "protein": 0, "carbs": 0, "fat": 1 }
            ]
        },
        {
            "id": "rice_dishes",
            "name": "🍛 อาหารจานเดียว",
            "foods": [
                { "name": "ข้าวกะเพราไก่", "servingSize": "1 จาน", "calories": 650, "protein": 35, "carbs": 70, "fat": 25 },
                { "name": "ข้าวกะเพราหมูสับ", "servingSize": "1 จาน", "calories": 700, "protein": 30, "carbs": 70, "fat": 30 },
                { "name": "ข้าวกะเพราเนื้อ", "servingSize": "1 จาน", "calories": 680, "protein": 32, "carbs": 70, "fat": 28 },
                { "name": "ข้าวกะเพราทะเล", "servingSize": "1 จาน", "calories": 580, "protein": 30, "carbs": 70, "fat": 18 },
                { "name": "ข้าวกะเพราปลาหมึก", "servingSize": "1 จาน", "calories": 560, "protein": 28, "carbs": 70, "fat": 16 },
                { "name": "ข้าวผัดไก่", "servingSize": "1 จาน", "calories": 650, "protein": 30, "carbs": 75, "fat": 22 },
                { "name": "ข้าวผัดหมู", "servingSize": "1 จาน", "calories": 680, "protein": 25, "carbs": 75, "fat": 28 },
                { "name": "ข้าวผัดกุ้ง", "servingSize": "1 จาน", "calories": 600, "protein": 28, "carbs": 75, "fat": 18 },
                { "name": "ข้าวผัดปู", "servingSize": "1 จาน", "calories": 590, "protein": 27, "carbs": 74, "fat": 18 },
                { "name": "ข้าวผัดอเมริกัน", "servingSize": "1 จาน", "calories": 790, "protein": 28, "carbs": 85, "fat": 38 },
                { "name": "ข้าวไข่เจียว", "servingSize": "1 จาน", "calories": 650, "protein": 16, "carbs": 65, "fat": 35 },
                { "name": "ข้าวไข่เจียวหมูสับ", "servingSize": "1 จาน", "calories": 750, "protein": 25, "carbs": 65, "fat": 40 },
                { "name": "ข้าวไข่ข้น", "servingSize": "1 จาน", "calories": 580, "protein": 16, "carbs": 65, "fat": 28 },
                { "name": "ข้าวไข่ข้นกุ้ง", "servingSize": "1 จาน", "calories": 640, "protein": 24, "carbs": 66, "fat": 30 },
                { "name": "ข้าวไข่ข้นเบคอน", "servingSize": "1 จาน", "calories": 720, "protein": 20, "carbs": 65, "fat": 42 },
                { "name": "ข้าวหมูแดง", "servingSize": "1 จาน", "calories": 650, "protein": 25, "carbs": 85, "fat": 18 },
                { "name": "ข้าวหมูกรอบ", "servingSize": "1 จาน", "calories": 850, "protein": 25, "carbs": 80, "fat": 45 },
                { "name": "ข้าวขาหมู", "servingSize": "1 จาน", "calories": 750, "protein": 30, "carbs": 75, "fat": 35 },
                { "name": "ข้าวหน้าเป็ด", "servingSize": "1 จาน", "calories": 670, "protein": 28, "carbs": 75, "fat": 26 },
                { "name": "ข้าวมันไก่", "servingSize": "1 จาน", "calories": 700, "protein": 35, "carbs": 80, "fat": 25 },
                { "name": "ข้าวมันไก่ทอด", "servingSize": "1 จาน", "calories": 820, "protein": 30, "carbs": 88, "fat": 38 },
                { "name": "ข้าวไก่กระเทียม", "servingSize": "1 จาน", "calories": 650, "protein": 35, "carbs": 70, "fat": 22 },
                { "name": "ข้าวหมูกระเทียม", "servingSize": "1 จาน", "calories": 680, "protein": 28, "carbs": 70, "fat": 28 },
                { "name": "ข้าวคะน้าหมูกรอบ", "servingSize": "1 จาน", "calories": 800, "protein": 28, "carbs": 70, "fat": 40 },
                { "name": "ข้าวคะน้าหมู", "servingSize": "1 จาน", "calories": 640, "protein": 28, "carbs": 70, "fat": 24 },
                { "name": "ข้าวผัดพริกแกงหมู", "servingSize": "1 จาน", "calories": 670, "protein": 26, "carbs": 72, "fat": 28 },
                { "name": "ข้าวผัดพริกแกงไก่", "servingSize": "1 จาน", "calories": 630, "protein": 32, "carbs": 72, "fat": 22 },
                { "name": "ข้าวผัดฉ่าทะเล", "servingSize": "1 จาน", "calories": 580, "protein": 28, "carbs": 70, "fat": 18 },
                { "name": "ข้าวลาบหมู", "servingSize": "1 จาน", "calories": 590, "protein": 28, "carbs": 70, "fat": 20 },
                { "name": "ข้าวน้ำตกหมู", "servingSize": "1 จาน", "calories": 630, "protein": 28, "carbs": 70, "fat": 24 }
            ]
        },
        {
            "id": "noodles",
            "name": "🍜 ก๋วยเตี๋ยวและเส้น",
            "foods": [
                { "name": "ก๋วยเตี๋ยวน้ำหมู", "servingSize": "1 ชาม", "calories": 350, "protein": 20, "carbs": 50, "fat": 6 },
                { "name": "ก๋วยเตี๋ยวน้ำเนื้อ", "servingSize": "1 ชาม", "calories": 370, "protein": 22, "carbs": 50, "fat": 8 },
                { "name": "ก๋วยเตี๋ยวต้มยำหมู", "servingSize": "1 ชาม", "calories": 450, "protein": 22, "carbs": 55, "fat": 12 },
                { "name": "ก๋วยเตี๋ยวต้มยำทะเล", "servingSize": "1 ชาม", "calories": 420, "protein": 24, "carbs": 55, "fat": 10 },
                { "name": "เย็นตาโฟ", "servingSize": "1 ชาม", "calories": 400, "protein": 18, "carbs": 55, "fat": 8 },
                { "name": "บะหมี่หมูแดง", "servingSize": "1 ชาม", "calories": 500, "protein": 22, "carbs": 65, "fat": 12 },
                { "name": "บะหมี่เกี๊ยวหมูแดง", "servingSize": "1 ชาม", "calories": 550, "protein": 26, "carbs": 70, "fat": 16 },
                { "name": "เส้นเล็กน้ำตก", "servingSize": "1 ชาม", "calories": 380, "protein": 20, "carbs": 52, "fat": 10 },
                { "name": "เส้นใหญ่เย็นตาโฟ", "servingSize": "1 ชาม", "calories": 440, "protein": 18, "carbs": 60, "fat": 12 },
                { "name": "วุ้นเส้นต้มยำ", "servingSize": "1 ชาม", "calories": 360, "protein": 20, "carbs": 42, "fat": 12 },
                { "name": "ราดหน้าหมู", "servingSize": "1 จาน", "calories": 600, "protein": 25, "carbs": 80, "fat": 15 },
                { "name": "ราดหน้าทะเล", "servingSize": "1 จาน", "calories": 560, "protein": 26, "carbs": 78, "fat": 12 },
                { "name": "ผัดซีอิ๊วหมู", "servingSize": "1 จาน", "calories": 700, "protein": 25, "carbs": 85, "fat": 20 },
                { "name": "ผัดซีอิ๊วไก่", "servingSize": "1 จาน", "calories": 660, "protein": 28, "carbs": 85, "fat": 18 },
                { "name": "สุกี้น้ำหมู", "servingSize": "1 ชาม", "calories": 380, "protein": 26, "carbs": 35, "fat": 12 },
                { "name": "สุกี้น้ำไก่", "servingSize": "1 ชาม", "calories": 350, "protein": 30, "carbs": 25, "fat": 8 },
                { "name": "สุกี้น้ำทะเล", "servingSize": "1 ชาม", "calories": 340, "protein": 28, "carbs": 30, "fat": 8 },
                { "name": "สุกี้แห้งหมู", "servingSize": "1 จาน", "calories": 480, "protein": 26, "carbs": 40, "fat": 20 },
                { "name": "สุกี้แห้งไก่", "servingSize": "1 จาน", "calories": 450, "protein": 32, "carbs": 30, "fat": 15 },
                { "name": "มาม่าผัดขี้เมา", "servingSize": "1 จาน", "calories": 550, "protein": 20, "carbs": 65, "fat": 22 }
            ]
        },
        {
            "id": "esan",
            "name": "🌶️ อาหารอีสาน",
            "foods": [
                { "name": "ส้มตำไทย", "servingSize": "1 จาน", "calories": 180, "protein": 3, "carbs": 35, "fat": 2 },
                { "name": "ส้มตำปูปลาร้า", "servingSize": "1 จาน", "calories": 120, "protein": 4, "carbs": 20, "fat": 2 },
                { "name": "ส้มตำไข่เค็ม", "servingSize": "1 จาน", "calories": 250, "protein": 10, "carbs": 35, "fat": 8 },
                { "name": "ส้มตำไทยไข่เค็ม", "servingSize": "1 จาน", "calories": 270, "protein": 10, "carbs": 38, "fat": 9 },
                { "name": "ส้มตำทะเล", "servingSize": "1 จาน", "calories": 220, "protein": 18, "carbs": 28, "fat": 4 },
                { "name": "ลาบหมู", "servingSize": "1 จาน", "calories": 250, "protein": 22, "carbs": 5, "fat": 15 },
                { "name": "ลาบไก่", "servingSize": "1 จาน", "calories": 210, "protein": 26, "carbs": 6, "fat": 9 },
                { "name": "ลาบเนื้อ", "servingSize": "1 จาน", "calories": 240, "protein": 25, "carbs": 6, "fat": 13 },
                { "name": "น้ำตกหมู", "servingSize": "1 จาน", "calories": 290, "protein": 22, "carbs": 6, "fat": 20 },
                { "name": "น้ำตกเนื้อ", "servingSize": "1 จาน", "calories": 270, "protein": 24, "carbs": 6, "fat": 17 },
                { "name": "คอหมูย่าง", "servingSize": "100 กรัม", "calories": 400, "protein": 25, "carbs": 0, "fat": 32 },
                { "name": "ไก่ย่าง", "servingSize": "1 น่อง", "calories": 250, "protein": 30, "carbs": 0, "fat": 12 },
                { "name": "ตับหวาน", "servingSize": "1 จาน", "calories": 220, "protein": 24, "carbs": 8, "fat": 10 },
                { "name": "ซุปหน่อไม้", "servingSize": "1 จาน", "calories": 90, "protein": 4, "carbs": 15, "fat": 2 },
                { "name": "แกงอ่อมหมู", "servingSize": "1 ถ้วย", "calories": 200, "protein": 18, "carbs": 10, "fat": 10 },
                { "name": "แกงอ่อมไก่", "servingSize": "1 ถ้วย", "calories": 180, "protein": 22, "carbs": 10, "fat": 6 },
                { "name": "ต้มแซ่บกระดูกอ่อน", "servingSize": "1 ถ้วย", "calories": 220, "protein": 20, "carbs": 8, "fat": 12 },
                { "name": "ต้มแซ่บเนื้อ", "servingSize": "1 ถ้วย", "calories": 200, "protein": 22, "carbs": 8, "fat": 9 },
                { "name": "ข้าวเหนียว", "servingSize": "100 กรัม", "calories": 220, "protein": 4, "carbs": 48, "fat": 1 },
                { "name": "แจ่วฮ้อน", "servingSize": "1 ชุดเล็ก", "calories": 350, "protein": 30, "carbs": 20, "fat": 16 }
            ]
        },
        {
            "id": "curries_soups",
            "name": "🍲 แกงและต้ม",
            "foods": [
                { "name": "แกงเขียวหวานไก่", "servingSize": "1 ถ้วย", "calories": 320, "protein": 20, "carbs": 12, "fat": 22 },
                { "name": "แกงเขียวหวานลูกชิ้นปลา", "servingSize": "1 ถ้วย", "calories": 290, "protein": 18, "carbs": 14, "fat": 18 },
                { "name": "แกงแดงหมู", "servingSize": "1 ถ้วย", "calories": 340, "protein": 18, "carbs": 12, "fat": 25 },
                { "name": "แกงเผ็ดเป็ดย่าง", "servingSize": "1 ถ้วย", "calories": 380, "protein": 20, "carbs": 15, "fat": 28 },
                { "name": "พะแนงหมู", "servingSize": "1 ถ้วย", "calories": 360, "protein": 20, "carbs": 12, "fat": 26 },
                { "name": "พะแนงไก่", "servingSize": "1 ถ้วย", "calories": 330, "protein": 22, "carbs": 12, "fat": 22 },
                { "name": "มัสมั่นไก่", "servingSize": "1 ถ้วย", "calories": 420, "protein": 22, "carbs": 25, "fat": 26 },
                { "name": "มัสมั่นเนื้อ", "servingSize": "1 ถ้วย", "calories": 450, "protein": 24, "carbs": 25, "fat": 28 },
                { "name": "แกงส้มชะอมกุ้ง", "servingSize": "1 ถ้วย", "calories": 260, "protein": 18, "carbs": 16, "fat": 14 },
                { "name": "แกงส้มปลาช่อน", "servingSize": "1 ถ้วย", "calories": 180, "protein": 22, "carbs": 14, "fat": 4 },
                { "name": "ต้มข่าไก่", "servingSize": "1 ถ้วย", "calories": 320, "protein": 20, "carbs": 10, "fat": 22 },
                { "name": "ต้มยำกุ้งน้ำข้น", "servingSize": "1 ถ้วย", "calories": 220, "protein": 18, "carbs": 12, "fat": 12 },
                { "name": "ต้มยำกุ้งน้ำใส", "servingSize": "1 ถ้วย", "calories": 120, "protein": 18, "carbs": 8, "fat": 2 },
                { "name": "ต้มจับฉ่าย", "servingSize": "1 ถ้วย", "calories": 180, "protein": 12, "carbs": 15, "fat": 8 },
                { "name": "แกงจืดเต้าหู้หมูสับ", "servingSize": "1 ถ้วย", "calories": 160, "protein": 14, "carbs": 8, "fat": 8 },
                { "name": "แกงเลียง", "servingSize": "1 ถ้วย", "calories": 140, "protein": 12, "carbs": 18, "fat": 2 },
                { "name": "แกงป่าไก่", "servingSize": "1 ถ้วย", "calories": 180, "protein": 22, "carbs": 10, "fat": 6 },
                { "name": "แกงป่าปลา", "servingSize": "1 ถ้วย", "calories": 160, "protein": 22, "carbs": 8, "fat": 4 },
                { "name": "ต้มมะระยัดไส้", "servingSize": "1 ถ้วย", "calories": 210, "protein": 16, "carbs": 10, "fat": 12 },
                { "name": "แกงจืดวุ้นเส้น", "servingSize": "1 ถ้วย", "calories": 180, "protein": 12, "carbs": 20, "fat": 6 }
            ]
        },
        {
            "id": "stir_fries",
            "name": "🥦 ผัดและกับข้าว",
            "foods": [
                { "name": "ผัดผักรวม", "servingSize": "1 จาน", "calories": 180, "protein": 6, "carbs": 14, "fat": 12 },
                { "name": "ผัดน้ำมันหอยหมู", "servingSize": "1 จาน", "calories": 280, "protein": 20, "carbs": 10, "fat": 18 },
                { "name": "ผัดน้ำมันหอยไก่", "servingSize": "1 จาน", "calories": 250, "protein": 24, "carbs": 10, "fat": 13 },
                { "name": "ผัดกะหล่ำปลีหมูกรอบ", "servingSize": "1 จาน", "calories": 380, "protein": 14, "carbs": 10, "fat": 32 },
                { "name": "ผัดผักบุ้งไฟแดง", "servingSize": "1 จาน", "calories": 160, "protein": 4, "carbs": 10, "fat": 12 },
                { "name": "ผัดคะน้าน้ำมันหอย", "servingSize": "1 จาน", "calories": 180, "protein": 5, "carbs": 12, "fat": 13 },
                { "name": "ผัดเห็ดรวม", "servingSize": "1 จาน", "calories": 150, "protein": 6, "carbs": 12, "fat": 9 },
                { "name": "ผัดเปรี้ยวหวานหมู", "servingSize": "1 จาน", "calories": 300, "protein": 16, "carbs": 28, "fat": 14 },
                { "name": "ผัดเปรี้ยวหวานไก่", "servingSize": "1 จาน", "calories": 270, "protein": 20, "carbs": 26, "fat": 10 },
                { "name": "ผัดเปรี้ยวหวานทะเล", "servingSize": "1 จาน", "calories": 250, "protein": 20, "carbs": 25, "fat": 8 },
                { "name": "ผัดฉ่าทะเล", "servingSize": "1 จาน", "calories": 240, "protein": 22, "carbs": 10, "fat": 12 },
                { "name": "ผัดขิงหมู", "servingSize": "1 จาน", "calories": 260, "protein": 18, "carbs": 10, "fat": 16 },
                { "name": "ผัดขิงไก่", "servingSize": "1 จาน", "calories": 230, "protein": 22, "carbs": 10, "fat": 12 },
                { "name": "ผัดพริกสดหมู", "servingSize": "1 จาน", "calories": 280, "protein": 18, "carbs": 12, "fat": 18 },
                { "name": "ผัดพริกสดไก่", "servingSize": "1 จาน", "calories": 250, "protein": 22, "carbs": 12, "fat": 13 },
                { "name": "ผัดวุ้นเส้น", "servingSize": "1 จาน", "calories": 320, "protein": 14, "carbs": 35, "fat": 14 },
                { "name": "ผัดถั่วงอกเต้าหู้", "servingSize": "1 จาน", "calories": 200, "protein": 12, "carbs": 12, "fat": 12 },
                { "name": "ผัดกุยช่ายขาว", "servingSize": "1 จาน", "calories": 240, "protein": 14, "carbs": 10, "fat": 16 },
                { "name": "ผัดมะเขือยาวหมูสับ", "servingSize": "1 จาน", "calories": 290, "protein": 14, "carbs": 16, "fat": 20 },
                { "name": "ผัดหน่อไม้หมู", "servingSize": "1 จาน", "calories": 260, "protein": 16, "carbs": 14, "fat": 16 }
            ]
        },
        {
            "id": "breakfast",
            "name": "🍳 อาหารเช้า",
            "foods": [
                { "name": "โจ๊กหมู", "servingSize": "1 ชาม", "calories": 260, "protein": 14, "carbs": 34, "fat": 7 },
                { "name": "โจ๊กหมูไข่", "servingSize": "1 ชาม", "calories": 330, "protein": 20, "carbs": 35, "fat": 12 },
                { "name": "โจ๊กไก่", "servingSize": "1 ชาม", "calories": 240, "protein": 16, "carbs": 34, "fat": 5 },
                { "name": "ข้าวต้มหมู", "servingSize": "1 ชาม", "calories": 280, "protein": 16, "carbs": 38, "fat": 7 },
                { "name": "ข้าวต้มปลา", "servingSize": "1 ชาม", "calories": 240, "protein": 20, "carbs": 36, "fat": 3 },
                { "name": "ข้าวต้มกุ้ง", "servingSize": "1 ชาม", "calories": 250, "protein": 18, "carbs": 36, "fat": 4 },
                { "name": "ไข่กระทะ", "servingSize": "1 ชุด", "calories": 320, "protein": 18, "carbs": 8, "fat": 24 },
                { "name": "ไข่ลวก", "servingSize": "2 ฟอง", "calories": 140, "protein": 12, "carbs": 1, "fat": 10 },
                { "name": "แซนด์วิชทูน่า", "servingSize": "1 ชิ้นคู่", "calories": 310, "protein": 16, "carbs": 32, "fat": 13 },
                { "name": "แซนด์วิชแฮม", "servingSize": "1 ชิ้นคู่", "calories": 290, "protein": 14, "carbs": 32, "fat": 12 },
                { "name": "ขนมปังปิ้งเนยนม", "servingSize": "1 แผ่น", "calories": 220, "protein": 4, "carbs": 30, "fat": 9 },
                { "name": "ขนมปังสังขยา", "servingSize": "1 ชุด", "calories": 280, "protein": 6, "carbs": 42, "fat": 10 },
                { "name": "ปาท่องโก๋", "servingSize": "2 ตัว", "calories": 250, "protein": 4, "carbs": 28, "fat": 14 },
                { "name": "หมูปิ้ง (นมสด / โบราณ)", "servingSize": "1 ไม้", "calories": 130, "protein": 8, "carbs": 5, "fat": 9 },
                { "name": "หมูปิ้ง 2 ไม้", "servingSize": "2 ไม้", "calories": 260, "protein": 16, "carbs": 10, "fat": 18 },
                { "name": "หมูปิ้ง 3 ไม้", "servingSize": "3 ไม้", "calories": 390, "protein": 24, "carbs": 15, "fat": 27 },
                { "name": "ข้าวเหนียวหมูปิ้ง (ชุด 2 ไม้)", "servingSize": "หมู 2 ไม้ + ข้าวเหนียว 1 ห่อ", "calories": 370, "protein": 18, "carbs": 44, "fat": 14 },
                { "name": "ข้าวเหนียวหมูปิ้ง (ชุด 3 ไม้)", "servingSize": "หมู 3 ไม้ + ข้าวเหนียว 1 ห่อ", "calories": 480, "protein": 24, "carbs": 48, "fat": 20 },
                { "name": "ตับปิ้ง / ตับไก่ปิ้ง", "servingSize": "1 ไม้", "calories": 90, "protein": 12, "carbs": 2, "fat": 4 },
                { "name": "ไก่ย่าง / ไก่ปิ้งเสียบไม้", "servingSize": "1 ไม้", "calories": 110, "protein": 14, "carbs": 2, "fat": 5 },
                { "name": "ข้าวเหนียวไก่ทอด", "servingSize": "1 ชุด", "calories": 550, "protein": 24, "carbs": 52, "fat": 26 }
            ]
        },
        {
            "id": "fried_snacks",
            "name": "🍟 ของทอดและของทานเล่น",
            "foods": [
                { "name": "หมูทอด", "servingSize": "100 กรัม", "calories": 350, "protein": 22, "carbs": 8, "fat": 26 },
                { "name": "ไก่ทอด", "servingSize": "1 ชิ้น", "calories": 320, "protein": 22, "carbs": 12, "fat": 20 },
                { "name": "ปีกไก่ทอด", "servingSize": "3 ชิ้น", "calories": 290, "protein": 20, "carbs": 8, "fat": 20 },
                { "name": "นักเก็ตไก่", "servingSize": "6 ชิ้น", "calories": 280, "protein": 14, "carbs": 18, "fat": 18 },
                { "name": "เฟรนช์ฟรายส์", "servingSize": "1 ชุดกลาง", "calories": 360, "protein": 4, "carbs": 46, "fat": 18 },
                { "name": "ทอดมันปลา", "servingSize": "5 ชิ้น", "calories": 280, "protein": 16, "carbs": 15, "fat": 18 },
                { "name": "ทอดมันกุ้ง", "servingSize": "4 ชิ้น", "calories": 340, "protein": 16, "carbs": 22, "fat": 22 },
                { "name": "ปลาหมึกทอด", "servingSize": "100 กรัม", "calories": 280, "protein": 18, "carbs": 16, "fat": 16 },
                { "name": "กุ้งชุบแป้งทอด", "servingSize": "5 ตัว", "calories": 320, "protein": 16, "carbs": 26, "fat": 18 },
                { "name": "หอมทอด", "servingSize": "1 ชุด", "calories": 310, "protein": 4, "carbs": 36, "fat": 16 },
                { "name": "ลูกชิ้นทอด", "servingSize": "2 ไม้", "calories": 260, "protein": 10, "carbs": 22, "fat": 15 },
                { "name": "ไส้กรอกทอด", "servingSize": "2 ไม้", "calories": 300, "protein": 10, "carbs": 8, "fat": 25 },
                { "name": "เต้าหู้ทอด", "servingSize": "1 ชุด", "calories": 240, "protein": 12, "carbs": 14, "fat": 16 },
                { "name": "ปอเปี๊ยะทอด", "servingSize": "3 ชิ้น", "calories": 280, "protein": 6, "carbs": 30, "fat": 15 },
                { "name": "มันฝรั่งทอด", "servingSize": "1 ห่อเล็ก", "calories": 160, "protein": 2, "carbs": 15, "fat": 10 }
            ]
        },
        {
            "id": "japanese",
            "name": "🍣 อาหารญี่ปุ่น",
            "foods": [
                { "name": "ข้าวหน้าหมู (Butadon)", "servingSize": "1 ชาม", "calories": 680, "protein": 26, "carbs": 82, "fat": 26 },
                { "name": "ข้าวหน้าเนื้อ (Gyudon)", "servingSize": "1 ชาม", "calories": 700, "protein": 28, "carbs": 82, "fat": 28 },
                { "name": "ข้าวหน้าปลาแซลมอน", "servingSize": "1 ชาม", "calories": 580, "protein": 32, "carbs": 72, "fat": 16 },
                { "name": "ข้าวแกงกะหรี่หมู", "servingSize": "1 จาน", "calories": 780, "protein": 25, "carbs": 95, "fat": 32 },
                { "name": "ราเมน / ราเมง หมูชาชู (Chashu Ramen)", "servingSize": "1 ชาม", "calories": 620, "protein": 26, "carbs": 68, "fat": 26 },
                { "name": "ราเมนทงคตสึ (Tonkotsu Ramen ซุปกระดูกหมูเข้มข้น)", "servingSize": "1 ชาม", "calories": 680, "protein": 28, "carbs": 72, "fat": 30 },
                { "name": "ราเมนโชยุ (Shoyu Ramen ซีอิ๊วญี่ปุ่น)", "servingSize": "1 ชาม", "calories": 490, "protein": 22, "carbs": 68, "fat": 14 },
                { "name": "ราเมนมิโสะ (Miso Ramen ซุปเต้าเจี้ยว)", "servingSize": "1 ชาม", "calories": 580, "protein": 24, "carbs": 70, "fat": 22 },
                { "name": "ราเมนต้มยำชาชู (Tomyum Ramen)", "servingSize": "1 ชาม", "calories": 630, "protein": 28, "carbs": 70, "fat": 26 },
                { "name": "ทสึเคเมน (Tsukemen ราเมนจุ่มซุปข้น)", "servingSize": "1 ชาม", "calories": 720, "protein": 32, "carbs": 80, "fat": 30 },
                { "name": "อุด้ง", "servingSize": "1 ชาม", "calories": 420, "protein": 16, "carbs": 72, "fat": 6 },
                { "name": "ยากิโซบะ", "servingSize": "1 จาน", "calories": 520, "protein": 18, "carbs": 68, "fat": 18 },
                { "name": "ข้าวปั้นแซลมอน (Onigiri)", "servingSize": "1 ชิ้น", "calories": 190, "protein": 6, "carbs": 36, "fat": 2 },
                { "name": "ซูชิแซลมอน", "servingSize": "2 คำ", "calories": 120, "protein": 7, "carbs": 16, "fat": 3 },
                { "name": "ซูชิทูน่า", "servingSize": "2 คำ", "calories": 100, "protein": 8, "carbs": 16, "fat": 1 },
                { "name": "ซูชิกุ้ง", "servingSize": "2 คำ", "calories": 95, "protein": 7, "carbs": 16, "fat": 0.5 },
                { "name": "เทมปุระกุ้ง", "servingSize": "3 ชิ้น", "calories": 290, "protein": 14, "carbs": 24, "fat": 16 },
                { "name": "ปลาแซลมอนย่าง", "servingSize": "150 กรัม", "calories": 320, "protein": 32, "carbs": 2, "fat": 20 }
            ]
        },
        {
            "id": "western",
            "name": "🍔 อาหารตะวันตกและฟาสต์ฟู้ด",
            "foods": [
                { "name": "แฮมเบอร์เกอร์หมู", "servingSize": "1 ชิ้น", "calories": 480, "protein": 22, "carbs": 42, "fat": 24 },
                { "name": "แฮมเบอร์เกอร์เนื้อ", "servingSize": "1 ชิ้น", "calories": 520, "protein": 26, "carbs": 42, "fat": 27 },
                { "name": "ชีสเบอร์เกอร์", "servingSize": "1 ชิ้น", "calories": 560, "protein": 28, "carbs": 43, "fat": 31 },
                { "name": "เบอร์เกอร์ไก่ทอด", "servingSize": "1 ชิ้น", "calories": 540, "protein": 22, "carbs": 48, "fat": 28 },
                { "name": "ฮอตดอก", "servingSize": "1 ชิ้น", "calories": 320, "protein": 12, "carbs": 28, "fat": 18 },
                { "name": "พิซซ่าหน้าซีฟู้ด", "servingSize": "1 ชิ้น", "calories": 280, "protein": 13, "carbs": 32, "fat": 11 },
                { "name": "พิซซ่าฮาวายเอี้ยน", "servingSize": "1 ชิ้น", "calories": 270, "protein": 12, "carbs": 33, "fat": 10 },
                { "name": "พิซซ่าเปปเปอโรนี", "servingSize": "1 ชิ้น", "calories": 310, "protein": 13, "carbs": 31, "fat": 15 },
                { "name": "สปาเกตตีคาโบนารา", "servingSize": "1 จาน", "calories": 650, "protein": 22, "carbs": 68, "fat": 32 },
                { "name": "สปาเกตตีผัดขี้เมา", "servingSize": "1 จาน", "calories": 520, "protein": 24, "carbs": 65, "fat": 18 },
                { "name": "สปาเกตตีซอสมะเขือเทศ", "servingSize": "1 จาน", "calories": 480, "protein": 18, "carbs": 70, "fat": 14 },
                { "name": "สเต็กหมู", "servingSize": "1 จาน", "calories": 520, "protein": 40, "carbs": 18, "fat": 32 },
                { "name": "สเต็กไก่", "servingSize": "1 จาน", "calories": 420, "protein": 42, "carbs": 18, "fat": 18 },
                { "name": "สเต็กปลา", "servingSize": "1 จาน", "calories": 380, "protein": 36, "carbs": 18, "fat": 16 },
                { "name": "ซีซาร์สลัด", "servingSize": "1 จาน", "calories": 320, "protein": 12, "carbs": 16, "fat": 24 }
            ]
        },
        {
            "id": "fruits",
            "name": "🍎 ผลไม้",
            "foods": [
                { "name": "กล้วยน้ำว้า", "servingSize": "1 ลูก", "calories": 60, "protein": 1, "carbs": 14, "fat": 0.2 },
                { "name": "กล้วยหอม", "servingSize": "1 ลูก", "calories": 110, "protein": 1.3, "carbs": 27, "fat": 0.4 },
                { "name": "แตงโม", "servingSize": "150 กรัม", "calories": 45, "protein": 1, "carbs": 11, "fat": 0.2 },
                { "name": "สับปะรด", "servingSize": "150 กรัม", "calories": 75, "protein": 0.8, "carbs": 19, "fat": 0.2 },
                { "name": "มะละกอ", "servingSize": "150 กรัม", "calories": 65, "protein": 0.8, "carbs": 16, "fat": 0.2 },
                { "name": "ฝรั่ง", "servingSize": "1 ลูกกลาง", "calories": 80, "protein": 2.5, "carbs": 18, "fat": 0.8 },
                { "name": "ชมพู่", "servingSize": "2 ลูก", "calories": 45, "protein": 0.6, "carbs": 11, "fat": 0.2 },
                { "name": "ส้มเขียวหวาน", "servingSize": "1 ลูก", "calories": 50, "protein": 0.8, "carbs": 12, "fat": 0.2 },
                { "name": "ส้มโอ", "servingSize": "2 กลีบ", "calories": 60, "protein": 1, "carbs": 15, "fat": 0.1 },
                { "name": "แก้วมังกร", "servingSize": "150 กรัม", "calories": 90, "protein": 1.8, "carbs": 20, "fat": 0.6 },
                { "name": "มะม่วงสุก", "servingSize": "1 ลูกกลาง", "calories": 130, "protein": 1.5, "carbs": 32, "fat": 0.5 },
                { "name": "มะม่วงดิบ", "servingSize": "1 ลูกกลาง", "calories": 90, "protein": 1, "carbs": 22, "fat": 0.3 },
                { "name": "ลำไย", "servingSize": "10 ลูก", "calories": 70, "protein": 1, "carbs": 17, "fat": 0.1 },
                { "name": "ลิ้นจี่", "servingSize": "6 ลูก", "calories": 75, "protein": 1, "carbs": 18, "fat": 0.3 },
                { "name": "เงาะ", "servingSize": "5 ลูก", "calories": 75, "protein": 0.8, "carbs": 18, "fat": 0.2 },
                { "name": "ทุเรียน", "servingSize": "100 กรัม (1 เม็ดใหญ่)", "calories": 160, "protein": 2, "carbs": 28, "fat": 5 },
                { "name": "ขนุน", "servingSize": "4 ยวง", "calories": 95, "protein": 1.5, "carbs": 23, "fat": 0.4 },
                { "name": "แอปเปิล", "servingSize": "1 ลูก", "calories": 80, "protein": 0.4, "carbs": 21, "fat": 0.2 },
                { "name": "องุ่น", "servingSize": "15 ลูก", "calories": 70, "protein": 0.7, "carbs": 18, "fat": 0.2 },
                { "name": "กีวี", "servingSize": "1 ลูก", "calories": 45, "protein": 0.8, "carbs": 10, "fat": 0.4 }
            ]
        },
        {
            "id": "drinks",
            "name": "🥤 เครื่องดื่ม",
            "foods": [
                { "name": "น้ำเปล่า", "servingSize": "1 แก้ว", "calories": 0, "protein": 0, "carbs": 0, "fat": 0 },
                { "name": "น้ำอัดลม", "servingSize": "325 มล.", "calories": 140, "protein": 0, "carbs": 35, "fat": 0 },
                { "name": "โค้ก", "servingSize": "325 มล.", "calories": 140, "protein": 0, "carbs": 35, "fat": 0 },
                { "name": "เป๊ปซี่", "servingSize": "325 มล.", "calories": 140, "protein": 0, "carbs": 35, "fat": 0 },
                { "name": "สไปรท์", "servingSize": "325 มล.", "calories": 140, "protein": 0, "carbs": 35, "fat": 0 },
                { "name": "แฟนต้า", "servingSize": "325 มล.", "calories": 150, "protein": 0, "carbs": 38, "fat": 0 },
                { "name": "ชาไทย", "servingSize": "1 แก้ว", "calories": 250, "protein": 3, "carbs": 40, "fat": 8 },
                { "name": "ชาเขียว", "servingSize": "1 แก้ว (ชงนม)", "calories": 220, "protein": 4, "carbs": 36, "fat": 6 },
                { "name": "ชานมไข่มุก", "servingSize": "1 แก้ว", "calories": 350, "protein": 4, "carbs": 62, "fat": 9 },
                { "name": "ชามะนาว", "servingSize": "1 แก้ว", "calories": 120, "protein": 0, "carbs": 30, "fat": 0 },
                { "name": "กาแฟดำ (Americano ไม่หวาน)", "servingSize": "1 แก้ว", "calories": 10, "protein": 0.5, "carbs": 2, "fat": 0 },
                { "name": "กาแฟเย็น", "servingSize": "1 แก้ว", "calories": 180, "protein": 2, "carbs": 28, "fat": 6 },
                { "name": "เอสเปรสโซ่เย็น", "servingSize": "1 แก้ว", "calories": 220, "protein": 4, "carbs": 32, "fat": 8 },
                { "name": "ลาเต้", "servingSize": "1 แก้ว", "calories": 160, "protein": 6, "carbs": 18, "fat": 7 },
                { "name": "คาปูชิโน่", "servingSize": "1 แก้ว", "calories": 160, "protein": 6, "carbs": 18, "fat": 7 },
                { "name": "มอคค่า", "servingSize": "1 แก้ว", "calories": 230, "protein": 6, "carbs": 32, "fat": 8 },
                { "name": "โกโก้เย็น", "servingSize": "1 แก้ว", "calories": 220, "protein": 5, "carbs": 32, "fat": 8 },
                { "name": "โอวัลติน", "servingSize": "1 แก้ว", "calories": 210, "protein": 5, "carbs": 32, "fat": 7 },
                { "name": "นมสด", "servingSize": "200 มล.", "calories": 130, "protein": 7, "carbs": 10, "fat": 7 },
                { "name": "นมถั่วเหลือง", "servingSize": "250 มล.", "calories": 140, "protein": 8, "carbs": 14, "fat": 5 },
                { "name": "น้ำส้ม", "servingSize": "1 แก้ว", "calories": 110, "protein": 1.5, "carbs": 26, "fat": 0 },
                { "name": "น้ำมะพร้าว", "servingSize": "1 ลูก", "calories": 90, "protein": 1, "carbs": 20, "fat": 0.5 }
            ]
        },
        {
            "id": "desserts",
            "name": "🍨 ของหวาน",
            "foods": [
                { "name": "ข้าวเหนียวมะม่วง", "servingSize": "1 จาน", "calories": 450, "protein": 6, "carbs": 78, "fat": 13 },
                { "name": "บัวลอย", "servingSize": "1 ถ้วย", "calories": 280, "protein": 4, "carbs": 45, "fat": 10 },
                { "name": "ลอดช่อง", "servingSize": "1 ถ้วย", "calories": 260, "protein": 2, "carbs": 45, "fat": 8 },
                { "name": "ทับทิมกรอบ", "servingSize": "1 ถ้วย", "calories": 290, "protein": 2, "carbs": 50, "fat": 9 },
                { "name": "สลิ่ม", "servingSize": "1 ถ้วย", "calories": 270, "protein": 2, "carbs": 46, "fat": 9 },
                { "name": "เฉาก๊วย", "servingSize": "1 ถ้วย", "calories": 120, "protein": 1, "carbs": 29, "fat": 0 },
                { "name": "เต้าส่วน", "servingSize": "1 ถ้วย", "calories": 240, "protein": 6, "carbs": 42, "fat": 5 },
                { "name": "ถั่วแปบ", "servingSize": "1 กล่อง", "calories": 260, "protein": 6, "carbs": 46, "fat": 6 },
                { "name": "กล้วยบวชชี", "servingSize": "1 ถ้วย", "calories": 280, "protein": 3, "carbs": 44, "fat": 10 },
                { "name": "ฟักทองแกงบวด", "servingSize": "1 ถ้วย", "calories": 250, "protein": 3, "carbs": 38, "fat": 9 },
                { "name": "ไอศกรีมกะทิ", "servingSize": "1 ถ้วย", "calories": 240, "protein": 3, "carbs": 28, "fat": 13 },
                { "name": "ไอศกรีมวานิลลา", "servingSize": "1 ลูก", "calories": 180, "protein": 3, "carbs": 22, "fat": 9 },
                { "name": "ไอศกรีมช็อกโกแลต", "servingSize": "1 ลูก", "calories": 190, "protein": 3, "carbs": 24, "fat": 9 },
                { "name": "เค้กช็อกโกแลต", "servingSize": "1 ชิ้น", "calories": 360, "protein": 5, "carbs": 46, "fat": 18 },
                { "name": "เค้กส้ม", "servingSize": "1 ชิ้น", "calories": 310, "protein": 4, "carbs": 44, "fat": 13 }
            ]
        },
        {
            "id": "packaged_snacks",
            "name": "🍿 ขนมขบเคี้ยวและซอง",
            "foods": [
                { "name": "เลย์ (Lay's) มันฝรั่งทอด ซองเล็ก", "servingSize": "1 ซอง (27-30 กรัม)", "calories": 160, "protein": 2, "carbs": 15, "fat": 10 },
                { "name": "เลย์ (Lay's) มันฝรั่งทอด ซองกลาง", "servingSize": "1 ซอง (46-50 กรัม)", "calories": 260, "protein": 3, "carbs": 26, "fat": 16 },
                { "name": "เลย์ สแตคส์ (Lay's Stax) กระป๋อง", "servingSize": "1 เสิร์ฟ (25 กรัม)", "calories": 130, "protein": 1.5, "carbs": 15, "fat": 7 },
                { "name": "สแน็คแจ๊ค (Snack Jack) ขนมถั่วลันเตาอบกรอบ", "servingSize": "1 ซองเล็ก (35 กรัม)", "calories": 180, "protein": 4, "carbs": 21, "fat": 9 },
                { "name": "สแน็คแจ๊ค (Snack Jack) ขนมถั่วลันเตา ซองใหญ่", "servingSize": "1 ซองใหญ่ (65 กรัม)", "calories": 330, "protein": 7, "carbs": 39, "fat": 16 },
                { "name": "คาลบี้ (Calbee) ข้าวเกรียบถั่วลันเตา", "servingSize": "1 ซอง (32 กรัม)", "calories": 160, "protein": 4.5, "carbs": 19, "fat": 7.5 },
                { "name": "กรีนนัท (Green Nut) ถั่วลันเตาอบกรอบ", "servingSize": "1 ซอง (30 กรัม)", "calories": 140, "protein": 6, "carbs": 15, "fat": 6 },
                { "name": "โก๋แก่ ถั่วลิสงเคลือบกะทิ/รสไก่", "servingSize": "1 ซอง (40 กรัม)", "calories": 220, "protein": 8, "carbs": 16, "fat": 14 },
                { "name": "ตะวัน (Tawan) ข้าวเกรียบ", "servingSize": "1 ซอง (28 กรัม)", "calories": 140, "protein": 2, "carbs": 18, "fat": 7 },
                { "name": "ฮานามิ (Hanami) ข้าวเกรียบกุ้ง", "servingSize": "1 ซอง (30 กรัม)", "calories": 140, "protein": 2, "carbs": 22, "fat": 5 },
                { "name": "สาหร่ายทอด เถ้าแก่น้อย", "servingSize": "1 ซอง (14 กรัม)", "calories": 100, "protein": 1.5, "carbs": 3, "fat": 9 },
                { "name": "สาหร่ายอบ/ย่าง เถ้าแก่น้อย", "servingSize": "1 ซอง (5 กรัม)", "calories": 20, "protein": 1, "carbs": 3, "fat": 0.2 },
                { "name": "เบนโตะ (Bento) ปลาหมึกอบทรงเครื่อง", "servingSize": "1 ซอง (18 กรัม)", "calories": 70, "protein": 5, "carbs": 11, "fat": 0.5 },
                { "name": "ทาโร่ (Taro) ปลาสวรรค์", "servingSize": "1 ซอง (30 กรัม)", "calories": 100, "protein": 8, "carbs": 16, "fat": 0.5 },
                { "name": "คอนเน่ (Cornae) ข้าวโพดอบกรอบ", "servingSize": "1 ซอง (28 กรัม)", "calories": 150, "protein": 1.5, "carbs": 18, "fat": 8 },
                { "name": "โปเต้ (Pote) มันฝรั่งเกลียวกรอบ", "servingSize": "1 ซอง (30 กรัม)", "calories": 160, "protein": 2, "carbs": 19, "fat": 9 },
                { "name": "ปาปริก้า (Paprika) มันฝรั่งกรอบ", "servingSize": "1 ซอง (30 กรัม)", "calories": 160, "protein": 2, "carbs": 19, "fat": 9 },
                { "name": "ป๊อกกี้ (Pocky) ช็อกโกแลต", "servingSize": "1 กล่อง (45 กรัม)", "calories": 230, "protein": 4, "carbs": 31, "fat": 10 },
                { "name": "เพรทซ์ (Pretz) รสลาบ/ข้าวโพด", "servingSize": "1 กล่อง (37 กรัม)", "calories": 180, "protein": 4, "carbs": 25, "fat": 7 },
                { "name": "โอริโอ้ (Oreo) คุกกี้สอดไส้ครีม", "servingSize": "1 ซอง (3 ชิ้น / 28 กรัม)", "calories": 140, "protein": 1.5, "carbs": 20, "fat": 6 },
                { "name": "ป๊อปคอร์น (Popcorn) รสเค็ม/เนย", "servingSize": "1 ถุงเล็ก (30 กรัม)", "calories": 150, "protein": 3, "carbs": 18, "fat": 7.5 },
                { "name": "ป๊อปคอร์น (Popcorn) คาราเมล", "servingSize": "1 ถุงเล็ก (40 กรัม)", "calories": 190, "protein": 2, "carbs": 28, "fat": 8 },
                { "name": "เจเล่ บิวตี้ (Jele Beautie) เยลลี่", "servingSize": "1 ถุง (150 กรัม)", "calories": 40, "protein": 0, "carbs": 10, "fat": 0 }
            ]
        }
    ]
};

// Expose explicitly for window / global access
window.MEAL_CONFIG = MEAL_CONFIG;
window.WORKOUT_PRESETS = WORKOUT_PRESETS;
window.DEFAULT_MEAL_COMBOS = DEFAULT_MEAL_COMBOS;
window.DEFAULT_SUPPLEMENTS = DEFAULT_SUPPLEMENTS;
window.FOOD_DATABASE = FOOD_DATABASE;
