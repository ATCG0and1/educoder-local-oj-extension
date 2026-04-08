import { access, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runOfficialJudgeBridge } from '../../src/core/remote/officialJudge.js';

const tempDirs: string[] = [];

async function createTempTaskRoot(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'educoder-official-run-'));
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

describe('runOfficialJudgeBridge', () => {
  it('reuses the previous result when the workspace code hash is unchanged', async () => {
    const taskRoot = await createTempTaskRoot();
    await writeTextFile(path.join(taskRoot, 'code', 'current', 'main.cpp'), 'int main() { return 0; }\n');

    const executeRemoteJudge = vi.fn(async () => ({
      verdict: 'passed' as const,
      score: 100,
      message: 'Accepted',
      raw: { status: 'ok' },
    }));

    const firstRun = await runOfficialJudgeBridge({
      taskRoot,
      executeRemoteJudge,
    });
    const secondRun = await runOfficialJudgeBridge({
      taskRoot,
      executeRemoteJudge,
    });

    expect(firstRun.source).toBe('remote');
    expect(secondRun.source).toBe('cache');
    expect(executeRemoteJudge).toHaveBeenCalledTimes(1);
  });

  it('bypasses the cache in force mode and writes remote artifacts', async () => {
    const taskRoot = await createTempTaskRoot();
    await writeTextFile(path.join(taskRoot, 'code', 'current', 'main.cpp'), 'int main() { return 0; }\n');

    const executeRemoteJudge = vi
      .fn()
      .mockResolvedValueOnce({
        verdict: 'failed' as const,
        score: 60,
        message: 'Wrong Answer',
        raw: { status: 'wa', run: 1 },
      })
      .mockResolvedValueOnce({
        verdict: 'passed' as const,
        score: 100,
        message: 'Accepted',
        raw: { status: 'ok', run: 2 },
      });

    await runOfficialJudgeBridge({ taskRoot, executeRemoteJudge });
    const forcedRun = await runOfficialJudgeBridge({
      taskRoot,
      executeRemoteJudge,
      force: true,
    });

    expect(forcedRun.source).toBe('remote');
    expect(forcedRun.summary.verdict).toBe('passed');
    expect(executeRemoteJudge).toHaveBeenCalledTimes(2);

    await expect(access(path.join(taskRoot, '_educoder', 'judge', 'latest_remote.json'))).resolves.toBeUndefined();
    const remoteLogs = await readdir(path.join(taskRoot, '_educoder', 'judge', 'remote_runs'));
    expect(remoteLogs.length).toBeGreaterThanOrEqual(2);
  });
});
