import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import * as vscode from 'vscode';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openTaskCommand } from '../../src/commands/openTask.js';

const tempDirs: string[] = [];

async function createTempTaskRoot(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'educoder-dashboard-'));
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

describe('dashboard panel smoke', () => {
  it('keeps task opening editor-first and does not open a duplicate dashboard panel', async () => {
    const taskRoot = await createTempTaskRoot();
    const statementPath = path.join(taskRoot, 'problem', 'statement.md');
    const currentCodePath = path.join(taskRoot, 'code', 'current', 'test1', 'test1.cpp');
    const vscodeMock = (vscode as any).__mock;
    const revealInExplorer = vi.fn(async () => {
      throw new Error('explorer unavailable');
    });

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
    await writeJson(path.join(taskRoot, '..', '..', '..', '..', 'collection.manifest.json'), {
      courseId: 'ufr7sxlc',
      courseFolderName: '课程 [ufr7sxlc]',
      categoryId: '1316861',
      categoryFolderName: '第二章 线性表及应用 [1316861]',
      homeworks: [],
    });
    await writeJson(path.join(taskRoot, '_educoder', 'history', 'index.json'), {
      filePath: 'test1/tasks.h',
      evaluations: [{ queryIndex: 14, createdAt: '2026-03-31T16:09:26.000+08:00' }],
      redoLogs: [],
      updatedAt: '2026-04-02T00:00:00.000Z',
    });

    await openTaskCommand(taskRoot, {
      taskDetailClient: {
        getTaskDetail: async () => ({
          taskId: 'fc7pz3fm6yjh',
          homeworkId: '3727439',
          taskName: '第1关 基本实训：链表操作',
          problemMaterial: {
            title: '第1关 基本实训：链表操作',
            statementMarkdown: '# 题面\n给定两个整数，输出它们的和。\n',
            statementHtml: '<p>给定两个整数，输出它们的和。</p>',
            samples: [{ name: '样例 1', input: '1 2\n', output: '3\n' }],
            raw: {},
          },
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
      templateClient: {
        fetchTemplateFiles: async () => [{ path: 'test1/test1.cpp', content: '#include <iostream>\n' }],
      },
      passedClient: {
        fetchPassedFiles: async () => [{ path: 'test1/test1.cpp', content: 'accepted\n' }],
      },
      answerClient: {
        fetchAnswerInfo: async () => ({
          status: 3,
          entries: [{ answerId: 3567559, name: '解题思路1' }],
        }),
        unlockAnswer: async () => ({
          answerId: 3567559,
          content: '```cpp\nint main() { return 0; }\n```',
          unlocked: true,
        }),
      },
      revealInExplorer,
    } as any);

    expect(vscodeMock.createdPanels).toHaveLength(0);
    expect(vscodeMock.executeCommand).toHaveBeenCalledWith(
      'markdown.showPreview',
      expect.objectContaining({ fsPath: statementPath }),
    );
    expect(vscodeMock.openTextDocument).toHaveBeenCalledWith(
      expect.objectContaining({ fsPath: currentCodePath }),
    );
    expect(revealInExplorer).toHaveBeenCalledWith(currentCodePath);
    expect(vscodeMock.showTextDocument).toHaveBeenCalledTimes(1);
  });
});
