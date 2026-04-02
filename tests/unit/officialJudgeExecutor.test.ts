import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runOfficialJudgeCommand } from '../../src/commands/runOfficialJudge.js';
import {
  configureDefaultOfficialJudgeExecutor,
  createOfficialJudgeExecutor,
} from '../../src/core/remote/officialJudgeExecutor.js';

const tempDirs: string[] = [];

async function createTempTaskRoot(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'educoder-official-exec-'));
  tempDirs.push(dir);
  return dir;
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await import('node:fs/promises').then(({ mkdir }) => mkdir(path.dirname(filePath), { recursive: true }));
  await writeFile(filePath, JSON.stringify(value, null, 2), 'utf8');
}

afterEach(async () => {
  configureDefaultOfficialJudgeExecutor(undefined);
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('officialJudgeExecutor', () => {
  it('reuses the default configured executor instead of throwing configuration errors', async () => {
    const taskRoot = await createTempTaskRoot();
    await import('node:fs/promises').then(({ mkdir }) =>
      mkdir(path.join(taskRoot, 'workspace', 'test1'), { recursive: true }),
    );
    await writeFile(path.join(taskRoot, 'workspace', 'test1', 'tasks.h'), '#pragma once\n', 'utf8');
    await writeJson(path.join(taskRoot, '_educoder', 'meta', 'task.json'), {
      taskId: 'fc7pz3fm6yjh',
      homeworkId: '3727439',
      gameId: 215617259,
      challengeId: 4132394,
      shixunEnvironmentId: 1309307,
      currentUserId: 2312645,
      userLogin: 'mbzfstnkj',
      myshixunIdentifier: 'obcts7i5fx',
    });

    const post = vi
      .fn()
      .mockResolvedValueOnce({
        content: { commitID: 'commit-1' },
        resubmit: 'resubmit-1',
        sec_key: 'sec-key-1',
        content_modified: 0,
      })
      .mockResolvedValueOnce({
        status: 1,
        message: 'Accepted',
        had_done: 1,
      });

    configureDefaultOfficialJudgeExecutor(
      createOfficialJudgeExecutor({
        post,
      } as any),
    );

    await expect(runOfficialJudgeCommand(taskRoot)).resolves.toMatchObject({
      summary: {
        verdict: 'passed',
      },
    });
    expect(post).toHaveBeenCalledTimes(2);
  });
});
