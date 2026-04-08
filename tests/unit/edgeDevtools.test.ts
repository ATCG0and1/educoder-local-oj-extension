import { describe, expect, it, vi } from 'vitest';
import { launchDefaultProfileEdgeDevtoolsWindow } from '../../src/core/auth/edgeDevtools.js';

describe('launchDefaultProfileEdgeDevtoolsWindow', () => {
  it('retries once after killing lingering startup-boost Edge processes when devtools never opens', async () => {
    const output = {
      appendLine: vi.fn(),
    };
    const spawnProcess = vi.fn<
      (
        command: string,
        args: string[],
        options: {
          stdio: 'ignore';
          windowsHide: boolean;
        },
      ) => unknown
    >(() => ({}));
    const waitForDebugger = vi
      .fn<(port: number) => Promise<void>>()
      .mockRejectedValueOnce(new Error('devtools did not open'))
      .mockResolvedValueOnce(undefined);
    const listBrowserProcesses = vi.fn(async () => [
      {
        processId: 100,
        commandLine:
          '"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" --no-startup-window',
      },
      {
        processId: 101,
        commandLine:
          '"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" --new-window --remote-debugging-port=9333 https://www.educoder.net/login',
      },
    ]);
    const killBrowserProcesses = vi.fn(async () => undefined);
    const findAvailablePort = vi
      .fn<() => Promise<number>>()
      .mockResolvedValueOnce(9333)
      .mockResolvedValueOnce(9444);

    await expect(
      launchDefaultProfileEdgeDevtoolsWindow({
        launchUrl: 'https://www.educoder.net/login',
        output,
        resolveEdgePath: async () =>
          'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        findAvailablePort,
        spawnProcess,
        waitForDebugger,
        listBrowserProcesses,
        killBrowserProcesses,
      }),
    ).resolves.toEqual({
      edgeExecutable: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      port: 9444,
      url: 'https://www.educoder.net/login',
    });

    expect(killBrowserProcesses).toHaveBeenCalledTimes(1);
    expect(killBrowserProcesses).toHaveBeenCalledWith([
      expect.objectContaining({ processId: 100 }),
      expect.objectContaining({ processId: 101 }),
    ]);
    expect(spawnProcess).toHaveBeenNthCalledWith(
      1,
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      [
        '--new-window',
        '--no-first-run',
        '--no-default-browser-check',
        '--remote-debugging-port=9333',
        'https://www.educoder.net/login',
      ],
      {
        stdio: 'ignore',
        windowsHide: false,
      },
    );
    expect(spawnProcess).toHaveBeenNthCalledWith(
      2,
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      [
        '--new-window',
        '--no-first-run',
        '--no-default-browser-check',
        '--remote-debugging-port=9444',
        'https://www.educoder.net/login',
      ],
      {
        stdio: 'ignore',
        windowsHide: false,
      },
    );
    expect(output.appendLine).toHaveBeenCalledWith(
      '[edge-reuse] devtools not ready; detected lingering Edge background process, killing it and retrying once',
    );
  });

  it('surfaces the original error when there is no safe startup-boost recovery path', async () => {
    const waitForDebugger = vi.fn<(port: number) => Promise<void>>().mockRejectedValue(
      new Error('devtools did not open'),
    );
    const killBrowserProcesses = vi.fn(async () => undefined);

    await expect(
      launchDefaultProfileEdgeDevtoolsWindow({
        launchUrl: 'https://www.educoder.net/login',
        resolveEdgePath: async () =>
          'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        findAvailablePort: async () => 9333,
        spawnProcess: vi.fn(() => ({})),
        waitForDebugger,
        listBrowserProcesses: async () => [
          {
            processId: 200,
            commandLine:
              '"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" https://example.com',
          },
        ],
        killBrowserProcesses,
      }),
    ).rejects.toThrow('devtools did not open');

    expect(killBrowserProcesses).not.toHaveBeenCalled();
  });

  it('falls back to aggressive browser-process recovery when selective startup-boost recovery is unavailable', async () => {
    const output = {
      appendLine: vi.fn(),
    };
    const spawnProcess = vi.fn<
      (
        command: string,
        args: string[],
        options: {
          stdio: 'ignore';
          windowsHide: boolean;
        },
      ) => unknown
    >(() => ({}));
    const waitForDebugger = vi
      .fn<(port: number) => Promise<void>>()
      .mockRejectedValueOnce(new Error('devtools did not open'))
      .mockResolvedValueOnce(undefined);
    const listBrowserProcesses = vi
      .fn<() => Promise<Array<{ processId: number; commandLine: string }>>>()
      .mockResolvedValueOnce([
        {
          processId: 201,
          commandLine:
            '"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" https://example.com',
        },
        {
          processId: 202,
          commandLine:
            '"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" --new-window --remote-debugging-port=9333 https://www.educoder.net/login',
        },
      ])
      .mockResolvedValueOnce([
        {
          processId: 201,
          commandLine:
            '"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" https://example.com',
        },
        {
          processId: 202,
          commandLine:
            '"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" --new-window --remote-debugging-port=9333 https://www.educoder.net/login',
        },
      ]);
    const killBrowserProcesses = vi.fn(async () => undefined);
    const findAvailablePort = vi
      .fn<() => Promise<number>>()
      .mockResolvedValueOnce(9333)
      .mockResolvedValueOnce(9444);

    await expect(
      launchDefaultProfileEdgeDevtoolsWindow({
        launchUrl: 'https://www.educoder.net/login',
        output,
        resolveEdgePath: async () =>
          'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        findAvailablePort,
        spawnProcess,
        waitForDebugger,
        listBrowserProcesses,
        killBrowserProcesses,
        allowAggressiveRecovery: true,
      }),
    ).resolves.toEqual({
      edgeExecutable: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      port: 9444,
      url: 'https://www.educoder.net/login',
    });

    expect(killBrowserProcesses).toHaveBeenCalledTimes(1);
    expect(killBrowserProcesses).toHaveBeenCalledWith([
      expect.objectContaining({ processId: 201 }),
      expect.objectContaining({ processId: 202 }),
    ]);
    expect(output.appendLine).toHaveBeenCalledWith(
      '[edge-reuse] devtools still not ready; killing all browser-level Edge processes and retrying once',
    );
  });

  it('normalizes PowerShell-style ProcessId/CommandLine keys before aggressive recovery', async () => {
    const output = {
      appendLine: vi.fn(),
    };
    const spawnProcess = vi.fn<
      (
        command: string,
        args: string[],
        options: {
          stdio: 'ignore';
          windowsHide: boolean;
        },
      ) => unknown
    >(() => ({}));
    const waitForDebugger = vi
      .fn<(port: number) => Promise<void>>()
      .mockRejectedValueOnce(new Error('devtools did not open'))
      .mockResolvedValueOnce(undefined);
    const killBrowserProcesses = vi.fn(async () => undefined);
    const findAvailablePort = vi
      .fn<() => Promise<number>>()
      .mockResolvedValueOnce(9333)
      .mockResolvedValueOnce(9444);

    await expect(
      launchDefaultProfileEdgeDevtoolsWindow({
        launchUrl: 'https://www.educoder.net/login',
        output,
        resolveEdgePath: async () =>
          'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        findAvailablePort,
        spawnProcess,
        waitForDebugger,
        listBrowserProcesses: async () =>
          [
            {
              ProcessId: 301,
              CommandLine:
                '"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" https://example.com',
            },
            {
              ProcessId: 302,
              CommandLine:
                '"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" --new-window --remote-debugging-port=9333 https://www.educoder.net/login',
            },
          ] as any,
        killBrowserProcesses,
        allowAggressiveRecovery: true,
      }),
    ).resolves.toEqual({
      edgeExecutable: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      port: 9444,
      url: 'https://www.educoder.net/login',
    });

    expect(killBrowserProcesses).toHaveBeenCalledTimes(1);
    expect(killBrowserProcesses).toHaveBeenCalledWith([
      expect.objectContaining({ processId: 301 }),
      expect.objectContaining({ processId: 302 }),
    ]);
    expect(output.appendLine).toHaveBeenCalledWith(
      '[edge-reuse] devtools still not ready; killing all browser-level Edge processes and retrying once',
    );
  });
});
