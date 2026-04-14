import * as vscode from 'vscode';
import { compareWithAnswer } from './commands/compareWithAnswer.js';
import { compareWithTemplate } from './commands/compareWithTemplate.js';
import { enableEdgeReuseCommand } from './commands/enableEdgeReuse.js';
import { forceRunOfficialJudgeCommand } from './commands/forceRunOfficialJudge.js';
import { openTaskCommand } from './commands/openTask.js';
import { openTaskInteractive } from './commands/openTaskInteractive.js';
import {
  openLatestCompileErrorCommand,
  openLatestFailureInputCommand,
  openLatestFailureOutputCommand,
  openTaskAnswersCommand,
  openTaskTestsCommand,
} from './commands/openTaskPackageFiles.js';
import {
  openCurrentCodeCommand,
  openTaskStatementCommand,
} from './commands/openTaskMaterials.js';
import { selectRootFolderCommand } from './commands/selectRootFolder.js';
import { rerunFailedCases } from './commands/rerunFailedCases.js';
import { rollbackPassed } from './commands/rollbackPassed.js';
import { rollbackTemplate } from './commands/rollbackTemplate.js';
import { restoreHistorySnapshot } from './commands/restoreHistorySnapshot.js';
import { runLocalJudgeCommand } from './commands/runLocalJudge.js';
import { runOfficialJudgeCommand } from './commands/runOfficialJudge.js';
import { submitTaskCommand } from './commands/submitTask.js';
import { syncCollectionPackages } from './commands/syncCollectionPackages.js';
import {
  syncTaskAnswersFullCommand,
  syncTaskAnswersSafeCommand,
} from './commands/syncTaskAnswersCommand.js';
import { syncTaskHistory } from './commands/syncTaskHistory.js';
import { syncTaskPackageCommand } from './commands/syncTaskPackage.js';
import { syncTaskRepository } from './commands/syncTaskRepository.js';
import { syncCurrentCollection } from './commands/syncCurrentCollection.js';
import { resolveTaskRootFromTreeInput } from './commands/taskTreeActions.js';
import { AnswerFetchClient } from './core/api/answerFetchClient.js';
import { HiddenTestFetchClient } from './core/api/hiddenTestFetchClient.js';
import { HistoryFetchClient } from './core/api/historyFetchClient.js';
import { PassedFetchClient } from './core/api/passedFetchClient.js';
import { ProblemFetchClient } from './core/api/problemFetchClient.js';
import { RepositoryFetchClient } from './core/api/repositoryFetchClient.js';
import { SourceFetchClient } from './core/api/sourceFetchClient.js';
import { TaskDetailClient } from './core/api/taskDetailClient.js';
import { TemplateFetchClient } from './core/api/templateFetchClient.js';
import { setStoredLastOpenedTaskRoot } from './core/config/extensionState.js';
import {
  configureDefaultOfficialJudgeExecutor,
  createOfficialJudgeExecutor,
} from './core/remote/officialJudgeExecutor.js';
import type { OfficialJudgeReport } from './core/remote/officialLogStore.js';
import {
  buildEducoderCookieHeader,
  createExtensionRuntime,
  type ExtensionRuntime,
} from './core/runtime/extensionRuntime.js';
import {
  DASHBOARD_SIDEBAR_VIEW_ID,
  DashboardSidebarProvider,
} from './webview/dashboard/sidebar.js';
import { TASK_TREE_VIEW_ID, TaskTreeProvider } from './views/taskTreeProvider.js';

