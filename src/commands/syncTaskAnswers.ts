import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { AnswerFetchClientLike, AnswerInfoSummary } from '../core/api/answerFetchClient.js';
import {
  readRecoveryMetadata,
  writeRecoveryMetadata,
  type RecoveryMetadata,
} from '../core/recovery/materialStore.js';
import type { TaskManifest } from '../core/sync/manifestStore.js';

export interface SyncTaskAnswersDeps {
  answerClient: AnswerFetchClientLike;
}

export async function syncTaskAnswers(taskRoot: string, deps: SyncTaskAnswersDeps): Promise<void> {
  const taskManifest = JSON.parse(
    await readFile(path.join(taskRoot, 'task.manifest.json'), 'utf8'),
  ) as TaskManifest;
  const answerInfo = await deps.answerClient.fetchAnswerInfo({
    taskId: taskManifest.taskId,
  });
  const unlockedAnswers = await Promise.all(
    answerInfo.entries
      .filter((entry): entry is typeof entry & { answerId: number } => typeof entry.answerId === 'number')
      .map((entry) => deps.answerClient.unlockAnswer({ taskId: taskManifest.taskId, answerId: entry.answerId })),
  );
  const syncedAt = new Date().toISOString();

  await writeAnswerArtifacts(taskRoot, taskManifest, answerInfo, unlockedAnswers, syncedAt);

  const existing = (await readRecoveryMetadata(taskRoot)) ?? emptyRecoveryMetadata();
  await writeRecoveryMetadata(taskRoot, {
    ...existing,
    answerReady: answerInfo.entries.length > 0,
    answerEntryCount: answerInfo.entries.length,
    unlockedAnswerCount: unlockedAnswers.filter((entry) => entry.unlocked).length,
    lastAnswerSyncAt: syncedAt,
    updatedAt: syncedAt,
  });
}

async function writeAnswerArtifacts(
  taskRoot: string,
  taskManifest: TaskManifest,
  answerInfo: AnswerInfoSummary,
  unlockedAnswers: Array<{ answerId: number; content: string; unlocked: boolean }>,
  syncedAt: string,
): Promise<void> {
  const answerDir = path.join(taskRoot, '_educoder', 'answer');
  const unlockedDir = path.join(answerDir, 'unlocked');

  await mkdir(answerDir, { recursive: true });
  await mkdir(unlockedDir, { recursive: true });
  await writeFile(path.join(answerDir, 'answer_info.json'), JSON.stringify(answerInfo, null, 2), 'utf8');
  await Promise.all(
    unlockedAnswers
      .filter((entry) => entry.unlocked)
      .map((entry) => writeFile(path.join(unlockedDir, `answer-${entry.answerId}.md`), entry.content, 'utf8')),
  );
  await writeFile(
    path.join(answerDir, 'index.md'),
    renderAnswerIndex(taskManifest, answerInfo, unlockedAnswers, syncedAt),
    'utf8',
  );
}

function renderAnswerIndex(
  taskManifest: TaskManifest,
  answerInfo: AnswerInfoSummary,
  unlockedAnswers: Array<{ answerId: number; content: string; unlocked: boolean }>,
  syncedAt: string,
): string {
  const unlockedById = new Map(unlockedAnswers.map((entry) => [entry.answerId, entry]));
  const rows = answerInfo.entries.map((entry) => {
    const unlocked = entry.answerId != null ? unlockedById.get(entry.answerId)?.unlocked === true : false;
    const filePath = entry.answerId != null && unlocked ? `unlocked/answer-${entry.answerId}.md` : '未解锁';
    return `| ${entry.answerId ?? '-'} | ${entry.name} | ${entry.score ?? '-'} | ${entry.ratio ?? '-'} | ${unlocked ? '已解锁' : '未解锁'} | ${filePath} |`;
  });

  return [
    '# 答案学习索引',
    '',
    `- 任务：${taskManifest.name}`,
    `- Task ID：${taskManifest.taskId}`,
    `- 同步时间：${syncedAt}`,
    '',
    '## 答案列表',
    '',
    '| Answer ID | 名称 | Score | Ratio | 状态 | 本地文件 |',
    '| --- | --- | --- | --- | --- | --- |',
    ...(rows.length > 0 ? rows : ['| - | 暂无答案 | - | - | - | - |']),
    '',
    '## 学习入口',
    '',
    '- 答案元信息：`answer_info.json`',
    '- 已解锁答案目录：`unlocked/`',
    '- 当前代码目录：`../../workspace/`',
    '- 模板目录：`../template/`',
  ].join('\n');
}

function emptyRecoveryMetadata(): RecoveryMetadata {
  return {
    templateReady: false,
    templateFileCount: 0,
    passedReady: false,
    passedFileCount: 0,
    answerReady: false,
    answerEntryCount: 0,
    unlockedAnswerCount: 0,
    historyReady: false,
    historyFileCount: 0,
    repositoryReady: false,
    repositoryFileCount: 0,
    updatedAt: new Date(0).toISOString(),
  };
}
