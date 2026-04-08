# Educoder 做题工作台（极简做题流）Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Shrink the extension from a sync/material tool into a minimal problem-solving workbench where users only see problem/code/tests/answers/result summary, while internal JSON/README/report artifacts are removed from the main user path.

**Architecture:** Keep one-click chapter sync, Task Tree, workspace binding, and real task-package hydration, but split the package into two layers: a user-facing solving surface (`problem`, `code`, `tests`, `answers`) and an internal `_educoder` implementation surface for metadata, cached answers, judge results, template/passed code, and recovery state. Rebuild the Current Task UI around a compact single-screen card with four primary actions, two-line result summaries, and secondary text links instead of document indexes and report JSON.

**Tech Stack:** TypeScript, VS Code Extension API, Vitest, Node `fs/promises`, existing sync adapters, local judge runner, submit flow, task tree/dashboard webviews.

---

## 2026-04-06 final confirmed decisions (authoritative)

> If any earlier task wording, example path, or product phrasing conflicts with this section, this section wins.

- User-facing solving surface is `problem/`, `code/`, `tests/`, `answers/`.
- Terms like `code/current`, `tests/all`, and `answers/unlocked` are implementation details only, not user-facing product language.
- Default workspace binding should prefer the **current chapter root**, not the whole product root.
- After sync, default-open order is: incomplete/abnormal task → last-opened task → first task.
- If a task has multiple answers, open the first answer directly by default.
- Advanced commands are removed from the normal sidebar UI but retained in the command palette.
- Whole-chapter sync must continue past single-task failures and mark those tasks incomplete.
- Normal feedback is summary-first with sparse toasts only.
- Task Tree hides IDs in UI, while disk paths continue to keep IDs for stability.
- Do not generate extra human-readable report files.
- Explorer should hide internal folders/files by default.
- Current-task title area should use concise breadcrumb-style naming.


## Scope lock for this version of the plan

This plan only locks the **structure slimming / product path simplification** work that has already been agreed.

A later batch will be appended after discussion for:
- visual polish
- interaction feel
- richer result presentation
- tighter VS Code-native micro-interactions

---

### Task 1: Remove README and raw report JSON from the public product surface

**Files:**
- Modify: `package.json`
- Modify: `src/extension.ts`
- Modify: `src/webview/dashboard/renderTask.ts`
- Modify: `src/commands/openTaskPackageFiles.ts`
- Test: `tests/unit/renderTask.test.ts`
- Test: `tests/unit/openTaskMaterials.test.ts`
- Test: `tests/smoke/commands.smoke.test.ts`

**Step 1: Write the failing tests**

Update expectations so the current-task surface:
- no longer shows `打开 README`
- no longer shows `打开报告`
- no longer requires public commands for README/report JSON opening

Key expectations:

```ts
expect(html).not.toContain('打开 README');
expect(html).not.toContain('打开报告');
expect(commands).not.toContain('educoderLocalOj.openTaskReadme');
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/unit/renderTask.test.ts tests/unit/openTaskMaterials.test.ts tests/smoke/commands.smoke.test.ts
```

Expected: FAIL because README/report entry points are still publicly exposed.

**Step 3: Write minimal implementation**

- Remove README/report buttons from the current-task card
- Remove public command registration for README opening
- Remove public command registration for raw report opening if it only exposes JSON artifacts
- Keep any needed internal helpers private, not user-facing

**Step 4: Run test to verify it passes**

Run the same command and expect PASS.

**Step 5: Commit**

```bash
git add package.json src/extension.ts src/webview/dashboard/renderTask.ts src/commands/openTaskPackageFiles.ts tests/unit/renderTask.test.ts tests/unit/openTaskMaterials.test.ts tests/smoke/commands.smoke.test.ts
git commit -m "refactor: remove readme and raw report from user surface"
```

---

### Task 2: Make “打开测试集 / 打开答案” open real solving materials instead of index docs

**Files:**
- Modify: `src/commands/openTaskPackageFiles.ts`
- Modify: `src/webview/dashboard/renderTask.ts`
- Test: `tests/unit/openTaskMaterials.test.ts`
- Test: `tests/unit/renderTask.test.ts`
- Test: `tests/smoke/commands.smoke.test.ts`