const frozenCommands = [
  'educoderLocalOj.showLogs',
  'educoderLocalOj.enableEdgeReuse',
  'educoderLocalOj.selectRootFolder',
  'educoderLocalOj.syncCurrentCollection',
  'educoderLocalOj.syncCollectionPackages',
  'educoderLocalOj.syncTaskPackage',
  'educoderLocalOj.openTask',
  'educoderLocalOj.openTaskStatement',
  'educoderLocalOj.openCurrentCode',
  'educoderLocalOj.openTaskTests',
  'educoderLocalOj.openTaskAnswers',
  'educoderLocalOj.openLatestCompileError',
  'educoderLocalOj.openLatestFailureInput',
  'educoderLocalOj.openLatestFailureOutput',
  'educoderLocalOj.runLocalJudge',
  'educoderLocalOj.submitTask',
  'educoderLocalOj.rerunFailedCases',
  'educoderLocalOj.runOfficialJudge',
  'educoderLocalOj.forceRunOfficialJudge',
  'educoderLocalOj.rollbackTemplate',
  'educoderLocalOj.rollbackPassed',
  'educoderLocalOj.syncTaskHistory',
  'educoderLocalOj.restoreHistorySnapshot',
  'educoderLocalOj.syncTaskRepository',
  'educoderLocalOj.syncTaskAnswersSafe',
  'educoderLocalOj.syncTaskAnswers',
  'educoderLocalOj.compareWithTemplate',
  'educoderLocalOj.compareWithAnswer',
  'educoderLocalOj.syncTaskRepositoryFromTree',
  'educoderLocalOj.syncTaskAnswersSafeFromTree',
  'educoderLocalOj.syncTaskAnswersFromTree',
  'educoderLocalOj.compareWithTemplateFromTree',
  'educoderLocalOj.compareWithAnswerFromTree',
  'educoderLocalOj.filterTaskTree',
  'educoderLocalOj.clearTaskTreeFilter',
] as const;

let activated = false;
const commandServiceOverrides = new Map<string, (...args: unknown[]) => unknown>();
let activeContext: vscode.ExtensionContext | undefined;
let activeDashboardSidebarProvider: DashboardSidebarProvider | undefined;
let activeTaskTreeProvider: TaskTreeProvider | undefined;
let activeOutputChannel: vscode.OutputChannel | undefined;
let activeRuntime: ExtensionRuntime | undefined;
const TASK_ROOT_REQUIRED_ERROR_MESSAGE = '请先打开题目，或从 Task Tree 中选择题目。';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  if (activated) {
    return;
  }

  activeContext = context;
  activeOutputChannel = vscode.window.createOutputChannel('Educoder Local OJ');
  context.subscriptions.push(activeOutputChannel);
  activeRuntime = createExtensionRuntime({
    context,
    outputChannel: activeOutputChannel,
    window: vscode.window,
  });
  configureDefaultOfficialJudgeExecutor(createOfficialJudgeExecutor(activeRuntime.client));
  activeDashboardSidebarProvider = new DashboardSidebarProvider();
  activeTaskTreeProvider = new TaskTreeProvider({ context });
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      DASHBOARD_SIDEBAR_VIEW_ID,
      activeDashboardSidebarProvider,
    ),
  );
  context.subscriptions.push(vscode.window.registerTreeDataProvider(TASK_TREE_VIEW_ID, activeTaskTreeProvider));

  for (const commandId of frozenCommands) {
    const disposable = vscode.commands.registerCommand(commandId, (...args: unknown[]) =>
      runCommand(commandId, args),
    );
    context.subscriptions.push(disposable);
  }

  activated = true;
}

export function deactivate(): void {
  activated = false;
  activeContext = undefined;
  activeDashboardSidebarProvider = undefined;
  activeTaskTreeProvider = undefined;
  activeOutputChannel = undefined;
  activeRuntime = undefined;
  configureDefaultOfficialJudgeExecutor(undefined);
}

export function configureCommandService(
  commandId: (typeof frozenCommands)[number],
  handler: ((...args: unknown[]) => unknown) | undefined,
): void {
  if (handler) {
    commandServiceOverrides.set(commandId, handler);
    return;
  }

  commandServiceOverrides.delete(commandId);
}

export function resetCommandServices(): void {
  commandServiceOverrides.clear();
}

