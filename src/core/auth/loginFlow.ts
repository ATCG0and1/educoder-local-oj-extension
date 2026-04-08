import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadSessionFromDevtoolsPort, type SessionCookies } from './edgeReuse.js';
import {
  findFreePort,
  resolveEdgeExecutablePath,
  waitForDevtoolsEndpoint,
} from './edgeDevtools.js';

export const EDUCOLDER_LOGIN_URL = 'https://www.educoder.net/login';
export const LOGIN_CONFIRM_LABEL = '我已完成登录';
export const LOGIN_CANCEL_LABEL = '取消';
export const LOGIN_PROMPT_MESSAGE =
  '已打开头歌登录窗口（扩展启动的临时 Edge，不会复用你日常 Edge 的账号登录状态），请完成登录后点击“我已完成登录”继续。';

export { resolveEdgeExecutablePath } from './edgeDevtools.js';

export interface LoginWindowLike {
  showInformationMessage(
    message: string,
    ...items: string[]
  ): PromiseLike<string | undefined> | string | undefined;
}

export interface ManagedBrowserHandle {
  port: number;
  waitUntilReady(): Promise<void>;
  dispose(): Promise<void>;
}

export interface PromptEducoderLoginDeps {
  window: LoginWindowLike;
  launchBrowser?: () => Promise<ManagedBrowserHandle>;
  extractSession?: (port: number) => Promise<SessionCookies | undefined>;
}

export async function promptEducoderLogin(
  deps: PromptEducoderLoginDeps,
): Promise<SessionCookies | undefined> {
  const browser = await (deps.launchBrowser ?? launchEdgeLoginBrowser)();

  try {
    await browser.waitUntilReady();
    const choice = await deps.window.showInformationMessage(
      LOGIN_PROMPT_MESSAGE,
      LOGIN_CONFIRM_LABEL,
      LOGIN_CANCEL_LABEL,
    );

    if (choice !== LOGIN_CONFIRM_LABEL) {
      return undefined;
    }

    return await (deps.extractSession ?? loadSessionFromDevtoolsPort)(browser.port);
  } finally {
    await browser.dispose();
  }
}

export async function launchEdgeLoginBrowser(): Promise<ManagedBrowserHandle> {
  const edgeExecutable = await resolveEdgeExecutablePath();
  const port = await findFreePort();
  const userDataDir = await mkdtemp(path.join(os.tmpdir(), 'educoder-edge-login-'));
  const child = spawn(
    edgeExecutable,
    [
      '--new-window',
      '--no-first-run',
      '--no-default-browser-check',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
      EDUCOLDER_LOGIN_URL,
    ],
    {
      stdio: 'ignore',
      windowsHide: false,
    },
  );

  return {
    port,
    waitUntilReady: async () => {
      await waitForDevtoolsEndpoint(port, {
        timeoutMessage: '启动头歌登录窗口超时，请重试',
      });
    },
    dispose: async () => {
      if (!child.killed) {
        child.kill();
      }
      await rm(userDataDir, { recursive: true, force: true });
    },
  };
}
