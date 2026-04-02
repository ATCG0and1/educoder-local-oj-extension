import type { ClipboardEnv } from '../core/url/clipboardUrlResolver.js';
import { getProductRoot, type RootResolverDeps } from '../core/config/rootResolver.js';
import { syncCollectionIndex, type CollectionIndexClient } from '../core/sync/collectionSync.js';
import { getTaskLayoutPaths } from '../core/workspace/directoryLayout.js';
import type { CollectionManifest, HomeworkManifest, TaskManifest } from '../core/sync/manifestStore.js';
import { resolveCollectionUrl, type ManualCollectionUrlInput } from '../core/url/urlInputFlow.js';

export interface SyncCurrentCollectionDeps extends RootResolverDeps {
  clipboardEnv: ClipboardEnv;
  input: ManualCollectionUrlInput;
  client: CollectionIndexClient;
}

export interface SyncCurrentCollectionResult {
  productRoot: string;
  collectionRoot: string;
  manifest: CollectionManifest;
  firstTask?: {
    homework: HomeworkManifest;
    task: TaskManifest;
    taskRoot: string;
  };
}

export async function syncCurrentCollection(
  deps: SyncCurrentCollectionDeps,
): Promise<SyncCurrentCollectionResult> {
  const { courseId, categoryId } = await resolveCollectionUrl({
    clipboard: deps.clipboardEnv.clipboard,
    input: deps.input,
  });
  const productRoot = await getProductRoot(deps);
  const syncResult = await syncCollectionIndex({
    client: deps.client,
    productRoot,
    courseId,
    categoryId,
  });
  const { rootDir: collectionRoot, manifest } = syncResult;

  const firstHomework = manifest.homeworks[0];
  const firstTask = firstHomework?.tasks[0];

  if (!firstHomework || !firstTask) {
    return {
      productRoot,
      collectionRoot,
      manifest,
    };
  }

  const layout = getTaskLayoutPaths({
    collectionRoot,
    homeworkId: firstHomework.homeworkId,
    taskId: firstTask.taskId,
    homeworkDirName: firstHomework.folderName,
    taskDirName: firstTask.folderName,
  });

  return {
    productRoot,
    collectionRoot,
    manifest,
    firstTask: {
      homework: firstHomework,
      task: firstTask,
      taskRoot: layout.taskRoot,
    },
  };
}
