import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { APPROVED_SOLVE_STATES, buildTaskStateModel, loadTaskStateModel } from '../../src/core/ui/stateModel.js';

const tempDirs: string[] = [];

async function createTempTaskRoot(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'educoder-state-model-'));
  tempDirs.push(dir);
  return dir;
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await import('node:fs/promises').then(({ mkdir }) => mkdir(path.dirname(filePath), { recursive: true }));
  await writeFile(filePath, JSON.stringify(value, null, 2), 'utf8');
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('stateModel', () => {
  it('exposes the approved solve states for the task workbench', () => {
    expect(APPROVED_SOLVE_STATES).toEqual([
      '未开始',
      '作答中',
      '本地测试未过',
      '本地测试已过',
      '头哥评测已过',
    ]);
  });

  it('reports solve state and material completeness separately', () => {
    expect(
      buildTaskStateModel({
        taskManifest: { taskId: 'task-1', name: 'Task 1', position: 1, folderName: '01 Task 1 [task-1]' },
        workspaceReady: true,
        recoveryMetadata: {
          templateReady: true,
          templateFileCount: 1,
          passedReady: true,
          passedFileCount: 1,
          answerReady: true,
          answerEntryCount: 2,
          unlockedAnswerCount: 1,
          historyReady: false,
          historyFileCount: 0,
          repositoryReady: true,
          repositoryFileCount: 4,
          lastRepositorySyncAt: '2026-04-02T00:00:00.000Z',
          lastAnswerSyncAt: '2026-04-02T00:05:00.000Z',
          updatedAt: '2026-04-02T00:00:00.000Z',
        },
        materials: {
          statement: 'ready',
          template: 'ready',
          currentCode: 'ready',
          tests: 'ready',
          answers: 'ready',
          metadata: 'ready',
        },
      }),
    ).toMatchObject({
      displayTitle: '1 · Task 1',
      solveState: '未开始',
      materials: {
        statement: 'ready',
        template: 'ready',
        currentCode: 'ready',
        tests: 'ready',
        answers: 'ready',
        metadata: 'ready',
      },
      repositoryReady: true,
      repositoryFileCount: 4,
      lastRecoverySyncAt: '2026-04-02T00:00:00.000Z',
    });

    expect(
      buildTaskStateModel({
        taskManifest: { taskId: 'task-1', name: 'Task 1', position: 1, folderName: '01 Task 1 [task-1]' },
        workspaceReady: true,
        workingTreeDirty: true,
        materials: {
          statement: 'ready',
          template: 'ready',
          currentCode: 'ready',
          tests: 'ready',
          answers: 'missing',
          metadata: 'ready',
        },
      }),
    ).toMatchObject({
      solveState: '作答中',
      materials: {
        answers: 'missing',
      },
    });
  });

  it('maps local reports into local fail/pass solve states', () => {
    expect(
      buildTaskStateModel({
        taskManifest: { taskId: 'task-1', name: 'Task 1', position: 1, folderName: '01 Task 1 [task-1]' },
        workspaceReady: true,
        hiddenTestsCached: true,
        hiddenTestsCount: 4,
        materials: {
          statement: 'ready',
          template: 'ready',
          currentCode: 'ready',
          tests: 'ready',
          answers: 'missing',
          metadata: 'ready',
        },
        localReport: {
          source: 'tests/all',
          runMode: 'full',
          generatedAt: '2026-04-01T00:00:00.000Z',
          compile: { verdict: 'compiled', stdout: '', stderr: '', executablePath: 'app.exe' },
          caseResults: [],
          summary: { total: 1, passed: 0, failed: 1 },
        },
      }).solveState,
    ).toBe('本地测试未过');

    expect(
      buildTaskStateModel({
        taskManifest: { taskId: 'task-1', name: 'Task 1', position: 1, folderName: '01 Task 1 [task-1]' },
        workspaceReady: true,
        hiddenTestsCached: true,
        hiddenTestsCount: 4,
        materials: {
          statement: 'ready',
          template: 'ready',
          currentCode: 'ready',
          tests: 'ready',
          answers: 'missing',
          metadata: 'ready',
        },
        localReport: {
          source: 'tests/all',
          runMode: 'full',
          compile: { verdict: 'compiled', stdout: '', stderr: '', executablePath: 'app.exe' },
          caseResults: [],
          summary: { total: 1, passed: 1, failed: 0 },
        },
      }),
    ).toMatchObject({
      solveState: '本地测试已过',
      localJudge: {
        source: 'tests/all',
        compileVerdict: 'compiled',
        total: 1,
        passed: 1,
        failed: 0,
      },
    });
  });

  it('derives a readable local-judge insight from compile errors and failed cases', () => {
    expect(
      buildTaskStateModel({
        taskManifest: { taskId: 'task-1', name: 'Task 1', position: 1, folderName: '01 Task 1 [task-1]' },
        workspaceReady: true,
        hiddenTestsCached: true,
        hiddenTestsCount: 4,
        materials: {
          statement: 'ready',
          template: 'ready',
          currentCode: 'ready',
          tests: 'ready',
          answers: 'missing',
          metadata: 'ready',
        },
        localReport: {
          source: 'tests/all',
          runMode: 'full',
          compile: {
            verdict: 'compile_error',
            stdout: '',
            stderr: [
              'add/polynomial.cpp: In member function `float polynomial::sum() const`:',
              'add/polynomial.cpp:15:11: error: expected `;` at end of member declaration',
              '    float coef// 系数',
              '          ^',
            ].join('\n'),
            executablePath: undefined,
          },
          caseResults: [],
          summary: { total: 0, passed: 0, failed: 0 },
        },
      }).localJudge,
    ).toMatchObject({
      headline: '0/4 编译失败',
      detail: [
        'add/polynomial.cpp:15:11: error: expected `;` at end of member declaration',
        '    float coef// 系数',
        '          ^',
      ].join('\n'),
    });

    expect(
      buildTaskStateModel({
        taskManifest: { taskId: 'task-1', name: 'Task 1', position: 1, folderName: '01 Task 1 [task-1]' },
        workspaceReady: true,
        hiddenTestsCached: true,
        hiddenTestsCount: 4,
        materials: {
          statement: 'ready',
          template: 'ready',
          currentCode: 'ready',
          tests: 'ready',
          answers: 'missing',
          metadata: 'ready',
        },
        localReport: {
          source: 'tests/all',
          runMode: 'full',
          compile: {
            verdict: 'compile_error',
            stdout: '',
            stderr: '',
            executablePath: undefined,
          },
          caseResults: [],
          summary: { total: 0, passed: 0, failed: 0 },
        },
      }).localJudge,
    ).toMatchObject({
      headline: '0/4 编译失败',
      detail: '请检查编译输出。',
    });

    expect(
      buildTaskStateModel({
        taskManifest: { taskId: 'task-1', name: 'Task 1', position: 1, folderName: '01 Task 1 [task-1]' },
        workspaceReady: true,
        hiddenTestsCached: true,
        materials: {
          statement: 'ready',
          template: 'ready',
          currentCode: 'ready',
          tests: 'ready',
          answers: 'missing',
          metadata: 'ready',
        },
        localReport: {
          source: 'tests/all',
          runMode: 'full',
          compile: { verdict: 'compiled', stdout: '', stderr: '', executablePath: 'app.exe' },
          caseResults: [
            {
              caseId: 'case_002',
              verdict: 'failed',
              inputPath: 'tests/all/case_002_input.txt',
              outputPath: 'tests/all/case_002_output.txt',
              expected: '5\n',
              actual: '4\n',
              stdout: '4\n',
              stderr: '',
            },
          ],
          summary: { total: 1, passed: 0, failed: 1 },
        },
      }).localJudge,
    ).toMatchObject({
      headline: '首个失败：case_002',
      detail: '输入 tests/all/case_002_input.txt\n期望：5\n实际：4',
      failureInputPath: 'tests/all/case_002_input.txt',
      failureOutputPath: 'tests/all/case_002_output.txt',
    });
  });

  it('prefers official pass as the final solve state', () => {
    const model = buildTaskStateModel({
      taskManifest: { taskId: 'task-1', name: 'Task 1', position: 1, folderName: '01 Task 1 [task-1]' },
      workspaceReady: true,
      materials: {
        statement: 'ready',
        template: 'ready',
        currentCode: 'ready',
        tests: 'ready',
        answers: 'ready',
        metadata: 'ready',
      },
      localReport: {
        source: 'tests/all',
        runMode: 'full',
        compile: { verdict: 'compiled', stdout: '', stderr: '', executablePath: 'app.exe' },
        caseResults: [],
        summary: { total: 1, passed: 1, failed: 0 },
      },
      officialReport: {
        source: 'remote',
        codeHash: 'abc',
        generatedAt: '2026-04-01T01:00:00.000Z',
        summary: {
          verdict: 'passed',
          score: 100,
          passedCount: 1,
          totalCount: 1,
          message: 'Accepted',
          rawLogPath: '_educoder/judge/remote_runs/run.json',
        },
      },
    });

    expect(model).toMatchObject({
      displayTitle: '1 · Task 1',
      solveState: '头哥评测已过',
      lastOfficialJudgeAt: '2026-04-01T01:00:00.000Z',
      officialJudge: {
        verdict: 'passed',
        headline: '已通过 1/1',
        detail: 'Accepted',
      },
    });
  });

  it('derives official pass-count wording from score and local test totals when explicit remote counts are unavailable', () => {
    const model = buildTaskStateModel({
      taskManifest: { taskId: 'task-2', name: 'Task 2', position: 2, folderName: '02 Task 2 [task-2]' },
      workspaceReady: true,
      hiddenTestsCached: true,
      hiddenTestsCount: 5,
      materials: {
        statement: 'ready',
        template: 'ready',
        currentCode: 'ready',
        tests: 'ready',
        answers: 'ready',
        metadata: 'ready',
      },
      officialReport: {
        source: 'remote',
        codeHash: 'hash-remote-only',
        generatedAt: '2026-04-01T02:00:00.000Z',
        summary: {
          verdict: 'failed',
          score: 60,
          message: 'Wrong Answer',
          rawLogPath: '_educoder/judge/remote_runs/run.json',
        },
      },
    });

    expect(model.officialJudge).toMatchObject({
      verdict: 'failed',
      headline: '未通过 3/5',
      detail: 'Wrong Answer',
    });
  });

  it('loads legacy-only task roots into the new material model without requiring canonical answers ahead of time', async () => {
    const taskRoot = await createTempTaskRoot();
    await writeJson(path.join(taskRoot, 'task.manifest.json'), {
      taskId: 'task-legacy',
      name: 'Legacy Task',
      position: 1,
      folderName: '01 Legacy Task [task-legacy]',
    });
    await import('node:fs/promises').then(({ mkdir }) =>
      Promise.all([
        mkdir(path.join(taskRoot, 'workspace', 'src'), { recursive: true }),
        mkdir(path.join(taskRoot, '_educoder', 'tests', 'hidden'), { recursive: true }),
        mkdir(path.join(taskRoot, '_educoder', 'answer', 'unlocked'), { recursive: true }),
        mkdir(path.join(taskRoot, '_educoder', 'meta'), { recursive: true }),
      ]),
    );
    await Promise.all([
      writeFile(path.join(taskRoot, 'workspace', 'src', 'main.cpp'), 'int main() { return 0; }\n', 'utf8'),
      writeFile(path.join(taskRoot, '_educoder', 'tests', 'hidden', 'case_001_input.txt'), '1 2\n', 'utf8'),
      writeFile(path.join(taskRoot, '_educoder', 'tests', 'hidden', 'case_001_output.txt'), '3\n', 'utf8'),
      writeFile(
        path.join(taskRoot, '_educoder', 'answer', 'answer_info.json'),
        JSON.stringify({ status: 3, entries: [{ answerId: 1, name: '旧答案' }] }, null, 2),
        'utf8',
      ),
      writeFile(path.join(taskRoot, '_educoder', 'answer', 'unlocked', 'answer-1.md'), 'legacy answer\n', 'utf8'),
      writeFile(
        path.join(taskRoot, '_educoder', 'meta', 'task.json'),
        JSON.stringify({ taskId: 'task-legacy' }, null, 2),
        'utf8',
      ),
    ]);

    const model = await loadTaskStateModel(taskRoot);

    expect(model).toMatchObject({
      readiness: 'local_ready',
      hiddenTestsCached: true,
      materials: {
        currentCode: 'ready',
        tests: 'ready',
        answers: 'ready',
        metadata: 'ready',
      },
    });
  });

  it('loads canonical answer files from answers/ and internal answer metadata from _educoder/answers', async () => {
    const taskRoot = await createTempTaskRoot();
    await writeJson(path.join(taskRoot, 'task.manifest.json'), {
      taskId: 'task-canonical-answer',
      name: 'Canonical Answer Task',
      position: 2,
      folderName: '02 Canonical Answer Task [task-canonical-answer]',
    });
    await import('node:fs/promises').then(({ mkdir }) =>
      Promise.all([
        mkdir(path.join(taskRoot, 'code', 'current', 'src'), { recursive: true }),
        mkdir(path.join(taskRoot, 'tests', 'all'), { recursive: true }),
        mkdir(path.join(taskRoot, 'answers'), { recursive: true }),
        mkdir(path.join(taskRoot, '_educoder', 'answers'), { recursive: true }),
        mkdir(path.join(taskRoot, '_educoder', 'meta'), { recursive: true }),
      ]),
    );
    await Promise.all([
      writeFile(path.join(taskRoot, 'code', 'current', 'src', 'main.cpp'), 'int main() { return 0; }\n', 'utf8'),
      writeFile(path.join(taskRoot, 'tests', 'all', 'case_001_input.txt'), '1 2\n', 'utf8'),
      writeFile(path.join(taskRoot, 'tests', 'all', 'case_001_output.txt'), '3\n', 'utf8'),
      writeFile(path.join(taskRoot, 'answers', 'answer-1.md'), '# answer\n', 'utf8'),
      writeFile(
        path.join(taskRoot, '_educoder', 'answers', 'answer_info.json'),
        JSON.stringify({ status: 3, entries: [{ answerId: 1, name: '答案' }] }, null, 2),
        'utf8',
      ),
      writeFile(
        path.join(taskRoot, '_educoder', 'meta', 'task.json'),
        JSON.stringify({ taskId: 'task-canonical-answer' }, null, 2),
        'utf8',
      ),
    ]);

    const model = await loadTaskStateModel(taskRoot);

    expect(model).toMatchObject({
      readiness: 'local_ready',
      materials: {
        currentCode: 'ready',
        tests: 'ready',
        answers: 'ready',
      },
    });
  });

  it('loads template readiness and local judge summaries from internal _educoder paths', async () => {
    const taskRoot = await createTempTaskRoot();
    await writeJson(path.join(taskRoot, 'task.manifest.json'), {
      taskId: 'task-internal',
      name: 'Internal Task',
      position: 1,
      folderName: '01 Internal Task [task-internal]',
    });
    await import('node:fs/promises').then(({ mkdir }) =>
      Promise.all([
        mkdir(path.join(taskRoot, 'code', 'current', 'src'), { recursive: true }),
        mkdir(path.join(taskRoot, '_educoder', 'template', 'src'), { recursive: true }),
        mkdir(path.join(taskRoot, '_educoder', 'judge'), { recursive: true }),
        mkdir(path.join(taskRoot, '_educoder', 'meta'), { recursive: true }),
      ]),
    );
    await Promise.all([
      writeFile(path.join(taskRoot, 'code', 'current', 'src', 'main.cpp'), 'int main() { return 0; }\n', 'utf8'),
      writeFile(path.join(taskRoot, '_educoder', 'template', 'src', 'main.cpp'), 'int main() { return 1; }\n', 'utf8'),
      writeFile(
        path.join(taskRoot, '_educoder', 'judge', 'latest_local.json'),
        JSON.stringify(
          {
            source: 'tests/all',
            generatedAt: '2026-04-06T00:00:00.000Z',
            runMode: 'full',
            compile: { verdict: 'compiled', stdout: '', stderr: '', executablePath: 'app.exe' },
            caseResults: [],
            summary: { total: 1, passed: 1, failed: 0 },
          },
          null,
          2,
        ),
        'utf8',
      ),
      writeFile(path.join(taskRoot, '_educoder', 'meta', 'task.json'), JSON.stringify({ taskId: 'task-internal' }), 'utf8'),
    ]);

    const model = await loadTaskStateModel(taskRoot);

    expect(model).toMatchObject({
      materials: {
        template: 'ready',
      },
      localJudge: {
        source: 'tests/all',
        passed: 1,
        failed: 0,
      },
      lastLocalJudgeAt: '2026-04-06T00:00:00.000Z',
    });
  });
});