**Step 1: Write the failing tests**

Add tests that prove:
- `打开测试集` reveals `tests/all/` directly
- `打开答案` opens the first unlocked answer body directly
- when no unlocked answer body exists, the command reveals `answers/unlocked/` or gives a clear message instead of opening metadata JSON

Key expectations:

```ts
expect(testsResult).toMatchObject({ openedPath: testsAllDir, openedKind: 'directory' });
expect(answersResult).toMatchObject({ openedPath: firstUnlockedAnswer, openedKind: 'file' });
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/unit/openTaskMaterials.test.ts tests/unit/renderTask.test.ts tests/smoke/commands.smoke.test.ts
```

Expected: FAIL because tests/answers still prefer index documents.

**Step 3: Write minimal implementation**

- Change `openTaskTestsCommand(...)` to prefer `tests/all/`
- Change `openTaskAnswersCommand(...)` to prefer the first unlocked answer markdown file
- Remove the product assumption that `tests/index.json` / `answers/index.md` are user entry points

**Step 4: Run test to verify it passes**

Run the same command and expect PASS.

**Step 5: Commit**

```bash
git add src/commands/openTaskPackageFiles.ts src/webview/dashboard/renderTask.ts tests/unit/openTaskMaterials.test.ts tests/unit/renderTask.test.ts tests/smoke/commands.smoke.test.ts
git commit -m "feat: open real tests and answers materials directly"
```

---

### Task 3: Stop generating user-useless README/index artifacts

**Files:**
- Modify: `src/core/sync/taskHydrator.ts`
- Modify: `src/commands/syncTaskAnswers.ts`
- Delete or stop using: `src/core/workspace/taskReadmeWriter.ts`
- Modify: `src/core/workspace/directoryLayout.ts`
- Test: `tests/unit/taskHydrator.test.ts`
- Test: `tests/unit/syncTaskAnswers.test.ts`
- Test: `tests/unit/taskReadmeWriter.test.ts`
- Test: `tests/unit/directoryLayout.test.ts`

**Step 1: Write the failing tests**

Update expectations so hydration / answer sync:
- no longer writes `README.md`
- no longer writes `tests/index.json`
- no longer writes `answers/index.md`

Key expectations:

```ts
await expect(access(path.join(taskRoot, 'README.md'))).rejects.toBeDefined();
await expect(access(path.join(taskRoot, 'tests', 'index.json'))).rejects.toBeDefined();
await expect(access(path.join(taskRoot, 'answers', 'index.md'))).rejects.toBeDefined();
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/unit/taskHydrator.test.ts tests/unit/syncTaskAnswers.test.ts tests/unit/taskReadmeWriter.test.ts tests/unit/directoryLayout.test.ts
```

Expected: FAIL because those artifacts are still being generated and tested as part of the package surface.

**Step 3: Write minimal implementation**

- Remove README writing from hydration and answer sync flows
- Stop writing `tests/index.json`
- Stop writing `answers/index.md`
- Remove `readmePath` from layout if it becomes dead
- Delete obsolete README-writer tests or replace them with tests for the slimmer package surface

**Step 4: Run test to verify it passes**

Run the same command and expect PASS.

**Step 5: Commit**

```bash
git add src/core/sync/taskHydrator.ts src/commands/syncTaskAnswers.ts src/core/workspace/directoryLayout.ts tests/unit/taskHydrator.test.ts tests/unit/syncTaskAnswers.test.ts tests/unit/taskReadmeWriter.test.ts tests/unit/directoryLayout.test.ts
git commit -m "refactor: remove readme and index artifacts from task packages"
```

---

### Task 4: Move machine-only files under `_educoder` and slim the Explorer-visible task surface

