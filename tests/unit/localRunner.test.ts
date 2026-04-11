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
  it('prefers code/current and tests/all, then writes a source-aware local report under _educoder/judge', async () => {
    const taskRoot = await createTempTaskRoot();
    await writeTextFile(path.join(taskRoot, 'code', 'current', 'test1', 'test1.cpp'), 'int main() {}\n');
    await writeTextFile(path.join(taskRoot, 'tests', 'all', 'case_001_input.txt'), '1 2\n');
    await writeTextFile(path.join(taskRoot, 'tests', 'all', 'case_001_output.txt'), '3\n');

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
        workspaceDir: path.join(taskRoot, 'code', 'current'),
      }),
    );
    expect(result.source).toBe('tests/all');
    expect(result.workspacePath).toBe('code/current');
    expect(result.caseResults).toHaveLength(1);
    expect(result.caseResults[0]).toMatchObject({
      inputPath: 'tests/all/case_001_input.txt',
      outputPath: 'tests/all/case_001_output.txt',
    });
    expect(result.caseResults[0]?.verdict).toBe('passed');
    await expect(access(path.join(taskRoot, '_educoder', 'judge', 'latest_local.json'))).resolves.toBeUndefined();
    await expect(readFile(path.join(taskRoot, '_educoder', 'judge', 'latest_local.json'), 'utf8')).resolves.toContain(
      '"source": "tests/all"',
    );
    await expect(access(path.join(taskRoot, '_educoder', 'judge', 'local_runs'))).rejects.toBeDefined();
  });

  it('returns compile_error without executing cases when compilation fails', async () => {
    const taskRoot = await createTempTaskRoot();
    await writeTextFile(path.join(taskRoot, 'code', 'current', 'test1', 'test1.cpp'), 'broken\n');
    await writeTextFile(path.join(taskRoot, 'tests', 'all', 'case_001_input.txt'), '1 2\n');
    await writeTextFile(path.join(taskRoot, 'tests', 'all', 'case_001_output.txt'), '3\n');

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

    expect(result.source).toBe('tests/all');
    expect(result.compile.verdict).toBe('compile_error');
    expect(result.caseResults).toEqual([]);
    expect(executeBinary).not.toHaveBeenCalled();
  });

  it('fails loudly when local tests are missing instead of producing an empty local judge report', async () => {
    const taskRoot = await createTempTaskRoot();
    await writeTextFile(path.join(taskRoot, 'code', 'current', 'test1', 'test1.cpp'), 'int main() {}\n');

    const compileWorkspace = vi.fn(async () => ({
      success: true,
      executablePath: path.join(taskRoot, 'code', 'current', 'app.exe'),
      stdout: '',
      stderr: '',
    }));
    const executeBinary = vi.fn();

    await expect(
      runLocalJudge({
        taskRoot,
        compileWorkspace,
        executeBinary,
      }),
    ).rejects.toThrow('未找到本地测试');

    expect(compileWorkspace).not.toHaveBeenCalled();
    expect(executeBinary).not.toHaveBeenCalled();
  });

  it('reruns only failed cases when rerunFailedOnly is enabled', async () => {
    const taskRoot = await createTempTaskRoot();
    await writeTextFile(path.join(taskRoot, 'code', 'current', 'test1', 'test1.cpp'), 'int main() {}\n');
    await writeTextFile(path.join(taskRoot, 'tests', 'all', 'case_001_input.txt'), '1\n');
    await writeTextFile(path.join(taskRoot, 'tests', 'all', 'case_001_output.txt'), '1\n');
    await writeTextFile(path.join(taskRoot, 'tests', 'all', 'case_002_input.txt'), '2\n');
    await writeTextFile(path.join(taskRoot, 'tests', 'all', 'case_002_output.txt'), '2\n');

    const lastReport: LocalJudgeReport = {
      source: 'tests/all',
      runMode: 'full',
      compile: {
        verdict: 'compiled',
        stdout: '',
        stderr: '',
        executablePath: path.join(taskRoot, 'code', 'current', 'app.exe'),
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

    expect(result.source).toBe('tests/all');
    expect(result.runMode).toBe('failed-only');
    expect(result.caseResults.map((item) => item.caseId)).toEqual(['case_002']);
  });

  it('passes editable compile preferences into the compiler so the build scope matches the current task workspace', async () => {
    const taskRoot = await createTempTaskRoot();
    await writeTextFile(path.join(taskRoot, 'code', 'current', 'src', 'main.cpp'), 'int main() {}\n');
    await writeTextFile(path.join(taskRoot, 'tests', 'all', 'case_001_input.txt'), '1\n');
    await writeTextFile(path.join(taskRoot, 'tests', 'all', 'case_001_output.txt'), '1\n');
    await writeTextFile(
      path.join(taskRoot, '_educoder', 'meta', 'task.json'),
      JSON.stringify({ editablePaths: ['src/main.cpp', 'docs/notes.md'] }, null, 2),
    );

    const compileWorkspace = vi.fn(async ({ workspaceDir }: { workspaceDir: string }) => ({
      success: true,
      executablePath: path.join(workspaceDir, 'app.exe'),
      stdout: '',
      stderr: '',
      sourceFiles: ['src/main.cpp'],
    }));
    const executeBinary = vi.fn(async () => ({
      stdout: '1\n',
      stderr: '',
      exitCode: 0,
      timedOut: false,
    }));

    await runLocalJudge({
      taskRoot,
      compileWorkspace: compileWorkspace as any,
      executeBinary,
    });

    expect(compileWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceDir: path.join(taskRoot, 'code', 'current'),
        preferredSourcePaths: ['src/main.cpp', 'docs/notes.md'],
        compileScopes: ['src', 'docs'],
      }),
    );
  });
});
