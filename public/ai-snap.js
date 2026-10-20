// ==========================================
// NovaFit Pro - AI Snap & Log Engine (v5.7.0)
// Powered by Google Gemini Vision API (Free Tier)
// Integrated Anti-Abuse Quota Protection (15 scans/day)
// ==========================================

const AI_SNAP_STORAGE_KEY = 'novafit_gemini_api_key';
const SYSTEM_AI_KEY_STORAGE = 'novafit_system_gemini_api_key';
const DAILY_AI_SCAN_LIMIT = 15;

// Authorized Admin Emails (Bypass quota & full administrative rights)
const ADMIN_EMAILS = [
    'benznova01@gmail.com',
    'parinya6969@gmail.com'
];

// Helper: Check if running in UAT (Preview) or Local Development environment
function isUatEnvironment() {
    const host = window.location.hostname || '';
    return host.includes('uat') || host === 'localhost' || host === '127.0.0.1';
}

// Helper: Check if current logged-in user is an administrator
function isUserAdmin() {
    const email = (window.currentUser && window.currentUser.email) || '';
    return ADMIN_EMAILS.includes(email.toLowerCase());
}

// Helper: Get today ISO string (YYYY-MM-DD)
function getTodayIsoDate() {
    if (typeof window.getTodayStr === 'function') {
        return window.getTodayStr();
    }
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().split('T')[0];
}

// Daily Quota Tracking per User / Date
function getTodayAiScanUsage() {
    const today = getTodayIsoDate();
    if (!window.state) return 0;
    if (!window.state.aiDailyScans || typeof window.state.aiDailyScans !== 'object') {
        window.state.aiDailyScans = {};
    }
    return Number(window.state.aiDailyScans[today]) || 0;
}

function incrementAiScanUsage() {
    const today = getTodayIsoDate();
    if (!window.state) window.state = {};
    if (!window.state.aiDailyScans || typeof window.state.aiDailyScans !== 'object') {
        window.state.aiDailyScans = {};
    }
    const current = Number(window.state.aiDailyScans[today]) || 0;
    window.state.aiDailyScans[today] = current + 1;

    if (typeof window.saveState === 'function') {
        window.saveState();
    }
    if (typeof window.triggerCloudSync === 'function') {
        window.triggerCloudSync(false);
    }
    updateAiSnapQuotaDisplay();
}

function isAiQuotaExceeded() {
    // UAT preview channel & Admin accounts have UNLIMITED scanning capability
    if (isUatEnvironment() || isUserAdmin()) {
        return false;
    }
    return getTodayAiScanUsage() >= DAILY_AI_SCAN_LIMIT;
}

// Demo Food Knowledge Base for instant testing when no API key is provided
const DEMO_AI_FOODS = [
    {
        foodName: "ข้าวกะเพราหมูสับไข่ดาว",
        servingSize: "1 จาน (ประมาณ 350 กรัม)",
        cal: 620,
        p: 26,
        c: 65,
        f: 28,
        confidence: "high",
        ingredients: ["ข้าวสวย 1.5 ทัพพี", "หมูสับติดมันเล็กน้อย 100g", "ไข่ดาวทอดกรอบ 1 ฟอง", "ใบกะเพรา พริก กระเทียม"],
        healthyTip: "💡 แนะนำ: หากเปลี่ยนเป็นไข่ต้มและผัดน้ำมันน้อย จะลดแคลอรีลงได้ถึง 120-150 kcal"
    },
    {
        foodName: "ส้มตำไทย + อกไก่ย่าง",
        servingSize: "1 เซ็ต (ส้มตำ 1 จาน + อกไก่ 1 ชิ้น)",
        cal: 380,
        p: 38,
        c: 32,
        f: 8,
        confidence: "high",
        ingredients: ["มะละกอดิบ ถั่วลิสง กุ้งแห้ง", "อกไก่ย่างลอกหนัง 150g", "พริก มะนาว น้ำปลา"],
        healthyTip: "🌟 ยอดเยี่ยม: โปรตีนสูงมาก ไขมันต่ำ เหมาะสำหรับมื้อลีนสร้างกล้ามเนื้อ"
    },
    {
        foodName: "ข้าวมันไก่ต้ม (ไม่เอาหนัง)",
        servingSize: "1 จาน (ประมาณ 320 กรัม)",
        cal: 510,
        p: 32,
        c: 62,
        f: 14,
        confidence: "high",
        ingredients: ["ข้าวมันหุงน้ำซุปไก่", "เนื้ออกไก่ต้มลอกหนัง", "แตงกวา น้ำจิ้มเต้าเจี้ยว"],
        healthyTip: "💡 เคล็ดลับ: สั่งไม่เอาหนังช่วยลดไขมันอิ่มตัวได้มากกว่า 10-12 กรัม"
    }
];

