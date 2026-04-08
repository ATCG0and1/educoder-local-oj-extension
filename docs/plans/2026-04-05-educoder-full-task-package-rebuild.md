# Educoder Full Task Package Rebuild Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the extension around a “full local task package” product model so each task becomes a readable, runnable, fully visible local package with statement, template, current code, all tests, all answers, clear metadata, and a final one-click flow that runs local judging and then submits to Educoder official judging.

**Architecture:** Keep the existing Educoder auth/runtime/API graph, but move the product center from “lazy hydration + recovery materials” to “task package sync + task workspace + dual-mode submission”. Introduce a new user-first directory layout (`problem/`, `code/`, `tests/`, `answers/`) as the canonical surface, keep `_educoder/` for raw/debug/cache internals, and make local judging plus remote official submission part of one explicit submit flow.

**Tech Stack:** TypeScript, VS Code Extension API, Vitest, Node fs/path, existing Educoder API clients, existing local judge and official judge bridge.

---

## Product constraints to preserve

- Keep current Edge reuse / session resolution strategy.
- Keep existing Educoder API adapters whenever the existing endpoints already work.
- Do not remove `_educoder/`; demote it to internal storage instead.
- Do not regress existing commands until replacement commands exist.
- Treat “all tests visible locally” and “all answers visible locally” as product requirements, but surface `不可获取` explicitly if any material cannot be fetched for a specific task.
- Final submit flow must support:
  1. local full-test run,
  2. optional stop on local failure,
  3. optional force-submit to Educoder,
  4. persisted local + remote reports.
- Missing information policy for execution: when statement fields, test sources, answer fields, submission parameters, or hidden page data are unclear, do not stop for clarification first; proactively recover them from local code, saved HTML snapshots, runtime HTTP trace, API inventory, DevTools/network capture, JS bundle analysis, and direct endpoint probing before asking the user.
- Recon artifacts discovered during implementation must be written back into `_educoder/raw/`, `docs/reference/api-inventory.md`, or adjacent sync metadata so future work does not need to rediscover the same interfaces.

## Target user-facing model

Every task should become this canonical local package:

```text
<taskRoot>/
  README.md
  problem/
    statement.md
    statement.html
    title.txt
    metadata.json
    page.snapshot.html
    samples/
  code/
    current/
    template/
    passed/
  tests/
    all/
    visible/
    hidden/
    index.json
  answers/
    answer_info.json
    index.md
    unlocked/
  _educoder/
    meta/
    repository/
    raw/
    logs/
    sync.json
  reports/
    latest_local.json
    latest_remote.json
    latest_submit.json
```

## Command language freeze

Replace user-facing wording with these labels:

- `Sync Current Collection` → `同步章节目录`
- new `拉全题目资料`
- new `同步并拉全本章资料`
- `Run Local Judge` → `运行本地测试`
- `Run Official Judge` → `提交到头哥评测`
- new primary action `提交评测（本地 + 头哥）`

---

### Task 1: Freeze the new product vocabulary and command surface

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Modify: `src/webview/dashboard/renderTask.ts`
- Modify: `src/webview/dashboard/sidebar.ts`
- Modify: `src/views/taskTreeProvider.ts`
- Test: `tests/unit/renderTask.test.ts`
- Test: `tests/unit/dashboardSidebar.test.ts`
- Test: `tests/smoke/taskTree.smoke.test.ts`

**Step 1: Write the failing tests**

Update assertions so the UI expects user-first language such as `拉全题目资料`, `运行本地测试`, `提交评测（本地 + 头哥）`, and no longer treats `同步完整仓库` as the primary learning action.

**Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/unit/renderTask.test.ts tests/unit/dashboardSidebar.test.ts tests/smoke/taskTree.smoke.test.ts
```

Expected: FAIL because the old labels and layout still render.

**Step 3: Write minimal implementation**

Update `package.json` command titles and the dashboard/task-tree copy so the product surface matches the new model:

```ts
const PRIMARY_ACTIONS = [
  '拉全题目资料',
  '打开题面',
  '打开当前代码',
  '运行本地测试',
  '提交评测（本地 + 头哥）',
];
```

**Step 4: Run test to verify it passes**

Run the same command and expect PASS.

**Step 5: Commit**

```bash
git add package.json README.md src/webview/dashboard/renderTask.ts src/webview/dashboard/sidebar.ts src/views/taskTreeProvider.ts tests/unit/renderTask.test.ts tests/unit/dashboardSidebar.test.ts tests/smoke/taskTree.smoke.test.ts
git commit -m "feat: adopt full task package product language"
```

---

### Task 2: Introduce the canonical full-task-package directory layout with migration fallback

**Files:**
- Modify: `src/core/workspace/directoryLayout.ts`
- Modify: `src/core/workspace/workspaceInit.ts`
- Create: `src/core/workspace/taskPackageMigration.ts`
- Test: `tests/unit/directoryLayout.test.ts`
- Test: `tests/unit/taskHydrator.test.ts`
- Test: `tests/unit/openTaskCommand.test.ts`

**Step 1: Write the failing tests**

Add expectations that `getTaskLayoutPaths()` returns canonical user-first paths and legacy tasks remain readable.

Key expectations:

```ts
expect(layout.problemDir).toContain('problem');
expect(layout.currentCodeDir).toContain('code/current');
expect(layout.allTestsDir).toContain('tests/all');
expect(layout.answersDir).toContain('answers');
expect(layout.legacyWorkspaceDir).toContain('workspace');
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/unit/directoryLayout.test.ts tests/unit/taskHydrator.test.ts tests/unit/openTaskCommand.test.ts
```

Expected: FAIL because the current layout only knows `workspace/` and `_educoder/...`.

**Step 3: Write minimal implementation**

Expand `TaskLayoutPaths` so the new canonical surface exists while legacy fallback remains explicit:

```ts
export interface TaskLayoutPaths {
  taskRoot: string;
  readmePath: string;
  problemDir: string;
  statementMarkdownPath: string;
  statementHtmlPath: string;
  problemMetadataPath: string;
  currentCodeDir: string;
  templateCodeDir: string;
  passedCodeDir: string;
  testsDir: string;
  allTestsDir: string;
  visibleTestsDir: string;
  hiddenTestsDir: string;
  answersDir: string;
  unlockedAnswersDir: string;
  educoderDir: string;
  legacyWorkspaceDir: string;
  reportsDir: string;
}
```

Add `taskPackageMigration.ts` helpers so legacy tasks can be detected and migrated or read in place.

**Step 4: Run test to verify it passes**

Run the same command and expect PASS.

**Step 5: Commit**

```bash
git add src/core/workspace/directoryLayout.ts src/core/workspace/workspaceInit.ts src/core/workspace/taskPackageMigration.ts tests/unit/directoryLayout.test.ts tests/unit/taskHydrator.test.ts tests/unit/openTaskCommand.test.ts
git commit -m "refactor: add canonical task package layout with legacy fallback"
```

---

### Task 3: Add first-class task statement syncing and problem material storage

**Files:**
- Create: `src/core/api/problemFetchClient.ts`
- Modify: `src/core/api/taskDetailClient.ts`
- Create: `src/core/recovery/problemMaterialStore.ts`
- Create: `src/core/sync/problemStatementSync.ts`
- Test: `tests/unit/problemFetchClient.test.ts`
- Test: `tests/unit/taskDetailClient.test.ts`
- Test: `tests/unit/taskHydrator.test.ts`

**Step 1: Write the failing tests**

Add tests for the statement acquisition path:
- if task detail already contains usable statement HTML/markdown/sample data, normalize it;
- otherwise fetch the task page snapshot and extract statement materials;
- write `statement.md`, `statement.html`, `metadata.json`, and sample files.

**Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/unit/problemFetchClient.test.ts tests/unit/taskDetailClient.test.ts tests/unit/taskHydrator.test.ts
```

