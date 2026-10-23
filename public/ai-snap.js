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

// Control AI Snap visibility: Enabled across all environments (PROD & UAT)
function isAiSnapEnabled() {
    return true;
}

function applyAiSnapEnvironmentGate() {
    const enabled = isAiSnapEnabled();
    const btnMain = document.getElementById('btnAiSnapMain');
    const btnTools = document.getElementById('btnAiSnapTools');
    const btnVoiceMain = document.getElementById('btnAiVoiceMain');
    const btnVoiceTools = document.getElementById('btnAiVoiceTools');
    if (!enabled) {
        if (btnMain) btnMain.classList.add('hidden');
        if (btnTools) btnTools.classList.add('hidden');
        if (btnVoiceMain) btnVoiceMain.classList.add('hidden');
        if (btnVoiceTools) btnVoiceTools.classList.add('hidden');
    } else {
        if (btnMain) btnMain.classList.remove('hidden');
        if (btnTools) btnTools.classList.remove('hidden');
        if (btnVoiceMain) btnVoiceMain.classList.remove('hidden');
        if (btnVoiceTools) btnVoiceTools.classList.remove('hidden');
    }

    const voiceInput = document.getElementById('aiVoiceTextInput');
    if (voiceInput && !voiceInput._hasAiSyncListener) {
        voiceInput._hasAiSyncListener = true;
        voiceInput.addEventListener('input', () => {
            if (!_isSpeechRecording) {
                _speechBaseText = voiceInput.value.trim();
            } else if (voiceInput.value === '') {
                _speechBaseText = '';
            }
        });
    }
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyAiSnapEnvironmentGate);
} else {
    applyAiSnapEnvironmentGate();
}
window.addEventListener('load', applyAiSnapEnvironmentGate);

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

function getDailyAiScanLimit() {
    const sys = Number(window._systemDailyQuota) || Number(localStorage.getItem('novafit_system_daily_quota'));
    return (sys && sys > 0) ? sys : DAILY_AI_SCAN_LIMIT;
}

function isAiQuotaExceeded() {
    // UAT preview channel & Admin accounts have UNLIMITED scanning capability
    if (isUatEnvironment() || isUserAdmin()) {
        return false;
    }
    return getTodayAiScanUsage() >= getDailyAiScanLimit();
}

// Demo Food Knowledge Base for instant testing when no API key is provided
const DEMO_AI_FOODS = [
    {
        foodName: "ข้าวหมูกระเทียม + แตงกวา",
        servingSize: "1 จาน (ประมาณ 350 กรัม)",
        cal: 540,
        p: 28,
        c: 62,
        f: 20,
        confidence: "high",
        ingredients: ["ข้าวสวย 1.5 ทัพพี", "เนื้อหมูผัดกระเทียมพริกไทย 120g", "แตงกวาสดหั่นแว่น", "ผักชีโรยหน้า"],
        healthyTip: "💡 แนะนำ: หมูกระเทียมโปรตีนเน้นๆ มีแตงกวาเพิ่มใยอาหาร หากเลือกหมูเนื้อแดงไม่ติดมันจะช่วยลดไขมันได้อีกครับ"
    },
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

// Validate if Gemini API Key is in correct Google AI Studio format (AIzaSy... or AQ....)
function isValidGeminiApiKey(key) {
    if (typeof key !== 'string') return false;
    const trimmed = key.trim();
    return (trimmed.startsWith('AIzaSy') || trimmed.startsWith('AQ.')) && trimmed.length >= 30;
}

// API Key Management
function getGeminiApiKey() {
    const raw = localStorage.getItem(AI_SNAP_STORAGE_KEY) ||
           window._systemGeminiApiKey ||
           sessionStorage.getItem(SYSTEM_AI_KEY_STORAGE) ||
           localStorage.getItem(SYSTEM_AI_KEY_STORAGE) ||
           '';
    if (isValidGeminiApiKey(raw)) {
        return raw.trim();
    }
    return '';
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
        const limit = getDailyAiScanLimit();
        const remaining = Math.max(0, limit - usage);
        quotaPill.textContent = `โควตาวันนี้: เหลือ ${remaining}/${limit} ครั้ง`;
        quotaPill.className = remaining > 0
            ? 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
            : 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30';
    }
}

// Compress Image client-side before sending to Gemini (640px @ 0.70 quality for 10x faster network upload)
function compressImageToDataUrl(file, maxDimension = 640, quality = 0.70) {
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

// Open AI Snap & Voice Modal
function openAiSnapModal(initialTab = 'photo') {
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
        renderAiSnapRecentDishes();
    }

    switchAiModalTab(initialTab);

    if (window.openModalAnimated) {
        window.openModalAnimated('aiSnapModal');
    } else {
        modal.classList.remove('hidden');
    }
}