let _currentAiImageBase64 = null;
let _currentAiImageMime = 'image/jpeg';
let _currentAiAnalyzedData = null;

// API Key Management
function getGeminiApiKey() {
    return localStorage.getItem(AI_SNAP_STORAGE_KEY) ||
           window._systemGeminiApiKey ||
           sessionStorage.getItem(SYSTEM_AI_KEY_STORAGE) ||
           localStorage.getItem(SYSTEM_AI_KEY_STORAGE) ||
           '';
}

function setGeminiApiKey(key) {
    if (key && key.trim()) {
        localStorage.setItem(AI_SNAP_STORAGE_KEY, key.trim());
    } else {
        localStorage.removeItem(AI_SNAP_STORAGE_KEY);
    }
    updateAiSnapQuotaDisplay();
}

// Update Quota and Key Indicator Badges in UI
function updateAiSnapQuotaDisplay() {
    const quotaPill = document.getElementById('aiSnapQuotaPill');
    const keyBadge = document.getElementById('aiSnapApiKeyBadge');
    const key = getGeminiApiKey();

    if (keyBadge) {
        keyBadge.textContent = key ? '✓ เชื่อมต่อ Gemini AI แล้ว' : '⚡ โหมดตัวอย่าง (Demo)';
        keyBadge.className = key
            ? 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
            : 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30';
    }

    if (!quotaPill) return;

    if (isUatEnvironment()) {
        quotaPill.textContent = '⚡ UAT Mode (ไม่จำกัดโควตา)';
        quotaPill.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30';
    } else if (isUserAdmin()) {
        quotaPill.textContent = '👑 แอดมิน (ไม่จำกัดโควตา)';
        quotaPill.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30';
    } else if (!window.currentUser) {
        quotaPill.textContent = '🔐 ต้องเข้าสู่ระบบ';
        quotaPill.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30';
    } else {
        const usage = getTodayAiScanUsage();
        const remaining = Math.max(0, DAILY_AI_SCAN_LIMIT - usage);
        quotaPill.textContent = `โควตาวันนี้: เหลือ ${remaining}/${DAILY_AI_SCAN_LIMIT} ครั้ง`;
        quotaPill.className = remaining > 0
            ? 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
            : 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30';
    }
}