Expected: FAIL because the project currently has no first-class problem statement sync.

**Step 3: Write minimal implementation**

Create a normalized statement model:

```ts
export interface ProblemMaterial {
  title: string;
  statementMarkdown?: string;
  statementHtml?: string;
  samples: Array<{ name: string; input: string; output: string }>;
  limits?: Record<string, string | number>;
  raw: unknown;
}
```

Write the minimal adapter/store path to persist the problem materials under `problem/`.

**Step 4: Run test to verify it passes**

Run the same command and expect PASS.

**Step 5: Commit**

```bash
git add src/core/api/problemFetchClient.ts src/core/api/taskDetailClient.ts src/core/recovery/problemMaterialStore.ts src/core/sync/problemStatementSync.ts tests/unit/problemFetchClient.test.ts tests/unit/taskDetailClient.test.ts tests/unit/taskHydrator.test.ts
git commit -m "feat: sync task statements as first-class problem materials"
```

---

### Task 4: Replace hydration-centric orchestration with full task package sync

**Files:**
- Create: `src/commands/syncTaskPackage.ts`
- Create: `src/core/sync/taskPackageSync.ts`
- Modify: `src/core/sync/taskHydrator.ts`
- Modify: `src/commands/openTask.ts`
- Modify: `src/extension.ts`
- Test: `tests/unit/openTaskCommand.test.ts`
- Test: `tests/unit/taskHydrator.test.ts`
- Test: `tests/smoke/syncAndJudge.smoke.test.ts`

**Step 1: Write the failing tests**

Write or update tests to enforce the new behavior:
- `openTask` only opens and minimally backfills missing essentials;
- `syncTaskPackage` performs the full single-task material sync;
- the sync result persists problem/code/tests/answers/meta in one pass.

**Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/unit/openTaskCommand.test.ts tests/unit/taskHydrator.test.ts tests/smoke/syncAndJudge.smoke.test.ts
```

Expected: FAIL because full-task-package sync does not exist yet.

**Step 3: Write minimal implementation**

Introduce a single orchestrator entry point:

```ts
export interface SyncTaskPackageResult {
  taskRoot: string;
  materials: {
    statement: 'ready' | 'missing' | 'unavailable' | 'failed';
    currentCode: 'ready' | 'missing' | 'failed';
    templateCode: 'ready' | 'missing' | 'failed';
    tests: 'ready' | 'missing' | 'unavailable' | 'failed';
    answers: 'ready' | 'missing' | 'unavailable' | 'failed';
    metadata: 'ready' | 'missing' | 'failed';
  };
}
```

Make `taskHydrator.ts` a thin compatibility wrapper or rename its internals into the new package sync.

**Step 4: Run test to verify it passes**

Run the same command and expect PASS.

**Step 5: Commit**

```bash
git add src/commands/syncTaskPackage.ts src/core/sync/taskPackageSync.ts src/core/sync/taskHydrator.ts src/commands/openTask.ts src/extension.ts tests/unit/openTaskCommand.test.ts tests/unit/taskHydrator.test.ts tests/smoke/syncAndJudge.smoke.test.ts
git commit -m "refactor: introduce full task package sync"
```

---

### Task 5: Normalize code, tests, answers, and metadata into the user-first package surface

**Files:**
- Modify: `src/core/sync/taskHydrator.ts`
- Modify: `src/commands/syncTaskAnswers.ts`
- Modify: `src/core/recovery/materialStore.ts`
- Modify: `src/core/recovery/repositoryStore.ts`
- Create: `src/core/workspace/taskReadmeWriter.ts`
- Test: `tests/unit/syncTaskAnswers.test.ts`
- Test: `tests/unit/recoveryMaterialStore.test.ts`
- Test: `tests/unit/taskHydrator.test.ts`
- Test: `tests/unit/taskReadmeWriter.test.ts`

**Step 1: Write the failing tests**

Add expectations that after a task package sync:
- current code is under `code/current/`;
- template code is under `code/template/`;
- passed code is under `code/passed/`;
- tests are indexed under `tests/index.json` and copied under `tests/all/`;
- answers are stored under `answers/`;
- the task root contains a generated `README.md` with user guidance.

**Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/unit/syncTaskAnswers.test.ts tests/unit/recoveryMaterialStore.test.ts tests/unit/taskHydrator.test.ts tests/unit/taskReadmeWriter.test.ts
```

