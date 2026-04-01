import * as vscode from 'vscode';
import { forceRunOfficialJudgeCommand } from './commands/forceRunOfficialJudge.js';
import { openTaskCommand } from './commands/openTask.js';
import { rerunFailedCases } from './commands/rerunFailedCases.js';
import { rollbackPassed } from './commands/rollbackPassed.js';
import { rollbackTemplate } from './commands/rollbackTemplate.js';
import { runLocalJudgeCommand } from './commands/runLocalJudge.js';
import { runOfficialJudgeCommand } from './commands/runOfficialJudge.js';
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
] as const;

let activated = false;
const commandServiceOverrides = new Map<string, (...args: unknown[]) => unknown>();

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  if (activated) {
    return;
  }

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

  switch (commandId) {
    case 'educoderLocalOj.syncCurrentCollection':
      throw new Error('syncCurrentCollection service is not configured.');
    case 'educoderLocalOj.openTask':
      return taskRoot ? openTaskCommand(taskRoot) : undefined;
    case 'educoderLocalOj.runLocalJudge':
      return taskRoot ? runLocalJudgeCommand(taskRoot) : undefined;
    case 'educoderLocalOj.rerunFailedCases':
      return taskRoot ? rerunFailedCases(taskRoot) : undefined;
    case 'educoderLocalOj.runOfficialJudge':
      return taskRoot ? runOfficialJudgeCommand(taskRoot) : undefined;
    case 'educoderLocalOj.forceRunOfficialJudge':
      return taskRoot ? forceRunOfficialJudgeCommand(taskRoot) : undefined;
    case 'educoderLocalOj.rollbackTemplate':
      return taskRoot ? rollbackTemplate(taskRoot) : undefined;
    case 'educoderLocalOj.rollbackPassed':
      return taskRoot ? rollbackPassed(taskRoot) : undefined;
    default:
      return undefined;
  }
}
