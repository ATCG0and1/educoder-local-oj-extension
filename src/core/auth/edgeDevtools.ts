import { execFile, spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';

export interface EdgeLaunchOutputLike {
  appendLine(value: string): void;
}

export interface SpawnProcessLike {
  (
    command: string,
    args: string[],
    options: {
      stdio: 'ignore';
      windowsHide: boolean;
    },
  ): unknown;
}

export interface ResolveEdgeExecutablePathDeps {
  env?: NodeJS.ProcessEnv;
  fileExists?: (targetPath: string) => Promise<boolean>;
}

export interface WaitForDevtoolsEndpointDeps {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  pollIntervalMs?: number;
  timeoutMessage?: string;
}

export interface EdgeBrowserProcessInfo {
  processId: number;
  commandLine?: string;
}

interface RawEdgeBrowserProcessInfo {
  processId?: number;
  commandLine?: string;
  ProcessId?: number;
  CommandLine?: string;
}

export interface LaunchDefaultProfileEdgeDevtoolsWindowDeps {
  launchUrl: string;
  output?: EdgeLaunchOutputLike;
  resolveEdgePath?: () => Promise<string>;
  findAvailablePort?: () => Promise<number>;
  spawnProcess?: SpawnProcessLike;
  waitForDebugger?: (port: number) => Promise<void>;
  listBrowserProcesses?: () => Promise<EdgeBrowserProcessInfo[]>;
  killBrowserProcesses?: (processes: EdgeBrowserProcessInfo[]) => Promise<void>;
  allowAggressiveRecovery?: boolean;
  waitTimeoutMessage?: string;
}

export interface EdgeDevtoolsLaunchResult {
  edgeExecutable: string;
  port: number;
  url: string;
}

const DEFAULT_EDGE_DEVTOOLS_TIMEOUT_MESSAGE =
  '无法连接到 Edge DevTools（可能是 Edge 已在运行且未以 remote-debugging-port 启动）。请关闭所有 Edge 窗口后重试。';

export async function launchDefaultProfileEdgeDevtoolsWindow(
  deps: LaunchDefaultProfileEdgeDevtoolsWindowDeps,
): Promise<EdgeDevtoolsLaunchResult> {
  const edgeExecutable = await (deps.resolveEdgePath ?? resolveEdgeExecutablePath)();
  const findAvailablePort = deps.findAvailablePort ?? findFreePort;
  const spawnProcess = deps.spawnProcess ?? spawn;
  const waitForDebugger =
    deps.waitForDebugger ??
    ((nextPort: number) =>
      waitForDevtoolsEndpoint(nextPort, {
        timeoutMessage: deps.waitTimeoutMessage ?? DEFAULT_EDGE_DEVTOOLS_TIMEOUT_MESSAGE,
      }));

  const launchOnce = async (port: number): Promise<void> => {
    deps.output?.appendLine(`[edge-reuse] launching Edge: ${edgeExecutable}`);
    deps.output?.appendLine(`[edge-reuse] devtools port: ${port}`);

    spawnProcess(
      edgeExecutable,
      [
        '--new-window',
        '--no-first-run',
        '--no-default-browser-check',
        `--remote-debugging-port=${port}`,
        deps.launchUrl,
      ],
      {
        stdio: 'ignore',
        windowsHide: false,
      },
    );

    await waitForDebugger(port);
  };

  const firstPort = await findAvailablePort();

  try {
    await launchOnce(firstPort);
    return {
      edgeExecutable,
      port: firstPort,
      url: deps.launchUrl,
    };
  } catch (error) {
    const browserProcesses = await loadBrowserProcesses(deps.listBrowserProcesses);
    const recoveryTargets = findStartupBoostRecoveryTargets(browserProcesses, firstPort);

    if (recoveryTargets.length === 0) {
      return retryWithAggressiveRecovery({
        deps,
        edgeExecutable,
        baseError: error,
        findAvailablePort,
        launchOnce,
        browserProcesses,
      });
    }

    deps.output?.appendLine(
      '[edge-reuse] devtools not ready; detected lingering Edge background process, killing it and retrying once',
    );
    await (deps.killBrowserProcesses ?? killEdgeBrowserProcesses)(recoveryTargets);
    await sleep(500);

    const retryPort = await findAvailablePort();
    try {
      await launchOnce(retryPort);

      return {
        edgeExecutable,
        port: retryPort,
        url: deps.launchUrl,
      };
    } catch (retryError) {
      return retryWithAggressiveRecovery({
        deps,
        edgeExecutable,
        baseError: retryError,
        findAvailablePort,
        launchOnce,
      });
    }
  }
}

export async function resolveEdgeExecutablePath(
  deps: ResolveEdgeExecutablePathDeps = {},
): Promise<string> {
  const env = deps.env ?? process.env;
  const candidates = [
    path.join(env['ProgramFiles(x86)'] ?? '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(env.ProgramFiles ?? '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(env.LOCALAPPDATA ?? '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (!candidate || !path.isAbsolute(candidate)) {
      continue;
    }

    if (await (deps.fileExists ?? defaultFileExists)(candidate)) {
      return candidate;
    }
  }

  throw new Error('未找到 Microsoft Edge，无法打开头歌登录窗口');
}

async function defaultFileExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function findFreePort(): Promise<number> {
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

export async function listEdgeBrowserProcesses(): Promise<EdgeBrowserProcessInfo[]> {
  if (process.platform !== 'win32') {
    return [];
  }

  const stdout = await execFileText('powershell.exe', [
    '-NoProfile',
    '-Command',
    [
      "$ErrorActionPreference='Stop'",
      `$items = Get-CimInstance Win32_Process -Filter "name='msedge.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine -notmatch '--type=' } | Select-Object ProcessId, CommandLine`,
      "if (-not $items) { '[]' } else { $items | ConvertTo-Json -Compress }",
    ].join('; '),
  ]);

  const trimmed = stdout.trim();
  if (!trimmed) {
    return [];
  }

  const parsed = JSON.parse(trimmed) as RawEdgeBrowserProcessInfo | RawEdgeBrowserProcessInfo[];
  const items = Array.isArray(parsed) ? parsed : [parsed];
  return items.map(normalizeBrowserProcessInfo).filter((item) => item.processId > 0);
}

export async function killEdgeBrowserProcesses(
  processes: EdgeBrowserProcessInfo[],
): Promise<void> {
  if (process.platform !== 'win32') {
    return;
  }

  for (const processInfo of processes) {
    if (!Number.isInteger(processInfo.processId) || processInfo.processId <= 0) {
      continue;
    }

    try {
      await execFileText('taskkill', ['/PID', String(processInfo.processId), '/F', '/T']);
    } catch {
      // ignore already-exited processes during recovery
    }
  }
}

export async function waitForDevtoolsEndpoint(
  port: number,
  deps: WaitForDevtoolsEndpointDeps = {},
): Promise<void> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const timeoutMs = deps.timeoutMs ?? 15_000;
  const pollIntervalMs = deps.pollIntervalMs ?? 250;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetchImpl(`http://127.0.0.1:${port}/json/list`);
      if (response.ok) {
        return;
      }
    } catch {
      // continue polling until timeout
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(deps.timeoutMessage ?? DEFAULT_EDGE_DEVTOOLS_TIMEOUT_MESSAGE);
}

async function loadBrowserProcesses(
  loader: (() => Promise<EdgeBrowserProcessInfo[]>) | undefined,
): Promise<EdgeBrowserProcessInfo[]> {
  try {
    return (await (loader ?? listEdgeBrowserProcesses)())
      .map((processInfo) => normalizeBrowserProcessInfo(processInfo as RawEdgeBrowserProcessInfo))
      .filter((item) => item.processId > 0);
  } catch {
    return [];
  }
}

function normalizeBrowserProcessInfo(processInfo: RawEdgeBrowserProcessInfo): EdgeBrowserProcessInfo {
  return {
    processId: processInfo.processId ?? processInfo.ProcessId ?? 0,
    commandLine: processInfo.commandLine ?? processInfo.CommandLine,
  };
}

function findStartupBoostRecoveryTargets(
  processes: EdgeBrowserProcessInfo[],
  launchedPort: number,
): EdgeBrowserProcessInfo[] {
  const browserProcesses = processes.filter(isEdgeBrowserProcess);
  if (!browserProcesses.some(isStartupBoostBackgroundBrowserProcess)) {
    return [];
  }

  const safeToKill = browserProcesses.every(
    (processInfo) =>
      isStartupBoostBackgroundBrowserProcess(processInfo) ||
      hasRemoteDebuggingPort(processInfo, launchedPort),
  );

  return safeToKill ? browserProcesses : [];
}

function isEdgeBrowserProcess(processInfo: EdgeBrowserProcessInfo): boolean {
  const commandLine = normalizeCommandLine(processInfo.commandLine);
  return Boolean(commandLine) && !commandLine.includes('--type=');
}

function isStartupBoostBackgroundBrowserProcess(processInfo: EdgeBrowserProcessInfo): boolean {
  return normalizeCommandLine(processInfo.commandLine).includes('--no-startup-window');
}

function hasRemoteDebuggingPort(processInfo: EdgeBrowserProcessInfo, port: number): boolean {
  return normalizeCommandLine(processInfo.commandLine).includes(`--remote-debugging-port=${port}`);
}

function normalizeCommandLine(commandLine: string | undefined): string {
  return (commandLine ?? '').toLowerCase();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function retryWithAggressiveRecovery(input: {
  deps: LaunchDefaultProfileEdgeDevtoolsWindowDeps;
  edgeExecutable: string;
  baseError: unknown;
  findAvailablePort: () => Promise<number>;
  launchOnce: (port: number) => Promise<void>;
  browserProcesses?: EdgeBrowserProcessInfo[];
}): Promise<EdgeDevtoolsLaunchResult> {
  if (!input.deps.allowAggressiveRecovery) {
    throw input.baseError;
  }

  const browserProcesses =
    input.browserProcesses ?? (await loadBrowserProcesses(input.deps.listBrowserProcesses));
  const aggressiveTargets = browserProcesses.filter(isEdgeBrowserProcess);
  if (aggressiveTargets.length === 0) {
    throw input.baseError;
  }

  input.deps.output?.appendLine(
    '[edge-reuse] devtools still not ready; killing all browser-level Edge processes and retrying once',
  );
  await (input.deps.killBrowserProcesses ?? killEdgeBrowserProcesses)(aggressiveTargets);
  await sleep(800);

  const retryPort = await input.findAvailablePort();
  await input.launchOnce(retryPort);

  return {
    edgeExecutable: input.edgeExecutable,
    port: retryPort,
    url: input.deps.launchUrl,
  };
}

function execFileText(command: string, args: string[]): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    execFile(
      command,
      args,
      {
        windowsHide: true,
        encoding: 'utf8',
        maxBuffer: 1024 * 1024,
      },
      (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(stdout);
      },
    );
  });
}
