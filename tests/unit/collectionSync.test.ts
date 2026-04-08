import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { syncCollectionPackages } from '../../src/commands/syncCollectionPackages.js';
import { ROOT_FOLDER_URI_KEY } from '../../src/core/config/extensionState.js';
import {
  syncCollectionIndex,
  syncCollectionTaskPackages,
  type CollectionIndexClient,
} from '../../src/core/sync/collectionSync.js';

const tempDirs: string[] = [];

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, 'utf8')) as T;
}

async function createTempRoot(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'educoder-local-oj-'));
  tempDirs.push(dir);
  return dir;
}

function createContext(initialRootFolderUri?: string) {
  const store = new Map<string, string>();
  if (initialRootFolderUri) {
    store.set(ROOT_FOLDER_URI_KEY, initialRootFolderUri);
  }

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
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('syncCollectionIndex', () => {
  it('creates collection.manifest.json on first sync', async () => {
    const rootDir = await createTempRoot();
    const client: CollectionIndexClient = {
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
    };

    const result = await syncCollectionIndex({
      client,
      productRoot: rootDir,
      courseId: 'ufr7sxlc',
      categoryId: '1316861',
    });
    const { manifest } = result;

    expect(manifest.homeworks).toHaveLength(1);
    expect(
      await readJson(path.join(result.rootDir, 'collection.manifest.json')),
    ).toMatchObject({
      courseId: 'ufr7sxlc',
      categoryId: '1316861',
      categoryFolderName: '第二章 线性表及应用 [1316861]',
    });
    expect(
      await readJson(
        path.join(
          result.rootDir,
          'homeworks',
          '2-2 基本实训-链表操作 [3727439]',
          'tasks',
          '01 第1关 基本实训：链表操作 [fc7pz3fm6yjh]',
          'task.manifest.json',
        ),
      ),
    ).toMatchObject({
      taskId: 'fc7pz3fm6yjh',
      name: '第1关 基本实训：链表操作',
      folderName: '01 第1关 基本实训：链表操作 [fc7pz3fm6yjh]',
    });
  });

  it('does not duplicate existing homeworks or tasks on repeat sync', async () => {
    const rootDir = await createTempRoot();
    const fixture = {
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
    };
    const client: CollectionIndexClient = {
      getCollectionIndex: async () => fixture,
    };

    await syncCollectionIndex({ client, productRoot: rootDir, courseId: 'ufr7sxlc', categoryId: '1316861' });
    const { manifest } = await syncCollectionIndex({
      client,
      productRoot: rootDir,
      courseId: 'ufr7sxlc',
      categoryId: '1316861',
    });

    expect(manifest.homeworks).toHaveLength(1);
    expect(manifest.homeworks[0]?.tasks).toHaveLength(1);
    expect(manifest.homeworks[0]?.tasks[0]?.taskId).toBe('fc7pz3fm6yjh');
  });

  it('only appends newly discovered tasks on incremental sync', async () => {
    const rootDir = await createTempRoot();
    const snapshots = [
      {
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
      },
      {
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
              {
                taskId: 'new-task-2',
                name: '第2关 新增关卡',
                position: 2,
              },
            ],
          },
          {
            homeworkId: '3727440',
            name: '2-3 基本实训：链表查找次数',
            shixunIdentifier: 'q8yaohm4',
            myshixunIdentifier: '25klbhcuio',
            studentWorkId: '286520028',
            tasks: [
              {
                taskId: 'task-homework-2',
                name: '第1关 查找次数',
                position: 1,
              },
            ],
          },
        ],
      },
    ];

    let callIndex = 0;
    const client: CollectionIndexClient = {
      getCollectionIndex: async () => snapshots[callIndex++]!,
    };

    await syncCollectionIndex({ client, productRoot: rootDir, courseId: 'ufr7sxlc', categoryId: '1316861' });
    const { manifest } = await syncCollectionIndex({
      client,
      productRoot: rootDir,
      courseId: 'ufr7sxlc',
      categoryId: '1316861',
    });

    expect(manifest.homeworks).toHaveLength(2);
    expect(manifest.homeworks.find((item) => item.homeworkId === '3727439')?.tasks).toHaveLength(2);
    expect(
      manifest.homeworks.find((item) => item.homeworkId === '3727440')?.tasks[0]?.taskId,
    ).toBe('task-homework-2');
  });

  it('serially syncs full task packages for every task in the collection manifest', async () => {
    const rootDir = await createTempRoot();
    const manifest = {
      courseId: 'ufr7sxlc',
      courseFolderName: '课程 [ufr7sxlc]',
      categoryId: '1316861',
      categoryFolderName: '第二章 线性表及应用 [1316861]',
      homeworks: [
        {
          homeworkId: '3727439',
          name: '2-2 基本实训-链表操作',
          folderName: '2-2 基本实训-链表操作 [3727439]',
          shixunIdentifier: 'a9k8ufmh',
          myshixunIdentifier: 'obcts7i5fx',
          studentWorkId: '286519999',
          tasks: [
            {
              taskId: 'fc7pz3fm6yjh',
              name: '第1关 基本实训：链表操作',
              position: 1,
              folderName: '01 第1关 基本实训：链表操作 [fc7pz3fm6yjh]',
            },
            {
              taskId: 'task-2',
              name: '第2关 新增关卡',
              position: 2,
              folderName: '02 第2关 新增关卡 [task-2]',
            },
          ],
        },
      ],
    };

    const seenTaskIds: string[] = [];
    const result = await syncCollectionTaskPackages({
      collectionRoot: path.join(rootDir, '课程 [ufr7sxlc]', '第二章 线性表及应用 [1316861]'),
      manifest,
      syncTaskPackage: async ({ taskRoot, task }) => {
        seenTaskIds.push(task.taskId);
        return { taskRoot, taskId: task.taskId };
      },
    });

    expect(seenTaskIds).toEqual(['fc7pz3fm6yjh', 'task-2']);
    expect(result.map((item) => item.taskRoot)).toEqual([
      path.join(
        rootDir,
        '课程 [ufr7sxlc]',
        '第二章 线性表及应用 [1316861]',
        'homeworks',
        '2-2 基本实训-链表操作 [3727439]',
        'tasks',
        '01 第1关 基本实训：链表操作 [fc7pz3fm6yjh]',
      ),
      path.join(
        rootDir,
        '课程 [ufr7sxlc]',
        '第二章 线性表及应用 [1316861]',
        'homeworks',
        '2-2 基本实训-链表操作 [3727439]',
        'tasks',
        '02 第2关 新增关卡 [task-2]',
      ),
    ]);
    expect(result.every((item) => item.ok)).toBe(true);
  });

  it('continues syncing the rest of the chapter when one task package fails', async () => {
    const rootDir = await createTempRoot();
    const manifest = {
      courseId: 'ufr7sxlc',
      courseFolderName: '课程 [ufr7sxlc]',
      categoryId: '1316861',
      categoryFolderName: '第二章 线性表及应用 [1316861]',
      homeworks: [
        {
          homeworkId: '3727439',
          name: '2-2 基本实训-链表操作',
          folderName: '2-2 基本实训-链表操作 [3727439]',
          shixunIdentifier: 'a9k8ufmh',
          myshixunIdentifier: 'obcts7i5fx',
          studentWorkId: '286519999',
          tasks: [
            {
              taskId: 'task-ready',
              name: '第1关 正常题',
              position: 1,
              folderName: '01 第1关 正常题 [task-ready]',
            },
            {
              taskId: 'task-broken',
              name: '第2关 异常题',
              position: 2,
              folderName: '02 第2关 异常题 [task-broken]',
            },
            {
              taskId: 'task-later',
              name: '第3关 后续题',
              position: 3,
              folderName: '03 第3关 后续题 [task-later]',
            },
          ],
        },
      ],
    };

    const result = await syncCollectionTaskPackages({
      collectionRoot: path.join(rootDir, '课程 [ufr7sxlc]', '第二章 线性表及应用 [1316861]'),
      manifest,
      syncTaskPackage: async ({ task }) => {
        if (task.taskId === 'task-broken') {
          throw new Error('answers missing');
        }

        return { taskId: task.taskId };
      },
    });

    expect(result).toEqual([
      expect.objectContaining({ task: expect.objectContaining({ taskId: 'task-ready' }), ok: true }),
      expect.objectContaining({
        task: expect.objectContaining({ taskId: 'task-broken' }),
        ok: false,
        errorMessage: 'answers missing',
      }),
      expect.objectContaining({ task: expect.objectContaining({ taskId: 'task-later' }), ok: true }),
    ]);
  });
});

