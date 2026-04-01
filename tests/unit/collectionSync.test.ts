import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  syncCollectionIndex,
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

    const manifest = await syncCollectionIndex({
      client,
      rootDir,
      courseId: 'ufr7sxlc',
      categoryId: '1316861',
    });

    expect(manifest.homeworks).toHaveLength(1);
    expect(
      await readJson(path.join(rootDir, 'collection.manifest.json')),
    ).toMatchObject({
      courseId: 'ufr7sxlc',
      categoryId: '1316861',
    });
    expect(
      await readJson(
        path.join(rootDir, 'homeworks', '3727439', 'tasks', 'fc7pz3fm6yjh', 'task.manifest.json'),
      ),
    ).toMatchObject({
      taskId: 'fc7pz3fm6yjh',
      name: '第1关 基本实训：链表操作',
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

    await syncCollectionIndex({ client, rootDir, courseId: 'ufr7sxlc', categoryId: '1316861' });
    const manifest = await syncCollectionIndex({
      client,
      rootDir,
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

    await syncCollectionIndex({ client, rootDir, courseId: 'ufr7sxlc', categoryId: '1316861' });
    const manifest = await syncCollectionIndex({
      client,
      rootDir,
      courseId: 'ufr7sxlc',
      categoryId: '1316861',
    });

    expect(manifest.homeworks).toHaveLength(2);
    expect(manifest.homeworks.find((item) => item.homeworkId === '3727439')?.tasks).toHaveLength(2);
    expect(
      manifest.homeworks.find((item) => item.homeworkId === '3727440')?.tasks[0]?.taskId,
    ).toBe('task-homework-2');
  });
});
