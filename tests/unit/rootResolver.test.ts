import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { getStoredRootFolderUri, ROOT_FOLDER_URI_KEY } from '../../src/core/config/extensionState.js';
import { ensureRootFolder, getProductRoot } from '../../src/core/config/rootResolver.js';

interface TestContext {
  globalState: {
    get<T>(key: string): T | undefined;
    update(key: string, value: string): Promise<void>;
  };
}

function createContext(initialRootFolderUri?: string): TestContext {
  const store = new Map<string, string>();

  if (initialRootFolderUri) {
    store.set(ROOT_FOLDER_URI_KEY, initialRootFolderUri);
  }

  return {
    globalState: {
      get: <T>(key: string) => store.get(key) as T | undefined,
      update: async (key: string, value: string) => {
        store.set(key, value);
      },
    },
  };
}

describe('rootResolver', () => {
  it('remembers the user-selected root folder as a file uri and reuses it', async () => {
    const rootFolderPath = path.join('C:', 'workspace');
    const context = createContext();
    const showOpenDialog = vi.fn(async () => [{ fsPath: rootFolderPath }]);

    await expect(ensureRootFolder({ context, window: { showOpenDialog } })).resolves.toBe(rootFolderPath);
    await expect(ensureRootFolder({ context, window: { showOpenDialog } })).resolves.toBe(rootFolderPath);

    expect(getStoredRootFolderUri(context)).toBe(pathToFileURL(rootFolderPath).toString());
    expect(showOpenDialog).toHaveBeenCalledTimes(1);
  });

  it('shares one in-flight first-use folder prompt across concurrent callers', async () => {
    const rootFolderPath = path.join('C:', 'workspace');
    const context = createContext();

    let resolveSelection!: (value: { fsPath: string }[]) => void;
    const showOpenDialog = vi.fn(
      () =>
        new Promise<{ fsPath: string }[]>((resolve) => {
          resolveSelection = resolve;
        }),
    );

    const firstCall = ensureRootFolder({ context, window: { showOpenDialog } });
    const secondCall = ensureRootFolder({ context, window: { showOpenDialog } });

    expect(showOpenDialog).toHaveBeenCalledTimes(1);

    resolveSelection([{ fsPath: rootFolderPath }]);

    await expect(firstCall).resolves.toBe(rootFolderPath);
    await expect(secondCall).resolves.toBe(rootFolderPath);
    expect(getStoredRootFolderUri(context)).toBe(pathToFileURL(rootFolderPath).toString());
  });

  it('returns Educoder Local OJ under the stored root uri', async () => {
    const rootFolderPath = path.join('C:', 'workspace');
    const context = createContext(pathToFileURL(rootFolderPath).toString());
    const showOpenDialog = vi.fn();

    await expect(getProductRoot({ context, window: { showOpenDialog } })).resolves.toBe(
      path.join(rootFolderPath, 'Educoder Local OJ'),
    );

    expect(showOpenDialog).not.toHaveBeenCalled();
  });

  it('rejects empty selection', async () => {
    const context = createContext();

    await expect(
      ensureRootFolder({
        context,
        window: {
          showOpenDialog: async () => [],
        },
      }),
    ).rejects.toThrow('请选择本地 OJ 根目录');
  });

  it('rejects when the folder picker is cancelled', async () => {
    const context = createContext();

    await expect(
      ensureRootFolder({
        context,
        window: {
          showOpenDialog: async () => undefined,
        },
      }),
    ).rejects.toThrow('请选择本地 OJ 根目录');
  });
});
