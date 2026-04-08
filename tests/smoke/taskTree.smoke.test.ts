import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import * as vscode from 'vscode';
import { afterEach, describe, expect, it } from 'vitest';
import { toRootFolderUri } from '../../src/core/config/extensionState.js';

const tempDirs: string[] = [];

async function createTempRoot(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'educoder-tree-smoke-'));
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

describe('task tree smoke', () => {
  it('reads local manifests into chapter-homework-task nodes', async () => {
    const rootDir = await createTempRoot();
    const productRoot = path.join(rootDir, 'Educoder Local OJ');
    const collectionRoot = path.join(
      productRoot,
      '课程 [ufr7sxlc]',
      '第二章 线性表及应用 [1316861]',
    );
    const vscodeMock = (vscode as any).__mock;

    vscodeMock.globalStateStore.set('rootFolderUri', toRootFolderUri(rootDir));

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

    const provider = vscodeMock.registeredTreeProviders.get('educoderLocalOj.taskTree');
    const chapters = await provider.getChildren();
    const homeworks = await provider.getChildren(chapters[0]);
    const tasks = await provider.getChildren(homeworks[0]);

    expect(provider.getTreeItem(chapters[0])).toMatchObject({
      label: '第二章 线性表及应用',
      description: '数据结构',
    });
    expect(provider.getTreeItem(homeworks[0])).toMatchObject({
      label: '2-2 基本实训-链表操作',
    });
    expect(provider.getTreeItem(tasks[0])).toMatchObject({
      label: '第1关 基本实训：链表操作',
      command: expect.objectContaining({
        command: 'educoderLocalOj.openTask',
        title: '打开题目',
      }),
    });
    expect(String(provider.getTreeItem(chapters[0]).label)).not.toContain('[');
    expect(String(provider.getTreeItem(homeworks[0]).label)).not.toContain('[');
    expect(String(provider.getTreeItem(tasks[0]).label)).not.toContain('[');
  });
});
