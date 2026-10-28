/**
 * NovaFit Pro - Data Backup, Restore & PWA Engine (v5.9.30)
 * Handles JSON backup export, backup file restoration,
 * database factory reset dialog, and PWA installation prompt handling.
 */

(function () {
    'use strict';

    // Safe inter-module helpers
    function getAppStateSafe() {
        return typeof state !== 'undefined' ? state : window.state;
    }

    function saveStateSafe() {
        if (typeof saveState === 'function') return saveState();
        if (typeof window.saveState === 'function') return window.saveState();
    }

    function renderAllSafe() {
        if (typeof renderAll === 'function') return renderAll();
        if (typeof window.renderAll === 'function') return window.renderAll();
    }

    function showToastSafe(msg) {
        if (typeof showToast === 'function') return showToast(msg);
        if (typeof window.showToast === 'function') return window.showToast(msg);
    }

    function showConfirmDialogSafe(opts) {
        if (typeof showConfirmDialog === 'function') return showConfirmDialog(opts);
        if (typeof window.showConfirmDialog === 'function') return window.showConfirmDialog(opts);
        if (confirm(opts.message || 'ยืนยันการดำเนินการ')) {
            if (opts.onConfirm) opts.onConfirm();
        }
    }

    function getTodayStrSafe() {
        if (typeof getTodayStr === 'function') return getTodayStr();
        if (typeof window.getTodayStr === 'function') return window.getTodayStr();
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        return new Date(now.getTime() - offset).toISOString().split('T')[0];
    }

    function getStorageKeySafe() {
        if (typeof STORAGE_KEY !== 'undefined') return STORAGE_KEY;
        if (typeof window.STORAGE_KEY !== 'undefined') return window.STORAGE_KEY;
        return 'fitmacro_pro_v4_state';
    }

    function getAppVersionSafe() {
        if (typeof APP_VERSION !== 'undefined') return APP_VERSION;
        if (typeof window.APP_VERSION !== 'undefined') return window.APP_VERSION;
        return '5.9.30';
    }

    // ==========================================
    // DATA EXPORT, IMPORT & FACTORY RESET
    // ==========================================
    function exportData() {
        const appState = getAppStateSafe();
        if (!appState) return;
        const blob = new Blob([JSON.stringify(appState, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `novafit-pro-v5.1-backup-${getTodayStrSafe()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    function importData(event) {
        const file = event?.target?.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const imported = JSON.parse(e.target.result);
                if (imported && imported.profile) {
                    const appState = getAppStateSafe();
                    if (appState) {
                        const curVer = getAppVersionSafe();
                        Object.assign(appState, imported, { version: curVer });
                    }
                    saveStateSafe();
                    renderAllSafe();
                    showToastSafe('นำเข้าข้อมูลสำเร็จเรียบร้อยครับ!');
                } else {
                    alert('รูปแบบไฟล์ JSON ไม่ถูกต้องครับ');
                }
            } catch (err) {
                alert('ไม่สามารถอ่านไฟล์ JSON ได้ครับ');
            }
        };
        reader.readAsText(file);
    }

    function resetAllData() {
        showConfirmDialogSafe({
            icon: '⚠️',
            iconBgClass: 'w-14 h-14 mx-auto rounded-2xl bg-rose-500/15 text-rose-500 flex items-center justify-center text-3xl shadow-xs',
            title: 'ล้างข้อมูลทั้งหมดในเครื่อง',
            message: 'ต้องการล้างข้อมูลทั้งหมดในเครื่อง (รวมถึงประวัติทุกวัน) เพื่อเริ่มต้นใหม่ใช่หรือไม่? (การกระทำนี้ไม่สามารถย้อนกลับได้)',
            confirmText: 'ล้างข้อมูลทั้งหมด',
            confirmClass: 'flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition cursor-pointer',
            onConfirm: () => {
                localStorage.removeItem(getStorageKeySafe());
                location.reload();
            }
        });
    }

    // ==========================================
    // PWA INSTALLATION & PROMPT HANDLING
    // ==========================================
    let deferredPwaPrompt = null;
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPwaPrompt = e;
        const btn = document.getElementById('btnPwaInstall');
        if (btn) {
            btn.classList.add('ring-2', 'ring-indigo-400', 'animate-pulse');
        }
    });

    window.addEventListener('appinstalled', () => {
        deferredPwaPrompt = null;
        showToastSafe('🎉 ติดตั้ง NovaFit Pro สำเร็จแล้ว! เปิดใช้งานจากหน้าจอโฮมได้เลย');
        const btn = document.getElementById('btnPwaInstall');
        if (btn) btn.style.display = 'none';
    });

    function handlePwaInstallClick() {
        if (deferredPwaPrompt) {
            deferredPwaPrompt.prompt();
            deferredPwaPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    showToastSafe('กำลังติดตั้ง NovaFit Pro ลงในอุปกรณ์ของคุณ...');
                }
                deferredPwaPrompt = null;
            });
        } else {
            const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
            if (isIos) {
                alert('📱 วิธีติดตั้ง NovaFit Pro บน iPhone / iPad (Safari):\n\n1. แตะปุ่มแชร์ ⎋ (Share) ด้านล่างของ Safari\n2. เลื่อนลงแล้วเลือก "เพิ่มไปยังหน้าจอโฮม" (Add to Home Screen)\n3. แตะ "เพิ่ม" (Add)\n\nคุณจะได้แอป NovaFit Pro แบบเต็มจอ ใช้งานออฟไลน์ได้ 100%!');
            } else {
                alert('📱 วิธีติดตั้ง NovaFit Pro (PWA):\n\n• หากใช้งาน Google Chrome / Edge: กดจุด 3 จุด (⋮) ด้านขวาบน แล้วเลือก "ติดตั้งแอป" หรือ "เพิ่มไปยังหน้าจอหลัก"\n• แอปจะถูกติดตั้งลงอุปกรณ์ ใช้งานแบบเต็มจอและเปิดได้แม้อยู่นอกสัญญาณเน็ต!');
            }
        }
    }

    // Attach to window for global access and backward compatibility
    window.exportData = exportData;
    window.importData = importData;
    window.resetAllData = resetAllData;
    window.handlePwaInstallClick = handlePwaInstallClick;
})();
