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
      mkdir(path.join(taskRoot, 'code', 'current', 'test1'), { recursive: true }),
    );
    await writeFile(path.join(taskRoot, 'code', 'current', 'test1', 'tasks.h'), '#pragma once\n', 'utf8');
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

  it('fails with a friendly message when task metadata is missing', async () => {
    const taskRoot = await createTempTaskRoot();
    await import('node:fs/promises').then(({ mkdir }) =>
      mkdir(path.join(taskRoot, 'code', 'current', 'test1'), { recursive: true }),
    );
    await writeFile(path.join(taskRoot, 'code', 'current', 'test1', 'tasks.h'), '#pragma once\n', 'utf8');

    configureDefaultOfficialJudgeExecutor(
      createOfficialJudgeExecutor({
        post: vi.fn(),
      } as any),
    );

    await expect(runOfficialJudgeCommand(taskRoot)).rejects.toThrow('任务元数据缺失');
  });

  it('fails with a friendly message when the workspace has no source files', async () => {
    const taskRoot = await createTempTaskRoot();
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

    configureDefaultOfficialJudgeExecutor(
      createOfficialJudgeExecutor({
        post: vi.fn(),
      } as any),
    );

    await expect(runOfficialJudgeCommand(taskRoot)).rejects.toThrow('当前代码目录中没有可提交的源文件');
  });

  it('submits only editable workspace files in editablePaths order', async () => {
    const taskRoot = await createTempTaskRoot();
    await import('node:fs/promises').then(({ mkdir }) =>
      Promise.all([
        mkdir(path.join(taskRoot, 'code', 'current', 'docs'), { recursive: true }),
        mkdir(path.join(taskRoot, 'code', 'current', 'src'), { recursive: true }),
      ]),
    );
    await Promise.all([
      writeFile(path.join(taskRoot, 'code', 'current', 'docs', 'notes.md'), 'do not submit\n', 'utf8'),
      writeFile(path.join(taskRoot, 'code', 'current', 'src', 'b.cpp'), 'int b() { return 2; }\n', 'utf8'),
      writeFile(path.join(taskRoot, 'code', 'current', 'src', 'a.cpp'), 'int a() { return 1; }\n', 'utf8'),
    ]);
    await writeJson(path.join(taskRoot, '_educoder', 'meta', 'task.json'), {
      taskId: 'fc7pz3fm6yjh',
      homeworkId: '3727439',
      gameId: 215617259,
      challengeId: 4132394,
      shixunEnvironmentId: 1309307,
      currentUserId: 2312645,
      userLogin: 'mbzfstnkj',
      myshixunIdentifier: 'obcts7i5fx',
      editablePaths: ['src/b.cpp', 'src/a.cpp'],
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
        content: { commitID: 'commit-2' },
        resubmit: 'resubmit-2',
        sec_key: 'sec-key-2',
        content_modified: 1,
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

    expect(post).toHaveBeenNthCalledWith(
      1,
      '/api/myshixuns/obcts7i5fx/update_file.json',
      expect.objectContaining({
        path: 'src/b.cpp',
        evaluate: 0,
        content: 'int b() { return 2; }\n',
      }),
      { zzud: 'mbzfstnkj' },
    );
    expect(post).toHaveBeenNthCalledWith(
      2,
      '/api/myshixuns/obcts7i5fx/update_file.json',
      expect.objectContaining({
        path: 'src/a.cpp',
        evaluate: 1,
        content: 'int a() { return 1; }\n',
      }),
      { zzud: 'mbzfstnkj' },
    );
    expect(post).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        path: 'docs/notes.md',
      }),
      expect.anything(),
    );
  });

  it('refreshes judge metadata from task detail before posting files', async () => {
    const taskRoot = await createTempTaskRoot();
    await import('node:fs/promises').then(({ mkdir }) =>
      mkdir(path.join(taskRoot, 'code', 'current', 'src'), { recursive: true }),
    );
    await writeFile(path.join(taskRoot, 'code', 'current', 'src', 'main.cpp'), 'int main() { return 0; }\n', 'utf8');
    await writeJson(path.join(taskRoot, '_educoder', 'meta', 'task.json'), {
      taskId: 'fc7pz3fm6yjh',
      homeworkId: '3727439',
      gameId: 1,
      challengeId: 2,
      shixunEnvironmentId: 3,
      currentUserId: 4,
      userLogin: 'stale-login',
      myshixunIdentifier: 'stale-myshixun',
      editablePaths: ['legacy.cpp'],
    });

    const get = vi.fn(async () => ({
      game: { id: 215617259 },
      challenge: {
        id: 4132394,
        path: 'src/main.cpp；src/missing.cpp',
      },
      myshixun: { identifier: 'obcts7i5fx' },
      code_editor: { shixun_environment_id: 1309307 },
      user: {
        user_id: 2312645,
        login: 'mbzfstnkj',
      },
    }));
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
        get,
        post,
      } as any),
    );

    await expect(runOfficialJudgeCommand(taskRoot)).resolves.toMatchObject({
      summary: {
        verdict: 'passed',
      },
    });

    expect(get).toHaveBeenCalledWith('/api/tasks/fc7pz3fm6yjh.json', {
      homework_common_id: '3727439',
    });
    expect(post).toHaveBeenNthCalledWith(
      1,
      '/api/myshixuns/obcts7i5fx/update_file.json',
      expect.objectContaining({
        path: 'src/main.cpp',
        game_id: 215617259,
        extras: expect.objectContaining({
          challenge_id: 4132394,
          currentUserId: 2312645,
        }),
      }),
      { zzud: 'mbzfstnkj' },
    );
    expect(post).toHaveBeenNthCalledWith(
      2,
      '/api/tasks/fc7pz3fm6yjh/game_build.json',
      expect.objectContaining({
        shixun_environment_id: 1309307,
        extras: expect.objectContaining({
          challenge_id: 4132394,
          currentUserId: 2312645,
        }),
      }),
      { zzud: 'mbzfstnkj' },
    );
  });

  it('does not fall back to arbitrary workspace files when editablePaths exist but none match', async () => {
    const taskRoot = await createTempTaskRoot();
    await import('node:fs/promises').then(({ mkdir }) =>
      Promise.all([
        mkdir(path.join(taskRoot, 'code', 'current', 'docs'), { recursive: true }),
        mkdir(path.join(taskRoot, 'code', 'current', 'src'), { recursive: true }),
      ]),
    );
    await Promise.all([
      writeFile(path.join(taskRoot, 'code', 'current', 'docs', 'notes.md'), 'do not submit\n', 'utf8'),
      writeFile(path.join(taskRoot, 'code', 'current', 'src', 'a.cpp'), 'int a() { return 1; }\n', 'utf8'),
    ]);
    await writeJson(path.join(taskRoot, '_educoder', 'meta', 'task.json'), {
      taskId: 'fc7pz3fm6yjh',
      homeworkId: '3727439',
      gameId: 215617259,
      challengeId: 4132394,
      shixunEnvironmentId: 1309307,
      currentUserId: 2312645,
      userLogin: 'mbzfstnkj',
      myshixunIdentifier: 'obcts7i5fx',
      editablePaths: ['missing.cpp'],
    });

    const post = vi.fn();
    configureDefaultOfficialJudgeExecutor(
      createOfficialJudgeExecutor({
        post,
      } as any),
    );

    await expect(runOfficialJudgeCommand(taskRoot)).rejects.toThrow('当前代码目录中没有可提交的源文件');
    expect(post).not.toHaveBeenCalled();
  });
});
