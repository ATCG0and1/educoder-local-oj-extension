import path from 'node:path';
import type { ClipboardEnv } from '../core/url/clipboardUrlResolver.js';
import { resolveCollectionUrlFromClipboard } from '../core/url/clipboardUrlResolver.js';
import { getProductRoot, type RootResolverDeps } from '../core/config/rootResolver.js';
import { syncCollectionIndex, type CollectionIndexClient } from '../core/sync/collectionSync.js';
import { hydrateTask, type HiddenTestCase } from '../core/sync/taskHydrator.js';
import { writeTaskDebugConfig } from '../core/workspace/vscodeConfigWriter.js';
import type { CollectionManifest, HomeworkManifest, TaskManifest } from '../core/sync/manifestStore.js';
import type { WorkspaceFile } from '../core/workspace/workspaceInit.js';

export interface SyncCurrentCollectionDeps extends RootResolverDeps {
  clipboardEnv: ClipboardEnv;
  client: CollectionIndexClient;
  templateFiles?: WorkspaceFile[];
  hiddenTests?: HiddenTestCase[];
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
  const { courseId, categoryId } = await resolveCollectionUrlFromClipboard(deps.clipboardEnv);
  const productRoot = await getProductRoot(deps);
  const collectionRoot = path.join(productRoot, `classroom_${courseId}`, `shixun_homework_${categoryId}`);

  const manifest = await syncCollectionIndex({
    client: deps.client,
    rootDir: collectionRoot,
    courseId,
    categoryId,
  });

  const firstHomework = manifest.homeworks[0];
  const firstTask = firstHomework?.tasks[0];

  if (!firstHomework || !firstTask) {
    return {
      productRoot,
      collectionRoot,
      manifest,
    };
  }

  const layout = await hydrateTask({
    collectionRoot,
    homeworkId: firstHomework.homeworkId,
    taskId: firstTask.taskId,
    templateFiles:
      deps.templateFiles ??
      [
        {
          path: 'test1/test1.cpp',
          content: 'int main() { return 0; }\n',
        },
      ],
    hiddenTests: deps.hiddenTests ?? [],
  });

  await writeTaskDebugConfig(layout.taskRoot);

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