**Files:**
- Modify: `src/core/workspace/directoryLayout.ts`
- Modify: `src/core/judge/resultStore.ts`
- Modify: `src/core/remote/submitTaskFlow.ts`
- Modify: `src/core/ui/stateModel.ts`
- Modify: `src/commands/compareWithTemplate.ts`
- Modify: `src/commands/compareWithAnswer.ts`
- Modify: `src/commands/rollbackTemplate.ts`
- Modify: `src/commands/rollbackPassed.ts`
- Test: `tests/unit/stateModel.test.ts`
- Test: `tests/unit/localRunner.test.ts`
- Test: `tests/unit/compareWithTemplate.test.ts`
- Test: `tests/unit/compareWithAnswer.test.ts`
- Test: `tests/unit/rollbackTemplate.test.ts`
- Test: `tests/unit/rollbackPassed.test.ts`

**Step 1: Write the failing tests**

Add tests that prove machine-only artifacts now live under `_educoder` instead of polluting the visible task root, while compare/rollback/judge flows still work.

Key expectations:

```ts
expect(layout.educoderDir).toContain('_educoder');
expect(reportPath).toContain(path.join('_educoder', 'judge'));
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/unit/stateModel.test.ts tests/unit/localRunner.test.ts tests/unit/compareWithTemplate.test.ts tests/unit/compareWithAnswer.test.ts tests/unit/rollbackTemplate.test.ts tests/unit/rollbackPassed.test.ts
```

Expected: FAIL because metadata/report/template/passed paths are still mixed into the user-visible surface.

**Step 3: Write minimal implementation**

- Move raw judge outputs under `_educoder/judge/`
- Move answer metadata under `_educoder/answers/` if needed
- Move template/passed material under `_educoder/` if those files are only used for rollback/diff/internal tooling
- Keep only `problem/statement.md`, `code/current/`, `tests/all/`, `answers/unlocked/` as the primary user-visible solving surface
- Update state-model loading logic accordingly

**Step 4: Run test to verify it passes**

Run the same command and expect PASS.

**Step 5: Commit**

```bash
git add src/core/workspace/directoryLayout.ts src/core/judge/resultStore.ts src/core/remote/submitTaskFlow.ts src/core/ui/stateModel.ts src/commands/compareWithTemplate.ts src/commands/compareWithAnswer.ts src/commands/rollbackTemplate.ts src/commands/rollbackPassed.ts tests/unit/stateModel.test.ts tests/unit/localRunner.test.ts tests/unit/compareWithTemplate.test.ts tests/unit/compareWithAnswer.test.ts tests/unit/rollbackTemplate.test.ts tests/unit/rollbackPassed.test.ts
git commit -m "refactor: separate user-facing solving surface from internal educoder data"
```

---

### Task 5: Rebuild the Current Task UI around a few primary actions and inline result summary

**Files:**
- Modify: `src/webview/dashboard/renderTask.ts`
- Modify: `src/core/ui/stateModel.ts`
- Modify: `src/webview/dashboard/panel.ts`
- Test: `tests/unit/renderTask.test.ts`
- Test: `tests/unit/stateModel.test.ts`
- Test: `tests/smoke/dashboardPanel.smoke.test.ts`

**Step 1: Write the failing tests**

Update expectations so the task UI:
- shows only a compact solving-oriented card
- keeps primary actions: `打开题面 / 打开代码 / 运行本地测试 / 提交评测`
- keeps tests/answers as secondary entries
- hides bulky sections such as `资料完整度`, `答案与解析`, `进阶工具`
- shows recent result summary inline

Key expectations:

```ts
expect(html).toContain('运行本地测试');
expect(html).toContain('提交评测');
expect(html).not.toContain('资料完整度');
expect(html).not.toContain('进阶工具');
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/unit/renderTask.test.ts tests/unit/stateModel.test.ts tests/smoke/dashboardPanel.smoke.test.ts
```

Expected: FAIL because the current card still exposes too many sections and buttons.

**Step 3: Write minimal implementation**

- Replace the current multi-section button wall with a compact task card
- Inline the latest local/submit result summary into the card itself
- Keep advanced actions hidden behind a collapsed entry or lightweight overflow affordance
- Remove engineer-facing terms such as metadata completeness from the main display

**Step 4: Run test to verify it passes**

Run the same command and expect PASS.

**Step 5: Commit**

