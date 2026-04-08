import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openTaskCommand } from '../../src/commands/openTask.js';
import { syncCollectionPackages } from '../../src/commands/syncCollectionPackages.js';
import { runLocalJudge } from '../../src/core/judge/localRunner.js';
import { syncTaskPackageCommand } from '../../src/commands/syncTaskPackage.js';

const tempDirs: string[] = [];

async function createTempRoot(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'educoder-ch2-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function acceptPrefilledUrl(options?: { value?: string }): string | undefined {
  return options?.value;
}

describe('chapter two e2e', () => {
  it('syncs chapter two and bulk pulls full task packages before local judging', async () => {
    const rootDir = await createTempRoot();
    const syncResult = await syncCollectionPackages({
      context: {
        globalState: {
          get: () => undefined,
          update: async () => undefined,
        },
      },
      window: {
        showOpenDialog: async () => [{ fsPath: rootDir }],
      },
      clipboardEnv: {
        clipboard: {
          readText: async () =>
            'https://www.educoder.net/classrooms/ufr7sxlc/shixun_homework/1316861?tabs=0',
        },
      },
      input: {
        showInputBox: async (options) => acceptPrefilledUrl(options),
      },
      client: {
        getCollectionIndex: async () => ({
          courseId: 'ufr7sxlc',
          categoryId: '1316861',
          categoryName: '第二章 线性表及应用',
          homeworks: [
            {
              homeworkId: '3727439',
              name: '2-2 基本实训-链表操作',
              shixunIdentifier: 'a9k8ufmh',
              myshixunIdentifier: 'obcts7i5fx',
              studentWorkId: '286519999',
              tasks: [{ taskId: 'fc7pz3fm6yjh', name: '第1关 基本实训：链表操作', position: 1 }],
            },
          ],
        }),
      },
      syncTaskPackage: async (taskRoot) =>
        syncTaskPackageCommand(taskRoot, {
          taskDetailClient: {
            getTaskDetail: async () => ({
              taskId: 'fc7pz3fm6yjh',
              homeworkId: '3727439',
              taskName: '第1关 基本实训：链表操作',
              problemMaterial: {
                title: '第1关 基本实训：链表操作',
                statementMarkdown: '## 题目描述\n给定两个整数，输出它们的和。',
                statementHtml: '<p>给定两个整数，输出它们的和。</p>',
                samples: [{ name: '样例 1', input: '1 2\n', output: '3\n' }],
                raw: {},
              },
              editablePaths: ['test1/test1.cpp'],
              testSets: [
                { is_public: true, input: '1 2\n', output: '3\n' },
                { is_public: false, input: '4 5\n', output: '9\n' },
              ],
              raw: {},
            }),
          },
          sourceClient: {
            fetchSourceFiles: async () => [{ path: 'test1/test1.cpp', content: 'int main() { return 0; }\n' }],
          },
          hiddenTestClient: {
            fetchHiddenTests: async () => [
              { input: '1 2\n', output: '3\n' },
              { input: '4 5\n', output: '9\n' },
            ],
          },
          templateClient: {
            fetchTemplateFiles: async () => [{ path: 'test1/test1.cpp', content: '#include <iostream>\n' }],
          },
          passedClient: {
            fetchPassedFiles: async () => [{ path: 'test1/test1.cpp', content: 'accepted\n' }],
          },
          answerClient: {
            fetchAnswerInfo: async () => ({
              status: 3,
              entries: [{ answerId: 3567559, name: '解题思路1', content: '```cpp\nint main() {}\n```' }],
            }),
            unlockAnswer: async () => ({
              answerId: 3567559,
              content: '```cpp\nint main() {}\n```',
              unlocked: true,
            }),
          },
        }),
    });

    expect(syncResult.collectionRoot).toContain('第二章 线性表及应用 [1316861]');
    expect(syncResult.syncedTasks).toHaveLength(1);

    const taskRoot = syncResult.firstTask?.taskRoot;
    expect(taskRoot).toBeDefined();
    expect(syncResult.syncedTasks[0]?.taskRoot).toBe(taskRoot);
    await import('node:fs/promises').then(({ access }) =>
      expect(access(path.join(taskRoot!, 'problem', 'statement.md'))).resolves.toBeUndefined(),
    );
    await import('node:fs/promises').then(({ access }) =>
      expect(access(path.join(taskRoot!, 'tests', 'all', 'case_001_input.txt'))).resolves.toBeUndefined(),
    );

    const taskState = await openTaskCommand(taskRoot!);

    expect(taskState.hiddenTestsCached).toBe(true);

    const report = await runLocalJudge({
      taskRoot: taskRoot!,
      compileWorkspace: async ({ workspaceDir }) => ({
        success: true,
        executablePath: path.join(workspaceDir, 'app.exe'),
        stdout: '',
        stderr: '',
      }),
      executeBinary: async ({ input }) => ({
        stdout: input === '1 2\n' ? '3\n' : '9\n',
        stderr: '',
        exitCode: 0,
        timedOut: false,
      }),
    });

    expect(report.summary.total).toBe(2);
    expect(report.summary.failed).toBe(0);
  });
});
