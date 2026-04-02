# Educoder 答案学习台与完整仓库快照 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an answer-centric learning workbench to the Educoder Local OJ extension, plus a full read-only remote repository snapshot flow, so users can pull answer bodies, export study materials, compare current code against official references, and inspect the complete remote repo inside VS Code.

**Architecture:** Extend the existing recovery/task hydration pipeline instead of replacing it. Add a repository read adapter for recursive tree + file fetch, extend the answer adapter from metadata-only to body unlock, persist both into `_educoder/`, and expose the new materials through explicit sync/compare commands plus lightweight dashboard state. Keep the first version read-only and reuse VS Code diff for learning comparisons.

**Tech Stack:** TypeScript, VS Code Extension API, Vitest, Node `fs/promises`, existing `EducoderClient`, existing dashboard webview, existing recovery/history stores.

---

### Task 1: Lock the full-repository read contract with failing tests

**Files:**
- Create: `tests/unit/repositoryFetchClient.test.ts`
- Create: `src/core/api/repositoryFetchClient.ts`
- Modify: `src/core/api/taskDetailClient.ts`

**Step 1: Write the failing test**

Add tests that prove:
- `repository.json` is called with the expected `myshixun` identifier and `path`
- nested `tree` responses are normalized into stable repo nodes
- blob paths discovered from tree traversal can be handed to `rep_content.json`

Suggested test core:

```ts
test('lists repository nodes for a given path', async () => {
  const calls: Array<[string, Record<string, unknown> | undefined]> = [];
  const client = {
    post: async (path: string, body?: Record<string, unknown>) => {
      calls.push([path, body]);
      return { trees: [{ name: 'tasks.h', type: 'blob' }] };
    },
  };

  const fetcher = new RepositoryFetchClient(client as never);
  const nodes = await fetcher.listRepository({ myshixunIdentifier: 'obcts7i5fx', path: 'test1' });

  expect(nodes).toEqual([{ path: 'test1/tasks.h', name: 'tasks.h', type: 'blob' }]);
  expect(calls).toEqual([['/api/myshixuns/obcts7i5fx/repository.json', { path: 'test1' }]]);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/repositoryFetchClient.test.ts`
Expected: FAIL because the repository fetch client does not exist.

**Step 3: Write minimal implementation**

Implement:
- `RepositoryFetchClient.listRepository(...)`
- `RepositoryFetchClient.collectRepositoryTree(...)`
- normalization helpers for `blob` / `tree` nodes

