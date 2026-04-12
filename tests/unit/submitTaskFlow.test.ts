import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { submitTaskFlow } from '../../src/core/remote/submitTaskFlow.js';

const tempDirs: string[] = [];

async function createTempTaskRoot(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'educoder-submit-flow-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('submitTaskFlow', () => {
  it('runs local judge first and stops before remote submit when local tests fail by default', async () => {
    const taskRoot = await createTempTaskRoot();
    const runRemoteJudge = vi.fn();

    const report = await submitTaskFlow({
      taskRoot,
      runLocalJudge: async () => ({
        source: 'tests/all',
        runMode: 'full',
        compile: {
          verdict: 'compiled',
          stdout: '',
          stderr: '',
        },
        caseResults: [],
        summary: {
          total: 1,
          passed: 0,
          failed: 1,
        },
      }),
      runRemoteJudge,
    });

    expect(report.decision).toBe('stopped_after_local_failure');
    expect(report.local).toMatchObject({
      executed: true,
      passed: false,
      compileVerdict: 'compiled',
      total: 1,
      passedCount: 0,
      failedCount: 1,
    });
    expect(report.remote).toMatchObject({
      executed: false,
    });
    expect(runRemoteJudge).not.toHaveBeenCalled();
    await expect(readFile(path.join(taskRoot, '_educoder', 'judge', 'latest_submit.json'), 'utf8')).resolves.toContain(
      '"decision": "stopped_after_local_failure"',
    );
    await expect(access(path.join(taskRoot, '_educoder', 'judge', 'submit_runs'))).rejects.toBeDefined();
  });

  it('continues to Educoder when local tests fail and the caller confirms the submit', async () => {
    const taskRoot = await createTempTaskRoot();
    const confirmContinueAfterLocalFailure = vi.fn(async () => true);
    const runRemoteJudge = vi.fn(async () => ({
      source: 'remote' as const,
      codeHash: 'hash-confirmed-submit',
      generatedAt: new Date().toISOString(),
      summary: {
        verdict: 'passed' as const,
        score: 100,
        passedCount: 1,
        totalCount: 1,
        message: 'Accepted',
        rawLogPath: path.join(taskRoot, '_educoder', 'judge', 'remote_runs', 'latest.json'),
      },
    }));

    const report = await submitTaskFlow({
      taskRoot,
      confirmContinueAfterLocalFailure,
      runLocalJudge: async () => ({
        source: 'tests/all',
        runMode: 'full',
        compile: {
          verdict: 'compiled',
          stdout: '',
          stderr: '',
        },
        caseResults: [],
        summary: {
          total: 1,
          passed: 0,
          failed: 1,
        },
      }),
      runRemoteJudge,
    });

    expect(confirmContinueAfterLocalFailure).toHaveBeenCalledTimes(1);
    expect(report.decision).toBe('submitted_after_local_failure');
    expect(report.local).toMatchObject({
      executed: true,
      passed: false,
      total: 1,
      passedCount: 0,
      failedCount: 1,
    });
    expect(report.remote).toMatchObject({
      executed: true,
      verdict: 'passed',
      passedCount: 1,
      totalCount: 1,
      message: 'Accepted',
    });
    expect(runRemoteJudge).toHaveBeenCalledWith({ force: false });
  });

  it('submits to Educoder after local tests pass and persists a combined report', async () => {
    const taskRoot = await createTempTaskRoot();
    const runRemoteJudge = vi.fn(async () => ({
      source: 'remote' as const,
      codeHash: 'hash-1',
      generatedAt: new Date().toISOString(),
      summary: {
        verdict: 'passed' as const,
        score: 100,
        passedCount: 2,
        totalCount: 2,
        message: 'Accepted',
        rawLogPath: path.join(taskRoot, '_educoder', 'judge', 'remote_runs', 'latest.json'),
      },
    }));

    const report = await submitTaskFlow({
      taskRoot,
      runLocalJudge: async () => ({
        source: 'tests/all',
        runMode: 'full',
        compile: {
          verdict: 'compiled',
          stdout: '',
          stderr: '',
        },
        caseResults: [],
        summary: {
          total: 2,
          passed: 2,
          failed: 0,
        },
      }),
      runRemoteJudge,
    });

    expect(report.decision).toBe('submitted_after_local_pass');
    expect(report.local.passed).toBe(true);
    expect(report.remote).toMatchObject({
      executed: true,
      verdict: 'passed',
      score: 100,
      passedCount: 2,
      totalCount: 2,
      message: 'Accepted',
    });
    expect(runRemoteJudge).toHaveBeenCalledWith({ force: false });
  });

  it('continues to Educoder in force mode even when local tests fail', async () => {
    const taskRoot = await createTempTaskRoot();
    const runRemoteJudge = vi.fn(async () => ({
      source: 'remote' as const,
      codeHash: 'hash-2',
      generatedAt: new Date().toISOString(),
      summary: {
        verdict: 'failed' as const,
        score: 0,
        message: 'Wrong Answer',
        rawLogPath: path.join(taskRoot, '_educoder', 'judge', 'remote_runs', 'latest.json'),
      },
    }));

    const report = await submitTaskFlow({
      taskRoot,
      force: true,
      runLocalJudge: async () => ({
        source: 'tests/all',
        runMode: 'full',
        compile: {
          verdict: 'compiled',
          stdout: '',
          stderr: '',
        },
        caseResults: [],
        summary: {
          total: 1,
          passed: 0,
          failed: 1,
        },
      }),
      runRemoteJudge,
    });

    expect(report.decision).toBe('force_submitted');
    expect(report.local.passed).toBe(false);
    expect(report.remote).toMatchObject({
      executed: true,
      verdict: 'failed',
      score: 0,
      passedCount: 0,
      totalCount: 1,
      message: 'Wrong Answer',
    });
    expect(runRemoteJudge).toHaveBeenCalledWith({ force: true });
  });
});