function closeAiSnapModal() {
    stopAiVoiceRecording();
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
        const compressedDataUrl = await compressImageToDataUrl(file, 640, 0.70);
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
            let matched = DEMO_AI_FOODS[0];
            if (note) {
                const found = DEMO_AI_FOODS.find(f => f.foodName.includes(note) || f.ingredients.some(i => i.includes(note)));
                if (found) matched = found;
            }
            incrementAiScanUsage();
            renderAiAnalysisResult(matched, true);
        }, 1200);
        return;
    }

    // Call Real Gemini Vision API with Multi-Model Fallback Chain
    // (gemini-3.5-flash-lite ~1.1s -> gemini-3.1-flash-lite ~1.7s -> gemini-flash-lite-latest ~2.6s -> gemini-3.8-flash)
    const candidateModels = [
        'gemini-3.5-flash-lite',
        'gemini-3.1-flash-lite',
        'gemini-flash-lite-latest',
        'gemini-3.8-flash'
    ];

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

    const statusEl = document.getElementById('aiSnapLoadingStatusText');
    const subStatusEl = document.getElementById('aiSnapLoadingSubText');

    let parsedResult = null;
    let successfulModel = null;
    let lastError = null;

    for (let i = 0; i < candidateModels.length; i++) {
        const modelName = candidateModels[i];
        if (statusEl) {
            statusEl.textContent = i === 0
                ? 'AI กำลังแยกแยะวัตถุดิบและคำนวณแคลอรี...'
                : `กำลังเชื่อมต่อช่องทางสำรอง (${modelName.replace('gemini-', '')})...`;
        }
        if (subStatusEl) {
            subStatusEl.textContent = i === 0
                ? 'วิเคราะห์สัดส่วนอาหาร คำนวณโปรตีน คาร์โบไฮเดรต และไขมัน'
                : 'ปรับความเร็วด้วย Gemini Flash-Lite ความเร็วสูงพิเศษ';
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s per candidate

            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(apiKey)}`;
            const response = await fetch(url, {
                method: 'POST',
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': apiKey
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                { text: promptText },
                                {
                                    inlineData: {
                                        mimeType: _currentAiImageMime || 'image/jpeg',
                                        data: _currentAiImageBase64
                                    }
                                }
                            ]
                        }
                    ],
                    generationConfig: {
                        responseMimeType: 'application/json',
                        temperature: 0.2
                    }
                })
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
                let errDetail = '';
                try {
                    const errJson = await response.json();
                    errDetail = errJson.error?.message || response.statusText;
                } catch (e) {
                    errDetail = `HTTP ${response.status}`;
                }

                // If API key itself is rejected by Google, abort retry early
                if (response.status === 400 && (errDetail.includes('API key') || errDetail.includes('INVALID_ARGUMENT'))) {
                    throw new Error(`Google API Key ไม่ถูกต้อง: ${errDetail}`);
                }
                if (response.status === 403) {
                    throw new Error(`Google API Key ถูกปฏิเสธ (403): ${errDetail}`);
                }

                console.warn(`Model ${modelName} returned HTTP ${response.status}: ${errDetail}. Attempting next model...`);
                lastError = new Error(`${modelName} (${errDetail})`);
                continue;
            }

            const data = await response.json();
            const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!jsonText) {
                console.warn(`Model ${modelName} returned empty candidate parts.`);
                lastError = new Error(`${modelName}: ไม่พบผลลัพธ์จาก AI`);
                continue;
            }

            parsedResult = JSON.parse(jsonText);
            successfulModel = modelName;
            break; // Succeeded! Break loop
        } catch (err) {
            console.warn(`Attempt with ${modelName} failed:`, err);
            lastError = err;
            if (err.message && err.message.includes('API Key')) {
                break;
            }
        }
    }

    if (parsedResult) {
        console.log(`[AI Snap] Success via model: ${successfulModel}`, parsedResult);
        incrementAiScanUsage();
        renderAiAnalysisResult(parsedResult, false);
    } else {
        console.error('All Gemini candidate models failed:', lastError);
        const errMsg = (lastError && lastError.name === 'AbortError')
            ? 'คำขอหมดเวลา (อินเทอร์เน็ตอาจช้าหรือสัญญาณหลุด)'
            : ((lastError && lastError.message) || 'เซิร์ฟเวอร์ AI มีผู้ใช้งานหนาแน่น');

        alert(`⚠️ การเชื่อมต่อ Gemini: ${errMsg}\n\nระบบจะประมาณการจากคลังเมนูอาหารตัวอย่างให้ก่อนครับ`);
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

    updateAiSnapFavButton(result.foodName || '');
    updateAiSnapCustomButton(result.foodName || '');
}

// Record AI Scan Event to Firestore for Admin Audit & Quota Analytics
async function recordAiScanAuditLog(analyzedData) {
    try {
        if (!window.currentUser || !window.firebaseDb || !window.firestoreCollection || !window.firestoreAddDoc) return;
        const user = window.currentUser;
        await window.firestoreAddDoc(window.firestoreCollection(window.firebaseDb, 'ai_scan_logs'), {
            userId: user.uid,
            userEmail: user.email || 'guest',
            userName: user.displayName || user.email || 'ผู้ใช้งาน',
            userPhoto: user.photoURL || '',
            foodName: analyzedData.foodName || 'เมนูอาหาร',
            cal: Number(analyzedData.cal) || 0,
            p: Number(analyzedData.p) || 0,
            c: Number(analyzedData.c) || 0,
            f: Number(analyzedData.f) || 0,
            servingSize: analyzedData.servingSize || '1 ที่',
            timestamp: Date.now(),
            dateStr: getTodayIsoDate(),
            environment: isUatEnvironment() ? 'uat' : 'prod'
        });
    } catch (e) {
        console.warn('Could not record AI scan audit log:', e);
    }
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

    const uniqueId = 'ai_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
    const newLogItem = {
        id: uniqueId,
        name,
        cal,
        p,
        c,
        f,
        portion: 1,
        baseCal: cal,
        baseP: p,
        baseC: c,
        baseF: f,
        time: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
        meal,
        servingSize: _currentAiAnalyzedData?.servingSize || '1 ที่',
        timestamp: Date.now(),
        source: 'ai_snap'
    };

    window.state.logsByDate[dStr].push(newLogItem);
    if (window.saveState) window.saveState();
    if (window.renderAll) window.renderAll();
    if (window.triggerCloudSync) window.triggerCloudSync(false);
    recordAiScanAuditLog({ foodName: name, cal, p, c, f, servingSize: newLogItem.servingSize });

    const rawThumb = _currentAiImageBase64 ? `data:${_currentAiImageMime};base64,${_currentAiImageBase64}` : '';
    saveToRecentPhotos({
        foodName: name,
        cal,
        p,
        c,
        f,
        servingSize: newLogItem.servingSize,
        ingredients: _currentAiAnalyzedData?.ingredients || [],
        healthyTip: _currentAiAnalyzedData?.healthyTip || ''
    }, rawThumb);

    closeAiSnapModal();
    if (window.showToast) {
        window.showToast(`📸 บันทึก "${name}" (${cal} kcal) ด้วย AI สำเร็จแล้ว!`);
    }
}


// ==========================================
// AI SNAP FAVORITES & CUSTOM FOOD LOGIC (v5.9.0)
// ==========================================
function addCurrentAiSnapToFavorites() {
    const inName = document.getElementById('aiResFoodName');
    const name = inName ? inName.value.trim() : (_currentAiAnalyzedData?.foodName || '');
    if (!name) return;
    if (!window.state) return;
    if (!Array.isArray(window.state.favorites)) window.state.favorites = [];

    const isFav = window.state.favorites.includes(name);
    if (isFav) {
        window.state.favorites = window.state.favorites.filter(x => x !== name);
        if (window.showToast) window.showToast(`นำ "${name}" ออกจากเมนูโปรดแล้ว`);
    } else {
        window.state.favorites.push(name);
        if (window.showToast) window.showToast(`⭐ บันทึก "${name}" เข้าเมนูโปรดแล้ว!`);
    }
    if (window.saveState) window.saveState();
    if (window.renderFoodDatabaseExplorer) window.renderFoodDatabaseExplorer();
    updateAiSnapFavButton(name);
}

function updateAiSnapFavButton(name) {
    const btn = document.getElementById('btnAiSnapAddFav');
    if (!btn || !window.state) return;
    const isFav = Array.isArray(window.state.favorites) && window.state.favorites.includes(name);
    if (isFav) {
        btn.innerHTML = '<span>★</span> <span>อยู่ในเมนูโปรดแล้ว</span>';
        btn.className = 'flex-1 py-2 px-2.5 rounded-xl bg-amber-500 text-white font-bold text-xs shadow-xs transition flex items-center justify-center gap-1 cursor-pointer';
    } else {
        btn.innerHTML = '<span>☆</span> <span>เพิ่มเป็นเมนูโปรด</span>';
        btn.className = 'flex-1 py-2 px-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-600 dark:text-amber-400 font-bold text-xs border border-amber-500/30 transition flex items-center justify-center gap-1 cursor-pointer';
    }
}

function addCurrentAiSnapToCustomFood() {
    const inName = document.getElementById('aiResFoodName');
    const inCal = document.getElementById('aiResCal');
    const inP = document.getElementById('aiResP');
    const inC = document.getElementById('aiResC');
    const inF = document.getElementById('aiResF');
    const txtServing = document.getElementById('aiResServing');

    const name = inName ? inName.value.trim() : (_currentAiAnalyzedData?.foodName || '');
    if (!name) return;
    if (!window.state) return;
    if (!Array.isArray(window.state.customPresets)) window.state.customPresets = [];

    const cal = Math.round(Number(inCal?.value) || 0);
    const p = Math.round(Number(inP?.value) || 0);
    const c = Math.round(Number(inC?.value) || 0);
    const f = Math.round(Number(inF?.value) || 0);
    const serving = (txtServing?.textContent || _currentAiAnalyzedData?.servingSize || '1 ที่').trim();

    const existingIdx = window.state.customPresets.findIndex(x => x.name.toLowerCase() === name.toLowerCase());
    if (existingIdx >= 0) {
        window.state.customPresets[existingIdx] = {
            name,
            servingSize: serving,
            calories: cal,
            protein: p,
            carbs: c,
            fat: f,
            isCustom: true
        };
        if (window.showToast) window.showToast(`💾 อัปเดต "${name}" ในคลังอาหารแล้ว!`);
    } else {
        window.state.customPresets.push({
            name,
            servingSize: serving,
            calories: cal,
            protein: p,
            carbs: c,
            fat: f,
            isCustom: true
        });
        if (window.showToast) window.showToast(`💾 บันทึก "${name}" ลงคลังอาหารเรียบร้อย!`);
    }

    if (window.saveState) window.saveState();
    if (window.renderFoodDatabaseExplorer) window.renderFoodDatabaseExplorer();
    updateAiSnapCustomButton(name);
}

function updateAiSnapCustomButton(name) {
    const btn = document.getElementById('btnAiSnapAddCustom');
    if (!btn || !window.state) return;
    const exists = Array.isArray(window.state.customPresets) && window.state.customPresets.some(x => x.name.toLowerCase() === name.toLowerCase());
    if (exists) {
        btn.innerHTML = '<span>✓</span> <span>อยู่ในคลังอาหารแล้ว</span>';
        btn.className = 'flex-1 py-2 px-2.5 rounded-xl bg-sky-600 text-white font-bold text-xs shadow-xs transition flex items-center justify-center gap-1 cursor-pointer';
    } else {
        btn.innerHTML = '<span>💾</span> <span>บันทึกลงคลังอาหาร</span>';
        btn.className = 'flex-1 py-2 px-2.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-sky-600 dark:text-sky-400 font-bold text-xs border border-sky-500/30 transition flex items-center justify-center gap-1 cursor-pointer';
    }
}

function toggleAiVoiceItemFavorite(idx) {
    if (!_currentAiVoiceResult || !_currentAiVoiceResult.items || !_currentAiVoiceResult.items[idx]) return;
    const item = _currentAiVoiceResult.items[idx];
    const name = item.foodName;
    if (!name || !window.state) return;
    if (!Array.isArray(window.state.favorites)) window.state.favorites = [];

    const i = window.state.favorites.indexOf(name);
    if (i >= 0) {
        window.state.favorites.splice(i, 1);
        if (window.showToast) window.showToast(`นำ "${name}" ออกจากเมนูโปรดแล้ว`);
    } else {
        window.state.favorites.push(name);
        if (window.showToast) window.showToast(`⭐ บันทึก "${name}" เข้าเมนูโปรดแล้ว!`);
    }
    if (window.saveState) window.saveState();
    if (window.renderFoodDatabaseExplorer) window.renderFoodDatabaseExplorer();
    renderAiVoiceItemsList();
}

function saveAiVoiceItemToCustomFood(idx) {
    if (!_currentAiVoiceResult || !_currentAiVoiceResult.items || !_currentAiVoiceResult.items[idx]) return;
    const item = _currentAiVoiceResult.items[idx];
    const name = item.foodName;
    if (!name || !window.state) return;
    if (!Array.isArray(window.state.customPresets)) window.state.customPresets = [];

    const cal = Math.round(Number(item.cal) || 0);
    const p = Math.round(Number(item.p) || 0);
    const c = Math.round(Number(item.c) || 0);
    const f = Math.round(Number(item.f) || 0);
    const serving = item.servingSize || '1 ที่';

    const existingIdx = window.state.customPresets.findIndex(x => x.name.toLowerCase() === name.toLowerCase());
    if (existingIdx >= 0) {
        window.state.customPresets[existingIdx] = { name, servingSize: serving, calories: cal, protein: p, carbs: c, fat: f, isCustom: true };
    } else {
        window.state.customPresets.push({ name, servingSize: serving, calories: cal, protein: p, carbs: c, fat: f, isCustom: true });
    }
    if (window.showToast) window.showToast(`💾 บันทึก "${name}" ลงคลังอาหารส่วนตัวแล้ว!`);
    if (window.saveState) window.saveState();
    if (window.renderFoodDatabaseExplorer) window.renderFoodDatabaseExplorer();
    renderAiVoiceItemsList();
}

function saveAllAiVoiceItemsToLibrary() {
    if (!_currentAiVoiceResult || !_currentAiVoiceResult.items || _currentAiVoiceResult.items.length === 0) return;
    if (!window.state) return;
    if (!Array.isArray(window.state.favorites)) window.state.favorites = [];
    if (!Array.isArray(window.state.customPresets)) window.state.customPresets = [];

    let count = 0;
    _currentAiVoiceResult.items.forEach(item => {
        const name = item.foodName;
        if (!name) return;
        count++;
        if (!window.state.favorites.includes(name)) {
            window.state.favorites.push(name);
        }
        const cal = Math.round(Number(item.cal) || 0);
        const p = Math.round(Number(item.p) || 0);
        const c = Math.round(Number(item.c) || 0);
        const f = Math.round(Number(item.f) || 0);
        const serving = item.servingSize || '1 ที่';
        const existingIdx = window.state.customPresets.findIndex(x => x.name.toLowerCase() === name.toLowerCase());
        if (existingIdx >= 0) {
            window.state.customPresets[existingIdx] = { name, servingSize: serving, calories: cal, protein: p, carbs: c, fat: f, isCustom: true };
        } else {
            window.state.customPresets.push({ name, servingSize: serving, calories: cal, protein: p, carbs: c, fat: f, isCustom: true });
        }
    });

    if (window.saveState) window.saveState();
    if (window.renderFoodDatabaseExplorer) window.renderFoodDatabaseExplorer();
    renderAiVoiceItemsList();
    if (window.showToast) window.showToast(`⭐ บันทึกทั้ง ${count} เมนูเข้าเมนูโปรดและคลังอาหารเรียบร้อย!`);
}

// ==========================================
// Visual Photo Recents Engine (v5.8.6)
// ==========================================
const RECENT_PHOTOS_STORAGE_KEY = 'novafit_recent_photos';

function renderAiSnapRecentDishes() {
    const section = document.getElementById('aiSnapRecentDishesSection');
    const container = document.getElementById('aiSnapRecentDishesList');
    if (!section || !container) return;

    let recents = [];
    try {
        const raw = localStorage.getItem(RECENT_PHOTOS_STORAGE_KEY);
        if (raw) recents = JSON.parse(raw) || [];
    } catch (e) {}

    if (!Array.isArray(recents) || recents.length === 0) {
        section.classList.add('hidden');
        container.innerHTML = '';
        return;
    }

    section.classList.remove('hidden');
    container.innerHTML = recents.map(dish => {
        const safeName = (dish.foodName || 'เมนูอาหาร').replace(/'/g, "\\'");
        const safeId = (dish.id || '').replace(/'/g, "\\'");
        const imgThumb = dish.thumb
            ? `<img src="${dish.thumb}" alt="${safeName}" class="w-full h-18 object-cover rounded-xl mb-1.5 shadow-2xs">`
            : `<div class="w-full h-18 rounded-xl bg-gradient-to-br from-purple-500/10 to-indigo-500/10 flex items-center justify-center text-2xl mb-1.5">🍱</div>`;

        return `
            <div onclick="selectRecentAiSnapDish('${safeId}')"
                class="min-w-[130px] max-w-[145px] p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 hover:border-purple-400 dark:hover:border-purple-500 hover:shadow-xs active:scale-95 transition-all cursor-pointer shrink-0 flex flex-col justify-between group">
                <div>
                    ${imgThumb}
                    <div class="font-bold text-xs text-slate-800 dark:text-slate-100 truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition" title="${safeName}">
                        ${dish.foodName}
                    </div>
                    <div class="text-[10px] text-slate-400 truncate">${dish.servingSize || '1 ที่'}</div>
                </div>
                <div class="pt-1.5 mt-1 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
                    <span class="text-xs font-black text-purple-600 dark:text-purple-400">${dish.cal} kcal</span>
                    <span class="text-[10px] font-semibold text-blue-500">P:${dish.p}g</span>
                </div>
            </div>
        `;
    }).join('');
}

function selectRecentAiSnapDish(dishId) {
    let recents = [];
    try {
        const raw = localStorage.getItem(RECENT_PHOTOS_STORAGE_KEY);
        if (raw) recents = JSON.parse(raw) || [];
    } catch (e) {}

    const found = recents.find(r => r.id === dishId);
    if (!found) return;

    _currentAiAnalyzedData = found;

    // Switch to Result View directly!
    document.getElementById('aiSnapUploadState')?.classList.add('hidden');
    document.getElementById('aiSnapPreviewState')?.classList.add('hidden');
    document.getElementById('aiSnapLoadingState')?.classList.add('hidden');
    renderAiAnalysisResult(found, false);

    if (window.showToast) {
        window.showToast(`📸 โหลดข้อมูล "${found.foodName}" จากจานที่เคยสแกนแล้ว (ฟรี Token)`);
    }
}

function clearAiSnapRecentDishes() {
    localStorage.removeItem(RECENT_PHOTOS_STORAGE_KEY);
    renderAiSnapRecentDishes();
}

function saveToRecentPhotos(dishData, rawDataUrl) {
    if (!dishData || !dishData.foodName) return;
    try {
        let recents = [];
        const raw = localStorage.getItem(RECENT_PHOTOS_STORAGE_KEY);
        if (raw) {
            try { recents = JSON.parse(raw) || []; } catch (e) {}
        }

        recents = recents.filter(r => r.foodName !== dishData.foodName);

        const newEntry = {
            id: 'recent_' + Date.now().toString(36),
            foodName: dishData.foodName,
            cal: Math.round(Number(dishData.cal) || 0),
            p: Math.round(Number(dishData.p) || 0),
            c: Math.round(Number(dishData.c) || 0),
            f: Math.round(Number(dishData.f) || 0),
            servingSize: dishData.servingSize || '1 ที่',
            ingredients: Array.isArray(dishData.ingredients) ? dishData.ingredients : [],
            healthyTip: dishData.healthyTip || '',
            thumb: '',
            savedAt: Date.now()
        };

        if (rawDataUrl && rawDataUrl.startsWith('data:image')) {
            try {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const size = 120;
                    let w = img.width, h = img.height;
                    if (w > h) {
                        h = Math.round((h * size) / w);
                        w = size;
                    } else {
                        w = Math.round((w * size) / h);
                        h = size;
                    }
                    canvas.width = w;
                    canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, w, h);
                    newEntry.thumb = canvas.toDataURL('image/jpeg', 0.6);
                    recents.unshift(newEntry);
                    if (recents.length > 6) recents = recents.slice(0, 6);
                    localStorage.setItem(RECENT_PHOTOS_STORAGE_KEY, JSON.stringify(recents));
                };
                img.src = rawDataUrl;
                return;
            } catch (canvasErr) {
                console.warn('Canvas thumbnail generation error:', canvasErr);
            }
        }

        recents.unshift(newEntry);
        if (recents.length > 6) recents = recents.slice(0, 6);
        localStorage.setItem(RECENT_PHOTOS_STORAGE_KEY, JSON.stringify(recents));
    } catch (err) {
        console.warn('saveToRecentPhotos error:', err);
    }
}

// API Key Settings Modal
function promptEditGeminiApiKey() {
    const current = getGeminiApiKey();
    const input = prompt(
        "🔑 กรุณากรอก Google Gemini API Key ของคุณ:\n(รับคีย์ฟรีได้ทันทีที่ https://aistudio.google.com/app/apikey)\n\n* คีย์ที่ถูกต้องจะขึ้นต้นด้วย 'AIzaSy...' หรือ 'AQ....'\n* หากเว้นว่างไว้ ระบบจะใช้โหมดตัวอย่าง (Demo Simulation) ให้ทดสอบฟรี:",
        current
    );

    if (input !== null) {
        const trimmed = input.trim();
        if (trimmed && !isValidGeminiApiKey(trimmed)) {
            alert("⚠️ รูปแบบ API Key ไม่ถูกต้อง!\n\nGoogle Gemini API Key ต้องขึ้นต้นด้วย 'AIzaSy...' หรือ 'AQ....' (รับได้ที่ https://aistudio.google.com/app/apikey) ครับ");
            return;
        }
        setGeminiApiKey(trimmed);
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


// ==========================================
// AI Macro Coach Analysis Engine (Gemini Flash)
// ==========================================
async function requestGeminiCoachAdvice(context) {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
        return null;
    }

    const candidateModels = [
        'gemini-3.5-flash-lite',
        'gemini-3.1-flash-lite',
        'gemini-flash-lite-latest',
        'gemini-3.8-flash'
    ];

    const goalLabel = context.goal === 'muscle'
        ? 'เพิ่มกล้ามเนื้อ'
        : (context.goal === 'maintain' ? 'รักษาน้ำหนัก' : 'ลดไขมัน/ลดน้ำหนัก');

    const promptText = `
คุณคือนักกำหนดอาหารและโค้ชสุขภาพส่วนตัว (NovaFit Pro AI Macro Coach)
โปรดวิเคราะห์สถานะสารอาหารวันนี้ของผู้ใช้อย่างมืออาชีพ และตอบกลับเป็น JSON เท่านั้น

ข้อมูลวันนี้ของผู้ใช้:
- เป้าหมายแคลอรี: ${context.targetCal} kcal (ทานไปแล้ว ${context.consumedCal} kcal, คงเหลือ ${context.remCal} kcal)
- โปรตีน: เป้า ${context.pGram}g (ทานไปแล้ว ${context.consumedP}g, คงเหลือ ${context.remP}g)
- คาร์โบไฮเดรต: เป้า ${context.cGram}g (ทานไปแล้ว ${context.consumedC}g, คงเหลือ ${context.remC}g)
- ไขมัน: เป้า ${context.fGram}g (ทานไปแล้ว ${context.consumedF}g, คงเหลือ ${context.remF}g)
- เป้าหมายสุขภาพ: ${goalLabel}
- เมนูที่ทานไปแล้ว: ${context.todayMeals && context.todayMeals.length > 0 ? context.todayMeals.join(', ') : 'ยังไม่ได้บันทึกอาหาร'}

โครงสร้าง JSON ตอบกลับ:
{
  "coachAdvice": "คำแนะนำ 2-3 ประโยค ภาษาไทยเป็นกันเอง มีพลัง สรุปสถานะสิ่งที่ทานไป และบอกกลยุทธ์มื้อถัดไปเพื่อปิดยอดสารอาหารอย่างถูกต้อง",
  "suggestedMenus": [
    {
      "name": "ชื่อเมนูภาษาไทย",
      "servingSize": "ขนาดเสิร์ฟ เช่น 1 จาน (300g)",
      "calories": ตัวเลขแคลอรีรวม (kcal),
      "protein": ตัวเลขโปรตีน (กรัม),
      "carbs": ตัวเลขคาร์โบไฮเดรต (กรัม),
      "fat": ตัวเลขไขมัน (กรัม),
      "why": "เหตุผลสั้นๆ ไม่เกิน 10 คำ ว่าทำไมเมนูนี้ถึงเหมาะกับสารอาหารที่เหลือ"
    }
  ]
}
สร้างรายการอาหารแนะนำ 3-4 เมนูที่เหมาะสมกับแคลอรีและโปรตีนคงเหลือข้างต้น
`;

    for (let i = 0; i < candidateModels.length; i++) {
        const modelName = candidateModels[i];
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 12000);

            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    contents: [{ parts: [{ text: promptText }] }],
                    generationConfig: {
                        temperature: 0.4,
                        responseMimeType: "application/json"
                    }
                })
            });
            clearTimeout(timeoutId);

            if (!response.ok) continue;
            const data = await response.json();
            const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!jsonText) continue;

            const parsed = JSON.parse(jsonText);
            if (parsed && parsed.coachAdvice) {
                // Record audit log
                if (typeof recordAiScanAuditLog === 'function') {
                    recordAiScanAuditLog({
                        foodName: `AI Macro Coach (${context.remCal} kcal rem, P:${context.remP}g)`,
                        cal: Math.max(0, context.remCal),
                        modelUsed: `${modelName} (coach)`
                    }).catch(() => {});
                }

                return {
                    ...parsed,
                    model: modelName,
                    source: 'gemini'
                };
            }
        } catch (e) {
            console.warn(`AI Coach attempt with ${modelName} failed:`, e);
        }
    }
    return null;
}


// ==========================================
// AI Smart Text & Voice Log Engine (v5.8.3)
// Web Speech Recognition API + Gemini Multi-Item Parser
// ==========================================

let _currentAiVoiceResult = null;
let _speechRecognitionInstance = null;
let _isSpeechRecording = false;
let _currentAiActiveTab = 'photo';

// Switch between Photo and Voice Tabs
function switchAiModalTab(tab = 'photo') {
    _currentAiActiveTab = tab;
    const photoTabBtn = document.getElementById('tabBtnAiPhoto');
    const voiceTabBtn = document.getElementById('tabBtnAiVoice');
    const photoPane = document.getElementById('aiPhotoTabPane');
    const voicePane = document.getElementById('aiVoiceTabPane');
    const headerTitle = document.getElementById('aiModalTitleText');
    const headerSub = document.getElementById('aiModalSubText');
    const modalIcon = document.getElementById('aiModalIcon');

    if (tab === 'voice') {
        if (photoTabBtn) {
            photoTabBtn.classList.remove('bg-white', 'dark:bg-slate-800', 'text-purple-600', 'dark:text-purple-400', 'shadow-xs');
            photoTabBtn.classList.add('text-slate-500', 'dark:text-slate-400');
        }
        if (voiceTabBtn) {
            voiceTabBtn.classList.add('bg-white', 'dark:bg-slate-800', 'text-purple-600', 'dark:text-purple-400', 'shadow-xs');
            voiceTabBtn.classList.remove('text-slate-500', 'dark:text-slate-400');
        }

        photoPane?.classList.add('hidden');
        voicePane?.classList.remove('hidden');

        if (modalIcon) modalIcon.textContent = '💬';
        if (headerTitle) headerTitle.textContent = 'AI Smart Text Log';
        if (headerSub) headerSub.textContent = 'พิมพ์สั่งอาหารหลายเมนูพร้อมกัน AI แยกแยะแคลอรีอัตโนมัติ';

        // Auto select suggested meal for current hour
        const mealSelect = document.getElementById('aiVoiceMealSelect');
        if (mealSelect && !_currentAiVoiceResult) {
            mealSelect.value = getSuggestedMealByHour();
        }
    } else {
        stopAiVoiceRecording();

        if (voiceTabBtn) {
            voiceTabBtn.classList.remove('bg-white', 'dark:bg-slate-800', 'text-purple-600', 'dark:text-purple-400', 'shadow-xs');
            voiceTabBtn.classList.add('text-slate-500', 'dark:text-slate-400');
        }
        if (photoTabBtn) {
            photoTabBtn.classList.add('bg-white', 'dark:bg-slate-800', 'text-purple-600', 'dark:text-purple-400', 'shadow-xs');
            photoTabBtn.classList.remove('text-slate-500', 'dark:text-slate-400');
        }

        voicePane?.classList.add('hidden');
        photoPane?.classList.remove('hidden');

        if (modalIcon) modalIcon.textContent = '📸';
        if (headerTitle) headerTitle.textContent = 'AI Snap & Log';
        if (headerSub) headerSub.textContent = 'ถ่ายรูปจานอาหาร AI วิเคราะห์แคลทันที';
    }
}

// Clear voice/text textarea
function clearAiVoiceText() {
    stopAiVoiceRecording();
    _speechBaseText = '';
    const input = document.getElementById('aiVoiceTextInput');
    if (input) {
        input.value = '';
        input.focus();
    }
    const liveTranscript = document.getElementById('aiVoiceLiveTranscript');
    if (liveTranscript) {
        liveTranscript.textContent = '';
        liveTranscript.classList.add('hidden');
    }
}

// Quick Sample setter
function setAiVoiceSample(text) {
    stopAiVoiceRecording();
    _speechBaseText = '';
    const input = document.getElementById('aiVoiceTextInput');
    if (input) {
        input.value = text;
        input.focus();
    }
}

// Suggested Meal based on current hour
function getSuggestedMealByHour() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) return 'breakfast';
    if (hour >= 11 && hour < 15) return 'lunch';
    if (hour >= 15 && hour < 21) return 'dinner';
    return 'snack';
}

// AI Smart Text Log Controller
// Designed for seamless keyboard typing & mobile keyboard dictation (iOS/Android Dictation)
function stopAiVoiceRecording() {
    _isSpeechRecording = false;
    _speechRecognitionInstance = null;
}

function startAiVoiceRecording() {}
function toggleAiVoiceRecording() {}
function initSpeechRecognition() { return null; }
function resetAiVoiceMicUI() {}
function setAiVoiceMicActiveUI() {}

// Realistic simulation engine when no API Key is configured
function simulateDemoVoiceTextAnalysis(text) {
    const lower = text.toLowerCase();
    const items = [];
    let tip = '💡 เคล็ดลับ: การกระจายโปรตีนให้เพียงพอในทุกมื้อ ช่วยคงมวลกล้ามเนื้อและลดความอยากจุบจิบระหว่างวัน';

    if (lower.includes('ข้าวมันไก่')) {
        const noSkin = lower.includes('ไม่หนัง') || lower.includes('ไม่เอาหนัง');
        items.push({
            foodName: noSkin ? 'ข้าวมันไก่ต้ม (ไม่เอาหนัง)' : 'ข้าวมันไก่ต้ม',
            servingSize: '1 จาน (350g)',
            cal: noSkin ? 510 : 590,
            p: 34,
            c: 62,
            f: noSkin ? 12 : 22
        });
        if (noSkin) tip = '🌟 ยอดเยี่ยม: สั่งไม่เอาหนังช่วยลดไขมันอิ่มตัวได้มากกว่า 10g!';
    }

    if (lower.includes('โค้กซีโร่') || lower.includes('coke zero') || lower.includes('เป๊ปซี่แม็กซ์')) {
        items.push({
            foodName: 'โค้กซีโร่ (Coke Zero)',
            servingSize: '1 กระป๋อง (325ml)',
            cal: 0,
            p: 0,
            c: 0,
            f: 0
        });
    }

    if (lower.includes('กะเพรา')) {
        items.push({
            foodName: 'ข้าวกะเพราหมูสับ',
            servingSize: '1 จาน (300g)',
            cal: 580,
            p: 26,
            c: 62,
            f: 24
        });
    }

    if (lower.includes('ไข่ดาว')) {
        items.push({
            foodName: 'ไข่ดาวทอด',
            servingSize: '1 ฟอง',
            cal: 115,
            p: 7,
            c: 1,
            f: 9
        });
    }

    if (lower.includes('ไข่ต้ม')) {
        items.push({
            foodName: 'ไข่ต้มสุก',
            servingSize: '1 ฟอง',
            cal: 75,
            p: 7,
            c: 0.5,
            f: 5
        });
    }

    if (lower.includes('เวย์') || lower.includes('โปรตีน')) {
        items.push({
            foodName: 'เวย์โปรตีนไอโซเลท',
            servingSize: '1 สกู๊ป (30g)',
            cal: 120,
            p: 25,
            c: 2,
            f: 1
        });
    }

    if (lower.includes('นมโอ๊ต') || lower.includes('oat milk')) {
        items.push({
            foodName: 'นมโอ๊ต (Oat Milk)',
            servingSize: '1 แก้ว (250ml)',
            cal: 130,
            p: 3,
            c: 16,
            f: 5
        });
    }

    if (lower.includes('ส้มตำ')) {
        items.push({
            foodName: 'ส้มตำไทย',
            servingSize: '1 จาน (200g)',
            cal: 120,
            p: 4,
            c: 24,
            f: 2
        });
    }

    if (lower.includes('ไก่ย่าง') || lower.includes('อกไก่')) {
        items.push({
            foodName: 'อกไก่ย่างสมุนไพร',
            servingSize: '150 กรัม',
            cal: 195,
            p: 38,
            c: 2,
            f: 4
        });
    }

    if (items.length === 0) {
        items.push({
            foodName: text.trim().slice(0, 35) || 'อาหารตามสั่งเพื่อสุขภาพ',
            servingSize: '1 จาน (300g)',
            cal: 480,
            p: 24,
            c: 55,
            f: 18
        });
    }

    let suggestedMeal = getSuggestedMealByHour();
    if (lower.includes('เช้า')) suggestedMeal = 'breakfast';
    else if (lower.includes('เที่ยง') || lower.includes('กลางวัน')) suggestedMeal = 'lunch';
    else if (lower.includes('เย็น')) suggestedMeal = 'dinner';
    else if (lower.includes('ว่าง') || lower.includes('เล่น')) suggestedMeal = 'snack';

    let totalCal = 0, totalP = 0, totalC = 0, totalF = 0;
    items.forEach(it => {
        totalCal += it.cal;
        totalP += it.p;
        totalC += it.c;
        totalF += it.f;
    });

    const summaryTitle = items.map(it => it.foodName).join(' + ');

    return {
        summaryTitle,
        suggestedMeal,
        totalCal,
        totalP,
        totalC,
        totalF,
        items,
        healthyTip: tip
    };
}

// ==========================================
// Smart Cloud & Local Food Cache Engine (v5.8.5)
// ==========================================
const LOCAL_FOOD_CACHE_KEY = 'novafit_ai_food_cache';

function normalizeFoodCacheKey(text) {
    if (!text || typeof text !== 'string') return '';
    let clean = text.toLowerCase().trim();
    clean = clean.replace(/[\n\r\t]+/g, ' ');
    // Keep Unicode letters, marks (Thai vowels/tones), numbers and spaces
    clean = clean.replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ');
    // Remove common Thai polite / filler words (surrounded by space or at start/end)
    const fillerRegex = /(?:^|\s+)(?:ครับ|ค่ะ|คับ|คะ|หน่อย|ด้วย|ช่วย|นะ|จ้ะ|จ้า)(?=\s+|$)/gu;
    while (fillerRegex.test(clean)) {
        clean = clean.replace(fillerRegex, ' ');
    }
    clean = clean.replace(/\s+/g, ' ').trim();
    return clean;
}

function generateFoodCacheDocId(normalizedKey) {
    if (!normalizedKey) return '';
    return normalizedKey.replace(/[\/\\]/g, '-').slice(0, 180).trim();
}

function saveToLocalAiFoodCache(docId, data) {
    if (!docId || !data) return;
    try {
        let cache = {};
        const cachedStr = localStorage.getItem(LOCAL_FOOD_CACHE_KEY);
        if (cachedStr) {
            try { cache = JSON.parse(cachedStr) || {}; } catch (e) {}
        }
        const keys = Object.keys(cache);
        if (keys.length > 80) {
            delete cache[keys[0]];
        }
        cache[docId] = data;
        localStorage.setItem(LOCAL_FOOD_CACHE_KEY, JSON.stringify(cache));
    } catch (err) {
        console.warn('saveToLocalAiFoodCache error:', err);
    }
}

async function lookupAiFoodSmartCache(rawText) {
    const key = normalizeFoodCacheKey(rawText);
    if (!key || key.length < 2) return null;
    const docId = generateFoodCacheDocId(key);

    // Level 1: LocalStorage Cache (Instant ~0.001s)
    try {
        const cachedStr = localStorage.getItem(LOCAL_FOOD_CACHE_KEY);
        if (cachedStr) {
            const cache = JSON.parse(cachedStr);
            if (cache[docId] && cache[docId].items && cache[docId].items.length > 0) {
                console.log('⚡ Smart Cache Hit (LocalStorage):', docId);
                return {
                    data: cache[docId],
                    source: 'local'
                };
            }
        }
    } catch (e) {}

    // Level 2: Cloud Firestore Cache (~0.1s)
    if (window.fetchAiFoodCacheFromCloud) {
        try {
            const cloudData = await window.fetchAiFoodCacheFromCloud(docId);
            if (cloudData && cloudData.items && cloudData.items.length > 0) {
                console.log('☁️ Smart Cache Hit (Cloud Firestore):', docId);
                saveToLocalAiFoodCache(docId, cloudData);
                return {
                    data: cloudData,
                    source: 'cloud'
                };
            }
        } catch (e) {}
    }

    return null;
}

async function saveAiFoodSmartCache(rawText, resultData) {
    const key = normalizeFoodCacheKey(rawText);
    if (!key || key.length < 2 || !resultData || !resultData.items || resultData.items.length === 0) return;
    const docId = generateFoodCacheDocId(key);

    const payload = {
        key: key,
        rawQuery: rawText,
        summaryTitle: resultData.summaryTitle || 'สรุปรายการอาหาร',
        suggestedMeal: resultData.suggestedMeal || 'lunch',
        totalCal: resultData.totalCal || 0,
        totalP: resultData.totalP || 0,
        totalC: resultData.totalC || 0,
        totalF: resultData.totalF || 0,
        items: resultData.items,
        healthyTip: resultData.healthyTip || '',
        cachedAt: new Date().toISOString()
    };

    saveToLocalAiFoodCache(docId, payload);

    if (window.saveAiFoodCacheToCloud) {
        window.saveAiFoodCacheToCloud(docId, payload).catch(() => {});
    }
}

function reAnalyzeAiVoiceWithGemini() {
    analyzeAiVoiceText(true);
}

// Call Google Gemini API to analyze Thai natural text / voice transcription (with Smart Cache integration)
async function analyzeAiVoiceText(forceRefresh = false) {
    const textInput = document.getElementById('aiVoiceTextInput');
    const text = (textInput?.value || '').trim();

    if (!text) {
        alert('กรุณาพิมพ์หรือพูดชื่อเมนูอาหารก่อนกดวิเคราะห์ครับ');
        textInput?.focus();
        return;
    }

    // Step 1: Check Smart Cache first (unless user explicitly requests re-analysis)
    if (!forceRefresh) {
        try {
            const cachedMatch = await lookupAiFoodSmartCache(text);
            if (cachedMatch && cachedMatch.data) {
                // Instant cache hit! No daily quota consumed, zero Gemini tokens spent!
                renderAiVoiceResultView(cachedMatch.data, false, true);
                return;
            }
        } catch (e) {
            console.warn('Smart cache check error:', e);
        }
    }

    // Safeguard 1: Auth check on Production
    if (!window.currentUser && !isUatEnvironment()) {
        alert('กรุณาเข้าสู่ระบบด้วย Google ก่อนใช้งานฟีเจอร์ AI Voice ครับ');
        openAiSnapModal('voice');
        return;
    }

    // Safeguard 2: Quota check
    if (isAiQuotaExceeded()) {
        alert('คุณใช้โควตา AI ประจำวันครบ 15/15 ครั้งแล้ว โควตาจะรีเซ็ตใหม่ในวันพรุ่งนี้เวลา 00:00 น.');
        openAiSnapModal('voice');
        return;
    }

    stopAiVoiceRecording();

    // Show Loading Animation
    document.getElementById('aiVoiceInputState')?.classList.add('hidden');
    document.getElementById('aiVoiceLoadingState')?.classList.remove('hidden');
    document.getElementById('aiVoiceResultState')?.classList.add('hidden');

    const apiKey = getGeminiApiKey();

    // If NO API key is entered, use realistic Demo Simulation
    if (!apiKey) {
        setTimeout(() => {
            const demoResult = simulateDemoVoiceTextAnalysis(text);
            incrementAiScanUsage();
            saveAiFoodSmartCache(text, demoResult);
            renderAiVoiceResultView(demoResult, true, false);
        }, 1100);
        return;
    }

    // Call Real Gemini API with Multi-Model Fallback Chain
    const candidateModels = [
        'gemini-3.5-flash-lite',
        'gemini-3.1-flash-lite',
        'gemini-flash-lite-latest',
        'gemini-3.8-flash'
    ];

    const currentTimeStr = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    const promptText = `
คุณคือนักกำหนดอาหารและผู้เชี่ยวชาญด้านโภชนาการไทย โปรดวิเคราะห์ข้อความรายการอาหารที่ผู้ใช้พิมพ์หรือพูดต่อไปนี้ และแปลงเป็นข้อมูลโภชนาการที่แม่นยำ

ข้อความจากผู้ใช้: "${text}"
เวลาปัจจุบัน: ${currentTimeStr}

คำแนะนำการวิเคราะห์:
1. หากผู้ใช้ระบุอาหารหลายอย่างในประโยค (เช่น "ข้าวมันไก่พิเศษไม่หนัง 1 จาน กับ โค้กซีโร่ 1 กระป๋อง" หรือ "ไข่ต้ม 2 ฟอง ขนมปังโฮลวีท 1 แผ่น") ให้แยกรายการอาหารออกมาในอาเรย์ "items" แต่ละรายการอย่างชัดเจน
2. คำนวณปริมาณแคลอรีรวม (kcal), โปรตีน (g), คาร์บ (g), ไขมัน (g) ทั้งแบบแยกรายเมนู และผลรวมทั้งหมด (totalCal, totalP, totalC, totalF)
3. วิเคราะห์ช่วงเวลาของมื้ออาหาร (suggestedMeal: "breakfast" | "lunch" | "dinner" | "snack") โดยดูจากคำพูดของผู้ใช้ (เช่น มีคำว่า "เที่ยง", "เช้า", "เย็น", "กินเล่น") หรืออิงจากเวลาปัจจุบัน
4. ตอบกลับเป็น JSON เท่านั้น โครงสร้างตามนี้:
{
  "summaryTitle": "ชื่อสรุปมื้ออาหารสั้นๆ ภาษาไทย เช่น ข้าวมันไก่ไม่หนัง + โค้กซีโร่",
  "suggestedMeal": "breakfast หรือ lunch หรือ dinner หรือ snack",
  "totalCal": ตัวเลขแคลอรีรวม,
  "totalP": ตัวเลขโปรตีนรวม,
  "totalC": ตัวเลขคาร์โบไฮเดรตรวม,
  "totalF": ตัวเลขไขมันรวม,
  "items": [
    {
      "foodName": "ชื่อรายการอาหาร",
      "servingSize": "ขนาดเสิร์ฟโดยประมาณ เช่น 1 จาน (350g) หรือ 1 แก้ว",
      "cal": ตัวเลขแคลอรี,
      "p": ตัวเลขโปรตีน,
      "c": ตัวเลขคาร์บ,
      "f": ตัวเลขไขมัน
    }
  ],
  "healthyTip": "คำแนะนำโภชนาการที่เป็นประโยชน์สั้นๆ 1 ประโยค"
}
`;

    const statusEl = document.getElementById('aiVoiceLoadingStatusText');
    let parsedResult = null;
    let lastError = null;

    for (let i = 0; i < candidateModels.length; i++) {
        const modelName = candidateModels[i];
        if (statusEl) {
            statusEl.textContent = i === 0
                ? 'AI กำลังแยกแยะวัตถุดิบและคำนวณแคลอรี...'
                : `กำลังเชื่อมต่อช่องทางสำรอง (${modelName.replace('gemini-', '')})...`;
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 12000);

            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(apiKey)}`;
            const response = await fetch(url, {
                method: 'POST',
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': apiKey
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                { text: promptText }
                            ]
                        }
                    ],
                    generationConfig: {
                        responseMimeType: 'application/json',
                        temperature: 0.2
                    }
                })
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
                let errDetail = '';
                try {
                    const errJson = await response.json();
                    errDetail = errJson.error?.message || response.statusText;
                } catch (e) {
                    errDetail = `HTTP ${response.status}`;
                }
                console.warn(`Model ${modelName} returned HTTP ${response.status}: ${errDetail}`);
                lastError = new Error(`${modelName} (${errDetail})`);
                continue;
            }

            const data = await response.json();
            const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!jsonText) {
                lastError = new Error(`${modelName}: ไม่พบผลลัพธ์จาก AI`);
                continue;
            }

            parsedResult = JSON.parse(jsonText);
            break;
        } catch (err) {
            console.warn(`Attempt with ${modelName} failed:`, err);
            lastError = err;
        }
    }

    if (parsedResult && parsedResult.items && parsedResult.items.length > 0) {
        incrementAiScanUsage();
        saveAiFoodSmartCache(text, parsedResult);
        renderAiVoiceResultView(parsedResult, false, false);
    } else {
        console.warn('Gemini Voice parse failed, falling back to heuristic simulation:', lastError);
        const fallback = simulateDemoVoiceTextAnalysis(text);
        incrementAiScanUsage();
        saveAiFoodSmartCache(text, fallback);
        renderAiVoiceResultView(fallback, true, false);
    }
}