async function runCommand(commandId: string, args: unknown[]): Promise<unknown> {
  const taskRoot = typeof args[0] === 'string' ? args[0] : undefined;
  const override = commandServiceOverrides.get(commandId);

  if (override) {
    return override(...args);
  }

  const context = activeContext;
  if (!context) {
    throw new Error('Extension context is unavailable.');
  }

  switch (commandId) {
    case 'educoderLocalOj.showLogs':
      activeOutputChannel?.show(true);
      return undefined;
    case 'educoderLocalOj.enableEdgeReuse':
      return enableEdgeReuseCommand({
        context,
        window: vscode.window,
        output: activeOutputChannel,
      });
    case 'educoderLocalOj.selectRootFolder':
      return runGlobalCommand(() =>
        selectRootFolderCommand({
          context,
          window: vscode.window,
        }),
      );
    case 'educoderLocalOj.syncCurrentCollection':
      return runGlobalCommand(async () => {
        const runtime = getActiveRuntime();

        return syncCurrentCollection({
          context,
          window: vscode.window,
          clipboardEnv: vscode.env,
          input: vscode.window,
          client: runtime.client,
          logger: runtime.logger,
          fetchCollectionPageHtml: async ({ courseId, categoryId }) => {
            const session = await runtime.resolveSession();
            const url = `https://www.educoder.net/classrooms/${courseId}/shixun_homework/${categoryId}?tabs=0`;
            const response = await fetch(url, {
              headers: {
                Cookie: buildEducoderCookieHeader(session),
              },
            });
            const html = await response.text();

            return {
              url: response.url || url,
              html,
              contentType: response.headers.get('content-type') ?? undefined,
            };
          },
        });
      });
    case 'educoderLocalOj.syncCollectionPackages':
      return runGlobalCommand(async () => {
        const runtime = getActiveRuntime();

        return syncCollectionPackages({
          context,
          window: vscode.window,
          clipboardEnv: vscode.env,
          input: vscode.window,
          client: runtime.client,
          logger: runtime.logger,
          fetchCollectionPageHtml: async ({ courseId, categoryId }) => {
            const session = await runtime.resolveSession();
            const url = `https://www.educoder.net/classrooms/${courseId}/shixun_homework/${categoryId}?tabs=0`;
            const response = await fetch(url, {
              headers: {
                Cookie: buildEducoderCookieHeader(session),
              },
            });
            const html = await response.text();

            return {
              url: response.url || url,
              html,
              contentType: response.headers.get('content-type') ?? undefined,
            };
          },
          syncTaskPackage: async (taskRoot) =>
            syncTaskPackageCommand(taskRoot, createDefaultSyncTaskPackageDeps(context)),
        });
      });
    case 'educoderLocalOj.openTask':
      if (taskRoot) {
        return runTaskScopedCommand(taskRoot, () =>
          openTaskCommand(taskRoot, createDefaultOpenTaskDeps(context)),
        );
      }

      return openTaskInteractive({
        context,
        window: vscode.window as typeof vscode.window & {
          showQuickPick: typeof vscode.window.showQuickPick;
        },
        openTask: async (pickedTaskRoot) =>
          runTaskScopedCommand(pickedTaskRoot, () =>
            openTaskCommand(pickedTaskRoot, createDefaultOpenTaskDeps(context)),
          ),
      });
    case 'educoderLocalOj.syncTaskPackage':
      return runTaskScopedCommand(requireTaskRoot(taskRoot), () =>
        syncTaskPackageCommand(requireTaskRoot(taskRoot), createDefaultSyncTaskPackageDeps(context)),
      );
    case 'educoderLocalOj.openTaskStatement':
      return runTaskScopedCommand(requireTaskRoot(taskRoot), () =>
        openTaskStatementCommand(requireTaskRoot(taskRoot)),
      );
    case 'educoderLocalOj.openCurrentCode':
      return runTaskScopedCommand(requireTaskRoot(taskRoot), () =>
        openCurrentCodeCommand(requireTaskRoot(taskRoot)),
      );
    case 'educoderLocalOj.openTaskTests':
      return runTaskScopedCommand(requireTaskRoot(taskRoot), () =>
        openTaskTestsCommand(requireTaskRoot(taskRoot)),
      );
    case 'educoderLocalOj.openTaskAnswers':
      return runTaskScopedCommand(requireTaskRoot(taskRoot), () =>
        openTaskAnswersCommand(requireTaskRoot(taskRoot)),
      );
    case 'educoderLocalOj.openLatestCompileError':
      return runTaskScopedCommand(requireTaskRoot(taskRoot), () =>
        openLatestCompileErrorCommand(requireTaskRoot(taskRoot)),
      );
    case 'educoderLocalOj.openLatestFailureInput':
      return runTaskScopedCommand(requireTaskRoot(taskRoot), () =>
        openLatestFailureInputCommand(requireTaskRoot(taskRoot)),
      );
    case 'educoderLocalOj.openLatestFailureOutput':
      return runTaskScopedCommand(requireTaskRoot(taskRoot), () =>
        openLatestFailureOutputCommand(requireTaskRoot(taskRoot)),
      );
    case 'educoderLocalOj.runLocalJudge':
      return runTaskScopedCommand(requireTaskRoot(taskRoot), () =>
        runLocalJudgeCommand(requireTaskRoot(taskRoot)),
      );
    case 'educoderLocalOj.submitTask':
      return runTaskScopedCommand(requireTaskRoot(taskRoot), () =>
        submitTaskCommand(requireTaskRoot(taskRoot)),
      );
    case 'educoderLocalOj.rerunFailedCases':
      return runTaskScopedCommand(requireTaskRoot(taskRoot), () =>
        rerunFailedCases(requireTaskRoot(taskRoot)),
      );
    case 'educoderLocalOj.runOfficialJudge':
      return runTaskScopedCommand(requireTaskRoot(taskRoot), async () => {
        const report = await runOfficialJudgeCommand(requireTaskRoot(taskRoot));
        await notifyOfficialJudgeResult(report, false);
        return report;
      });
    case 'educoderLocalOj.forceRunOfficialJudge':
      return runTaskScopedCommand(requireTaskRoot(taskRoot), () =>
        forceRunOfficialJudgeCommand(requireTaskRoot(taskRoot)),
      );
    case 'educoderLocalOj.rollbackTemplate':
      return runTaskScopedCommand(requireTaskRoot(taskRoot), () =>
        rollbackTemplate(requireTaskRoot(taskRoot), createDefaultRollbackDeps(context)),
      );
    case 'educoderLocalOj.rollbackPassed':
      return runTaskScopedCommand(requireTaskRoot(taskRoot), () =>
        rollbackPassed(requireTaskRoot(taskRoot), createDefaultRollbackDeps(context)),
      );
    case 'educoderLocalOj.syncTaskHistory':
      return runTaskScopedCommand(requireTaskRoot(taskRoot), () =>
        syncTaskHistory(requireTaskRoot(taskRoot), createDefaultHistoryDeps(context)),
      );
    case 'educoderLocalOj.restoreHistorySnapshot': {
      const queryIndex = typeof args[1] === 'number' ? args[1] : undefined;
      if (queryIndex === undefined) {
        throw new Error('请提供要恢复的历史 query_index。');
      }
      return runTaskScopedCommand(requireTaskRoot(taskRoot), () =>
        restoreHistorySnapshot(
          requireTaskRoot(taskRoot),
          queryIndex,
          createDefaultHistoryDeps(context),
        ),
      );
    }
    case 'educoderLocalOj.syncTaskRepository':
      return runTaskScopedCommand(requireTaskRoot(taskRoot), () =>
        syncTaskRepository(requireTaskRoot(taskRoot), createDefaultRepositoryDeps(context)),
      );
    case 'educoderLocalOj.syncTaskAnswersSafe':
      return runTaskScopedCommand(requireTaskRoot(taskRoot), () =>
        syncTaskAnswersSafeCommand(requireTaskRoot(taskRoot), createDefaultAnswerDeps(context)),
      );
    case 'educoderLocalOj.syncTaskAnswers':
      return runTaskScopedCommand(requireTaskRoot(taskRoot), () =>
        syncTaskAnswersFullCommand(requireTaskRoot(taskRoot), createDefaultAnswerDeps(context)),
      );
    case 'educoderLocalOj.compareWithTemplate': {
      const relativePath = typeof args[1] === 'string' ? args[1] : undefined;
      return runTaskScopedCommand(requireTaskRoot(taskRoot), () =>
        compareWithTemplate(requireTaskRoot(taskRoot), relativePath),
      );
    }
    case 'educoderLocalOj.compareWithAnswer': {
      const relativePath = typeof args[1] === 'string' ? args[1] : undefined;
      const answerId = typeof args[2] === 'number' ? args[2] : undefined;
      return runTaskScopedCommand(requireTaskRoot(taskRoot), () =>
        compareWithAnswer(requireTaskRoot(taskRoot), relativePath, answerId),
      );
    }
    case 'educoderLocalOj.syncTaskRepositoryFromTree': {
      const resolvedTaskRoot = resolveTaskRootFromTreeInput(args[0]);
      return resolvedTaskRoot
        ? runTaskScopedCommand(resolvedTaskRoot, () =>
            syncTaskRepository(resolvedTaskRoot, createDefaultRepositoryDeps(context)),
          )
        : undefined;
    }
    case 'educoderLocalOj.syncTaskAnswersSafeFromTree': {
      const resolvedTaskRoot = resolveTaskRootFromTreeInput(args[0]);
      return resolvedTaskRoot
        ? runTaskScopedCommand(resolvedTaskRoot, () =>
            syncTaskAnswersSafeCommand(resolvedTaskRoot, createDefaultAnswerDeps(context)),
          )
        : undefined;
    }
    case 'educoderLocalOj.syncTaskAnswersFromTree': {
      const resolvedTaskRoot = resolveTaskRootFromTreeInput(args[0]);
      return resolvedTaskRoot
        ? runTaskScopedCommand(resolvedTaskRoot, () =>
            syncTaskAnswersFullCommand(resolvedTaskRoot, createDefaultAnswerDeps(context)),
          )
        : undefined;
    }
    case 'educoderLocalOj.compareWithTemplateFromTree': {
      const resolvedTaskRoot = resolveTaskRootFromTreeInput(args[0]);
      return resolvedTaskRoot
        ? runTaskScopedCommand(resolvedTaskRoot, () => compareWithTemplate(resolvedTaskRoot))
        : undefined;
    }
    case 'educoderLocalOj.compareWithAnswerFromTree': {
      const resolvedTaskRoot = resolveTaskRootFromTreeInput(args[0]);
      return resolvedTaskRoot
        ? runTaskScopedCommand(resolvedTaskRoot, () => compareWithAnswer(resolvedTaskRoot))
        : undefined;
    }
    case 'educoderLocalOj.filterTaskTree': {
      const query = await vscode.window.showInputBox({
        prompt: '按章节 / 作业 / 题目关键词筛选 Task Tree',
        placeHolder: '例如：线性表、链表作业、栈',
        ignoreFocusOut: true,
      });
      if (query === undefined) {
        return undefined;
      }
      if (!query.trim()) {
        activeTaskTreeProvider?.clearFilter();
        return undefined;
      }
      activeTaskTreeProvider?.setFilter(query);
      return undefined;
    }
    case 'educoderLocalOj.clearTaskTreeFilter':
      activeTaskTreeProvider?.clearFilter();
      return undefined;
    default:
      return undefined;
  }
}

