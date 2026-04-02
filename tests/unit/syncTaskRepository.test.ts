import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { syncTaskRepository } from '../../src/commands/syncTaskRepository.js';

const tempDirs: string[] = [];

async function createTempTaskRoot(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'educoder-sync-repository-'));
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

describe('syncTaskRepository', () => {
  it('pulls the full remote repository into _educoder/repository/remote and updates metadata', async () => {
    const taskRoot = await createTempTaskRoot();
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
      myshixunIdentifier: 'obcts7i5fx',
      tasks: [],
    });
    await writeJson(path.join(taskRoot, '_educoder', 'meta', 'task.json'), {
      myshixunIdentifier: 'obcts7i5fx',
    });

    const repositoryClient = {
      collectRepositoryTree: vi.fn(async () => [
        { path: 'test1', name: 'test1', type: 'tree' as const },
        { path: 'test1/tasks.h', name: 'tasks.h', type: 'blob' as const },
      ]),
    };
    const sourceClient = {
      fetchSourceFiles: vi.fn(async () => [{ path: 'test1/tasks.h', content: '#pragma once\n' }]),
    };

    await syncTaskRepository(taskRoot, { repositoryClient, sourceClient });

    expect(repositoryClient.collectRepositoryTree).toHaveBeenCalledWith({
      myshixunIdentifier: 'obcts7i5fx',
      rootPath: '',
    });
    expect(sourceClient.fetchSourceFiles).toHaveBeenCalledWith({
      taskId: 'fc7pz3fm6yjh',
      homeworkId: '3727439',
      filePaths: ['test1/tasks.h'],
    });
    await expect(
      readFile(path.join(taskRoot, '_educoder', 'repository', 'remote', 'test1', 'tasks.h'), 'utf8'),
    ).resolves.toBe('#pragma once\n');
    await expect(readFile(path.join(taskRoot, '_educoder', 'meta', 'recovery.json'), 'utf8')).resolves.toContain(
      '"repositoryFileCount": 1',
    );
  });
});
