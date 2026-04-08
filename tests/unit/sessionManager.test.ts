import { describe, expect, it, vi } from 'vitest';
import {
  resolveSession,
  SESSION_CACHE_KEY,
  type SessionContextLike,
  type SessionCookies,
} from '../../src/core/auth/sessionManager.js';

function createContext(initialSession?: SessionCookies): SessionContextLike {
  const store = new Map<string, SessionCookies>();

  if (initialSession) {
    store.set(SESSION_CACHE_KEY, initialSession);
  }

  return {
    globalState: {
      get: <T>(key: string) => store.get(key) as T | undefined,
      update: async (key: string, value: SessionCookies) => {
        store.set(key, value);
      },
    },
  };
}

describe('resolveSession', () => {
  it('prefers a valid cached session', async () => {
    const cachedSession: SessionCookies = {
      _educoder_session: 'cached-session',
      autologin_trustie: 'cached-trustie',
    };
    const context = createContext(cachedSession);
    const validate = vi.fn(async (cookies: SessionCookies) => cookies === cachedSession);
    const loadFromEdge = vi.fn(async () => undefined);

    await expect(resolveSession({ context, validate, loadFromEdge })).resolves.toEqual(cachedSession);

    expect(validate).toHaveBeenCalledTimes(1);
    expect(loadFromEdge).not.toHaveBeenCalled();
  });

  it('falls through to edge reuse when the cached session is invalid', async () => {
    const cachedSession: SessionCookies = {
      _educoder_session: 'stale-session',
      autologin_trustie: 'stale-trustie',
    };
    const edgeSession: SessionCookies = {
      _educoder_session: 'edge-session',
      autologin_trustie: 'edge-trustie',
    };
    const context = createContext(cachedSession);
    const validate = vi
      .fn<(cookies: SessionCookies) => Promise<boolean>>()
      .mockImplementation(async (cookies) => cookies === edgeSession);
    const loadFromEdge = vi.fn(async () => edgeSession);

    await expect(resolveSession({ context, validate, loadFromEdge })).resolves.toEqual(edgeSession);

    expect(validate).toHaveBeenCalledTimes(2);
    expect(loadFromEdge).toHaveBeenCalledTimes(1);
    expect(context.globalState.get(SESSION_CACHE_KEY)).toEqual(edgeSession);
  });

  it('throws when neither cached cookies nor edge reuse produce a valid session', async () => {
    const context = createContext();
    const validate = vi.fn(async () => false);
    const loadFromEdge = vi.fn(async () => undefined);

    await expect(resolveSession({ context, validate, loadFromEdge })).rejects.toThrow(
      '登录失效，请重新登录',
    );
  });

  it('falls back to interactive login when cache and edge reuse both fail', async () => {
    const context = createContext();
    const loggedInSession: SessionCookies = {
      _educoder_session: 'interactive-session',
      autologin_trustie: 'interactive-trustie',
    };
    const validate = vi.fn(async (cookies: SessionCookies) => cookies === loggedInSession);
    const loadFromEdge = vi.fn(async () => undefined);
    const login = vi.fn(async () => loggedInSession);

    await expect(resolveSession({ context, validate, loadFromEdge, login })).resolves.toEqual(
      loggedInSession,
    );

    expect(loadFromEdge).toHaveBeenCalledTimes(1);
    expect(login).toHaveBeenCalledTimes(1);
    expect(context.globalState.get(SESSION_CACHE_KEY)).toEqual(loggedInSession);
  });

  it('skips cached cookies when a force refresh is requested', async () => {
    const cachedSession: SessionCookies = {
      _educoder_session: 'stale-session',
      autologin_trustie: 'stale-trustie',
    };
    const edgeSession: SessionCookies = {
      _educoder_session: 'fresh-session',
      autologin_trustie: 'fresh-trustie',
    };
    const context = createContext(cachedSession);
    const validate = vi.fn(async () => true);
    const loadFromEdge = vi.fn(async () => edgeSession);

    await expect(
      resolveSession({ context, validate, loadFromEdge, forceRefresh: true }),
    ).resolves.toEqual(edgeSession);

    expect(loadFromEdge).toHaveBeenCalledTimes(1);
    expect(context.globalState.get(SESSION_CACHE_KEY)).toEqual(edgeSession);
    expect(validate).toHaveBeenCalledTimes(1);
    expect(validate).toHaveBeenCalledWith(edgeSession);
  });

  it('falls back to interactive login when force refresh only recovers the same stale edge session', async () => {
    const cachedSession: SessionCookies = {
      _educoder_session: 'stale-session',
      autologin_trustie: 'stale-trustie',
    };
    const loggedInSession: SessionCookies = {
      _educoder_session: 'fresh-session',
      autologin_trustie: 'fresh-trustie',
    };
    const context = createContext(cachedSession);
    const validate = vi.fn(async () => true);
    const loadFromEdge = vi.fn(async () => cachedSession);
    const login = vi.fn(async () => loggedInSession);

    await expect(
      resolveSession({ context, validate, loadFromEdge, login, forceRefresh: true }),
    ).resolves.toEqual(loggedInSession);

    expect(loadFromEdge).toHaveBeenCalledTimes(1);
    expect(login).toHaveBeenCalledTimes(1);
    expect(context.globalState.get(SESSION_CACHE_KEY)).toEqual(loggedInSession);
  });

  it('falls back to interactive login when edge reuse probing throws', async () => {
    const context = createContext();
    const loggedInSession: SessionCookies = {
      _educoder_session: 'fresh-session',
      autologin_trustie: 'fresh-trustie',
    };
    const validate = vi.fn(async (cookies: SessionCookies) => cookies === loggedInSession);
    const loadFromEdge = vi.fn(async () => {
      throw new Error('Edge DevTools unavailable');
    });
    const login = vi.fn(async () => loggedInSession);

    await expect(resolveSession({ context, validate, loadFromEdge, login })).resolves.toEqual(
      loggedInSession,
    );

    expect(loadFromEdge).toHaveBeenCalledTimes(1);
    expect(login).toHaveBeenCalledTimes(1);
    expect(context.globalState.get(SESSION_CACHE_KEY)).toEqual(loggedInSession);
  });
});
