---
name: new-chat-init
description: >-
  Use this skill whenever a new conversation begins, or when the user says "เริ่มแชทใหม่",
  "เริ่มงานใหม่", "start session", "new task", or wants to initialize the NovaFit Pro workspace
  safely with zero token waste and full two-device Git synchronization.
---

# 🚀 NovaFit Pro - New Chat Session Initialization Runbook

This skill establishes a clean, synchronized, and token-efficient baseline whenever a new chat session starts.

## Step 1: Mandatory Git 2-Device Synchronization Check
Always verify remote status and sync with GitHub before touching any project files:

1. Check current branch and git status:
   ```bash
   git status
   ```
2. If working directory is clean and on `main`:
   ```bash
   git pull origin main
   ```
   *If on an unmerged feature branch, check whether previous work was completed or needs UAT verification before switching.*
3. Verify committer identity:
   * Committer Name: `Devyhero`
   * Email: `benznova01@gmail.com`

## Step 2: System Health & Version Verification
Run the automated preflight checker to ensure syntax, HTML balance, and version consistency:
```bash
node scripts/test-preflight.js
```
- Confirm the current app version from `public/version.json`.
- Ensure all tests pass with 0 errors.

## Step 3: Zero-Token Codebase Reference Protocol
To prevent wasting tens of thousands of tokens:
- **DO NOT** read `public/app.js` (modularized down from 7,651 to 2,739 lines) or `public/index.html` (4,635 lines) in full.
- Instead, read [CODEBASE_MAP.md](file:///Users/benznova/Desktop/fitmacro-web/CODEBASE_MAP.md) to locate exact line ranges and component positions.
- When inspecting or modifying code, use `read_file` with targeted `StartLine` and `EndLine` ranges.

## Step 4: Feature Architecture & Branching Rule
When the user specifies a new task:
1. **Branching**:
   ```bash
   git checkout -b feature/<feature-name>
   ```
   *Never develop new features directly on `main`.*
2. **Modular File Strategy**:
   - Create new standalone files (e.g., `public/<feature-name>.js`) rather than bloating `public/app.js`.
   - Register script in `public/index.html` and `public/sw.js`.
   - Connect to `window.state` and `window.saveState()`.

## Step 5: Report Readiness to User
Provide a concise, polite Thai status summary:
- 🌿 **Current Branch**: [branch name]
- 🏷️ **Version**: [version number]
- 🛡️ **System Status**: Pre-flight Passed (100% Green)
- 🚀 **Next Step**: Prompt user for the task/feature they would like to work on today.
