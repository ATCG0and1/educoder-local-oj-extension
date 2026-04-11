import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { AnswerFetchClientLike, AnswerInfoSummary } from '../core/api/answerFetchClient.js';
import { normalizeAnswerMarkdownForPreview } from '../core/content/markdownPreview.js';
import {
  readRecoveryMetadata,
  writeRecoveryMetadata,
  type RecoveryMetadata,
} from '../core/recovery/materialStore.js';
import type { TaskManifest } from '../core/sync/manifestStore.js';
import { getCanonicalAnswerInfoPath, getInternalAnswersDir } from '../core/workspace/answerSurface.js';

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
  _taskManifest: TaskManifest,
  answerInfo: AnswerInfoSummary,
  unlockedAnswers: Array<{ answerId: number; content: string; unlocked: boolean }>,
  _syncedAt: string,
): Promise<void> {
  const answerDir = path.join(taskRoot, 'answers');
  const internalAnswersDir = getInternalAnswersDir(taskRoot);
  const answerInfoPath = getCanonicalAnswerInfoPath(taskRoot);

  await rm(answerDir, { recursive: true, force: true });
  await mkdir(answerDir, { recursive: true });
  await mkdir(internalAnswersDir, { recursive: true });
  await writeFile(answerInfoPath, JSON.stringify(answerInfo, null, 2), 'utf8');
  await Promise.all(
    unlockedAnswers
      .filter((entry) => entry.unlocked)
      .map((entry) =>
        writeFile(
          path.join(answerDir, `answer-${entry.answerId}.md`),
          normalizeAnswerMarkdownForPreview(entry.content),
          'utf8',
        ),
      ),
  );
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