```bash
git add src/webview/dashboard/renderTask.ts src/core/ui/stateModel.ts src/webview/dashboard/panel.ts tests/unit/renderTask.test.ts tests/unit/stateModel.test.ts tests/smoke/dashboardPanel.smoke.test.ts
git commit -m "feat: simplify current task ui into compact solving card"
```

---

### Task 6: Keep local judging real, but surface results as readable task insights instead of report browsing

**Files:**
- Modify: `src/commands/runLocalJudge.ts`
- Modify: `src/core/judge/localRunner.ts`
- Modify: `src/core/judge/resultStore.ts`
- Modify: `src/core/ui/stateModel.ts`
- Modify: `src/webview/dashboard/renderTask.ts`
- Test: `tests/unit/runLocalJudgeCommand.test.ts`
- Test: `tests/unit/localRunner.test.ts`
- Test: `tests/unit/stateModel.test.ts`
- Test: `tests/smoke/syncAndJudge.smoke.test.ts`

**Step 1: Write the failing tests**

Add tests that prove:
- local judging still defaults to `tests/all`
- results are still truly persisted (internally)
- the user-facing surface can show first-failure / pass-count summary without opening any report document

Key expectations:

```ts
expect(report.source).toBe('tests/all');
expect(model.localJudge?.headline).toBeTruthy();
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/unit/runLocalJudgeCommand.test.ts tests/unit/localRunner.test.ts tests/unit/stateModel.test.ts tests/smoke/syncAndJudge.smoke.test.ts
```

Expected: FAIL if user feedback still depends on raw report browsing or report paths tied to the visible task root.

**Step 3: Write minimal implementation**

- Keep real local judge execution and real result persistence
- Move raw persistence to internal paths when needed
- Make the current-task UI read and render a concise summary directly
- Preserve future room for failed-case quick-open actions

**Step 4: Run test to verify it passes**

Run the same command and expect PASS.

**Step 5: Commit**

```bash
git add src/commands/runLocalJudge.ts src/core/judge/localRunner.ts src/core/judge/resultStore.ts src/core/ui/stateModel.ts src/webview/dashboard/renderTask.ts tests/unit/runLocalJudgeCommand.test.ts tests/unit/localRunner.test.ts tests/unit/stateModel.test.ts tests/smoke/syncAndJudge.smoke.test.ts
git commit -m "feat: surface local judge results inline without raw report browsing"
```

---

### Task 7: Re-run end-to-end verification on the slimmed product surface

**Files:**
- Modify: `README.md`
- Modify: `docs/reference/api-inventory.md` (only if path/storage/runtime inventory changes need documenting)

**Step 1: Update docs**

Document the new real user flow:
- one-click chapter sync
- open first task automatically
- solve through `problem/statement.md` + `code/current/`
- use `tests/all/` and `answers/unlocked/`
- read results directly in the current-task panel

**Step 2: Run integrated verification**

Run:

```bash
npm test
npm run typecheck
npm run build
npx @vscode/vsce package
```

Expected:
- all tests PASS
- typecheck PASS
- build PASS
- VSIX generated successfully

**Step 3: Commit**

```bash
git add README.md docs/reference/api-inventory.md
git commit -m "docs: document slim problem-solving workbench flow"
```

---

### Task 8: Rebuild the Current Task card into the approved A+B mixed interaction layout

**Files:**
- Modify: `src/webview/dashboard/renderTask.ts`
- Modify: `src/webview/dashboard/panel.ts`
- Modify: `src/core/ui/stateModel.ts`
- Test: `tests/unit/renderTask.test.ts`
- Test: `tests/unit/stateModel.test.ts`
- Test: `tests/smoke/dashboardPanel.smoke.test.ts`

**Step 1: Write the failing tests**

Add tests that prove the current-task panel now renders the approved compact card:
- title
- one-line recent result summary
- exactly four primary actions
- secondary entries for tests/answers
- advanced actions behind a collapsed section or equivalent overflow area

Key expectations:

