import * as vscode from 'vscode';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { syncCollectionPackages } from '../../src/commands/syncCollectionPackages.js';
import { openTaskCommand } from '../../src/commands/openTask.js';
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
    expect(commands).toContain('educoderLocalOj.syncTaskAnswersFromTree');
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
    expect((packageJson.contributes as any)?.menus?.['view/item/context']).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ command: 'educoderLocalOj.syncTaskAnswersFromTree' }),
        expect.objectContaining({ command: 'educoderLocalOj.syncTaskRepositoryFromTree' }),
        expect.objectContaining({ command: 'educoderLocalOj.compareWithTemplateFromTree' }),
        expect.objectContaining({ command: 'educoderLocalOj.compareWithAnswerFromTree' }),
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
          title: 'Educoder Local OJ: 打开当前题目',
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
          return { taskRoot };
        },
      }),
    );

    const result = await vscode.commands.executeCommand('educoderLocalOj.syncCollectionPackages');

    expect(result).toMatchObject({
      syncedTasks: [
        expect.objectContaining({
          taskRoot: expect.stringContaining('fc7pz3fm6yjh'),
        }),
      ],
    });
    expect(vscodeMock.showOpenDialog).toHaveBeenCalledTimes(1);
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
    expect(vscodeMock.openTextDocument).toHaveBeenCalledWith(expect.objectContaining({ fsPath: statementPath }));
    expect(vscodeMock.openTextDocument).toHaveBeenCalledWith(expect.objectContaining({ fsPath: currentCodePath }));
    expect(vscodeMock.showTextDocument).toHaveBeenCalledTimes(2);
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
      openTaskCommand(String(root), {
        openPanel: vi.fn(),
      }),
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
            message: 'Accepted',
            rawLogPath: path.join(String(root), '_educoder', 'logs', 'remote', 'latest.json'),
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
