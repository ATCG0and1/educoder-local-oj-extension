import {
  loadSessionFromEdge,
  type SessionCookies,
} from './edgeReuse.js';

export type { SessionCookies } from './edgeReuse.js';

export const SESSION_CACHE_KEY = 'educoderSessionCookies';
export const SESSION_REQUIRED_ERROR_MESSAGE = '登录失效，请重新登录';

export interface SessionStateStore {
  get<T>(key: string): T | undefined;
  update(key: string, value: SessionCookies): PromiseLike<void> | void;
}

export interface SessionContextLike {
  globalState: SessionStateStore;
}

export interface ResolveSessionDeps {
  context: SessionContextLike;
  validate(cookies: SessionCookies): Promise<boolean>;
  loadFromEdge?: () => Promise<SessionCookies | undefined>;
}

export function getCachedSession(context: SessionContextLike): SessionCookies | undefined {
  return context.globalState.get<SessionCookies>(SESSION_CACHE_KEY);
}

export async function setCachedSession(
  context: SessionContextLike,
  sessionCookies: SessionCookies,
): Promise<void> {
  await context.globalState.update(SESSION_CACHE_KEY, sessionCookies);
}

export async function resolveSession({
  context,
  validate,
  loadFromEdge = loadSessionFromEdge,
}: ResolveSessionDeps): Promise<SessionCookies> {
  const cachedSession = getCachedSession(context);
  if (cachedSession && (await validate(cachedSession))) {
    return cachedSession;
  }

  const edgeSession = await loadFromEdge();
  if (edgeSession && (await validate(edgeSession))) {
    await setCachedSession(context, edgeSession);
    return edgeSession;
  }

  throw new Error(SESSION_REQUIRED_ERROR_MESSAGE);
}
