import { describe, expect, it, vi } from 'vitest';
import { runLocalJudgeCommand } from '../../src/commands/runLocalJudge.js';

describe('runLocalJudgeCommand', () => {
  it('saves dirty editors before evaluating but stays quiet by default so the task summary can refresh in place', async () => {
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
        total: 2,
        passed: 2,
        failed: 0,
      },
    }));

    const result = await runLocalJudgeCommand('C:/task', {
      workspace: { saveAll },
      runLocalJudge,
      window: {
        showInformationMessage,
        showErrorMessage,
      },
    });

    expect(saveAll).toHaveBeenCalledTimes(1);
    expect(runLocalJudge).toHaveBeenCalledWith({ taskRoot: 'C:/task' });
    expect(result.workspacePath).toBe('code/current');
    expect(showInformationMessage).not.toHaveBeenCalled();
    expect(showErrorMessage).not.toHaveBeenCalled();
  });

  it('uses concise summary-first toast copy when notifications are explicitly enabled', async () => {
    const showInformationMessage = vi.fn(async () => undefined);
    const showErrorMessage = vi.fn(async () => undefined);

    await runLocalJudgeCommand('C:/task', {
      notify: true,
      saveBeforeRun: false,
      runLocalJudge: async () => ({
        source: 'tests/all',
        workspacePath: 'code/current',
        runMode: 'full',
        compile: {
          verdict: 'compile_error',
          stdout: '',
          stderr: '',
          executablePath: undefined,
        },
        caseResults: [],
        summary: {
          total: 0,
          passed: 0,
          failed: 0,
        },
      }),
      window: {
        showInformationMessage,
        showErrorMessage,
      },
    });

    expect(showInformationMessage).not.toHaveBeenCalled();
    expect(showErrorMessage).toHaveBeenCalledWith('本地结果：编译失败 · 请检查编译输出。');
  });

  it('uses case-oriented failure toast copy when notifications are explicitly enabled for a failed case', async () => {
    const showInformationMessage = vi.fn(async () => undefined);
    const showErrorMessage = vi.fn(async () => undefined);

    await runLocalJudgeCommand('C:/task', {
      notify: true,
      saveBeforeRun: false,
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
        caseResults: [
          {
            caseId: 'case_002',
            verdict: 'failed',
            inputPath: 'tests/all/case_002_input.txt',
            outputPath: 'tests/all/case_002_output.txt',
            expected: '5\n',
            actual: '4\n',
            stdout: '4\n',
            stderr: '',
          },
        ],
        summary: {
          total: 3,
          passed: 2,
          failed: 1,
        },
      }),
      window: {
        showInformationMessage,
        showErrorMessage,
      },
    });

    expect(showInformationMessage).not.toHaveBeenCalled();
    expect(showErrorMessage).toHaveBeenCalledWith('本地结果：失败 case_002（1/3） · 可直接查看失败输入/输出。');
  });

  it('keeps explicit success notifications free of internal path wording', async () => {
    const showInformationMessage = vi.fn(async () => undefined);
    const showErrorMessage = vi.fn(async () => undefined);

    await runLocalJudgeCommand('C:/task', {
      notify: true,
      saveBeforeRun: false,
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
          total: 2,
          passed: 2,
          failed: 0,
        },
      }),
      window: {
        showInformationMessage,
        showErrorMessage,
      },
    });

    expect(showErrorMessage).not.toHaveBeenCalled();
    expect(showInformationMessage).toHaveBeenCalledWith('本地结果：通过 2/2');
  });

  it('does not wait for success notifications to be dismissed before resolving the command', async () => {
    const showInformationMessage = vi.fn(() => new Promise<unknown>(() => undefined));
    const showErrorMessage = vi.fn(async () => undefined);

    await expect(
      Promise.race([
        runLocalJudgeCommand('C:/task', {
          notify: true,
          saveBeforeRun: false,
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
              total: 2,
              passed: 2,
              failed: 0,
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

  it('fails loudly when current code cannot be saved before local evaluation', async () => {
    const saveAll = vi.fn(async () => false);
    const runLocalJudge = vi.fn();

    await expect(
      runLocalJudgeCommand('C:/task', {
        workspace: { saveAll },
        runLocalJudge: runLocalJudge as any,
        window: {
          showInformationMessage: vi.fn(async () => undefined),
          showErrorMessage: vi.fn(async () => undefined),
        },
      }),
    ).rejects.toThrow('保存当前代码失败，已停止本地测试。');

    expect(saveAll).toHaveBeenCalledTimes(1);
    expect(runLocalJudge).not.toHaveBeenCalled();
  });
});
