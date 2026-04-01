# Educoder Local OJ Zero-Config Original Experience Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn the current tested skeleton into a genuinely usable VS Code extension that reproduces the Educoder workflow: parse copied `shixun_homework` URLs, recover login automatically or via login-page fallback, sync real chapter/homework/task data, cache hidden tests locally, and let users judge against all datasets without manual data import.

**Architecture:** Replace test-only command overrides with a real service graph rooted in `extension.ts`. Split the product into five concrete layers: URL/session acquisition, Educoder API adapters, sync/hydration pipeline, VS Code presentation, and judge/report orchestration. Keep chapter sync lightweight and move heavyweight per-task assets (source files, hidden tests, answer materials) to lazy hydration so real-world chapters remain stable and debuggable.

**Tech Stack:** TypeScript, VS Code Extension API, Vitest, Node fs/path, existing local judge/remote judge modules, Webview dashboard assets.

---

### Task 1: Lock the contract with failing tests for the real command graph

**Files:**
- Modify: `tests/smoke/commands.smoke.test.ts`
- Create: `tests/smoke/realServiceGraph.smoke.test.ts`
- Modify: `src/extension.ts`

**Step 1: Write the failing test**

Add a smoke test that activates the extension without `configureCommandService()` and asserts:
- `educoderLocalOj.syncCurrentCollection` no longer throws `service is not configured`
- `educoderLocalOj.openTask` delegates to a real task-opening path
- the registered commands exist after activation

Suggested test shape:

```ts
test('activate wires default command services', async () => {
  await activate(ctx);
  await expect(vscode.commands.executeCommand('educoderLocalOj.syncCurrentCollection')).resolves.toBeDefined();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/smoke/realServiceGraph.smoke.test.ts`
Expected: FAIL because `syncCurrentCollection service is not configured.`

**Step 3: Write minimal implementation**

In `src/extension.ts`, replace the test-only default branch with a real dependency container that builds:
- URL resolver access
- session resolver
- Educoder client
- sync orchestrator
- dashboard opener
- local/official judge executors

