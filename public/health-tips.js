// ==============================================================
// NovaFit Pro - Daily Health & Nutrition Tips Engine (v5.5.0)
// รองรับคลังความรู้สุขภาพ 60+ เรื่อง, สุ่มประจำวัน, และดึงข้อมูลออนไลน์
// ==============================================================

const BUILTIN_HEALTH_TIPS = [
    {
        id: "tip-01",
        category: "ผักและผลไม้",
        icon: "🍅",
        title: "มะเขือเทศกับสารไลโคปีน (Lycopene)",
        summary: "มะเขือเทศมีสารต้านอนุมูลอิสระ 'ไลโคปีน' สูงมาก ช่วยชะลอวัย ปกป้องเซลล์ และลดความเสี่ยงมะเร็งต่อมลูกหมาก",
        detail: "ที่น่าสนใจคือ เมื่อนำมะเขือเทศไปผ่านความร้อน (เช่น ซุปมะเขือเทศ ผัด หรือซอสมะเขือเทศ) โครงสร้างโมเลกุลจะเปลี่ยนทำให้ร่างกายดูดซึมไลโคปีนได้ดีขึ้นกว่าการทานสดถึง 2-3 เท่า และหากทานคู่กับไขมันดี เช่น น้ำมันมะกอก จะยิ่งเพิ่มการดูดซึม!",
        tags: ["มะเขือเทศ", "ไลโคปีน", "ต้านอนุมูลอิสระ", "ผัก"]
    },
    {
        id: "tip-02",
        category: "ไขมันดี",
        icon: "🥑",
        title: "อะโวคาโดกับกรดไขมันไม่อิ่มตัวเชิงเดี่ยว",
        summary: "อะโวคาโดอุดมไปด้วย MUFA และโพแทสเซียม ช่วยลดคอเลสเตอรอลไม่ดี (LDL) และบำรุงสุขภาพหัวใจ",
        detail: "ไขมันดีในอะโวคาโดช่วยให้อิ่มท้องนาน ชะลอการย่อย และช่วยให้ร่างกายดูดซึมวิตามินที่ละลายในไขมัน (A, D, E, K) จากผักสลัดได้ดียิ่งขึ้น แนะนำทานครึ่งลูกถึง 1 ลูกต่อวัน",
        tags: ["อะโวคาโด", "ไขมันดี", "ลดไขมัน", "หัวใจ"]
    },
    {
        id: "tip-03",
        category: "โปรตีน",
        icon: "🥚",
        title: "ไข่ไก่: โปรตีนสมบูรณ์แบบ & โคลีนบำรุงสมอง",
        summary: "ไข่ไก่มีกรดอะมิโนจำเป็นครบถ้วนทั้ง 9 ชนิด พร้อมสารโคลีน (Choline) ที่จำเป็นต่อความจำ",
        detail: "ไข่ 1 ฟองให้โปรตีนคุณภาพสูง ~6-7 กรัม มีสารลูทีนและซีแซนทีนช่วยปกป้องจอประสาทตา การทานไข่ทั้งฟองรวมไข่แดงในคนสุขภาพปกติ 1-2 ฟองต่อวันไม่ได้ทำให้ระดับคอเลสเตอรอลในเลือดเสียสมดุลอย่างที่เคยเข้าใจในอดีต",
        tags: ["ไข่ไก่", "โปรตีน", "โคลีน", "สร้างกล้ามเนื้อ"]
    },
    {
        id: "tip-04",
        category: "การเผาผลาญ",
        icon: "🍵",
        title: "ชาเขียวกับสารคาเทชิน EGCG",
        summary: "EGCG ในชาเขียวช่วยเพิ่มอัตราการเผาผลาญพลังงาน และมีแอล-ธีอะนีนช่วยผ่อนคลายแต่มีสมาธิ",
        detail: "งานวิจัยพบว่าสาร EGCG ร่วมกับคาเฟอีนธรรมชาติในชาเขียว ช่วยเพิ่มการสลายไขมัน (Fat Oxidation) ได้ประมาณ 4-5% และช่วยลดความอยากอาหาร ดื่มระหว่างวันแบบไม่เติมน้ำตาลหรือนมจะได้รับประโยชน์สูงสุด",
        tags: ["ชาเขียว", "EGCG", "เผาผลาญ", "คาเฟอีน"]
    },
    {
        id: "tip-05",
        category: "การดื่มน้ำ",
        icon: "💧",
        title: "ดื่มน้ำ 1-2 แก้วก่อนมื้ออาหาร 30 นาที",
        summary: "การดื่มน้ำก่อนอาหารช่วยกระตุ้นระบบย่อยอาหาร และช่วยควบคุมแคลอรีไม่ให้ทานเกินเป้าหมายได้ 13%",
        detail: "เมื่อกระเพาะอาหารได้รับน้ำล่วงหน้า สมองจะรับรู้สัญญาณความอิ่มเร็วขึ้น ทำให้ทานอาหารในปริมาณที่พอดี และน้ำยังช่วยส่งเสริมการทำงานของเอนไซม์ย่อยอาหารและป้องกันอาการท้องผูก",
        tags: ["น้ำดื่ม", "คุมอาหาร", "ลดน้ำหนัก", "ระบบย่อย"]
    },
    {
        id: "tip-06",
        category: "ฟื้นฟูกล้ามเนื้อ",
        icon: "🍌",
        title: "กล้วยหอมกับโพแทสเซียมป้องกันตะคริว",
        summary: "กล้วยหอมให้คาร์โบไฮเดรตดูดซึมเร็ว เติมไกลโคเจนทันใจ พร้อมโพแทสเซียมและวิตามินบี 6",
        detail: "การทานกล้วยหอมก่อนหรือหลังออกกำลังกาย 30 นาที ช่วยเติมพลังงานที่สูญเสียไปอย่างรวดเร็ว โพแทสเซียมช่วยปรับสมดุลอิเล็กโทรไลต์ ป้องกันการเกิดตะคริวของกล้ามเนื้อ และทริปโตเฟนช่วยปรับอารมณ์ให้สดชื่น",
        tags: ["กล้วย", "โพแทสเซียม", "ออกกำลังกาย", "ตะคริว"]
    },
    {
        id: "tip-07",
        category: "ระบบภูมิคุ้มกัน",
        icon: "🧄",
        title: "กระเทียมกับสารอัลลิซิน (Allicin)",
        summary: "กระเทียมสดมีสารต้านแบคทีเรียและไวรัส ช่วยเสริมภูมิต้านทานและลดความดันโลหิต",
        detail: "สารอัลลิซินจะเกิดขึ้นเมื่อกระเทียมถูกทุบ สับ หรือบด แล้วพักทิ้งไว้ประมาณ 5-10 นาทีก่อนนำไปประกอบอาหารหรือทาน การทานกระเทียมเป็นประจำช่วยลดความเสี่ยงการเป็นหวัดและช่วยลดระดับไขมันในเลือด",
        tags: ["กระเทียม", "อัลลิซิน", "ภูมิคุ้มกัน", "ลดความดัน"]
    },
    {
        id: "tip-08",
        category: "ไขมันดี & โอเมก้า 3",
        icon: "🐟",
        title: "ปลาทะเลน้ำลึกกับโอเมก้า 3 (EPA & DHA)",
        summary: "ปลาแซลมอน ปลาทู และปลาซาร์ดีน มีโอเมก้า 3 สูง ช่วยลดการอักเสบและบำรุงสมอง",
        detail: "กรดไขมันโอเมก้า 3 ช่วยลดระดับไตรกลีเซอไรด์ในเลือด ลดอาการปวดเมื่อยกล้ามเนื้อและข้อต่อหลังออกกำลังกายหนัก แนะนำให้ทานปลาที่มีไขมันดีอย่างน้อย 2 มื้อต่อสัปดาห์",
        tags: ["ปลา", "แซลมอน", "โอเมก้า3", "บำรุงสมอง"]
    },
    {
        id: "tip-09",
        category: "สารต้านอนุมูลอิสระ",
        icon: "🫐",
        title: "บลูเบอร์รีกับแอนโทไซยานิน (Anthocyanin)",
        summary: "บลูเบอร์รีมีสารต้านอนุมูลอิสระเข้มข้น ช่วยปกป้องหลอดเลือดและชะลอความเสื่อมของระบบประสาท",
        detail: "สารสีม่วงเข้มในบลูเบอร์รีมีฤทธิ์ต้านอนุมูลอิสระสูงเป็นอันดับต้นๆ ของผลไม้ ช่วยบำรุงจอประสาทตาจากการใช้งานหน้าจอคอมพิวเตอร์และมือถือ แถมยังมีน้ำตาลต่ำและใยอาหารสูง",
        tags: ["บลูเบอร์รี", "แอนโทไซยานิน", "บำรุงสายตา", "ผลไม้"]
    },
    {
        id: "tip-10",
        category: "ระบบทางเดินอาหาร",
        icon: "🍎",
        title: "แอปเปิ้ลกับเส้นใยเพกทิน (Pectin)",
        summary: "เปลือกและเนื้อแอปเปิ้ลมีเพกทิน เป็นพรีไบโอติกส์ชั้นเลิศสำหรับแบคทีเรียดีในลำไส้",
        detail: "เพกทินเป็นใยอาหารละลายน้ำที่ช่วยดักจับไขมันและคอเลสเตอรอลในทางเดินอาหาร และเมื่อไปถึงลำไส้ใหญ่จะถูกหมักเป็นกรดไขมันสายสั้น (SCFA) ที่ช่วยเสริมความแข็งแรงของเยื่อบุลำไส้ ควรล้างให้สะอาดแล้วทานทั้งเปลือก",
        tags: ["แอปเปิ้ล", "เพกทิน", "ไฟเบอร์", "ลำไส้"]
    },
    {
        id: "tip-11",
        category: "การเผาผลาญ",
        icon: "☕",
        title: "กาแฟดำก่อนออกกำลังกาย 30-45 นาที",
        summary: "คาเฟอีนในกาแฟดำช่วยกระตุ้นระบบประสาทส่วนกลางและเพิ่มการแตกตัวของกรดไขมัน",
        detail: "การดื่มกาแฟดำ (ไม่ใส่น้ำตาลและครีมเทียม) 1 แก้วก่อนออกกำลังกาย ช่วยเพิ่มความอึด ความทนทาน และช่วยให้ออกกำลังกายได้นานขึ้นโดยรู้สึกเหนื่อยช้าลง อีกทั้งยังช่วยเร่งการเผาผลาญแคลอรีหลังซ้อม",
        tags: ["กาแฟ", "คาเฟอีน", "ออกกำลังกาย", "เผาผลาญ"]
    },
    {
        id: "tip-12",
        category: "การฟื้นฟู & ฮอร์โมน",
        icon: "😴",
        title: "การนอนหลับ 7-8 ชั่วโมงกับการคุมน้ำหนัก",
        summary: "การอดนอนทำให้ฮอร์โมนความหิว (Ghrelin) พุ่งสูง และฮอร์โมนอิ่ม (Leptin) ลดลงอย่างมาก",
        detail: "คนที่นอนน้อยกว่า 6 ชั่วโมงมักจะโหยของหวาน แป้ง และของทอดมากขึ้นในวันถัดไปโดยไม่รู้ตัว นอกจากนี้ ฮอร์โมน Growth Hormone ที่ใช้ซ่อมแซมกล้ามเนื้อจะหลั่งได้ดีที่สุดในช่วงหลับลึก (Deep Sleep) เท่านั้น",
        tags: ["การนอนหลับ", "ฮอร์โมน", "คุมอาหาร", "สุขภาพ"]
    },
    {
        id: "tip-13",
        category: "แร่ธาตุ & กล้ามเนื้อ",
        icon: "🥜",
        title: "อัลมอนด์กับแมกนีเซียมและวิตามินอี",
        summary: "อัลมอนด์ 1 กำมือเล็ก (~23 เม็ด) ให้ไขมันดี วิตามินอี และแมกนีเซียมช่วยผ่อนคลายกล้ามเนื้อ",
        detail: "แมกนีเซียมมีบทบาทสำคัญในปฏิกิริยาเคมีของร่างกายมากกว่า 300 ชนิด รวมถึงการหดและคลายตัวของกล้ามเนื้อ และการสังเคราะห์โปรตีน ทานเป็นของว่างเพื่อสุขภาพช่วงบ่ายแทนขนมกรุบกรอบได้ดีมาก",
        tags: ["อัลมอนด์", "ถั่ว", "แมกนีเซียม", "วิตามินอี"]
    },
    {
        id: "tip-14",
        category: "วิตามิน & สายตา",
        icon: "🥕",
        title: "แครอทกับเบต้าแคโรทีน (Beta-carotene)",
        summary: "เบต้าแคโรทีนในแครอทถูกเปลี่ยนเป็นวิตามินเอ ช่วยบำรุงสายตาและการมองเห็นในที่แสงน้อย",
        detail: "วิตามินเอเป็นสารที่ละลายในไขมัน ดังนั้นการปรุงแครอทด้วยการผัดกับน้ำมันเล็กน้อย หรือทานคู่กับอาหารที่มีไขมันดี จะช่วยให้ร่างกายดูดซึมสารอาหารได้สูงกว่าการทานแครอทสดเปล่าๆ หลายเท่า",
        tags: ["แครอท", "วิตามินเอ", "บำรุงสายตา", "ผัก"]
    },
    {
        id: "tip-15",
        category: "ระบบย่อย & วิตามินซี",
        icon: "🍋",
        title: "มะนาวกับการดูดซึมธาตุเหล็กจากพืช",
        summary: "กรดแอสคอร์บิก (วิตามินซี) ในมะนาวช่วยเพิ่มการดูดซึมธาตุเหล็กจากผักใบเขียวและถั่วได้ถึง 3 เท่า",
        detail: "ธาตุเหล็กจากพืช (Non-heme iron) ดูดซึมยากกว่าเนื้อสัตว์ การบีบมะนาวลงบนสลัด ผักลวก หรือต้มยำ จะช่วยเปลี่ยนธาตุเหล็กให้อยู่ในรูปที่ลำไส้ดูดซึมได้ง่าย ช่วยป้องกันภาวะโลหิตจางและอาการอ่อนเพลีย",
        tags: ["มะนาว", "วิตามินซี", "ธาตุเหล็ก", "ภูมิคุ้มกัน"]
    },
    {
        id: "tip-16",
        category: "คาร์โบไฮเดรตเชิงซ้อน",
        icon: "🍠",
        title: "มันหวาน (Sweet Potato) คาร์บ GI ต่ำอิ่มนาน",
        summary: "มันหวานให้พลังงานคงที่ ค่าน้ำตาลต่ำ (Low GI) มีใยอาหารสูงและอุดมด้วยวิตามินเอ",
        detail: "การทานมันหวานนึ่งหรืออบแทนแป้งขัดขาว ช่วยควบคุมระดับน้ำตาลในเลือดไม่ให้พุ่งพรวด ลดอาการง่วงนอนช่วงบ่าย และช่วยให้รู้สึกอิ่มสบายท้องยาวนาน เหมาะอย่างยิ่งสำหรับผู้ที่คุมน้ำหนัก",
        tags: ["มันหวาน", "คาร์โบไฮเดรต", "ใยอาหาร", "คุมน้ำหนัก"]
    },
    {
        id: "tip-17",
        category: "ฟื้นฟู & ไฮเดรชัน",
        icon: "🍉",
        title: "แตงโมกับกรดอะมิโนแอล-ซิทรูลีน (L-Citrulline)",
        summary: "แตงโมมีน้ำ 92% และมีแอล-ซิทรูลีน ช่วยขยายหลอดเลือดและลดอาการล้าของกล้ามเนื้อ",
        detail: "แอล-ซิทรูลีนช่วยเพิ่มการไหลเวียนของออกซิเจนไปยังกล้ามเนื้อ และช่วยขจัดกรดแลคติกหลังออกกำลังกาย การทานแตงโมแช่เย็นหลังออกกำลังกายช่วยดับกระหายและเติมเกลือแร่ได้อย่างเป็นธรรมชาติ",
        tags: ["แตงโม", "ซิทรูลีน", "ไฮเดรชัน", "คลายกล้ามเนื้อ"]
    },
    {
        id: "tip-18",
        category: "ผักใบเขียว",
        icon: "🥬",
        title: "ผักโขม (Spinach) กับไนเตรตธรรมชาติ",
        summary: "ผักโขมอุดมด้วยไนเตรต โฟเลต และธาตุเหล็ก ช่วยเพิ่มประสิทธิภาพการใช้ออกซิเจนของกล้ามเนื้อ",
        detail: "สารไนเตรตในผักโขมจะถูกเปลี่ยนเป็นไนตริกออกไซด์ (Nitric Oxide) ในร่างกาย ช่วยขยายหลอดเลือด ลดความดันโลหิต และทำให้นักกีฬาสามารถออกกำลังกายได้มีประสิทธิภาพยิ่งขึ้น",
        tags: ["ผักโขม", "ไนเตรต", "ความดัน", "กล้ามเนื้อ"]
    },
    {
        id: "tip-19",
        category: "สุขภาพหัวใจ & อารมณ์",
        icon: "🍫",
        title: "ดาร์กช็อกโกแลต 70%+ กับฟลาโวนอยด์",
        summary: "ดาร์กช็อกโกแลตแท้มีสารฟลาโวนอยด์สูง ช่วยลดความดันโลหิตและกระตุ้นการหลั่งเอนดอร์ฟิน",
        detail: "เลือกดาร์กช็อกโกแลตที่มีโกโก้ตั้งแต่ 70% ขึ้นไป ทานวันละ 1-2 ชิ้นเล็ก (~15-20 กรัม) ช่วยเพิ่มสารต้านอนุมูลอิสระในกระแสเลือด และช่วยผ่อนคลายความเครียดได้เป็นอย่างดีโดยไม่เพิ่มน้ำตาลส่วนเกิน",
        tags: ["ช็อกโกแลต", "ฟลาโวนอยด์", "อารมณ์ดี", "หัวใจ"]
    },
    {
        id: "tip-20",
        category: "โปรตีนพืช",
        icon: "🫘",
        title: "ถั่วเหลืองและเต้าหู้: โปรตีนไร้คอเลสเตอรอล",
        summary: "ถั่วเหลืองมีโปรตีนสมบูรณ์จากพืช พร้อมสารไอโซฟลาโวน (Isoflavones) บำรุงกระดูกและหัวใจ",
        detail: "เต้าหู้และนมถั่วเหลืองไม่ใส่น้ำตาลเป็นทางเลือกชั้นเลิศในการเพิ่มโปรตีนประจำวัน โดยไม่มีไขมันอิ่มตัวสูงหรือคอเลสเตอรอล อีกทั้งยังมีแคลเซียมและธาตุเหล็กสูง เหมาะสำหรับทุกคนที่ต้องการรักสุขภาพ",
        tags: ["ถั่วเหลือง", "เต้าหู้", "โปรตีนพืช", "แคลเซียม"]
    },
    {
        id: "tip-21",
        category: "เอนไซม์ช่วยย่อย",
        icon: "🍍",
        title: "สับปะรดกับเอนไซม์โบรมีเลน (Bromelain)",
        summary: "สับปะรดมีเอนไซม์โบรมีเลน ช่วยย่อยโปรตีนจากเนื้อสัตว์และลดอาการท้องอืดแน่นท้อง",
        detail: "หากมื้อใดทานเนื้อสัตว์เยอะ เช่น ปิ้งย่างหรือสเต๊ก การทานสับปะรดตามหลัง 2-3 ชิ้นจะช่วยให้การย่อยอาหารโปรตีนเป็นไปอย่างราบรื่นขึ้น และโบรมีเลนยังมีฤทธิ์ต้านการอักเสบในเนื้อเยื่ออีกด้วย",
        tags: ["สับปะรด", "โบรมีเลน", "ช่วยย่อย", "ผลไม้"]
    },
    {
        id: "tip-22",
        category: "วิตามินซี & การนอน",
        icon: "🥝",
        title: "กีวี: ผลไม้วิตามินซีสูง & ช่วยให้หลับลึก",
        summary: "กีวีมีวิตามินซีมากกว่าส้มถึง 2 เท่า และมีเซโรโทนินช่วยให้นอนหลับได้ง่ายและสนิทขึ้น",
        detail: "การศึกษาวิจัยพบว่าการทานผลกีวี 1-2 ผลก่อนนอนประมาณ 1 ชั่วโมง ติดต่อกัน 4 สัปดาห์ ช่วยให้ระยะเวลาในการเริ่มหลับเร็วขึ้นถึง 35% และเพิ่มคุณภาพการนอนหลับโดยรวมอย่างเห็นได้ชัด",
        tags: ["กีวี", "วิตามินซี", "ช่วยหลับ", "ผลไม้"]
    },
    {
        id: "tip-23",
        category: "โพรไบโอติกส์",
        icon: "🥛",
        title: "โยเกิร์ตธรรมชาติและสุขภาพจุลินทรีย์ในลำไส้",
        summary: "โยเกิร์ตธรรมชาติมีจุลินทรีย์โพรไบโอติกส์ที่มีชีวิต ช่วยปรับสมดุลลำไส้และเสริมภูมิคุ้มกัน 70%",
        detail: "ระบบภูมิคุ้มกันของร่างกายกว่า 70% อยู่ที่ทางเดินอาหาร การทานโยเกิร์ตรสธรรมชาติ (ไม่เติมน้ำตาล) หรือกรีกโยเกิร์ตที่ให้โปรตีนสูง ช่วยให้ระบบขับถ่ายเป็นปกติ และส่งผลดีต่ออารมณ์ผ่านแกนลำไส้-สมอง (Gut-Brain Axis)",
        tags: ["โยเกิร์ต", "โพรไบโอติกส์", "ลำไส้", "ภูมิคุ้มกัน"]
    },
    {
        id: "tip-24",
        category: "วิตามินดี & ภูมิคุ้มกัน",
        icon: "🍄",
        title: "เห็ดหอมกับเบต้ากลูแคนและวิตามินดี",
        summary: "เห็ดเป็นอาหารจากพืชเพียงไม่กี่ชนิดที่สามารถสังเคราะห์วิตามินดีได้เมื่อโดนแสงแดด",
        detail: "เห็ดมีสารเบต้ากลูแคน (Beta-glucan) ที่ช่วยกระตุ้นการทำงานของเซลล์เม็ดเลือดขาวในการดักจับเชื้อโรค และหากนำเห็ดไปตากแดดก่อนปรุงอาหาร ระดับวิตามินดีในเห็ดจะเพิ่มขึ้นอย่างมหาศาล",
        tags: ["เห็ด", "วิตามินดี", "เบต้ากลูแคน", "ภูมิคุ้มกัน"]
    },
    {
        id: "tip-25",
        category: "ใยอาหาร & คอเลสเตอรอล",
        icon: "🌾",
        title: "ข้าวโอ๊ตกับเบต้ากลูแคนลดคอเลสเตอรอล",
        summary: "ใยอาหารชนิดละลายน้ำในข้าวโอ๊ตช่วยดักจับน้ำดีและคอเลสเตอรอลในทางเดินอาหาร",
        detail: "การทานข้าวโอ๊ตเป็นประจำในมื้อเช้าช่วยลดระดับคอเลสเตอรอลรวมและ LDL ลงได้ราว 5-7% พร้อมทั้งช่วยรักษาระดับน้ำตาลในเลือดให้คงที่ ป้องกันอาการหิวโซก่อนถึงมื้อเที่ยง",
        tags: ["ข้าวโอ๊ต", "เบต้ากลูแคน", "ลดคอเลสเตอรอล", "มื้อเช้า"]
    },
    {
        id: "tip-26",
        category: "โปรตีนลีน",
        icon: "🍗",
        title: "อกไก่ลอกหนัง: ราชาแห่งโปรตีนไขมันต่ำ",
        summary: "อกไก่ปรุงสุก 100 กรัม ให้โปรตีนสูงถึง 30-31 กรัม แต่มีไขมันน้อยกว่า 3 กรัม",
        detail: "อกไก่เป็นแหล่งโปรตีนที่คุ้มค่าและย่อยง่าย เหมาะสำหรับการซ่อมแซมและเสริมสร้างกล้ามเนื้อ โดยเฉพาะช่วงที่ต้องการควบคุมปริมาณแคลอรีและไขมันในแต่ละวัน",
        tags: ["อกไก่", "โปรตีนสูง", "ไขมันต่ำ", "สร้างกล้ามเนื้อ"]
    },
    {
        id: "tip-27",
        category: "ไขมันดีหัวใจ",
        icon: "🫒",
        title: "น้ำมันมะกอก Extra Virgin กับสารโพลีฟีนอล",
        summary: "น้ำมันมะกอกสกัดเย็นอุดมด้วยสารต้านการอักเสบโอเลโอแคนทาล (Oleocanthal)",
        detail: "การใช้น้ำมันมะกอก Extra Virgin ในการปรุงอาหารที่ไม่ใช้ความร้อนสูงมาก หรือราดสลัดวันละ 1-2 ช้อนโต๊ะ มีส่วนช่วยลดการแข็งตัวของหลอดเลือดแดง และลดความเสี่ยงโรคหลอดเลือดสมองและหัวใจ",
        tags: ["น้ำมันมะกอก", "โพลีฟีนอล", "สุขภาพหัวใจ", "ต้านอักเสบ"]
    },
    {
        id: "tip-28",
        category: "ต้านภูมิแพ้ & ลดบวม",
        icon: "🧅",
        title: "หอมใหญ่กับเควอร์เซทิน (Quercetin)",
        summary: "หอมหัวใหญ่และหอมแดงมีสารเควอร์เซทินสูง ช่วยยับยั้งการหลั่งฮิสตามีนที่ทำให้เกิดภูมิแพ้",
        detail: "เควอร์เซทินในหอมใหญ่มีคุณสมบัติต้านอนุมูลอิสระ ต้านการอักเสบ และช่วยเสริมความแข็งแรงของผนังหลอดเลือดฝอย โดยสารนี้จะพบหนาแน่นที่สุดบริเวณเปลือกชั้นนอกของหัวหอม",
        tags: ["หอมใหญ่", "เควอร์เซทิน", "ต้านภูมิแพ้", "หลอดเลือด"]
    },
    {
        id: "tip-29",
        category: "โปรตีน & ไฟเบอร์",
        icon: "🫘",
        title: "ถั่วแระญี่ปุ่น (Edamame) ของว่างโปรตีนสูง",
        summary: "ถั่วแระญี่ปุ่น 1 ถ้วย ให้โปรตีนถึง 17 กรัม และไฟเบอร์สูงถึง 8 กรัม",
        detail: "เป็นของว่างเคี้ยวเพลินที่อุดมด้วยโฟเลต วิตามินเค และธาตุเหล็ก ช่วยให้อิ่มท้องได้นานโดยไม่ทำให้ระดับน้ำตาลในเลือดแกว่ง เหมาะมากสำหรับเป็นของว่างยามบ่ายระหว่างทำงาน",
        tags: ["ถั่วแระ", "ของว่าง", "โปรตีนสูง", "ไฟเบอร์"]
    },
    {
        id: "tip-30",
        category: "ลดความเค็ม & ขับโซเดียม",
        icon: "🥒",
        title: "แตงกวากับการลดอาการบวมน้ำ (Water Retention)",
        summary: "แตงกวามีน้ำเป็นส่วนประกอบ 95% และมีโพแทสเซียมช่วยขับโซเดียมส่วนเกินออกจากร่างกาย",
        detail: "หากวันไหนเผลอทานอาหารรสเค็มจัดหรือโซเดียมสูง เช่น ส้มตำ บะหมี่กึ่งสำเร็จรูป หรือชาบู การทานแตงกวาสดและดื่มน้ำเปล่าตาม จะช่วยให้ไตขับโซเดียมส่วนเกินออกทางปัสสาวะได้เร็วขึ้น ลดอาการบวมน้ำที่ใบหน้าและแขนขา",
        tags: ["แตงกวา", "ลดบวม", "ขับโซเดียม", "ผัก"]
    }
];

