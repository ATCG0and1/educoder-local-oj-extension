import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { rollbackTemplate } from '../../src/commands/rollbackTemplate.js';

const tempDirs: string[] = [];

async function createTempTaskRoot(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'educoder-rollback-template-'));
  tempDirs.push(dir);
  return path.join(
    dir,
    '课程 [ufr7sxlc]',
    '第二章 线性表及应用 [1316861]',
    'homeworks',
    '2-2 基本实训-链表操作 [3727439]',
    'tasks',
    '01 第1关 基本实训：链表操作 [fc7pz3fm6yjh]',
  );
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await import('node:fs/promises').then(({ mkdir }) => mkdir(path.dirname(filePath), { recursive: true }));
  await writeFile(filePath, JSON.stringify(value, null, 2), 'utf8');
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('rollbackTemplate', () => {
  it('fetches the remote template snapshot when local template cache is missing', async () => {
    const taskRoot = await createTempTaskRoot();
    const fetchTemplateFiles = vi.fn(async () => [{ path: 'test1/tasks.h', content: '#pragma once\n' }]);

    await writeJson(path.join(taskRoot, 'task.manifest.json'), {
      taskId: 'fc7pz3fm6yjh',
      name: '第1关 基本实训：链表操作',
      position: 1,
      folderName: '01 第1关 基本实训：链表操作 [fc7pz3fm6yjh]',
    });
    await writeJson(path.join(taskRoot, '..', '..', 'homework.manifest.json'), {
      homeworkId: '3727439',
      name: '2-2 基本实训-链表操作',
      folderName: '2-2 基本实训-链表操作 [3727439]',
      shixunIdentifier: 'a9k8ufmh',
      tasks: [],
    });

    await rollbackTemplate(taskRoot, {
      taskDetailClient: {
        getTaskDetail: async () => ({
          taskId: 'fc7pz3fm6yjh',
          homeworkId: '3727439',
          taskName: '基本实训：链表操作',
          editablePaths: ['test1/tasks.h'],
          testSets: [],
          raw: {},
        }),
      },
      templateClient: {
        fetchTemplateFiles,
      },
    });

    expect(fetchTemplateFiles).toHaveBeenCalledWith({
      taskId: 'fc7pz3fm6yjh',
      homeworkId: '3727439',
      filePaths: ['test1/tasks.h'],
    });
    await expect(readFile(path.join(taskRoot, '_educoder', 'template', 'test1', 'tasks.h'), 'utf8')).resolves.toBe(
      '#pragma once\n',
    );
    await expect(readFile(path.join(taskRoot, 'workspace', 'test1', 'tasks.h'), 'utf8')).resolves.toBe(
      '#pragma once\n',
    );
  });

  it('prefers the local template snapshot when it already exists', async () => {
    const taskRoot = await createTempTaskRoot();
    const fetchTemplateFiles = vi.fn(async () => [{ path: 'test1/tasks.h', content: 'remote\n' }]);

    await import('node:fs/promises').then(({ mkdir }) =>
      mkdir(path.join(taskRoot, '_educoder', 'template', 'test1'), { recursive: true }),
    );
    await writeFile(path.join(taskRoot, '_educoder', 'template', 'test1', 'tasks.h'), 'cached\n', 'utf8');

    await rollbackTemplate(taskRoot, {
      taskDetailClient: {
        getTaskDetail: async () => ({
          taskId: 'fc7pz3fm6yjh',
          homeworkId: '3727439',
          taskName: '基本实训：链表操作',
          editablePaths: ['test1/tasks.h'],
          testSets: [],
          raw: {},
        }),
      },
      templateClient: {
        fetchTemplateFiles,
      },
    });

    expect(fetchTemplateFiles).not.toHaveBeenCalled();
    await expect(readFile(path.join(taskRoot, 'workspace', 'test1', 'tasks.h'), 'utf8')).resolves.toBe(
      'cached\n',
    );
  });
});
