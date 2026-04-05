import { describe, expect, it, vi } from 'vitest';
import { createExtensionRuntime } from '../../src/core/runtime/extensionRuntime.js';
import { bindProductRootToWorkspace } from '../../src/core/workspace/workspaceBinding.js';
import {
  SESSION_CACHE_KEY,
  type SessionContextLike,
  type SessionCookies,
} from '../../src/core/auth/sessionManager.js';

function createContext(initialSession?: SessionCookies): SessionContextLike {
  const store = new Map<string, unknown>();

  if (initialSession) {
    store.set(SESSION_CACHE_KEY, initialSession);
  }

  return {
    globalState: {
      get: <T>(key: string) => store.get(key) as T | undefined,
      update: async (key: string, value: unknown) => {
        store.set(key, value);
      },
    },
  };
}

describe('createExtensionRuntime', () => {
  it('validates cached sessions through a homepage probe instead of shape-only checks', async () => {
    const cachedSession: SessionCookies = {
      _educoder_session: 'cached-session',
      autologin_trustie: 'cached-trustie',
    };
    const fetchImpl = vi.fn(async (input: URL | RequestInfo) => {
      const url = String(input);
      if (url === 'https://www.educoder.net/') {
        return new Response('<html><body><div>workspace</div></body></html>', {
          status: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
          },
        });
      }

      return new Response('{}', {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }) as unknown as typeof fetch;

    const runtime = createExtensionRuntime({
      context: createContext(cachedSession),
      outputChannel: {
        appendLine: vi.fn(),
        show: vi.fn(),
      },
      window: {
        showInformationMessage: vi.fn(async () => undefined),
      },
      fetchImpl,
      loadFromEdge: vi.fn(async () => undefined),
      login: vi.fn(async () => undefined),
    });

    await expect(runtime.resolveSession()).resolves.toEqual(cachedSession);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://www.educoder.net/',
      expect.objectContaining({
        headers: expect.objectContaining({
          Cookie: '_educoder_session=cached-session; autologin_trustie=cached-trustie',
        }),
      }),
    );
  });

  it('shares a request inventory across client calls', async () => {
    const cachedSession: SessionCookies = {
      _educoder_session: 'cached-session',
      autologin_trustie: 'cached-trustie',
    };
    const fetchImpl = vi.fn(async (input: URL | RequestInfo) => {
      const url = String(input);
      if (url === 'https://www.educoder.net/') {
        return new Response('<html><body><div>workspace</div></body></html>', {
          status: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
          },
        });
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }) as unknown as typeof fetch;

    const runtime = createExtensionRuntime({
      context: createContext(cachedSession),
      outputChannel: {
        appendLine: vi.fn(),
        show: vi.fn(),
      },
      window: {
        showInformationMessage: vi.fn(async () => undefined),
      },
      fetchImpl,
      loadFromEdge: vi.fn(async () => undefined),
      login: vi.fn(async () => undefined),
    });

    await expect(runtime.client.get('/api/demo')).resolves.toEqual({ ok: true });

    expect(runtime.apiInventory.list()).toEqual([
      expect.objectContaining({
        method: 'GET',
        host: 'data.educoder.net',
        path: '/api/demo',
        calls: 1,
      }),
    ]);
  });
});

describe('bindProductRootToWorkspace', () => {
  it('adds the synced product root into the current VS Code workspace when absent', async () => {
    const updateWorkspaceFolders = vi.fn(() => true);

    const result = await bindProductRootToWorkspace('C:/Users/test/Educoder Local OJ', {
      workspace: {
        workspaceFolders: [],
        updateWorkspaceFolders,
      },
      uriFile: (fsPath: string) => ({ fsPath, scheme: 'file' }),
    });

    expect(updateWorkspaceFolders).toHaveBeenCalledWith(
      0,
      0,
      expect.objectContaining({
        name: 'Educoder Local OJ',
        uri: expect.objectContaining({ fsPath: 'C:/Users/test/Educoder Local OJ' }),
      }),
    );
    expect(result).toMatchObject({
      added: true,
      alreadyPresent: false,
    });
  });

  it('does not duplicate the synced product root when it is already in the workspace', async () => {
    const updateWorkspaceFolders = vi.fn(() => true);

    const result = await bindProductRootToWorkspace('C:/Users/test/Educoder Local OJ', {
      workspace: {
        workspaceFolders: [
          {
            name: 'Educoder Local OJ',
            uri: { fsPath: 'C:/Users/test/Educoder Local OJ', scheme: 'file' },
          },
        ],
        updateWorkspaceFolders,
      },
      uriFile: (fsPath: string) => ({ fsPath, scheme: 'file' }),
    });

    expect(updateWorkspaceFolders).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      added: false,
      alreadyPresent: true,
    });
  });
});
