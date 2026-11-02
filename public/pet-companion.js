/**
 * NovaFit Pro - Fitness Pet Companion & Evolution Engine (v5.9.32)
 * 
 * Features:
 * 1. 3 Pet Species:
 *    - Blaze: Sparky (Fire / Speed & Cardio)
 *    - Titan: Rocky (Earth & Stone / Strength & Power)
 *    - Zen: Dewy (Nature & Water / Balance & Wellness)
 * 2. 5 Evolution Stages:
 *    - Stage 1: Day 1 (Mystery Egg)
 *    - Stage 2: Day 3 (Newborn)
 *    - Stage 3: Day 7 (Playful Juvenile)
 *    - Stage 4: Day 21 (Full Adult)
 *    - Stage 5: Day 60+ (Legendary Form)
 * 3. Mystery Silhouette Card of the Next Evolution stage.
 * 4. Active Days tracking (Option A: unique active dates, never resets).
 * 5. Pet locking until Stage 5 (Day 60+) is achieved before switching.
 */

(function () {
    'use strict';

    // Collectible TCG Rarity Tiers Configuration (5 Evolution Stages)
    const RARITY_TIERS = {
        1: {
            stage: 1,
            dayReq: 1,
            tierKey: 'common',
            nameEn: 'COMMON',
            nameTh: 'ระดับทั่วไป (Common)',
            stars: '★☆☆☆☆',
            starsCount: 1,
            symbol: '✦',
            badgeBg: 'bg-stone-700/90 text-stone-200 border-stone-500/70',
            badgeColor: 'text-stone-300',
            borderClass: 'border-stone-500/70',
            cardBorder: 'border-2 border-stone-400/80 ring-1 ring-stone-600/50',
            glowStyle: 'box-shadow: 0 0 15px rgba(120, 113, 108, 0.35);',
            cornerColor: 'text-stone-300',
            accentGradient: 'from-stone-500 to-stone-700',
            frameClass: 'tcg-frame-common',
            foilClass: '',
            perkTh: '✦ EXP คู่หู +5% • สมาธิเริ่มต้น',
            collectorCode: 'COM-01',
            ribbonGradient: 'from-stone-600 via-stone-500 to-stone-700'
        },
        2: {
            stage: 2,
            dayReq: 3,
            tierKey: 'uncommon',
            nameEn: 'UNCOMMON',
            nameTh: 'ระดับพิเศษ (Uncommon)',
            stars: '★★☆☆☆',
            starsCount: 2,
            symbol: '✦✦',
            badgeBg: 'bg-emerald-800/90 text-emerald-100 border-emerald-400/70',
            badgeColor: 'text-emerald-300',
            borderClass: 'border-emerald-500/70',
            cardBorder: 'border-2 border-slate-300 ring-2 ring-emerald-400/40',
            glowStyle: 'box-shadow: 0 0 20px rgba(52, 211, 153, 0.4);',
            cornerColor: 'text-emerald-300',
            accentGradient: 'from-emerald-500 to-teal-700',
            frameClass: 'tcg-frame-uncommon',
            foilClass: 'tcg-silver-sheen',
            perkTh: '✦ ความอดทน +10% • วินัยแรกเกิด',
            collectorCode: 'UNC-02',
            ribbonGradient: 'from-teal-600 via-emerald-500 to-teal-700'
        },
        3: {
            stage: 3,
            dayReq: 7,
            tierKey: 'rare',
            nameEn: 'RARE',
            nameTh: 'ระดับหายาก (Rare)',
            stars: '★★★☆☆',
            starsCount: 3,
            symbol: '✦✦✦',
            badgeBg: 'bg-amber-600/95 text-amber-100 border-amber-300/90 shadow-xs',
            badgeColor: 'text-amber-300',
            borderClass: 'border-amber-400',
            cardBorder: 'border-2 border-amber-400 ring-2 ring-amber-400/50',
            glowStyle: 'box-shadow: 0 0 25px rgba(251, 191, 36, 0.55), inset 0 0 15px rgba(251, 191, 36, 0.2);',
            cornerColor: 'text-amber-300',
            accentGradient: 'from-amber-400 to-orange-600',
            frameClass: 'tcg-frame-rare',
            foilClass: 'tcg-gold-pulse',
            perkTh: '✦ กำลังใจ +15% • พลังธาตุตื่นรู้',
            collectorCode: 'RAR-03',
            ribbonGradient: 'from-amber-500 via-yellow-400 to-amber-600'
        },
        4: {
            stage: 4,
            dayReq: 21,
            tierKey: 'epic',
            nameEn: 'EPIC',
            nameTh: 'ระดับมหากาพย์ (Epic)',
            stars: '★★★★☆',
            starsCount: 4,
            symbol: '✦✦✦✦',
            badgeBg: 'bg-purple-800/95 text-purple-100 border-purple-400/90 shadow-md',
            badgeColor: 'text-purple-300',
            borderClass: 'border-purple-400',
            cardBorder: 'border-2 border-purple-400 ring-4 ring-purple-500/40',
            glowStyle: 'box-shadow: 0 0 30px rgba(168, 85, 247, 0.65), inset 0 0 20px rgba(216, 180, 254, 0.25);',
            cornerColor: 'text-purple-300',
            accentGradient: 'from-purple-500 to-indigo-700',
            frameClass: 'tcg-frame-epic',
            foilClass: 'tcg-amethyst-prism',
            perkTh: '✦ ออร่าขั้นสูง +20% • กายาแกร่งกล้า',
            collectorCode: 'EPC-04',
            ribbonGradient: 'from-purple-600 via-fuchsia-500 to-indigo-600'
        },
        5: {
            stage: 5,
            dayReq: 60,
            tierKey: 'legendary',
            nameEn: 'MYTHIC LEGENDARY',
            nameTh: 'ระดับตำนานสูงสุด (Mythic Legendary)',
            stars: '★★★★★',
            starsCount: 5,
            symbol: '★ MYTHIC ★',
            badgeBg: 'bg-gradient-to-r from-amber-400 via-rose-500 to-purple-600 text-white font-extrabold border-2 border-amber-200 shadow-lg',
            badgeColor: 'text-amber-300',
            borderClass: 'border-amber-300',
            cardBorder: 'border-3 border-amber-300 ring-4 ring-rose-500/50',
            glowStyle: 'box-shadow: 0 0 35px rgba(245, 158, 11, 0.85), 0 0 65px rgba(244, 63, 94, 0.5);',
            cornerColor: 'text-amber-300',
            accentGradient: 'from-amber-400 via-rose-500 to-purple-600',
            frameClass: 'tcg-frame-legendary',
            foilClass: 'tcg-holo-rainbow',
            perkTh: '👑 ร่างจุติสูงสุด • จิตวิญญาณแห่งความฟิตไร้ขีดจำกัด',
            collectorCode: 'MYTH-05',
            ribbonGradient: 'from-amber-400 via-rose-500 to-purple-600'
        }
    };

    // Pet Codex Configuration & Master Database
    const PET_DATA = {
        blaze: {
            id: 'blaze',
            nickname: 'Sparky',
            nicknameTh: 'สปาร์กี้',
            element: 'fire',
            elementIcon: '🔥',
            title: 'สายเบิร์น & คาร์ดิโอ (Fire / Speed & Cardio)',
            concept: 'กระต่าย/จิ้งจอกไฟ เปี่ยมพลังงาน ว่องไว จุดประกายการขยับร่างกายและเบิร์นแคลอรี่',
            gradient: 'from-amber-500 via-orange-500 to-rose-500',
            glowColor: 'rgba(249, 115, 22, 0.45)',
            borderClass: 'border-orange-500/40',
            badgeBg: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30',
            quotes: [
                'ฟิตปึ๋งปั๋ง! มาขยับร่างกายเบิร์นไขมันกันเถอะ 🔥',
                'สปาร์กี้พร้อมวิ่งคาร์ดิโอแล้ว! ลุยเลยมั้ย? 🏃‍♂️',
                'ทุกก้าวของการเดินคือพลังงานความร้อนที่จุดประกาย! ⚡',
                'ไฟแห่งความมุ่งมั่นลุกโชน ไม่มีอะไรหยุดเราได้! 💥',
                'วันนี้ขยับร่างกายไปกี่นาทีแล้ว? มาเบิร์นไปด้วยกันนะ!'
            ],
            stages: [
                {
                    stage: 1,
                    dayReq: 1,
                    title: 'Ember Egg',
                    stageNameTh: 'ไข่ปริศนา (Stage 1)',
                    card: 'pets/Blaze/Card/1_Ember Egg_Blaze_Card.jpg',
                    gif: 'pets/Blaze/Gif/1_Ember Egg_Blaze.gif',
                    desc: 'ไข่เพลิงอุ่นระอุที่รอการตื่นขึ้น สะสมพลังงานความร้อนจากการขยับร่างกายและเบิร์นแคลอรี่',
                    hint: 'เปลวไฟระยิบระยับเต้นอยู่ในไข่ กำลังรอวันฟักเป็นลูกจิ้งจอกเพลิงน้อย!'
                },
                {
                    stage: 2,
                    dayReq: 3,
                    title: 'Cinderpaw',
                    stageNameTh: 'แรกเกิด (Stage 2)',
                    card: 'pets/Blaze/Card/2_Cinderpaw_ Blaze_Card.jpg',
                    gif: 'pets/Blaze/Gif/2_Cinderpaw_ Blaze.gif',
                    desc: 'จิ้งจอกเพลิงน้อยแรกเกิด ขี้เล่นและกระตือรือร้น จุดประกายคาร์ดิโอทุกย่างก้าว',
                    hint: 'เจ้าตัวเล็กกำลังเติบโตและวิ่งเล่นซุกซน เตรียมทะยานสู่ความเร็วที่สูงขึ้น!'
                },
                {
                    stage: 3,
                    dayReq: 7,
                    title: 'Blazerunner',
                    stageNameTh: 'วัยซน (Stage 3)',
                    card: 'pets/Blaze/Card/3_Blazerunner_ Blaze_Card.jpg',
                    gif: 'pets/Blaze/Gif/3_Blazerunner_ Blaze.gif',
                    desc: 'จิ้งจอกเปลวไฟวัยซน ฝีเท้าเร็วดั่งสายลม เบิร์นแคลอรี่อย่างทรงพลัง',
                    hint: 'สายลมร้อนพัดหมุนวน ฝีเท้าเร็วจัดจ้านใกล้ก้าวสู่ร่างจิ้งจอกเพลิงที่โตเต็มวัย!'
                },
                {
                    stage: 4,
                    dayReq: 21,
                    title: 'Ignifox',
                    stageNameTh: 'โตเต็มวัย (Stage 4)',
                    card: 'pets/Blaze/Card/4_Ignifox_ Blaze_Card.jpg',
                    gif: 'pets/Blaze/Gif/4_Ignifox_ Blaze.gif',
                    desc: 'จิ้งจอกเพลิงสง่างาม ปราดเปรียว วิ่งทะยานทะลุขีดจำกัดความเร็ว',
                    hint: 'ประกายเพลิงสีทองเจิดจ้า ร่างในตำนานระดับฟีนิกซ์สุริยันกำลังรอคุณอยู่ที่ 60 วัน!'
                },
                {
                    stage: 5,
                    dayReq: 60,
                    title: 'Solareon Phoenix',
                    stageNameTh: 'ร่างตำนาน (Stage 5)',
                    card: 'pets/Blaze/Card/5_Solareon Phoenix_ Blaze_Card.jpg',
                    gif: 'pets/Blaze/Gif/5_Solareon Phoenix_ Blaze.gif',
                    desc: 'ร่างจุติฟีนิกซ์สุริยันในตำนาน เปลวเพลิงศักดิ์สิทธิ์ เผาผลาญไขมันและจุดประกายความฟิตไร้ที่สิ้นสุด',
                    hint: 'ร่างในตำนานสูงสุดแห่งเพลิงสุริยัน บรรลุขีดสุดความฟิตระดับมาสเตอร์พีซ!'
                }
            ]
        },
        titan: {
            id: 'titan',
            nickname: 'Rocky',
            nicknameTh: 'ร็อคกี้',
            element: 'earth',
            elementIcon: '🪨',
            title: 'สายพลัง & สร้างกล้ามเนื้อ (Earth & Stone / Strength & Power)',
            concept: 'หมีศิลาเกราะหิน หนักแน่น มั่นคง ตัวแทนของวินัยและพลังกายที่แข็งแกร่ง',
            gradient: 'from-amber-700 via-stone-600 to-emerald-800',
            glowColor: 'rgba(217, 119, 6, 0.45)',
            borderClass: 'border-amber-600/40',
            badgeBg: 'bg-stone-500/15 text-stone-700 dark:text-stone-300 border border-stone-500/30',
            quotes: [
                'กล้ามเนื้อแน่นปั้ก! ยกเวทแล้วอย่าลืมกินโปรตีนให้ถึงนะ 🪨',
                'วินัยคือหัวใจของความแข็งแกร่ง หนักแน่นดุจภูผา! 💪',
                'ทุกหยดเหงื่อในวันนี้ คือกล้ามเนื้อที่คมชัดในวันพรุ่งนี้ 🛡️',
                'ร็อคกี้พร้อมเป็นสปอตเตอร์ให้คุณเสมอ ลุยให้สุดเซ็ต! 🏋️‍♂️',
                'ร่างกายที่แข็งแกร่ง สร้างขึ้นจากวินัยที่สม่ำเสมอ!'
            ],
            stages: [
                {
                    stage: 1,
                    dayReq: 1,
                    title: 'Geode Egg',
                    stageNameTh: 'ไข่ปริศนา (Stage 1)',
                    card: 'pets/Titan/Card/1_Geode Egg_Titan_Card.jpg',
                    gif: 'pets/Titan/Gif/1_Geode Egg_Titan.gif',
                    desc: 'ไข่ผลึกหินผาอันแข็งแกร่ง กักเก็บพลังมหาศาลรอวันตื่นขึ้นเพื่อสร้างกล้ามเนื้อ',
                    hint: 'แรงสั่นสะเทือนในผลึกศิลา หมีน้อยเกราะหินกำลังจะลืมตาดูโลก!'
                },
                {
                    stage: 2,
                    dayReq: 3,
                    title: 'Pebblecub',
                    stageNameTh: 'แรกเกิด (Stage 2)',
                    card: 'pets/Titan/Card/2_Pebblecub_Titan_Card.jpg',
                    gif: 'pets/Titan/Gif/2_Pebblecub_Titan.gif',
                    desc: 'ลูกหมีศิลาน้อย ตัวแน่นแข็งแรง พร้อมร่วมยกน้ำหนักสร้างวินัยและความแกร่ง',
                    hint: 'กล้ามเนื้อและเกราะหินเริ่มหนาขึ้น กำลังเตรียมพร้อมยกของหนักในวัยซน!'
                },
                {
                    stage: 3,
                    dayReq: 7,
                    title: 'Bouldergrip',
                    stageNameTh: 'วัยซน (Stage 3)',
                    card: 'pets/Titan/Card/3_Bouldergrip_Titan_Card.jpg',
                    gif: 'pets/Titan/Gif/3_Bouldergrip_Titan.gif',
                    desc: 'หมีหินวัยคะนอง กล้ามเนื้อแน่นหนา ยึดมั่นในวินัยเวทเทรนนิ่งและการกินโปรตีน',
                    hint: 'พลังหมัดหินผาทรงพลัง ยักษ์ใหญ่โกไลแอทกำลังจะตื่นขึ้นในร่างโตเต็มวัย!'
                },
                {
                    stage: 4,
                    dayReq: 21,
                    title: 'Goliath Titan',
                    stageNameTh: 'โตเต็มวัย (Stage 4)',
                    card: 'pets/Titan/Card/4_Goliath Titan_Card.jpg',
                    gif: 'pets/Titan/Gif/4_Goliath Titan.gif',
                    desc: 'ยักษ์ศิลาผู้ทรงพลัง เกราะหินแกร่งดุจภูผา พลังกล้ามเนื้อเต็มพิกัด',
                    hint: 'เกราะทองคำศักดิ์สิทธิ์และพลังปกป้องระดับตำนาน Aegis Colossus รอคุณอยู่ที่ 60 วัน!'
                },
                {
                    stage: 5,
                    dayReq: 60,
                    title: 'Aegis Colossus',
                    stageNameTh: 'ร่างตำนาน (Stage 5)',
                    card: 'pets/Titan/Card/5_Aegis Colossus_Titan_Card.jpg',
                    gif: 'pets/Titan/Gif/5_Aegis Colossus_Titan.gif',
                    desc: 'มหาเทวรูปศิลาแห่งการปกป้องในตำนาน พลังกล้ามเนื้อและวินัยเหล็กกล้าไร้เทียมทาน',
                    hint: 'ร่างในตำนานสูงสุดแห่งเกราะศิลา วินัยและความแข็งแกร่งระดับสูงสุด!'
                }
            ]
        },
        zen: {
            id: 'zen',
            nickname: 'Dewy',
            nicknameTh: 'ดิวอี้',
            element: 'nature-water',
            elementIcon: '💧🌿',
            title: 'สายสมดุล & โภชนาการ (Nature & Water / Balance & Wellness)',
            concept: 'เพนกวินพฤกษาผสานสายน้ำ นุ่มนวล สดชื่น ตัวแทนของการดื่มน้ำ พักผ่อน และคุมอาหาร',
            gradient: 'from-teal-500 via-emerald-500 to-cyan-500',
            glowColor: 'rgba(20, 184, 166, 0.45)',
            borderClass: 'border-teal-500/40',
            badgeBg: 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-500/30',
            quotes: [
                'จิบน้ำวันละนิด สดชื่นแจ่มใส ร่างกายสดชื่นตลอดวัน 💧',
                'สมดุลที่ดีคือกุญแจสู่สุขภาพที่ยืนยาวและมีความสุข 🌿',
                'คุมอาหารอย่างพอดี ไม่ตึงไม่หย่อนเกินไปนะ 🥗',
                'อย่าลืมพักผ่อนและนอนหลับให้เต็มอิ่ม ดิวอี้คอยดูแลอยู่! 🧘',
                'จิตใจที่สงบ ย่อมนำมาซึ่งร่างกายที่สมดุลและผ่อนคลาย ✨'
            ],
            stages: [
                {
                    stage: 1,
                    dayReq: 1,
                    title: 'Sprout Egg',
                    stageNameTh: 'ไข่ปริศนา (Stage 1)',
                    card: 'pets/Zen/Card/1_Sprout Egg_Zen_Card.jpg',
                    gif: 'pets/Zen/Gif/1_Sprout Egg_Zen.gif',
                    desc: 'ไข่พฤกษาสีมรกต ชุ่มฉ่ำด้วยหยดน้ำค้างบริสุทธิ์ ตัวแทนแห่งความสมดุลกายและใจ',
                    hint: 'หยาดน้ำค้างบริสุทธิ์เปล่งประกาย เพนกวินน้อยกำลังจะฟักออกมาเตือนให้คุณดื่มน้ำ!'
                },
                {
                    stage: 2,
                    dayReq: 3,
                    title: 'Pipdew',
                    stageNameTh: 'แรกเกิด (Stage 2)',
                    card: 'pets/Zen/Card/2_Pipdew_Zen_Card.jpg',
                    gif: 'pets/Zen/Gif/2_Pipdew_Zen.gif',
                    desc: 'เพนกวินน้อยหยาดน้ำค้าง นุ่มฟู อารมณ์ดี เตือนให้ดื่มน้ำและพักผ่อนอย่างเพียงพอ',
                    hint: 'ใบบัวเริ่มแตกหน่อ เจ้าเพนกวินน้อยเตรียมว่ายน้ำเข้าสู่วัยซน!'
                },
                {
                    stage: 3,
                    dayReq: 7,
                    title: 'Zenquin',
                    stageNameTh: 'วัยซน (Stage 3)',
                    card: 'pets/Zen/Card/3_Zenquin_Zen_Card.jpg',
                    gif: 'pets/Zen/Gif/3_Zenquin_Zen.gif',
                    desc: 'เพนกวินพฤกษาวัยสดใส ว่ายน้ำคล่องแคล่ว คุมอาหารและสร้างสมดุลกายใจ',
                    hint: 'บัวหลวงเบ่งบาน ดิวอี้กำลังจะสยายปีกสู่หงส์เพนกวินบงกชผู้สง่างาม!'
                },
                {
                    stage: 4,
                    dayReq: 21,
                    title: 'Lotoswimmer',
                    stageNameTh: 'โตเต็มวัย (Stage 4)',
                    card: 'pets/Zen/Card/4_Lotoswimmer_Zen_Card.jpg',
                    gif: 'pets/Zen/Gif/4_Lotoswimmer_Zen.gif',
                    desc: 'หงส์เพนกวินบงกชสง่างาม โภชนาการสมบูรณ์แบบ จิตใจสงบ ร่างกายสดชื่น',
                    hint: 'ปีกแสงทิพย์มหาเทวากำลังจะปรากฏ ร่างในตำนาน Celestial Seraph รออยู่ที่ 60 วัน!'
                },
                {
                    stage: 5,
                    dayReq: 60,
                    title: 'Celestial Seraph',
                    stageNameTh: 'ร่างตำนาน (Stage 5)',
                    card: 'pets/Zen/Card/5_Celestial Seraph_Zen_Card.jpg',
                    gif: 'pets/Zen/Gif/5_Celestial Seraph_Zen.gif',
                    desc: 'มหาเทวะปักษาพฤกษาสายน้ำในตำนาน ความสมดุลสมบูรณ์แบบ สุขภาพยืนยาวและจิตวิญญาณแห่งการฟื้นฟู',
                    hint: 'ร่างในตำนานสูงสุดแห่งความสมบูรณ์แบบ สุขภาพยืนยาวและสงบนิ่งดุจสายน้ำ!'
                }
            ]
        }
    };

    // Calculate Stage from Active Days
    function calculateStageIndex(days) {
        const d = Number(days) || 1;
        if (d >= 60) return 4; // Stage 5 (index 4)
        if (d >= 21) return 3; // Stage 4 (index 3)
        if (d >= 7) return 2;  // Stage 3 (index 2)
        if (d >= 3) return 1;  // Stage 2 (index 1)
        return 0;              // Stage 1 (index 0)
    }

    // Safe State Access & Initializer
    function getSafePetState() {
        if (!window.state) return null;
        const today = (typeof window.getTodayStr === 'function') ? window.getTodayStr() : new Date().toISOString().split('T')[0];
        if (!window.state.pet || typeof window.state.pet !== 'object' || !window.state.pet.v5933) {
            window.state.pet = {
                selectedPetId: null,
                activeDays: 1,
                activeDates: [today],
                unlockedPets: [],
                lastStageNotified: 1,
                v5933: true
            };
        }
        if (!Array.isArray(window.state.pet.activeDates)) {
            window.state.pet.activeDates = [today];
        }
        if (!Array.isArray(window.state.pet.unlockedPets)) {
            window.state.pet.unlockedPets = [];
        }
        window.state.pet.v5933 = true;
        return window.state.pet;
    }

    // Record Active Day (Option A: unique active dates, never resets)
    function trackPetActiveDay() {
        const petState = getSafePetState();
        if (!petState) return;
        const today = (typeof window.getTodayStr === 'function') ? window.getTodayStr() : new Date().toISOString().split('T')[0];

        if (!petState.activeDates.includes(today)) {
            petState.activeDates.push(today);
            petState.activeDays = petState.activeDates.length;
            checkPetEvolutionProgression();
            if (typeof window.saveState === 'function') {
                window.saveState();
            }
        } else {
            petState.activeDays = Math.max(petState.activeDates.length, Number(petState.activeDays) || 1);
        }
    }

    // Check Evolution and Celebrate
    function checkPetEvolutionProgression() {
        const petState = getSafePetState();
        if (!petState || !petState.selectedPetId) return;
        const pet = PET_DATA[petState.selectedPetId];
        if (!pet) return;

        const stageIdx = calculateStageIndex(petState.activeDays);
        const currentStageNum = stageIdx + 1;
        const lastNotified = Number(petState.lastStageNotified) || 1;

        if (currentStageNum > lastNotified) {
            petState.lastStageNotified = currentStageNum;
            const newStage = pet.stages[stageIdx];

            // Trigger Milestone Confetti & Sound
            if (typeof window.playSound === 'function') {
                window.playSound('celebrate');
            }
            if (typeof window.triggerCelebrationConfetti === 'function') {
                window.triggerCelebrationConfetti();
            }

            // If reached Stage 5, unlock pet switching
            if (currentStageNum === 5 && !petState.unlockedPets.includes(pet.id)) {
                petState.unlockedPets.push(pet.id);
            }

            // Display Celebration Toast / Banner
            if (typeof window.showToast === 'function') {
                window.showToast(`🎉 น้อง ${pet.nicknameTh} (${pet.nickname}) วิวัฒนาการเป็น "${newStage.title}" แล้ว! ✨`);
            }

            if (typeof window.showMilestoneBeatCard === 'function') {
                window.showMilestoneBeatCard({
                    icon: '🐣✨',
                    title: `วิวัฒนาการสำเร็จ! สู่ ${newStage.stageNameTh}`,
                    subtitle: `น้อง ${pet.nicknameTh} กลายร่างเป็น "${newStage.title}" แล้ว`,
                    detail: newStage.desc,
                    duration: 9000
                });
            }
        }
    }

    // Admin Detection Helper & Sandbox Engine
    function isPetAdmin() {
        if (window._forceAdminPetSandbox) return true;
        if (sessionStorage.getItem('novafit_admin_authed') === 'true' || localStorage.getItem('novafit_admin_authed') === 'true') return true;
        const email = (window.currentUser && window.currentUser.email) ||
                      (window.auth && window.auth.currentUser && window.auth.currentUser.email) || '';
        if (email && ['benznova01@gmail.com', 'parinya6969@gmail.com'].includes(email.toLowerCase())) return true;
        if (typeof window.isUserAdmin === 'function' && window.isUserAdmin !== isPetAdmin) {
            return window.isUserAdmin();
        }
        return false;
    }

    function isAdminPetSandboxActive() {
        return sessionStorage.getItem('novafit_pet_admin_real_backup') !== null;
    }

    function backupRealPetState() {
        if (!isAdminPetSandboxActive() && window.state && window.state.pet) {
            sessionStorage.setItem('novafit_pet_admin_real_backup', JSON.stringify(window.state.pet));
        }
    }

    function adminSetTestPet(petId, stageNum) {
        if (!PET_DATA[petId]) return;
        backupRealPetState();

        const pet = PET_DATA[petId];
        const s = Math.max(1, Math.min(5, Number(stageNum) || 1));
        const dayReqMap = { 1: 1, 2: 3, 3: 7, 4: 21, 5: 60 };
        const activeDays = dayReqMap[s];

        const petState = getSafePetState();
        if (petState) {
            petState.selectedPetId = petId;
            petState.activeDays = activeDays;
            petState.lastStageNotified = s;
            if (s === 5 && !petState.unlockedPets.includes(petId)) {
                petState.unlockedPets.push(petId);
            }
        }

        if (typeof window.saveState === 'function') {
            window.saveState();
        }

        renderPetCompanionWidget();
        openPetCodexModal();

        if (typeof window.playSound === 'function') {
            window.playSound('pop');
        }
        if (typeof window.showToast === 'function') {
            window.showToast(`🛠️ [Admin Sandbox] สลับเป็น ${pet.nicknameTh} ร่าง ${s} (${pet.stages[s - 1].title}) จำลอง: ${activeDays} วัน`);
        }
    }

    function adminRestoreRealPet() {
        const raw = sessionStorage.getItem('novafit_pet_admin_real_backup');
        if (!raw) {
            if (typeof window.showToast === 'function') {
                window.showToast('ℹ️ ปัจจุบันอยู่ในสถานะจริงอยู่แล้ว (ไม่มีข้อมูลทดสอบที่ค้างอยู่)');
            }
            return;
        }

        try {
            const realPet = JSON.parse(raw);
            sessionStorage.removeItem('novafit_pet_admin_real_backup');
            if (window.state) {
                window.state.pet = realPet;
            }
            if (typeof window.saveState === 'function') {
                window.saveState();
            }
            renderPetCompanionWidget();
            openPetCodexModal();

            if (typeof window.playSound === 'function') {
                window.playSound('celebrate');
            }
            if (typeof window.showToast === 'function') {
                window.showToast('✓ คืนค่าสัตว์เลี้ยงและวันที่สะสมจริงของแอดมินเรียบร้อยแล้ว!');
            }
        } catch (e) {
            console.error('Failed to restore real pet state:', e);
        }
    }

    // Admin / User Reset Pet State to Fresh Starter
    function adminResetPetToFresh() {
        sessionStorage.removeItem('novafit_pet_admin_real_backup');
        if (window.state) {
            const today = (typeof window.getTodayStr === 'function') ? window.getTodayStr() : new Date().toISOString().split('T')[0];
            window.state.pet = {
                selectedPetId: null,
                activeDays: 1,
                activeDates: [today],
                unlockedPets: [],
                lastStageNotified: 1,
                v5933: true
            };
        }
        if (typeof window.saveState === 'function') {
            window.saveState();
        }
        if (typeof window.triggerCloudSync === 'function') {
            window.triggerCloudSync(true);
        }
        closePetCodexModal();
        renderPetCompanionWidget();
        if (typeof window.showToast === 'function') {
            window.showToast('🗑️ ลบสถานะสัตว์เลี้ยงแล้ว! กลับสู่หน้าเลือกฟักไข่เริ่มต้น');
        }
        setTimeout(() => {
            openPetStarterModal();
        }, 250);
    }

    function adminTriggerEvolutionTest() {
        if (typeof window.playSound === 'function') window.playSound('celebrate');
        if (typeof window.triggerCelebrationConfetti === 'function') window.triggerCelebrationConfetti();
        if (typeof window.showToast === 'function') {
            window.showToast('🎉 [Admin Sandbox] จำลองเอฟเฟกต์วิวัฒนาการสำเร็จ! ✨');
        }
    }

    function openAdminPetSandbox() {
        backupRealPetState();
        const petState = getSafePetState();
        if (!petState.selectedPetId) {
            petState.selectedPetId = 'blaze';
            petState.activeDays = 1;
        }
        openPetCodexModal();
    }

    // Render Hero Pet Widget on Dashboard (Position 1: Top of colDesktopLeft)
    function renderPetCompanionWidget() {
        const container = document.getElementById('card_pet_companion');
        if (!container) return;

        trackPetActiveDay();
        const petState = getSafePetState();

        // 1. Unselected State: Show Starter Call to Action
        if (!petState || !petState.selectedPetId || !PET_DATA[petState.selectedPetId]) {
            container.innerHTML = `
                <div class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-teal-500/10 border border-amber-500/30 p-3.5 sm:p-5 shadow-sm transition hover:shadow-md">
                    <div class="flex flex-col sm:flex-row items-center justify-between gap-3.5 sm:gap-4">
                        <div class="flex flex-col sm:flex-row items-center gap-3 sm:gap-3.5 text-center sm:text-left w-full min-w-0">
                            <div class="relative flex -space-x-2.5 shrink-0 mx-auto sm:mx-0">
                                <img src="pets/Blaze/Gif/1_Ember Egg_Blaze.gif" alt="Blaze Egg" class="w-10 h-10 sm:w-12 sm:h-12 object-contain drop-shadow animate-bounce">
                                <img src="pets/Titan/Gif/1_Geode Egg_Titan.gif" alt="Titan Egg" class="w-10 h-10 sm:w-12 sm:h-12 object-contain drop-shadow animate-bounce" style="animation-delay: 0.2s">
                                <img src="pets/Zen/Gif/1_Sprout Egg_Zen.gif" alt="Zen Egg" class="w-10 h-10 sm:w-12 sm:h-12 object-contain drop-shadow animate-bounce" style="animation-delay: 0.4s">
                            </div>
                            <div class="min-w-0 flex-1">
                                <div class="flex items-center justify-center sm:justify-start gap-1.5 flex-wrap">
                                    <span class="text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                        ✨ ฟีเจอร์ใหม่
                                    </span>
                                    <h3 class="font-extrabold text-sm sm:text-base text-slate-800 dark:text-slate-100">
                                        สัตว์เลี้ยงคู่หูฟิตเนส (Pet Companion)
                                    </h3>
                                </div>
                                <p class="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto sm:mx-0 break-words">
                                    เลือกคู่หู 1 ใน 3 ธาตุ (Sparky 🔥 / Rocky 🪨 / Dewy 💧🌿) เพื่อร่วมเดินทางและวิวัฒนาการ 5 ร่างไปพร้อมกับคุณ!
                                </p>
                            </div>
                        </div>
                        <button type="button" onclick="openPetStarterModal()"
                            class="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-teal-500 text-white font-extrabold text-xs sm:text-sm shadow-md hover:shadow-lg hover:scale-105 active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer min-h-[44px] shrink-0">
                            <span>🥚 ฟักไข่เลือกคู่หู</span>
                            <span>➔</span>
                        </button>
                    </div>
                </div>
            `;
            return;
        }

        // 2. Selected Active Pet State
        const pet = PET_DATA[petState.selectedPetId];
        const activeDays = Math.max(1, Number(petState.activeDays) || 1);
        const stageIdx = calculateStageIndex(activeDays);
        const currentStage = pet.stages[stageIdx];
        const nextStage = stageIdx < 4 ? pet.stages[stageIdx + 1] : null;

        // Progress Calculation to Next Evolution
        let progressPercent = 100;
        let daysRemainingText = '';
        if (nextStage) {
            const prevMilestone = currentStage.dayReq;
            const nextMilestone = nextStage.dayReq;
            const daysInThisStage = activeDays - prevMilestone;
            const totalStageSpan = nextMilestone - prevMilestone;
            progressPercent = Math.min(100, Math.max(5, Math.round((daysInThisStage / totalStageSpan) * 100)));
            const daysLeft = Math.max(1, nextMilestone - activeDays);
            daysRemainingText = `เหลืออีก <b>${daysLeft} วัน</b> สู่ ${nextStage.stageNameTh}`;
        } else {
            progressPercent = 100;
            daysRemainingText = '👑 ถึงร่างในตำนานระดับสูงสุดแล้ว!';
        }

        container.innerHTML = `
            <div class="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800 border ${pet.borderClass} p-3.5 sm:p-5 shadow-sm">
                <!-- Background Subtle Gradient Aura (Contained) -->
                <div class="absolute -top-6 -right-6 w-32 h-32 sm:w-48 sm:h-48 rounded-full bg-gradient-to-br ${pet.gradient} opacity-15 blur-2xl pointer-events-none"></div>

                <div class="relative flex flex-col sm:flex-row items-center sm:items-start justify-between gap-3.5 sm:gap-4">
                    <!-- Left: Interactive Animated Pet Avatar -->
                    <div class="flex items-center gap-3 w-full sm:w-auto min-w-0">
                        <div class="relative group cursor-pointer shrink-0" onclick="interactWithPet()" title="แตะเพื่อเล่นกับน้อง ${pet.nicknameTh}">
                            <div class="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border ${pet.borderClass} p-1.5 flex items-center justify-center shadow-inner relative overflow-hidden transition-transform duration-300 group-hover:scale-105 active:scale-95">
                                <img id="petWidgetGif" src="${currentStage.gif}" alt="${currentStage.title}" class="w-full h-full object-contain select-none drop-shadow-md">
                                <div class="absolute bottom-1 right-1 text-xs">
                                    ${pet.elementIcon}
                                </div>
                            </div>
                            <span class="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center shadow-xs border-2 border-white dark:border-slate-800 animate-pulse">
                                ${currentStage.stage}
                            </span>
                        </div>

                        <div class="min-w-0 flex-1">
                            <div class="flex items-center gap-1.5 flex-wrap">
                                <h3 class="font-extrabold text-sm sm:text-base text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                                    <span>${pet.nicknameTh}</span>
                                    <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">(${pet.nickname})</span>
                                </h3>
                                <span class="text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full font-bold ${pet.badgeBg} truncate max-w-full">
                                    ${currentStage.stageNameTh}: ${currentStage.title}
                                </span>
                            </div>
                            <!-- Mini Speech Bubble / Cheerful Quote -->
                            <p id="petWidgetQuote" class="text-xs text-slate-600 dark:text-slate-300 mt-1 line-clamp-2 italic break-words">
                                "${pet.quotes[0]}"
                            </p>
                            <div class="flex items-center gap-2 sm:gap-3 mt-1 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
                                <span class="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                                    🗓️ สะสม: <b>${activeDays} วัน</b>
                                </span>
                                <span>•</span>
                                <span class="truncate">${pet.title.split('(')[0]}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Right: Quick Action Buttons -->
                    <div class="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
                        <button type="button" onclick="openPetCodexModal()"
                            class="w-full sm:w-auto px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs active:scale-95 cursor-pointer min-h-[44px]">
                            <span>🃏 ดูการ์ด & ลุ้นร่างถัดไป</span>
                        </button>
                    </div>
                </div>

                <!-- Next Evolution Countdown Progress Bar -->
                <div class="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700/80">
                    <div class="flex items-center justify-between text-xs mb-1.5 flex-wrap gap-1">
                        <span class="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1 flex-wrap min-w-0">
                            <span>🧬 ความคืบหน้า:</span>
                            <span class="text-slate-700 dark:text-slate-200 font-bold break-words">${daysRemainingText}</span>
                        </span>
                        <span class="text-xs font-extrabold ${pet.theme?.primary || 'text-emerald-500'} shrink-0 ml-auto">
                            ${progressPercent}%
                        </span>
                    </div>
                    <div class="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-700/80 overflow-hidden relative">
                        <div class="h-full rounded-full bg-gradient-to-r ${pet.gradient} transition-all duration-700 ease-out"
                            style="width: ${progressPercent}%;"></div>
                    </div>
                </div>
            </div>
        `;
    }

    // Tap/Click Interaction with Pet in Widget
    let _quoteIdx = 0;
    function interactWithPet() {
        const petState = getSafePetState();
        if (!petState || !petState.selectedPetId) return;
        const pet = PET_DATA[petState.selectedPetId];
        if (!pet) return;

        if (typeof window.playSound === 'function') {
            window.playSound('pop');
        }

        const gifEl = document.getElementById('petWidgetGif');
        if (gifEl) {
            gifEl.classList.remove('animate-bounce');
            void gifEl.offsetWidth; // Force reflow
            gifEl.classList.add('animate-bounce');
        }

        const quoteEl = document.getElementById('petWidgetQuote');
        if (quoteEl && Array.isArray(pet.quotes)) {
            _quoteIdx = (_quoteIdx + 1) % pet.quotes.length;
            quoteEl.textContent = `"${pet.quotes[_quoteIdx]}"`;
        }
    }

    // Modal Animation & Display Helpers (Ensures 100% visibility with .modal-open & Apple smooth backdrop)
    function openPetModal(id) {
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.classList.remove('hidden');
        modal.classList.add('modal-open');
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        if (typeof window.playSound === 'function') {
            window.playSound('pop');
        }
    }

    function closePetModal(id) {
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.classList.remove('modal-open');
        modal.classList.add('hidden');
        modal.style.display = '';
        document.body.style.overflow = '';
    }

    // Starter Pet Selection Modal
    function openPetStarterModal() {
        const modal = document.getElementById('petStarterModal');
        if (!modal) return;

        const content = document.getElementById('petStarterModalContent');
        if (content) {
            content.innerHTML = `
                <div class="space-y-4">
                    <div class="text-center">
                        <div class="w-12 h-12 mx-auto rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center text-2xl mb-2">
                            🥚
                        </div>
                        <h3 class="text-lg font-extrabold text-slate-800 dark:text-slate-100">
                            เลือกคู่หูสัตว์เลี้ยงประจำตัว
                        </h3>
                        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                            เลือกคู่หูตัวแรกของคุณ! น้องจะร่วมเดินทางและวิวัฒนาการ 5 ร่างตามจำนวนวันที่เข้าใช้งานสะสม (Active Days)
                        </p>
                    </div>

                    <!-- 3 Pet Starter Choice Cards -->
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1">
                        <!-- 1. Blaze -->
                        <div class="rounded-2xl border-2 border-orange-500/40 hover:border-orange-500 bg-gradient-to-b from-orange-500/10 to-transparent p-4 flex flex-col items-center text-center transition-all hover:scale-[1.02] shadow-xs">
                            <div class="relative w-24 h-24 mb-2 flex items-center justify-center">
                                <img src="pets/Blaze/Gif/1_Ember Egg_Blaze.gif" alt="Sparky" class="w-20 h-20 object-contain drop-shadow animate-bounce">
                                <span class="absolute top-0 right-0 text-lg">🔥</span>
                            </div>
                            <h4 class="font-extrabold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1">
                                <span>Sparky</span>
                                <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">(สปาร์กี้)</span>
                            </h4>
                            <span class="text-[10px] px-2 py-0.5 rounded-full font-bold bg-orange-500/15 text-orange-600 dark:text-orange-400 mt-1">
                                สายเบิร์น & คาร์ดิโอ
                            </span>
                            <p class="text-[11px] text-slate-600 dark:text-slate-300 mt-2 flex-1">
                                กระต่าย/จิ้งจอกไฟ เปี่ยมพลังงาน ว่องไว จุดประกายการขยับร่างกาย
                            </p>
                            <div class="w-full mt-3.5 pt-3 border-t border-orange-500/20 flex flex-col gap-1.5">
                                <button type="button" onclick="previewEggCard('blaze')" class="text-[11px] text-orange-600 dark:text-orange-400 font-bold hover:underline inline-flex items-center justify-center gap-1">
                                    <span>🔍 ดูการ์ดกรอบสะสม</span>
                                    <span class="text-[9px] px-1.5 py-0.2 rounded font-black bg-stone-700/80 text-stone-200 border border-stone-500/60 uppercase">COMMON</span>
                                </button>
                                <button type="button" onclick="selectStarterPet('blaze')"
                                    class="w-full py-2 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-bold text-xs shadow-md transition cursor-pointer">
                                    เลือก Sparky 🔥
                                </button>
                            </div>
                        </div>

                        <!-- 2. Titan -->
                        <div class="rounded-2xl border-2 border-amber-600/40 hover:border-amber-600 bg-gradient-to-b from-amber-700/10 to-transparent p-4 flex flex-col items-center text-center transition-all hover:scale-[1.02] shadow-xs">
                            <div class="relative w-24 h-24 mb-2 flex items-center justify-center">
                                <img src="pets/Titan/Gif/1_Geode Egg_Titan.gif" alt="Rocky" class="w-20 h-20 object-contain drop-shadow animate-bounce" style="animation-delay: 0.15s">
                                <span class="absolute top-0 right-0 text-lg">🪨</span>
                            </div>
                            <h4 class="font-extrabold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1">
                                <span>Rocky</span>
                                <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">(ร็อคกี้)</span>
                            </h4>
                            <span class="text-[10px] px-2 py-0.5 rounded-full font-bold bg-stone-500/15 text-stone-700 dark:text-stone-300 mt-1">
                                สายพลัง & สร้างกล้ามเนื้อ
                            </span>
                            <p class="text-[11px] text-slate-600 dark:text-slate-300 mt-2 flex-1">
                                หมีศิลาเกราะหิน หนักแน่น มั่นคง ตัวแทนของวินัยและพลังกาย
                            </p>
                            <div class="w-full mt-3.5 pt-3 border-t border-stone-500/20 flex flex-col gap-1.5">
                                <button type="button" onclick="previewEggCard('titan')" class="text-[11px] text-amber-700 dark:text-amber-400 font-bold hover:underline inline-flex items-center justify-center gap-1">
                                    <span>🔍 ดูการ์ดกรอบสะสม</span>
                                    <span class="text-[9px] px-1.5 py-0.2 rounded font-black bg-stone-700/80 text-stone-200 border border-stone-500/60 uppercase">COMMON</span>
                                </button>
                                <button type="button" onclick="selectStarterPet('titan')"
                                    class="w-full py-2 rounded-xl bg-amber-700 hover:bg-amber-800 active:scale-95 text-white font-bold text-xs shadow-md transition cursor-pointer">
                                    เลือก Rocky 🪨
                                </button>
                            </div>
                        </div>

                        <!-- 3. Zen -->
                        <div class="rounded-2xl border-2 border-teal-500/40 hover:border-teal-500 bg-gradient-to-b from-teal-500/10 to-transparent p-4 flex flex-col items-center text-center transition-all hover:scale-[1.02] shadow-xs">
                            <div class="relative w-24 h-24 mb-2 flex items-center justify-center">
                                <img src="pets/Zen/Gif/1_Sprout Egg_Zen.gif" alt="Dewy" class="w-20 h-20 object-contain drop-shadow animate-bounce" style="animation-delay: 0.3s">
                                <span class="absolute top-0 right-0 text-lg">💧</span>
                            </div>
                            <h4 class="font-extrabold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1">
                                <span>Dewy</span>
                                <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">(ดิวอี้)</span>
                            </h4>
                            <span class="text-[10px] px-2 py-0.5 rounded-full font-bold bg-teal-500/15 text-teal-600 dark:text-teal-400 mt-1">
                                สายสมดุล & โภชนาการ
                            </span>
                            <p class="text-[11px] text-slate-600 dark:text-slate-300 mt-2 flex-1">
                                เพนกวินพฤกษาผสานสายน้ำ นุ่มนวล สดชื่น เตือนดื่มน้ำและคุมอาหาร
                            </p>
                            <div class="w-full mt-3.5 pt-3 border-t border-teal-500/20 flex flex-col gap-1.5">
                                <button type="button" onclick="previewEggCard('zen')" class="text-[11px] text-teal-600 dark:text-teal-400 font-bold hover:underline inline-flex items-center justify-center gap-1">
                                    <span>🔍 ดูการ์ดกรอบสะสม</span>
                                    <span class="text-[9px] px-1.5 py-0.2 rounded font-black bg-stone-700/80 text-stone-200 border border-stone-500/60 uppercase">COMMON</span>
                                </button>
                                <button type="button" onclick="selectStarterPet('zen')"
                                    class="w-full py-2 rounded-xl bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-bold text-xs shadow-md transition cursor-pointer">
                                    เลือก Dewy 💧🌿
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        openPetModal('petStarterModal');
    }

    function closePetStarterModal() {
        closePetModal('petStarterModal');
    }

    // Select Starter Pet Action
    function selectStarterPet(petId) {
        if (!PET_DATA[petId]) return;
        const petState = getSafePetState();
        if (!petState) return;

        const today = (typeof window.getTodayStr === 'function') ? window.getTodayStr() : new Date().toISOString().split('T')[0];
        petState.selectedPetId = petId;
        petState.v5933 = true;
        if (!petState.activeDates.includes(today)) {
            petState.activeDates.push(today);
        }
        petState.activeDays = Math.max(1, petState.activeDates.length);
        petState.lastStageNotified = 1;

        if (typeof window.saveState === 'function') {
            window.saveState();
        }
        if (typeof window.triggerCloudSync === 'function') {
            window.triggerCloudSync(true);
        }

        closePetStarterModal();
        renderPetCompanionWidget();

        // Celebration Confetti & Pop Sound
        if (typeof window.playSound === 'function') {
            window.playSound('celebrate');
        }
        if (typeof window.triggerCelebrationConfetti === 'function') {
            window.triggerCelebrationConfetti();
        }
        if (typeof window.showToast === 'function') {
            window.showToast(`🎉 ยินดีด้วย! น้อง ${PET_DATA[petId].nicknameTh} (${PET_DATA[petId].nickname}) เข้าเป็นคู่หูของคุณแล้ว!`);
        }
    }

    // Preview Egg Card Modal View
    function previewEggCard(petId) {
        const pet = PET_DATA[petId];
        if (!pet) return;
        const eggStage = pet.stages[0];
        openPetCardViewer(eggStage.card, `${pet.nicknameTh} - ${eggStage.title}`, eggStage.stageNameTh, eggStage.desc, 1, pet.id);
    }

    // Pet Codex & Mystery Silhouette Card Modal
    function openPetCodexModal() {
        const petState = getSafePetState();
        if (!petState || !petState.selectedPetId) {
            openPetStarterModal();
            return;
        }

        const modal = document.getElementById('petCodexModal');
        if (!modal) return;

        const pet = PET_DATA[petState.selectedPetId];
        const activeDays = Math.max(1, Number(petState.activeDays) || 1);
        const stageIdx = calculateStageIndex(activeDays);
        const currentStage = pet.stages[stageIdx];
        const nextStage = stageIdx < 4 ? pet.stages[stageIdx + 1] : null;
        const curRarity = RARITY_TIERS[stageIdx + 1] || RARITY_TIERS[1];

        const container = document.getElementById('petCodexModalContent');
        if (container) {
            // Build Unlocked Stages Gallery Badges
            const stagesGalleryHtml = pet.stages.map((st, idx) => {
                const isUnlocked = idx <= stageIdx;
                const isCurrent = idx === stageIdx;
                const isNext = idx === stageIdx + 1;
                const stRarity = RARITY_TIERS[st.stage] || RARITY_TIERS[1];

                if (isUnlocked) {
                    return `
                        <button type="button" onclick="openPetCardViewer('${st.card}', '${pet.nicknameTh} - ${st.title}', '${st.stageNameTh}', '${st.desc}', ${st.stage}, '${pet.id}')"
                            class="p-2.5 rounded-xl border ${isCurrent ? 'border-amber-400 bg-amber-500/10 ring-2 ring-amber-400/30' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60'} text-left transition hover:scale-102 cursor-pointer flex items-center gap-2.5 relative group">
                            <img src="${st.gif}" alt="${st.title}" class="w-10 h-10 object-contain shrink-0 group-hover:scale-110 transition">
                            <div class="min-w-0 flex-1">
                                <div class="flex items-center gap-1.5 flex-wrap">
                                    <span class="text-[11px] font-bold text-slate-800 dark:text-slate-100 truncate">${st.title}</span>
                                    <span class="text-[8px] px-1.5 py-0.2 rounded font-black ${stRarity.badgeBg} shrink-0 uppercase">${stRarity.starsCount === 5 ? '👑 ' : ''}${stRarity.nameEn}</span>
                                </div>
                                <div class="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold truncate mt-0.5 flex items-center gap-1">
                                    <span>${st.stageNameTh} ✓</span>
                                    <span class="text-[8px] text-slate-400 font-normal">| 🔍 ดูการ์ด</span>
                                </div>
                            </div>
                        </button>
                    `;
                } else if (isNext) {
                    const daysLeft = Math.max(1, st.dayReq - activeDays);
                    return `
                        <div class="p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/5 text-left flex items-center gap-2.5">
                            <div class="w-10 h-10 rounded-lg bg-slate-950 flex items-center justify-center text-lg shrink-0 text-amber-400">
                                🔒
                            </div>
                            <div class="min-w-0 flex-1">
                                <div class="flex items-center gap-1 flex-wrap">
                                    <span class="text-[11px] font-bold text-amber-600 dark:text-amber-400 truncate">??? (ร่างถัดไป)</span>
                                    <span class="text-[8px] px-1.5 py-0.2 rounded font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0 uppercase">${stRarity.nameEn}</span>
                                </div>
                                <div class="text-[9px] text-slate-500 dark:text-slate-400 truncate">สะสมครบ ${st.dayReq} วัน (อีก ${daysLeft} วัน)</div>
                            </div>
                        </div>
                    `;
                } else {
                    return `
                        <div class="p-2.5 rounded-xl border border-dashed border-slate-200 dark:border-slate-700/60 bg-slate-100/50 dark:bg-slate-900/30 text-left flex items-center gap-2.5 opacity-60">
                            <div class="w-10 h-10 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-xs shrink-0 text-slate-400">
                                🔒
                            </div>
                            <div class="min-w-0 flex-1">
                                <div class="text-[11px] font-bold text-slate-400 truncate">ร่างลับ (ยังไม่เปิดเผย)</div>
                                <div class="text-[9px] text-slate-400 truncate">Stage ${st.stage} (${stRarity.nameEn}) • Day ${st.dayReq}</div>
                            </div>
                        </div>
                    `;
                }
            }).join('');

            // Silhouette Mystery Next Stage Card HTML
            let nextStageHtml = '';
            if (nextStage) {
                const daysLeft = Math.max(1, nextStage.dayReq - activeDays);
                const nextRarity = RARITY_TIERS[nextStage.stage] || RARITY_TIERS[1];
                nextStageHtml = `
                    <div class="relative rounded-2xl overflow-hidden border-2 border-amber-500/40 bg-gradient-to-b from-slate-900 via-slate-900 to-black p-4 text-center shadow-lg">
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                🕵️‍♂️ ร่างถัดไป (Mystery Next Evolution)
                            </span>
                            <span class="text-xs text-amber-300 font-bold">🔒 อีก ${daysLeft} วัน</span>
                        </div>

                        <!-- Card Silhouette with Dark Filter, Elemental Glow & Mystery Corner Ornaments -->
                        <div class="relative w-40 sm:w-52 mx-auto aspect-[3/4] rounded-xl overflow-hidden my-3 border border-amber-500/40 shadow-[0_0_25px_rgba(245,158,11,0.25)] flex items-center justify-center bg-black">
                            <!-- Mystery Corner Ornaments -->
                            <div class="tcg-corner-ornament tcg-corner-tl text-amber-400"></div>
                            <div class="tcg-corner-ornament tcg-corner-tr text-amber-400"></div>
                            <div class="tcg-corner-ornament tcg-corner-bl text-amber-400"></div>
                            <div class="tcg-corner-ornament tcg-corner-br text-amber-400"></div>

                            <!-- Silhouette Image (Pure Black Shadow with Aura) -->
                            <img src="${nextStage.card}" alt="Mystery Evolution"
                                class="w-full h-full object-cover select-none pointer-events-none"
                                style="filter: brightness(0) contrast(200%); opacity: 0.95;">
                            
                            <!-- Question Mark & Lock Overlay -->
                            <div class="absolute inset-0 bg-black/30 flex flex-col items-center justify-center text-white pointer-events-none p-3">
                                <div class="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-2xl sm:text-3xl shadow-lg backdrop-blur-xs animate-pulse mb-1">
                                    ❓
                                </div>
                                <span class="text-xs font-bold text-amber-300 drop-shadow">ใครคือร่างถัดไป?</span>
                                <span class="text-[9px] px-2 py-0.5 rounded-full font-bold bg-amber-500/30 text-amber-200 border border-amber-400/50 mt-1">
                                    เป้าหมาย: ${nextRarity.nameEn} (${nextRarity.stars})
                                </span>
                            </div>
                        </div>

                        <div class="text-left bg-slate-800/80 p-3 rounded-xl border border-slate-700/80 mt-2">
                            <div class="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                                <span>💡 คำใบ้ร่างถัดไป:</span>
                            </div>
                            <p class="text-xs text-slate-300 mt-1 italic break-words">
                                "${currentStage.hint}"
                            </p>
                            <div class="mt-2 text-[11px] text-slate-400 flex items-center justify-between flex-wrap gap-1">
                                <span>เงื่อนไขวิวัฒนาการ:</span>
                                <span class="font-bold text-amber-400">เข้าใช้งานสะสมครบ ${nextStage.dayReq} วัน</span>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                nextStageHtml = `
                    <div class="rounded-2xl border-2 border-amber-500/50 bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-transparent p-5 text-center shadow-lg">
                        <div class="text-3xl mb-2">👑</div>
                        <h4 class="text-base font-extrabold text-amber-600 dark:text-amber-400">
                            บรรลุร่างในตำนานขั้นสูงสุดแล้ว!
                        </h4>
                        <p class="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-sm mx-auto break-words">
                            น้อง ${pet.nicknameTh} วิวัฒนาการสู่ร่าง "${currentStage.title}" อย่างสมบูรณ์แบบ คุณสามารถเลือกฟักไข่ตัวใหม่ได้แล้ว!
                        </p>
                        <button type="button" onclick="openPetStarterModal()"
                            class="mt-3.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-xs shadow-md hover:scale-105 active:scale-95 transition cursor-pointer min-h-[44px]">
                            ✨ ปลดล็อคฟักไข่ตัวใหม่
                        </button>
                    </div>
                `;
            }

            const isAdm = isPetAdmin();
            const isSandboxActive = isAdminPetSandboxActive();
            let adminSandboxHtml = '';
            if (isAdm || isSandboxActive) {
                adminSandboxHtml = `
                    <div class="rounded-2xl border-2 border-amber-500/50 bg-slate-900/90 p-3 sm:p-3.5 space-y-2.5 text-xs shadow-md">
                        <div class="flex items-center justify-between flex-wrap gap-2">
                            <div class="flex items-center gap-1.5 font-extrabold text-amber-400">
                                <span>🛠️ โหมดทดสอบสำหรับแอดมิน (Admin Sandbox)</span>
                                ${isSandboxActive ? '<span class="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold animate-pulse">กำลังจำลอง</span>' : ''}
                            </div>
                            <div class="flex items-center gap-1.5 flex-wrap">
                                ${isSandboxActive ? `
                                    <button type="button" onclick="adminRestoreRealPet()"
                                        class="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-[11px] transition shadow-xs flex items-center gap-1 cursor-pointer min-h-[36px]">
                                        <span>🔄</span> <span>คืนค่าสถานะจริงของฉัน</span>
                                    </button>
                                ` : ''}
                                <button type="button" onclick="adminResetPetToFresh()"
                                    class="px-2.5 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-600 active:scale-95 text-white font-bold text-[11px] transition shadow-xs flex items-center gap-1 cursor-pointer min-h-[36px]"
                                    title="ลบสถานะสัตว์เลี้ยงและกลับไปเลือกคู่หูใหม่เริ่มต้น">
                                    <span>🗑️</span> <span>ลบสถานะ (เริ่มเลือกใหม่)</span>
                                </button>
                            </div>
                        </div>

                        <!-- 1. Quick Switch Pet -->
                        <div class="flex items-center gap-1.5 flex-wrap">
                            <span class="text-slate-400 font-semibold text-[11px]">สลับสาย:</span>
                            <button type="button" onclick="adminSetTestPet('blaze', calculatePetStageIndex(state.pet?.activeDays) + 1)"
                                class="px-2.5 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer min-h-[32px] ${pet.id === 'blaze' ? 'bg-orange-500 text-white' : 'bg-slate-800 text-orange-400 border border-orange-500/30'}">
                                🔥 Sparky
                            </button>
                            <button type="button" onclick="adminSetTestPet('titan', calculatePetStageIndex(state.pet?.activeDays) + 1)"
                                class="px-2.5 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer min-h-[32px] ${pet.id === 'titan' ? 'bg-amber-700 text-white' : 'bg-slate-800 text-amber-400 border border-amber-600/30'}">
                                🪨 Rocky
                            </button>
                            <button type="button" onclick="adminSetTestPet('zen', calculatePetStageIndex(state.pet?.activeDays) + 1)"
                                class="px-2.5 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer min-h-[32px] ${pet.id === 'zen' ? 'bg-teal-600 text-white' : 'bg-slate-800 text-teal-400 border border-teal-500/30'}">
                                💧 Dewy
                            </button>
                        </div>

                        <!-- 2. Fast Stage Jump -->
                        <div class="flex items-center gap-1.5 flex-wrap">
                            <span class="text-slate-400 font-semibold text-[11px]">ข้ามร่าง:</span>
                            ${[1, 2, 3, 4, 5].map(st => {
                                const isCur = (stageIdx + 1) === st;
                                const labels = ['R1: ไข่ (1วัน)', 'R2: แรกเกิด (3วัน)', 'R3: วัยซน (7วัน)', 'R4: โตเต็มวัย (21วัน)', 'R5: ตำนาน (60วัน)'];
                                return `
                                    <button type="button" onclick="adminSetTestPet('${pet.id}', ${st})"
                                        class="px-2 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer min-h-[32px] ${isCur ? 'bg-amber-400 text-slate-950 font-extrabold shadow-xs' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'}">
                                        ${labels[st - 1]}
                                    </button>
                                `;
                            }).join('')}
                        </div>

                        <!-- 3. Test Evolution Celebration -->
                        <div class="pt-1.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5 border-t border-slate-800 text-[10px] text-slate-400">
                            <span class="break-words leading-tight">*กดเปลี่ยนตัวและดูทุกร่างได้อิสระ เมื่อเสร็จกด "คืนค่าสถานะจริง"</span>
                            <button type="button" onclick="adminTriggerEvolutionTest()" class="text-amber-400 hover:underline font-bold shrink-0 min-h-[32px] flex items-center">
                                🎉 เทสต์วิวัฒนาการ
                            </button>
                        </div>
                    </div>
                `;
            }

            container.innerHTML = `
                <div class="space-y-4">
                    ${adminSandboxHtml}

                    <!-- Current Active Pet Hero Card with TCG Frame -->
                    <div class="rounded-2xl border ${pet.borderClass} bg-gradient-to-br ${pet.gradient} p-3.5 sm:p-5 text-white shadow-md relative overflow-hidden">
                        <div class="flex flex-col sm:flex-row items-center gap-3.5 sm:gap-4">
                            <!-- Clickable Card Image with TCG Frame -->
                            <div class="w-28 sm:w-36 aspect-[3/4] rounded-xl overflow-hidden shadow-2xl shrink-0 cursor-pointer group relative hover:scale-105 transition ${curRarity.cardBorder} ${stageIdx === 4 ? 'tcg-legendary-border-anim' : ''}"
                                style="${curRarity.glowStyle}"
                                onclick="openPetCardViewer('${currentStage.card}', '${pet.nicknameTh} - ${currentStage.title}', '${currentStage.stageNameTh}', '${currentStage.desc}', ${currentStage.stage}, '${pet.id}')">
                                
                                <!-- Corner Ornaments -->
                                <div class="tcg-corner-ornament tcg-corner-tl ${curRarity.cornerColor}"></div>
                                <div class="tcg-corner-ornament tcg-corner-tr ${curRarity.cornerColor}"></div>
                                <div class="tcg-corner-ornament tcg-corner-bl ${curRarity.cornerColor}"></div>
                                <div class="tcg-corner-ornament tcg-corner-br ${curRarity.cornerColor}"></div>

                                <img src="${currentStage.card}" alt="${currentStage.title}" class="w-full h-full object-cover">
                                
                                ${curRarity.foilClass ? `<div class="absolute inset-0 pointer-events-none ${curRarity.foilClass}"></div>` : ''}

                                <div class="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${curRarity.badgeBg} shadow-xs z-10 flex items-center gap-0.5">
                                    <span>${curRarity.symbol}</span>
                                    <span>${curRarity.nameEn}</span>
                                </div>

                                <div class="absolute inset-0 bg-black/20 group-hover:bg-transparent transition flex items-end p-1.5">
                                    <span class="text-[9px] bg-black/75 backdrop-blur-xs text-amber-300 px-1.5 py-0.5 rounded font-bold border border-amber-500/40">
                                        🔍 กรอบการ์ด ${curRarity.collectorCode}
                                    </span>
                                </div>
                            </div>

                            <div class="flex-1 text-center sm:text-left min-w-0 w-full">
                                <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-xs text-xs font-bold mb-1.5">
                                    <span>${pet.elementIcon}</span>
                                    <span>${pet.title.split('(')[0]}</span>
                                </div>
                                <h3 class="text-lg sm:text-xl font-extrabold tracking-tight truncate">
                                    ${pet.nicknameTh} (${pet.nickname})
                                </h3>
                                <div class="text-xs sm:text-sm font-semibold opacity-90 mt-0.5">
                                    ${currentStage.stageNameTh}: ${currentStage.title}
                                </div>
                                <div class="mt-1 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-black/30 text-[11px] font-semibold text-amber-200">
                                    <span>${curRarity.perkTh}</span>
                                </div>
                                <p class="text-xs opacity-90 mt-1.5 line-clamp-2 break-words">
                                    ${currentStage.desc}
                                </p>
                                <div class="mt-2.5 inline-flex items-center gap-2 bg-black/40 backdrop-blur-xs px-3 py-1.5 rounded-xl text-xs font-bold flex-wrap">
                                    <span>🗓️ เข้าใช้งานสะสม:</span>
                                    <span class="text-amber-300 font-extrabold">${activeDays} วัน</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Next Stage Mystery Silhouette -->
                    ${nextStageHtml}

                    <!-- 5 Evolution Stages Codex Gallery -->
                    <div>
                        <h4 class="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                            <span>📚 บันทึกสายวิวัฒนาการทั้ง 5 ร่าง (Evolution Codex):</span>
                        </h4>
                        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            ${stagesGalleryHtml}
                        </div>
                    </div>
                </div>
            `;
        }

        openPetModal('petCodexModal');
    }

    function closePetCodexModal() {
        closePetModal('petCodexModal');
    }

    // Full High-Res Card Viewer Modal with TCG Collectible Rarity Frames
    function openPetCardViewer(cardUrl, title, stageTitle, desc, stageNum, petId) {
        let resolvedStage = Number(stageNum);
        if (!resolvedStage || isNaN(resolvedStage) || resolvedStage < 1 || resolvedStage > 5) {
            const urlMatch = cardUrl ? cardUrl.match(/\/([1-5])_/) : null;
            const titleMatch = stageTitle ? stageTitle.match(/Stage\s*([1-5])/i) : null;
            if (urlMatch) {
                resolvedStage = parseInt(urlMatch[1], 10);
            } else if (titleMatch) {
                resolvedStage = parseInt(titleMatch[1], 10);
            } else {
                resolvedStage = 1;
            }
        }
        const rarity = RARITY_TIERS[resolvedStage] || RARITY_TIERS[1];

        let resolvedPet = null;
        if (petId && PET_DATA[petId]) {
            resolvedPet = PET_DATA[petId];
        } else {
            for (const key of Object.keys(PET_DATA)) {
                if ((cardUrl && cardUrl.toLowerCase().includes(key)) || (title && title.includes(PET_DATA[key].nicknameTh))) {
                    resolvedPet = PET_DATA[key];
                    break;
                }
            }
        }

        let viewerModal = document.getElementById('petCardViewerModal');
        if (!viewerModal) {
            viewerModal = document.createElement('div');
            viewerModal.id = 'petCardViewerModal';
            viewerModal.className = 'fixed inset-0 z-[99999] bg-black/95 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 transition-all duration-300 select-none overflow-y-auto overscroll-contain';
            document.body.appendChild(viewerModal);
            viewerModal.addEventListener('click', (e) => {
                if (e.target === viewerModal) closePetCardViewer();
            });
        }

        const elementIcon = resolvedPet ? resolvedPet.elementIcon : '✨';

        viewerModal.innerHTML = `
            <!-- Floating iOS Close Button (44x44px Touch Target) -->
            <button type="button" onclick="closePetCardViewer()"
                class="fixed top-3 right-3 sm:top-5 sm:right-5 z-50 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-slate-900/90 hover:bg-slate-800 text-white border-2 border-white/30 shadow-2xl flex items-center justify-center text-xl font-bold transition hover:scale-110 active:scale-95 cursor-pointer ring-4 ring-black/20"
                title="ปิดการ์ด (✕ ปิด)">
                ✕
            </button>
            <div class="relative max-w-xs sm:max-w-sm w-full flex flex-col items-center my-auto py-3">
                <!-- Top Collector Ribbon -->
                <div class="flex items-center justify-between w-full mb-2.5 px-1 gap-2">
                    <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black tracking-wide ${rarity.badgeBg} shadow-md border">
                        <span>${rarity.symbol}</span>
                        <span>${rarity.nameEn}</span>
                    </div>
                    <div class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-800/90 text-[11px] font-bold text-slate-300 border border-slate-700">
                        <span>${elementIcon}</span>
                        <span>DAY ${rarity.dayReq}+</span>
                    </div>
                </div>

                <!-- TCG Collectible Card Frame -->
                <div id="petCardViewerFrame" class="w-full max-h-[58vh] aspect-[3/4] rounded-2xl overflow-hidden relative ${rarity.cardBorder} ${resolvedStage === 5 ? 'tcg-legendary-border-anim' : ''}" style="${rarity.glowStyle}">
                    <!-- Corner Ornaments -->
                    <div class="tcg-corner-ornament tcg-corner-tl ${rarity.cornerColor}"></div>
                    <div class="tcg-corner-ornament tcg-corner-tr ${rarity.cornerColor}"></div>
                    <div class="tcg-corner-ornament tcg-corner-bl ${rarity.cornerColor}"></div>
                    <div class="tcg-corner-ornament tcg-corner-br ${rarity.cornerColor}"></div>

                    <!-- High-Res Card Artwork -->
                    <img id="petCardViewerImg" src="${cardUrl}" alt="${title}" class="w-full h-full object-cover select-none">

                    <!-- Foil Reflection Sheen -->
                    ${rarity.foilClass ? `<div class="absolute inset-0 pointer-events-none ${rarity.foilClass}"></div>` : ''}

                    <!-- Collector Stamp Badge -->
                    <div class="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-xs text-[10px] font-black tracking-wider text-amber-300 border border-amber-500/40">
                        STAGE ${resolvedStage} • ${rarity.collectorCode}
                    </div>
                </div>

                <!-- Collector Plaque & Metadata -->
                <div class="mt-3 w-full rounded-2xl bg-slate-900/95 border border-slate-800 p-3 sm:p-3.5 text-center space-y-1.5 shadow-2xl">
                    <h3 id="petCardViewerTitle" class="text-base sm:text-lg font-extrabold tracking-tight text-white">${title}</h3>
                    <div class="text-xs font-semibold text-emerald-400 flex items-center justify-center gap-1.5 flex-wrap">
                        <span id="petCardViewerStage">${stageTitle}</span>
                        <span>•</span>
                        <span class="${rarity.badgeColor} font-bold">${rarity.nameTh}</span>
                    </div>
                    <!-- Passive Perk Banner -->
                    <div class="text-[11px] py-1 px-2.5 rounded-lg bg-slate-800/80 border border-slate-700/80 text-amber-300 font-medium inline-block max-w-full truncate">
                        ${rarity.perkTh}
                    </div>
                    <p id="petCardViewerDesc" class="text-xs text-slate-300 line-clamp-2 break-words leading-relaxed">
                        "${desc}"
                    </p>
                </div>
            </div>
        `;

        viewerModal.classList.remove('hidden');
        if (typeof window.playSound === 'function') {
            window.playSound('pop');
        }
    }

    function closePetCardViewer() {
        const viewerModal = document.getElementById('petCardViewerModal');
        if (viewerModal) viewerModal.classList.add('hidden');
    }

    // Window Global Bindings
    window.PET_DATA = PET_DATA;
    window.calculatePetStageIndex = calculateStageIndex;
    window.getSafePetState = getSafePetState;
    window.trackPetActiveDay = trackPetActiveDay;
    window.calculateStageIndex = calculateStageIndex;
    window.renderPetCompanionWidget = renderPetCompanionWidget;
    window.interactWithPet = interactWithPet;
    window.openPetStarterModal = openPetStarterModal;
    window.closePetStarterModal = closePetStarterModal;
    window.selectStarterPet = selectStarterPet;
    window.previewEggCard = previewEggCard;
    window.openPetCodexModal = openPetCodexModal;
    window.closePetCodexModal = closePetCodexModal;
    window.openPetCardViewer = openPetCardViewer;
    window.closePetCardViewer = closePetCardViewer;
    window.isPetAdmin = isPetAdmin;
    window.isAdminPetSandboxActive = isAdminPetSandboxActive;
    window.adminSetTestPet = adminSetTestPet;
    window.adminRestoreRealPet = adminRestoreRealPet;
    window.adminResetPetToFresh = adminResetPetToFresh;
    window.adminTriggerEvolutionTest = adminTriggerEvolutionTest;
    window.openAdminPetSandbox = openAdminPetSandbox;
    window.PET_RARITY_TIERS = RARITY_TIERS;

})();
