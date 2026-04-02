import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runLocalJudge } from '../../src/core/judge/localRunner.js';
import { buildTaskStateModel } from '../../src/core/ui/stateModel.js';

const tempDirs: string[] = [];

async function createTempTaskRoot(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'educoder-hidden-coverage-'));
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

describe('local hidden coverage', () => {
  it('counts all cached hidden datasets in a full local judge run', async () => {
    const taskRoot = await createTempTaskRoot();
    await writeTextFile(path.join(taskRoot, 'workspace', 'test1', 'main.cpp'), 'int main() {}\n');

    for (const [index, value] of ['1', '2', '3', '4', '5'].entries()) {
      const caseId = String(index + 1).padStart(3, '0');
      await writeTextFile(path.join(taskRoot, '_educoder', 'tests', 'hidden', `case_${caseId}_input.txt`), `${value}\n`);
      await writeTextFile(path.join(taskRoot, '_educoder', 'tests', 'hidden', `case_${caseId}_output.txt`), `${value}\n`);
    }

    const report = await runLocalJudge({
      taskRoot,
      compileWorkspace: async ({ workspaceDir }) => ({
        success: true,
        executablePath: path.join(workspaceDir, 'app.exe'),
        stdout: '',
        stderr: '',
      }),
      executeBinary: vi.fn(async ({ input }) => ({
        stdout: input,
        stderr: '',
        exitCode: 0,
        timedOut: false,
      })),
    });

    expect(report.summary.total).toBe(5);
    expect(report.summary.passed + report.summary.failed).toBe(5);
  });

  it('exposes workspace-only vs local-ready readiness in task state', () => {
    expect(
      buildTaskStateModel({
        taskManifest: { taskId: 'task-1', name: 'Task 1', position: 1, folderName: '01 Task 1 [task-1]' },
        workspaceReady: true,
      }).readiness,
    ).toBe('workspace_only');

    expect(
      buildTaskStateModel({
        taskManifest: { taskId: 'task-1', name: 'Task 1', position: 1, folderName: '01 Task 1 [task-1]' },
        workspaceReady: true,
        hiddenTestsCached: true,
      }).readiness,
    ).toBe('local_ready');
  });
});
