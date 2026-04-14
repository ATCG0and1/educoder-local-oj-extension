import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import * as vscode from 'vscode';
import { afterEach, describe, expect, it } from 'vitest';
import { openTaskCommand } from '../../src/commands/openTask.js';
import { runLocalJudge } from '../../src/core/judge/localRunner.js';
import { submitTaskCommand } from '../../src/commands/submitTask.js';
import { syncTaskPackageCommand } from '../../src/commands/syncTaskPackage.js';
import {
  syncCurrentCollection,
  type SyncCurrentCollectionResult,
} from '../../src/commands/syncCurrentCollection.js';
import { configureCommandService, resetCommandServices } from '../../src/extension.js';
import { ROOT_FOLDER_URI_KEY } from '../../src/core/config/extensionState.js';

const tempDirs: string[] = [];

async function createTempRoot(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'educoder-smoke-'));
  tempDirs.push(dir);
  return dir;
}

function createContext() {
  const store = new Map<string, string>();

  return {
    globalState: {
      get: <T>(key: string) => store.get(key) as T | undefined,
      update: async (key: string, value: string) => {
        store.set(key, value);
      },
    },
  };
}

afterEach(async () => {
  resetCommandServices();
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function acceptPrefilledUrl(options?: { value?: string }): string | undefined {
  return options?.value;
}

describe('sync and open task smoke flow', () => {
  it('syncs a clipboard collection into the product root and opens the hydrated task state', async () => {
    const rootDir = await createTempRoot();
    const context = createContext();

    configureCommandService('educoderLocalOj.syncCurrentCollection', () =>
      syncCurrentCollection({
        context,
        window: {
          showOpenDialog: async () => [{ fsPath: rootDir }],
        },
        clipboardEnv: {
          clipboard: {
            readText: async () =>
              'https://www.educoder.net/classrooms/ufr7sxlc/shixun_homework/1316861?tabs=0',
          },
        },
        input: {
          showInputBox: async (options) => acceptPrefilledUrl(options),
        },
        client: {
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
        },
      }),
    );
    configureCommandService('educoderLocalOj.syncTaskPackage', (taskRoot) =>
      syncTaskPackageCommand(String(taskRoot), {
        taskDetailClient: {
          getTaskDetail: async () => ({
            taskId: 'fc7pz3fm6yjh',
            homeworkId: '3727439',
            taskName: '第1关 基本实训：链表操作',
            problemMaterial: {
              title: '第1关 基本实训：链表操作',
              statementMarkdown: '## 题目描述\n给定两个整数，输出它们的和。',
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
      }),
    );
    configureCommandService('educoderLocalOj.openTask', (taskRoot) =>
      openTaskCommand(String(taskRoot), {
        taskDetailClient: {
          getTaskDetail: async () => ({
            taskId: 'fc7pz3fm6yjh',
            homeworkId: '3727439',
            taskName: '第1关 基本实训：链表操作',
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
      }),
    );
    configureCommandService('educoderLocalOj.runLocalJudge', (taskRoot) =>
      runLocalJudge({
        taskRoot: String(taskRoot),
        compileWorkspace: async ({ workspaceDir }) => ({
          success: true,
          executablePath: path.join(workspaceDir, 'app.exe'),
          stdout: '',
          stderr: '',
        }),
        executeBinary: async ({ input }) => ({
          stdout: input === '1 2\n' ? '3\n' : input,
          stderr: '',
          exitCode: 0,
          timedOut: false,
        }),
      }),
    );
    configureCommandService('educoderLocalOj.submitTask', (taskRoot) =>
      submitTaskCommand(String(taskRoot), {
        runLocalJudge: async () => ({
          source: 'tests/all',
          runMode: 'full',
          compile: {
            verdict: 'compiled',
            stdout: '',
            stderr: '',
            executablePath: path.join(String(taskRoot), 'code', 'current', 'app.exe'),
          },
          caseResults: [],
          summary: {
            total: 1,
            passed: 1,
            failed: 0,
          },
        }),
        runRemoteJudge: async () => ({
          source: 'remote',
          codeHash: 'hash-submit',
          generatedAt: new Date().toISOString(),
          summary: {
            verdict: 'passed',
            score: 100,
            passedCount: 1,
            totalCount: 1,
            message: 'Accepted',
            rawLogPath: path.join(String(taskRoot), '_educoder', 'judge', 'remote_runs', 'latest.json'),
          },
        }),
      }),
    );

    const syncResult = (await vscode.commands.executeCommand(
      'educoderLocalOj.syncCurrentCollection',
    )) as SyncCurrentCollectionResult;

    expect(syncResult.productRoot).toBe(path.join(rootDir, 'Educoder Local OJ'));
    expect(context.globalState.get(ROOT_FOLDER_URI_KEY)).toBeDefined();
    await expect(access(path.join(syncResult.collectionRoot, 'collection.manifest.json'))).resolves.toBeUndefined();

    const taskRoot = syncResult.firstTask?.taskRoot;
    expect(taskRoot).toBeDefined();

    const packageResult = await vscode.commands.executeCommand('educoderLocalOj.syncTaskPackage', taskRoot);
    expect(packageResult).toMatchObject({
      taskRoot,
      materials: {
        statement: 'ready',
        currentCode: 'ready',
        templateCode: 'ready',
        tests: 'ready',
        answers: 'missing',
        metadata: 'ready',
      },
    });
    await expect(access(path.join(String(taskRoot), 'tests', 'all', 'case_001_input.txt'))).resolves.toBeUndefined();

    const taskState = await vscode.commands.executeCommand('educoderLocalOj.openTask', taskRoot);
    expect(taskState).toMatchObject({
      taskId: 'fc7pz3fm6yjh',
      state: '可本地评测',
      hiddenTestsCached: true,
    });

    const localReport = await vscode.commands.executeCommand('educoderLocalOj.runLocalJudge', taskRoot);
    expect(localReport).toMatchObject({
      source: 'tests/all',
      summary: {
        total: 1,
        passed: 1,
        failed: 0,
      },
    });
    await expect(access(path.join(String(taskRoot), '_educoder', 'judge', 'latest_local.json'))).resolves.toBeUndefined();
    await expect(readFile(path.join(String(taskRoot), '_educoder', 'judge', 'latest_local.json'), 'utf8')).resolves.toContain(
      '"source": "tests/all"',
    );

    const refreshedTaskState = await openTaskCommand(String(taskRoot));
    expect(refreshedTaskState).toMatchObject({
      solveState: '本地测试已过',
      localJudge: {
        source: 'tests/all',
        compileVerdict: 'compiled',
        total: 1,
        passed: 1,
        failed: 0,
        headline: '本地已通过 1/1',
      },
    });

    const submitReport = await vscode.commands.executeCommand('educoderLocalOj.submitTask', taskRoot);
    expect(submitReport).toMatchObject({
      decision: 'submitted_after_local_pass',
      local: {
        executed: true,
        passed: true,
      },
      remote: {
        executed: true,
        verdict: 'passed',
        passedCount: 1,
        totalCount: 1,
      },
    });
    await expect(access(path.join(String(taskRoot), '_educoder', 'judge', 'latest_submit.json'))).resolves.toBeUndefined();
  });
});
