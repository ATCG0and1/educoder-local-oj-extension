import { access, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import * as vscode from 'vscode';
import { afterEach, describe, expect, it } from 'vitest';
import { openTaskCommand } from '../../src/commands/openTask.js';
import {
  syncCurrentCollection,
  type SyncCurrentCollectionResult,
} from '../../src/commands/syncCurrentCollection.js';
import { configureCommandService, resetCommandServices } from '../../src/extension.js';
import { ROOT_FOLDER_URI_KEY } from '../../src/core/config/extensionState.js';

const tempDirs: string[] = [];

async function createTempRoot(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'educoder-smoke-'));
  tempDirs.push(dir);
  return dir;
}

function createContext() {
  const store = new Map<string, string>();

  return {
    globalState: {
      get: <T>(key: string) => store.get(key) as T | undefined,
      update: async (key: string, value: string) => {
        store.set(key, value);
      },
    },
  };
}

afterEach(async () => {
  resetCommandServices();
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('sync and open task smoke flow', () => {
  it('syncs a clipboard collection into the product root and opens the hydrated task state', async () => {
    const rootDir = await createTempRoot();
    const context = createContext();

    configureCommandService('educoderLocalOj.syncCurrentCollection', () =>
      syncCurrentCollection({
        context,
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
          showInputBox: async () => undefined,
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
                tasks: [
                  {
                    taskId: 'fc7pz3fm6yjh',
                    name: '第1关 基本实训：链表操作',
                    position: 1,
                  },
                ],
              },
            ],
          }),
        },
      }),
    );
    configureCommandService('educoderLocalOj.openTask', (taskRoot) =>
      openTaskCommand(String(taskRoot), {
        taskDetailClient: {
          getTaskDetail: async () => ({
            taskId: 'fc7pz3fm6yjh',
            homeworkId: '3727439',
            taskName: '第1关 基本实训：链表操作',
            editablePaths: ['test1/test1.cpp'],
            testSets: [{ is_public: false, input: '1 2\n', output: '3\n' }],
            raw: {},
          }),
        },
        sourceClient: {
          fetchSourceFiles: async () => [{ path: 'test1/test1.cpp', content: 'int main() { return 0; }\n' }],
        },
        hiddenTestClient: {
          fetchHiddenTests: async () => [{ input: '1 2\n', output: '3\n' }],
        },
      }),
    );

    const syncResult = (await vscode.commands.executeCommand(
      'educoderLocalOj.syncCurrentCollection',
    )) as SyncCurrentCollectionResult;

    expect(syncResult.productRoot).toBe(path.join(rootDir, 'Educoder Local OJ'));
    expect(context.globalState.get(ROOT_FOLDER_URI_KEY)).toBeDefined();
    await expect(access(path.join(syncResult.collectionRoot, 'collection.manifest.json'))).resolves.toBeUndefined();

    const taskRoot = syncResult.firstTask?.taskRoot;
    expect(taskRoot).toBeDefined();

    const taskState = await vscode.commands.executeCommand('educoderLocalOj.openTask', taskRoot);
    expect(taskState).toMatchObject({
      taskId: 'fc7pz3fm6yjh',
      state: '可本地评测',
      hiddenTestsCached: true,
    });
  });
});
