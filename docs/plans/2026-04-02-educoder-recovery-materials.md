# Educoder Recovery Materials Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a practical recovery/forensics layer to the Educoder Local OJ extension so users can restore official template code, restore passed code, inspect answer info, sync history/logs, and import historical commit snapshots directly inside VS Code.

**Architecture:** Build a new recovery-material pipeline on top of the existing Educoder API + task hydration flow. Keep HTTP adaptation in dedicated API clients, keep local persistence and metadata in a recovery store under `_educoder/`, and upgrade commands/UI so recovery actions transparently fetch remote material when local cache is missing.

**Tech Stack:** TypeScript, VS Code Extension API, Vitest, Node `fs/promises`, existing `EducoderClient`, existing `taskHydrator`, existing dashboard webview.

---

### Task 1: Lock the remote recovery-material API contracts with failing tests

**Files:**
- Create: `tests/unit/templateFetchClient.test.ts`
- Create: `tests/unit/passedFetchClient.test.ts`
- Create: `tests/unit/answerFetchClient.test.ts`
- Create: `src/core/api/templateFetchClient.ts`
- Create: `src/core/api/passedFetchClient.ts`
- Create: `src/core/api/answerFetchClient.ts`

**Step 1: Write the failing tests**

Add unit tests that prove:
- `reset_original_code.json` is requested with `path` + `homework_common_id`
- `reset_passed_code.json` is requested with `path` + `homework_common_id`
- `get_answer_info.json` normalizes answer entries into a stable local model
- code content is returned as `WorkspaceFile[]` so it can be written into `_educoder/template` / `_educoder/passed`

Suggested test core:

```ts
expect(calls).toEqual([
  ['/api/tasks/fc7pz3fm6yjh/reset_original_code.json', {
    path: 'test1/tasks.h',
    homework_common_id: '3727439',
  }],
]);
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- tests/unit/templateFetchClient.test.ts tests/unit/passedFetchClient.test.ts tests/unit/answerFetchClient.test.ts`
Expected: FAIL because the recovery clients do not exist.

**Step 3: Write minimal implementation**

Implement:
- `TemplateFetchClient.fetchTemplateFiles(...)`
- `PassedFetchClient.fetchPassedFiles(...)`
- `AnswerFetchClient.fetchAnswerInfo(...)`

Use the same style as `sourceFetchClient.ts`: thin API adapter + normalization helper.

**Step 4: Run tests to verify they pass**

Run: `npm test -- tests/unit/templateFetchClient.test.ts tests/unit/passedFetchClient.test.ts tests/unit/answerFetchClient.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/unit/templateFetchClient.test.ts tests/unit/passedFetchClient.test.ts tests/unit/answerFetchClient.test.ts src/core/api/templateFetchClient.ts src/core/api/passedFetchClient.ts src/core/api/answerFetchClient.ts
git commit -m "feat: add recovery material api clients"
```

---

### Task 2: Persist recovery metadata and lightweight answer/template/passed caches

**Files:**
- Create: `tests/unit/recoveryMaterialStore.test.ts`
- Modify: `tests/unit/taskHydrator.test.ts`
- Modify: `src/core/sync/taskHydrator.ts`
- Create: `src/core/recovery/materialStore.ts`
- Modify: `src/core/workspace/directoryLayout.ts`

**Step 1: Write the failing tests**

Add tests that prove:
- `hydrateTask(...)` writes `meta/recovery.json`
- template, passed, and answer materials are written under the existing `_educoder/` tree
- recovery metadata records availability and last sync time

Suggested assertion:

```ts
await expect(readFile(path.join(layout.metaDir, 'recovery.json'), 'utf8')).resolves.toContain('"templateReady": true');
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- tests/unit/recoveryMaterialStore.test.ts tests/unit/taskHydrator.test.ts`
Expected: FAIL because `recovery.json` is not written and no recovery store exists.

**Step 3: Write minimal implementation**

Create `materialStore.ts` with helpers like:
- `writeRecoveryMetadata(taskRoot, metadata)`
- `readRecoveryMetadata(taskRoot)`
- `markTemplateReady(...)`
- `markPassedReady(...)`
- `markAnswerInfoReady(...)`

Extend `taskHydrator.ts` to write `recovery.json` whenever remote materials are hydrated.