// Compress Image client-side before sending to Gemini (Saves bandwidth & memory)
function compressImageToDataUrl(file, maxDimension = 1024, quality = 0.8) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxDimension) {
                        height = Math.round((height * maxDimension) / width);
                        width = maxDimension;
                    }
                } else {
                    if (height > maxDimension) {
                        width = Math.round((width * maxDimension) / height);
                        height = maxDimension;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const dataUrl = canvas.toDataURL('image/jpeg', quality);
                resolve(dataUrl);
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Open AI Snap Modal
function openAiSnapModal() {
    const modal = document.getElementById('aiSnapModal');
    if (!modal) return;

    // Reset state
    _currentAiImageBase64 = null;
    _currentAiAnalyzedData = null;

    const elAuthReq = document.getElementById('aiSnapAuthRequiredState');
    const elQuotaExc = document.getElementById('aiSnapQuotaExceededState');
    const elUpload = document.getElementById('aiSnapUploadState');
    const elPreview = document.getElementById('aiSnapPreviewState');
    const elLoading = document.getElementById('aiSnapLoadingState');
    const elResult = document.getElementById('aiSnapResultState');

    [elAuthReq, elQuotaExc, elUpload, elPreview, elLoading, elResult].forEach(el => el?.classList.add('hidden'));

    updateAiSnapQuotaDisplay();

    // Check 1: Must be logged in on Production (UAT preview channel allows free testing)
    if (!window.currentUser && !isUatEnvironment()) {
        elAuthReq?.classList.remove('hidden');
    }
    // Check 2: Daily Quota Limit (15 scans/day on PROD, bypass for UAT & Admin)
    else if (isAiQuotaExceeded()) {
        elQuotaExc?.classList.remove('hidden');
    }
    // Check 3: Ready to upload & take photo
    else {
        elUpload?.classList.remove('hidden');
    }

    if (window.openModalAnimated) {
        window.openModalAnimated('aiSnapModal');
    } else {
        modal.classList.remove('hidden');
    }
}

function closeAiSnapModal() {
    if (window.closeModalAnimated) {
        window.closeModalAnimated('aiSnapModal');
    } else {
        document.getElementById('aiSnapModal')?.classList.add('hidden');
    }
}

function closeAiSnapModalOnBackdrop(e) {
    if (e && e.target && e.target.id === 'aiSnapModal') {
        closeAiSnapModal();
    }
}

// Handle Photo File Selected
async function handleAiPhotoSelected(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    try {
        const compressedDataUrl = await compressImageToDataUrl(file, 1024, 0.82);
        const parts = compressedDataUrl.split(',');
        _currentAiImageMime = 'image/jpeg';
        _currentAiImageBase64 = parts[1];

        // Show Preview State
        const previewImg = document.getElementById('aiSnapPreviewImg');
        if (previewImg) previewImg.src = compressedDataUrl;

        document.getElementById('aiSnapUploadState')?.classList.add('hidden');
        document.getElementById('aiSnapPreviewState')?.classList.remove('hidden');
        document.getElementById('aiSnapLoadingState')?.classList.add('hidden');
        document.getElementById('aiSnapResultState')?.classList.add('hidden');
    } catch (err) {
        console.error('Failed to process image:', err);
        alert('ไม่สามารถประมวลผลรูปภาพได้ กรุณาลองใหม่อีกครั้ง');
    }
}

// Trigger image input from camera or gallery
function triggerAiCameraInput(capture = true) {
    const input = document.getElementById('aiSnapFileInput');
    if (!input) return;
    if (capture) {
        input.setAttribute('capture', 'environment');
    } else {
        input.removeAttribute('capture');
    }
    input.value = '';
    input.click();
}

function resetAiSnapImage() {
    _currentAiImageBase64 = null;
    _currentAiAnalyzedData = null;
    document.getElementById('aiSnapUploadState')?.classList.remove('hidden');
    document.getElementById('aiSnapPreviewState')?.classList.add('hidden');
    document.getElementById('aiSnapLoadingState')?.classList.add('hidden');
    document.getElementById('aiSnapResultState')?.classList.add('hidden');
}

// Call Google Gemini Vision API
async function analyzeAiPhoto() {
    if (!_currentAiImageBase64) {
        alert('กรุณาเลือกหรือถ่ายรูปอาหารก่อนครับ');
        return;
    }

    // Safeguard 1: Auth check on Production (UAT preview channel allows free testing)
    if (!window.currentUser && !isUatEnvironment()) {
        alert('กรุณาเข้าสู่ระบบด้วย Google ก่อนใช้งานฟีเจอร์ AI Snap ครับ');
        openAiSnapModal();
        return;
    }

    // Safeguard 2: Quota check (15 scans/day on PROD, bypass for UAT & Admin)
    if (isAiQuotaExceeded()) {
        alert('คุณใช้โควตา AI ประจำวันครบ 15/15 ครั้งแล้ว โควตาจะรีเซ็ตใหม่ในวันพรุ่งนี้เวลา 00:00 น.');
        openAiSnapModal();
        return;
    }

    const note = (document.getElementById('aiSnapUserNote')?.value || '').trim();
    const apiKey = getGeminiApiKey();

    // Show Loading Animation
    document.getElementById('aiSnapPreviewState')?.classList.add('hidden');
    document.getElementById('aiSnapLoadingState')?.classList.remove('hidden');
    document.getElementById('aiSnapResultState')?.classList.add('hidden');

    // If NO API key is entered, use realistic Demo Simulation
    if (!apiKey) {
        setTimeout(() => {
            const randomDemo = DEMO_AI_FOODS[Math.floor(Math.random() * DEMO_AI_FOODS.length)];
            incrementAiScanUsage();
            renderAiAnalysisResult(randomDemo, true);
        }, 1500);
        return;
    }

    // Call Real Gemini 1.5 Flash Vision API
    try {
        const promptText = `
คุณคือนักกำหนดอาหารและผู้เชี่ยวชาญด้านโภชนาการไทย โปรดวิเคราะห์รูปภาพอาหารนี้อย่างละเอียด และตอบกลับเป็น JSON เท่านั้น โดยมีโครงสร้างดังนี้:
{
  "foodName": "ชื่ออาหารภาษาไทย",
  "servingSize": "ขนาดเสิร์ฟโดยประมาณ เช่น 1 จาน (300 กรัม)",
  "cal": ตัวเลขแคลอรีรวม (kcal),
  "p": ตัวเลขโปรตีน (กรัม),
  "c": ตัวเลขคาร์โบไฮเดรต (กรัม),
  "f": ตัวเลขไขมัน (กรัม),
  "ingredients": ["วัตถุดิบ 1", "วัตถุดิบ 2", "วัตถุดิบ 3"],
  "confidence": "high หรือ medium หรือ low",
  "healthyTip": "คำแนะนำโภชนาการสั้นๆ 1 ประโยค"
}
คำแนะนำเพิ่มเติมจากผู้ใช้: ${note || "ไม่มี"}
`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            { text: promptText },
                            {
                                inline_data: {
                                    mime_type: _currentAiImageMime,
                                    data: _currentAiImageBase64
                                }
                            }
                        ]
                    }
                ],
                generationConfig: {
                    response_mime_type: 'application/json',
                    temperature: 0.2
                }
            })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error?.message || 'Gemini API Error');
        }

        const data = await response.json();
        const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!jsonText) throw new Error('ไม่ได้รับข้อมูลการตอบกลับจาก AI');

        const parsedResult = JSON.parse(jsonText);
        incrementAiScanUsage();
        renderAiAnalysisResult(parsedResult, false);
    } catch (err) {
        console.error('Gemini Vision analysis failed:', err);
        alert('⚠️ เกิดข้อผิดพลาดในการวิเคราะห์ด้วย Gemini: ' + err.message + '\n\nระบบจะแสดงผลการประเมินแบบจำลองแทนให้ชั่วคราว');
        const fallback = DEMO_AI_FOODS[0];
        incrementAiScanUsage();
        renderAiAnalysisResult(fallback, true);
    }
}