Expected: FAIL because artifacts still land in the old cache-centric layout.

**Step 3: Write minimal implementation**

Generate a root README with direct navigation:

```md
# <题目标题>

- 题面：`problem/statement.md`
- 当前代码：`code/current/`
- 模板代码：`code/template/`
- 全部测试：`tests/all/`
- 答案：`answers/unlocked/`
- 元数据：`problem/metadata.json`
```

Keep `_educoder/` for raw snapshots, API traces, and internal sync state.

**Step 4: Run test to verify it passes**

Run the same command and expect PASS.

**Step 5: Commit**

```bash
git add src/core/sync/taskHydrator.ts src/commands/syncTaskAnswers.ts src/core/recovery/materialStore.ts src/core/recovery/repositoryStore.ts src/core/workspace/taskReadmeWriter.ts tests/unit/syncTaskAnswers.test.ts tests/unit/recoveryMaterialStore.test.ts tests/unit/taskHydrator.test.ts tests/unit/taskReadmeWriter.test.ts
git commit -m "feat: materialize user-first code test answer package surface"
```

---

### Task 6: Make local judging read the canonical visible/all-tests layout

**Files:**
- Modify: `src/core/judge/localRunner.ts`
- Modify: `src/core/judge/resultStore.ts`
- Modify: `src/commands/runLocalJudge.ts`
- Test: `tests/unit/localRunner.test.ts`
- Test: `tests/unit/localJudgeHiddenCoverage.test.ts`
- Test: `tests/smoke/syncAndJudge.smoke.test.ts`

**Step 1: Write the failing tests**

Update tests so local judge prefers `tests/all/`, falls back to legacy hidden tests when needed, and persists a report that records which test corpus ran.

**Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/unit/localRunner.test.ts tests/unit/localJudgeHiddenCoverage.test.ts tests/smoke/syncAndJudge.smoke.test.ts
```

Expected: FAIL because the local runner currently centers on `_educoder/tests/hidden/`.

**Step 3: Write minimal implementation**

Extend the report shape:

```ts
export interface LocalJudgeReport {
  generatedAt: string;
  source: 'tests/all' | 'tests/hidden-legacy';
  summary: { total: number; passed: number; failed: number };
  cases: Array<{ id: string; inputPath: string; outputPath: string; verdict: string }>;
}
```

**Step 4: Run test to verify it passes**

Run the same command and expect PASS.

**Step 5: Commit**

```bash
git add src/core/judge/localRunner.ts src/core/judge/resultStore.ts src/commands/runLocalJudge.ts tests/unit/localRunner.test.ts tests/unit/localJudgeHiddenCoverage.test.ts tests/smoke/syncAndJudge.smoke.test.ts
git commit -m "feat: judge against canonical local test package"
```

---

### Task 7: Add chapter-level bulk sync for “同步并拉全本章资料”

**Files:**
- Create: `src/commands/syncCollectionPackages.ts`
- Modify: `src/commands/syncCurrentCollection.ts`
- Modify: `src/core/sync/collectionSync.ts`
- Modify: `src/extension.ts`
- Modify: `package.json`
- Test: `tests/unit/collectionSync.test.ts`
- Test: `tests/smoke/chapterTwo.e2e.test.ts`
- Test: `tests/smoke/crossChapter.e2e.test.ts`

**Step 1: Write the failing tests**

Add coverage that a collection sync can optionally enqueue full per-task package sync across all tasks in the chapter.

**Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/unit/collectionSync.test.ts tests/smoke/chapterTwo.e2e.test.ts tests/smoke/crossChapter.e2e.test.ts
```

