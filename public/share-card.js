/**
 * NovaFit Pro - Visual Share Card Engine (v5.9.30)
 * Renders high-resolution 1080x1420 HTML5 Canvas daily summary share cards
 * with nutrient donuts, macro progress, water hydration bars, and meal breakdowns.
 */

function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
}

function fitText(ctx, text, maxWidth) {
    if (!text) return '';
    if (ctx.measureText(text).width <= maxWidth) return text;
    let t = text;
    while (t.length > 0 && ctx.measureText(t + '...').width > maxWidth) {
        t = t.slice(0, -1);
    }
    return t + '...';
}

async function openShareCardModal() {
    const modal = document.getElementById('shareCardModal');
    if (modal) modal.classList.remove('hidden');
    if (document.fonts && document.fonts.ready) {
        try { await document.fonts.ready; } catch (e) { }
    }
    renderShareCard();

    // Check Web Share API support
    const btnShare = document.getElementById('btnShareCardNative');
    if (btnShare) {
        if (navigator.canShare && navigator.share) {
            btnShare.classList.remove('hidden');
            btnShare.classList.add('flex');
        } else {
            btnShare.classList.add('hidden');
            btnShare.classList.remove('flex');
        }
    }
}

function closeShareCardModal() {
    const modal = document.getElementById('shareCardModal');
    if (modal) modal.classList.add('hidden');
}

