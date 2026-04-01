import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { getStoredRootFolderUri } from '../../src/core/config/extensionState.js';
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
    store.set('rootFolderUri', initialRootFolderUri);
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
  it('remembers the user-selected root folder', async () => {
    const context = createContext();
    const showOpenDialog = vi.fn(async () => [{ fsPath: path.join('C:', 'workspace') }]);

    await expect(ensureRootFolder({ context, window: { showOpenDialog } })).resolves.toBe(
      path.join('C:', 'workspace'),
    );
    await expect(ensureRootFolder({ context, window: { showOpenDialog } })).resolves.toBe(
      path.join('C:', 'workspace'),
    );

    expect(getStoredRootFolderUri(context)).toBe(path.join('C:', 'workspace'));
    expect(showOpenDialog).toHaveBeenCalledTimes(1);
  });

  it('returns Educoder Local OJ under that root', async () => {
    const context = createContext(path.join('C:', 'workspace'));
    const showOpenDialog = vi.fn();

    await expect(getProductRoot({ context, window: { showOpenDialog } })).resolves.toBe(
      path.join('C:', 'workspace', 'Educoder Local OJ'),
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
});
