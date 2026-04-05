import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
  it('only backfills open essentials and leaves full material sync to syncTaskPackage', async () => {
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
      hiddenTestsSource: 'legacy',
    });

    const taskDetailClient = {
      getTaskDetail: vi.fn(async () => ({
        taskId: 'fc7pz3fm6yjh',
        homeworkId: '3727439',
        taskName: '第1关 基本实训：链表操作',
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
      openPanel: vi.fn(),
    });

    expect(taskDetailClient.getTaskDetail).toHaveBeenCalledTimes(1);
    expect(templateClient.fetchTemplateFiles).not.toHaveBeenCalled();
    expect(passedClient.fetchPassedFiles).not.toHaveBeenCalled();
    expect(answerClient.fetchAnswerInfo).not.toHaveBeenCalled();
    await expect(
      readFile(path.join(taskRoot, '_educoder', 'meta', 'task.json'), 'utf8'),
    ).resolves.toContain('"taskId": "fc7pz3fm6yjh"');
    await expect(
      readFile(path.join(taskRoot, 'code', 'template', 'test1', 'tasks.h'), 'utf8'),
    ).rejects.toThrow();
    await expect(
      readFile(path.join(taskRoot, 'answers', 'answer_info.json'), 'utf8'),
    ).rejects.toThrow();
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

    const model = await openTaskCommand(taskRoot, {
      openPanel: vi.fn(),
    });

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
    await expect(
      readFile(path.join(taskRoot, 'answers', 'unlocked', 'answer-1.md'), 'utf8'),
    ).resolves.toBe('legacy answer\n');
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

  it('reveals the current task root in Explorer without breaking the open flow', async () => {
    const taskRoot = await createTempTaskRoot();
    const revealInExplorer = vi.fn(async () => undefined);

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
      ]),
    );
    await Promise.all([
      writeFile(path.join(taskRoot, 'workspace', 'test1', 'tasks.h'), 'legacy current\n', 'utf8'),
      writeFile(path.join(taskRoot, '_educoder', 'tests', 'hidden', 'case_001_input.txt'), '1 2\n', 'utf8'),
      writeFile(path.join(taskRoot, '_educoder', 'tests', 'hidden', 'case_001_output.txt'), '3\n', 'utf8'),
    ]);

    const model = await openTaskCommand(taskRoot, {
      openPanel: vi.fn(),
      revealInExplorer,
    } as any);

    expect(model.readiness).toBe('local_ready');
    expect(revealInExplorer).toHaveBeenCalledWith(taskRoot);
  });
});
