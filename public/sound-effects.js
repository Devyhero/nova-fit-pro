/**
 * NovaFit Pro - Sound Effects & Web Audio Synthesizer (v5.9.30)
 * Provides real-time procedural Web Audio sound synthesis (pop, water, celebrate, nudge, delete),
 * iOS Safari touch unlocking, sound mute/unmute state management, and UI badge updates.
 */

(function () {
    'use strict';

    let _audioCtx = null;

    function getAppStateSafe() {
        return (typeof window !== 'undefined' && window.state) ? window.state : (typeof state !== 'undefined' ? state : null);
    }

    function saveStateSafe() {
        if (typeof saveState === 'function') return saveState();
        if (typeof window.saveState === 'function') return window.saveState();
    }

    function showToastSafe(msg) {
        if (typeof showToast === 'function') return showToast(msg);
        if (typeof window.showToast === 'function') return window.showToast(msg);
    }

    function getAudioContext() {
        if (!_audioCtx && (window.AudioContext || window.webkitAudioContext)) {
            const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
            _audioCtx = new AudioCtxClass();
        }
        if (_audioCtx && _audioCtx.state === 'suspended') {
            _audioCtx.resume();
        }
        return _audioCtx;
    }

    // Unlock audio context on initial user tap (iOS Safari requirement)
    window.addEventListener('touchstart', () => getAudioContext(), { once: true, passive: true });
    window.addEventListener('click', () => getAudioContext(), { once: true, passive: true });

    function playSound(type = 'pop') {
        const appState = getAppStateSafe();
        if (appState && appState.soundEnabled === false) return;
        try {
            const ctx = getAudioContext();
            if (!ctx) return;

            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            if (type === 'pop') {
                // Bright cute pop sound (Food logged / item added)
                osc.type = 'sine';
                osc.frequency.setValueAtTime(540, now);
                osc.frequency.exponentialRampToValueAtTime(920, now + 0.08);
                gain.gain.setValueAtTime(0.22, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
                osc.start(now);
                osc.stop(now + 0.12);
            } else if (type === 'water') {
                // Refreshing water droplet sound (Water intake)
                osc.type = 'sine';
                osc.frequency.setValueAtTime(620, now);
                osc.frequency.exponentialRampToValueAtTime(1020, now + 0.06);
                osc.frequency.exponentialRampToValueAtTime(480, now + 0.16);
                gain.gain.setValueAtTime(0.28, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
                osc.start(now);
                osc.stop(now + 0.18);
            } else if (type === 'celebrate') {
                // Cheerful celebratory 4-tone chime arpeggio (Milestones & Confetti)
                const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
                notes.forEach((freq, idx) => {
                    const noteOsc = ctx.createOscillator();
                    const noteGain = ctx.createGain();
                    noteOsc.type = 'triangle';
                    noteOsc.frequency.setValueAtTime(freq, now + idx * 0.06);
                    noteGain.gain.setValueAtTime(0.18, now + idx * 0.06);
                    noteGain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.22);
                    noteOsc.connect(noteGain);
                    noteGain.connect(ctx.destination);
                    noteOsc.start(now + idx * 0.06);
                    noteOsc.stop(now + idx * 0.06 + 0.22);
                });
            } else if (type === 'nudge') {
                // Sweet bubble chirp (Living Companion nudge)
                osc.type = 'sine';
                osc.frequency.setValueAtTime(460, now);
                osc.frequency.exponentialRampToValueAtTime(690, now + 0.09);
                gain.gain.setValueAtTime(0.16, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
                osc.start(now);
                osc.stop(now + 0.14);
            } else if (type === 'delete') {
                // Subtle soft click drop (Item deleted)
                osc.type = 'sine';
                osc.frequency.setValueAtTime(340, now);
                osc.frequency.exponentialRampToValueAtTime(170, now + 0.08);
                gain.gain.setValueAtTime(0.18, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
                osc.start(now);
                osc.stop(now + 0.1);
            }
        } catch (err) {
            console.warn('Audio synthesis note:', err);
        }
    }

    function renderSoundButton() {
        const appState = getAppStateSafe();
        const isMuted = appState && appState.soundEnabled === false;

        // 1. Settings Modal Controls
        const icon = document.getElementById('soundIcon');
        const btn = document.getElementById('btnSoundToggle');
        const modalIcon = document.getElementById('soundModalIcon');
        const statusBadge = document.getElementById('soundStatusBadge');
        const toggleText = document.getElementById('soundToggleBtnText');

        if (icon) icon.textContent = isMuted ? '🔇' : '🔊';
        if (modalIcon) modalIcon.textContent = isMuted ? '🔇' : '🔊';
        if (btn) btn.title = isMuted ? 'เปิดเสียงเอฟเฟกต์ (Unmute)' : 'ปิดเสียงเอฟเฟกต์ (Mute)';
        if (toggleText) toggleText.textContent = isMuted ? 'เปิดเสียง' : 'ปิดเสียง';
        if (statusBadge) {
            statusBadge.textContent = isMuted ? 'ปิดใช้งาน' : 'เปิดใช้งาน';
            statusBadge.className = isMuted
                ? 'text-xs px-2.5 py-1 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-bold'
                : 'text-xs px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold';
        }
        if (btn) {
            btn.className = isMuted
                ? 'px-3.5 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-1.5'
                : 'px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-1.5';
        }

        // 2. Tools Dropdown Controls
        const menuIcon = document.getElementById('soundMenuIcon');
        const menuBadge = document.getElementById('soundMenuBadge');
        if (menuIcon) menuIcon.textContent = isMuted ? '🔇' : '🔊';
        if (menuBadge) {
            menuBadge.textContent = isMuted ? 'ปิด' : 'เปิด';
            menuBadge.className = isMuted
                ? 'text-[10px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 font-bold'
                : 'text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold';
        }
    }

    function toggleSound() {
        const appState = getAppStateSafe();
        if (!appState) return;

        appState.soundEnabled = !(appState.soundEnabled !== false);
        saveStateSafe();
        renderSoundButton();
        if (appState.soundEnabled) {
            playSound('pop');
            showToastSafe('🔊 เปิดเสียงเอฟเฟกต์ในแอปเรียบร้อย');
        } else {
            showToastSafe('🔇 ปิดเสียงเอฟเฟกต์ในแอปเรียบร้อย');
        }
    }

    // Attach to window for global access and backward compatibility
    window.getAudioContext = getAudioContext;
    window.playSound = playSound;
    window.renderSoundButton = renderSoundButton;
    window.toggleSound = toggleSound;
})();
