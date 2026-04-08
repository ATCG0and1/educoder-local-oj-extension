import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  computeWorkspaceCodeHash,
  readOfficialJudgeCache,
  writeOfficialJudgeCache,
  type CachedOfficialJudgeEntry,
} from '../../src/core/remote/officialCache.js';

const tempDirs: string[] = [];

async function createTempTaskRoot(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'educoder-official-cache-'));
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

describe('officialCache', () => {
  it('computes a stable hash from workspace code files', async () => {
    const taskRoot = await createTempTaskRoot();
    await writeTextFile(path.join(taskRoot, 'workspace', 'b.cpp'), 'int b() { return 2; }\n');
    await writeTextFile(path.join(taskRoot, 'workspace', 'nested', 'a.cpp'), 'int a() { return 1; }\n');

    const firstHash = await computeWorkspaceCodeHash(taskRoot);
    const secondHash = await computeWorkspaceCodeHash(taskRoot);

    expect(firstHash).toBe(secondHash);
    expect(firstHash).toHaveLength(64);
  });

  it('persists and reloads cached official results by code hash', async () => {
    const taskRoot = await createTempTaskRoot();
    await writeTextFile(path.join(taskRoot, 'workspace', 'main.cpp'), 'int main() { return 0; }\n');
    const codeHash = await computeWorkspaceCodeHash(taskRoot);

    const entry: CachedOfficialJudgeEntry = {
      codeHash,
      summary: {
        verdict: 'passed',
        score: 100,
        message: 'Accepted',
        rawLogPath: '_educoder/judge/remote_runs/2026-04-01T00-00-00.000Z.json',
      },
      cachedAt: '2026-04-01T00:00:00.000Z',
    };

    await writeOfficialJudgeCache(taskRoot, entry);
    const loaded = await readOfficialJudgeCache(taskRoot, codeHash);

    expect(loaded).toEqual(entry);
    const rawIndex = JSON.parse(
      await readFile(path.join(taskRoot, '_educoder', 'cache', 'official_hash_index.json'), 'utf8'),
    ) as { entries: Record<string, CachedOfficialJudgeEntry> };
    expect(rawIndex.entries[codeHash]?.summary.verdict).toBe('passed');
  });
});
