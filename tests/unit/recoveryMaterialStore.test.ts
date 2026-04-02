import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  readRecoveryMetadata,
  writeRecoveryMetadata,
} from '../../src/core/recovery/materialStore.js';

const tempDirs: string[] = [];

async function createTempTaskRoot(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'educoder-recovery-meta-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('recoveryMaterialStore', () => {
  it('writes and reads recovery metadata under _educoder/meta/recovery.json', async () => {
    const taskRoot = await createTempTaskRoot();

    await writeRecoveryMetadata(taskRoot, {
      templateReady: true,
      templateFileCount: 1,
      passedReady: true,
      passedFileCount: 1,
      answerReady: true,
      answerEntryCount: 2,
      historyReady: false,
      historyFileCount: 0,
      updatedAt: '2026-04-02T00:00:00.000Z',
    });

    await expect(readRecoveryMetadata(taskRoot)).resolves.toEqual({
      templateReady: true,
      templateFileCount: 1,
      passedReady: true,
      passedFileCount: 1,
      answerReady: true,
      answerEntryCount: 2,
      historyReady: false,
      historyFileCount: 0,
      updatedAt: '2026-04-02T00:00:00.000Z',
    });
    await expect(readFile(path.join(taskRoot, '_educoder', 'meta', 'recovery.json'), 'utf8')).resolves.toContain(
      '"answerEntryCount": 2',
    );
  });
});