class HealthTipsManager {
    constructor() {
        this.tips = [...BUILTIN_HEALTH_TIPS];
        this.currentTip = null;
        this.init();
    }

    async init() {
        // Load any cached tips from local storage
        try {
            const cached = localStorage.getItem('novafit_cached_health_tips');
            if (cached) {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    this.tips = parsed;
                }
            }
        } catch (e) {
            console.warn('Could not load cached health tips:', e);
        }

        // Try to fetch updated tips in the background from remote if online
        this.fetchOnlineTipsInBackground();
    }

    async fetchOnlineTipsInBackground() {
        // Safe online fetch with fallback
        try {
            if (!navigator.onLine) return;
            const res = await fetch('https://raw.githubusercontent.com/parinya6969/nova-fit-pro/main/public/health-tips.json', { cache: 'no-cache' });
            if (res.ok) {
                const remoteTips = await res.json();
                if (Array.isArray(remoteTips) && remoteTips.length >= 10) {
                    this.tips = remoteTips;
                    localStorage.setItem('novafit_cached_health_tips', JSON.stringify(remoteTips));
                    console.log('✅ Updated health tips from online repository:', remoteTips.length);
                }
            }
        } catch (err) {
            // Quietly fallback to built-in tips
        }
    }

    getDailyTip(dateStr) {
        if (!dateStr) {
            const now = new Date();
            const offset = now.getTimezoneOffset() * 60000;
            dateStr = new Date(now.getTime() - offset).toISOString().split('T')[0];
        }

        // Deterministic hash based on YYYY-MM-DD
        let hash = 0;
        for (let i = 0; i < dateStr.length; i++) {
            hash = (hash << 5) - hash + dateStr.charCodeAt(i);
            hash |= 0;
        }
        const index = Math.abs(hash) % this.tips.length;
        this.currentTip = this.tips[index];
        return this.currentTip;
    }

    getRandomTip() {
        const randIndex = Math.floor(Math.random() * this.tips.length);
        this.currentTip = this.tips[randIndex];
        return this.currentTip;
    }

    searchTips(query) {
        const q = (query || '').trim().toLowerCase();
        if (!q) return this.tips;
        return this.tips.filter(t => {
            const matchTitle = (t.title || '').toLowerCase().includes(q);
            const matchSummary = (t.summary || '').toLowerCase().includes(q);
            const matchDetail = (t.detail || '').toLowerCase().includes(q);
            const matchTags = Array.isArray(t.tags) && t.tags.some(tag => tag.toLowerCase().includes(q));
            return matchTitle || matchSummary || matchDetail || matchTags;
        });
    }
}