// Render Analysis Results into UI Card
function renderAiAnalysisResult(result, isDemo = false) {
    _currentAiAnalyzedData = result;

    document.getElementById('aiSnapLoadingState')?.classList.add('hidden');
    document.getElementById('aiSnapResultState')?.classList.remove('hidden');

    const inName = document.getElementById('aiResFoodName');
    const inCal = document.getElementById('aiResCal');
    const inP = document.getElementById('aiResP');
    const inC = document.getElementById('aiResC');
    const inF = document.getElementById('aiResF');
    const txtServing = document.getElementById('aiResServing');
    const listIngredients = document.getElementById('aiResIngredients');
    const txtTip = document.getElementById('aiResTip');
    const demoBadge = document.getElementById('aiResDemoBadge');

    if (inName) inName.value = result.foodName || 'เมนูอาหาร';
    if (inCal) inCal.value = Math.round(Number(result.cal) || 0);
    if (inP) inP.value = Math.round(Number(result.p) || 0);
    if (inC) inC.value = Math.round(Number(result.c) || 0);
    if (inF) inF.value = Math.round(Number(result.f) || 0);
    if (txtServing) txtServing.textContent = result.servingSize || '1 ที่';

    if (demoBadge) {
        demoBadge.classList.toggle('hidden', !isDemo);
    }

    if (listIngredients) {
        const ings = Array.isArray(result.ingredients) ? result.ingredients : [];
        listIngredients.innerHTML = ings.map(i => `<span class="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 text-[11px]">${i}</span>`).join('');
    }

    if (txtTip) {
        txtTip.textContent = result.healthyTip || 'แนะนำรับประทานคู่กับผักสดเพื่อเพิ่มใยอาหาร';
    }

    // Set default target meal based on current active meal
    const activeMeal = (window.state && window.state.activeMeal) || 'breakfast';
    const selectMeal = document.getElementById('aiResMealSelect');
    if (selectMeal) selectMeal.value = activeMeal;
}

