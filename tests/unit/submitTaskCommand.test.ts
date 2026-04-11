import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { submitTaskCommand } from '../../src/commands/submitTask.js';

describe('submitTaskCommand', () => {
  it('saves current code before running local and remote evaluation', async () => {
    const saveAll = vi.fn(async () => true);
    const showInformationMessage = vi.fn(async () => undefined);
    const showErrorMessage = vi.fn(async () => undefined);
    const runLocalJudge = vi.fn(async () => ({
      source: 'tests/all' as const,
      workspacePath: 'code/current',
      runMode: 'full' as const,
      compile: {
        verdict: 'compiled' as const,
        stdout: '',
        stderr: '',
        executablePath: 'C:/task/code/current/app.exe',
      },
      caseResults: [],
      summary: {
        total: 1,
        passed: 1,
        failed: 0,
      },
    }));
    const runRemoteJudge = vi.fn(async () => ({
      source: 'remote' as const,
      codeHash: 'hash-1',
      generatedAt: new Date().toISOString(),
      summary: {
        verdict: 'passed' as const,
        score: 100,
        passedCount: 1,
        totalCount: 1,
        message: 'Accepted',
        rawLogPath: path.join('C:/task', '_educoder', 'judge', 'remote_runs', 'latest.json'),
      },
    }));

    const result = await submitTaskCommand('C:/task', {
      workspace: { saveAll },
      runLocalJudge,
      runRemoteJudge,
      window: {
        showInformationMessage,
        showErrorMessage,
      },
    });

    expect(saveAll).toHaveBeenCalledTimes(1);
    expect(saveAll.mock.invocationCallOrder[0]).toBeLessThan(runLocalJudge.mock.invocationCallOrder[0]);
    expect(runLocalJudge).toHaveBeenCalledTimes(1);
    expect(runRemoteJudge).toHaveBeenCalledWith({ force: false });
    expect(result.decision).toBe('submitted_after_local_pass');
    expect(result.remote).toMatchObject({
      passedCount: 1,
      totalCount: 1,
    });
    expect(showInformationMessage).toHaveBeenCalledWith('已提交到头哥：已通过 1/1 · Accepted');
    expect(showInformationMessage).toHaveBeenCalledTimes(1);
    expect((showInformationMessage.mock.calls as string[][])[0]?.[0]).not.toContain('100 分');
    expect(showErrorMessage).not.toHaveBeenCalled();
  });

  it('stops submit when saving current code fails', async () => {
    const saveAll = vi.fn(async () => false);
    const runLocalJudge = vi.fn();
    const runRemoteJudge = vi.fn();

    await expect(
      submitTaskCommand('C:/task', {
        workspace: { saveAll },
        runLocalJudge: runLocalJudge as any,
        runRemoteJudge: runRemoteJudge as any,
        window: {
          showInformationMessage: vi.fn(async () => undefined),
          showErrorMessage: vi.fn(async () => undefined),
        },
      }),
    ).rejects.toThrow('保存当前代码失败，已停止提交评测。');

    expect(saveAll).toHaveBeenCalledTimes(1);
    expect(runLocalJudge).not.toHaveBeenCalled();
    expect(runRemoteJudge).not.toHaveBeenCalled();
  });

  it('uses pass-count wording instead of score wording when the remote verdict fails', async () => {
    const showInformationMessage = vi.fn(async () => undefined);
    const showErrorMessage = vi.fn(async () => undefined);

    await submitTaskCommand('C:/task', {
      workspace: { saveAll: vi.fn(async () => true) },
      runLocalJudge: async () => ({
        source: 'tests/all',
        workspacePath: 'code/current',
        runMode: 'full',
        compile: {
          verdict: 'compiled',
          stdout: '',
          stderr: '',
          executablePath: 'C:/task/code/current/app.exe',
        },
        caseResults: [],
        summary: {
          total: 5,
          passed: 5,
          failed: 0,
        },
      }),
      runRemoteJudge: async () => ({
        source: 'remote',
        codeHash: 'hash-2',
        generatedAt: new Date().toISOString(),
        summary: {
          verdict: 'failed',
          score: 60,
          message: 'Wrong Answer',
          rawLogPath: path.join('C:/task', '_educoder', 'judge', 'remote_runs', 'latest.json'),
        },
      }),
      window: {
        showInformationMessage,
        showErrorMessage,
      },
    });

    expect(showInformationMessage).not.toHaveBeenCalled();
    expect(showErrorMessage).toHaveBeenCalledWith('已提交到头哥：未通过 3/5 · Wrong Answer');
    expect(showErrorMessage).toHaveBeenCalledTimes(1);
    expect((showErrorMessage.mock.calls as string[][])[0]?.[0]).not.toContain('60 分');
  });

  it('does not wait for notification dismissal before resolving submit results', async () => {
    const showInformationMessage = vi.fn(() => new Promise<unknown>(() => undefined));
    const showErrorMessage = vi.fn(async () => undefined);

    await expect(
      Promise.race([
        submitTaskCommand('C:/task', {
          workspace: { saveAll: vi.fn(async () => true) },
          runLocalJudge: async () => ({
            source: 'tests/all',
            workspacePath: 'code/current',
            runMode: 'full',
            compile: {
              verdict: 'compiled',
              stdout: '',
              stderr: '',
              executablePath: 'C:/task/code/current/app.exe',
            },
            caseResults: [],
            summary: {
              total: 1,
              passed: 1,
              failed: 0,
            },
          }),
          runRemoteJudge: async () => ({
            source: 'remote',
            codeHash: 'hash-3',
            generatedAt: new Date().toISOString(),
            summary: {
              verdict: 'passed',
              score: 100,
              passedCount: 1,
              totalCount: 1,
              message: 'Accepted',
              rawLogPath: path.join('C:/task', '_educoder', 'judge', 'remote_runs', 'latest.json'),
            },
          }),
          window: {
            showInformationMessage,
            showErrorMessage,
          },
        }).then(() => 'resolved'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 50)),
      ]),
    ).resolves.toBe('resolved');
  });
});