Keep `configureCommandService()` only for tests.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/smoke/realServiceGraph.smoke.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/smoke/realServiceGraph.smoke.test.ts tests/smoke/commands.smoke.test.ts src/extension.ts
git commit -m "test: lock real command service graph"
```

---

### Task 2: Implement URL acquisition contract with clipboard-first and manual-paste fallback

**Files:**
- Modify: `tests/unit/clipboardUrlResolver.test.ts`
- Create: `tests/unit/urlInputFlow.test.ts`
- Modify: `src/core/url/clipboardUrlResolver.ts`
- Create: `src/core/url/urlInputFlow.ts`
- Modify: `src/core/url/educoderUrl.ts`

**Step 1: Write the failing test**

Add tests for:
- valid copied URL resolves directly
- empty/invalid clipboard input triggers input-box fallback
- manual pasted valid URL resolves successfully
- malformed fallback input shows the same validation error

Suggested core assertion:

```ts
test('falls back to manual URL paste when clipboard does not contain an Educoder URL', async () => {
  const result = await resolveCollectionUrl({ clipboardText: '', prompt: async () => 'https://www.educoder.net/classrooms/x/shixun_homework/y' });
  expect(result).toEqual({ courseId: 'x', categoryId: 'y' });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/urlInputFlow.test.ts`
Expected: FAIL because fallback flow does not exist.

**Step 3: Write minimal implementation**

Create `urlInputFlow.ts` to centralize:
- clipboard attempt
- manual input fallback
- consistent error text

Keep `parseEducoderCollectionUrl()` as the single parser.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/urlInputFlow.test.ts tests/unit/clipboardUrlResolver.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/unit/urlInputFlow.test.ts tests/unit/clipboardUrlResolver.test.ts src/core/url/urlInputFlow.ts src/core/url/clipboardUrlResolver.ts src/core/url/educoderUrl.ts
git commit -m "feat: add clipboard-first url input flow"
```

---

### Task 3: Implement session recovery chain: cache → Edge → login page

**Files:**
- Modify: `tests/unit/sessionManager.test.ts`
- Create: `tests/unit/edgeReuse.test.ts`
- Create: `tests/unit/loginFlow.test.ts`
- Modify: `src/core/auth/sessionManager.ts`
- Modify: `src/core/auth/edgeReuse.ts`
- Create: `src/core/auth/loginFlow.ts`
- Create: `src/core/auth/sessionValidation.ts`

**Step 1: Write the failing test**

Add tests that prove:
- valid cached session short-circuits
- invalid cached session triggers Edge loader
- Edge loader success updates cache
- Edge loader failure triggers login flow
- login flow success persists session
- total failure throws `登录失效，请重新登录`

Suggested test shape:

```ts
test('falls back to login flow when cache and edge reuse are unavailable', async () => {
  const session = await resolveSession({ context, validate, loadFromEdge, login });
  expect(session._educoder_session).toBe('fresh');
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/sessionManager.test.ts tests/unit/edgeReuse.test.ts tests/unit/loginFlow.test.ts`
Expected: FAIL because Edge reuse and login flow are not implemented.

**Step 3: Write minimal implementation**

Implement:
- `sessionValidation.ts` using a lightweight authenticated endpoint
- real `loadSessionFromEdge()` that returns `_educoder_session` and optional `autologin_trustie`
- `loginFlow.ts` that opens a login page/webview/browser flow and extracts session on success
- extend `resolveSession()` to accept a login fallback callback

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/sessionManager.test.ts tests/unit/edgeReuse.test.ts tests/unit/loginFlow.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/unit/sessionManager.test.ts tests/unit/edgeReuse.test.ts tests/unit/loginFlow.test.ts src/core/auth/sessionManager.ts src/core/auth/edgeReuse.ts src/core/auth/loginFlow.ts src/core/auth/sessionValidation.ts
git commit -m "feat: implement session recovery chain"
```

---

### Task 4: Promote collection sync from first-task hydrate to real chapter index sync with readable paths

**Files:**
- Modify: `tests/unit/collectionSync.test.ts`
- Create: `tests/unit/manifestNaming.test.ts`
- Modify: `tests/unit/directoryLayout.test.ts`
- Modify: `src/core/api/educoderClient.ts`
- Modify: `src/core/sync/collectionSync.ts`
- Modify: `src/core/sync/manifestStore.ts`
- Modify: `src/core/workspace/directoryLayout.ts`
- Create: `src/core/workspace/nameSanitizer.ts`
- Modify: `src/commands/syncCurrentCollection.ts`

**Step 1: Write the failing test**

Add tests that prove:
- collection sync writes all returned homeworks, not only the first one
- directory names use real page names plus `[id]`
- illegal characters are sanitized but visible names remain in manifests
- the sync result includes chapter root and all discovered tasks

Suggested assertion:

```ts
expect(collectionRoot).toContain('第二章 线性表及应用 [1316861]');
expect(homeworkDirs).toContain('2-2 基本实训-链表操作 [3727439]');
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/collectionSync.test.ts tests/unit/manifestNaming.test.ts tests/unit/directoryLayout.test.ts`
Expected: FAIL because current layout is ID-only and sync hydrates only the first task.

**Step 3: Write minimal implementation**

Update manifests and path builders so they store and use:
- course name (when available)
- category/chapter name
- homework/task display names
- sanitized readable folder names suffixed by stable IDs

Refactor `syncCurrentCollection()` so it only writes the collection/chapter index and does not auto-hydrate just the first task.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/collectionSync.test.ts tests/unit/manifestNaming.test.ts tests/unit/directoryLayout.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/unit/collectionSync.test.ts tests/unit/manifestNaming.test.ts tests/unit/directoryLayout.test.ts src/core/api/educoderClient.ts src/core/sync/collectionSync.ts src/core/sync/manifestStore.ts src/core/workspace/directoryLayout.ts src/core/workspace/nameSanitizer.ts src/commands/syncCurrentCollection.ts
git commit -m "feat: sync full chapter index with readable paths"
```

---

### Task 5: Add real task hydration for source files, metadata, and lazy hidden-test cache

**Files:**
- Modify: `tests/unit/taskHydrator.test.ts`
- Create: `tests/unit/taskDetailClient.test.ts`
- Create: `tests/unit/sourceFetchClient.test.ts`
- Create: `tests/unit/hiddenTestFetch.test.ts`
- Create: `src/core/api/taskDetailClient.ts`
- Create: `src/core/api/sourceFetchClient.ts`
- Create: `src/core/api/hiddenTestFetchClient.ts`
- Modify: `src/core/sync/taskHydrator.ts`
- Modify: `src/commands/openTask.ts`

**Step 1: Write the failing test**

Add tests that prove opening a task:
- fetches `tasks/{taskId}.json`
- resolves editable paths like `test1/tasks.h`
- writes real source files into `workspace/` and `_educoder/template/`
- writes task metadata into `_educoder/meta/task.json`
- fetches hidden tests and stores them under `_educoder/tests/hidden/`
- marks hidden cache state in returned task summary

Suggested assertion:

```ts
expect(await readFile(path.join(taskRoot, 'workspace', 'test1', 'tasks.h'), 'utf8')).toContain('ListNode');
expect(hiddenCases).toHaveLength(5);
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/taskHydrator.test.ts tests/unit/taskDetailClient.test.ts tests/unit/sourceFetchClient.test.ts tests/unit/hiddenTestFetch.test.ts`
Expected: FAIL because real task/source/hidden fetch clients do not exist.

**Step 3: Write minimal implementation**

Implement three dedicated clients:
- `taskDetailClient.ts` for task json payloads
- `sourceFetchClient.ts` for `rep_content.json`
- `hiddenTestFetchClient.ts` for hidden-test extraction and normalization

Refactor `taskHydrator.ts` to use these clients and cache results idempotently.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/taskHydrator.test.ts tests/unit/taskDetailClient.test.ts tests/unit/sourceFetchClient.test.ts tests/unit/hiddenTestFetch.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/unit/taskHydrator.test.ts tests/unit/taskDetailClient.test.ts tests/unit/sourceFetchClient.test.ts tests/unit/hiddenTestFetch.test.ts src/core/api/taskDetailClient.ts src/core/api/sourceFetchClient.ts src/core/api/hiddenTestFetchClient.ts src/core/sync/taskHydrator.ts src/commands/openTask.ts
git commit -m "feat: hydrate real task assets and hidden tests"
```

---

### Task 6: Make local judging truly run on all cached datasets including hidden tests

**Files:**
- Modify: `tests/unit/localRunner.test.ts`
- Create: `tests/unit/localJudgeHiddenCoverage.test.ts`
- Modify: `src/core/judge/localRunner.ts`
- Modify: `src/core/judge/caseScheduler.ts`
- Modify: `src/core/judge/resultStore.ts`
- Modify: `src/core/ui/stateModel.ts`
- Modify: `src/commands/runLocalJudge.ts`
- Modify: `src/commands/rerunFailedCases.ts`

**Step 1: Write the failing test**

Add tests that prove:
- local judge discovers cached hidden tests automatically
- the report summary counts all hidden cases
- rerun-failed-cases reuses the failing hidden subset
- task state distinguishes “workspace ready but hidden not cached” from “fully local-judge ready”

Suggested assertion:

```ts
expect(report.summary.total).toBe(5);
expect(report.summary.passed + report.summary.failed).toBe(5);
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/localRunner.test.ts tests/unit/localJudgeHiddenCoverage.test.ts tests/unit/stateModel.test.ts`
Expected: FAIL because hidden coverage state is not modeled end-to-end.

**Step 3: Write minimal implementation**

Ensure local judge enumerates cached hidden cases by default and extends state/reporting to expose:
- hidden cache present/absent
- total local cases count
- last judge time and result summary

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/localRunner.test.ts tests/unit/localJudgeHiddenCoverage.test.ts tests/unit/stateModel.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/unit/localRunner.test.ts tests/unit/localJudgeHiddenCoverage.test.ts tests/unit/stateModel.test.ts src/core/judge/localRunner.ts src/core/judge/caseScheduler.ts src/core/judge/resultStore.ts src/core/ui/stateModel.ts src/commands/runLocalJudge.ts src/commands/rerunFailedCases.ts
git commit -m "feat: judge against cached hidden datasets"
```

---

### Task 7: Wire a real VS Code dashboard panel and then polish the UI

**Files:**
- Create: `tests/smoke/dashboardPanel.smoke.test.ts`
- Modify: `src/commands/openTask.ts`
- Create: `src/webview/dashboard/panel.ts`
- Modify: `src/webview/dashboard/index.html`
- Modify: `src/webview/dashboard/styles.css`
- Modify: `src/webview/dashboard/main.ts`
- Modify: `src/webview/dashboard/renderHome.ts`
- Modify: `src/webview/dashboard/renderTask.ts`

**Step 1: Write the failing test**

Add a smoke test that proves `educoderLocalOj.openTask` opens a webview panel and renders task state, including hidden cache readiness.

Suggested assertion:

```ts
expect(panel.title).toContain('Educoder Local OJ');
expect(panel.webview.html).toContain('hidden tests');
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/smoke/dashboardPanel.smoke.test.ts`
Expected: FAIL because `openTaskCommand()` only returns a model.

**Step 3: Write minimal implementation**

Build a panel wrapper in `panel.ts`, make `openTaskCommand()` open or reveal the panel, and only then update the static dashboard assets. After the functional panel works, apply the approved visual direction:
- deep dark tone
- chapter/task tree on the left
- hidden/local/official status pills
- operation toolbar for sync/open/judge actions

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/smoke/dashboardPanel.smoke.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/smoke/dashboardPanel.smoke.test.ts src/commands/openTask.ts src/webview/dashboard/panel.ts src/webview/dashboard/index.html src/webview/dashboard/styles.css src/webview/dashboard/main.ts src/webview/dashboard/renderHome.ts src/webview/dashboard/renderTask.ts
git commit -m "feat: add real dashboard panel and polish ui"
```

---

### Task 8: Connect official judge execution to the same real session/service graph

**Files:**
- Modify: `tests/unit/officialJudge.test.ts`
- Create: `tests/unit/officialJudgeExecutor.test.ts`
- Modify: `src/commands/runOfficialJudge.ts`
- Modify: `src/commands/forceRunOfficialJudge.ts`
- Create: `src/core/remote/officialJudgeExecutor.ts`
- Modify: `src/core/remote/officialJudge.ts`

**Step 1: Write the failing test**

Add tests that prove official judge commands can execute with real default deps instead of throwing `Official judge executor is not configured.`

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/officialJudge.test.ts tests/unit/officialJudgeExecutor.test.ts`
Expected: FAIL because the default executor is still a throw.

**Step 3: Write minimal implementation**

Implement `officialJudgeExecutor.ts` that reuses the same session/client graph, and update commands to inject it by default while preserving explicit test injection hooks.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/officialJudge.test.ts tests/unit/officialJudgeExecutor.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/unit/officialJudge.test.ts tests/unit/officialJudgeExecutor.test.ts src/commands/runOfficialJudge.ts src/commands/forceRunOfficialJudge.ts src/core/remote/officialJudgeExecutor.ts src/core/remote/officialJudge.ts
git commit -m "feat: wire official judge executor"
```

---

### Task 9: Prove the chapter workflow end-to-end with second-chapter evidence and cross-chapter regression

**Files:**
- Modify: `tests/smoke/syncAndJudge.smoke.test.ts`
- Create: `tests/smoke/chapterTwo.e2e.test.ts`
- Create: `tests/smoke/crossChapter.e2e.test.ts`
- Modify: `README.md`

**Step 1: Write the failing test**

Add end-to-end tests that simulate:
- copied second-chapter URL
- session recovery
- collection sync writing readable directories
- lazy task hydration on open
- hidden test cache
- local judge report on cached hidden tests

Add a second test with another chapter URL proving the workflow is not hardcoded to Chapter 2.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/smoke/chapterTwo.e2e.test.ts tests/smoke/crossChapter.e2e.test.ts`
Expected: FAIL until the full chain is implemented.

**Step 3: Write minimal implementation**

Patch any missing seams exposed by the E2E tests, then update `README.md` to describe the final user flow truthfully.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/smoke/chapterTwo.e2e.test.ts tests/smoke/crossChapter.e2e.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/smoke/syncAndJudge.smoke.test.ts tests/smoke/chapterTwo.e2e.test.ts tests/smoke/crossChapter.e2e.test.ts README.md
git commit -m "test: prove end-to-end chapter workflow"
```

---

### Task 10: Verify, package, and perform real VSIX acceptance checks

**Files:**
- Modify: `README.md`
- Modify: `.vscodeignore`
- Optional: `package.json`

**Step 1: Run full verification suite**

Run:

```bash
npm test
npm run typecheck
npm run build
```

Expected:
- all tests pass
- typecheck passes
- build exits 0

**Step 2: Package the extension**

Run:

```bash
npx @vscode/vsce package
```

Expected:
- a fresh `.vsix` artifact is produced

**Step 3: Perform manual acceptance verification**

Install the VSIX in a clean VS Code profile and verify:
- copied URL syncs a real chapter
- invalid clipboard content falls back to manual paste
- Edge reuse or login fallback obtains session
- readable chapter/homework/task directories are created
- opening a task hydrates source + hidden tests
- local judge runs on cached hidden tests
- official judge still works
- reloading VS Code reuses cached session

**Step 4: Record the evidence**

Capture the exact chapter URL used, the resulting directory tree, and the final judge/dashboard screenshots/logs in the repo or task notes.

**Step 5: Commit**

```bash
git add README.md .vscodeignore package.json
git commit -m "chore: verify and package real vscode workflow"
```

---

## Verification Checklist

Before claiming completion, rerun all of these fresh:

```bash
npm test
npm run typecheck
npm run build
npx @vscode/vsce package
```

And manually verify in VS Code:
- URL parse from clipboard works
- manual paste fallback works
- session cache works
- Edge reuse or login fallback works
- second chapter sync works with readable names
- task open hydrates workspace + hidden tests
- local judge uses hidden tests
- dashboard renders correct states
- official judge runs with the same session chain

---

## Notes for the Implementer

- Do **not** silently ship a mode where hidden tests are absent but the UI implies “full local judging.”
- Do **not** keep `service is not configured` or `executor is not configured` as runtime defaults.
- Do **not** regress the existing injection seams used by tests; preserve them while adding real defaults.
- Prefer small commits exactly as listed above.
- Keep the original-experience promise honest: users should not have to think about manual data import.
