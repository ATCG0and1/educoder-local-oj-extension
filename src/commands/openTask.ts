import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import type { AnswerFetchClientLike } from '../core/api/answerFetchClient.js';
import type { ProblemFetchClientLike } from '../core/api/problemFetchClient.js';
import type { RepositoryFetchClientLike } from '../core/api/repositoryFetchClient.js';
import { openTaskPrimaryEditors } from './openTaskMaterials.js';
import { syncTaskPackageFromRemote } from '../core/sync/taskPackageSync.js';
import type { CollectionManifest, HomeworkManifest, TaskManifest } from '../core/sync/manifestStore.js';
import { loadTaskStateModel, type TaskStateModel } from '../core/ui/stateModel.js';
import { readRecoveryMetadata } from '../core/recovery/materialStore.js';
import { applyLegacyTaskCompat } from '../core/workspace/legacyTaskCompat.js';
import { hasAnswerFiles, readAnswerEntryCount } from '../core/workspace/answerSurface.js';
import { resolveTaskPackagePaths } from '../core/workspace/taskPackageMigration.js';
import { revealInExplorer as defaultRevealInExplorer } from '../core/workspace/workspaceBinding.js';
import type { HiddenTestFetchClientLike } from '../core/api/hiddenTestFetchClient.js';
import type { PassedFetchClientLike } from '../core/api/passedFetchClient.js';
import type { SourceFetchClientLike } from '../core/api/sourceFetchClient.js';
import type { TaskDetailClientLike } from '../core/api/taskDetailClient.js';
import type { TemplateFetchClientLike } from '../core/api/templateFetchClient.js';

export interface OpenTaskCommandDeps {
  taskDetailClient?: TaskDetailClientLike;
  sourceClient?: SourceFetchClientLike;
  hiddenTestClient?: HiddenTestFetchClientLike;
  repositoryClient?: Pick<RepositoryFetchClientLike, 'collectRepositoryTree'>;
  problemClient?: ProblemFetchClientLike;
  templateClient?: TemplateFetchClientLike;
  passedClient?: PassedFetchClientLike;
  answerClient?: AnswerFetchClientLike;
  revealInExplorer?: (targetPath: string) => Promise<unknown>;
  onTaskOpened?: (taskRoot: string) => PromiseLike<void> | void;
}

export async function openTaskCommand(
  taskRoot: string,
  deps: OpenTaskCommandDeps = {},
): Promise<TaskStateModel> {
  await applyLegacyTaskCompat(taskRoot);
  const resolvedPaths = await resolveTaskPackagePaths(taskRoot);
  const [
    workspaceReady,
    hiddenReady,
    taskMetaReady,
    statementReady,
    answersReady,
  ] = await Promise.all([
    resolvedPaths.currentCodeSource !== 'missing',
    resolvedPaths.hiddenTestsSource !== 'missing',
    hasPath(path.join(taskRoot, '_educoder', 'meta', 'task.json')),
    hasStatementMaterial(taskRoot),
    hasAnswerMaterial(taskRoot, resolvedPaths.answersDir),
  ]);
  const needsHydration =
    !workspaceReady ||
    !hiddenReady ||
    !taskMetaReady ||
    !statementReady ||
    (deps.answerClient ? !answersReady : false);

  if (
    needsHydration &&
    deps.taskDetailClient &&
    deps.sourceClient &&
    deps.hiddenTestClient
  ) {
    const manifests = await readManifestBundle(taskRoot);
    await syncTaskPackageFromRemote({
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
      answerClient: deps.answerClient,
      mode: 'open',
    });
  }

  const model = await loadTaskStateModel(taskRoot);

  const primaryEditors = await openTaskPrimaryEditors(taskRoot, {
    continueOnError: true,
  }).catch(() => undefined);
  const explorerTarget =
    primaryEditors?.currentCode?.openedPath ??
    primaryEditors?.statement?.openedPath ??
    taskRoot;

  try {
    await (deps.revealInExplorer ?? defaultRevealInExplorer)(explorerTarget);
  } catch {
    // Best-effort only: failing to reveal Explorer should not block the open-task flow.
  }

  await deps.onTaskOpened?.(taskRoot);

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

async function hasStatementMaterial(taskRoot: string): Promise<boolean> {
  return hasAnyPath([
    path.join(taskRoot, 'problem', 'statement.md'),
    path.join(taskRoot, 'problem', 'statement.html'),
  ]);
}

async function hasAnswerMaterial(taskRoot: string, answersDir: string): Promise<boolean> {
  const recoveryMetadata = await readRecoveryMetadata(taskRoot).catch(() => undefined);
  if (recoveryMetadata?.answerReady || recoveryMetadata?.lastAnswerSyncAt) {
    return true;
  }

  const [answerEntryCount, unlockedReady] = await Promise.all([
    readAnswerEntryCount(taskRoot, answersDir),
    hasAnswerFiles(answersDir),
  ]);

  return answerEntryCount > 0 || unlockedReady;
}

async function hasAnyPath(paths: string[]): Promise<boolean> {
  const results = await Promise.all(paths.map((targetPath) => hasPath(targetPath)));
  return results.some(Boolean);
}

async function dirHasFiles(targetPath: string): Promise<boolean> {
  try {
    const entries = await readdir(targetPath, { withFileTypes: true });
    return entries.some((entry) => entry.isFile() || entry.isDirectory());
  } catch {
    return false;
  }
}
