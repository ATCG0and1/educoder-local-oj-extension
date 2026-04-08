import { describe, expect, it, vi } from 'vitest';
import {
  EDGE_REUSE_LOGIN_PROMPT_MESSAGE,
  EDGE_REUSE_SESSION_NOT_FOUND_ERROR_MESSAGE,
  launchEdgeReuseWindow,
  promptEdgeReuseLogin,
} from '../../src/core/auth/edgeReuseLogin.js';
import { EDGE_DEBUG_PORT_STATE_KEY } from '../../src/core/auth/edgeDebugPortStore.js';
import { LOGIN_CONFIRM_LABEL } from '../../src/core/auth/loginFlow.js';
import type { SessionCookies } from '../../src/core/auth/sessionManager.js';

function createContext() {
  const store = new Map<string, unknown>();

  return {
    globalState: {
      get: <T>(key: string) => store.get(key) as T | undefined,
      update: async (key: string, value: unknown) => {
        store.set(key, value);
      },
    },
    __store: store,
  };
}

describe('launchEdgeReuseWindow', () => {
  it('launches the default Edge profile in devtools mode and persists the port', async () => {
    const context = createContext();
    const output = {
      appendLine: vi.fn(),
      show: vi.fn(),
    };
    const spawnProcess = vi.fn<
      (
        command: string,
        args: string[],
        options: {
          stdio: 'ignore';
          windowsHide: boolean;
        },
      ) => unknown
    >(() => ({}));

    await expect(
      launchEdgeReuseWindow({
        context: context as any,
        output,
        resolveEdgePath: async () => 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        findAvailablePort: async () => 9333,
        spawnProcess,
        waitForDebugger: async () => undefined,
      }),
    ).resolves.toEqual({
      port: 9333,
      url: 'https://www.educoder.net/login',
    });

    expect(context.__store.get(EDGE_DEBUG_PORT_STATE_KEY)).toBe(9333);
    expect(spawnProcess).toHaveBeenCalledWith(
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      [
        '--new-window',
        '--no-first-run',
        '--no-default-browser-check',
        '--remote-debugging-port=9333',
        'https://www.educoder.net/login',
      ],
      {
        stdio: 'ignore',
        windowsHide: false,
      },
    );
    expect(spawnProcess.mock.calls[0]?.[1]).not.toContain('--user-data-dir');
    expect(output.appendLine).toHaveBeenCalledWith(
      '[edge-reuse] launching Edge: C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    );
    expect(output.appendLine).toHaveBeenCalledWith('[edge-reuse] devtools port: 9333');
    expect(output.appendLine).toHaveBeenCalledWith('[edge-reuse] enabled (port persisted)');
  });
});

describe('promptEdgeReuseLogin', () => {
  it('extracts session cookies after the user confirms Edge-based login', async () => {
    const session: SessionCookies = {
      _educoder_session: 'edge-session',
      autologin_trustie: 'edge-trustie',
    };
    const launch = vi.fn(async () => ({
      port: 9555,
      url: 'https://www.educoder.net/login',
    }));
    const showInformationMessage = vi.fn(async () => LOGIN_CONFIRM_LABEL);
    const extractSession = vi.fn(async () => session);

    await expect(
      promptEdgeReuseLogin({
        context: createContext() as any,
        window: { showInformationMessage },
        launch,
        extractSession,
      }),
    ).resolves.toEqual(session);

    expect(launch).toHaveBeenCalledTimes(1);
    expect(showInformationMessage).toHaveBeenCalledWith(
      EDGE_REUSE_LOGIN_PROMPT_MESSAGE,
      LOGIN_CONFIRM_LABEL,
      '取消',
    );
    expect(extractSession).toHaveBeenCalledWith(9555);
  });

  it('returns undefined when the user cancels the Edge-based login flow', async () => {
    const launch = vi.fn(async () => ({
      port: 9555,
      url: 'https://www.educoder.net/login',
    }));
    const extractSession = vi.fn(async () => {
      throw new Error('should not be called');
    });

    await expect(
      promptEdgeReuseLogin({
        context: createContext() as any,
        window: {
          showInformationMessage: async () => '取消',
        },
        launch,
        extractSession,
      }),
    ).resolves.toBeUndefined();

    expect(extractSession).not.toHaveBeenCalled();
  });

  it('throws a clear error when no session can be extracted after confirmation', async () => {
    const launch = vi.fn(async () => ({
      port: 9777,
      url: 'https://www.educoder.net/login',
    }));

    await expect(
      promptEdgeReuseLogin({
        context: createContext() as any,
        window: {
          showInformationMessage: async () => LOGIN_CONFIRM_LABEL,
        },
        launch,
        extractSession: async () => undefined,
      }),
    ).rejects.toThrow(EDGE_REUSE_SESSION_NOT_FOUND_ERROR_MESSAGE);
  });
});
