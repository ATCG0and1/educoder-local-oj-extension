import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { AnswerFetchClientLike } from '../core/api/answerFetchClient.js';
import type { ProblemFetchClientLike } from '../core/api/problemFetchClient.js';
import type { HiddenTestFetchClientLike } from '../core/api/hiddenTestFetchClient.js';
import type { PassedFetchClientLike } from '../core/api/passedFetchClient.js';
import type { RepositoryFetchClientLike } from '../core/api/repositoryFetchClient.js';
import type { SourceFetchClientLike } from '../core/api/sourceFetchClient.js';
import type { TaskDetailClientLike } from '../core/api/taskDetailClient.js';
import type { TemplateFetchClientLike } from '../core/api/templateFetchClient.js';
import type { CollectionManifest, HomeworkManifest, TaskManifest } from '../core/sync/manifestStore.js';
import { syncTaskPackageFromRemote } from '../core/sync/taskPackageSync.js';

export interface SyncTaskPackageCommandDeps {
  taskDetailClient: TaskDetailClientLike;
  sourceClient: SourceFetchClientLike;
  hiddenTestClient: HiddenTestFetchClientLike;
  repositoryClient?: Pick<RepositoryFetchClientLike, 'collectRepositoryTree'>;
  problemClient?: ProblemFetchClientLike;
  templateClient?: TemplateFetchClientLike;
  passedClient?: PassedFetchClientLike;
  answerClient?: AnswerFetchClientLike;
}

export async function syncTaskPackageCommand(
  taskRoot: string,
  deps: SyncTaskPackageCommandDeps,
) {
  const manifests = await readManifestBundle(taskRoot);

  return syncTaskPackageFromRemote({
    collectionRoot: manifests.collectionRoot,
    homeworkId: manifests.homeworkManifest.homeworkId,
    taskId: manifests.taskManifest.taskId,
    homeworkDirName: manifests.homeworkManifest.folderName,
    taskDirName: manifests.taskManifest.folderName,
    taskDetailClient: deps.taskDetailClient,
    sourceClient: deps.sourceClient,
    hiddenTestClient: deps.hiddenTestClient,
    repositoryClient: deps.repositoryClient,
    problemClient: deps.problemClient,
    templateClient: deps.templateClient,
    passedClient: deps.passedClient,
    answerClient: deps.answerClient,
    mode: 'full',
  });
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