function renderShareCard() {
    const canvas = document.getElementById('shareCardCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = 1080;
    const H = 1420;
    canvas.width = W;
    canvas.height = H;

    const state = window.state || {};
    const t = typeof getCalculatedTargets === 'function' 
        ? getCalculatedTargets() 
        : (window.getCalculatedTargets ? window.getCalculatedTargets() : { targetCal: 2000, pGram: 150, cGram: 200, fGram: 50, waterTargetGlasses: 10, waterTargetMl: 2500 });
    
    const dStr = state.selectedDate || (typeof getTodayStr === 'function' ? getTodayStr() : new Date().toISOString().split('T')[0]);
    const meals = (state.logsByDate && state.logsByDate[dStr]) || [];
    const sumP = Math.round(meals.reduce((s, m) => s + (m.p || 0), 0));
    const sumC = Math.round(meals.reduce((s, m) => s + (m.c || 0), 0));
    const sumF = Math.round(meals.reduce((s, m) => s + (m.f || 0), 0));
    const sumCal = Math.round(meals.reduce((s, m) => s + (m.cal || 0), 0));
    const remCal = t.targetCal - sumCal;

    const dayWorkouts = (state.workoutsByDate && state.workoutsByDate[dStr]) || [];
    const burnedCal = dayWorkouts.reduce((s, w) => s + (w.cal || 0), 0);
    const netCal = sumCal - burnedCal;

    const waterGlasses = (state.waterByDate && state.waterByDate[dStr]) || 0;
    const waterMl = waterGlasses * 250;
    const recordedWeight = state.weightsByDate && state.weightsByDate[dStr];

    const dateObj = new Date(dStr + 'T00:00:00');
    const thaiDate = dateObj.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    // 1. Dark Background with subtle ambient gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, '#090e17');
    bgGrad.addColorStop(0.5, '#0f172a');
    bgGrad.addColorStop(1, '#090e17');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Ambient Glow Top-Right (Emerald)
    const glow1 = ctx.createRadialGradient(880, 160, 20, 880, 160, 480);
    glow1.addColorStop(0, 'rgba(16, 185, 129, 0.22)');
    glow1.addColorStop(1, 'rgba(16, 185, 129, 0)');
    ctx.fillStyle = glow1;
    ctx.fillRect(400, 0, W - 400, 600);

    // Ambient Glow Bottom-Left (Cyan)
    const glow2 = ctx.createRadialGradient(200, 1260, 20, 200, 1260, 520);
    glow2.addColorStop(0, 'rgba(6, 182, 212, 0.16)');
    glow2.addColorStop(1, 'rgba(6, 182, 212, 0)');
    ctx.fillStyle = glow2;
    ctx.fillRect(0, 800, 700, 620);

    // Card Outer Border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 2;
    roundRect(ctx, 24, 24, W - 48, H - 48, 36, false, true);

    // 2. Header
    // NovaFit Pro App Logo Box
    const logoGrad = ctx.createLinearGradient(60, 60, 120, 120);
    logoGrad.addColorStop(0, '#10b981');
    logoGrad.addColorStop(0.5, '#06b6d4');
    logoGrad.addColorStop(1, '#6366f1');
    ctx.fillStyle = logoGrad;
    roundRect(ctx, 60, 60, 56, 56, 16, true, false);

    // Draw Nova Star + Bolt Icon on Canvas
    ctx.save();
    ctx.translate(88, 88);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.stroke();

    // 4-point curved Nova star
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -17);
    ctx.bezierCurveTo(0, -6, 6, 0, 17, 0);
    ctx.bezierCurveTo(6, 0, 0, 6, 0, 17);
    ctx.bezierCurveTo(0, 6, -6, 0, -17, 0);
    ctx.bezierCurveTo(-6, 0, 0, -6, 0, -17);
    ctx.closePath();
    ctx.fill();

    // Golden Lightning Bolt Core
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.moveTo(2, -9);
    ctx.lineTo(-5, 1);
    ctx.lineTo(1, 1);
    ctx.lineTo(-2, 10);
    ctx.lineTo(6, -1);
    ctx.lineTo(0, -1);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Title & Subtitle
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = 'bold 34px Prompt, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('NovaFit Pro', 132, 90);

    ctx.font = 'bold 12px Prompt, sans-serif';
    ctx.fillStyle = '#06b6d4';
    ctx.fillText('SMART NUTRITION & MACRO REPORT  •  BY BENZNOVA', 134, 114);

    // Date Tag & Day Type Badge
    const dayType = (state.dayTypeByDate && state.dayTypeByDate[dStr]) || 'training';
    const dayTypeTag = dayType === 'rest' ? '🛋️ วันพัก (Rest Day)' : '🏋️ วันซ้อม (Training Day)';
    ctx.font = '500 20px Prompt, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`📅 ${thaiDate}  •  ${dayTypeTag}`, 60, 150);

    // Weight Pill (if recorded)
    let pillW = 0;
    if (recordedWeight) {
        const wText = `⚖️ น้ำหนัก: ${recordedWeight} กก.`;
        ctx.font = 'bold 18px Prompt, sans-serif';
        pillW = ctx.measureText(wText).width + 32;
        ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
        ctx.lineWidth = 1.5;
        roundRect(ctx, W - 60 - pillW, 60, pillW, 46, 23, true, true);
        ctx.fillStyle = '#34d399';
        ctx.textAlign = 'center';
        ctx.fillText(wText, W - 60 - pillW / 2, 85);
    }

    // Prestige Frame & Streak Badge on Share Card
    const tiers = window.PRESTIGE_TIERS || (typeof PRESTIGE_TIERS !== 'undefined' ? PRESTIGE_TIERS : { novice: { name: 'Novice' } });
    const activeTier = tiers[state.prestigeFrame] || tiers.novice || { name: 'Novice' };
    const streakCount = Number(state.streakDays) || 0;
    const streakText = `🏆 ${activeTier.name} • 🔥 ${streakCount} วัน`;
    ctx.font = 'bold 18px Prompt, sans-serif';
    const sW = ctx.measureText(streakText).width + 32;
    const sX = recordedWeight ? (W - 60 - pillW - 12 - sW) : (W - 60 - sW);
    ctx.fillStyle = 'rgba(168, 85, 247, 0.15)';
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.4)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, sX, 60, sW, 46, 23, true, true);
    ctx.fillStyle = '#c084fc';
    ctx.textAlign = 'center';
    ctx.fillText(streakText, sX + sW / 2, 85);

    // 3. Calorie Hero Container
    const heroX = 60, heroY = 175, heroW = 960, heroH = 265;
    ctx.fillStyle = 'rgba(30, 41, 59, 0.65)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, heroX, heroY, heroW, heroH, 28, true, true);

    // Donut Chart on Left (Center: X: 195, Y: 307, Radius: 82, LineWidth: 18)
    const cx = 195, cy = 307, cr = 82;
    const pctVal = t.targetCal > 0 ? (sumCal / t.targetCal) : 0;

    // Background Ring
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 18;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Progress Arc
    if (pctVal > 0) {
        const startAngle = -Math.PI / 2;
        const endAngle = startAngle + Math.min(Math.PI * 2, Math.PI * 2 * pctVal);
        const arcGrad = ctx.createLinearGradient(cx - cr, cy, cx + cr, cy);
        arcGrad.addColorStop(0, '#10b981');
        arcGrad.addColorStop(1, '#06b6d4');
        ctx.beginPath();
        ctx.arc(cx, cy, cr, startAngle, endAngle);
        ctx.strokeStyle = arcGrad;
        ctx.lineWidth = 18;
        ctx.lineCap = 'round';
        ctx.stroke();
    }

    // Donut Center Text
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 44px Prompt, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${Math.round(pctVal * 100)}%`, cx, cy - 8);

    ctx.font = 'bold 13px Prompt, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('OF GOAL', cx, cy + 26);

    // Calorie Text Stats on Right (x: 320)
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 18px Prompt, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('พลังงานที่ทานวันนี้ (Calories)', 320, 205);

    ctx.font = 'bold 54px Prompt, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(sumCal.toLocaleString(), 320, 235);

    const calW = ctx.measureText(sumCal.toLocaleString()).width;
    ctx.font = 'bold 24px Prompt, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(` / ${t.targetCal.toLocaleString()} kcal`, 320 + calW + 6, 260);

    // Status Badge Pill
    let statusText = '';
    let statusBg = 'rgba(16, 185, 129, 0.2)';
    let statusBorder = 'rgba(16, 185, 129, 0.4)';
    let statusColor = '#34d399';

    if (sumCal === 0) {
        statusText = '⏳ ยังไม่ได้เริ่มบันทึกมื้ออาหาร';
        statusBg = 'rgba(148, 163, 184, 0.15)';
        statusBorder = 'rgba(148, 163, 184, 0.3)';
        statusColor = '#94a3b8';
    } else if (Math.abs(remCal) <= 150) {
        statusText = '🎯 พลังงานถึงเป้าหมายพอดีเป๊ะ!';
    } else if (remCal > 150) {
        statusText = `⚡ ขาดอีก ${remCal.toLocaleString()} kcal เพื่อถึงเป้า`;
        statusBg = 'rgba(245, 158, 11, 0.15)';
        statusBorder = 'rgba(245, 158, 11, 0.4)';
        statusColor = '#fbbf24';
    } else {
        statusText = `🔥 เกินเป้าหมาย ${Math.abs(remCal).toLocaleString()} kcal`;
        statusBg = 'rgba(244, 63, 94, 0.15)';
        statusBorder = 'rgba(244, 63, 94, 0.4)';
        statusColor = '#fb7185';
    }

    ctx.font = 'bold 17px Prompt, sans-serif';
    const sWidth = ctx.measureText(statusText).width + 30;
    ctx.fillStyle = statusBg;
    ctx.strokeStyle = statusBorder;
    ctx.lineWidth = 1.2;
    roundRect(ctx, 320, 312, sWidth, 38, 19, true, true);

    ctx.fillStyle = statusColor;
    ctx.fillText(statusText, 335, 321);

    // Workout burned info row if burnedCal > 0
    if (burnedCal > 0) {
        const wLine = `🔥 เบิร์นออกกำลัง -${burnedCal.toLocaleString()} kcal  •  แคลอรีสุทธิ (Net): ${netCal.toLocaleString()} kcal`;
        ctx.font = '600 16px Prompt, sans-serif';
        ctx.fillStyle = '#fb923c';
        ctx.fillText(wLine, 322, 365);
    }

    // 4. Three Macro Cards (Y: 460 - 640)
    const macroY = 460, macroW = 308, macroH = 175, gap = 18;
    const macros = [
        {
            name: '🥩 โปรตีน (Protein)',
            gram: sumP,
            target: t.pGram,
            cal: Math.round(sumP * 4),
            pct: t.pGram > 0 ? Math.min(100, Math.round((sumP / t.pGram) * 100)) : 0,
            bg: 'rgba(59, 130, 246, 0.08)',
            border: 'rgba(59, 130, 246, 0.28)',
            color: '#60a5fa',
            barColor: '#3b82f6'
        },
        {
            name: '🍚 คาร์บ (Carbs)',
            gram: sumC,
            target: t.cGram,
            cal: Math.round(sumC * 4),
            pct: t.cGram > 0 ? Math.min(100, Math.round((sumC / t.cGram) * 100)) : 0,
            bg: 'rgba(245, 158, 11, 0.08)',
            border: 'rgba(245, 158, 11, 0.28)',
            color: '#fbbf24',
            barColor: '#f59e0b'
        },
        {
            name: '🥑 ไขมัน (Fat)',
            gram: sumF,
            target: t.fGram,
            cal: Math.round(sumF * 9),
            pct: t.fGram > 0 ? Math.min(100, Math.round((sumF / t.fGram) * 100)) : 0,
            bg: 'rgba(244, 63, 94, 0.08)',
            border: 'rgba(244, 63, 94, 0.28)',
            color: '#fb7185',
            barColor: '#f43f5e'
        }
    ];

    macros.forEach((m, idx) => {
        const mx = heroX + idx * (macroW + gap);
        ctx.fillStyle = m.bg;
        ctx.strokeStyle = m.border;
        ctx.lineWidth = 1.5;
        roundRect(ctx, mx, macroY, macroW, macroH, 22, true, true);

        // Title
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.font = 'bold 18px Prompt, sans-serif';
        ctx.fillStyle = m.color;
        ctx.fillText(m.name, mx + 20, macroY + 18);

        // Grams
        ctx.font = 'bold 38px Prompt, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`${m.gram}g`, mx + 20, macroY + 48);

        const gW = ctx.measureText(`${m.gram}g`).width;
        ctx.font = 'bold 18px Prompt, sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(` / ${m.target}g`, mx + 20 + gW + 4, macroY + 64);

        // Progress Bar
        const barW = macroW - 40;
        const fillW = Math.max(4, Math.min(barW, Math.round((m.pct / 100) * barW)));
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        roundRect(ctx, mx + 20, macroY + 104, barW, 8, 4, true, false);

        ctx.fillStyle = m.barColor;
        roundRect(ctx, mx + 20, macroY + 104, fillW, 8, 4, true, false);

        // Meta row
        ctx.font = '500 15px Prompt, sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(`${m.cal} kcal`, mx + 20, macroY + 126);

        ctx.textAlign = 'right';
        ctx.fillStyle = m.color;
        ctx.fillText(`${m.pct}%`, mx + macroW - 20, macroY + 126);
    });

    // 5. Water Hydration Bar (Y: 655 - 745)
    const waterY = 655, waterW = 960, waterH = 88;
    ctx.fillStyle = 'rgba(14, 165, 233, 0.08)';
    ctx.strokeStyle = 'rgba(14, 165, 233, 0.28)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, heroX, waterY, waterW, waterH, 22, true, true);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 20px Prompt, sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('💧 น้ำดื่มสะอาด (Water Intake)', heroX + 22, waterY + 32);

    ctx.textAlign = 'right';
    ctx.font = 'bold 20px Prompt, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${waterGlasses} / ${t.waterTargetGlasses} แก้ว  (${waterMl.toLocaleString()} / ${t.waterTargetMl.toLocaleString()} มล.)`, heroX + waterW - 22, waterY + 32);

    // Water bar
    const wPct = t.waterTargetGlasses > 0 ? Math.min(100, Math.round((waterGlasses / t.waterTargetGlasses) * 100)) : 0;
    const wBarW = waterW - 44;
    const wFillW = Math.max(4, Math.min(wBarW, Math.round((wPct / 100) * wBarW)));

    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    roundRect(ctx, heroX + 22, waterY + 60, wBarW, 8, 4, true, false);

    const waterGrad = ctx.createLinearGradient(heroX + 22, waterY + 60, heroX + 22 + wBarW, waterY + 60);
    waterGrad.addColorStop(0, '#38bdf8');
    waterGrad.addColorStop(1, '#0284c7');
    ctx.fillStyle = waterGrad;
    roundRect(ctx, heroX + 22, waterY + 60, wFillW, 8, 4, true, false);

    // 6. Four Meals Summary Box (Y: 760 - 1285)
    const mealsY = 760, mealsW = 960, mealsH = 525;
    ctx.fillStyle = 'rgba(30, 41, 59, 0.65)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, heroX, mealsY, mealsW, mealsH, 28, true, true);

    // Header of meals box
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 22px Prompt, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('🍽️ บันทึก 4 มื้ออาหารวันนี้ (Meals Summary)', heroX + 24, mealsY + 22);

    ctx.textAlign = 'right';
    ctx.font = 'bold 16px Prompt, sans-serif';
    ctx.fillStyle = '#10b981';
    ctx.fillText(`รวมทั้งหมด ${meals.length} รายการ`, heroX + mealsW - 24, mealsY + 25);

    // Group meals
    const mealGroups = {
        breakfast: { name: '🌅 มื้อเช้า', items: [] },
        lunch: { name: '☀️ มื้อเที่ยง', items: [] },
        dinner: { name: '🌙 มื้อเย็น', items: [] },
        snack: { name: '🍎 ของว่าง', items: [] }
    };
    meals.forEach(m => {
        const k = m.meal && mealGroups[m.meal] ? m.meal : 'breakfast';
        mealGroups[k].items.push(m);
    });

    const mealKeys = ['breakfast', 'lunch', 'dinner', 'snack'];
    const rowH = 96, rowGap = 12;

    mealKeys.forEach((k, idx) => {
        const grp = mealGroups[k];
        const ry = mealsY + 68 + idx * (rowH + rowGap);
        const rw = mealsW - 48;
        const rx = heroX + 24;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.lineWidth = 1;
        roundRect(ctx, rx, ry, rw, rowH, 18, true, true);

        const grpCal = Math.round(grp.items.reduce((s, x) => s + (x.cal || 0), 0));

        // Meal title
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.font = 'bold 20px Prompt, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(grp.name, rx + 18, ry + 16);

        // Meal Calorie Pill
        const calStr = `${grpCal} kcal`;
        ctx.font = 'bold 16px Prompt, sans-serif';
        const calPillW = ctx.measureText(calStr).width + 24;
        ctx.fillStyle = grpCal > 0 ? 'rgba(16, 185, 129, 0.18)' : 'rgba(148, 163, 184, 0.1)';
        ctx.strokeStyle = grpCal > 0 ? 'rgba(16, 185, 129, 0.35)' : 'rgba(148, 163, 184, 0.2)';
        ctx.lineWidth = 1;
        roundRect(ctx, rx + rw - calPillW - 18, ry + 14, calPillW, 30, 15, true, true);

        ctx.textAlign = 'center';
        ctx.fillStyle = grpCal > 0 ? '#34d399' : '#94a3b8';
        ctx.fillText(calStr, rx + rw - calPillW / 2 - 18, ry + 20);

        // Food Items text line
        ctx.textAlign = 'left';
        ctx.font = '400 16px Prompt, sans-serif';
        if (grp.items.length === 0) {
            ctx.fillStyle = '#64748b';
            ctx.fillText('— ยังไม่ได้บันทึกรายการในมื้อนี้ —', rx + 18, ry + 56);
        } else {
            const itemStrs = grp.items.map(x => `${x.name}${x.portion && x.portion !== 1 ? ` (x${x.portion})` : ''}`);
            const joined = fitText(ctx, itemStrs.join(', '), rw - 36);
            ctx.fillStyle = '#cbd5e1';
            ctx.fillText(joined, rx + 18, ry + 56);
        }
    });

    // 7. Footer (Y: 1305 - 1380)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(heroX, 1315);
    ctx.lineTo(heroX + heroW, 1315);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '500 16px Prompt, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText('✨ NovaFit Pro • สุขภาพและรูปร่างที่ดีสร้างได้ทุกวัน', heroX, 1350);

    ctx.textAlign = 'right';
    ctx.font = 'bold 16px Prompt, sans-serif';
    ctx.fillStyle = '#10b981';
    ctx.fillText('novafit-pro • by BenzNova', heroX + heroW, 1350);
}

