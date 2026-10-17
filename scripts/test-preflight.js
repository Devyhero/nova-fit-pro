#!/usr/bin/env node

/**
 * NovaFit Pro Pre-flight Verification Script
 * Validates syntax, integrity, version sync, and rules before Git push & Firebase deploy.
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
    { path: 'public/food-db.js', isModule: false },
    { path: 'public/firebase-sync.js', isModule: true }
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
try {
    const html = fs.readFileSync(indexPath, 'utf8');
    const scriptRegex = /<script(?:\s+type="([^"]*)")?(?:\s+src="([^"]*)")?[^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    let scriptIdx = 0;
    while ((match = scriptRegex.exec(html)) !== null) {
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

// 4. Verify linked local assets exist
try {
    const html = fs.readFileSync(indexPath, 'utf8');
    const srcRegex = /(?:src|href)=["']([^"':#?]+)(?:\?[^"']*)?["']/gi;
    let match;
    const checked = new Set();
    while ((match = srcRegex.exec(html)) !== null) {
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

// 5. Version consistency check between version.json and sw.js
try {
    const versionData = JSON.parse(fs.readFileSync(path.join(PUBLIC_DIR, 'version.json'), 'utf8'));
    const swContent = fs.readFileSync(path.join(PUBLIC_DIR, 'sw.js'), 'utf8');
    
    if (versionData.version && swContent.includes(versionData.version)) {
        logPass(`Version alignment verified: v${versionData.version} in version.json and sw.js`);
    } else {
        logFail(`Version mismatch! version.json has "${versionData.version}" but sw.js does not contain it.`);
    }
} catch (err) {
    logFail('Error checking version consistency', err.message);
}

// 6. Firebase Firestore rules dry-run check
try {
    execSync('firebase deploy --dry-run', { stdio: 'pipe', cwd: ROOT_DIR });
    logPass('Firebase deployment dry-run passed (rules & hosting validated)');
} catch (err) {
    logFail('Firebase dry-run failed', err.message);
}

console.log('========================================');
if (hasError) {
    console.error('❌ PRE-FLIGHT CHECKS FAILED! Code has issues. ABORTING Git push & Firebase deploy.');
    process.exit(1);
} else {
    console.log('✅ ALL PRE-FLIGHT CHECKS PASSED! Code is healthy and ready for Git & Firebase deploy.');
    process.exit(0);
}