```ts
expect(html).toContain('打开题面');
expect(html).toContain('打开代码');
expect(html).toContain('运行本地测试');
expect(html).toContain('提交评测');
expect(html).toContain('测试');
expect(html).toContain('答案');
expect(html).not.toContain('资料完整度');
expect(html).not.toContain('进阶工具');
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/unit/renderTask.test.ts tests/unit/stateModel.test.ts tests/smoke/dashboardPanel.smoke.test.ts
```

Expected: FAIL because the current layout is still the old multi-section button wall.

**Step 3: Write minimal implementation**

- Render a single compact task card
- Put the latest result summary near the top of the card
- Keep only four primary buttons visually prominent
- Demote tests/answers into secondary entries
- Hide advanced actions behind a collapsed affordance

**Step 4: Run test to verify it passes**

Run the same command and expect PASS.

**Step 5: Commit**

```bash
git add src/webview/dashboard/renderTask.ts src/webview/dashboard/panel.ts src/core/ui/stateModel.ts tests/unit/renderTask.test.ts tests/unit/stateModel.test.ts tests/smoke/dashboardPanel.smoke.test.ts
git commit -m "feat: adopt compact current-task card interaction"
```

### Task 9: Make task switching feel editor-first and non-disruptive

**Files:**
- Modify: `src/commands/openTask.ts`
- Modify: `src/commands/openTaskMaterials.ts`
- Modify: `src/views/taskTreeProvider.ts`
- Test: `tests/unit/openTaskMaterials.test.ts`
- Test: `tests/unit/openTaskCommand.test.ts`
- Test: `tests/unit/taskTreeProvider.test.ts`

**Step 1: Write the failing tests**

Add tests that prove task switching now:
- opens statement with preview behavior
- opens code as the focused editor
- reveals the current task/current code in Explorer
- does not leave focus stranded on the statement tab

Key expectations:

```ts
expect(statementOpenOptions.preview).toBe(true);
expect(currentCodeOpenOptions.preview).toBe(false);
expect(revealInExplorer).toHaveBeenCalled();
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/unit/openTaskMaterials.test.ts tests/unit/openTaskCommand.test.ts tests/unit/taskTreeProvider.test.ts
```

Expected: FAIL because the old open-task flow does not explicitly enforce the new preview/focus interaction policy.

**Step 3: Write minimal implementation**

- Open the statement as preview
- Open current code as the focused working editor
- Reveal current task/current code in Explorer
- Keep the open-task flow fast and non-disruptive

**Step 4: Run test to verify it passes**

Run the same command and expect PASS.

**Step 5: Commit**

```bash
git add src/commands/openTask.ts src/commands/openTaskMaterials.ts src/views/taskTreeProvider.ts tests/unit/openTaskMaterials.test.ts tests/unit/openTaskCommand.test.ts tests/unit/taskTreeProvider.test.ts
git commit -m "feat: make task switching editor-first and non-disruptive"
```

---

### Task 10: Replace the current-task button wall with the approved single-screen compact card

**Files:**
- Modify: `src/webview/dashboard/renderTask.ts`
- Modify: `src/webview/dashboard/panel.ts`
- Modify: `src/core/ui/stateModel.ts`
- Test: `tests/unit/renderTask.test.ts`
- Test: `tests/unit/stateModel.test.ts`
- Test: `tests/smoke/dashboardPanel.smoke.test.ts`

**Step 1: Write the failing tests**

Add tests that prove the card now:
- fits the approved compact information structure
- keeps only four primary buttons
- renders tests/answers/failure links as secondary text actions
- removes old section headings and the old button wall
- renders two-line remote/local summaries

Key expectations:

```ts
expect(html).toContain('打开题面');
expect(html).toContain('打开代码');
expect(html).toContain('运行测试');
expect(html).toContain('提交评测');
expect(html).toContain('测试集');
expect(html).toContain('答案');
expect(html).not.toContain('资料完整度');
expect(html).not.toContain('材料导航');
expect(html).not.toContain('进阶工具');
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/unit/renderTask.test.ts tests/unit/stateModel.test.ts tests/smoke/dashboardPanel.smoke.test.ts
```

Expected: FAIL because the current UI still uses the old multi-section layout.

**Step 3: Write minimal implementation**