**Step 4: Run tests to verify they pass**

Run: `npm test -- tests/unit/recoveryMaterialStore.test.ts tests/unit/taskHydrator.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/unit/recoveryMaterialStore.test.ts tests/unit/taskHydrator.test.ts src/core/sync/taskHydrator.ts src/core/recovery/materialStore.ts src/core/workspace/directoryLayout.ts
git commit -m "feat: persist recovery material metadata"
```

---

### Task 3: Upgrade rollback commands to fetch remote snapshots on demand

**Files:**
- Create: `tests/unit/rollbackTemplate.test.ts`
- Create: `tests/unit/rollbackPassed.test.ts`
- Modify: `tests/unit/snapshotManager.test.ts`
- Modify: `src/commands/rollbackTemplate.ts`
- Modify: `src/commands/rollbackPassed.ts`
- Modify: `src/core/workspace/snapshotManager.ts`
- Create: `src/core/recovery/ensureRecoverySnapshot.ts`

**Step 1: Write the failing tests**

Add tests that prove:
- if `_educoder/template` is missing, `rollbackTemplate(...)` fetches remote template first, then restores `workspace/`
- if `_educoder/passed` is missing, `rollbackPassed(...)` fetches remote passed code first, then restores `workspace/`
- existing local snapshot is still preferred when present

Suggested assertion:

```ts
expect(fetchTemplateFiles).toHaveBeenCalledWith({
  taskId: 'fc7pz3fm6yjh',
  homeworkId: '3727439',
  filePaths: ['test1/tasks.h'],
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- tests/unit/rollbackTemplate.test.ts tests/unit/rollbackPassed.test.ts tests/unit/snapshotManager.test.ts`
Expected: FAIL because rollback commands currently only copy local snapshot folders.

**Step 3: Write minimal implementation**

Create `ensureRecoverySnapshot.ts` to:
- read `task.manifest.json` + sibling manifests
- infer `homeworkId` and target file paths
- fetch remote template/passed files when local snapshot dir is absent or empty
- write snapshot files before calling `restoreTemplateSnapshot()` / `restorePassedSnapshot()`

Upgrade both rollback commands to accept injectable deps for tests.

**Step 4: Run tests to verify they pass**

Run: `npm test -- tests/unit/rollbackTemplate.test.ts tests/unit/rollbackPassed.test.ts tests/unit/snapshotManager.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/unit/rollbackTemplate.test.ts tests/unit/rollbackPassed.test.ts tests/unit/snapshotManager.test.ts src/commands/rollbackTemplate.ts src/commands/rollbackPassed.ts src/core/workspace/snapshotManager.ts src/core/recovery/ensureRecoverySnapshot.ts
git commit -m "feat: add remote fallback for rollback commands"
```

---

### Task 4: Add history/log adapters and commit-snapshot import flow

**Files:**
- Create: `tests/unit/historyFetchClient.test.ts`
- Create: `tests/unit/historyStore.test.ts`
- Create: `tests/unit/restoreHistorySnapshot.test.ts`
- Create: `src/core/api/historyFetchClient.ts`
- Create: `src/core/recovery/historyStore.ts`
- Create: `src/commands/syncTaskHistory.ts`
- Create: `src/commands/restoreHistorySnapshot.ts`
- Modify: `src/extension.ts`
- Modify: `package.json`

**Step 1: Write the failing tests**

Add tests that prove:
- `evaluate_logs.json` and `redo_logs.json` are fetched and written to `_educoder/history/`
- commit metadata is normalized into `index.json`
- `restoreHistorySnapshot(...)` fetches `get_content_for_commit_id.json` and writes files under `_educoder/history/commits/<commitId>/`
- restoring a chosen snapshot can replace `workspace/`

Suggested assertion:

```ts
await expect(readFile(path.join(taskRoot, '_educoder', 'history', 'index.json'), 'utf8')).resolves.toContain('"commitId": "17214d407a4f011497e28052cc332fee280bafeb"');
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- tests/unit/historyFetchClient.test.ts tests/unit/historyStore.test.ts tests/unit/restoreHistorySnapshot.test.ts`
Expected: FAIL because there is no history adapter or command flow.

**Step 3: Write minimal implementation**