// Render multi-item analyzed result view
function renderAiVoiceResultView(resultData, isDemo = false, isCache = false) {
    _currentAiVoiceResult = resultData;
    window._currentAiVoiceResult = _currentAiVoiceResult;
    window._aiVoiceCurrentResult = _currentAiVoiceResult;

    document.getElementById('aiVoiceLoadingState')?.classList.add('hidden');
    document.getElementById('aiVoiceInputState')?.classList.add('hidden');
    document.getElementById('aiVoiceResultState')?.classList.remove('hidden');

    const summaryTitleEl = document.getElementById('aiVoiceSummaryTitle');
    const demoBadgeEl = document.getElementById('aiVoiceDemoBadge');
    const cacheBadgeEl = document.getElementById('aiVoiceCacheBadge');
    const cacheRecomputeRow = document.getElementById('aiVoiceCacheRecomputeRow');
    const mealSelect = document.getElementById('aiVoiceMealSelect');
    const itemCountText = document.getElementById('aiVoiceItemCountText');
    const itemsContainer = document.getElementById('aiVoiceItemsListContainer');
    const tipEl = document.getElementById('aiVoiceTipText');

    if (summaryTitleEl) summaryTitleEl.textContent = resultData.summaryTitle || 'สรุปรายการอาหาร';
    if (demoBadgeEl) demoBadgeEl.classList.toggle('hidden', !isDemo);
    if (cacheBadgeEl) cacheBadgeEl.classList.toggle('hidden', !isCache);
    if (cacheRecomputeRow) cacheRecomputeRow.classList.toggle('hidden', !isCache);

    if (mealSelect) {
        mealSelect.value = resultData.suggestedMeal || getSuggestedMealByHour();
    }

    if (tipEl) {
        tipEl.textContent = resultData.healthyTip || '💡 เคล็ดลับ: การจัดสัดส่วนโปรตีนและผักในมื้ออาหารช่วยให้อิ่มนานและคุมแคลอรีได้ดี';
    }

    renderAiVoiceItemsList();
}

