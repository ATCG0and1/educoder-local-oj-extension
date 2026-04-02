import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { AnswerFetchClientLike } from '../core/api/answerFetchClient.js';
import { hydrateTaskFromRemote } from '../core/sync/taskHydrator.js';
import type { CollectionManifest, HomeworkManifest, TaskManifest } from '../core/sync/manifestStore.js';
import { loadTaskStateModel, type TaskStateModel } from '../core/ui/stateModel.js';
import { openOrRevealDashboardPanel } from '../webview/dashboard/panel.js';
import type { HiddenTestFetchClientLike } from '../core/api/hiddenTestFetchClient.js';
import type { PassedFetchClientLike } from '../core/api/passedFetchClient.js';
import type { SourceFetchClientLike } from '../core/api/sourceFetchClient.js';
import type { TaskDetailClientLike } from '../core/api/taskDetailClient.js';
import type { TemplateFetchClientLike } from '../core/api/templateFetchClient.js';

export interface OpenTaskCommandDeps {
  taskDetailClient?: TaskDetailClientLike;
  sourceClient?: SourceFetchClientLike;
  hiddenTestClient?: HiddenTestFetchClientLike;
  templateClient?: TemplateFetchClientLike;
  passedClient?: PassedFetchClientLike;
  answerClient?: AnswerFetchClientLike;
  openPanel?: typeof openOrRevealDashboardPanel;
}

export async function openTaskCommand(
  taskRoot: string,
  deps: OpenTaskCommandDeps = {},
): Promise<TaskStateModel> {
  const [workspaceReady, hiddenReady] = await Promise.all([
    hasPath(path.join(taskRoot, 'workspace')),
    hasPath(path.join(taskRoot, '_educoder', 'tests', 'hidden')),
  ]);
  const needsHydration = !workspaceReady || !hiddenReady;

  if (
    needsHydration &&
    deps.taskDetailClient &&
    deps.sourceClient &&
    deps.hiddenTestClient
  ) {
    const manifests = await readManifestBundle(taskRoot);
    await hydrateTaskFromRemote({
      collectionRoot: manifests.collectionRoot,
      homeworkId: manifests.homeworkManifest.homeworkId,
      taskId: manifests.taskManifest.taskId,
      homeworkDirName: manifests.homeworkManifest.folderName,
      taskDirName: manifests.taskManifest.folderName,
      taskDetailClient: deps.taskDetailClient,
      sourceClient: deps.sourceClient,
      hiddenTestClient: deps.hiddenTestClient,
      templateClient: deps.templateClient,
      passedClient: deps.passedClient,
      answerClient: deps.answerClient,
    });
  }

  const model = await loadTaskStateModel(taskRoot);
  (deps.openPanel ?? openOrRevealDashboardPanel)({
    totalTasks: model.localCaseCount,
    completedTasks: model.state === '官方评测已过（通关）' ? 1 : 0,
    task: model,
  });
  return model;
}

interface ManifestBundle {
  collectionRoot: string;
  collectionManifest: CollectionManifest;
  homeworkManifest: HomeworkManifest;
  taskManifest: TaskManifest;
}

async function readManifestBundle(taskRoot: string): Promise<ManifestBundle> {
  const taskManifest = await readJson<TaskManifest>(path.join(taskRoot, 'task.manifest.json'));
  const homeworkDir = path.dirname(path.dirname(taskRoot));
  const homeworksDir = path.dirname(homeworkDir);
  const collectionRoot = path.dirname(homeworksDir);
  const homeworkManifest = await readJson<HomeworkManifest>(
    path.join(homeworkDir, 'homework.manifest.json'),
  );
  const collectionManifest = await readJson<CollectionManifest>(
    path.join(collectionRoot, 'collection.manifest.json'),
  );

  return {
    collectionRoot,
    collectionManifest,
    homeworkManifest,
    taskManifest,
  };
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, 'utf8')) as T;
}

async function hasPath(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}
