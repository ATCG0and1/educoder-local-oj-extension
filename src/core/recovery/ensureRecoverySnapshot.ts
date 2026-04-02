import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { PassedFetchClientLike } from '../api/passedFetchClient.js';
import type { TaskDetailClientLike } from '../api/taskDetailClient.js';
import type { TemplateFetchClientLike } from '../api/templateFetchClient.js';
import type { HomeworkManifest, TaskManifest } from '../sync/manifestStore.js';
import { writeWorkspaceFiles } from '../workspace/workspaceInit.js';

export interface EnsureTemplateSnapshotDeps {
  taskDetailClient?: TaskDetailClientLike;
  templateClient?: TemplateFetchClientLike;
}

export interface EnsurePassedSnapshotDeps {
  taskDetailClient?: TaskDetailClientLike;
  passedClient?: PassedFetchClientLike;
}

export async function ensureTemplateSnapshot(
  taskRoot: string,
  deps: EnsureTemplateSnapshotDeps,
): Promise<void> {
  const snapshotDir = path.join(taskRoot, '_educoder', 'template');
  if (await hasFiles(snapshotDir)) {
    return;
  }

  if (!deps.taskDetailClient || !deps.templateClient) {
    return;
  }

  const manifest = await readRollbackManifest(taskRoot);
  const detail = await deps.taskDetailClient.getTaskDetail({
    taskId: manifest.taskManifest.taskId,
    homeworkId: manifest.homeworkManifest.homeworkId,
  });
  const files = await deps.templateClient.fetchTemplateFiles({
    taskId: manifest.taskManifest.taskId,
    homeworkId: manifest.homeworkManifest.homeworkId,
    filePaths: detail.editablePaths,
  });

  await writeWorkspaceFiles(snapshotDir, files);
}

export async function ensurePassedSnapshot(
  taskRoot: string,
  deps: EnsurePassedSnapshotDeps,
): Promise<void> {
  const snapshotDir = path.join(taskRoot, '_educoder', 'passed');
  if (await hasFiles(snapshotDir)) {
    return;
  }

  if (!deps.taskDetailClient || !deps.passedClient) {
    return;
  }

  const manifest = await readRollbackManifest(taskRoot);
  const detail = await deps.taskDetailClient.getTaskDetail({
    taskId: manifest.taskManifest.taskId,
    homeworkId: manifest.homeworkManifest.homeworkId,
  });
  const files = await deps.passedClient.fetchPassedFiles({
    taskId: manifest.taskManifest.taskId,
    homeworkId: manifest.homeworkManifest.homeworkId,
    filePaths: detail.editablePaths,
  });

  await writeWorkspaceFiles(snapshotDir, files);
}

async function readRollbackManifest(taskRoot: string): Promise<{
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

async function hasFiles(targetDir: string): Promise<boolean> {
  try {
    const entries = await readdir(targetDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        return true;
      }

      if (entry.isDirectory() && (await hasFiles(path.join(targetDir, entry.name)))) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}