function downloadShareCard() {
    const canvas = document.getElementById('shareCardCanvas');
    if (!canvas) return;
    const state = window.state || {};
    const dStr = state.selectedDate || (typeof getTodayStr === 'function' ? getTodayStr() : new Date().toISOString().split('T')[0]);
    canvas.toBlob(blob => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `novafit-summary-${dStr}.png`;
        a.click();
        URL.revokeObjectURL(url);
        if (typeof window.showToast === 'function') {
            window.showToast('📸 ดาวน์โหลดการ์ดรูปภาพสำเร็จแล้ว!');
        }
    }, 'image/png');
}

async function copyShareCardImage() {
    const canvas = document.getElementById('shareCardCanvas');
    if (!canvas) return;
    if (!navigator.clipboard || !window.ClipboardItem) {
        downloadShareCard();
        return;
    }
    try {
        canvas.toBlob(async blob => {
            if (!blob) return;
            try {
                await navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': blob })
                ]);
                if (typeof window.showToast === 'function') {
                    window.showToast('📋 คัดลอกรูปภาพแล้ว! กด Paste (วาง) ใน LINE ได้ทันที');
                }
            } catch (err) {
                console.warn('Clipboard write failed, downloading instead:', err);
                downloadShareCard();
            }
        }, 'image/png');
    } catch (e) {
        downloadShareCard();
    }
}

async function shareCardNative() {
    const canvas = document.getElementById('shareCardCanvas');
    if (!canvas) return;
    const state = window.state || {};
    const dStr = state.selectedDate || (typeof getTodayStr === 'function' ? getTodayStr() : new Date().toISOString().split('T')[0]);
    if (!navigator.canShare || !navigator.share) {
        downloadShareCard();
        return;
    }
    canvas.toBlob(async blob => {
        if (!blob) return;
        try {
            const file = new File([blob], `novafit-summary-${dStr}.png`, { type: 'image/png' });
            if (navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: 'สรุปโภชนาการ NovaFit Pro',
                    text: `สรุปโภชนาการและแคลอรีวันที่ ${dStr} ผ่าน NovaFit Pro (by BenzNova)`
                });
            } else {
                downloadShareCard();
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                downloadShareCard();
            }
        }
    }, 'image/png');
}

// Window Global Exports
window.roundRect = roundRect;
window.fitText = fitText;
window.openShareCardModal = openShareCardModal;
window.closeShareCardModal = closeShareCardModal;
window.renderShareCard = renderShareCard;
window.downloadShareCard = downloadShareCard;
window.copyShareCardImage = copyShareCardImage;
window.shareCardNative = shareCardNative;
