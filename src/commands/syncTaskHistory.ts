import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { HistoryFetchClientLike } from '../core/api/historyFetchClient.js';
import type { HomeworkManifest, TaskManifest } from '../core/sync/manifestStore.js';
import { writeHistoryArtifacts } from '../core/recovery/historyStore.js';

export interface SyncTaskHistoryDeps {
  historyClient: HistoryFetchClientLike;
}

export async function syncTaskHistory(taskRoot: string, deps: SyncTaskHistoryDeps): Promise<void> {
  const manifests = await readManifestBundle(taskRoot);
  const history = await deps.historyClient.fetchHistoryIndex({
    taskId: manifests.taskManifest.taskId,
  });

  await writeHistoryArtifacts(taskRoot, {
    rawEvaluateLogs: history.rawEvaluateLogs,
    rawRedoLogs: history.rawRedoLogs,
    index: {
      filePath: history.filePath,
      evaluations: history.evaluations,
      redoLogs: history.redoLogs,
      updatedAt: new Date().toISOString(),
    },
  });
}

async function readManifestBundle(taskRoot: string): Promise<{
  taskManifest: TaskManifest;
  homeworkManifest: HomeworkManifest;
}> {
  const taskManifest = JSON.parse(
    await readFile(path.join(taskRoot, 'task.manifest.json'), 'utf8'),
  ) as TaskManifest;
  const homeworkManifest = JSON.parse(
    await readFile(path.join(taskRoot, '..', '..', 'homework.manifest.json'), 'utf8'),
  ) as HomeworkManifest;

  return {
    taskManifest,
    homeworkManifest,
  };
}