// Global instance
window.healthTipsEngine = new HealthTipsManager();

// Render Daily Health Tip Widget on UI
window.renderDailyHealthTip = function (tip) {
    const activeTip = tip || window.healthTipsEngine.getDailyTip();
    if (!activeTip) return;

    const iconEl = document.getElementById('healthTipIcon');
    const catEl = document.getElementById('healthTipCategory');
    const titleEl = document.getElementById('healthTipTitle');
    const descEl = document.getElementById('healthTipDesc');

    if (iconEl) iconEl.textContent = activeTip.icon || '💡';
    if (catEl) catEl.textContent = activeTip.category || 'โภชนาการ & สุขภาพ';
    if (titleEl) titleEl.textContent = `${activeTip.icon || '💡'} ${activeTip.title}`;
    if (descEl) descEl.textContent = `${activeTip.summary} ${activeTip.detail}`;
};

// Shuffle Tip Action
window.shuffleHealthTip = function () {
    const tip = window.healthTipsEngine.getRandomTip();
    window.renderDailyHealthTip(tip);
    if (typeof showToast === 'function') {
        showToast(`🎲 สุ่มเกร็ดความรู้: ${tip.title}`);
    }
};

// Check and trigger daily tip toast notification if not shown today
window.checkDailyTipNotification = function () {
    const todayStr = new Date().toISOString().split('T')[0];
    const seenDate = localStorage.getItem('novafit_tip_seen_date');
    if (seenDate !== todayStr) {
        const tip = window.healthTipsEngine.getDailyTip(todayStr);
        if (tip && typeof showToast === 'function') {
            setTimeout(() => {
                showToast(`💡 เกร็ดความรู้สุขภาพวันนี้: ${tip.title}`);
                localStorage.setItem('novafit_tip_seen_date', todayStr);
            }, 2500);
        }
    }
};

