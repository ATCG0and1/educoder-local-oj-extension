import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  syncTaskAnswersCommandMessages,
  syncTaskAnswersFullCommand,
  syncTaskAnswersSafeCommand,
} from '../../src/commands/syncTaskAnswersCommand.js';

const tempDirs: string[] = [];

async function createTempTaskRoot(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'educoder-sync-answer-command-'));
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

describe('syncTaskAnswersCommand', () => {
  it('safe command skips unlocks and only writes embedded answer bodies', async () => {
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
          { answerId: 1, name: '带正文', content: 'answer body\n' },
          { answerId: 2, name: '仅元数据' },
        ],
      })),
      unlockAnswer: vi.fn(async () => ({
        answerId: 2,
        content: 'should not be fetched\n',
        unlocked: true,
      })),
    };

    await syncTaskAnswersSafeCommand(taskRoot, { answerClient });

    expect(answerClient.unlockAnswer).not.toHaveBeenCalled();
    await expect(readFile(path.join(taskRoot, 'answers', 'answer-1.md'), 'utf8')).resolves.toContain('answer body');
    await expect(access(path.join(taskRoot, 'answers', 'answer-2.md'))).rejects.toBeDefined();
  });

  it('full command requires explicit confirmation before unlocking answers', async () => {
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
        entries: [{ answerId: 2, name: '仅元数据' }],
      })),
      unlockAnswer: vi.fn(async () => ({
        answerId: 2,
        content: 'full answer\n',
        unlocked: true,
      })),
    };
    const window = {
      showWarningMessage: vi.fn(
        async (): Promise<string | undefined> => syncTaskAnswersCommandMessages.FULL_SYNC_CANCEL_LABEL,
      ),
    };

    await expect(syncTaskAnswersFullCommand(taskRoot, { answerClient, window })).resolves.toBe(false);
    expect(window.showWarningMessage).toHaveBeenCalledWith(
      syncTaskAnswersCommandMessages.FULL_SYNC_WARNING_MESSAGE,
      syncTaskAnswersCommandMessages.FULL_SYNC_CONTINUE_LABEL,
      syncTaskAnswersCommandMessages.FULL_SYNC_CANCEL_LABEL,
    );
    expect(answerClient.unlockAnswer).not.toHaveBeenCalled();

    window.showWarningMessage.mockResolvedValue(syncTaskAnswersCommandMessages.FULL_SYNC_CONTINUE_LABEL);

    await expect(syncTaskAnswersFullCommand(taskRoot, { answerClient, window })).resolves.toBe(true);
    expect(answerClient.unlockAnswer).toHaveBeenCalledWith({
      taskId: 'fc7pz3fm6yjh',
      answerId: 2,
    });
    await expect(readFile(path.join(taskRoot, 'answers', 'answer-2.md'), 'utf8')).resolves.toContain('full answer');
  });
});
