# Educoder 任务树侧边栏 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a local manifest-backed task tree to the Educoder OJ sidebar so users can browse chapters, homeworks, and tasks and open any task directly from the tree.

**Architecture:** Introduce a shared local task catalog scanner backed by existing collection manifests, then expose it through a `TreeDataProvider` registered in the existing Activity Bar container. Keep the workbench webview intact and let task nodes call the existing `educoderLocalOj.openTask` command with a concrete `taskRoot`.

**Tech Stack:** TypeScript, VS Code Tree View API, existing manifest format, Vitest, Node `fs/promises`.

---

### Task 1: Lock the local task catalog contract with failing tests

**Files:**
- Create: `tests/unit/localTaskCatalog.test.ts`
- Create: `src/core/catalog/localTaskCatalog.ts`
- Modify: `src/commands/openTaskInteractive.ts`

**Step 1: Write the failing test**

Add tests that prove:
- collection manifests are scanned under the local product root
- returned hierarchy is chapter → homework → task
- task entries include concrete `taskRoot`

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/localTaskCatalog.test.ts`  
Expected: FAIL because the shared catalog scanner does not exist.

**Step 3: Write minimal implementation**

Implement the shared scanner and switch `openTaskInteractive` to reuse it.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/localTaskCatalog.test.ts tests/unit/openTaskInteractive.test.ts`  
Expected: PASS

---

### Task 2: Lock the tree provider behavior with failing tests

**Files:**
- Create: `tests/unit/taskTreeProvider.test.ts`
- Modify: `tests/setup/vscode.setup.ts`
- Create: `src/views/taskTreeProvider.ts`

**Step 1: Write the failing test**

Add tests that prove:
- root children are chapter nodes
- chapter children are homework nodes
- homework children are task nodes
- task nodes carry the `educoderLocalOj.openTask` command with `taskRoot`

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/taskTreeProvider.test.ts`  
Expected: FAIL because the tree provider does not exist.

**Step 3: Write minimal implementation**

Implement:
- `TaskTreeProvider`
- refresh event emitter
- node-to-tree-item mapping

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/taskTreeProvider.test.ts`  
Expected: PASS

---

### Task 3: Wire tree view registration into the sidebar container

**Files:**
- Modify: `tests/smoke/commands.smoke.test.ts`
- Create: `tests/smoke/taskTree.smoke.test.ts`
- Modify: `src/extension.ts`
- Modify: `package.json`

**Step 1: Write the failing test**

Add smoke checks that prove:
- activation registers the task tree provider
- package contributions expose `Task Tree` under the same activity bar container
- syncing collections refreshes the tree provider

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/smoke/commands.smoke.test.ts tests/smoke/taskTree.smoke.test.ts`  
Expected: FAIL because tree registration is missing.

**Step 3: Write minimal implementation**

Register the new tree provider and refresh it after `Sync Current Collection`.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/smoke/commands.smoke.test.ts tests/smoke/taskTree.smoke.test.ts`  
Expected: PASS

---

### Task 4: Update docs and verify packaged output

**Files:**
- Modify: `README.md`

**Step 1: Update docs**

Document:
- Task Tree view
- `章节 → 作业 → 题目`
- click task to open

**Step 2: Run integrated verification**

Run:
- `npm test`
- `npm run typecheck`
- `npm run build`
- `npx @vscode/vsce package`

Expected:
- all PASS
- VSIX generated successfully