// Open Health Tips Knowledge Base Modal
window.openHealthTipsModal = function () {
    const modal = document.getElementById('healthTipsModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    renderHealthTipsModalList('');
};

window.closeHealthTipsModal = function () {
    const modal = document.getElementById('healthTipsModal');
    if (!modal) return;
    modal.classList.add('hidden');
};

window.renderHealthTipsModalList = function (query) {
    const container = document.getElementById('healthTipsListContainer');
    if (!container) return;

    const tips = window.healthTipsEngine.searchTips(query);
    if (tips.length === 0) {
        container.innerHTML = `<div class="py-10 text-center text-slate-400 text-xs">ไม่พบเกร็ดความรู้ที่ค้นหา ลองค้นคำว่า "มะเขือเทศ", "โปรตีน", "นอนหลับ" หรือ "น้ำดื่ม"</div>`;
        return;
    }

    container.innerHTML = tips.map(t => `
        <div class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-700/40 border border-slate-200/80 dark:border-slate-700 space-y-2">
            <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                    <span class="text-xl">${t.icon || '💡'}</span>
                    <div>
                        <h4 class="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100">${t.title}</h4>
                        <span class="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">${t.category}</span>
                    </div>
                </div>
                <button type="button" onclick="shareTipToClipboard('${t.id}')" class="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold border border-slate-200 dark:border-slate-600 transition" title="คัดลอกข้อความเพื่อแชร์">
                    📋 แชร์
                </button>
            </div>
            <p class="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">${t.summary}</p>
            <p class="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">${t.detail}</p>
            <div class="flex flex-wrap gap-1 pt-1">
                ${(t.tags || []).map(tag => `<span class="text-[9px] px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-600/50 text-slate-600 dark:text-slate-300">#${tag}</span>`).join('')}
            </div>
        </div>
    `).join('');
};

window.shareTipToClipboard = function (tipId) {
    const tip = window.healthTipsEngine.tips.find(t => t.id === tipId);
    if (!tip) return;
    const shareText = `💡 เกร็ดความรู้สุขภาพจาก NovaFit Pro:\n${tip.icon} ${tip.title}\n\n${tip.summary}\n${tip.detail}\n\nติดตามสุขภาพของคุณได้ที่: https://fitmacro-pro-benz.web.app`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(shareText).then(() => {
            if (typeof showToast === 'function') showToast('📋 คัดลอกเกร็ดความรู้ไปยังคลิปบอร์ดแล้ว!');
        }).catch(() => {
            alert(shareText);
        });
    } else {
        alert(shareText);
    }
};
