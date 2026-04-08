import type { LoginWindowLike } from '../auth/loginFlow.js';
import { createEducoderSessionResolver } from '../auth/educoderSessionResolver.js';
import { promptEdgeReuseLogin } from '../auth/edgeReuseLogin.js';
import {
  buildEducoderCookieHeader,
  createHomepageSessionValidator,
} from '../auth/sessionValidation.js';
import type { SessionContextLike, SessionCookies } from '../auth/sessionManager.js';
import type { EdgeDebugPortContextLike } from '../auth/edgeDebugPortStore.js';
import { EducoderClient } from '../api/educoderClient.js';
import {
  createFetchTransport,
  type TransportTraceEvent,
} from '../api/fetchTransport.js';
import { createApiInventory, type ApiInventory } from '../recon/apiInventory.js';
import { noopLogger, type Logger } from '../logging/logger.js';

export interface RuntimeOutputChannelLike {
  appendLine(value: string): void;
  show(preserveFocus?: boolean): void;
}

export interface CreateExtensionRuntimeInput {
  context: SessionContextLike & EdgeDebugPortContextLike;
  outputChannel?: RuntimeOutputChannelLike;
  window: LoginWindowLike;
  fetchImpl?: typeof fetch;
  login?: () => Promise<SessionCookies | undefined>;
  loadFromEdge?: () => Promise<SessionCookies | undefined>;
}

export interface ExtensionRuntime {
  client: EducoderClient;
  resolveSession(forceRefresh?: boolean): Promise<SessionCookies>;
  logger: Logger;
  apiInventory: ApiInventory;
}

export function createExtensionRuntime(input: CreateExtensionRuntimeInput): ExtensionRuntime {
  const fetchImpl: typeof fetch =
    input.fetchImpl ??
    ((resource, init) => fetch(resource, init));
  const logger = createOutputChannelLogger(input.outputChannel);
  const apiInventory = createApiInventory();
  const transport = createFetchTransport(fetchImpl as any, {
    onSettled: (event) => {
      apiInventory.record(event);
      logger.info(formatTraceMessage(event));
    },
  });
  const validate = createHomepageSessionValidator({
    fetchImpl,
  });
  const resolveSession = createEducoderSessionResolver({
    context: input.context,
    validate,
    loadFromEnv: input.loadFromEdge,
    login:
      input.login ??
      (() =>
        promptEdgeReuseLogin({
          context: input.context,
          window: input.window,
          output: input.outputChannel,
        })),
    allowLoginWhenPersistedPortPresent: true,
    logger,
  });
  const client = new EducoderClient({
    transport,
    resolveSession,
  });

  return {
    client,
    resolveSession,
    logger,
    apiInventory,
  };
}

export function createOutputChannelLogger(channel: RuntimeOutputChannelLike | undefined): Logger {
  if (!channel) {
    return noopLogger;
  }

  const write = (level: 'info' | 'warn' | 'error', message: string) => {
    channel.appendLine(`[${new Date().toISOString()}] [${level}] ${message}`);
  };

  return {
    info: (message: string) => write('info', message),
    warn: (message: string) => write('warn', message),
    error: (message: string) => write('error', message),
  };
}

export { buildEducoderCookieHeader };

function formatTraceMessage(event: TransportTraceEvent): string {
  const suffixParts = [`status=${event.status}`, `duration=${event.durationMs}ms`];
  if (event.businessStatus !== undefined) {
    suffixParts.push(`business=${event.businessStatus}`);
  }
  if (event.errorMessage) {
    suffixParts.push(`error=${event.errorMessage}`);
  }

  return `[http] ${event.method} ${event.host ?? 'unknown-host'}${event.path ?? event.url} ${suffixParts.join(' ')}`;
}