async function runTaskScopedCommand<T>(
  taskRoot: string,
  action: () => Promise<T>,
): Promise<T> {
  const result = await action();
  activeTaskTreeProvider?.setCurrentTask(taskRoot);
  await activeDashboardSidebarProvider?.showTask(taskRoot);
  return result;
}

function requireTaskRoot(taskRoot: string | undefined): string {
  if (!taskRoot) {
    throw new Error(TASK_ROOT_REQUIRED_ERROR_MESSAGE);
  }

  return taskRoot;
}

async function runGlobalCommand<T>(action: () => Promise<T>): Promise<T> {
  const result = await action();
  activeTaskTreeProvider?.refresh();
  const nextTaskRoot = resolveTaskRootFromCommandResult(result);
  if (nextTaskRoot) {
    activeTaskTreeProvider?.setCurrentTask(nextTaskRoot);
    await activeDashboardSidebarProvider?.showTask(nextTaskRoot);
  }
  return result;
}

function resolveTaskRootFromCommandResult(result: unknown): string | undefined {
  if (
    typeof result === 'object' &&
    result !== null &&
    'taskRoot' in result &&
    typeof (result as { taskRoot?: unknown }).taskRoot === 'string'
  ) {
    return (result as { taskRoot: string }).taskRoot;
  }

  if (
    typeof result === 'object' &&
    result !== null &&
    'defaultTask' in result &&
    typeof (result as { defaultTask?: { taskRoot?: unknown } }).defaultTask?.taskRoot === 'string'
  ) {
    return (result as { defaultTask: { taskRoot: string } }).defaultTask.taskRoot;
  }

  if (
    typeof result === 'object' &&
    result !== null &&
    'firstTask' in result &&
    typeof (result as { firstTask?: { taskRoot?: unknown } }).firstTask?.taskRoot === 'string'
  ) {
    return (result as { firstTask: { taskRoot: string } }).firstTask.taskRoot;
  }

  return undefined;
}

