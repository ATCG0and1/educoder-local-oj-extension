import * as vscode from 'vscode';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { syncCollectionPackages } from '../../src/commands/syncCollectionPackages.js';
import { openTaskCommand } from '../../src/commands/openTask.js';
import { runLocalJudgeCommand } from '../../src/commands/runLocalJudge.js';
import { submitTaskCommand } from '../../src/commands/submitTask.js';
import { ROOT_FOLDER_URI_KEY } from '../../src/core/config/extensionState.js';
import { configureCommandService, resetCommandServices } from '../../src/extension.js';

const tempDirs: string[] = [];

async function createTempTaskRoot(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'educoder-commands-smoke-'));
  tempDirs.push(dir);
  return dir;
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await import('node:fs/promises').then(({ mkdir }) => mkdir(path.dirname(filePath), { recursive: true }));
  await writeFile(filePath, JSON.stringify(value, null, 2), 'utf8');
}

afterEach(async () => {
  resetCommandServices();
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('command registration', () => {
  it('registers frozen MVP commands', async () => {
    const commands = await vscode.commands.getCommands(true);
    const vscodeMock = (vscode as any).__mock;
    const packageJson = JSON.parse(
      await readFile(path.join(process.cwd(), 'package.json'), 'utf8'),
    ) as {
      activationEvents?: string[];
      contributes?: {
        commands?: Array<{ command: string; title: string }>;
        viewsContainers?: {
          activitybar?: Array<{ id: string }>;
        };
        views?: Record<string, Array<{ id: string }>>;
      };
    };

    expect(commands).toContain('educoderLocalOj.syncCollectionPackages');
    expect(commands).toContain('educoderLocalOj.openTask');
    expect(commands).toContain('educoderLocalOj.runLocalJudge');
    expect(commands).toContain('educoderLocalOj.rerunFailedCases');
    expect(commands).toContain('educoderLocalOj.submitTask');
    expect(commands).toContain('educoderLocalOj.runOfficialJudge');
    expect(commands).toContain('educoderLocalOj.forceRunOfficialJudge');
    expect(commands).toContain('educoderLocalOj.rollbackTemplate');
    expect(commands).toContain('educoderLocalOj.rollbackPassed');
    expect(commands).toContain('educoderLocalOj.syncTaskHistory');
    expect(commands).toContain('educoderLocalOj.restoreHistorySnapshot');
    expect(commands).toContain('educoderLocalOj.syncTaskAnswersSafe');
    expect(commands).toContain('educoderLocalOj.syncTaskAnswersFromTree');
    expect(commands).toContain('educoderLocalOj.syncTaskAnswersSafeFromTree');
    expect(commands).toContain('educoderLocalOj.syncTaskRepositoryFromTree');
    expect(commands).toContain('educoderLocalOj.compareWithTemplateFromTree');
    expect(commands).toContain('educoderLocalOj.compareWithAnswerFromTree');
    expect(commands).toContain('educoderLocalOj.filterTaskTree');
    expect(commands).toContain('educoderLocalOj.clearTaskTreeFilter');
    expect(commands).toContain('educoderLocalOj.showLogs');
    expect(commands).toContain('educoderLocalOj.enableEdgeReuse');
    expect(commands).toContain('educoderLocalOj.selectRootFolder');
    expect(commands).toContain('educoderLocalOj.openTaskStatement');
    expect(commands).toContain('educoderLocalOj.openCurrentCode');
    expect(commands).toContain('educoderLocalOj.openTaskTests');
    expect(commands).toContain('educoderLocalOj.openTaskAnswers');
    expect(commands).toContain('educoderLocalOj.openLatestCompileError');
    expect(commands).toContain('educoderLocalOj.openLatestFailureInput');
    expect(commands).toContain('educoderLocalOj.openLatestFailureOutput');
    expect(commands).not.toContain('educoderLocalOj.openTaskReadme');
    expect(commands).not.toContain('educoderLocalOj.openLatestReport');
    expect(vscodeMock.registeredViewProviders.has('educoderLocalOj.sidebar')).toBe(true);
    expect(vscodeMock.registeredTreeProviders.has('educoderLocalOj.taskTree')).toBe(true);
    expect(packageJson.activationEvents).toContain('onView:educoderLocalOj.sidebar');
    expect(packageJson.contributes?.viewsContainers?.activitybar).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'educoderLocalOj' })]),
    );
    expect(packageJson.contributes?.views?.educoderLocalOj).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'educoderLocalOj.sidebar' }),
        expect.objectContaining({ id: 'educoderLocalOj.taskTree' }),
      ]),
    );
    const taskTreeItemMenus = ((packageJson.contributes as any)?.menus?.['view/item/context'] ?? []) as Array<{
      command?: string;
      group?: string;
    }>;
    expect(taskTreeItemMenus).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          command: 'educoderLocalOj.syncTaskAnswersFromTree',
          group: expect.stringContaining('inline'),
        }),
        expect.objectContaining({
          command: 'educoderLocalOj.syncTaskRepositoryFromTree',
          group: expect.stringContaining('inline'),
        }),
      ]),
    );
    expect(taskTreeItemMenus).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          command: 'educoderLocalOj.compareWithTemplateFromTree',
        }),
        expect.objectContaining({
          command: 'educoderLocalOj.compareWithAnswerFromTree',
        }),
      ]),
    );
    expect((packageJson.contributes as any)?.menus?.['view/title']).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ command: 'educoderLocalOj.filterTaskTree' }),
        expect.objectContaining({ command: 'educoderLocalOj.clearTaskTreeFilter' }),
      ]),
    );
    expect(packageJson.contributes?.commands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          command: 'educoderLocalOj.syncCollectionPackages',
          title: 'Educoder Local OJ: 一键同步本章',
        }),
        expect.objectContaining({
          command: 'educoderLocalOj.selectRootFolder',
          title: 'Educoder Local OJ: 更换存放目录',
        }),
        expect.objectContaining({
          command: 'educoderLocalOj.openTask',
          title: 'Educoder Local OJ: 选择/打开题目',
        }),
        expect.objectContaining({
          command: 'educoderLocalOj.openTaskTests',
          title: 'Educoder Local OJ: 打开测试集',
        }),
        expect.objectContaining({
          command: 'educoderLocalOj.openTaskAnswers',
          title: 'Educoder Local OJ: 打开答案',
        }),
        expect.objectContaining({
          command: 'educoderLocalOj.openLatestCompileError',
          title: 'Educoder Local OJ: 打开完整编译报错',
        }),
        expect.objectContaining({
          command: 'educoderLocalOj.openLatestFailureInput',
          title: 'Educoder Local OJ: 打开失败输入',
        }),
        expect.objectContaining({
          command: 'educoderLocalOj.openLatestFailureOutput',
          title: 'Educoder Local OJ: 打开失败输出',
        }),
        expect.objectContaining({
          command: 'educoderLocalOj.syncTaskAnswersSafe',
          title: 'Educoder Local OJ: 安全同步答案',
        }),
        expect.objectContaining({
          command: 'educoderLocalOj.syncTaskAnswers',
          title: 'Educoder Local OJ: 完整同步答案（可能影响评分）',
        }),
        expect.objectContaining({
          command: 'educoderLocalOj.compareWithTemplateFromTree',
          title: 'Educoder Local OJ: 对比模板（目录）',
        }),
        expect.objectContaining({
          command: 'educoderLocalOj.compareWithAnswerFromTree',
          title: 'Educoder Local OJ: 对比答案（目录）',
        }),
      ]),
    );
    expect(
      packageJson.contributes?.commands?.some((entry) => entry.title.includes('同步章节目录')),
    ).toBe(false);
  });

  it('fails loudly instead of silently no-oping when task-scoped commands have no taskRoot', async () => {
    await expect(vscode.commands.executeCommand('educoderLocalOj.runLocalJudge')).rejects.toThrow(
      '请先打开题目',
    );
    await expect(vscode.commands.executeCommand('educoderLocalOj.submitTask')).rejects.toThrow(
      '请先打开题目',
    );
    await expect(vscode.commands.executeCommand('educoderLocalOj.syncTaskRepository')).rejects.toThrow(
      '请先打开题目',
    );
  });

  it('lets the user explicitly choose the local task-package storage root before syncing', async () => {
    const vscodeMock = (vscode as any).__mock;
    const rootDir = await createTempTaskRoot();
    vscodeMock.showOpenDialog.mockResolvedValue([{ fsPath: rootDir }]);

    const result = await vscode.commands.executeCommand('educoderLocalOj.selectRootFolder');

    expect(result).toMatchObject({
      rootFolderPath: rootDir,
      productRoot: path.join(rootDir, 'Educoder Local OJ'),
    });
    expect(vscodeMock.globalStateStore.get(ROOT_FOLDER_URI_KEY)).toBeDefined();
  });

  it('executes the one-click chapter sync command id and returns full package results', async () => {
    const vscodeMock = (vscode as any).__mock;
    const rootDir = await createTempTaskRoot();
    const chapterUrl = 'https://www.educoder.net/classrooms/ufr7sxlc/shixun_homework/1316861?tabs=0';

    vscodeMock.clipboardReadText.mockResolvedValue(chapterUrl);
    vscodeMock.showInputBox.mockImplementation(async (options?: { value?: string }) => options?.value ?? chapterUrl);
    vscodeMock.showOpenDialog.mockResolvedValue([{ fsPath: rootDir }]);

    configureCommandService('educoderLocalOj.syncCollectionPackages', () =>
      syncCollectionPackages({
        context: vscodeMock.context,
        window: vscode.window,
        clipboardEnv: vscode.env,
        input: vscode.window,
        client: {
          getCollectionIndex: async () => ({
            courseId: 'ufr7sxlc',
            courseName: '课程',
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
        syncTaskPackage: async (taskRoot) => {
          const markerPath = path.join(taskRoot, 'problem', 'statement.md');
          await import('node:fs/promises').then(({ mkdir }) =>
            mkdir(path.dirname(markerPath), { recursive: true }),
          );
          await writeFile(markerPath, '# 题面\n', 'utf8');
          return {
            taskRoot,
            materials: {
              statement: 'ready',
              currentCode: 'ready',
              templateCode: 'ready',
              tests: 'ready',
              answers: 'ready',
              metadata: 'ready',
            },
          };
        },
      }),
    );

    const result = await vscode.commands.executeCommand('educoderLocalOj.syncCollectionPackages');

    expect(result).toMatchObject({
      collectionRoot: expect.stringContaining('Educoder Local OJ'),
      syncedTasks: [
        expect.objectContaining({
          taskRoot: expect.stringContaining('fc7pz3fm6yjh'),
        }),
      ],
      defaultTask: expect.objectContaining({
        taskRoot: expect.stringContaining('fc7pz3fm6yjh'),
      }),
    });
    expect(vscodeMock.showOpenDialog).toHaveBeenCalledTimes(1);
    expect(vscodeMock.updateWorkspaceFolders).toHaveBeenCalledWith(
      0,
      0,
      expect.objectContaining({
        name: '第二章 线性表及应用 [1316861]',
        uri: expect.objectContaining({
          fsPath: path.join(rootDir, 'Educoder Local OJ', '课程 [ufr7sxlc]', '第二章 线性表及应用 [1316861]'),
        }),
      }),
    );
    await expect(
      readFile(
        path.join(
          rootDir,
          'Educoder Local OJ',
          '课程 [ufr7sxlc]',
          '第二章 线性表及应用 [1316861]',
          'homeworks',
          '2-2 基本实训-链表操作 [3727439]',
          'tasks',
          '01 第1关 基本实训：链表操作 [fc7pz3fm6yjh]',
          'problem',
          'statement.md',
        ),
        'utf8',
      ),
    ).resolves.toContain('# 题面');
    expect(vscodeMock.workspaceFolders).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          uri: expect.objectContaining({
            fsPath: path.join(rootDir, 'Educoder Local OJ', '课程 [ufr7sxlc]', '第二章 线性表及应用 [1316861]'),
          }),
        }),
      ]),
    );
  });


  it('opens the real statement file and current code file through registered commands', async () => {
    const vscodeMock = (vscode as any).__mock;
    const taskRoot = await createTempTaskRoot();
    const statementPath = path.join(taskRoot, 'problem', 'statement.md');
    const currentCodePath = path.join(taskRoot, 'code', 'current', 'src', 'main.cpp');
    const taskMetaPath = path.join(taskRoot, '_educoder', 'meta', 'task.json');

    await import('node:fs/promises').then(({ mkdir }) =>
      Promise.all([
        mkdir(path.dirname(statementPath), { recursive: true }),
        mkdir(path.dirname(currentCodePath), { recursive: true }),
        mkdir(path.dirname(taskMetaPath), { recursive: true }),
      ]),
    );
    await Promise.all([
      writeFile(statementPath, '# 题面\n', 'utf8'),
      writeFile(currentCodePath, 'int main() { return 0; }\n', 'utf8'),
      writeFile(
        taskMetaPath,
        JSON.stringify({
          editablePaths: ['src/main.cpp'],
        }),
        'utf8',
      ),
    ]);

    const statementResult = await vscode.commands.executeCommand(
      'educoderLocalOj.openTaskStatement',
      taskRoot,
    );
    const currentCodeResult = await vscode.commands.executeCommand(
      'educoderLocalOj.openCurrentCode',
      taskRoot,
    );

    expect(statementResult).toMatchObject({ openedPath: statementPath });
    expect(currentCodeResult).toMatchObject({ openedPath: currentCodePath });
    expect(vscodeMock.executeCommand).toHaveBeenCalledWith(
      'markdown.showPreview',
      expect.objectContaining({ fsPath: statementPath }),
    );
    expect(vscodeMock.openTextDocument).toHaveBeenCalledWith(expect.objectContaining({ fsPath: currentCodePath }));
    expect(vscodeMock.showTextDocument).toHaveBeenCalledTimes(1);
  });

  it('opens tests and answers through registered commands', async () => {
    const vscodeMock = (vscode as any).__mock;
    const taskRoot = await createTempTaskRoot();
    const testsIndexPath = path.join(taskRoot, 'tests', 'index.json');
    const testsAllDir = path.join(taskRoot, 'tests', 'all');
    const answerIndexPath = path.join(taskRoot, 'answers', 'index.md');
    const answerFilePath = path.join(taskRoot, 'answers', 'answer-1.md');

    await import('node:fs/promises').then(({ mkdir }) =>
      Promise.all([
        mkdir(path.dirname(testsIndexPath), { recursive: true }),
        mkdir(testsAllDir, { recursive: true }),
        mkdir(path.dirname(answerIndexPath), { recursive: true }),
        mkdir(path.dirname(answerFilePath), { recursive: true }),
      ]),
    );
    await Promise.all([
      writeFile(testsIndexPath, JSON.stringify({ total: 1 }, null, 2), 'utf8'),
      writeFile(answerIndexPath, '# 答案\n', 'utf8'),
      writeFile(path.join(testsAllDir, 'case_001_input.txt'), '1 2\n', 'utf8'),
      writeFile(path.join(testsAllDir, 'case_001_output.txt'), '3\n', 'utf8'),
      writeFile(answerFilePath, '# answer\n', 'utf8'),
    ]);

    const testsResult = await vscode.commands.executeCommand(
      'educoderLocalOj.openTaskTests',
      taskRoot,
    );
    const answersResult = await vscode.commands.executeCommand(
      'educoderLocalOj.openTaskAnswers',
      taskRoot,
    );
    expect(testsResult).toMatchObject({ openedPath: testsAllDir, openedKind: 'directory' });
    expect(answersResult).toMatchObject({ openedPath: answerFilePath, openedKind: 'file' });
    expect(vscodeMock.openTextDocument).toHaveBeenCalledWith(expect.objectContaining({ fsPath: answerFilePath }));
  });

  it('runs the registered local-judge command without relying on popup feedback', async () => {
    const vscodeMock = (vscode as any).__mock;
    const taskRoot = await createTempTaskRoot();

    configureCommandService('educoderLocalOj.runLocalJudge', (root) =>
      runLocalJudgeCommand(String(root), {
        runLocalJudge: async () => ({
          source: 'tests/all',
          workspacePath: 'code/current',
          runMode: 'full',
          compile: {
            verdict: 'compiled',
            stdout: '',
            stderr: '',
            executablePath: path.join(String(root), 'app.exe'),
          },
          caseResults: [],
          summary: {
            total: 3,
            passed: 3,
            failed: 0,
          },
        }),
      }),
    );

    const result = await vscode.commands.executeCommand('educoderLocalOj.runLocalJudge', taskRoot);

    expect(result).toMatchObject({
      source: 'tests/all',
      workspacePath: 'code/current',
      summary: {
        total: 3,
        passed: 3,
        failed: 0,
      },
    });
    expect(vscodeMock.saveAll).toHaveBeenCalledTimes(1);
    expect(vscodeMock.showInformationMessage).not.toHaveBeenCalled();
    expect(vscodeMock.showErrorMessage).not.toHaveBeenCalled();
  });

  it('opens the latest failed input/output files through registered commands', async () => {
    const vscodeMock = (vscode as any).__mock;
    const taskRoot = await createTempTaskRoot();
    const inputPath = path.join(taskRoot, 'tests', 'all', 'case_002_input.txt');
    const outputPath = path.join(taskRoot, 'tests', 'all', 'case_002_output.txt');
    const reportPath = path.join(taskRoot, '_educoder', 'judge', 'latest_local.json');

    await import('node:fs/promises').then(({ mkdir }) =>
      Promise.all([
        mkdir(path.dirname(inputPath), { recursive: true }),
        mkdir(path.dirname(reportPath), { recursive: true }),
      ]),
    );
    await Promise.all([
      writeFile(inputPath, '1 2\n', 'utf8'),
      writeFile(outputPath, '3\n', 'utf8'),
      writeFile(
        reportPath,
        JSON.stringify(
          {
            source: 'tests/all',
            runMode: 'full',
            compile: { verdict: 'compiled', stdout: '', stderr: '', executablePath: 'app.exe' },
            caseResults: [
              {
                caseId: 'case_002',
                verdict: 'failed',
                inputPath: 'tests/all/case_002_input.txt',
                outputPath: 'tests/all/case_002_output.txt',
                expected: '3\n',
                actual: '2\n',
                stdout: '2\n',
                stderr: '',
              },
            ],
            summary: { total: 3, passed: 2, failed: 1 },
          },
          null,
          2,
        ),
        'utf8',
      ),
    ]);

    const inputResult = await vscode.commands.executeCommand(
      'educoderLocalOj.openLatestFailureInput',
      taskRoot,
    );
    const outputResult = await vscode.commands.executeCommand(
      'educoderLocalOj.openLatestFailureOutput',
      taskRoot,
    );

    expect(inputResult).toMatchObject({ openedPath: inputPath, openedKind: 'file' });
    expect(outputResult).toMatchObject({ openedPath: outputPath, openedKind: 'file' });
    expect(vscodeMock.openTextDocument).toHaveBeenCalledWith(expect.objectContaining({ fsPath: inputPath }));
    expect(vscodeMock.openTextDocument).toHaveBeenCalledWith(expect.objectContaining({ fsPath: outputPath }));
  });

  it('shows an explicit submit-stop message when local tests fail before remote submission', async () => {
    const vscodeMock = (vscode as any).__mock;
    const taskRoot = await createTempTaskRoot();
    const runRemoteJudge = vi.fn();

    configureCommandService('educoderLocalOj.submitTask', (root) =>
      submitTaskCommand(String(root), {
        runLocalJudge: async () => ({
          source: 'tests/all',
          runMode: 'full',
          compile: {
            verdict: 'compile_error',
            stdout: '',
            stderr: 'main.cpp:1:1: error: boom',
          },
          caseResults: [],
          summary: {
            total: 0,
            passed: 0,
            failed: 0,
          },
        }),
        runRemoteJudge,
      }),
    );

    const result = await vscode.commands.executeCommand('educoderLocalOj.submitTask', taskRoot);

    expect(result).toMatchObject({
      decision: 'stopped_after_local_failure',
      remote: {
        executed: false,
      },
    });
    expect(vscodeMock.saveAll).toHaveBeenCalledTimes(1);
    expect(runRemoteJudge).not.toHaveBeenCalled();
    expect(vscodeMock.showWarningMessage).toHaveBeenCalledWith(
      '本地测试未通过（编译失败），仍要提交到头哥吗？',
      '继续提交',
      '取消',
    );
    expect(vscodeMock.showErrorMessage).toHaveBeenCalledWith('本地测试未通过，未提交到头哥：编译失败');
  });

  it('submits to Educoder after an explicit confirmation even when local tests fail', async () => {
    const vscodeMock = (vscode as any).__mock;
    const taskRoot = await createTempTaskRoot();
    const runRemoteJudge = vi.fn(async () => ({
      source: 'remote' as const,
      codeHash: 'hash-confirmed-submit',
      generatedAt: new Date().toISOString(),
      summary: {
        verdict: 'passed' as const,
        score: 100,
        passedCount: 1,
        totalCount: 1,
        message: 'Accepted',
        rawLogPath: path.join(String(taskRoot), '_educoder', 'judge', 'remote_runs', 'latest.json'),
      },
    }));

    vscodeMock.showWarningMessage.mockResolvedValue('继续提交');

    configureCommandService('educoderLocalOj.submitTask', (root) =>
      submitTaskCommand(String(root), {
        runLocalJudge: async () => ({
          source: 'tests/all',
          runMode: 'full',
          compile: {
            verdict: 'compiled',
            stdout: '',
            stderr: '',
            executablePath: path.join(String(root), 'app.exe'),
          },
          caseResults: [],
          summary: {
            total: 1,
            passed: 0,
            failed: 1,
          },
        }),
        runRemoteJudge,
      }),
    );

    const result = await vscode.commands.executeCommand('educoderLocalOj.submitTask', taskRoot);

    expect(result).toMatchObject({
      decision: 'submitted_after_local_failure',
      local: {
        passed: false,
      },
      remote: {
        executed: true,
        verdict: 'passed',
        passedCount: 1,
        totalCount: 1,
      },
    });
    expect(runRemoteJudge).toHaveBeenCalledWith({ force: false });
    expect(vscodeMock.showWarningMessage).toHaveBeenCalledWith(
      '本地测试未通过（未通过 0/1），仍要提交到头哥吗？',
      '继续提交',
      '取消',
    );
    expect(vscodeMock.showInformationMessage).toHaveBeenCalledWith('已提交到头哥：已通过 1/1 · Accepted');
  });

  it('shows an explicit submit result message when Educoder returns a verdict', async () => {
    const vscodeMock = (vscode as any).__mock;
    const taskRoot = await createTempTaskRoot();

    configureCommandService('educoderLocalOj.submitTask', (root) =>
      submitTaskCommand(String(root), {
        runLocalJudge: async () => ({
          source: 'tests/all',
          runMode: 'full',
          compile: {
            verdict: 'compiled',
            stdout: '',
            stderr: '',
            executablePath: path.join(String(root), 'app.exe'),
          },
          caseResults: [],
          summary: {
            total: 2,
            passed: 2,
            failed: 0,
          },
        }),
        runRemoteJudge: async () => ({
          source: 'remote',
          codeHash: 'hash-1',
          generatedAt: new Date().toISOString(),
          summary: {
            verdict: 'passed',
            score: 100,
            passedCount: 2,
            totalCount: 2,
            message: 'Accepted',
            rawLogPath: path.join(String(root), '_educoder', 'judge', 'remote_runs', 'latest.json'),
          },
        }),
      }),
    );

    const result = await vscode.commands.executeCommand('educoderLocalOj.submitTask', taskRoot);

    expect(result).toMatchObject({
      decision: 'submitted_after_local_pass',
      remote: {
        executed: true,
        verdict: 'passed',
        score: 100,
        passedCount: 2,
        totalCount: 2,
        message: 'Accepted',
      },
    });
    expect(vscodeMock.saveAll).toHaveBeenCalledTimes(1);
    expect(vscodeMock.showInformationMessage).toHaveBeenCalledWith('已提交到头哥：已通过 2/2 · Accepted');
  });

  it('keeps legacy task roots usable through command ids while migrating them forward safely', async () => {
    const taskRoot = await createTempTaskRoot();
    await writeJson(path.join(taskRoot, 'task.manifest.json'), {
      taskId: 'legacy-task',
      name: 'Legacy Task',
      position: 1,
      folderName: '01 Legacy Task [legacy-task]',
    });
    await writeJson(path.join(taskRoot, '_educoder', 'meta', 'task.json'), {
      taskId: 'legacy-task',
      homeworkId: 'legacy-homework',
      myshixunIdentifier: 'legacy-myshixun',
      userLogin: 'legacy-user',
    });
    await import('node:fs/promises').then(({ mkdir }) =>
      Promise.all([
        mkdir(path.join(taskRoot, 'workspace', 'src'), { recursive: true }),
        mkdir(path.join(taskRoot, '_educoder', 'tests', 'hidden'), { recursive: true }),
      ]),
    );
    await Promise.all([
      writeFile(path.join(taskRoot, 'workspace', 'src', 'main.cpp'), 'int main() { return 0; }\n', 'utf8'),
      writeFile(path.join(taskRoot, '_educoder', 'tests', 'hidden', 'case_001_input.txt'), '1 2\n', 'utf8'),
      writeFile(path.join(taskRoot, '_educoder', 'tests', 'hidden', 'case_001_output.txt'), '3\n', 'utf8'),
    ]);

    configureCommandService('educoderLocalOj.openTask', (root) =>
      openTaskCommand(String(root)),
    );
    configureCommandService('educoderLocalOj.submitTask', (root) =>
      submitTaskCommand(String(root), {
        runLocalJudge: async () => ({
          source: 'tests/all',
          runMode: 'full',
          compile: { verdict: 'compiled', stdout: '', stderr: '', executablePath: 'app.exe' },
          caseResults: [],
          summary: { total: 1, passed: 1, failed: 0 },
        }),
        runRemoteJudge: async () => ({
          source: 'remote',
          codeHash: 'legacy-hash',
          generatedAt: new Date().toISOString(),
          summary: {
            verdict: 'passed',
            score: 100,
            passedCount: 1,
            totalCount: 1,
            message: 'Accepted',
            rawLogPath: path.join(String(root), '_educoder', 'judge', 'remote_runs', 'latest.json'),
          },
        }),
      }),
    );

    const openResult = await vscode.commands.executeCommand('educoderLocalOj.openTask', taskRoot);
    expect(openResult).toMatchObject({
      readiness: 'local_ready',
      hiddenTestsCached: true,
    });

    const submitResult = await vscode.commands.executeCommand('educoderLocalOj.submitTask', taskRoot);
    expect(submitResult).toMatchObject({
      decision: 'submitted_after_local_pass',
      remote: {
        executed: true,
        verdict: 'passed',
      },
    });

    await expect(readFile(path.join(taskRoot, 'code', 'current', 'src', 'main.cpp'), 'utf8')).resolves.toBe(
      'int main() { return 0; }\n',
    );
    await expect(readFile(path.join(taskRoot, 'tests', 'all', 'case_001_output.txt'), 'utf8')).resolves.toBe(
      '3\n',
    );
    await expect(readFile(path.join(taskRoot, 'workspace', 'src', 'main.cpp'), 'utf8')).resolves.toBe(
      'int main() { return 0; }\n',
    );
  });
});
