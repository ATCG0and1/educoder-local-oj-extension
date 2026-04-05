import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getStoredRootFolderUri, ROOT_FOLDER_URI_KEY } from '../../src/core/config/extensionState.js';
import { ensureRootFolder, getProductRoot, pickRootFolder } from '../../src/core/config/rootResolver.js';

interface TestContext {
  globalState: {
    get<T>(key: string): T | undefined;
    update(key: string, value: string): Promise<void>;
  };
}

const tempDirs: string[] = [];

async function createTempRoot(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'educoder-root-resolver-'));
  tempDirs.push(dir);
  return dir;
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

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('rootResolver', () => {
  it('auto-prompts for the task-package root in product language and then reuses it', async () => {
    const rootFolderPath = await createTempRoot();
    const context = createContext();
    const showOpenDialog = vi.fn(async () => [{ fsPath: rootFolderPath }]);

    await expect(getProductRoot({ context, window: { showOpenDialog } })).resolves.toBe(
      path.join(rootFolderPath, 'Educoder Local OJ'),
    );
    await expect(getProductRoot({ context, window: { showOpenDialog } })).resolves.toBe(
      path.join(rootFolderPath, 'Educoder Local OJ'),
    );

    expect(showOpenDialog).toHaveBeenCalledTimes(1);
    expect(showOpenDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        openLabel: '选择题目包存放目录',
      }),
    );
  });

  it('remembers the user-selected root folder as a file uri and reuses it', async () => {
    const rootFolderPath = await createTempRoot();
    const context = createContext();
    const showOpenDialog = vi.fn(async () => [{ fsPath: rootFolderPath }]);

    await expect(ensureRootFolder({ context, window: { showOpenDialog } })).resolves.toBe(rootFolderPath);
    await expect(ensureRootFolder({ context, window: { showOpenDialog } })).resolves.toBe(rootFolderPath);

    expect(getStoredRootFolderUri(context)).toBe(pathToFileURL(rootFolderPath).toString());
    expect(showOpenDialog).toHaveBeenCalledTimes(1);
  });

  it('shares one in-flight first-use folder prompt across concurrent callers', async () => {
    const rootFolderPath = await createTempRoot();
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
    const rootFolderPath = await createTempRoot();
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
    ).rejects.toThrow('请选择题目包存放目录');
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
    ).rejects.toThrow('请选择题目包存放目录');
  });

  it('reprompts when the remembered root folder no longer exists', async () => {
    const missingRoot = path.join(os.tmpdir(), 'educoder-root-resolver-missing');
    const replacementRoot = await createTempRoot();
    const context = createContext(pathToFileURL(missingRoot).toString());
    const showOpenDialog = vi.fn(async () => [{ fsPath: replacementRoot }]);

    await expect(ensureRootFolder({ context, window: { showOpenDialog } })).resolves.toBe(replacementRoot);

    expect(showOpenDialog).toHaveBeenCalledTimes(1);
    expect(getStoredRootFolderUri(context)).toBe(pathToFileURL(replacementRoot).toString());
  });

  it('lets the user explicitly replace the remembered root folder', async () => {
    const initialRoot = await createTempRoot();
    const nextRoot = await createTempRoot();
    const context = createContext(pathToFileURL(initialRoot).toString());
    const showOpenDialog = vi.fn(async () => [{ fsPath: nextRoot }]);

    await expect(pickRootFolder({ context, window: { showOpenDialog } })).resolves.toBe(nextRoot);

    expect(showOpenDialog).toHaveBeenCalledTimes(1);
    expect(getStoredRootFolderUri(context)).toBe(pathToFileURL(nextRoot).toString());
  });
});
