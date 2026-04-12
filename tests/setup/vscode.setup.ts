import { beforeAll, beforeEach, vi } from 'vitest';

const registeredCommands = new Map<string, (...args: unknown[]) => unknown>();
const globalStateStore = new Map<string, unknown>();
const secretStateStore = new Map<string, string>();
const clipboardReadText = vi.fn(async () => '');
const showOpenDialog = vi.fn(async () => undefined);
const showInputBox = vi.fn(async (options?: { value?: string }) => options?.value);
const showQuickPick = vi.fn(async () => undefined);
const showWarningMessage = vi.fn(async () => undefined);
const showErrorMessage = vi.fn(async () => undefined);
const showInformationMessage = vi.fn(async () => undefined);
const saveAll = vi.fn(async () => true);
const openTextDocument = vi.fn(async (target: { fsPath?: string } | string) => ({
  uri: typeof target === 'string' ? { fsPath: target, scheme: 'file' } : target,
  fileName: typeof target === 'string' ? target : target.fsPath,
}));
const showTextDocument = vi.fn(async (document: unknown) => document);
const workspaceFolders: Array<{ uri: { fsPath: string; scheme: string }; name?: string }> = [];
const updateWorkspaceFolders = vi.fn(
  (
    start: number,
    deleteCount?: number,
    ...folders: Array<{ uri: { fsPath: string; scheme: string }; name?: string }>
  ) => {
    workspaceFolders.splice(start, deleteCount ?? 0, ...folders.filter(Boolean));
    return true;
  },
);
const withProgress = vi.fn(async (_options: unknown, task: (progress: { report(value: { message?: string; increment?: number }): void }) => Promise<unknown>) =>
  task({ report: () => undefined }),
);
const createdPanels: any[] = [];
const createdOutputChannels: any[] = [];
const registeredViewProviders = new Map<string, any>();
const registeredTreeProviders = new Map<string, any>();
const createdViews: any[] = [];
const createWebviewPanel = vi.fn(
  (
    viewType: string,
    title: string,
    column: number,
    options: Record<string, unknown>,
  ) => {
    let disposeListener: (() => void) | undefined;
    let messageListener: ((message: unknown) => void) | undefined;
    const panel = {
      viewType,
      title,
      column,
      options,
      webview: {
        html: '',
        onDidReceiveMessage: (listener: (message: unknown) => void) => {
          messageListener = listener;
          return { dispose: vi.fn() };
        },
      },
      reveal: vi.fn(),
      onDidDispose: (listener: () => void) => {
        disposeListener = listener;
        return { dispose: vi.fn() };
      },
      dispose: () => {
      disposeListener?.();
      },
      __dispatchMessage: (message: unknown) => {
        return messageListener?.(message);
      },
    };
    createdPanels.push(panel);
    return panel;
  },
);
const registerWebviewViewProvider = vi.fn((viewId: string, provider: unknown) => {
  registeredViewProviders.set(viewId, provider);
  return {
    dispose: () => {
      registeredViewProviders.delete(viewId);
    },
  };
});
const registerTreeDataProvider = vi.fn((viewId: string, provider: unknown) => {
  registeredTreeProviders.set(viewId, provider);
  return {
    dispose: () => {
      registeredTreeProviders.delete(viewId);
    },
  };
});

const createOutputChannel = vi.fn((name: string) => {
  const channel = {
    name,
    appendLine: vi.fn(),
    show: vi.fn(),
    dispose: vi.fn(),
  };
  createdOutputChannels.push(channel);
  return channel;
});

const executeCommand = vi.fn(async (command: string, ...args: unknown[]) => {
  const handler = registeredCommands.get(command);
  if (!handler) {
    return undefined;
  }

  return handler(...args);
});

class EventEmitter<T> {
  private listeners: Array<(value: T | undefined) => void> = [];

  public readonly event = (listener: (value: T | undefined) => void) => {
    this.listeners.push(listener);
    return {
      dispose: () => {
        this.listeners = this.listeners.filter((item) => item !== listener);
      },
    };
  };

  fire(value?: T): void {
    for (const listener of this.listeners) {
      listener(value);
    }
  }

  dispose(): void {
    this.listeners = [];
  }
}

