import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { loadSessionFromDevtoolsPort, type SessionCookies } from './edgeReuse.js';

export const EDUCOLDER_LOGIN_URL = 'https://www.educoder.net/login';
export const LOGIN_CONFIRM_LABEL = '我已完成登录';
export const LOGIN_CANCEL_LABEL = '取消';
export const LOGIN_PROMPT_MESSAGE = '已打开头歌登录窗口，请完成登录后点击“我已完成登录”继续。';

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
  const edgeExecutable = resolveEdgeExecutablePath();
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
      await waitForDevtoolsEndpoint(port);
    },
    dispose: async () => {
      if (!child.killed) {
        child.kill();
      }
      await rm(userDataDir, { recursive: true, force: true });
    },
  };
}

function resolveEdgeExecutablePath(): string {
  const candidates = [
    path.join(process.env['ProgramFiles(x86)'] ?? '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(process.env.ProgramFiles ?? '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(process.env.LOCALAPPDATA ?? '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  ].filter(Boolean);

  const found = candidates.find((candidate) => candidate && path.isAbsolute(candidate));
  if (!found) {
    throw new Error('未找到 Microsoft Edge，无法打开头歌登录窗口');
  }

  return found;
}

async function findFreePort(): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('无法申请本地调试端口'));
        return;
      }

      const port = address.port;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(port);
      });
    });
    server.on('error', reject);
  });
}

async function waitForDevtoolsEndpoint(port: number): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 15_000) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (response.ok) {
        return;
      }
    } catch {
      // continue polling until timeout
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error('启动头歌登录窗口超时，请重试');
}