Implement:
- `HistoryFetchClient.fetchHistoryIndex(...)`
- `HistoryFetchClient.fetchCommitSnapshot(...)`
- `historyStore.ts` helpers for `evaluate_logs.json`, `redo_logs.json`, `index.json`, and commit folders
- new commands `educoderLocalOj.syncTaskHistory` and `educoderLocalOj.restoreHistorySnapshot`
- command registration in `extension.ts` and `package.json`

**Step 4: Run tests to verify they pass**

Run: `npm test -- tests/unit/historyFetchClient.test.ts tests/unit/historyStore.test.ts tests/unit/restoreHistorySnapshot.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/unit/historyFetchClient.test.ts tests/unit/historyStore.test.ts tests/unit/restoreHistorySnapshot.test.ts src/core/api/historyFetchClient.ts src/core/recovery/historyStore.ts src/commands/syncTaskHistory.ts src/commands/restoreHistorySnapshot.ts src/extension.ts package.json
git commit -m "feat: add task history sync and restore commands"
```

---

### Task 5: Prefetch lightweight recovery materials on task open and expose them in state/UI

**Files:**
- Modify: `tests/unit/taskHydrator.test.ts`
- Modify: `tests/unit/stateModel.test.ts`
- Modify: `tests/smoke/dashboardPanel.smoke.test.ts`
- Modify: `src/commands/openTask.ts`
- Modify: `src/core/sync/taskHydrator.ts`
- Modify: `src/core/ui/stateModel.ts`
- Modify: `src/webview/dashboard/renderTask.ts`
- Modify: `src/webview/dashboard/panel.ts`
- Modify: `src/extension.ts`

**Step 1: Write the failing tests**

Add coverage that proves:
- `openTaskCommand(...)` prefetches template, passed, and answer info when clients are available
- `TaskStateModel` exposes `templateReady`, `passedReady`, `answerEntryCount`, `historyCommitCount`
- dashboard HTML renders pills for template/passed/answer/history state

Suggested assertion:

```ts
expect(panel.webview.html).toContain('template: ready');
expect(panel.webview.html).toContain('history: 1 commits');
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- tests/unit/taskHydrator.test.ts tests/unit/stateModel.test.ts tests/smoke/dashboardPanel.smoke.test.ts`
Expected: FAIL because the recovery state is neither prefetched nor rendered.

**Step 3: Write minimal implementation**

Extend `hydrateTaskFromRemote(...)` and `openTaskCommand(...)` so they can optionally use:
- `templateClient`
- `passedClient`
- `answerClient`

Then update `loadTaskStateModel(...)` and `renderTask(...)` to surface the new recovery readiness state.

**Step 4: Run tests to verify they pass**

Run: `npm test -- tests/unit/taskHydrator.test.ts tests/unit/stateModel.test.ts tests/smoke/dashboardPanel.smoke.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/unit/taskHydrator.test.ts tests/unit/stateModel.test.ts tests/smoke/dashboardPanel.smoke.test.ts src/commands/openTask.ts src/core/sync/taskHydrator.ts src/core/ui/stateModel.ts src/webview/dashboard/renderTask.ts src/webview/dashboard/panel.ts src/extension.ts
git commit -m "feat: surface recovery material state in dashboard"
```

---

### Task 6: Finalize docs, verification, and distributable VSIX

**Files:**
- Modify: `README.md`
- Modify: `package.json`
- Optionally modify: `tests/smoke/realServiceGraph.smoke.test.ts`

**Step 1: Write the failing/expectation test or checklist**

If command coverage is needed, extend smoke coverage so the new commands are registered.

Suggested assertion:

```ts
expect(vscode.commands.getCommands(true)).resolves.toContain('educoderLocalOj.syncTaskHistory');
```

**Step 2: Run verification before docs/package polish**

Run: `npm test`
Expected: identify any broken integrations before updating README/package text.

**Step 3: Write minimal docs/package updates**

Update `README.md` to document:
- rollback with remote fallback
- answer/history capabilities
- new commands

Ensure `package.json` contributes all newly added commands with user-facing titles.

**Step 4: Run full verification**

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

**Step 5: Commit**

```bash
git add README.md package.json tests/smoke/realServiceGraph.smoke.test.ts
git commit -m "docs: finalize recovery materials workflow"
```
