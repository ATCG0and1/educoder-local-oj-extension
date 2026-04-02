import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
  it('fetches answer info, unlocks answer bodies, updates recovery metadata, and generates a learning index', async () => {
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
        entries: [{ answerId: 3567559, name: '解题思路1', score: 50, ratio: 10 }],
      })),
      unlockAnswer: vi.fn(async () => ({
        answerId: 3567559,
        content: '```cpp\nint main() { return 0; }\n```',
        unlocked: true,
      })),
    };

    await syncTaskAnswers(taskRoot, { answerClient });

    expect(answerClient.fetchAnswerInfo).toHaveBeenCalledWith({ taskId: 'fc7pz3fm6yjh' });
    expect(answerClient.unlockAnswer).toHaveBeenCalledWith({
      taskId: 'fc7pz3fm6yjh',
      answerId: 3567559,
    });
    await expect(readFile(path.join(taskRoot, '_educoder', 'answer', 'answer_info.json'), 'utf8')).resolves.toContain(
      '"answerId": 3567559',
    );
    await expect(
      readFile(path.join(taskRoot, '_educoder', 'answer', 'unlocked', 'answer-3567559.md'), 'utf8'),
    ).resolves.toContain('int main');
    await expect(readFile(path.join(taskRoot, '_educoder', 'meta', 'recovery.json'), 'utf8')).resolves.toContain(
      '"unlockedAnswerCount": 1',
    );
    await expect(readFile(path.join(taskRoot, '_educoder', 'answer', 'index.md'), 'utf8')).resolves.toContain(
      '# 答案学习索引',
    );
    await expect(readFile(path.join(taskRoot, '_educoder', 'answer', 'index.md'), 'utf8')).resolves.toContain(
      '解题思路1',
    );
    await expect(readFile(path.join(taskRoot, '_educoder', 'answer', 'index.md'), 'utf8')).resolves.toContain(
      'unlocked/answer-3567559.md',
    );
  });
});