async function notifyOfficialJudgeResult(
  report: OfficialJudgeReport,
  force: boolean,
): Promise<void> {
  const messageParts = [`${force ? '已强制提交到头哥' : '已提交到头哥（高级）'}：${formatOfficialJudgeHeadline(report)}`];
  if (report.summary.message) {
    messageParts.push(report.summary.message);
  }
  const messageText = messageParts.join(' · ');

  if (report.summary.verdict === 'passed') {
    await vscode.window.showInformationMessage(messageText);
    return;
  }

  await vscode.window.showErrorMessage(messageText);
}

function formatOfficialJudgeHeadline(report: OfficialJudgeReport): string {
  const prefix = report.summary.verdict === 'passed' ? '已通过' : '未通过';
  if (
    typeof report.summary.passedCount === 'number' &&
    Number.isFinite(report.summary.passedCount) &&
    typeof report.summary.totalCount === 'number' &&
    Number.isFinite(report.summary.totalCount) &&
    report.summary.totalCount > 0
  ) {
    return `${prefix} ${report.summary.passedCount}/${report.summary.totalCount}`;
  }

  return prefix;
}

function createDefaultOpenTaskDeps(_context: vscode.ExtensionContext) {
  const runtime = getActiveRuntime();
  const client = runtime.client;
  return {
    taskDetailClient: new TaskDetailClient(client),
    sourceClient: new SourceFetchClient(client),
    hiddenTestClient: new HiddenTestFetchClient(client),
    repositoryClient: new RepositoryFetchClient(client),
    problemClient: createProblemClient(runtime),
    templateClient: new TemplateFetchClient(client),
    passedClient: new PassedFetchClient(client),
    onTaskOpened: async (taskRoot: string) => setStoredLastOpenedTaskRoot(_context, taskRoot),
  };
}

