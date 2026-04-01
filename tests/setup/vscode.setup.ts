import { beforeAll, vi } from 'vitest';

const registeredCommands = new Map<string, (...args: unknown[]) => unknown>();

vi.mock('vscode', () => ({
  commands: {
    registerCommand: (command: string, handler: (...args: unknown[]) => unknown) => {
      registeredCommands.set(command, handler);
      return {
        dispose: () => {
          registeredCommands.delete(command);
        },
      };
    },
    getCommands: async (_filterInternal?: boolean) => [...registeredCommands.keys()],
    executeCommand: async (command: string, ...args: unknown[]) => {
      const handler = registeredCommands.get(command);
      if (!handler) {
        throw new Error(`Command not found: ${command}`);
      }

      return handler(...args);
    },
  },
}));

beforeAll(async () => {
  const { activate } = await import('../../src/extension.js');
  await activate({ subscriptions: [] } as any);
});
