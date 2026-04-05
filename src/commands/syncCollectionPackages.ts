import type { HomeworkManifest, TaskManifest } from '../core/sync/manifestStore.js';
import {
  syncCollectionTaskPackages,
  type CollectionTaskPackageSyncResult,
} from '../core/sync/collectionSync.js';
import {
  syncCurrentCollection,
  type SyncCurrentCollectionDeps,
  type SyncCurrentCollectionResult,
} from './syncCurrentCollection.js';
import { bindProductRootToWorkspace } from '../core/workspace/workspaceBinding.js';

export interface SyncCollectionPackagesDeps extends SyncCurrentCollectionDeps {
  syncTaskPackage: (
    taskRoot: string,
    context: {
      collectionRoot: string;
      homework: HomeworkManifest;
      task: TaskManifest;
    },
  ) => Promise<unknown>;
}

export interface SyncCollectionPackagesResult extends SyncCurrentCollectionResult {
  syncedTasks: Array<CollectionTaskPackageSyncResult<unknown>>;
}

export async function syncCollectionPackages(
  deps: SyncCollectionPackagesDeps,
): Promise<SyncCollectionPackagesResult> {
  const syncResult = await syncCurrentCollection(deps);
  const syncedTasks = await syncCollectionTaskPackages({
    collectionRoot: syncResult.collectionRoot,
    manifest: syncResult.manifest,
    syncTaskPackage: async ({ taskRoot, homework, task }) =>
      deps.syncTaskPackage(taskRoot, {
        collectionRoot: syncResult.collectionRoot,
        homework,
        task,
      }),
  });

  const result = {
    ...syncResult,
    syncedTasks,
  };

  try {
    await bindProductRootToWorkspace(syncResult.productRoot);
  } catch {
    // Best-effort only: workspace binding should never block successful local sync.
  }

  return result;
}
