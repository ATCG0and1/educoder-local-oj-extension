import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  readHistoryIndex,
  writeHistoryArtifacts,
} from '../../src/core/recovery/historyStore.js';

const tempDirs: string[] = [];

async function createTempTaskRoot(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'educoder-history-store-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('historyStore', () => {
  it('writes raw logs and the normalized history index under _educoder/history', async () => {
    const taskRoot = await createTempTaskRoot();

    await writeHistoryArtifacts(taskRoot, {
      rawEvaluateLogs: { status: 0 },
      rawRedoLogs: { status: 0 },
      index: {
        filePath: 'test1/tasks.h',
        evaluations: [{ queryIndex: 14, createdAt: '2026-03-31T16:09:26.000+08:00' }],
        redoLogs: [{ createdAt: '2026-03-31T14:42:02.000+08:00', redoType: 2 }],
        updatedAt: '2026-04-02T00:00:00.000Z',
      },
    });

    await expect(readHistoryIndex(taskRoot)).resolves.toEqual({
      filePath: 'test1/tasks.h',
      evaluations: [{ queryIndex: 14, createdAt: '2026-03-31T16:09:26.000+08:00' }],
      redoLogs: [{ createdAt: '2026-03-31T14:42:02.000+08:00', redoType: 2 }],
      updatedAt: '2026-04-02T00:00:00.000Z',
    });
    await expect(readFile(path.join(taskRoot, '_educoder', 'history', 'evaluate_logs.json'), 'utf8')).resolves.toContain(
      '"status": 0',
    );
    await expect(readFile(path.join(taskRoot, '_educoder', 'history', 'index.json'), 'utf8')).resolves.toContain(
      '"queryIndex": 14',
    );
  });
});
