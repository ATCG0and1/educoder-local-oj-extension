import { EDUCOLDER_LOGIN_URL } from '../core/auth/loginFlow.js';
import { type EdgeDebugPortContextLike } from '../core/auth/edgeDebugPortStore.js';
import { launchEdgeReuseWindow } from '../core/auth/edgeReuseLogin.js';

export interface OutputChannelLike {
  appendLine(value: string): void;
  show(preserveFocus?: boolean): void;
}

export interface WindowLike {
  showInformationMessage(
    message: string,
    ...items: string[]
  ): PromiseLike<string | undefined> | string | undefined;
  showErrorMessage(
    message: string,
    ...items: string[]
  ): PromiseLike<string | undefined> | string | undefined;
}

export interface EnableEdgeReuseDeps {
  context: EdgeDebugPortContextLike;
  window: WindowLike;
  output?: OutputChannelLike;
  launchUrl?: string;
  resolveEdgePath?: () => Promise<string>;
}

export interface EnableEdgeReuseResult {
  port: number;
  url: string;
}

const ENABLE_SUCCESS_MESSAGE =
  '已启用 Edge 复用模式（DevTools）。请保持该 Edge 窗口打开，并在其中完成 Educoder 登录后重试同步。';

export async function enableEdgeReuseCommand(deps: EnableEdgeReuseDeps): Promise<EnableEdgeReuseResult> {
  const url = deps.launchUrl ?? EDUCOLDER_LOGIN_URL;
  const output = deps.output;

  output?.appendLine(`[edge-reuse] enabling... url=${url}`);

  try {
    const result = await launchEdgeReuseWindow({
      context: deps.context,
      output,
      launchUrl: url,
      resolveEdgePath: deps.resolveEdgePath,
    });

    await deps.window.showInformationMessage(ENABLE_SUCCESS_MESSAGE);
    return result;
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    await deps.window.showErrorMessage(`启用 Edge 复用失败：${messageText}`);
    throw error;
  }
}