Expected: FAIL because collection sync currently only writes the directory/index layer.

**Step 3: Write minimal implementation**

Expose two modes:
- `同步章节目录` = only manifests/index
- `同步并拉全本章资料` = index + full task package sync for all tasks

Use a simple serial executor first; add batching only if needed later.

**Step 4: Run test to verify it passes**

Run the same command and expect PASS.

**Step 5: Commit**

```bash
git add src/commands/syncCollectionPackages.ts src/commands/syncCurrentCollection.ts src/core/sync/collectionSync.ts src/extension.ts package.json tests/unit/collectionSync.test.ts tests/smoke/chapterTwo.e2e.test.ts tests/smoke/crossChapter.e2e.test.ts
git commit -m "feat: support bulk full-package sync for a collection"
```

---

### Task 8: Redesign state modeling around material completeness plus solve status

**Files:**
- Modify: `src/core/ui/stateModel.ts`
- Modify: `src/webview/dashboard/renderTask.ts`
- Modify: `src/webview/dashboard/panel.ts`
- Modify: `src/views/taskTreeProvider.ts`
- Test: `tests/unit/stateModel.test.ts`
- Test: `tests/unit/renderTask.test.ts`
- Test: `tests/unit/dashboardPanel.test.ts`

**Step 1: Write the failing tests**

Add assertions that the model now reports both:
- solve state (`未开始 / 作答中 / 本地测试未过 / 本地测试已过 / 头哥评测已过`)
- material completeness (`题面 / 模板 / 当前代码 / 测试 / 答案 / 元数据`)

**Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/unit/stateModel.test.ts tests/unit/renderTask.test.ts tests/unit/dashboardPanel.test.ts
```

Expected: FAIL because the current model mostly tracks workspace/test/recovery state.

**Step 3: Write minimal implementation**

Add a first-class material state object:

```ts
export interface TaskMaterialsState {
  statement: 'ready' | 'missing' | 'unavailable' | 'failed';
  template: 'ready' | 'missing' | 'failed';
  currentCode: 'ready' | 'missing' | 'failed';
  tests: 'ready' | 'missing' | 'unavailable' | 'failed';
  answers: 'ready' | 'missing' | 'unavailable' | 'failed';
  metadata: 'ready' | 'missing' | 'failed';
}
```

Render the dashboard as a “题目工作台” instead of a recovery-material dashboard.

**Step 4: Run test to verify it passes**

Run the same command and expect PASS.

**Step 5: Commit**

```bash
git add src/core/ui/stateModel.ts src/webview/dashboard/renderTask.ts src/webview/dashboard/panel.ts src/views/taskTreeProvider.ts tests/unit/stateModel.test.ts tests/unit/renderTask.test.ts tests/unit/dashboardPanel.test.ts
git commit -m "feat: model task completeness and solve status explicitly"
```

---

### Task 9: Productize answers and repository as secondary learning surfaces, not primary UX

**Files:**
- Modify: `src/commands/syncTaskAnswers.ts`
- Modify: `src/commands/syncTaskRepository.ts`
- Modify: `src/webview/dashboard/renderTask.ts`
- Test: `tests/unit/syncTaskAnswers.test.ts`
- Test: `tests/unit/syncTaskRepository.test.ts`

**Step 1: Write the failing tests**

Update tests to ensure:
- answers are exposed under `answers/` as a primary readable surface;
- repository remains available but appears as an advanced/secondary tool;
- the dashboard no longer leads with repository sync.

**Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/unit/syncTaskAnswers.test.ts tests/unit/syncTaskRepository.test.ts tests/unit/renderTask.test.ts
```

