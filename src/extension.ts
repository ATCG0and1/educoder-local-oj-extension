import * as vscode from 'vscode';

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

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  if (activated) {
    return;
  }

  for (const commandId of frozenCommands) {
    const disposable = vscode.commands.registerCommand(commandId, () => undefined);
    context.subscriptions.push(disposable);
  }

  activated = true;
}

export function deactivate(): void {
  activated = false;
}
