import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { openTaskCommand } from '../../src/commands/openTask.js';
import { resolveTaskPackagePaths } from '../../src/core/workspace/taskPackageMigration.js';

const tempDirs: string[] = [];

async function createTempTaskRoot(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'educoder-open-task-command-'));
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

describe('openTaskCommand', () => {
  it('reports the opened task root so the extension can remember the last opened task', async () => {
    const taskRoot = await createTempTaskRoot();
    const onTaskOpened = vi.fn(async () => undefined);
    const openPanel = vi.fn();

    await writeJson(path.join(taskRoot, 'task.manifest.json'), {
      taskId: 'fc7pz3fm6yjh',
      name: '第1关 基本实训：链表操作',
      position: 1,
      folderName: '01 第1关 基本实训：链表操作 [fc7pz3fm6yjh]',
    });
    await writeJson(path.join(taskRoot, '_educoder', 'meta', 'task.json'), {
      taskId: 'fc7pz3fm6yjh',
      homeworkId: '3727439',
      editablePaths: ['src/main.cpp'],
    });
    await import('node:fs/promises').then(({ mkdir }) =>
      Promise.all([
        mkdir(path.join(taskRoot, 'problem'), { recursive: true }),
        mkdir(path.join(taskRoot, 'code', 'current', 'src'), { recursive: true }),
        mkdir(path.join(taskRoot, 'tests', 'all'), { recursive: true }),
      ]),
    );
    await Promise.all([
      writeFile(path.join(taskRoot, 'problem', 'statement.md'), '# 题面\n', 'utf8'),
      writeFile(path.join(taskRoot, 'code', 'current', 'src', 'main.cpp'), 'int main() { return 0; }\n', 'utf8'),
      writeFile(path.join(taskRoot, 'tests', 'all', 'case_001_input.txt'), '1 2\n', 'utf8'),
      writeFile(path.join(taskRoot, 'tests', 'all', 'case_001_output.txt'), '3\n', 'utf8'),
    ]);

    await openTaskCommand(taskRoot, {
      revealInExplorer: vi.fn(async () => undefined),
      onTaskOpened,
      openPanel,
    } as any);

    expect(onTaskOpened).toHaveBeenCalledWith(taskRoot);
    expect(openPanel).not.toHaveBeenCalled();
  });

  it('backfills statement and answers in open mode while leaving template/passed to full sync', async () => {
    const taskRoot = await createTempTaskRoot();
    const collectionRoot = path.join(
      taskRoot,
      '..',
      '..',
      '..',
      '..',
    );

    await writeJson(path.join(collectionRoot, 'collection.manifest.json'), {
      courseId: 'ufr7sxlc',
      courseName: '课程',
      courseFolderName: '课程 [ufr7sxlc]',
      categoryId: '1316861',
      categoryName: '第二章 线性表及应用',
      categoryFolderName: '第二章 线性表及应用 [1316861]',
      homeworks: [],
    });
    await writeJson(path.join(taskRoot, '..', '..', 'homework.manifest.json'), {
      homeworkId: '3727439',
      name: '2-2 基本实训-链表操作',
      folderName: '2-2 基本实训-链表操作 [3727439]',
      shixunIdentifier: 'a9k8ufmh',
      tasks: [],
    });
    await writeJson(path.join(taskRoot, 'task.manifest.json'), {
      taskId: 'fc7pz3fm6yjh',
      name: '第1关 基本实训：链表操作',
      position: 1,
      folderName: '01 第1关 基本实训：链表操作 [fc7pz3fm6yjh]',
    });

    await import('node:fs/promises').then(({ mkdir }) =>
      Promise.all([
        mkdir(path.join(taskRoot, 'workspace', 'test1'), { recursive: true }),
        mkdir(path.join(taskRoot, '_educoder', 'tests', 'hidden'), { recursive: true }),
      ]),
    );
    await writeFile(path.join(taskRoot, 'workspace', 'test1', 'tasks.h'), 'current\n', 'utf8');
    await writeFile(path.join(taskRoot, '_educoder', 'tests', 'hidden', 'case_001_input.txt'), '1 2\n', 'utf8');
    await writeFile(path.join(taskRoot, '_educoder', 'tests', 'hidden', 'case_001_output.txt'), '3\n', 'utf8');

    await expect(resolveTaskPackagePaths(taskRoot)).resolves.toMatchObject({
      currentCodeDir: path.join(taskRoot, 'workspace'),
      currentCodeSource: 'legacy',
      hiddenTestsDir: path.join(taskRoot, '_educoder', 'tests', 'hidden'),
      hiddenTestsSource: 'canonical',
    });

    const taskDetailClient = {
      getTaskDetail: vi.fn(async () => ({
        taskId: 'fc7pz3fm6yjh',
        homeworkId: '3727439',
        taskName: '第1关 基本实训：链表操作',
        problemMaterial: {
          title: '第1关 基本实训：链表操作',
          statementMarkdown: '# 题面\n给定两个整数，输出它们的和。\n',
          statementHtml: '<p>给定两个整数，输出它们的和。</p>',
          samples: [{ name: '样例 1', input: '1 2\n', output: '3\n' }],
          raw: { source: 'task-detail' },
        },
        editablePaths: ['test1/tasks.h'],
        testSets: [{ is_public: false, input: '1 2\n', output: '3\n' }],
        raw: {},
      })),
    };
    const sourceClient = {
      fetchSourceFiles: vi.fn(async () => [{ path: 'test1/tasks.h', content: 'current\n' }]),
    };
    const hiddenTestClient = {
      fetchHiddenTests: vi.fn(async () => [{ input: '1 2\n', output: '3\n' }]),
    };
    const templateClient = {
      fetchTemplateFiles: vi.fn(async () => [{ path: 'test1/tasks.h', content: '#pragma once\n' }]),
    };
    const passedClient = {
      fetchPassedFiles: vi.fn(async () => [{ path: 'test1/tasks.h', content: 'accepted\n' }]),
    };
    const answerClient = {
      fetchAnswerInfo: vi.fn(async () => ({
        status: 3,
        entries: [{ answerId: 3567559, name: '解题思路1' }],
      })),
      unlockAnswer: vi.fn(async () => ({
        answerId: 3567559,
        content: '```cpp\nint main() { return 0; }\n```',
        unlocked: true,
      })),
    };

    await openTaskCommand(taskRoot, {
      taskDetailClient,
      sourceClient,
      hiddenTestClient,
      templateClient,
      passedClient,
      answerClient,
    });

    expect(taskDetailClient.getTaskDetail).toHaveBeenCalledTimes(1);
    expect(templateClient.fetchTemplateFiles).not.toHaveBeenCalled();
    expect(passedClient.fetchPassedFiles).not.toHaveBeenCalled();
    expect(answerClient.fetchAnswerInfo).toHaveBeenCalledWith({ taskId: 'fc7pz3fm6yjh' });
    expect(answerClient.unlockAnswer).toHaveBeenCalledWith({
      taskId: 'fc7pz3fm6yjh',
      answerId: 3567559,
    });
    await expect(
      readFile(path.join(taskRoot, '_educoder', 'meta', 'task.json'), 'utf8'),
    ).resolves.toContain('"taskId": "fc7pz3fm6yjh"');
    await expect(readFile(path.join(taskRoot, 'problem', 'statement.md'), 'utf8')).resolves.toContain('# 题面');
    await expect(
      readFile(path.join(taskRoot, 'code', 'template', 'test1', 'tasks.h'), 'utf8'),
    ).rejects.toThrow();
    await expect(readFile(path.join(taskRoot, '_educoder', 'answers', 'answer_info.json'), 'utf8')).resolves.toContain(
      '"answerId": 3567559',
    );
    await expect(readFile(path.join(taskRoot, 'answers', 'index.md'), 'utf8')).rejects.toThrow();
    await expect(readFile(path.join(taskRoot, 'answers', 'answer-3567559.md'), 'utf8')).resolves.toContain('int main');
  });

  it('re-hydrates when only statement and answers are missing from an otherwise openable package', async () => {
    const taskRoot = await createTempTaskRoot();
    const collectionRoot = path.join(taskRoot, '..', '..', '..', '..');

    await writeJson(path.join(collectionRoot, 'collection.manifest.json'), {
      courseId: 'ufr7sxlc',
      courseName: '课程',
      courseFolderName: '课程 [ufr7sxlc]',
      categoryId: '1316861',
      categoryName: '第二章 线性表及应用',
      categoryFolderName: '第二章 线性表及应用 [1316861]',
      homeworks: [],
    });
    await writeJson(path.join(taskRoot, '..', '..', 'homework.manifest.json'), {
      homeworkId: '3727439',
      name: '2-2 基本实训-链表操作',
      folderName: '2-2 基本实训-链表操作 [3727439]',
      shixunIdentifier: 'a9k8ufmh',
      tasks: [],
    });
    await writeJson(path.join(taskRoot, 'task.manifest.json'), {
      taskId: 'fc7pz3fm6yjh',
      name: '第1关 基本实训：链表操作',
      position: 1,
      folderName: '01 第1关 基本实训：链表操作 [fc7pz3fm6yjh]',
    });

    await import('node:fs/promises').then(({ mkdir }) =>
      Promise.all([
        mkdir(path.join(taskRoot, 'code', 'current', 'test1'), { recursive: true }),
        mkdir(path.join(taskRoot, 'tests', 'hidden'), { recursive: true }),
        mkdir(path.join(taskRoot, '_educoder', 'meta'), { recursive: true }),
      ]),
    );
    await Promise.all([
      writeFile(path.join(taskRoot, 'code', 'current', 'test1', 'tasks.h'), 'current\n', 'utf8'),
      writeFile(path.join(taskRoot, 'tests', 'hidden', 'case_001_input.txt'), '1 2\n', 'utf8'),
      writeFile(path.join(taskRoot, 'tests', 'hidden', 'case_001_output.txt'), '3\n', 'utf8'),
      writeFile(
        path.join(taskRoot, '_educoder', 'meta', 'task.json'),
        JSON.stringify({
          taskId: 'fc7pz3fm6yjh',
          homeworkId: '3727439',
          editablePaths: ['test1/tasks.h'],
        }),
        'utf8',
      ),
    ]);

    const taskDetailClient = {
      getTaskDetail: vi.fn(async () => ({
        taskId: 'fc7pz3fm6yjh',
        homeworkId: '3727439',
        taskName: '第1关 基本实训：链表操作',
        problemMaterial: {
          title: '第1关 基本实训：链表操作',
          statementMarkdown: '# 题面\n重新补齐题面。\n',
          statementHtml: '<p>重新补齐题面。</p>',
          samples: [{ name: '样例 1', input: '1 2\n', output: '3\n' }],
          raw: { source: 'task-detail' },
        },
        editablePaths: ['test1/tasks.h'],
        testSets: [{ is_public: false, input: '1 2\n', output: '3\n' }],
        raw: {},
      })),
    };
    const sourceClient = {
      fetchSourceFiles: vi.fn(async () => [{ path: 'test1/tasks.h', content: 'current\n' }]),
    };
    const hiddenTestClient = {
      fetchHiddenTests: vi.fn(async () => [{ input: '1 2\n', output: '3\n' }]),
    };
    const answerClient = {
      fetchAnswerInfo: vi.fn(async () => ({
        status: 3,
        entries: [{ answerId: 9, name: '补齐答案' }],
      })),
      unlockAnswer: vi.fn(async () => ({
        answerId: 9,
        content: 'answer body\n',
        unlocked: true,
      })),
    };

    await openTaskCommand(taskRoot, {
      taskDetailClient,
      sourceClient,
      hiddenTestClient,
      answerClient,
    });

    expect(taskDetailClient.getTaskDetail).toHaveBeenCalledTimes(1);
    expect(answerClient.fetchAnswerInfo).toHaveBeenCalledWith({ taskId: 'fc7pz3fm6yjh' });
    await expect(readFile(path.join(taskRoot, 'problem', 'statement.md'), 'utf8')).resolves.toContain(
      '重新补齐题面',
    );
    await expect(readFile(path.join(taskRoot, 'answers', 'index.md'), 'utf8')).rejects.toThrow();
    await expect(readFile(path.join(taskRoot, '_educoder', 'answers', 'answer_info.json'), 'utf8')).resolves.toContain(
      '"answerId": 9',
    );
    await expect(readFile(path.join(taskRoot, 'answers', 'answer-9.md'), 'utf8')).resolves.toContain('answer body');
  });

  it('migrates legacy workspace tests and answers forward without deleting the original legacy files', async () => {
    const taskRoot = await createTempTaskRoot();
    await writeJson(path.join(taskRoot, 'task.manifest.json'), {
      taskId: 'fc7pz3fm6yjh',
      name: '第1关 基本实训：链表操作',
      position: 1,
      folderName: '01 第1关 基本实训：链表操作 [fc7pz3fm6yjh]',
    });
    await writeJson(path.join(taskRoot, '_educoder', 'meta', 'task.json'), {
      taskId: 'fc7pz3fm6yjh',
      homeworkId: '3727439',
      myshixunIdentifier: 'obcts7i5fx',
      userLogin: 'mbzfstnkj',
    });

    await import('node:fs/promises').then(({ mkdir }) =>
      Promise.all([
        mkdir(path.join(taskRoot, 'workspace', 'test1'), { recursive: true }),
        mkdir(path.join(taskRoot, '_educoder', 'tests', 'hidden'), { recursive: true }),
        mkdir(path.join(taskRoot, '_educoder', 'answer', 'unlocked'), { recursive: true }),
      ]),
    );

    await Promise.all([
      writeFile(path.join(taskRoot, 'workspace', 'test1', 'tasks.h'), 'legacy current\n', 'utf8'),
      writeFile(path.join(taskRoot, '_educoder', 'tests', 'hidden', 'case_001_input.txt'), '1 2\n', 'utf8'),
      writeFile(path.join(taskRoot, '_educoder', 'tests', 'hidden', 'case_001_output.txt'), '3\n', 'utf8'),
      writeFile(
        path.join(taskRoot, '_educoder', 'answer', 'answer_info.json'),
        JSON.stringify({ status: 3, entries: [{ answerId: 1, name: '旧答案' }] }, null, 2),
        'utf8',
      ),
      writeFile(path.join(taskRoot, '_educoder', 'answer', 'unlocked', 'answer-1.md'), 'legacy answer\n', 'utf8'),
    ]);

    const model = await openTaskCommand(taskRoot);

    expect(model).toMatchObject({
      readiness: 'local_ready',
      hiddenTestsCached: true,
      materials: {
        currentCode: 'ready',
        tests: 'ready',
        answers: 'ready',
      },
    });
    await expect(readFile(path.join(taskRoot, 'code', 'current', 'test1', 'tasks.h'), 'utf8')).resolves.toBe(
      'legacy current\n',
    );
    await expect(
      readFile(path.join(taskRoot, 'tests', 'hidden', 'case_001_input.txt'), 'utf8'),
    ).resolves.toBe('1 2\n');
    await expect(
      readFile(path.join(taskRoot, 'tests', 'all', 'case_001_output.txt'), 'utf8'),
    ).resolves.toBe('3\n');
    await expect(readFile(path.join(taskRoot, 'answers', 'answer-1.md'), 'utf8')).resolves.toBe('legacy answer\n');
    await expect(
      readFile(path.join(taskRoot, '_educoder', 'answers', 'answer_info.json'), 'utf8'),
    ).resolves.toContain('"answerId": 1');
    await expect(readFile(path.join(taskRoot, 'workspace', 'test1', 'tasks.h'), 'utf8')).resolves.toBe(
      'legacy current\n',
    );
    await expect(
      readFile(path.join(taskRoot, '_educoder', 'tests', 'hidden', 'case_001_output.txt'), 'utf8'),
    ).resolves.toBe('3\n');
    await expect(
      readFile(path.join(taskRoot, '_educoder', 'answer', 'unlocked', 'answer-1.md'), 'utf8'),
    ).resolves.toBe('legacy answer\n');
  });

  it('opens the real statement and preferred current code file, then reveals the current code in Explorer', async () => {
    const taskRoot = await createTempTaskRoot();
    const vscodeMock = (vscode as any).__mock;
    const revealInExplorer = vi.fn(async () => undefined);
    const statementPath = path.join(taskRoot, 'problem', 'statement.md');
    const currentCodePath = path.join(taskRoot, 'code', 'current', 'src', 'main.cpp');

    await writeJson(path.join(taskRoot, 'task.manifest.json'), {
      taskId: 'fc7pz3fm6yjh',
      name: '第1关 基本实训：链表操作',
      position: 1,
      folderName: '01 第1关 基本实训：链表操作 [fc7pz3fm6yjh]',
    });
    await writeJson(path.join(taskRoot, '_educoder', 'meta', 'task.json'), {
      taskId: 'fc7pz3fm6yjh',
      homeworkId: '3727439',
      myshixunIdentifier: 'obcts7i5fx',
      userLogin: 'mbzfstnkj',
    });
    await import('node:fs/promises').then(({ mkdir }) =>
      Promise.all([
        mkdir(path.dirname(statementPath), { recursive: true }),
        mkdir(path.dirname(currentCodePath), { recursive: true }),
        mkdir(path.join(taskRoot, 'tests', 'hidden'), { recursive: true }),
      ]),
    );
    await Promise.all([
      writeFile(statementPath, '# 题面\n', 'utf8'),
      writeFile(currentCodePath, 'legacy current\n', 'utf8'),
      writeFile(
        path.join(taskRoot, '_educoder', 'meta', 'task.json'),
        JSON.stringify({
          taskId: 'fc7pz3fm6yjh',
          homeworkId: '3727439',
          myshixunIdentifier: 'obcts7i5fx',
          userLogin: 'mbzfstnkj',
          editablePaths: ['src/main.cpp'],
        }),
        'utf8',
      ),
      writeFile(path.join(taskRoot, 'tests', 'hidden', 'case_001_input.txt'), '1 2\n', 'utf8'),
      writeFile(path.join(taskRoot, 'tests', 'hidden', 'case_001_output.txt'), '3\n', 'utf8'),
    ]);

    const model = await openTaskCommand(taskRoot, {
      revealInExplorer,
    });

    expect(model.readiness).toBe('local_ready');
    expect(vscodeMock.executeCommand).toHaveBeenCalledWith(
      'markdown.showPreview',
      expect.objectContaining({ fsPath: statementPath }),
    );
    expect(vscodeMock.openTextDocument).toHaveBeenCalledWith(
      expect.objectContaining({ fsPath: currentCodePath }),
    );
    expect(revealInExplorer).toHaveBeenCalledWith(currentCodePath);
  });
});
