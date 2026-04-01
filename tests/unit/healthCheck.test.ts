import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runHealthCheck } from '../../src/core/health/healthCheck.js';

const tempDirs: string[] = [];

async function createTempTaskRoot(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'educoder-health-'));
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

describe('runHealthCheck', () => {
  it('reports a missing compiler', async () => {
    const issues = await runHealthCheck({
      compilerAvailable: false,
      sessionValid: true,
    });

    expect(issues.map((issue) => issue.code)).toContain('missing_compiler');
  });

  it('reports an invalid session', async () => {
    const issues = await runHealthCheck({
      compilerAvailable: true,
      sessionValid: false,
    });

    expect(issues.map((issue) => issue.code)).toContain('invalid_session');
  });

  it('reports missing hidden tests in a task workspace', async () => {
    const taskRoot = await createTempTaskRoot();
    await writeTextFile(path.join(taskRoot, 'workspace', 'test1', 'test1.cpp'), 'int main() { return 0; }\n');

    const issues = await runHealthCheck({
      compilerAvailable: true,
      sessionValid: true,
      taskRoot,
    });

    expect(issues.map((issue) => issue.code)).toContain('missing_hidden_tests');
  });
});
