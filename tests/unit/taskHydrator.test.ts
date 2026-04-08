import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnswerFetchClient } from '../../src/core/api/answerFetchClient.js';
import { readRecoveryMetadata, writeRecoveryMetadata } from '../../src/core/recovery/materialStore.js';
import { syncTaskPackageFromRemote } from '../../src/core/sync/taskPackageSync.js';
import { hydrateTask, hydrateTaskFromRemote } from '../../src/core/sync/taskHydrator.js';

const tempDirs: string[] = [];

async function exists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function createTempRoot(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'educoder-hydrate-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('hydrateTask', () => {
  it('creates the visible task package surface, educoder cache, reports, and vscode directories without README/index artifacts', async () => {
    const rootDir = await createTempRoot();

    const layout = await hydrateTask({
      collectionRoot: rootDir,
      homeworkId: '3727439',
      taskId: 'fc7pz3fm6yjh',
      homeworkDirName: '2-2 基本实训-链表操作 [3727439]',
      taskDirName: '01 第1关 基本实训：链表操作 [fc7pz3fm6yjh]',
      templateFiles: [{ path: 'test1/test1.cpp', content: '#include <iostream>\n' }],
      hiddenTests: [{ input: '1 2\n', output: '3\n' }],
    });

    expect(layout.currentCodeDir).toBe(path.join(layout.taskRoot, 'code', 'current'));
    expect(layout.legacyWorkspaceDir).toBe(path.join(layout.taskRoot, 'workspace'));
    expect(layout.allTestsDir).toBe(path.join(layout.taskRoot, 'tests', 'all'));
    expect(layout.hiddenTestsDir).toBe(path.join(layout.taskRoot, '_educoder', 'tests', 'hidden'));
    expect(layout.answersDir).toBe(path.join(layout.taskRoot, 'answers'));
    expect(layout.answerInfoPath).toBe(path.join(layout.taskRoot, '_educoder', 'answers', 'answer_info.json'));
    await expect(exists(layout.workspaceDir)).resolves.toBe(true);
    await expect(access(path.join(layout.taskRoot, 'README.md'))).rejects.toBeDefined();
    await expect(access(path.join(layout.testsDir, 'index.json'))).rejects.toBeDefined();
    await expect(access(path.join(layout.answersDir, 'index.md'))).rejects.toBeDefined();
    await expect(exists(path.join(layout.taskRoot, '_educoder'))).resolves.toBe(true);
    await expect(exists(layout.reportsDir)).resolves.toBe(true);
    await expect(exists(layout.vscodeDir)).resolves.toBe(true);
    await expect(exists(path.join(layout.taskRoot, '_educoder', 'tests', 'hidden'))).resolves.toBe(true);
    await expect(exists(path.join(layout.taskRoot, 'tests', 'hidden'))).resolves.toBe(false);
    await expect(exists(path.join(layout.testsDir, 'visible'))).resolves.toBe(false);
  });

  it('writes the official template into workspace', async () => {
    const rootDir = await createTempRoot();

    const layout = await hydrateTask({
      collectionRoot: rootDir,
      homeworkId: '3727439',
      taskId: 'fc7pz3fm6yjh',
      homeworkDirName: '2-2 基本实训-链表操作 [3727439]',
      taskDirName: '01 第1关 基本实训：链表操作 [fc7pz3fm6yjh]',
      templateFiles: [
        { path: 'test1/tasks.h', content: '#pragma once\n' },
        { path: 'test1/test1.cpp', content: 'int main() { return 0; }\n' },
      ],
      hiddenTests: [],
    });

    await expect(readFile(path.join(layout.currentCodeDir, 'test1', 'test1.cpp'), 'utf8')).resolves.toBe(
      'int main() { return 0; }\n',
    );
    await expect(readFile(path.join(layout.currentCodeDir, 'test1', 'tasks.h'), 'utf8')).resolves.toBe(
      '#pragma once\n',
    );
  });

  it('writes canonical tests, answers, and snapshots without README or index docs', async () => {
    const rootDir = await createTempRoot();

    const layout = await hydrateTask({
      collectionRoot: rootDir,
      homeworkId: '3727439',
      taskId: 'fc7pz3fm6yjh',
      homeworkDirName: '2-2 基本实训-链表操作 [3727439]',
      taskDirName: '01 第1关 基本实训：链表操作 [fc7pz3fm6yjh]',
      templateFiles: [{ path: 'test1/test1.cpp', content: 'template\n' }],
      hiddenTests: [
        { input: 'in-1\n', output: 'out-1\n' },
        { input: 'in-2\n', output: 'out-2\n' },
      ],
      answerFiles: [{ path: 'reference_code.cpp', content: 'answer\n' }],
      unlockedAnswerFiles: [{ path: 'answer-3567559.md', content: '```cpp\nint main() {}\n```' }],
      answerInfo: {
        status: 3,
        entries: [{ answerId: 3567559, name: '解题思路1' }],
      },
      passedFiles: [{ path: 'passed.cpp', content: 'passed\n' }],
      historyFiles: [{ path: 'query_001.cpp', content: 'history\n' }],
      repositoryNodes: [
        { path: 'test1', name: 'test1', type: 'tree' },
        { path: 'test1/test1.cpp', name: 'test1.cpp', type: 'blob' },
      ],
      repositoryFiles: [{ path: 'test1/test1.cpp', content: 'repo snapshot\n' }],
      meta: { taskId: 'fc7pz3fm6yjh' },
    });

    await expect(readFile(path.join(layout.hiddenTestsDir, 'case_001_input.txt'), 'utf8')).resolves.toBe('in-1\n');
    await expect(readFile(path.join(layout.hiddenTestsDir, 'case_002_output.txt'), 'utf8')).resolves.toBe('out-2\n');
    await expect(readFile(path.join(layout.allTestsDir, 'case_001_input.txt'), 'utf8')).resolves.toBe('in-1\n');
    await expect(readFile(path.join(layout.allTestsDir, 'case_002_output.txt'), 'utf8')).resolves.toBe('out-2\n');
    await expect(access(path.join(layout.testsDir, 'index.json'))).rejects.toBeDefined();
    await expect(readFile(layout.answerInfoPath, 'utf8')).resolves.toContain('"status": 3');
    await expect(readFile(path.join(layout.answersDir, 'reference_code.cpp'), 'utf8')).resolves.toBe('answer\n');
    await expect(readFile(path.join(layout.answersDir, 'answer-3567559.md'), 'utf8')).resolves.toContain('int main');
    await expect(access(path.join(layout.answersDir, 'unlocked'))).rejects.toBeDefined();
    await expect(readFile(path.join(layout.templateCodeDir, 'test1', 'test1.cpp'), 'utf8')).resolves.toBe('template\n');
    await expect(readFile(path.join(layout.passedCodeDir, 'passed.cpp'), 'utf8')).resolves.toBe('passed\n');
    await expect(readFile(path.join(layout.historyDir, 'query_001.cpp'), 'utf8')).resolves.toBe('history\n');
    await expect(
      readFile(path.join(layout.repositoryRemoteDir, 'test1', 'test1.cpp'), 'utf8'),
    ).resolves.toBe('repo snapshot\n');
    await expect(readFile(path.join(layout.repositoryDir, 'index.json'), 'utf8')).resolves.toContain('"fileCount": 1');
    await expect(readFile(path.join(layout.metaDir, 'task.json'), 'utf8')).resolves.toContain('"taskId": "fc7pz3fm6yjh"');
    await expect(access(path.join(layout.taskRoot, 'README.md'))).rejects.toBeDefined();
    await expect(access(path.join(layout.answersDir, 'index.md'))).rejects.toBeDefined();
    await expect(readFile(path.join(layout.metaDir, 'recovery.json'), 'utf8')).resolves.toContain('"templateReady": true');
    await expect(readFile(path.join(layout.metaDir, 'recovery.json'), 'utf8')).resolves.toContain('"passedReady": true');
    await expect(readFile(path.join(layout.metaDir, 'recovery.json'), 'utf8')).resolves.toContain('"answerEntryCount": 1');
    await expect(readFile(path.join(layout.metaDir, 'recovery.json'), 'utf8')).resolves.toContain('"unlockedAnswerCount": 1');
    await expect(readFile(path.join(layout.metaDir, 'recovery.json'), 'utf8')).resolves.toContain('"repositoryFileCount": 1');
    await expect(readFile(path.join(layout.metaDir, 'recovery.json'), 'utf8')).resolves.toContain('"historyFileCount": 1');
  });

  it('hydrates workspace files and task metadata from remote task/source/hidden clients', async () => {
    const rootDir = await createTempRoot();

    const result = await hydrateTaskFromRemote({
      collectionRoot: rootDir,
      homeworkId: '3727439',
      taskId: 'fc7pz3fm6yjh',
      homeworkDirName: '2-2 基本实训-链表操作 [3727439]',
      taskDirName: '01 第1关 基本实训：链表操作 [fc7pz3fm6yjh]',
      taskDetailClient: {
        getTaskDetail: async () => ({
          taskId: 'fc7pz3fm6yjh',
          homeworkId: '3727439',
          taskName: '基本实训：链表操作',
          problemMaterial: {
            title: '基本实训：链表操作',
            statementMarkdown: '## 题目描述\n给定两个整数，输出它们的和。',
            statementHtml: '<p>给定两个整数，输出它们的和。</p>',
            samples: [{ name: '样例 1', input: '1 2\n', output: '3\n' }],
            raw: { source: 'task-detail' },
          },
          editablePaths: ['test1/tasks.h'],
          testSets: [{ is_public: false, input: '1 2\n', output: '3\n' }],
          raw: {},
        }),
      },
      sourceClient: {
        fetchSourceFiles: async () => [{ path: 'test1/tasks.h', content: 'current workspace\n' }],
      },
      hiddenTestClient: {
        fetchHiddenTests: async () => [{ input: '1 2\n', output: '3\n' }],
      },
      templateClient: {
        fetchTemplateFiles: async () => [{ path: 'test1/tasks.h', content: '#pragma once\n' }],
      },
      passedClient: {
        fetchPassedFiles: async () => [{ path: 'test1/tasks.h', content: 'passed solution\n' }],
      },
      answerClient: {
        fetchAnswerInfo: async () => ({
          status: 3,
          entries: [{ answerId: 3567559, name: '解题思路1', content: '```cpp\nint main() {}\n```' }],
        }),
        unlockAnswer: async () => ({
          answerId: 3567559,
          content: '```cpp\nint main() {}\n```',
          unlocked: true,
        }),
      },
    });

    await expect(readFile(path.join(result.layout.currentCodeDir, 'test1', 'tasks.h'), 'utf8')).resolves.toBe(
      'current workspace\n',
    );
    await expect(readFile(path.join(result.layout.templateCodeDir, 'test1', 'tasks.h'), 'utf8')).resolves.toBe(
      '#pragma once\n',
    );
    await expect(readFile(path.join(result.layout.passedCodeDir, 'test1', 'tasks.h'), 'utf8')).resolves.toBe(
      'passed solution\n',
    );
    await expect(readFile(result.layout.answerInfoPath, 'utf8')).resolves.toContain(
      '"answerId": 3567559',
    );
    await expect(readFile(path.join(result.layout.answersDir, 'answer-3567559.md'), 'utf8')).resolves.toContain(
      'int main',
    );
    await expect(readFile(path.join(result.layout.problemDir, 'statement.md'), 'utf8')).resolves.toContain(
      '题目描述',
    );
    await expect(readFile(path.join(result.layout.problemDir, 'statement.html'), 'utf8')).resolves.toContain(
      '给定两个整数',
    );
    await expect(readFile(path.join(result.layout.problemDir, 'metadata.json'), 'utf8')).resolves.toContain(
      '"title": "基本实训：链表操作"',
    );
    await expect(access(path.join(result.layout.taskRoot, 'README.md'))).rejects.toBeDefined();
    await expect(access(path.join(result.layout.testsDir, 'index.json'))).rejects.toBeDefined();
    await expect(access(path.join(result.layout.answersDir, 'index.md'))).rejects.toBeDefined();
    await expect(readFile(path.join(result.layout.metaDir, 'task.json'), 'utf8')).resolves.toContain(
      '"hiddenTestsCount": 1',
    );
    await expect(exists(path.join(result.layout.vscodeDir, 'tasks.json'))).resolves.toBe(true);
    await expect(readFile(path.join(result.layout.vscodeDir, 'settings.json'), 'utf8')).resolves.toContain(
      '"_educoder": true',
    );
    await expect(readFile(path.join(result.layout.vscodeDir, 'settings.json'), 'utf8')).resolves.toContain(
      '".vscode": true',
    );
    await expect(readFile(path.join(result.layout.vscodeDir, 'settings.json'), 'utf8')).resolves.toContain(
      '"code/template": true',
    );
    await expect(readFile(path.join(result.layout.vscodeDir, 'settings.json'), 'utf8')).resolves.toContain(
      '"code/passed": true',
    );
    await expect(readFile(path.join(result.layout.vscodeDir, 'settings.json'), 'utf8')).resolves.toContain(
      '"**/*.manifest.json": true',
    );
    await expect(readFile(path.join(result.layout.vscodeDir, 'settings.json'), 'utf8')).resolves.toContain(
      '"**/metadata.json": true',
    );
    await expect(readFile(path.join(result.layout.vscodeDir, 'tasks.json'), 'utf8')).resolves.not.toContain(
      'Workspace',
    );
    await expect(readFile(path.join(result.layout.vscodeDir, 'launch.json'), 'utf8')).resolves.not.toContain(
      'Workspace',
    );
    await expect(readFile(path.join(result.layout.metaDir, 'recovery.json'), 'utf8')).resolves.toContain(
      '"templateReady": true',
    );
    await expect(readFile(path.join(result.layout.metaDir, 'recovery.json'), 'utf8')).resolves.toContain(
      '"passedReady": true',
    );
  });

  it('hydrates a buildable current code tree by overlaying editable files onto the full repository snapshot', async () => {
    const rootDir = await createTempRoot();
    const sourceClient = {
      fetchSourceFiles: vi.fn(async (input: { filePaths: string[] }) => {
        if (input.filePaths.length === 1 && input.filePaths[0] === 'src/病毒检测.cpp') {
          return [{ path: 'src/病毒检测.cpp', content: '#include "BF匹配算法.h"\nint run() { return 1; }\n' }];
        }

        return [
          { path: 'src/病毒检测.cpp', content: '#include "BF匹配算法.h"\nint run() { return 0; }\n' },
          { path: 'src/BF匹配算法.h', content: '#pragma once\nint run();\n' },
          { path: 'src/main.cpp', content: '#include <iostream>\nint run();\nint main(){ return run(); }\n' },
        ];
      }),
    };
    const repositoryClient = {
      collectRepositoryTree: vi.fn(async () => [
        { path: 'src', name: 'src', type: 'tree' as const },
        { path: 'src/病毒检测.cpp', name: '病毒检测.cpp', type: 'blob' as const },
        { path: 'src/BF匹配算法.h', name: 'BF匹配算法.h', type: 'blob' as const },
        { path: 'src/main.cpp', name: 'main.cpp', type: 'blob' as const },
      ]),
    };

    const result = await hydrateTaskFromRemote({
      collectionRoot: rootDir,
      homeworkId: '3727439',
      taskId: 'fc7pz3fm6yjh',
      homeworkDirName: '2-2 基本实训-链表操作 [3727439]',
      taskDirName: '01 第1关 基本实训：链表操作 [fc7pz3fm6yjh]',
      taskDetailClient: {
        getTaskDetail: async () => ({
          taskId: 'fc7pz3fm6yjh',
          homeworkId: '3727439',
          taskName: '病毒检测',
          myshixunIdentifier: 'obcts7i5fx',
          editablePaths: ['src/病毒检测.cpp'],
          testSets: [{ is_public: false, input: '1\n', output: '1\n' }],
          raw: {},
        }),
      },
      sourceClient,
      hiddenTestClient: {
        fetchHiddenTests: async () => [{ input: '1\n', output: '1\n' }],
      },
      repositoryClient,
    });

    expect(repositoryClient.collectRepositoryTree).toHaveBeenCalledWith({
      myshixunIdentifier: 'obcts7i5fx',
      rootPath: '',
    });
    expect(sourceClient.fetchSourceFiles).toHaveBeenCalledTimes(2);
    await expect(readFile(path.join(result.layout.currentCodeDir, 'src', '病毒检测.cpp'), 'utf8')).resolves.toContain(
      'return 1;',
    );
    await expect(readFile(path.join(result.layout.currentCodeDir, 'src', 'BF匹配算法.h'), 'utf8')).resolves.toContain(
      '#pragma once',
    );
    await expect(readFile(path.join(result.layout.currentCodeDir, 'src', 'main.cpp'), 'utf8')).resolves.toContain(
      'int main()',
    );
    await expect(
      readFile(path.join(result.layout.repositoryRemoteDir, 'src', 'BF匹配算法.h'), 'utf8'),
    ).resolves.toContain('#pragma once');
  });

  it('falls back to fetching the task page snapshot when task detail lacks first-class statement fields', async () => {
    const rootDir = await createTempRoot();

    const result = await hydrateTaskFromRemote({
      collectionRoot: rootDir,
      homeworkId: '3727439',
      taskId: 'fc7pz3fm6yjh',
      homeworkDirName: '2-2 基本实训-链表操作 [3727439]',
      taskDirName: '01 第1关 基本实训：链表操作 [fc7pz3fm6yjh]',
      taskDetailClient: {
        getTaskDetail: async () => ({
          taskId: 'fc7pz3fm6yjh',
          homeworkId: '3727439',
          taskName: '基本实训：链表操作',
          editablePaths: ['test1/tasks.h'],
          testSets: [{ is_public: false, input: '1 2\n', output: '3\n' }],
          raw: {},
        }),
      },
      sourceClient: {
        fetchSourceFiles: async () => [{ path: 'test1/tasks.h', content: 'current workspace\n' }],
      },
      hiddenTestClient: {
        fetchHiddenTests: async () => [{ input: '1 2\n', output: '3\n' }],
      },
      problemClient: {
        fetchProblemMaterial: async () => ({
          title: '基本实训：链表操作',
          statementMarkdown: '## 题目描述\n给定两个整数，输出它们的和。',
          statementHtml: '<p>给定两个整数，输出它们的和。</p>',
          samples: [{ name: '样例 1', input: '1 2\n', output: '3\n' }],
          raw: { source: 'task-page' },
          pageSnapshotHtml: '<html><body>snapshot</body></html>',
        }),
      },
    });

    await expect(readFile(path.join(result.layout.problemDir, 'statement.md'), 'utf8')).resolves.toContain(
      '题目描述',
    );
    await expect(readFile(path.join(result.layout.problemDir, 'page.snapshot.html'), 'utf8')).resolves.toContain(
      'snapshot',
    );
    await expect(readFile(path.join(result.layout.problemDir, 'samples', 'sample-01.input.txt'), 'utf8')).resolves.toBe(
      '1 2\n',
    );
    await expect(readFile(path.join(result.layout.problemDir, 'samples', 'sample-01.output.txt'), 'utf8')).resolves.toBe(
      '3\n',
    );
  });

  it('syncs the full task package and reports material readiness in one pass', async () => {
    const rootDir = await createTempRoot();

    const result = await syncTaskPackageFromRemote({
      collectionRoot: rootDir,
      homeworkId: '3727439',
      taskId: 'fc7pz3fm6yjh',
      homeworkDirName: '2-2 基本实训-链表操作 [3727439]',
      taskDirName: '01 第1关 基本实训：链表操作 [fc7pz3fm6yjh]',
      taskDetailClient: {
        getTaskDetail: async () => ({
          taskId: 'fc7pz3fm6yjh',
          homeworkId: '3727439',
          taskName: '基本实训：链表操作',
          problemMaterial: {
            title: '基本实训：链表操作',
            statementMarkdown: '## 题目描述\n给定两个整数，输出它们的和。',
            statementHtml: '<p>给定两个整数，输出它们的和。</p>',
            samples: [{ name: '样例 1', input: '1 2\n', output: '3\n' }],
            raw: { source: 'task-detail' },
          },
          editablePaths: ['test1/tasks.h'],
          testSets: [{ is_public: false, input: '1 2\n', output: '3\n' }],
          raw: {},
        }),
      },
      sourceClient: {
        fetchSourceFiles: async () => [{ path: 'test1/tasks.h', content: 'current workspace\n' }],
      },
      hiddenTestClient: {
        fetchHiddenTests: async () => [{ input: '1 2\n', output: '3\n' }],
      },
      templateClient: {
        fetchTemplateFiles: async () => [{ path: 'test1/tasks.h', content: '#pragma once\n' }],
      },
      passedClient: {
        fetchPassedFiles: async () => [{ path: 'test1/tasks.h', content: 'passed solution\n' }],
      },
      answerClient: {
        fetchAnswerInfo: async () => ({
          status: 3,
          entries: [{ answerId: 3567559, name: '解题思路1', content: '```cpp\nint main() {}\n```' }],
        }),
        unlockAnswer: async () => ({
          answerId: 3567559,
          content: '```cpp\nint main() {}\n```',
          unlocked: true,
        }),
      },
    });

    expect(result.materials).toEqual({
      statement: 'ready',
      currentCode: 'ready',
      templateCode: 'ready',
      tests: 'ready',
      answers: 'ready',
      metadata: 'ready',
    });
    await expect(readFile(path.join(result.taskRoot, 'problem', 'statement.md'), 'utf8')).resolves.toContain(
      '题目描述',
    );
    await expect(readFile(path.join(result.taskRoot, 'code', 'current', 'test1', 'tasks.h'), 'utf8')).resolves.toBe(
      'current workspace\n',
    );
    await expect(readFile(path.join(result.taskRoot, '_educoder', 'answers', 'answer_info.json'), 'utf8')).resolves.toContain(
      '"answerId": 3567559',
    );
  });

  it('keeps full task package sync alive when answer info returns a non-array message payload', async () => {
    const rootDir = await createTempRoot();

    const result = await syncTaskPackageFromRemote({
      collectionRoot: rootDir,
      homeworkId: '3727439',
      taskId: 'fc7pz3fm6yjh',
      homeworkDirName: '2-2 基本实训-链表操作 [3727439]',
      taskDirName: '01 第1关 基本实训：链表操作 [fc7pz3fm6yjh]',
      taskDetailClient: {
        getTaskDetail: async () => ({
          taskId: 'fc7pz3fm6yjh',
          homeworkId: '3727439',
          taskName: '基本实训：链表操作',
          problemMaterial: {
            title: '基本实训：链表操作',
            statementMarkdown: '## 题目描述\n给定两个整数，输出它们的和。',
            statementHtml: '<p>给定两个整数，输出它们的和。</p>',
            samples: [{ name: '样例 1', input: '1 2\n', output: '3\n' }],
            raw: { source: 'task-detail' },
          },
          editablePaths: ['test1/tasks.h'],
          testSets: [{ is_public: false, input: '1 2\n', output: '3\n' }],
          raw: {},
        }),
      },
      sourceClient: {
        fetchSourceFiles: async () => [{ path: 'test1/tasks.h', content: 'current workspace\n' }],
      },
      hiddenTestClient: {
        fetchHiddenTests: async () => [{ input: '1 2\n', output: '3\n' }],
      },
      templateClient: {
        fetchTemplateFiles: async () => [{ path: 'test1/tasks.h', content: '#pragma once\n' }],
      },
      passedClient: {
        fetchPassedFiles: async () => [{ path: 'test1/tasks.h', content: 'passed solution\n' }],
      },
      answerClient: new AnswerFetchClient({
        get: async <T>(requestPath: string) => {
          if (requestPath.includes('/get_answer_info.json')) {
            return {
              status: 0,
              message: '暂无可解锁答案',
            } as T;
          }

          return {
            contents: '',
          } as T;
        },
      }),
    });

    expect(result.materials).toEqual({
      statement: 'ready',
      currentCode: 'ready',
      templateCode: 'ready',
      tests: 'ready',
      answers: 'missing',
      metadata: 'ready',
    });
    await expect(readFile(path.join(result.taskRoot, 'code', 'current', 'test1', 'tasks.h'), 'utf8')).resolves.toBe(
      'current workspace\n',
    );
    await expect(readFile(path.join(result.taskRoot, '_educoder', 'answers', 'answer_info.json'), 'utf8')).resolves.toContain(
      '"entries": []',
    );
  });

  it('auto-unlocks answer bodies during full sync without generating answer index documents', async () => {
    const rootDir = await createTempRoot();
    const unlockAnswer = vi.fn(async ({ answerId }: { answerId: number }) => ({
      answerId,
      content: `# 解题思路 ${answerId}\n\n\`\`\`cpp\nint main() { return ${answerId}; }\n\`\`\``,
      unlocked: true,
    }));

    const result = await syncTaskPackageFromRemote({
      collectionRoot: rootDir,
      homeworkId: '3727439',
      taskId: 'fc7pz3fm6yjh',
      homeworkDirName: '2-2 基本实训-链表操作 [3727439]',
      taskDirName: '01 第1关 基本实训：链表操作 [fc7pz3fm6yjh]',
      taskDetailClient: {
        getTaskDetail: async () => ({
          taskId: 'fc7pz3fm6yjh',
          homeworkId: '3727439',
          taskName: '基本实训：链表操作',
          problemMaterial: {
            title: '基本实训：链表操作',
            statementMarkdown: '## 题目描述\n给定两个整数，输出它们的和。',
            statementHtml: '<p>给定两个整数，输出它们的和。</p>',
            samples: [{ name: '样例 1', input: '1 2\n', output: '3\n' }],
            raw: { source: 'task-detail' },
          },
          editablePaths: ['test1/tasks.h'],
          testSets: [{ is_public: false, input: '1 2\n', output: '3\n' }],
          raw: {},
        }),
      },
      sourceClient: {
        fetchSourceFiles: async () => [{ path: 'test1/tasks.h', content: 'current workspace\n' }],
      },
      hiddenTestClient: {
        fetchHiddenTests: async () => [{ input: '1 2\n', output: '3\n' }],
      },
      templateClient: {
        fetchTemplateFiles: async () => [{ path: 'test1/tasks.h', content: '#pragma once\n' }],
      },
      passedClient: {
        fetchPassedFiles: async () => [{ path: 'test1/tasks.h', content: 'passed solution\n' }],
      },
      answerClient: {
        fetchAnswerInfo: async () => ({
          status: 3,
          entries: [
            { answerId: 3567559, name: '解题思路1' },
            { answerId: 4000002, name: '解题思路2' },
          ],
        }),
        unlockAnswer,
      },
    });

    expect(result.materials.answers).toBe('ready');
    expect(unlockAnswer).toHaveBeenCalledTimes(2);
    await expect(readFile(path.join(result.taskRoot, 'answers', 'answer-3567559.md'), 'utf8')).resolves.toContain(
      'return 3567559',
    );
    await expect(readFile(path.join(result.taskRoot, 'answers', 'answer-4000002.md'), 'utf8')).resolves.toContain(
      'return 4000002',
    );
    await expect(access(path.join(result.taskRoot, 'answers', 'unlocked'))).rejects.toBeDefined();
    await expect(access(path.join(result.taskRoot, 'answers', 'index.md'))).rejects.toBeDefined();
    await expect(readFile(path.join(result.taskRoot, '_educoder', 'meta', 'recovery.json'), 'utf8')).resolves.toContain(
      '"unlockedAnswerCount": 2',
    );
    await expect(readFile(path.join(result.taskRoot, '_educoder', 'meta', 'recovery.json'), 'utf8')).resolves.toContain(
      '"lastAnswerSyncAt"',
    );
  });

  it('preserves previously synced repository/history recovery metadata during partial rehydration', async () => {
    const rootDir = await createTempRoot();

    const layout = await hydrateTask({
      collectionRoot: rootDir,
      homeworkId: '3727439',
      taskId: 'fc7pz3fm6yjh',
      homeworkDirName: '2-2 基本实训-链表操作 [3727439]',
      taskDirName: '01 第1关 基本实训：链表操作 [fc7pz3fm6yjh]',
      templateFiles: [{ path: 'test1/test1.cpp', content: 'template\n' }],
      hiddenTests: [{ input: '1 2\n', output: '3\n' }],
      historyFiles: [{ path: 'query_001.cpp', content: 'history\n' }],
      repositoryNodes: [{ path: 'test1/test1.cpp', name: 'test1.cpp', type: 'blob' }],
      repositoryFiles: [{ path: 'test1/test1.cpp', content: 'repo snapshot\n' }],
    });

    await writeRecoveryMetadata(layout.taskRoot, {
      ...(await readRecoveryMetadata(layout.taskRoot))!,
      lastRepositorySyncAt: '2026-04-02T00:10:00.000Z',
      updatedAt: '2026-04-02T00:10:00.000Z',
    });

    await hydrateTask({
      collectionRoot: rootDir,
      homeworkId: '3727439',
      taskId: 'fc7pz3fm6yjh',
      homeworkDirName: '2-2 基本实训-链表操作 [3727439]',
      taskDirName: '01 第1关 基本实训：链表操作 [fc7pz3fm6yjh]',
      templateFiles: [{ path: 'test1/test1.cpp', content: 'updated template\n' }],
      hiddenTests: [{ input: '3 4\n', output: '7\n' }],
    });

    await expect(readRecoveryMetadata(layout.taskRoot)).resolves.toMatchObject({
      repositoryReady: true,
      repositoryFileCount: 1,
      historyReady: true,
      historyFileCount: 1,
      lastRepositorySyncAt: '2026-04-02T00:10:00.000Z',
    });
  });
});
