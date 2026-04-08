import type { CollectionIndex } from '../api/educoderClient.js';
import { getCollectionRoot, getTaskLayoutPaths } from '../workspace/directoryLayout.js';
import {
  loadCollectionManifest,
  mergeCollectionManifests,
  writeCollectionManifestArtifacts,
  type CollectionManifest,
  type HomeworkManifest,
  type TaskManifest,
} from './manifestStore.js';

export interface CollectionIndexClient {
  getCollectionIndex(input: {
    courseId: string;
    categoryId: string;
  }): Promise<CollectionIndex>;
}

export interface SyncCollectionIndexInput {
  client: CollectionIndexClient;
  productRoot: string;
  courseId: string;
  categoryId: string;
}

export interface SyncCollectionIndexResult {
  rootDir: string;
  manifest: CollectionManifest;
}

export interface CollectionTaskPackageSyncTarget {
  homework: HomeworkManifest;
  task: TaskManifest;
  taskRoot: string;
}

export interface CollectionTaskPackageSyncResult<T = unknown> extends CollectionTaskPackageSyncTarget {
  ok: boolean;
  result?: T;
  errorMessage?: string;
}

export async function syncCollectionIndex({
  client,
  productRoot,
  courseId,
  categoryId,
}: SyncCollectionIndexInput): Promise<SyncCollectionIndexResult> {
  const incoming = await client.getCollectionIndex({ courseId, categoryId });
  const rootDir = getCollectionRoot({
    productRoot,
    courseId: incoming.courseId,
    courseName: incoming.courseName,
    categoryId: incoming.categoryId,
    categoryName: incoming.categoryName,
  });
  const existing = await loadCollectionManifest(rootDir);
  const merged = mergeCollectionManifests(existing, incoming);

  await writeCollectionManifestArtifacts(rootDir, merged);

  return {
    rootDir,
    manifest: merged,
  };
}

export async function syncCollectionTaskPackages<T>(input: {
  collectionRoot: string;
  manifest: CollectionManifest;
  syncTaskPackage: (target: CollectionTaskPackageSyncTarget) => Promise<T>;
}): Promise<Array<CollectionTaskPackageSyncResult<T>>> {
  const syncedTasks: Array<CollectionTaskPackageSyncResult<T>> = [];

  for (const homework of input.manifest.homeworks) {
    for (const task of homework.tasks) {
      const taskRoot = getTaskLayoutPaths({
        collectionRoot: input.collectionRoot,
        homeworkId: homework.homeworkId,
        taskId: task.taskId,
        homeworkDirName: homework.folderName,
        taskDirName: task.folderName,
      }).taskRoot;
      try {
        const result = await input.syncTaskPackage({
          homework,
          task,
          taskRoot,
        });

        syncedTasks.push({
          homework,
          task,
          taskRoot,
          ok: true,
          result,
        });
      } catch (error) {
        syncedTasks.push({
          homework,
          task,
          taskRoot,
          ok: false,
          errorMessage: formatSyncError(error),
        });
      }
    }
  }

  return syncedTasks;
}

function formatSyncError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return String(error);
}