- Render a single compact task card
- Show a two-line summary for remote/local status near the top
- Keep only four prominent primary buttons
- Render tests/answers/failure-entry actions as secondary text links
- Remove `更多操作` from the normal user surface

**Step 4: Run test to verify it passes**

Run the same command and expect PASS.

**Step 5: Commit**

```bash
git add src/webview/dashboard/renderTask.ts src/webview/dashboard/panel.ts src/core/ui/stateModel.ts tests/unit/renderTask.test.ts tests/unit/stateModel.test.ts tests/smoke/dashboardPanel.smoke.test.ts
git commit -m "feat: adopt compact single-screen solving card"
```

---

### Task 11: Replace answer unlocking language with mandatory answer syncing and user-facing `answers/`

**Files:**
- Modify: `src/core/sync/taskHydrator.ts`
- Modify: `src/commands/syncTaskAnswers.ts`
- Modify: `src/commands/openTaskPackageFiles.ts`
- Modify: `src/core/workspace/directoryLayout.ts`
- Modify: `src/core/ui/stateModel.ts`
- Test: `tests/unit/taskHydrator.test.ts`
- Test: `tests/unit/syncTaskAnswers.test.ts`
- Test: `tests/unit/openTaskMaterials.test.ts`
- Test: `tests/unit/stateModel.test.ts`

**Step 1: Write the failing tests**

Add tests that prove:
- answer sync is treated as required package material
- user-visible answer paths no longer use `unlocked` naming
- missing answers are treated as sync failure/incomplete materials, not a normal optional state

Key expectations:

```ts
expect(model.materials?.answers).toBe('ready');
expect(userVisibleAnswerPath).toContain(path.join('answers'));
expect(userVisibleAnswerPath).not.toContain('unlocked');
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/unit/taskHydrator.test.ts tests/unit/syncTaskAnswers.test.ts tests/unit/openTaskMaterials.test.ts tests/unit/stateModel.test.ts
```

Expected: FAIL because the current package model still exposes unlock-oriented naming and semantics.

**Step 3: Write minimal implementation**

- Treat answers as required synced material for one-click chapter sync
- Rename user-facing answer storage to `answers/`
- Push machine answer metadata into `_educoder/answers/`
- Remove unlock-oriented user-facing wording from UI/state summaries

**Step 4: Run test to verify it passes**

Run the same command and expect PASS.

**Step 5: Commit**

```bash
git add src/core/sync/taskHydrator.ts src/commands/syncTaskAnswers.ts src/commands/openTaskPackageFiles.ts src/core/workspace/directoryLayout.ts src/core/ui/stateModel.ts tests/unit/taskHydrator.test.ts tests/unit/syncTaskAnswers.test.ts tests/unit/openTaskMaterials.test.ts tests/unit/stateModel.test.ts
git commit -m "refactor: make answers mandatory and user-facing answer paths simple"
```

---

### Task 12: Make run/submit feedback summary-first, low-interruption, and case-oriented

**Files:**
- Modify: `src/commands/runLocalJudge.ts`
- Modify: `src/commands/submitTask.ts`
- Modify: `src/core/ui/stateModel.ts`
- Modify: `src/webview/dashboard/renderTask.ts`
- Test: `tests/unit/runLocalJudgeCommand.test.ts`
- Test: `tests/unit/submitTaskCommand.test.ts`
- Test: `tests/unit/stateModel.test.ts`

**Step 1: Write the failing tests**

Add tests that prove:
- run-test feedback primarily updates task summaries instead of relying on intrusive behavior
- submit feedback reflects Educoder's pass-count model instead of score language
- failed input/output links only appear when local run failure data exists

Key expectations:

```ts
expect(model.remoteJudge?.headline).toContain('通过');
expect(model.remoteJudge?.headline).not.toContain('分');
expect(html).not.toContain('100 分');
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/unit/runLocalJudgeCommand.test.ts tests/unit/submitTaskCommand.test.ts tests/unit/stateModel.test.ts
```

Expected: FAIL because current feedback copy and summaries are still tied to older product wording and message behavior.

**Step 3: Write minimal implementation**

