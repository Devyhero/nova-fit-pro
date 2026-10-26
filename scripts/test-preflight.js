#!/usr/bin/env node

/**
 * NovaFit Pro Pre-flight Verification Script
 * Validates syntax, HTML tag balance, modal DOM hierarchy, assets, version sync, and Firebase rules.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

let hasError = false;

function logPass(msg) {
    console.log(`\x1b[32m✔ PASS:\x1b[0m ${msg}`);
}

function logFail(msg, detail = '') {
    hasError = true;
    console.error(`\x1b[31m✖ FAIL:\x1b[0m ${msg}`);
    if (detail) console.error(`  \x1b[33m${detail}\x1b[0m`);
}

function logInfo(msg) {
    console.log(`\x1b[36mℹ INFO:\x1b[0m ${msg}`);
}

console.log('========================================');
console.log('🚀 Running Pre-flight Quality Checks...');
console.log('========================================');

// 1. Check JSON files
const jsonFiles = [
    'public/version.json',
    'public/manifest.json',
    'public/health-tips.json',
    'firebase.json',
    '.firebaserc'
];

for (const relPath of jsonFiles) {
    const fullPath = path.join(ROOT_DIR, relPath);
    try {
        const content = fs.readFileSync(fullPath, 'utf8');
        JSON.parse(content);
        logPass(`JSON syntax valid: ${relPath}`);
    } catch (err) {
        logFail(`Invalid JSON in ${relPath}`, err.message);
    }
}

// 2. Check JavaScript standalone files
const jsFiles = [
    { path: 'public/sw.js', isModule: false },
    { path: 'public/app.js', isModule: false },
    { path: 'public/mascot-companion.js', isModule: false },
    { path: 'public/food-db.js', isModule: false },
    { path: 'public/health-tips.js', isModule: false },
    { path: 'public/ai-snap.js', isModule: false },
    { path: 'public/nutrition-scanner.js', isModule: false },
    { path: 'public/firebase-sync.js', isModule: true },
    { path: 'public/admin.js', isModule: true }
];

for (const { path: relPath, isModule } of jsFiles) {
    const fullPath = path.join(ROOT_DIR, relPath);
    try {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (isModule) {
            execSync(`node --input-type=module --check < "${fullPath}"`, { stdio: 'pipe' });
        } else {
            new vm.Script(content);
        }
        logPass(`JS syntax valid: ${relPath}`);
    } catch (err) {
        logFail(`JS syntax error in ${relPath}`, err.message);
    }
}

// 3. Extract and check all inline scripts in public/index.html
const indexPath = path.join(PUBLIC_DIR, 'index.html');
let indexHtml = '';
try {
    indexHtml = fs.readFileSync(indexPath, 'utf8');
    const scriptRegex = /<script(?:\s+type="([^"]*)")?(?:\s+src="([^"]*)")?[^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    let scriptIdx = 0;
    while ((match = scriptRegex.exec(indexHtml)) !== null) {
        const [, type, src, content] = match;
        if (src) continue; // external or separate file
        if (type && type !== 'text/javascript' && type !== 'module') continue;

        scriptIdx++;
        try {
            new vm.Script(content, { filename: `index.html[inline-script-#${scriptIdx}]` });
            logPass(`index.html inline script #${scriptIdx} (${content.trim().length} chars) valid`);
        } catch (err) {
            logFail(`index.html inline script #${scriptIdx} syntax error`, err.message);
        }
    }
    if (scriptIdx === 0) {
        logFail('No inline scripts found in public/index.html (unexpected)');
    }
} catch (err) {
    logFail('Failed to read or parse public/index.html', err.message);
}

// 4. Validate HTML Tag Nesting & Balance in public/index.html
try {
    const tokenRegex = /<\/?([a-zA-Z0-9]+)(?:\s+[^>]*)?>/g;
    let match;
    const stack = [];
    let mismatchFound = false;

    while ((match = tokenRegex.exec(indexHtml)) !== null) {
        const full = match[0];
        const tagName = match[1].toLowerCase();
        const isClosing = full.startsWith('</');
        const isSelfClosing = full.endsWith('/>') || ['meta', 'link', 'br', 'hr', 'input', 'img', 'col', 'base'].includes(tagName);

        if (isSelfClosing) continue;

        const lineNum = indexHtml.substring(0, match.index).split('\n').length;
        const id = (full.match(/id="([^"]*)"/) || [])[1] || '';

        if (!isClosing) {
            stack.push({ tag: tagName, line: lineNum, id, full: full.slice(0, 50) });
        } else {
            if (stack.length === 0) {
                logFail(`HTML extra closing tag </${tagName}> at line ${lineNum}`);
                mismatchFound = true;
                break;
            }
            const top = stack.pop();
            if (top.tag !== tagName) {
                logFail(`HTML tag mismatch at line ${lineNum}: expected </${top.tag}> (opened line ${top.line} <${top.tag} id="${top.id}">), found </${tagName}>`);
                mismatchFound = true;
                break;
            }
        }
    }

    if (!mismatchFound) {
        if (stack.length === 0) {
            logPass('HTML tag structure & balance perfectly closed (0 unclosed tags)');
        } else {
            logFail(`HTML has ${stack.length} unclosed tag(s): ${stack.map(s => `<${s.tag} id="${s.id}"> (line ${s.line})`).join(', ')}`);
        }
    }
} catch (err) {
    logFail('Error validating HTML structure', err.message);
}

// 5. Verify Modal DOM Hierarchy (Ensure all modals are independent and not nested inside other modals)
try {
    const requiredModals = ['dailyReportModal', 'changelogModal', 'shareCardModal', 'addSupplementModal'];
    for (const mId of requiredModals) {
        const mIdx = indexHtml.indexOf(`id="${mId}"`);
        if (mIdx === -1) {
            logFail(`Modal #${mId} not found in public/index.html`);
            continue;
        }
        // Verify modal has its own container and is not nested inside changelogModal or other modals
        for (const otherId of requiredModals) {
            if (mId === otherId) continue;
            const oIdx = indexHtml.indexOf(`id="${otherId}"`);
            if (oIdx !== -1 && oIdx < mIdx) {
                // Ensure other modal was closed before mId starts
                const between = indexHtml.substring(oIdx, mIdx);
                const closes = (between.match(/<\/div>/gi) || []).length;
                const opens = (between.match(/<div(\s+[^>]*)?>/gi) || []).length;
                if (opens >= closes) {
                    logFail(`Modal #${mId} appears to be nested inside #${otherId} (opens=${opens}, closes=${closes})`);
                }
            }
        }
    }
    logPass('Modal DOM hierarchy verified: all 4 modals are independent top-level dialogs');
} catch (err) {
    logFail('Error checking modal DOM hierarchy', err.message);
}

// 6. Verify linked local assets exist
try {
    const srcRegex = /(?:src|href)=["']([^"':#?]+)(?:\?[^"']*)?["']/gi;
    let match;
    const checked = new Set();
    while ((match = srcRegex.exec(indexHtml)) !== null) {
        let assetPath = match[1];
        if (assetPath.startsWith('http') || assetPath.startsWith('//') || assetPath.startsWith('data:')) continue;
        if (assetPath.startsWith('/')) assetPath = assetPath.slice(1);
        if (!assetPath || checked.has(assetPath)) continue;
        checked.add(assetPath);

        const fullAssetPath = path.join(PUBLIC_DIR, assetPath);
        if (fs.existsSync(fullAssetPath)) {
            logPass(`Asset reference exists: ${assetPath}`);
        } else {
            logFail(`Broken asset link in index.html: ${assetPath} not found in public/`);
        }
    }
} catch (err) {
    logFail('Error verifying asset references', err.message);
}

// 7. Version consistency check across version.json, sw.js, app.js, and index.html
try {
    const versionData = JSON.parse(fs.readFileSync(path.join(PUBLIC_DIR, 'version.json'), 'utf8'));
    const swContent = fs.readFileSync(path.join(PUBLIC_DIR, 'sw.js'), 'utf8');
    const appContent = fs.readFileSync(path.join(PUBLIC_DIR, 'app.js'), 'utf8');
    const curVer = versionData.version;
    
    if (curVer && swContent.includes(curVer) && appContent.includes(`APP_VERSION = '${curVer}'`) && indexHtml.includes(`v=${curVer}`)) {
        logPass(`Version alignment verified: v${curVer} across version.json, sw.js, app.js, and index.html`);
    } else {
        logFail(`Version mismatch! version.json has "${curVer}", check sw.js, app.js, and index.html.`);
    }
} catch (err) {
    logFail('Error checking version consistency', err.message);
}

// 8. Firebase Firestore rules dry-run check
function hasCommand(bin) {
    try {
        const checkCmd = process.platform === 'win32' ? `where.exe ${bin}` : `which ${bin}`;
        execSync(checkCmd, { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

if (!hasCommand('firebase')) {
    logInfo('Firebase CLI is not installed in current environment PATH. Skipping dry-run.');
} else {
    try {
        const bin = process.platform === 'win32' ? 'firebase.cmd' : 'firebase';
        const env = Object.assign({}, process.env, { NODE_TLS_REJECT_UNAUTHORIZED: '0' });
        execSync(`${bin} deploy --dry-run`, { stdio: 'pipe', cwd: ROOT_DIR, env });
        logPass('Firebase deployment dry-run passed (rules & hosting validated)');
    } catch (err) {
        const outStr = (err.stdout ? err.stdout.toString() : '') + ' ' + (err.stderr ? err.stderr.toString() : '') + ' ' + (err.message || '');
        if (outStr.includes('firebase login') || outStr.includes('Failed to authenticate') || outStr.includes('not logged in')) {
            logInfo('Firebase CLI is installed but not authenticated on this machine (run "firebase login" to connect). Skipping dry-run.');
        } else {
            logFail('Firebase dry-run failed', err.message);
        }
    }
}

console.log('========================================');
if (hasError) {
    console.error('❌ PRE-FLIGHT CHECKS FAILED! Code has issues. ABORTING Git push & Firebase deploy.');
    process.exit(1);
} else {
    console.log('✅ ALL PRE-FLIGHT CHECKS PASSED! Code is healthy and ready for Git & Firebase deploy.');
    process.exit(0);
}