Expected: FAIL because answers and repository still reflect the old learning-material emphasis.

**Step 3: Write minimal implementation**

Move answer artifacts to the canonical package surface and demote repository actions into the advanced tool area.

**Step 4: Run test to verify it passes**

Run the same command and expect PASS.

**Step 5: Commit**

```bash
git add src/commands/syncTaskAnswers.ts src/commands/syncTaskRepository.ts src/webview/dashboard/renderTask.ts tests/unit/syncTaskAnswers.test.ts tests/unit/syncTaskRepository.test.ts tests/unit/renderTask.test.ts
git commit -m "refactor: position answers as primary and repository as advanced"
```

---

### Task 10: Add unified submit flow for “本地测试 + 头哥评测提交”

**Files:**
- Create: `src/commands/submitTask.ts`
- Create: `src/core/remote/submitTaskFlow.ts`
- Modify: `src/core/remote/officialJudge.ts`
- Modify: `src/core/remote/officialJudgeExecutor.ts`
- Modify: `src/commands/runOfficialJudge.ts`
- Modify: `src/commands/forceRunOfficialJudge.ts`
- Modify: `src/extension.ts`
- Modify: `package.json`
- Test: `tests/unit/officialJudge.test.ts`
- Test: `tests/unit/officialJudgeExecutor.test.ts`
- Test: `tests/unit/submitTaskFlow.test.ts`
- Test: `tests/smoke/syncAndJudge.smoke.test.ts`

**Step 1: Write the failing tests**

Add tests that prove the new submit flow:
1. saves files and runs local judge against `tests/all/`;
2. blocks remote submit by default when local tests fail;
3. supports `force` to continue to Educoder anyway;
4. reuses the existing `update_file.json` + `game_build.json` remote path;
5. persists a combined report.

**Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/unit/officialJudge.test.ts tests/unit/officialJudgeExecutor.test.ts tests/unit/submitTaskFlow.test.ts tests/smoke/syncAndJudge.smoke.test.ts
```

Expected: FAIL because no combined submit orchestrator exists yet.

**Step 3: Write minimal implementation**

Create a combined report shape:

```ts
export interface SubmitTaskReport {
  generatedAt: string;
  local: {
    executed: boolean;
    passed: boolean;
    reportPath?: string;
  };
  remote: {
    executed: boolean;
    verdict?: 'passed' | 'failed';
    reportPath?: string;
  };
  decision: 'stopped_after_local_failure' | 'submitted_after_local_pass' | 'force_submitted';
}
```

Implementation rules:
- primary button = `提交评测（本地 + 头哥）`
- default behavior = stop when local tests fail
- secondary action = `强制提交到头哥`
- `runOfficialJudge` remains as low-level remote-only adapter for debugging/advanced use

**Step 4: Run test to verify it passes**

Run the same command and expect PASS.

**Step 5: Commit**

```bash
git add src/commands/submitTask.ts src/core/remote/submitTaskFlow.ts src/core/remote/officialJudge.ts src/core/remote/officialJudgeExecutor.ts src/commands/runOfficialJudge.ts src/commands/forceRunOfficialJudge.ts src/extension.ts package.json tests/unit/officialJudge.test.ts tests/unit/officialJudgeExecutor.test.ts tests/unit/submitTaskFlow.test.ts tests/smoke/syncAndJudge.smoke.test.ts
git commit -m "feat: add combined local and educoder submission flow"
```

---

### Task 11: Preserve backward compatibility and migrate existing local task roots safely

**Files:**
- Create: `src/core/workspace/legacyTaskCompat.ts`
- Modify: `src/commands/openTask.ts`
- Modify: `src/core/ui/stateModel.ts`
- Test: `tests/unit/openTaskCommand.test.ts`
- Test: `tests/unit/stateModel.test.ts`
- Test: `tests/smoke/commands.smoke.test.ts`

**Step 1: Write the failing tests**

Add coverage that an existing old-layout task root can still:
- open,
- judge locally,
- submit remotely,
- migrate forward without data loss.

**Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/unit/openTaskCommand.test.ts tests/unit/stateModel.test.ts tests/smoke/commands.smoke.test.ts
```