describe('syncCollectionPackages', () => {
  it('auto-prompts for the storage root and returns full package sync results', async () => {
    const rootDir = await createTempRoot();
    const context = createContext();
    const showOpenDialog = vi.fn(async () => [{ fsPath: rootDir }]);
    const showInputBox = vi.fn(
      async (options?: { value?: string }) =>
        options?.value ??
        'https://www.educoder.net/classrooms/ufr7sxlc/shixun_homework/1316861?tabs=0',
    );

    const result = await syncCollectionPackages({
      context,
      window: { showOpenDialog },
      clipboardEnv: {
        clipboard: {
          readText: async () =>
            'https://www.educoder.net/classrooms/ufr7sxlc/shixun_homework/1316861?tabs=0',
        },
      },
      input: { showInputBox },
      client: {
        getCollectionIndex: async () => ({
          courseId: 'ufr7sxlc',
          courseName: '课程',
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
      syncTaskPackage: async (taskRoot) => {
        await mkdir(path.join(taskRoot, 'problem'), { recursive: true });
        await writeFile(path.join(taskRoot, 'problem', 'statement.md'), '# 题面\n', 'utf8');
        return {
          taskRoot,
          materials: {
            statement: 'ready',
            currentCode: 'ready',
            templateCode: 'ready',
            tests: 'ready',
            answers: 'ready',
            metadata: 'ready',
          },
        };
      },
    });

    expect(result.syncedTasks).toHaveLength(1);
    expect(result.syncedTasks[0]?.task.taskId).toBe('fc7pz3fm6yjh');
    expect(result.defaultTask?.task.taskId).toBe('fc7pz3fm6yjh');
    expect(showOpenDialog).toHaveBeenCalledTimes(1);
    expect(showInputBox).toHaveBeenCalledTimes(1);
    await expect(
      readJson<{ courseId: string }>(path.join(result.collectionRoot, 'collection.manifest.json')),
    ).resolves.toMatchObject({
      courseId: 'ufr7sxlc',
    });
    await expect(
      readFile(path.join(result.syncedTasks[0]!.taskRoot, 'problem', 'statement.md'), 'utf8'),
    ).resolves.toContain('# 题面');
    await expect(
      readFile(path.join(result.productRoot, '.vscode', 'settings.json'), 'utf8'),
    ).resolves.toContain('"**/_educoder": true');
    await expect(
      readFile(path.join(result.productRoot, '.vscode', 'settings.json'), 'utf8'),
    ).resolves.toContain('"**/code/template": true');
  });

  it('reuses a remembered storage root instead of prompting every one-click sync', async () => {
    const rootDir = await createTempRoot();
    const context = createContext(pathToFileURL(rootDir).toString());
    const showOpenDialog = vi.fn(async () => [{ fsPath: rootDir }]);
    const showInputBox = vi.fn(
      async (options?: { value?: string }) =>
        options?.value ??
        'https://www.educoder.net/classrooms/ufr7sxlc/shixun_homework/1316861?tabs=0',
    );

    const result = await syncCollectionPackages({
      context,
      window: { showOpenDialog },
      clipboardEnv: {
        clipboard: {
          readText: async () =>
            'https://www.educoder.net/classrooms/ufr7sxlc/shixun_homework/1316861?tabs=0',
        },
      },
      input: { showInputBox },
      client: {
        getCollectionIndex: async () => ({
          courseId: 'ufr7sxlc',
          courseName: '课程',
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
      syncTaskPackage: async (taskRoot) => {
        await mkdir(taskRoot, { recursive: true });
        return {
          taskRoot,
          materials: {
            statement: 'ready',
            currentCode: 'ready',
            templateCode: 'ready',
            tests: 'ready',
            answers: 'ready',
            metadata: 'ready',
          },
        };
      },
    });

    expect(result.syncedTasks).toHaveLength(1);
    expect(showOpenDialog).not.toHaveBeenCalled();
  });

  it('prefers an incomplete task over the remembered task when choosing the default post-sync task', async () => {
    const rootDir = await createTempRoot();
    const collectionRoot = path.join(
      rootDir,
      'Educoder Local OJ',
      '课程 [ufr7sxlc]',
      '第二章 线性表及应用 [1316861]',
    );
    const rememberedTaskRoot = path.join(
      collectionRoot,
      'homeworks',
      '2-2 基本实训-链表操作 [3727439]',
      'tasks',
      '03 第3关 已做过 [task-last]',
    );
    const context = createContext();
    await context.globalState.update('lastOpenedTaskRoot', rememberedTaskRoot);

    const result = await syncCollectionPackages({
      context,
      window: { showOpenDialog: vi.fn(async () => [{ fsPath: rootDir }]) },
      clipboardEnv: {
        clipboard: {
          readText: async () =>
            'https://www.educoder.net/classrooms/ufr7sxlc/shixun_homework/1316861?tabs=0',
        },
      },
      input: {
        showInputBox: vi.fn(async () => 'https://www.educoder.net/classrooms/ufr7sxlc/shixun_homework/1316861?tabs=0'),
      },
      client: {
        getCollectionIndex: async () => ({
          courseId: 'ufr7sxlc',
          courseName: '课程',
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
                { taskId: 'task-ready', name: '第1关 正常题', position: 1 },
                { taskId: 'task-broken', name: '第2关 异常题', position: 2 },
                { taskId: 'task-last', name: '第3关 已做过', position: 3 },
              ],
            },
          ],
        }),
      },
      syncTaskPackage: async (_taskRoot, info) => ({
        taskId: info.task.taskId,
        materials: {
          statement: 'ready',
          currentCode: 'ready',
          templateCode: 'ready',
          tests: 'ready',
          answers: info.task.taskId === 'task-broken' ? 'missing' : 'ready',
          metadata: 'ready',
        },
      }),
    });

    expect(result.defaultTask).toMatchObject({
      task: {
        taskId: 'task-broken',
      },
      reason: 'incomplete',
    });
  });

  it('reopens the remembered task when the synced chapter has no incomplete tasks', async () => {
    const rootDir = await createTempRoot();
    const collectionRoot = path.join(
      rootDir,
      'Educoder Local OJ',
      '课程 [ufr7sxlc]',
      '第二章 线性表及应用 [1316861]',
    );
    const rememberedTaskRoot = path.join(
      collectionRoot,
      'homeworks',
      '2-2 基本实训-链表操作 [3727439]',
      'tasks',
      '02 第2关 已做过 [task-last]',
    );
    const context = createContext();
    await context.globalState.update('lastOpenedTaskRoot', rememberedTaskRoot);

    const result = await syncCollectionPackages({
      context,
      window: { showOpenDialog: vi.fn(async () => [{ fsPath: rootDir }]) },
      clipboardEnv: {
        clipboard: {
          readText: async () =>
            'https://www.educoder.net/classrooms/ufr7sxlc/shixun_homework/1316861?tabs=0',
        },
      },
      input: {
        showInputBox: vi.fn(async () => 'https://www.educoder.net/classrooms/ufr7sxlc/shixun_homework/1316861?tabs=0'),
      },
      client: {
        getCollectionIndex: async () => ({
          courseId: 'ufr7sxlc',
          courseName: '课程',
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
                { taskId: 'task-first', name: '第1关 首题', position: 1 },
                { taskId: 'task-last', name: '第2关 已做过', position: 2 },
              ],
            },
          ],
        }),
      },
      syncTaskPackage: async (taskRoot) => ({
        taskRoot,
        materials: {
          statement: 'ready',
          currentCode: 'ready',
          templateCode: 'ready',
          tests: 'ready',
          answers: 'ready',
          metadata: 'ready',
        },
      }),
    });

    expect(result.defaultTask).toMatchObject({
      task: {
        taskId: 'task-last',
      },
      taskRoot: rememberedTaskRoot,
      reason: 'last_opened',
    });
  });
});