class ThemeIcon {
  constructor(
    public readonly id: string,
    public readonly color?: unknown,
  ) {}
}

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
  showInputBox.mockImplementation(async (options?: { value?: string }) => options?.value);
  showQuickPick.mockReset();
  showQuickPick.mockResolvedValue(undefined);
  showWarningMessage.mockReset();
  showWarningMessage.mockResolvedValue(undefined);
  showErrorMessage.mockReset();
  showErrorMessage.mockResolvedValue(undefined);
  showInformationMessage.mockReset();
  showInformationMessage.mockResolvedValue(undefined);
  saveAll.mockReset();
  saveAll.mockResolvedValue(true);
  openTextDocument.mockReset();
  openTextDocument.mockImplementation(async (target: { fsPath?: string } | string) => ({
    uri: typeof target === 'string' ? { fsPath: target, scheme: 'file' } : target,
    fileName: typeof target === 'string' ? target : target.fsPath,
  }));
  showTextDocument.mockReset();
  showTextDocument.mockImplementation(async (document: unknown) => document);
  workspaceFolders.splice(0, workspaceFolders.length);
  updateWorkspaceFolders.mockReset();
  updateWorkspaceFolders.mockImplementation(
    (
      start: number,
      deleteCount?: number,
      ...folders: Array<{ uri: { fsPath: string; scheme: string }; name?: string }>
    ) => {
      workspaceFolders.splice(start, deleteCount ?? 0, ...folders.filter(Boolean));
      return true;
    },
  );
  withProgress.mockReset();
  withProgress.mockImplementation(async (_options: unknown, task: (progress: { report(value: { message?: string; increment?: number }): void }) => Promise<unknown>) =>
    task({ report: () => undefined }),
  );
  createWebviewPanel.mockClear();
  registerWebviewViewProvider.mockClear();
  registerTreeDataProvider.mockClear();
  createOutputChannel.mockClear();
  executeCommand.mockClear();
  createdPanels.splice(0, createdPanels.length);
  createdOutputChannels.splice(0, createdOutputChannels.length);
  createdViews.splice(0, createdViews.length);
}

async function resolveWebviewView(viewId: string): Promise<any | undefined> {
  const provider = registeredViewProviders.get(viewId);
  if (!provider) {
    return undefined;
  }

  let messageListener: ((message: unknown) => void) | undefined;
  const view = {
    viewType: viewId,
    webview: {
      html: '',
      options: {},
      onDidReceiveMessage: (listener: (message: unknown) => void) => {
        messageListener = listener;
        return { dispose: vi.fn() };
      },
    },
    __dispatchMessage: (message: unknown) => {
      return messageListener?.(message);
    },
  };
  createdViews.push(view);
  await provider.resolveWebviewView(view);
  return view;
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
    executeCommand,
  },
  env: {
    clipboard: {
      readText: clipboardReadText,
    },
  },
  window: {
    showOpenDialog,
    showInputBox,
    showQuickPick,
    showWarningMessage,
    showErrorMessage,
    showInformationMessage,
    showTextDocument,
    withProgress,
    createWebviewPanel,
    createOutputChannel,
    registerWebviewViewProvider,
    registerTreeDataProvider,
  },
  workspace: {
    get workspaceFolders() {
      return workspaceFolders.length > 0 ? workspaceFolders : undefined;
    },
    saveAll,
    openTextDocument,
    updateWorkspaceFolders,
  },
  ProgressLocation: {
    Notification: 15,
  },
  TreeItemCollapsibleState: {
    None: 0,
    Collapsed: 1,
    Expanded: 2,
  },
  EventEmitter,
  ThemeIcon,
  ViewColumn: {
    Active: 1,
  },
  Uri: {
    file: (fsPath: string) => ({ fsPath, scheme: 'file' }),
  },
  __mock: {
    context: mockContext,
    globalStateStore,
    secretStateStore,
    clipboardReadText,
    showOpenDialog,
    showInputBox,
    showQuickPick,
    showWarningMessage,
    showErrorMessage,
    showInformationMessage,
    saveAll,
    openTextDocument,
    showTextDocument,
    updateWorkspaceFolders,
    workspaceFolders,
    withProgress,
    createWebviewPanel,
    createOutputChannel,
    registerWebviewViewProvider,
    registerTreeDataProvider,
    executeCommand,
    registeredViewProviders,
    registeredTreeProviders,
    createdPanels,
    createdOutputChannels,
    createdViews,
    resolveWebviewView,
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
