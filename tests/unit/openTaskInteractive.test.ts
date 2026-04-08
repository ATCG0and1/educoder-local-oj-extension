import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toRootFolderUri } from '../../src/core/config/extensionState.js';
import { openTaskInteractive } from '../../src/commands/openTaskInteractive.js';

const tempDirs: string[] = [];

async function createTempRoot(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'educoder-open-task-'));
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

describe('openTaskInteractive', () => {
  it('discovers synced tasks, shows quick pick, and opens the selected task', async () => {
    const rootDir = await createTempRoot();
    const productRoot = path.join(rootDir, 'Educoder Local OJ');
    const collectionRoot = path.join(
      productRoot,
      '课程 [ufr7sxlc]',
      '第二章 线性表及应用 [1316861]',
    );

    await writeJson(path.join(collectionRoot, 'collection.manifest.json'), {
      courseId: 'ufr7sxlc',
      courseName: '课程',
      courseFolderName: '课程 [ufr7sxlc]',
      categoryId: '1316861',
      categoryName: '第二章 线性表及应用',
      categoryFolderName: '第二章 线性表及应用 [1316861]',
      homeworks: [
        {
          homeworkId: '3727439',
          name: '2-2 基本实训-链表操作',
          folderName: '2-2 基本实训-链表操作 [3727439]',
          shixunIdentifier: 'a9k8ufmh',
          tasks: [
            {
              taskId: 'fc7pz3fm6yjh',
              name: '第1关 基本实训：链表操作',
              position: 1,
              folderName: '01 第1关 基本实训：链表操作 [fc7pz3fm6yjh]',
            },
          ],
        },
      ],
    });

    const showQuickPick = vi.fn(
      async (items: ReadonlyArray<{ taskRoot: string }>) => items[0],
    );
    const openTask = vi.fn(async (taskRoot: string) => ({ taskRoot, state: '已同步' as const }));
    const context = {
      globalState: {
        get: <T>(key: string) =>
          (key === 'rootFolderUri' ? toRootFolderUri(rootDir) : undefined) as T | undefined,
        update: async () => undefined,
      },
    };

    const result = await openTaskInteractive({
      context,
      window: {
        showOpenDialog: async () => undefined,
        showQuickPick: showQuickPick as never,
      },
      openTask,
    });

    const expectedTaskRoot = path.join(
      collectionRoot,
      'homeworks',
      '2-2 基本实训-链表操作 [3727439]',
      'tasks',
      '01 第1关 基本实训：链表操作 [fc7pz3fm6yjh]',
    );

    expect(showQuickPick).toHaveBeenCalledTimes(1);
    expect(openTask).toHaveBeenCalledWith(expectedTaskRoot);
    expect(result).toEqual({
      taskRoot: expectedTaskRoot,
      value: {
        taskRoot: expectedTaskRoot,
        state: '已同步',
      },
    });
  });

  it('throws a friendly error when no synced task exists locally', async () => {
    const rootDir = await createTempRoot();
    const context = {
      globalState: {
        get: <T>(key: string) =>
          (key === 'rootFolderUri' ? toRootFolderUri(rootDir) : undefined) as T | undefined,
        update: async () => undefined,
      },
    };

    await expect(
      openTaskInteractive({
        context,
        window: {
          showOpenDialog: async () => undefined,
          showQuickPick: async () => undefined,
        },
        openTask: async () => undefined,
      }),
    ).rejects.toThrow('No synced task found. Run Sync Current Collection first.');
  });
});
