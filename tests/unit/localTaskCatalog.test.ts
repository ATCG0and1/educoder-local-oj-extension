import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { scanLocalTaskCatalog } from '../../src/core/catalog/localTaskCatalog.js';

const tempDirs: string[] = [];

async function createTempRoot(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'educoder-catalog-'));
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

describe('scanLocalTaskCatalog', () => {
  it('builds a chapter-homework-task hierarchy from local collection manifests', async () => {
    const productRoot = path.join(await createTempRoot(), 'Educoder Local OJ');
    const collectionRoot = path.join(
      productRoot,
      '课程 [ufr7sxlc]',
      '第二章 线性表及应用 [1316861]',
    );

    await writeJson(path.join(collectionRoot, 'collection.manifest.json'), {
      courseId: 'ufr7sxlc',
      courseName: '数据结构',
      courseFolderName: '课程 [ufr7sxlc]',
      categoryId: '1316861',
      categoryName: '第二章 线性表及应用 [1316861]',
      categoryFolderName: '第二章 线性表及应用 [1316861]',
      homeworks: [
        {
          homeworkId: '3727439',
          name: '2-2 基本实训-链表操作 [3727439]',
          folderName: '2-2 基本实训-链表操作 [3727439]',
          shixunIdentifier: 'a9k8ufmh',
          tasks: [
            {
              taskId: 'fc7pz3fm6yjh',
              name: '第1关 基本实训：链表操作 [fc7pz3fm6yjh]',
              position: 1,
              folderName: '01 第1关 基本实训：链表操作 [fc7pz3fm6yjh]',
            },
          ],
        },
      ],
    });

    const chapters = await scanLocalTaskCatalog(productRoot);

    expect(chapters).toHaveLength(1);
    expect(chapters[0].name).toBe('第二章 线性表及应用');
    expect(chapters[0].courseName).toBe('数据结构');
    expect(chapters[0].homeworks[0].name).toBe('2-2 基本实训-链表操作');
    expect(chapters[0].homeworks[0].tasks[0]).toMatchObject({
      name: '第1关 基本实训：链表操作',
      taskId: 'fc7pz3fm6yjh',
      taskRoot: path.join(
        collectionRoot,
        'homeworks',
        '2-2 基本实训-链表操作 [3727439]',
        'tasks',
        '01 第1关 基本实训：链表操作 [fc7pz3fm6yjh]',
      ),
    });
    expect(chapters[0].name).not.toContain('[');
    expect(chapters[0].homeworks[0].name).not.toContain('[');
    expect(chapters[0].homeworks[0].tasks[0].name).not.toContain('[');
    expect(
      JSON.parse(await readFile(path.join(collectionRoot, 'collection.manifest.json'), 'utf8')) as {
        homeworks: Array<{ folderName: string; tasks: Array<{ folderName: string }> }>;
      },
    ).toMatchObject({
      homeworks: [
        {
          folderName: expect.stringContaining('['),
          tasks: [{ folderName: expect.stringContaining('[') }],
        },
      ],
    });
  });

  it('returns an empty list when the product root is missing', async () => {
    const chapters = await scanLocalTaskCatalog(path.join(await createTempRoot(), 'Educoder Local OJ'));
    expect(chapters).toEqual([]);
  });
});