Expected: FAIL because the old layout is not yet bridged into the new package model.

**Step 3: Write minimal implementation**

Add compatibility helpers that detect legacy `workspace/` and `_educoder/tests/hidden/` and either:
- map them into the new state model directly, or
- migrate them once on open/sync.

Do not delete legacy files until the new files are confirmed written.

**Step 4: Run test to verify it passes**

Run the same command and expect PASS.

**Step 5: Commit**

```bash
git add src/core/workspace/legacyTaskCompat.ts src/commands/openTask.ts src/core/ui/stateModel.ts tests/unit/openTaskCommand.test.ts tests/unit/stateModel.test.ts tests/smoke/commands.smoke.test.ts
git commit -m "feat: preserve old task roots while migrating to package layout"
```

---

### Task 12: Update docs, verify end-to-end behavior, and package the extension

**Files:**
- Modify: `README.md`
- Modify: `agent.md`
- Modify: `docs/reference/project-record.md`
- Modify: `docs/reference/api-inventory.md`
- Modify: `dist/**`
- Modify: `educoder-local-oj-extension-0.0.1.vsix`

**Step 1: Write the failing test**

Documentation/build task — no new unit test.

**Step 2: Run verification to expose failures**

Run:

```bash
npm test
npm run typecheck
npm run build
npx @vscode/vsce package
```

Expected before final fixes: at least one failure if docs, types, or packaging are incomplete.

**Step 3: Write minimal implementation**

Refresh docs so they describe:
- the new task-package mental model,
- the full local package layout,
- the dual submit flow,
- any known “不可获取” edge cases.

Regenerate build artifacts and VSIX only after tests and typecheck pass.

**Step 4: Run verification to confirm success**

Run the same four commands and expect all PASS plus a newly generated VSIX.

**Step 5: Commit**

```bash
git add README.md agent.md docs/reference/project-record.md docs/reference/api-inventory.md dist educoder-local-oj-extension-0.0.1.vsix
git commit -m "docs: finalize full task package rebuild and release artifacts"
```

---

## Acceptance criteria

The rebuild is complete only when all of the following are true:

1. A synced task root can be opened without guessing where things live.
2. `problem/statement.md` or `problem/statement.html` exists for every successfully synced task.
3. `code/current/` is the canonical place to edit code.
4. `code/template/` contains the official template when available.
5. `tests/all/` exists and local judge runs it by default.
6. `answers/unlocked/` contains all answer bodies that the extension can fetch.
7. `README.md` at the task root tells the user where to read, code, test, and review answers.
8. The dashboard shows material completeness and solve status separately.
9. The primary submit action runs local tests first and then submits to Educoder official judge.
10. If local tests fail, the default submit flow stops before remote submission.
11. A force-submit path still exists for remote-only submission.
12. Existing old-layout task roots remain usable or auto-migrate safely.
13. `npm test`, `npm run typecheck`, `npm run build`, and packaging all pass.

## Notes on the remote submission requirement

This requirement is feasible and low-risk because the current codebase already has the critical remote path in place:
- `src/core/remote/officialJudgeExecutor.ts` already uploads source via `update_file.json`
- it then triggers official judging via `game_build.json`

The rebuild should therefore **productize** this into a clearer combined submit flow rather than invent a new remote protocol.

## Out of scope for this rebuild

- ranklists, progress analytics, favorites, wrong-question notebooks
- parallel bulk sync optimization beyond simple serial execution
- deleting `_educoder/` internal artifacts
- changing the Educoder auth mechanism beyond stability fixes
