import type { HomeworkManifest, TaskManifest } from '../core/sync/manifestStore.js';
import { getStoredLastOpenedTaskRoot, type ExtensionContextLike } from '../core/config/extensionState.js';
import {
  syncCollectionTaskPackages,
  type CollectionTaskPackageSyncResult,
} from '../core/sync/collectionSync.js';
import {
  syncCurrentCollection,
  type SyncCurrentCollectionDeps,
  type SyncCurrentCollectionResult,
} from './syncCurrentCollection.js';
import { bindWorkspaceRootToWorkspace } from '../core/workspace/workspaceBinding.js';
import { writeExplorerVisibilityConfig } from '../core/workspace/vscodeConfigWriter.js';

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
  defaultTask?: DefaultSyncedTaskSelection;
}

export interface DefaultSyncedTaskSelection {
  homework: HomeworkManifest;
  task: TaskManifest;
  taskRoot: string;
  reason: 'incomplete' | 'last_opened' | 'first';
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
  const defaultTask = pickDefaultTask({
    context: deps.context,
    collectionRoot: syncResult.collectionRoot,
    syncedTasks,
    firstTask: syncResult.firstTask,
  });

  const result = {
    ...syncResult,
    syncedTasks,
    defaultTask,
  };

  try {
    await writeExplorerVisibilityConfig(syncResult.productRoot);
  } catch {
    // Best-effort only: Explorer cleanup should not block successful local sync.
  }

  try {
    await bindWorkspaceRootToWorkspace(syncResult.collectionRoot);
  } catch {
    // Best-effort only: workspace binding should never block successful local sync.
  }

  return result;
}

function pickDefaultTask(input: {
  context: ExtensionContextLike;
  collectionRoot: string;
  syncedTasks: Array<CollectionTaskPackageSyncResult<unknown>>;
  firstTask?: SyncCurrentCollectionResult['firstTask'];
}): DefaultSyncedTaskSelection | undefined {
  const incompleteTask = input.syncedTasks.find(isIncompleteTaskSync);
  if (incompleteTask) {
    return {
      homework: incompleteTask.homework,
      task: incompleteTask.task,
      taskRoot: incompleteTask.taskRoot,
      reason: 'incomplete',
    };
  }

  const lastOpenedTaskRoot = getStoredLastOpenedTaskRoot(input.context);
  if (lastOpenedTaskRoot) {
    const rememberedTask = input.syncedTasks.find(
      (item) =>
        normalizeFsPath(item.taskRoot) === normalizeFsPath(lastOpenedTaskRoot) &&
        normalizeFsPath(item.taskRoot).startsWith(`${normalizeFsPath(input.collectionRoot)}/`),
    );
    if (rememberedTask) {
      return {
        homework: rememberedTask.homework,
        task: rememberedTask.task,
        taskRoot: rememberedTask.taskRoot,
        reason: 'last_opened',
      };
    }
  }

  const firstTask = input.firstTask ?? input.syncedTasks[0];
  if (!firstTask) {
    return undefined;
  }

  return {
    homework: firstTask.homework,
    task: firstTask.task,
    taskRoot: firstTask.taskRoot,
    reason: 'first',
  };
}

function isIncompleteTaskSync(result: CollectionTaskPackageSyncResult<unknown>): boolean {
  if (!result.ok) {
    return true;
  }

  const materials = (result.result as { materials?: Record<string, unknown> } | undefined)?.materials;
  if (!materials || typeof materials !== 'object') {
    return false;
  }

  return Object.values(materials).some((state) => state !== 'ready');
}

function normalizeFsPath(targetPath: string): string {
  return targetPath.replaceAll('\\', '/').toLocaleLowerCase();
}
