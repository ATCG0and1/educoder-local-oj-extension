import * as vscode from 'vscode';
import { AnswerFetchClient } from './core/api/answerFetchClient.js';
import { EducoderClient } from './core/api/educoderClient.js';
import { createFetchTransport } from './core/api/fetchTransport.js';
import { HiddenTestFetchClient } from './core/api/hiddenTestFetchClient.js';
import { HistoryFetchClient } from './core/api/historyFetchClient.js';
import { PassedFetchClient } from './core/api/passedFetchClient.js';
import { SourceFetchClient } from './core/api/sourceFetchClient.js';
import { TaskDetailClient } from './core/api/taskDetailClient.js';
import { TemplateFetchClient } from './core/api/templateFetchClient.js';
import {
  resolveSession,
  type SessionCookies,
} from './core/auth/sessionManager.js';
import { promptEducoderLogin } from './core/auth/loginFlow.js';
import {
  configureDefaultOfficialJudgeExecutor,
  createOfficialJudgeExecutor,
} from './core/remote/officialJudgeExecutor.js';
import { forceRunOfficialJudgeCommand } from './commands/forceRunOfficialJudge.js';
import { openTaskCommand } from './commands/openTask.js';
import { rerunFailedCases } from './commands/rerunFailedCases.js';
import { rollbackPassed } from './commands/rollbackPassed.js';
import { rollbackTemplate } from './commands/rollbackTemplate.js';
import { restoreHistorySnapshot } from './commands/restoreHistorySnapshot.js';
import { runLocalJudgeCommand } from './commands/runLocalJudge.js';
import { runOfficialJudgeCommand } from './commands/runOfficialJudge.js';
import { syncTaskHistory } from './commands/syncTaskHistory.js';
import { syncCurrentCollection } from './commands/syncCurrentCollection.js';

const frozenCommands = [
  'educoderLocalOj.syncCurrentCollection',
  'educoderLocalOj.openTask',
  'educoderLocalOj.runLocalJudge',
  'educoderLocalOj.rerunFailedCases',
  'educoderLocalOj.runOfficialJudge',
  'educoderLocalOj.forceRunOfficialJudge',
  'educoderLocalOj.rollbackTemplate',
  'educoderLocalOj.rollbackPassed',
  'educoderLocalOj.syncTaskHistory',
  'educoderLocalOj.restoreHistorySnapshot',
] as const;

let activated = false;
const commandServiceOverrides = new Map<string, (...args: unknown[]) => unknown>();
let activeContext: vscode.ExtensionContext | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  if (activated) {
    return;
  }

  activeContext = context;
  configureDefaultOfficialJudgeExecutor(createOfficialJudgeExecutor(createDefaultEducoderClient(context)));

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
  const queryIndex = typeof args[1] === 'number' ? args[1] : undefined;
  const override = commandServiceOverrides.get(commandId);

  if (override) {
    return override(...args);
  }

  const context = activeContext;
  if (!context) {
    throw new Error('Extension context is unavailable.');
  }

  switch (commandId) {
    case 'educoderLocalOj.syncCurrentCollection':
      return syncCurrentCollection({
        context,
        window: vscode.window,
        clipboardEnv: vscode.env,
        input: vscode.window,
        client: createDefaultEducoderClient(context),
      });
    case 'educoderLocalOj.openTask':
      return taskRoot
        ? openTaskCommand(taskRoot, createDefaultOpenTaskDeps(context))
        : undefined;
    case 'educoderLocalOj.runLocalJudge':
      return taskRoot ? runLocalJudgeCommand(taskRoot) : undefined;
    case 'educoderLocalOj.rerunFailedCases':
      return taskRoot ? rerunFailedCases(taskRoot) : undefined;
    case 'educoderLocalOj.runOfficialJudge':
      return taskRoot ? runOfficialJudgeCommand(taskRoot) : undefined;
    case 'educoderLocalOj.forceRunOfficialJudge':
      return taskRoot ? forceRunOfficialJudgeCommand(taskRoot) : undefined;
    case 'educoderLocalOj.rollbackTemplate':
      return taskRoot ? rollbackTemplate(taskRoot, createDefaultRollbackDeps(context)) : undefined;
    case 'educoderLocalOj.rollbackPassed':
      return taskRoot ? rollbackPassed(taskRoot, createDefaultRollbackDeps(context)) : undefined;
    case 'educoderLocalOj.syncTaskHistory':
      return taskRoot ? syncTaskHistory(taskRoot, createDefaultHistoryDeps(context)) : undefined;
    case 'educoderLocalOj.restoreHistorySnapshot':
      return taskRoot && queryIndex !== undefined
        ? restoreHistorySnapshot(taskRoot, queryIndex, createDefaultHistoryDeps(context))
        : undefined;
    default:
      return undefined;
  }
}

function createDefaultEducoderClient(context: vscode.ExtensionContext): EducoderClient {
  return new EducoderClient({
    transport: createFetchTransport(),
    resolveSession: () =>
      resolveSession({
        context,
        validate: validateSessionShape,
        login: () => promptEducoderLogin({ window: vscode.window }),
      }),
  });
}

function createDefaultOpenTaskDeps(context: vscode.ExtensionContext) {
  const client = createDefaultEducoderClient(context);
  return {
    taskDetailClient: new TaskDetailClient(client),
    sourceClient: new SourceFetchClient(client),
    hiddenTestClient: new HiddenTestFetchClient(client),
    templateClient: new TemplateFetchClient(client),
    passedClient: new PassedFetchClient(client),
    answerClient: new AnswerFetchClient(client),
  };
}

function createDefaultRollbackDeps(context: vscode.ExtensionContext) {
  const client = createDefaultEducoderClient(context);
  return {
    taskDetailClient: new TaskDetailClient(client),
    templateClient: new TemplateFetchClient(client),
    passedClient: new PassedFetchClient(client),
  };
}

function createDefaultHistoryDeps(context: vscode.ExtensionContext) {
  const client = createDefaultEducoderClient(context);
  return {
    historyClient: new HistoryFetchClient(client),
  };
}

async function validateSessionShape(cookies: SessionCookies): Promise<boolean> {
  return Boolean(cookies._educoder_session?.trim());
}