function renderAiVoiceItemsList() {
    const itemsContainer = document.getElementById('aiVoiceItemsListContainer');
    const itemCountText = document.getElementById('aiVoiceItemCountText');
    const totalCalEl = document.getElementById('aiVoiceTotalCal');
    const totalPEl = document.getElementById('aiVoiceTotalP');
    const totalCEl = document.getElementById('aiVoiceTotalC');
    const totalFEl = document.getElementById('aiVoiceTotalF');
    const saveBtnText = document.getElementById('btnSaveAiVoiceMealText');

    if (!_currentAiVoiceResult || !_currentAiVoiceResult.items) return;
    const items = _currentAiVoiceResult.items;

    if (itemCountText) itemCountText.textContent = `${items.length} รายการ`;
    if (saveBtnText) saveBtnText.textContent = `บันทึก ${items.length} รายการลงมื้ออาหาร`;

    // Recalculate totals
    let totalCal = 0, totalP = 0, totalC = 0, totalF = 0;
    items.forEach(it => {
        totalCal += Math.round(Number(it.cal) || 0);
        totalP += Math.round(Number(it.p) || 0);
        totalC += Math.round(Number(it.c) || 0);
        totalF += Math.round(Number(it.f) || 0);
    });

    _currentAiVoiceResult.totalCal = totalCal;
    _currentAiVoiceResult.totalP = totalP;
    _currentAiVoiceResult.totalC = totalC;
    _currentAiVoiceResult.totalF = totalF;

    if (totalCalEl) totalCalEl.textContent = totalCal.toLocaleString();
    if (totalPEl) totalPEl.textContent = totalP;
    if (totalCEl) totalCEl.textContent = totalC;
    if (totalFEl) totalFEl.textContent = totalF;

    if (!itemsContainer) return;
    if (items.length === 0) {
        itemsContainer.innerHTML = '<div class="py-4 text-center text-slate-400 text-xs">ไม่พบรายการอาหาร กรุณาลองพูดหรือพิมพ์ใหม่อีกครั้ง</div>';
        return;
    }

    itemsContainer.innerHTML = items.map((it, idx) => {
        const cal = Math.round(Number(it.cal) || 0);
        const p = Math.round(Number(it.p) || 0);
        const c = Math.round(Number(it.c) || 0);
        const f = Math.round(Number(it.f) || 0);
        const serving = it.servingSize || '1 ที่';
        const isFav = Array.isArray(window.state?.favorites) && window.state.favorites.includes(it.foodName);
        const inCustom = Array.isArray(window.state?.customPresets) && window.state.customPresets.some(x => x.name.toLowerCase() === (it.foodName || '').toLowerCase());

        return `
            <div class="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 flex items-start justify-between gap-2 shadow-2xs">
                <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-1.5 flex-wrap">
                        <span class="font-bold text-slate-800 dark:text-slate-100 text-xs">${it.foodName}</span>
                        ${isFav ? '<span class="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold">⭐ โปรด</span>' : ''}
                        ${inCustom ? '<span class="text-[9px] px-1.5 py-0.2 rounded bg-sky-500/15 text-sky-600 dark:text-sky-400 font-bold">💾 ในคลัง</span>' : ''}
                    </div>
                    <div class="text-[10px] text-slate-400 mt-0.5">ขนาดเสิร์ฟ: ${serving}</div>
                    <div class="flex items-center gap-2 mt-1 text-[11px] flex-wrap">
                        <span class="font-black text-purple-600 dark:text-purple-400">${cal} kcal</span>
                        <span class="text-rose-500 font-semibold text-[10px]">P:${p}g</span>
                        <span class="text-amber-500 font-semibold text-[10px]">C:${c}g</span>
                        <span class="text-sky-500 font-semibold text-[10px]">F:${f}g</span>
                    </div>
                </div>
                <div class="flex items-center gap-1 shrink-0 pt-0.5">
                    <button type="button" onclick="toggleAiVoiceItemFavorite(${idx})"
                        class="p-1 rounded-lg ${isFav ? 'text-amber-400 bg-amber-500/10' : 'text-slate-400 hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-700'} text-xs font-bold transition cursor-pointer"
                        title="${isFav ? 'นำออกจากเมนูโปรด' : 'เพิ่มเป็นเมนูโปรด'}">
                        ${isFav ? '★' : '☆'}
                    </button>
                    <button type="button" onclick="saveAiVoiceItemToCustomFood(${idx})"
                        class="p-1 rounded-lg ${inCustom ? 'text-sky-500 bg-sky-500/10' : 'text-slate-400 hover:text-sky-500 hover:bg-slate-100 dark:hover:bg-slate-700'} text-xs font-bold transition cursor-pointer"
                        title="${inCustom ? 'อยู่ในคลังอาหารแล้ว (กดอัปเดต)' : 'บันทึกลงคลังอาหาร'}">
                        💾
                    </button>
                    <button type="button" onclick="removeAiVoiceResultItem(${idx})"
                        class="w-6 h-6 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-500/10 transition flex items-center justify-center shrink-0 cursor-pointer"
                        title="ลบรายการนี้ออก">
                        ✕
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function removeAiVoiceResultItem(index) {
    if (!_currentAiVoiceResult || !_currentAiVoiceResult.items) return;
    _currentAiVoiceResult.items.splice(index, 1);
    renderAiVoiceItemsList();
}

function resetAiVoiceState() {
    _currentAiVoiceResult = null;
    window._currentAiVoiceResult = null;
    document.getElementById('aiVoiceResultState')?.classList.add('hidden');
    document.getElementById('aiVoiceLoadingState')?.classList.add('hidden');
    document.getElementById('aiVoiceInputState')?.classList.remove('hidden');
    const input = document.getElementById('aiVoiceTextInput');
    if (input) input.focus();
}

function saveAiVoiceAnalyzedMeals() {
    if (!_currentAiVoiceResult || !_currentAiVoiceResult.items || _currentAiVoiceResult.items.length === 0) {
        alert('ไม่พบรายการอาหารที่สามารถบันทึกได้ครับ');
        return;
    }

    if (!window.state) {
        alert('เกิดข้อผิดพลาด: ไม่พบ state ของระบบ');
        return;
    }

    const selectMeal = document.getElementById('aiVoiceMealSelect');
    const meal = selectMeal ? selectMeal.value : 'lunch';
    const dStr = window.state.selectedDate || getTodayIsoDate();

    if (!window.state.logsByDate) window.state.logsByDate = {};
    if (!window.state.logsByDate[dStr]) window.state.logsByDate[dStr] = [];

    const nowTimeStr = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    const items = _currentAiVoiceResult.items;

    items.forEach((item, idx) => {
        const cal = Math.round(Number(item.cal) || 0);
        const p = Math.round(Number(item.p) || 0);
        const c = Math.round(Number(item.c) || 0);
        const f = Math.round(Number(item.f) || 0);
        const uniqueId = 'aiv_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7) + '_' + idx;

        const newLogItem = {
            id: uniqueId,
            name: item.foodName || 'เมนูอาหาร (AI)',
            cal,
            p,
            c,
            f,
            portion: 1,
            baseCal: cal,
            baseP: p,
            baseC: c,
            baseF: f,
            time: nowTimeStr,
            meal,
            servingSize: item.servingSize || '1 ที่',
            timestamp: Date.now() + idx,
            source: 'ai_voice_text'
        };

        window.state.logsByDate[dStr].push(newLogItem);
        recordAiScanAuditLog({
            foodName: newLogItem.name,
            cal,
            p,
            c,
            f,
            servingSize: newLogItem.servingSize
        });
    });

    if (window.saveState) window.saveState();
    if (window.renderAll) window.renderAll();
    if (window.triggerCloudSync) window.triggerCloudSync(false);

    closeAiSnapModal();
    if (window.showToast) {
        window.showToast(`🎙️ บันทึก ${items.length} เมนู (${_currentAiVoiceResult.totalCal || 0} kcal) ด้วย AI สำเร็จแล้ว!`);
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
window.renderAiSnapRecentDishes = renderAiSnapRecentDishes;
window.selectRecentAiSnapDish = selectRecentAiSnapDish;
window.clearAiSnapRecentDishes = clearAiSnapRecentDishes;
window.saveToRecentPhotos = saveToRecentPhotos;
window.promptEditGeminiApiKey = promptEditGeminiApiKey;
window.updateAiSnapQuotaDisplay = updateAiSnapQuotaDisplay;
window.loginWithGoogleFromAiSnap = loginWithGoogleFromAiSnap;
window.closeAiSnapModalAndFocusSearch = closeAiSnapModalAndFocusSearch;
window.getTodayAiScanUsage = getTodayAiScanUsage;
window.incrementAiScanUsage = incrementAiScanUsage;
window.isAiQuotaExceeded = isAiQuotaExceeded;
window.isUatEnvironment = isUatEnvironment;
window.isAiSnapEnabled = isAiSnapEnabled;
window.isUserAdmin = isUserAdmin;

window.requestGeminiCoachAdvice = requestGeminiCoachAdvice;
window.openAiVoiceModal = () => openAiSnapModal('voice');
window.switchAiModalTab = switchAiModalTab;
window.toggleAiVoiceRecording = toggleAiVoiceRecording;
window.reAnalyzeAiVoiceWithGemini = reAnalyzeAiVoiceWithGemini;
window.normalizeFoodCacheKey = normalizeFoodCacheKey;
window.generateFoodCacheDocId = generateFoodCacheDocId;
window.lookupAiFoodSmartCache = lookupAiFoodSmartCache;
window.saveAiFoodSmartCache = saveAiFoodSmartCache;
window.startAiVoiceRecording = startAiVoiceRecording;
window.stopAiVoiceRecording = stopAiVoiceRecording;
window.isSpeechRecording = () => _isSpeechRecording;
window.clearAiVoiceText = clearAiVoiceText;
window.setAiVoiceSample = setAiVoiceSample;
window.analyzeAiVoiceText = analyzeAiVoiceText;
window.removeAiVoiceResultItem = removeAiVoiceResultItem;
window.saveAiVoiceAnalyzedMeals = saveAiVoiceAnalyzedMeals;
window.resetAiVoiceState = resetAiVoiceState;
window.getCurrentAiVoiceResult = () => _currentAiVoiceResult;


window.addCurrentAiSnapToFavorites = addCurrentAiSnapToFavorites;
window.addCurrentAiSnapToCustomFood = addCurrentAiSnapToCustomFood;
window.updateAiSnapFavButton = updateAiSnapFavButton;
window.updateAiSnapCustomButton = updateAiSnapCustomButton;
window.toggleAiVoiceItemFavorite = toggleAiVoiceItemFavorite;
window.saveAiVoiceItemToCustomFood = saveAiVoiceItemToCustomFood;
window.saveAllAiVoiceItemsToLibrary = saveAllAiVoiceItemsToLibrary;
