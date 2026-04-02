import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openTaskCommand } from '../../src/commands/openTask.js';
import { syncCurrentCollection } from '../../src/commands/syncCurrentCollection.js';

const tempDirs: string[] = [];

async function createTempRoot(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'educoder-cross-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('cross chapter e2e', () => {
  it('proves the workflow is not hardcoded to chapter two names or ids', async () => {
    const rootDir = await createTempRoot();
    const syncResult = await syncCurrentCollection({
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
        showInputBox: async () => undefined,
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
    });

    expect(syncResult.collectionRoot).toContain('第一章 绪论 [1316859]');
    expect(syncResult.firstTask?.taskRoot).toContain('1-1 基本实训：顺序表计数 [3727447]');

    const model = await openTaskCommand(syncResult.firstTask!.taskRoot, {
      taskDetailClient: {
        getTaskDetail: async () => ({
          taskId: 'intro-task',
          homeworkId: '3727447',
          taskName: '第1关 绪论任务',
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
    });

    expect(model).toMatchObject({
      taskId: 'intro-task',
      hiddenTestsCached: true,
      readiness: 'local_ready',
    });
  });
});
