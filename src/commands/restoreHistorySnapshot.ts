import { cp, mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import type { HistoryFetchClientLike } from '../core/api/historyFetchClient.js';
import { readHistoryIndex, writeHistorySnapshot } from '../core/recovery/historyStore.js';
import type { HomeworkManifest, TaskManifest } from '../core/sync/manifestStore.js';

export interface RestoreHistorySnapshotDeps {
  historyClient: HistoryFetchClientLike;
}

export async function restoreHistorySnapshot(
  taskRoot: string,
  queryIndex: number,
  deps: RestoreHistorySnapshotDeps,
): Promise<void> {
  const manifests = await readManifestBundle(taskRoot);
  const historyIndex = await readHistoryIndex(taskRoot);
  const filePath = historyIndex?.filePath;

  if (!filePath) {
    throw new Error('History index is missing filePath. Run syncTaskHistory first.');
  }

  const snapshot = await deps.historyClient.fetchHistorySnapshot({
    taskId: manifests.taskManifest.taskId,
    homeworkId: manifests.homeworkManifest.homeworkId,
    queryIndex,
    filePath,
  });
  const snapshotRoot = await writeHistorySnapshot(taskRoot, snapshot);

  await restoreWorkspaceFromSnapshotDir(snapshotRoot, path.join(taskRoot, 'workspace'));
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

async function restoreWorkspaceFromSnapshotDir(snapshotDir: string, workspaceDir: string): Promise<void> {
  await rm(workspaceDir, { recursive: true, force: true });
  await mkdir(workspaceDir, { recursive: true });
  await cp(snapshotDir, workspaceDir, {
    recursive: true,
    force: true,
    filter: (source) => !source.endsWith(`${path.sep}snapshot.json`),
  });
}