// Save analyzed meal into Daily Logs
function saveAiAnalyzedMeal() {
    const inName = document.getElementById('aiResFoodName');
    const inCal = document.getElementById('aiResCal');
    const inP = document.getElementById('aiResP');
    const inC = document.getElementById('aiResC');
    const inF = document.getElementById('aiResF');
    const selectMeal = document.getElementById('aiResMealSelect');

    const name = inName ? inName.value.trim() : 'เมนูอาหาร (AI)';
    const cal = Math.round(Number(inCal?.value) || 0);
    const p = Math.round(Number(inP?.value) || 0);
    const c = Math.round(Number(inC?.value) || 0);
    const f = Math.round(Number(inF?.value) || 0);
    const meal = selectMeal ? selectMeal.value : 'lunch';

    if (!window.state) {
        alert('เกิดข้อผิดพลาด: ไม่พบ state ของระบบ');
        return;
    }

    const dStr = window.state.selectedDate;
    if (!window.state.logsByDate) window.state.logsByDate = {};
    if (!window.state.logsByDate[dStr]) window.state.logsByDate[dStr] = [];

    const newLogItem = {
        name,
        cal,
        p,
        c,
        f,
        portion: 1,
        meal,
        servingSize: _currentAiAnalyzedData?.servingSize || '1 ที่',
        timestamp: Date.now(),
        source: 'ai_snap'
    };

    window.state.logsByDate[dStr].push(newLogItem);
    if (window.saveState) window.saveState();
    if (window.renderAll) window.renderAll();

    closeAiSnapModal();
    if (window.showToast) {
        window.showToast(`📸 บันทึก "${name}" (${cal} kcal) ด้วย AI สำเร็จแล้ว!`);
    }
}

// API Key Settings Modal
function promptEditGeminiApiKey() {
    const current = getGeminiApiKey();
    const input = prompt(
        "🔑 กรุณากรอก Google Gemini API Key ของคุณ:\n(รับคีย์ฟรีได้ทันทีที่ https://aistudio.google.com/app/apikey)\n\n* หากเว้นว่างไว้ ระบบจะใช้โหมดตัวอย่าง (Demo Simulation) ให้ทดสอบฟรี:",
        current
    );

    if (input !== null) {
        setGeminiApiKey(input.trim());
        const key = getGeminiApiKey();
        const keyBadge = document.getElementById('aiSnapApiKeyBadge');
        if (keyBadge) {
            keyBadge.textContent = key ? '✓ เชื่อมต่อ Gemini API แล้ว' : '⚡ โหมดตัวอย่าง (Demo)';
            keyBadge.className = key
                ? 'text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                : 'text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30';
        }
        if (window.showToast) {
            window.showToast(key ? '✓ บันทึก Gemini API Key เรียบร้อยแล้ว' : 'เปลี่ยนเป็นโหมดตัวอย่าง (Demo)');
        }
    }
}

// Trigger Google Login popup from AI Snap Modal
async function loginWithGoogleFromAiSnap() {
    try {
        if (typeof window.handleGoogleLogin === 'function') {
            await window.handleGoogleLogin();
        } else if (typeof window.loginWithGoogle === 'function') {
            await window.loginWithGoogle();
        } else {
            const btn = document.getElementById('btnGoogleLogin');
            if (btn) btn.click();
        }
    } catch (e) {
        console.error('Login from AI Snap failed:', e);
    }
    // Re-evaluate modal view if logged in
    setTimeout(() => {
        if (window.currentUser) {
            openAiSnapModal();
        }
    }, 600);
}

// Close Modal and scroll to Food Search for manual search
function closeAiSnapModalAndFocusSearch() {
    closeAiSnapModal();
    const searchInput = document.getElementById('foodSearchInput');
    if (searchInput) {
        setTimeout(() => {
            searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            searchInput.focus();
        }, 200);
    }
}

// Window attachments for HTML inline handlers
window.openAiSnapModal = openAiSnapModal;
window.closeAiSnapModal = closeAiSnapModal;
window.closeAiSnapModalOnBackdrop = closeAiSnapModalOnBackdrop;
window.handleAiPhotoSelected = handleAiPhotoSelected;
window.triggerAiCameraInput = triggerAiCameraInput;
window.resetAiSnapImage = resetAiSnapImage;
window.analyzeAiPhoto = analyzeAiPhoto;
window.saveAiAnalyzedMeal = saveAiAnalyzedMeal;
window.promptEditGeminiApiKey = promptEditGeminiApiKey;
window.updateAiSnapQuotaDisplay = updateAiSnapQuotaDisplay;
window.loginWithGoogleFromAiSnap = loginWithGoogleFromAiSnap;
window.closeAiSnapModalAndFocusSearch = closeAiSnapModalAndFocusSearch;
window.getTodayAiScanUsage = getTodayAiScanUsage;
window.incrementAiScanUsage = incrementAiScanUsage;
window.isAiQuotaExceeded = isAiQuotaExceeded;
window.isUatEnvironment = isUatEnvironment;
window.isUserAdmin = isUserAdmin;
