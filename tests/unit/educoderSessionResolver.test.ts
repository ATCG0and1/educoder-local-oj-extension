import { describe, expect, it, vi } from 'vitest';
import { setEdgeDebugPort } from '../../src/core/auth/edgeDebugPortStore.js';
import { createEducoderSessionResolver } from '../../src/core/auth/educoderSessionResolver.js';
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

describe('createEducoderSessionResolver', () => {
  it('prefers the persisted Edge debug port when resolving session cookies', async () => {
    const context = createContext();
    await setEdgeDebugPort(context as any, 9222);

    const edgeSession: SessionCookies = {
      _educoder_session: 'edge-session',
      autologin_trustie: 'edge-trustie',
    };

    const loadFromDevtoolsPort = vi.fn(async () => edgeSession);
    const loadFromEnv = vi.fn(async () => {
      throw new Error('should not call env loader');
    });
    const login = vi.fn(async () => {
      throw new Error('should not login');
    });

    const resolve = createEducoderSessionResolver({
      context: context as any,
      validate: async () => true,
      loadFromDevtoolsPort,
      loadFromEnv,
      login,
    });

    await expect(resolve()).resolves.toEqual(edgeSession);

    expect(loadFromDevtoolsPort).toHaveBeenCalledTimes(1);
    expect(loadFromDevtoolsPort).toHaveBeenCalledWith(9222);
    expect(loadFromEnv).not.toHaveBeenCalled();
    expect(login).not.toHaveBeenCalled();
  });

  it('falls back to interactive Edge login when the persisted debug port is stale and login fallback is enabled', async () => {
    const context = createContext();
    await setEdgeDebugPort(context as any, 9222);

    const interactiveSession: SessionCookies = {
      _educoder_session: 'interactive-session',
      autologin_trustie: 'interactive-trustie',
    };

    const loadFromDevtoolsPort = vi.fn(async () => undefined);
    const loadFromEnv = vi.fn(async () => {
      throw new Error('should not call env loader');
    });
    const login = vi.fn(async () => interactiveSession);

    const resolve = createEducoderSessionResolver({
      context: context as any,
      validate: async (cookies) => cookies === interactiveSession,
      loadFromDevtoolsPort,
      loadFromEnv,
      login,
      allowLoginWhenPersistedPortPresent: true,
    });

    await expect(resolve()).resolves.toEqual(interactiveSession);

    expect(loadFromDevtoolsPort).toHaveBeenCalledTimes(1);
    expect(loadFromDevtoolsPort).toHaveBeenCalledWith(9222);
    expect(loadFromEnv).not.toHaveBeenCalled();
    expect(login).toHaveBeenCalledTimes(1);
  });

  it('does not fall back to temp-profile login when edge reuse is enabled but no cookies are available', async () => {
    const context = createContext();
    await setEdgeDebugPort(context as any, 9222);

    const login = vi.fn(async () => ({
      _educoder_session: 'interactive-session',
    }));

    const resolve = createEducoderSessionResolver({
      context: context as any,
      validate: async () => false,
      loadFromDevtoolsPort: async () => undefined,
      loadFromEnv: async () => undefined,
      login,
      edgeReuseLoginDisabledMessage: 'Edge 复用模式已启用：不会启动临时登录窗口，请在 Debug Edge 中完成登录后重试。',
    });

    await expect(resolve()).rejects.toThrow('Edge 复用模式已启用');
    expect(login).not.toHaveBeenCalled();
  });
});
