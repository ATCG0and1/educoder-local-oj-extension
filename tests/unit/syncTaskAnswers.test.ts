import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { syncTaskAnswers } from '../../src/commands/syncTaskAnswers.js';

const tempDirs: string[] = [];

async function createTempTaskRoot(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'educoder-sync-answers-'));
  tempDirs.push(dir);
  return path.join(
    dir,
    '课程 [ufr7sxlc]',
    '第二章 线性表及应用 [1316861]',
    'homeworks',
    '2-2 基本实训-链表操作 [3727439]',
    'tasks',
    '01 第1关 基本实训：链表操作 [fc7pz3fm6yjh]',
  );
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await import('node:fs/promises').then(({ mkdir }) => mkdir(path.dirname(filePath), { recursive: true }));
  await writeFile(filePath, JSON.stringify(value, null, 2), 'utf8');
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('syncTaskAnswers', () => {
  it('safe mode only persists answer bodies already embedded in get_answer_info and does not call unlock_answer', async () => {
    const taskRoot = await createTempTaskRoot();
    await writeJson(path.join(taskRoot, 'task.manifest.json'), {
      taskId: 'fc7pz3fm6yjh',
      name: '第1关 基本实训：链表操作',
      position: 1,
      folderName: '01 第1关 基本实训：链表操作 [fc7pz3fm6yjh]',
    });

    const answerClient = {
      fetchAnswerInfo: vi.fn(async () => ({
        status: 3,
        entries: [
          {
            answerId: 3567559,
            name: '解题思路1',
            score: 50,
            ratio: 10,
            content: '```cpp\nint main() { return 0; }\n```',
          },
          { answerId: 4000002, name: '解题思路2', score: 50, ratio: 10 },
        ],
      })),
      unlockAnswer: vi.fn(async () => ({
        answerId: 3567559,
        content: '```cpp\nint main() { return 0; }\n```',
        unlocked: true,
      })),
    };

    await syncTaskAnswers(taskRoot, { answerClient }, { mode: 'safe' });

    expect(answerClient.fetchAnswerInfo).toHaveBeenCalledWith({ taskId: 'fc7pz3fm6yjh' });
    expect(answerClient.unlockAnswer).not.toHaveBeenCalled();
    await expect(readFile(path.join(taskRoot, '_educoder', 'answers', 'answer_info.json'), 'utf8')).resolves.toContain(
      '"answerId": 3567559',
    );
    await expect(readFile(path.join(taskRoot, 'answers', 'answer-3567559.md'), 'utf8')).resolves.toContain('int main');
    await expect(access(path.join(taskRoot, 'answers', 'answer-4000002.md'))).rejects.toBeDefined();
    await expect(readFile(path.join(taskRoot, '_educoder', 'meta', 'recovery.json'), 'utf8')).resolves.toContain(
      '"unlockedAnswerCount": 1',
    );
    await expect(access(path.join(taskRoot, 'answers', 'answer_info.json'))).rejects.toBeDefined();
    await expect(access(path.join(taskRoot, 'answers', 'index.md'))).rejects.toBeDefined();
    await expect(access(path.join(taskRoot, 'README.md'))).rejects.toBeDefined();
  });

  it('full mode unlocks missing answer bodies and clears stale unlocked answers when the refreshed answer set is now empty', async () => {
    const taskRoot = await createTempTaskRoot();
    await writeJson(path.join(taskRoot, 'task.manifest.json'), {
      taskId: 'fc7pz3fm6yjh',
      name: '第1关 基本实训：链表操作',
      position: 1,
      folderName: '01 第1关 基本实训：链表操作 [fc7pz3fm6yjh]',
    });

    const firstClient = {
      fetchAnswerInfo: vi.fn(async () => ({
        status: 3,
        entries: [{ answerId: 3567559, name: '解题思路1', score: 50, ratio: 10 }],
      })),
      unlockAnswer: vi.fn(async () => ({
        answerId: 3567559,
        content: '```cpp\nint main() { return 0; }\n```',
        unlocked: true,
      })),
    };
    await syncTaskAnswers(taskRoot, { answerClient: firstClient }, { mode: 'full' });

    const secondClient = {
      fetchAnswerInfo: vi.fn(async () => ({
        status: 3,
        entries: [],
      })),
      unlockAnswer: vi.fn(async () => ({
        answerId: 0,
        content: '',
        unlocked: false,
      })),
    };
    await syncTaskAnswers(taskRoot, { answerClient: secondClient }, { mode: 'full' });

    await expect(
      access(path.join(taskRoot, 'answers', 'answer-3567559.md')),
    ).rejects.toBeDefined();
    await expect(readFile(path.join(taskRoot, '_educoder', 'meta', 'recovery.json'), 'utf8')).resolves.toContain(
      '"answerEntryCount": 0',
    );
    await expect(readFile(path.join(taskRoot, '_educoder', 'meta', 'recovery.json'), 'utf8')).resolves.toContain(
      '"unlockedAnswerCount": 0',
    );
  });
});
