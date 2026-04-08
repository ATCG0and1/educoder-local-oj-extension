import {
  clearEdgeDebugPort,
  setEdgeDebugPort,
  type EdgeDebugPortContextLike,
} from './edgeDebugPortStore.js';
import {
  launchDefaultProfileEdgeDevtoolsWindow,
  type EdgeLaunchOutputLike,
  type SpawnProcessLike,
} from './edgeDevtools.js';
import { loadSessionFromDevtoolsPort, type SessionCookies } from './edgeReuse.js';
import {
  EDUCOLDER_LOGIN_URL,
  LOGIN_CANCEL_LABEL,
  LOGIN_CONFIRM_LABEL,
  type LoginWindowLike,
} from './loginFlow.js';

export interface LaunchEdgeReuseWindowDeps {
  context: EdgeDebugPortContextLike;
  output?: EdgeLaunchOutputLike;
  launchUrl?: string;
  resolveEdgePath?: () => Promise<string>;
  findAvailablePort?: () => Promise<number>;
  spawnProcess?: SpawnProcessLike;
  waitForDebugger?: (port: number) => Promise<void>;
}

export interface LaunchEdgeReuseWindowResult {
  port: number;
  url: string;
}

export interface PromptEdgeReuseLoginDeps extends LaunchEdgeReuseWindowDeps {
  window: LoginWindowLike;
  launch?: () => Promise<LaunchEdgeReuseWindowResult>;
  extractSession?: (port: number) => Promise<SessionCookies | undefined>;
}

export const EDGE_REUSE_LOGIN_PROMPT_MESSAGE =
  '已打开你的默认 Edge（复用日常账号配置），请在该窗口中完成 Educoder 登录后点击“我已完成登录”继续。若提示无法连接 DevTools，请先关闭所有 Edge 窗口后重试。';

export const EDGE_REUSE_SESSION_NOT_FOUND_ERROR_MESSAGE =
  '未能从当前 Edge 读取到 Educoder 登录态。请确认你已在打开的 Edge 窗口中完成 Educoder 登录后重试。';

export async function launchEdgeReuseWindow(
  deps: LaunchEdgeReuseWindowDeps,
): Promise<LaunchEdgeReuseWindowResult> {
  try {
    const launched = await launchDefaultProfileEdgeDevtoolsWindow({
      launchUrl: deps.launchUrl ?? EDUCOLDER_LOGIN_URL,
      output: deps.output,
      resolveEdgePath: deps.resolveEdgePath,
      findAvailablePort: deps.findAvailablePort,
      spawnProcess: deps.spawnProcess,
      waitForDebugger: deps.waitForDebugger,
      allowAggressiveRecovery: true,
    });

    await setEdgeDebugPort(deps.context, launched.port);
    deps.output?.appendLine('[edge-reuse] enabled (port persisted)');

    return {
      port: launched.port,
      url: launched.url,
    };
  } catch (error) {
    deps.output?.appendLine(`[edge-reuse] failed: ${formatError(error)}`);

    try {
      await clearEdgeDebugPort(deps.context);
    } catch {
      // ignore store cleanup errors
    }

    throw error;
  }
}

export async function promptEdgeReuseLogin(
  deps: PromptEdgeReuseLoginDeps,
): Promise<SessionCookies | undefined> {
  const launched = await (deps.launch ?? (() => launchEdgeReuseWindow(deps)))();
  const choice = await deps.window.showInformationMessage(
    EDGE_REUSE_LOGIN_PROMPT_MESSAGE,
    LOGIN_CONFIRM_LABEL,
    LOGIN_CANCEL_LABEL,
  );

  if (choice !== LOGIN_CONFIRM_LABEL) {
    return undefined;
  }

  const session = await (deps.extractSession ?? loadSessionFromDevtoolsPort)(launched.port);
  if (!session) {
    throw new Error(EDGE_REUSE_SESSION_NOT_FOUND_ERROR_MESSAGE);
  }

  return session;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