- Use two-line remote/local summary presentation in the task state model
- Use pass-count wording for Educoder results
- Keep local-run failure details concise and case-oriented
- Avoid heavy modal/message-box dependence in the normal interaction flow

**Step 4: Run test to verify it passes**

Run the same command and expect PASS.

**Step 5: Commit**

```bash
git add src/commands/runLocalJudge.ts src/commands/submitTask.ts src/core/ui/stateModel.ts src/webview/dashboard/renderTask.ts tests/unit/runLocalJudgeCommand.test.ts tests/unit/submitTaskCommand.test.ts tests/unit/stateModel.test.ts
git commit -m "feat: make run and submit feedback summary-first and low-interruption"
```

### Task 13: Bind the workspace to the chapter root and choose the right default task after sync

**Files:**
- Modify: `src/commands/syncCollectionPackages.ts`
- Modify: `src/core/workspace/workspaceBinding.ts`
- Modify: `src/extension.ts`
- Modify: `src/views/taskTreeProvider.ts`
- Test: `tests/unit/collectionSync.test.ts`
- Test: `tests/unit/openTaskCommand.test.ts`
- Test: `tests/smoke/commands.smoke.test.ts`

**Step 1: Write the failing tests**

Add tests that prove:
- workspace binding prefers the current chapter root
- sync completion chooses task order as: incomplete/abnormal → last-opened → first
- sync does not always blindly open the first task anymore

Key expectations:

```ts
expect(boundWorkspacePath).toContain(categoryName);
expect(defaultOpenedTask.taskId).toBe(expectedTaskId);
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/unit/collectionSync.test.ts tests/unit/openTaskCommand.test.ts tests/smoke/commands.smoke.test.ts
```

Expected: FAIL because current behavior still assumes simpler binding/open rules.

**Step 3: Write minimal implementation**

- Bind the current chapter root into the workspace by default
- Persist/read last-opened task state
- Pick the default task using the confirmed priority order

**Step 4: Run test to verify it passes**

Run the same command and expect PASS.

**Step 5: Commit**

```bash
git add src/commands/syncCollectionPackages.ts src/core/workspace/workspaceBinding.ts src/extension.ts src/views/taskTreeProvider.ts tests/unit/collectionSync.test.ts tests/unit/openTaskCommand.test.ts tests/smoke/commands.smoke.test.ts
git commit -m "feat: bind chapter workspace and choose better default task after sync"
```

---

### Task 14: Hide internal Explorer content and present the simplified user-facing directory surface

**Files:**
- Modify: `src/core/workspace/vscodeConfigWriter.ts`
- Modify: `src/core/workspace/directoryLayout.ts`
- Modify: `src/core/sync/taskHydrator.ts`
- Test: `tests/unit/directoryLayout.test.ts`
- Test: `tests/unit/taskHydrator.test.ts`
- Test: `tests/unit/openTaskMaterials.test.ts`

**Step 1: Write the failing tests**

Add tests that prove:
- Explorer hides `_educoder`, `.vscode`, template/passed code, manifest files, and machine JSON files by default
- the user-facing package surface is documented/treated as `problem`, `code`, `tests`, `answers`
- old internal names do not leak into user-facing labels/config

Key expectations:

```ts
expect(filesExclude['_educoder']).toBe(true);
expect(filesExclude['**/*.manifest.json']).toBe(true);
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/unit/directoryLayout.test.ts tests/unit/taskHydrator.test.ts tests/unit/openTaskMaterials.test.ts
```

Expected: FAIL because current config/layout still exposes more internal structure than the final design allows.

**Step 3: Write minimal implementation**

- Apply default Explorer hiding rules for internal content
- Keep the real files available for the extension/runtime
- Ensure user-facing copy and navigation use only `problem / code / tests / answers`

**Step 4: Run test to verify it passes**

Run the same command and expect PASS.

**Step 5: Commit**

```bash
git add src/core/workspace/vscodeConfigWriter.ts src/core/workspace/directoryLayout.ts src/core/sync/taskHydrator.ts tests/unit/directoryLayout.test.ts tests/unit/taskHydrator.test.ts tests/unit/openTaskMaterials.test.ts
git commit -m "feat: hide internal explorer content by default"
```

