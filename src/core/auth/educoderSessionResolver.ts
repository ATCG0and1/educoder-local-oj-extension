import {
  getEdgeDebugPort,
  type EdgeDebugPortContextLike,
} from './edgeDebugPortStore.js';
import {
  loadSessionFromDevtoolsPort,
  loadSessionFromEdge,
  type SessionCookies,
} from './edgeReuse.js';
import { resolveSession, type SessionContextLike } from './sessionManager.js';
import { formatErrorChain } from '../logging/errorFormat.js';
import { noopLogger, type Logger } from '../logging/logger.js';

export interface CreateEducoderSessionResolverDeps {
  context: SessionContextLike & EdgeDebugPortContextLike;
  validate(cookies: SessionCookies): Promise<boolean>;
  login?: () => Promise<SessionCookies | undefined>;
  logger?: Logger;
  edgeReuseLoginDisabledMessage?: string;
  allowLoginWhenPersistedPortPresent?: boolean;
  loadFromDevtoolsPort?: (port: number) => Promise<SessionCookies | undefined>;
  loadFromEnv?: () => Promise<SessionCookies | undefined>;
}

const DEFAULT_EDGE_REUSE_DISABLED_LOGIN_MESSAGE =
  'Edge 复用模式已启用：将不会再启动临时登录窗口。请先运行 “Educoder Local OJ: Enable Edge Reuse (Debug Mode)” 并在打开的 Edge 中完成 Educoder 登录后重试。';

export function createEducoderSessionResolver(
  deps: CreateEducoderSessionResolverDeps,
): (forceRefresh?: boolean) => Promise<SessionCookies> {
  const logger = deps.logger ?? noopLogger;
  const loadFromPort = deps.loadFromDevtoolsPort ?? loadSessionFromDevtoolsPort;
  const loadFromEnv = deps.loadFromEnv ?? loadSessionFromEdge;
  const disabledLoginMessage =
    deps.edgeReuseLoginDisabledMessage ?? DEFAULT_EDGE_REUSE_DISABLED_LOGIN_MESSAGE;

  const loadFromEdge = async (): Promise<SessionCookies | undefined> => {
    const port = getEdgeDebugPort(deps.context);

    if (port !== undefined) {
      logger.info(`[auth] edge reuse: using persisted devtools port=${port}`);
      try {
        return await loadFromPort(port);
      } catch (error) {
        logger.warn(`[auth] edge reuse: persisted port failed\n${formatErrorChain(error)}`);
        return undefined;
      }
    }

    logger.info('[auth] edge reuse: checking env EDUCODER_EDGE_DEBUG_PORT');
    try {
      return await loadFromEnv();
    } catch (error) {
      logger.warn(`[auth] edge reuse: env loader failed\n${formatErrorChain(error)}`);
      return undefined;
    }
  };

  const login = async (): Promise<SessionCookies | undefined> => {
    const port = getEdgeDebugPort(deps.context);
    if (port !== undefined && !deps.allowLoginWhenPersistedPortPresent) {
      throw new Error(disabledLoginMessage);
    }

    if (port !== undefined && deps.allowLoginWhenPersistedPortPresent) {
      logger.warn(
        `[auth] edge reuse: persisted port=${port} unavailable, falling back to interactive Edge login`,
      );
    }

    return deps.login?.();
  };

  return async (forceRefresh?: boolean): Promise<SessionCookies> =>
    resolveSession({
      context: deps.context,
      validate: deps.validate,
      loadFromEdge,
      login,
      forceRefresh,
    });
}