Keep traversal iterative and read-only.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/repositoryFetchClient.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/unit/repositoryFetchClient.test.ts src/core/api/repositoryFetchClient.ts src/core/api/taskDetailClient.ts
git commit -m "feat: add repository read api client"
```

---

### Task 2: Extend answer APIs from metadata-only to unlocked answer bodies

**Files:**
- Modify: `tests/unit/answerFetchClient.test.ts`
- Modify: `src/core/api/answerFetchClient.ts`

**Step 1: Write the failing test**

Add tests that prove:
- `unlock_answer.json` is called with `answer_id`
- unlocked answer bodies are normalized into a stable local model
- empty or missing bodies are represented without pretending success

Suggested test core:

```ts
test('unlocks answer body by answer id', async () => {
  const calls: Array<[string, Record<string, unknown> | undefined]> = [];
  const client = {
    get: async (path: string, query?: Record<string, unknown>) => {
      calls.push([path, query]);
      return { contents: '```cpp\nint main(){}\n```' };
    },
  };

  const fetcher = new AnswerFetchClient(client as never);
  const body = await fetcher.unlockAnswer({ taskId: 'fc7pz3fm6yjh', answerId: 3567559 });

  expect(body.content).toContain('int main');
  expect(calls).toEqual([
    ['/api/tasks/fc7pz3fm6yjh/unlock_answer.json', { answer_id: 3567559 }],
  ]);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/answerFetchClient.test.ts`
Expected: FAIL because `unlockAnswer(...)` does not exist.

**Step 3: Write minimal implementation**

Implement:
- `AnswerFetchClient.unlockAnswer(...)`
- `UnlockedAnswerEntry` / `UnlockedAnswerContent`
- normalization helpers for body text and empty-body states

Keep existing `fetchAnswerInfo(...)` intact.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/answerFetchClient.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/unit/answerFetchClient.test.ts src/core/api/answerFetchClient.ts
git commit -m "feat: add answer unlock client support"
```

---

### Task 3: Persist repository snapshots and unlocked answer artifacts under `_educoder/`

**Files:**
- Create: `tests/unit/repositoryMaterialStore.test.ts`
- Modify: `tests/unit/recoveryMaterialStore.test.ts`
- Modify: `tests/unit/directoryLayout.test.ts`
- Create: `src/core/recovery/repositoryStore.ts`
- Modify: `src/core/recovery/materialStore.ts`
- Modify: `src/core/workspace/directoryLayout.ts`
- Modify: `src/core/sync/taskHydrator.ts`

**Step 1: Write the failing test**

Add tests that prove:
- task layout includes repository directories
- repository tree/index and remote snapshot files are written to `_educoder/repository/`
- unlocked answers are written to `_educoder/answer/unlocked/`
- recovery metadata records repo readiness, repo file count, and unlocked answer count

Suggested assertion:

```ts
await expect(readFile(path.join(layout.educoderDir, 'repository', 'index.json'), 'utf8')).resolves.toContain('test1/tasks.h');
await expect(readFile(path.join(layout.answerDir, 'unlocked', 'answer-3567559.md'), 'utf8')).resolves.toContain('int main');
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/repositoryMaterialStore.test.ts tests/unit/recoveryMaterialStore.test.ts tests/unit/directoryLayout.test.ts`
Expected: FAIL because repository directories and new metadata fields do not exist.

**Step 3: Write minimal implementation**

Implement:
- `writeRepositorySnapshot(...)`
- `writeRepositoryMetadata(...)`
- `writeUnlockedAnswers(...)`
- extended `RecoveryMetadata` fields:
  - `repositoryReady`
  - `repositoryFileCount`
  - `unlockedAnswerCount`
  - `lastRepositorySyncAt`
  - `lastAnswerSyncAt`
- new layout path(s):
  - `repositoryDir`
  - `repositoryRemoteDir`

Keep `hydrateTask(...)` backward-compatible when repo/answer-body inputs are absent.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/repositoryMaterialStore.test.ts tests/unit/recoveryMaterialStore.test.ts tests/unit/directoryLayout.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/unit/repositoryMaterialStore.test.ts tests/unit/recoveryMaterialStore.test.ts tests/unit/directoryLayout.test.ts src/core/recovery/repositoryStore.ts src/core/recovery/materialStore.ts src/core/workspace/directoryLayout.ts src/core/sync/taskHydrator.ts
git commit -m "feat: persist repository snapshots and unlocked answers"
```

---

### Task 4: Add explicit sync commands for full repository and answer bodies

**Files:**
- Create: `tests/unit/syncTaskRepository.test.ts`
- Create: `tests/unit/syncTaskAnswers.test.ts`
- Create: `src/commands/syncTaskRepository.ts`
- Create: `src/commands/syncTaskAnswers.ts`
- Modify: `src/extension.ts`
- Modify: `package.json`

**Step 1: Write the failing test**

Add tests that prove:
- `syncTaskRepository(...)` reads manifest/task metadata, recursively fetches repo tree + file contents, and writes a local snapshot
- `syncTaskAnswers(...)` reads answer entries, unlocks answer bodies, and writes them into `_educoder/answer/unlocked/`
- command wiring is present in `extension.ts` and `package.json`

Suggested assertion:

```ts
expect(repositoryClient.collectRepositoryTree).toHaveBeenCalledWith({
  myshixunIdentifier: 'obcts7i5fx',
  rootPath: '',
});
expect(answerClient.unlockAnswer).toHaveBeenCalledWith({
  taskId: 'fc7pz3fm6yjh',
  answerId: 3567559,
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/syncTaskRepository.test.ts tests/unit/syncTaskAnswers.test.ts`
Expected: FAIL because these commands do not exist.

**Step 3: Write minimal implementation**

Implement:
- `educoderLocalOj.syncTaskRepository`
- `educoderLocalOj.syncTaskAnswers`
- manifest bundle reader reuse for task/homework metadata
- default dependency factories in `extension.ts`

Prefer explicit commands instead of slowing down `openTask`.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/syncTaskRepository.test.ts tests/unit/syncTaskAnswers.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/unit/syncTaskRepository.test.ts tests/unit/syncTaskAnswers.test.ts src/commands/syncTaskRepository.ts src/commands/syncTaskAnswers.ts src/extension.ts package.json
git commit -m "feat: add repository and answer sync commands"
```

---

### Task 5: Add compare commands and expose learning state in the dashboard

**Files:**
- Create: `tests/unit/compareWithAnswer.test.ts`
- Create: `tests/unit/compareWithTemplate.test.ts`
- Modify: `tests/unit/stateModel.test.ts`
- Modify: `tests/smoke/dashboardPanel.smoke.test.ts`
- Create: `src/commands/compareWithAnswer.ts`
- Create: `src/commands/compareWithTemplate.ts`
- Modify: `src/core/ui/stateModel.ts`
- Modify: `src/webview/dashboard/renderTask.ts`
- Modify: `src/webview/dashboard/panel.ts`
- Modify: `src/extension.ts`
- Modify: `package.json`

**Step 1: Write the failing test**

Add tests that prove:
- compare commands open VS Code diff inputs with clear labels
- `TaskStateModel` exposes repository and unlocked answer counts
- dashboard renders repo/answer-learning pills and action labels

Suggested assertion:

```ts
expect(model.repositoryReady).toBe(true);
expect(model.unlockedAnswerCount).toBe(1);
expect(panel.webview.html).toContain('repo: ready (4 files)');
expect(panel.webview.html).toContain('answer unlocked: 1');
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/compareWithAnswer.test.ts tests/unit/compareWithTemplate.test.ts tests/unit/stateModel.test.ts tests/smoke/dashboardPanel.smoke.test.ts`
Expected: FAIL because compare commands and new UI state do not exist.

**Step 3: Write minimal implementation**

Implement:
- `compareWithTemplate(...)`
- `compareWithAnswer(...)`
- state-model field loading from recovery/repository metadata
- dashboard pills + lightweight action section

Use built-in `vscode.diff` instead of inventing a custom diff viewer.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/compareWithAnswer.test.ts tests/unit/compareWithTemplate.test.ts tests/unit/stateModel.test.ts tests/smoke/dashboardPanel.smoke.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/unit/compareWithAnswer.test.ts tests/unit/compareWithTemplate.test.ts tests/unit/stateModel.test.ts tests/smoke/dashboardPanel.smoke.test.ts src/commands/compareWithAnswer.ts src/commands/compareWithTemplate.ts src/core/ui/stateModel.ts src/webview/dashboard/renderTask.ts src/webview/dashboard/panel.ts src/extension.ts package.json
git commit -m "feat: add answer learning compare flows"
```

---

### Task 6: Verify the integrated extension build and package output

**Files:**
- Modify: `tests/smoke/realServiceGraph.smoke.test.ts`
- Modify: `tests/smoke/syncAndJudge.smoke.test.ts`

**Step 1: Write the failing test**

Add smoke coverage that proves:
- new commands are registered after activation
- repository/answer sync commands do not break existing task-open flow
- dashboard state can render when repo/answer metadata is present

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/smoke/realServiceGraph.smoke.test.ts tests/smoke/syncAndJudge.smoke.test.ts`
Expected: FAIL until command graph and new state are fully wired.

**Step 3: Write minimal implementation**

Adjust activation/service wiring and any leftover test fixtures so the integrated graph passes with the new commands.

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
git add tests/smoke/realServiceGraph.smoke.test.ts tests/smoke/syncAndJudge.smoke.test.ts
git commit -m "test: verify answer learning workbench integration"
```
