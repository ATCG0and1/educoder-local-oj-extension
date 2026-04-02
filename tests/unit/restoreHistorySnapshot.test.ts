import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { restoreHistorySnapshot } from '../../src/commands/restoreHistorySnapshot.js';
import { syncTaskHistory } from '../../src/commands/syncTaskHistory.js';

const tempDirs: string[] = [];

async function createTempTaskRoot(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'educoder-restore-history-'));
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

describe('history commands', () => {
  it('syncs history logs and restores a chosen historical snapshot into workspace', async () => {
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
      tasks: [],
    });
    await import('node:fs/promises').then(({ mkdir }) =>
      mkdir(path.join(taskRoot, 'workspace', 'test1'), { recursive: true }),
    );
    await writeFile(path.join(taskRoot, 'workspace', 'test1', 'tasks.h'), 'stale\n', 'utf8');

    const historyClient = {
      fetchHistoryIndex: async () => ({
        filePath: 'test1/tasks.h',
        evaluations: [
          {
            queryIndex: 14,
            createdAt: '2026-03-31T16:09:26.000+08:00',
            outputDetail: '评测通过',
          },
        ],
        redoLogs: [],
        rawEvaluateLogs: { status: 0, data: { count: 1 } },
        rawRedoLogs: { status: 0, data: { count: 0 } },
      }),
      fetchHistorySnapshot: async () => ({
        queryIndex: 14,
        filePath: 'test1/tasks.h',
        content: '#pragma once\n',
        createdAt: '2026-03-31T16:09:26.000+08:00',
        outputDetail: '评测通过',
        raw: {},
      }),
    };

    await syncTaskHistory(taskRoot, { historyClient });
    await restoreHistorySnapshot(taskRoot, 14, { historyClient });

    await expect(readFile(path.join(taskRoot, '_educoder', 'history', 'index.json'), 'utf8')).resolves.toContain(
      '"queryIndex": 14',
    );
    await expect(readFile(path.join(taskRoot, '_educoder', 'history', 'query_014', 'test1', 'tasks.h'), 'utf8')).resolves.toBe(
      '#pragma once\n',
    );
    await expect(readFile(path.join(taskRoot, 'workspace', 'test1', 'tasks.h'), 'utf8')).resolves.toBe(
      '#pragma once\n',
    );
  });
});