---

### Task 15: Clean up Task Tree naming and keep IDs off the normal user path

**Files:**
- Modify: `src/views/taskTreeProvider.ts`
- Modify: `src/core/catalog/localTaskCatalog.ts`
- Modify: `src/core/sync/manifestStore.ts`
- Test: `tests/unit/taskTreeProvider.test.ts`
- Test: `tests/unit/localTaskCatalog.test.ts`
- Test: `tests/smoke/taskTree.smoke.test.ts`

**Step 1: Write the failing tests**

Add tests that prove:
- Task Tree labels hide `[id]`
- disk/manifests still keep stable IDs internally
- task states are expressed with clean status affordances instead of raw IDs in labels

Key expectations:

```ts
expect(treeLabel).not.toContain('[');
expect(manifest.folderName).toContain('[');
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/unit/taskTreeProvider.test.ts tests/unit/localTaskCatalog.test.ts tests/smoke/taskTree.smoke.test.ts
```

Expected: FAIL because current naming still leaks too much storage-oriented detail into the UI.

**Step 3: Write minimal implementation**

- Strip IDs from Task Tree user-facing labels
- Preserve IDs in stored paths/manifests
- Keep status visible through icons/badges or other lightweight affordances

**Step 4: Run test to verify it passes**

Run the same command and expect PASS.

**Step 5: Commit**

```bash
git add src/views/taskTreeProvider.ts src/core/catalog/localTaskCatalog.ts src/core/sync/manifestStore.ts tests/unit/taskTreeProvider.test.ts tests/unit/localTaskCatalog.test.ts tests/smoke/taskTree.smoke.test.ts
git commit -m "feat: hide ids from task tree while keeping stable disk paths"
```

---

### Task 16: Keep sidebar feedback summary-first and reserve advanced behavior for command palette only

**Files:**
- Modify: `package.json`
- Modify: `src/extension.ts`
- Modify: `src/webview/dashboard/renderTask.ts`
- Modify: `src/commands/runLocalJudge.ts`
- Modify: `src/commands/submitTask.ts`
- Test: `tests/unit/renderTask.test.ts`
- Test: `tests/unit/runLocalJudgeCommand.test.ts`
- Test: `tests/unit/submitTaskCommand.test.ts`
- Test: `tests/smoke/commands.smoke.test.ts`

**Step 1: Write the failing tests**

Add tests that prove:
- advanced actions remain reachable from command registration/command palette where intended
- they are absent from the normal sidebar card
- normal run/submit behavior relies on summary updates and sparse toast usage instead of noisy interruption

Key expectations:

```ts
expect(html).not.toContain('强制提交');
expect(commands).toContain('educoderLocalOj.forceRunOfficialJudge');
expect(normalToastCount).toBeLessThanOrEqual(expectedSparseCount);
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/unit/renderTask.test.ts tests/unit/runLocalJudgeCommand.test.ts tests/unit/submitTaskCommand.test.ts tests/smoke/commands.smoke.test.ts
```

Expected: FAIL because advanced behaviors and message patterns are not yet fully aligned with the final product rules.

**Step 3: Write minimal implementation**

- Keep advanced commands registered but off the normal sidebar UI
- Keep normal user feedback summary-first and low-interruption
- Limit toast usage to the approved sparse scenarios

**Step 4: Run test to verify it passes**

Run the same command and expect PASS.

**Step 5: Commit**

```bash
git add package.json src/extension.ts src/webview/dashboard/renderTask.ts src/commands/runLocalJudge.ts src/commands/submitTask.ts tests/unit/renderTask.test.ts tests/unit/runLocalJudgeCommand.test.ts tests/unit/submitTaskCommand.test.ts tests/smoke/commands.smoke.test.ts
git commit -m "refactor: keep advanced commands off the normal sidebar path"
```

## Pending follow-up batch (do not implement until discussed)

After the structure-slimming tasks above and the interaction tasks above, append later follow-up batches only for:
- visual polish fine-tuning
- richer result presentation details beyond the approved compact card
- failed-case quick-open affordance refinements
- any further VS Code-native micro-interaction polish agreed in discussion
