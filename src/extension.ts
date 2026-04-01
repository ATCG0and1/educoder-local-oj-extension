export interface Disposable {
  dispose(): void;
}

export interface ExtensionContext {
  subscriptions: Disposable[];
}

type CommandHandler = (...args: unknown[]) => unknown;

const registeredHandlers = new Map<string, CommandHandler>();
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

export const commands = {
  registerCommand(command: string, handler: CommandHandler): Disposable {
    registeredHandlers.set(command, handler);
    return {
      dispose() {
        registeredHandlers.delete(command);
      },
    };
  },
  async getCommands(_filterInternal?: boolean): Promise<string[]> {
    return [...registeredHandlers.keys()];
  },
};

export async function activate(context: ExtensionContext): Promise<void> {
  if (activated) {
    return;
  }

  for (const commandId of frozenCommands) {
    const disposable = commands.registerCommand(commandId, () => undefined);
    context.subscriptions.push(disposable);
  }

  activated = true;
}

export function deactivate(): void {
  registeredHandlers.clear();
  activated = false;
}

await activate({ subscriptions: [] });