function createDefaultRollbackDeps(_context: vscode.ExtensionContext) {
  const client = getActiveRuntime().client;
  return {
    taskDetailClient: new TaskDetailClient(client),
    templateClient: new TemplateFetchClient(client),
    passedClient: new PassedFetchClient(client),
  };
}

function createDefaultSyncTaskPackageDeps(_context: vscode.ExtensionContext) {
  const runtime = getActiveRuntime();
  const client = runtime.client;
  return {
    taskDetailClient: new TaskDetailClient(client),
    sourceClient: new SourceFetchClient(client),
    hiddenTestClient: new HiddenTestFetchClient(client),
    repositoryClient: new RepositoryFetchClient(client),
    problemClient: createProblemClient(runtime),
    templateClient: new TemplateFetchClient(client),
    passedClient: new PassedFetchClient(client),
  };
}

function createDefaultHistoryDeps(_context: vscode.ExtensionContext) {
  const client = getActiveRuntime().client;
  return {
    historyClient: new HistoryFetchClient(client),
  };
}

function createDefaultRepositoryDeps(_context: vscode.ExtensionContext) {
  const client = getActiveRuntime().client;
  return {
    repositoryClient: new RepositoryFetchClient(client),
    sourceClient: new SourceFetchClient(client),
  };
}

function createDefaultAnswerDeps(_context: vscode.ExtensionContext) {
  const client = getActiveRuntime().client;
  return {
    answerClient: new AnswerFetchClient(client),
    window: vscode.window,
  };
}

function getActiveRuntime(): ExtensionRuntime {
  if (!activeRuntime) {
    throw new Error('Educoder runtime is unavailable.');
  }

  return activeRuntime;
}

function createProblemClient(runtime: ExtensionRuntime): ProblemFetchClient {
  return new ProblemFetchClient({
    fetchTaskPageHtml: async ({ taskId, homeworkId }) => {
      const session = await runtime.resolveSession();
      const taskUrl = new URL(`https://www.educoder.net/tasks/${taskId}`);
      if (homeworkId) {
        taskUrl.searchParams.set('homework_common_id', homeworkId);
      }

      const response = await fetch(taskUrl, {
        headers: {
          Cookie: buildEducoderCookieHeader(session),
          Accept: 'text/html,application/xhtml+xml',
        },
      });

      return {
        url: response.url || taskUrl.toString(),
        html: await response.text(),
        contentType: response.headers.get('content-type') ?? undefined,
      };
    },
  });
}
