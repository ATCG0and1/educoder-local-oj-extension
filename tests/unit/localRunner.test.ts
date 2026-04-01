import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runLocalJudge } from '../../src/core/judge/localRunner.js';
import type { LocalJudgeReport } from '../../src/core/judge/resultStore.js';

const tempDirs: string[] = [];

async function createTempTaskRoot(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'educoder-local-runner-'));
  tempDirs.push(dir);
  return dir;
}

async function writeTextFile(targetPath: string, content: string): Promise<void> {
  await import('node:fs/promises').then(({ mkdir }) => mkdir(path.dirname(targetPath), { recursive: true }));
  await writeFile(targetPath, content, 'utf8');
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('runLocalJudge', () => {
  it('compiles against the task workspace and writes reports/latest_local.json', async () => {
    const taskRoot = await createTempTaskRoot();
    await writeTextFile(path.join(taskRoot, 'workspace', 'test1', 'test1.cpp'), 'int main() {}\n');
    await writeTextFile(path.join(taskRoot, '_educoder', 'tests', 'hidden', 'case_001_input.txt'), '1 2\n');
    await writeTextFile(path.join(taskRoot, '_educoder', 'tests', 'hidden', 'case_001_output.txt'), '3\n');

    const compileWorkspace = vi.fn(async ({ workspaceDir }: { workspaceDir: string }) => ({
      success: true,
      executablePath: path.join(workspaceDir, 'app.exe'),
      stdout: '',
      stderr: '',
    }));
    const executeBinary = vi.fn(async () => ({
      stdout: '3\n',
      stderr: '',
      exitCode: 0,
      timedOut: false,
    }));

    const result = await runLocalJudge({
      taskRoot,
      compileWorkspace,
      executeBinary,
    });

    expect(compileWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceDir: path.join(taskRoot, 'workspace'),
      }),
    );
    expect(result.caseResults).toHaveLength(1);
    expect(result.caseResults[0]?.verdict).toBe('passed');
    await expect(access(path.join(taskRoot, 'reports', 'latest_local.json'))).resolves.toBeUndefined();
  });

  it('returns compile_error without executing cases when compilation fails', async () => {
    const taskRoot = await createTempTaskRoot();
    await writeTextFile(path.join(taskRoot, 'workspace', 'test1', 'test1.cpp'), 'broken\n');

    const compileWorkspace = vi.fn(async () => ({
      success: false,
      executablePath: undefined,
      stdout: '',
      stderr: 'compile error',
    }));
    const executeBinary = vi.fn();

    const result = await runLocalJudge({
      taskRoot,
      compileWorkspace,
      executeBinary,
    });

    expect(result.compile.verdict).toBe('compile_error');
    expect(result.caseResults).toEqual([]);
    expect(executeBinary).not.toHaveBeenCalled();
  });

  it('reruns only failed cases when rerunFailedOnly is enabled', async () => {
    const taskRoot = await createTempTaskRoot();
    await writeTextFile(path.join(taskRoot, 'workspace', 'test1', 'test1.cpp'), 'int main() {}\n');
    await writeTextFile(path.join(taskRoot, '_educoder', 'tests', 'hidden', 'case_001_input.txt'), '1\n');
    await writeTextFile(path.join(taskRoot, '_educoder', 'tests', 'hidden', 'case_001_output.txt'), '1\n');
    await writeTextFile(path.join(taskRoot, '_educoder', 'tests', 'hidden', 'case_002_input.txt'), '2\n');
    await writeTextFile(path.join(taskRoot, '_educoder', 'tests', 'hidden', 'case_002_output.txt'), '2\n');

    const lastReport: LocalJudgeReport = {
      runMode: 'full',
      compile: {
        verdict: 'compiled',
        stdout: '',
        stderr: '',
        executablePath: path.join(taskRoot, 'workspace', 'app.exe'),
      },
      caseResults: [
        { caseId: 'case_001', verdict: 'passed', expected: '1\n', actual: '1\n', stdout: '1\n', stderr: '' },
        { caseId: 'case_002', verdict: 'failed', expected: '2\n', actual: '0\n', stdout: '0\n', stderr: '' },
      ],
      summary: {
        total: 2,
        passed: 1,
        failed: 1,
      },
    };

    const compileWorkspace = vi.fn(async ({ workspaceDir }: { workspaceDir: string }) => ({
      success: true,
      executablePath: path.join(workspaceDir, 'app.exe'),
      stdout: '',
      stderr: '',
    }));
    const executeBinary = vi.fn(async ({ input }: { input: string }) => ({
      stdout: input,
      stderr: '',
      exitCode: 0,
      timedOut: false,
    }));

    const result = await runLocalJudge({
      taskRoot,
      rerunFailedOnly: true,
      lastReport,
      compileWorkspace,
      executeBinary,
    });

    expect(result.runMode).toBe('failed-only');
    expect(result.caseResults.map((item) => item.caseId)).toEqual(['case_002']);
  });
});
