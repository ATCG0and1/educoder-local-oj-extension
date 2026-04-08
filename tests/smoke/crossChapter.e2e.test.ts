import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openTaskCommand } from '../../src/commands/openTask.js';
import { syncCollectionPackages } from '../../src/commands/syncCollectionPackages.js';
import { syncTaskPackageCommand } from '../../src/commands/syncTaskPackage.js';

const tempDirs: string[] = [];

async function createTempRoot(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'educoder-cross-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function acceptPrefilledUrl(options?: { value?: string }): string | undefined {
  return options?.value;
}

describe('cross chapter e2e', () => {
  it('proves bulk full-package sync is not hardcoded to chapter two names or ids', async () => {
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
            'https://www.educoder.net/classrooms/ufr7sxlc/shixun_homework/1316859?tabs=0',
        },
      },
      input: {
        showInputBox: async (options) => acceptPrefilledUrl(options),
      },
      client: {
        getCollectionIndex: async () => ({
          courseId: 'ufr7sxlc',
          categoryId: '1316859',
          categoryName: '第一章 绪论',
          homeworks: [
            {
              homeworkId: '3727447',
              name: '1-1 基本实训：顺序表计数',
              shixunIdentifier: 'intro-shixun',
              myshixunIdentifier: 'intro-myshixun',
              studentWorkId: '286520915',
              tasks: [{ taskId: 'intro-task', name: '第1关 绪论任务', position: 1 }],
            },
          ],
        }),
      },
      syncTaskPackage: async (taskRoot) =>
        syncTaskPackageCommand(taskRoot, {
          taskDetailClient: {
            getTaskDetail: async () => ({
              taskId: 'intro-task',
              homeworkId: '3727447',
              taskName: '第1关 绪论任务',
              problemMaterial: {
                title: '第1关 绪论任务',
                statementMarkdown: '## 题目描述\n输出 hello。',
                statementHtml: '<p>输出 hello。</p>',
                samples: [{ name: '样例 1', input: 'hello\n', output: 'hello\n' }],
                raw: {},
              },
              editablePaths: ['main.cpp'],
              testSets: [{ is_public: false, input: 'hello\n', output: 'hello\n' }],
              raw: {},
            }),
          },
          sourceClient: {
            fetchSourceFiles: async () => [{ path: 'main.cpp', content: 'int main() { return 0; }\n' }],
          },
          hiddenTestClient: {
            fetchHiddenTests: async () => [{ input: 'hello\n', output: 'hello\n' }],
          },
          templateClient: {
            fetchTemplateFiles: async () => [{ path: 'main.cpp', content: '#include <iostream>\n' }],
          },
          passedClient: {
            fetchPassedFiles: async () => [{ path: 'main.cpp', content: 'accepted\n' }],
          },
          answerClient: {
            fetchAnswerInfo: async () => ({
              status: 3,
              entries: [{ answerId: 123, name: '思路', content: '```cpp\nint main() {}\n```' }],
            }),
            unlockAnswer: async () => ({
              answerId: 123,
              content: '```cpp\nint main() {}\n```',
              unlocked: true,
            }),
          },
        }),
    });

    expect(syncResult.collectionRoot).toContain('第一章 绪论 [1316859]');
    expect(syncResult.firstTask?.taskRoot).toContain('1-1 基本实训：顺序表计数 [3727447]');
    expect(syncResult.syncedTasks).toHaveLength(1);
    await import('node:fs/promises').then(({ access }) =>
      expect(access(path.join(syncResult.firstTask!.taskRoot, 'problem', 'statement.md'))).resolves.toBeUndefined(),
    );

    const model = await openTaskCommand(syncResult.firstTask!.taskRoot);

    expect(model).toMatchObject({
      taskId: 'intro-task',
      hiddenTestsCached: true,
      readiness: 'local_ready',
    });
  });
});
