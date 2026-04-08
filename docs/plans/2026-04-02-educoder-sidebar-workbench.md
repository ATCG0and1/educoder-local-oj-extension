# Educoder 侧边栏工作台 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a visible Activity Bar entry and sidebar workbench to the Educoder Local OJ extension, and make `Open Task` usable without a pre-supplied `taskRoot`.

**Architecture:** Keep the existing dashboard panel, but add a new sidebar `WebviewViewProvider` as the always-visible launcher. Extend command wiring with an interactive task picker so users can sync a collection, pick a task, and open it entirely from visible UI. Reuse existing task state loading and dashboard rendering primitives wherever possible.

**Tech Stack:** TypeScript, VS Code Extension API, Vitest, Node `fs/promises`, existing command system, existing dashboard webview rendering.

---

### Task 1: Lock the interactive task picker behavior with failing tests

**Files:**
- Create: `tests/unit/openTaskInteractive.test.ts`
- Modify: `tests/setup/vscode.setup.ts`
- Create: `src/commands/openTaskInteractive.ts`

**Step 1: Write the failing test**

Add tests that prove:
- when no `taskRoot` is provided, the interactive opener scans local manifests and shows a QuickPick;
- selecting a task calls the existing opener with the chosen `taskRoot`;
- when no tasks are available, a friendly error is thrown.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/openTaskInteractive.test.ts`  
Expected: FAIL because the interactive open flow does not exist.

**Step 3: Write minimal implementation**

Implement:
- local task manifest discovery
- QuickPick item mapping
- bridge to existing `openTaskCommand(...)`

Keep the existing direct `openTaskCommand(taskRoot)` API unchanged.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/openTaskInteractive.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add tests/unit/openTaskInteractive.test.ts tests/setup/vscode.setup.ts src/commands/openTaskInteractive.ts
git commit -m "feat: add interactive task picker for open task"
```

---

### Task 2: Lock sidebar rendering and command bridge behavior with failing tests

**Files:**
- Create: `tests/unit/dashboardSidebar.test.ts`
- Modify: `tests/setup/vscode.setup.ts`
- Create: `src/webview/dashboard/sidebar.ts`

**Step 1: Write the failing test**

Add tests that prove:
- the sidebar provider resolves a webview view;
- the initial HTML shows global actions (`Sync Current Collection`, `Open Task`, `Refresh`);
- sending a webview message triggers the requested command and refresh flow.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/dashboardSidebar.test.ts`  
Expected: FAIL because the sidebar provider does not exist.

**Step 3: Write minimal implementation**

Implement:
- `registerDashboardSidebarView(...)`
- webview render function for empty state + current task state
- webview message handler for command execution / refresh

Reuse existing dashboard task rendering where possible.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/dashboardSidebar.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add tests/unit/dashboardSidebar.test.ts tests/setup/vscode.setup.ts src/webview/dashboard/sidebar.ts
git commit -m "feat: add sidebar workbench provider"
```

---

### Task 3: Wire the sidebar container and open-task fallback through extension activation

**Files:**
- Modify: `tests/smoke/commands.smoke.test.ts`
- Modify: `tests/smoke/dashboardPanel.smoke.test.ts`
- Modify: `src/extension.ts`
- Modify: `package.json`
- Create: `media/educoder-oj.svg`

**Step 1: Write the failing test**

Add tests that prove:
- activation registers the sidebar provider;
- command execution can open a task without pre-supplied `taskRoot`;
- the view HTML still shows task state after an opened task is available.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/smoke/commands.smoke.test.ts tests/smoke/dashboardPanel.smoke.test.ts`  
Expected: FAIL because activation and package contributions are incomplete.

**Step 3: Write minimal implementation**

Implement:
- `onView:educoderLocalOj.sidebar` activation
- `viewsContainers` / `views` contributions
- sidebar provider registration in `activate(...)`
- `educoderLocalOj.openTask` fallback to the interactive picker when `taskRoot` is absent

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/smoke/commands.smoke.test.ts tests/smoke/dashboardPanel.smoke.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add tests/smoke/commands.smoke.test.ts tests/smoke/dashboardPanel.smoke.test.ts src/extension.ts package.json media/educoder-oj.svg
git commit -m "feat: expose educoder workbench in activity bar"
```

---

### Task 4: Refresh docs and verify the packaged extension

**Files:**
- Modify: `README.md`

**Step 1: Write the failing doc expectation**

Update docs so they describe the real startup path:
- install VSIX
- click Activity Bar icon
- sync collection
- open task from sidebar

**Step 2: Run integrated verification**

Run:
- `npm test`
- `npm run typecheck`
- `npm run build`
- `npx @vscode/vsce package`

Expected:
- all tests PASS
- typecheck PASS
- build PASS
- VSIX generated successfully

**Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document sidebar workbench entry"
```
