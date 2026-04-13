import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  openLatestCompileErrorCommand,
  TASK_COMPILE_ERROR_REQUIRED_ERROR_MESSAGE,
} from '../../src/commands/openTaskPackageFiles.js';

const tempDirs: string[] = [];

async function createTempTaskRoot(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'educoder-compile-error-open-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('openLatestCompileErrorCommand', () => {
  it('writes and opens latest_compile_error.log with the full compile stderr content', async () => {
    const taskRoot = await createTempTaskRoot();
    const reportPath = path.join(taskRoot, '_educoder', 'judge', 'latest_local.json');
    const testsAllDir = path.join(taskRoot, 'tests', 'all');
    await import('node:fs/promises').then(({ mkdir }) =>
      Promise.all([
        mkdir(path.dirname(reportPath), { recursive: true }),
        mkdir(testsAllDir, { recursive: true }),
      ]),
    );

    await Promise.all([
      writeFile(
        reportPath,
        JSON.stringify(
          {
            source: 'tests/all',
            runMode: 'full',
            compile: {
              verdict: 'compile_error',
              stdout: '',
              stderr: [
                'test2.cpp: In function `int main()`:',
                'test2.cpp:12:1: error: `dsadjhajdh` was not declared in this scope',
                'dsadjhajdh',
                '^~~~~~~~~~',
                'test2.cpp:15:2: error: expected primary-expression before `)` token',
                '()',
                '^',
              ].join('\n'),
              executablePath: undefined,
              sourceFiles: ['test2.cpp'],
            },
            caseResults: [],
            summary: { total: 0, passed: 0, failed: 0 },
          },
          null,
          2,
        ),
        'utf8',
      ),
      writeFile(path.join(taskRoot, 'tests', 'all', 'case_001_input.txt'), '1\n', 'utf8'),
      writeFile(path.join(taskRoot, 'tests', 'all', 'case_001_output.txt'), '1\n', 'utf8'),
    ]);

    const openTextDocument = vi.fn(async (targetPath: string) => ({ targetPath }));
    const showTextDocument = vi.fn(async () => undefined);

    const result = await openLatestCompileErrorCommand(taskRoot, {
      openTextDocument,
      showTextDocument,
    });

    const logPath = path.join(taskRoot, '_educoder', 'judge', 'latest_compile_error.log');
    expect(result).toMatchObject({ openedPath: logPath, openedKind: 'file' });
    expect(openTextDocument).toHaveBeenCalledWith(logPath);
    expect(showTextDocument).toHaveBeenCalledTimes(1);

    await expect(readFile(logPath, 'utf8')).resolves.toContain('0/1');
    await expect(readFile(logPath, 'utf8')).resolves.toContain('test2.cpp:12:1: error');
    await expect(readFile(logPath, 'utf8')).resolves.toContain('test2.cpp:15:2: error');
  });

  it('fails loudly when there is no latest compile_error report to open', async () => {
    const taskRoot = await createTempTaskRoot();

    await expect(openLatestCompileErrorCommand(taskRoot)).rejects.toThrow(
      TASK_COMPILE_ERROR_REQUIRED_ERROR_MESSAGE,
    );
  });
});
