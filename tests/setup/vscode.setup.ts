import { beforeAll, beforeEach, vi } from 'vitest';

const registeredCommands = new Map<string, (...args: unknown[]) => unknown>();
const globalStateStore = new Map<string, unknown>();
const secretStateStore = new Map<string, string>();
const clipboardReadText = vi.fn(async () => '');
const showOpenDialog = vi.fn(async () => undefined);
const showInputBox = vi.fn(async () => undefined);
const showErrorMessage = vi.fn(async () => undefined);
const showInformationMessage = vi.fn(async () => undefined);
const createdPanels: any[] = [];
const createWebviewPanel = vi.fn(
  (
    viewType: string,
    title: string,
    column: number,
    options: Record<string, unknown>,
  ) => {
    let disposeListener: (() => void) | undefined;
    const panel = {
      viewType,
      title,
      column,
      options,
      webview: {
        html: '',
      },
      reveal: vi.fn(),
      onDidDispose: (listener: () => void) => {
        disposeListener = listener;
        return { dispose: vi.fn() };
      },
      dispose: () => {
        disposeListener?.();
      },
    };
    createdPanels.push(panel);
    return panel;
  },
);

const mockContext = {
  subscriptions: [],
  globalState: {
    get: <T>(key: string) => globalStateStore.get(key) as T | undefined,
    update: async (key: string, value: unknown) => {
      globalStateStore.set(key, value);
    },
  },
  secrets: {
    get: async (key: string) => secretStateStore.get(key),
    store: async (key: string, value: string) => {
      secretStateStore.set(key, value);
    },
    delete: async (key: string) => {
      secretStateStore.delete(key);
    },
  },
};

function resetMockState(): void {
  globalStateStore.clear();
  secretStateStore.clear();
  clipboardReadText.mockReset();
  clipboardReadText.mockResolvedValue('');
  showOpenDialog.mockReset();
  showOpenDialog.mockResolvedValue(undefined);
  showInputBox.mockReset();
  showInputBox.mockResolvedValue(undefined);
  showErrorMessage.mockReset();
  showErrorMessage.mockResolvedValue(undefined);
  showInformationMessage.mockReset();
  showInformationMessage.mockResolvedValue(undefined);
  createWebviewPanel.mockClear();
  createdPanels.splice(0, createdPanels.length);
}

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
  env: {
    clipboard: {
      readText: clipboardReadText,
    },
  },
  window: {
    showOpenDialog,
    showInputBox,
    showErrorMessage,
    showInformationMessage,
    createWebviewPanel,
  },
  ViewColumn: {
    Active: 1,
  },
  __mock: {
    context: mockContext,
    globalStateStore,
    secretStateStore,
    clipboardReadText,
    showOpenDialog,
    showInputBox,
    showErrorMessage,
    showInformationMessage,
    createWebviewPanel,
    createdPanels,
    reset: resetMockState,
  },
}));

beforeEach(() => {
  resetMockState();
});

beforeAll(async () => {
  const { activate } = await import('../../src/extension.js');
  await activate(mockContext as any);
});
