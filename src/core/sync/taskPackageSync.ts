import { access, readFile, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import type { AnswerFetchClientLike } from '../api/answerFetchClient.js';
import type { ProblemFetchClientLike } from '../api/problemFetchClient.js';
import type { HiddenTestFetchClientLike } from '../api/hiddenTestFetchClient.js';
import type { PassedFetchClientLike } from '../api/passedFetchClient.js';
import type { RepositoryFetchClientLike } from '../api/repositoryFetchClient.js';
import type { SourceFetchClientLike } from '../api/sourceFetchClient.js';
import type { TaskDetailClientLike, TaskDetailSummary } from '../api/taskDetailClient.js';
import type { TemplateFetchClientLike } from '../api/templateFetchClient.js';
import { readRecoveryMetadata, writeRecoveryMetadata } from '../recovery/materialStore.js';
import { hydrateTaskFromRemote } from './taskHydrator.js';
import { hasAnswerFiles, readAnswerEntryCount } from '../workspace/answerSurface.js';
import type { TaskLayoutPaths } from '../workspace/directoryLayout.js';

export interface SyncTaskPackageResult {
  taskRoot: string;
  layout: TaskLayoutPaths;
  detail: TaskDetailSummary;
  materials: {
    statement: 'ready' | 'missing' | 'unavailable' | 'failed';
    currentCode: 'ready' | 'missing' | 'failed';
    templateCode: 'ready' | 'missing' | 'failed';
    tests: 'ready' | 'missing' | 'unavailable' | 'failed';
    answers: 'ready' | 'missing' | 'unavailable' | 'failed';
    metadata: 'ready' | 'missing' | 'failed';
  };
}

export interface SyncTaskPackageFromRemoteInput {
  collectionRoot: string;
  homeworkId: string;
  taskId: string;
  homeworkDirName?: string;
  taskDirName?: string;
  taskDetailClient: TaskDetailClientLike;
  sourceClient: SourceFetchClientLike;
  hiddenTestClient: HiddenTestFetchClientLike;
  repositoryClient?: Pick<RepositoryFetchClientLike, 'collectRepositoryTree'>;
  problemClient?: ProblemFetchClientLike;
  templateClient?: TemplateFetchClientLike;
  passedClient?: PassedFetchClientLike;
  answerClient?: AnswerFetchClientLike;
  mode?: 'open' | 'full';
}

export async function syncTaskPackageFromRemote(
  input: SyncTaskPackageFromRemoteInput,
): Promise<SyncTaskPackageResult> {
  const mode = input.mode ?? 'full';
  const fullSync = mode === 'full';
  const hydrated = await hydrateTaskFromRemote({
    collectionRoot: input.collectionRoot,
    homeworkId: input.homeworkId,
    taskId: input.taskId,
    homeworkDirName: input.homeworkDirName,
    taskDirName: input.taskDirName,
    taskDetailClient: input.taskDetailClient,
    sourceClient: input.sourceClient,
    hiddenTestClient: input.hiddenTestClient,
    repositoryClient: input.repositoryClient,
    problemClient: input.problemClient,
    syncProblemMaterial: true,
    templateClient: fullSync ? input.templateClient : undefined,
    passedClient: fullSync ? input.passedClient : undefined,
    answerClient: input.answerClient,
  });

  if (!fullSync) {
    await pruneNonEssentialArtifacts(hydrated.layout);
  }

  return {
    taskRoot: hydrated.layout.taskRoot,
    layout: hydrated.layout,
    detail: hydrated.detail,
    materials: await detectMaterialStates(hydrated.layout, {
      fullSync,
      detail: hydrated.detail,
      answerClientReady: Boolean(input.answerClient),
      problemClientReady: Boolean(input.problemClient),
    }),
  };
}

async function pruneNonEssentialArtifacts(layout: TaskLayoutPaths): Promise<void> {
  await Promise.all([
    rm(layout.templateCodeDir, { recursive: true, force: true }),
    rm(layout.passedCodeDir, { recursive: true, force: true }),
  ]);

  const recovery = await readRecoveryMetadata(layout.taskRoot);
  if (!recovery) {
    return;
  }

  await writeRecoveryMetadata(layout.taskRoot, {
    ...recovery,
    templateReady: false,
    templateFileCount: 0,
    passedReady: false,
    passedFileCount: 0,
  });
}

async function detectMaterialStates(
  layout: TaskLayoutPaths,
  options: {
    fullSync: boolean;
    detail: TaskDetailSummary;
    answerClientReady: boolean;
    problemClientReady: boolean;
  },
): Promise<SyncTaskPackageResult['materials']> {
  const [statementReady, currentCodeReady, templateReady, testsReady, answersReady, metadataReady] =
    await Promise.all([
      hasPath(layout.statementMarkdownPath) || hasPath(layout.statementHtmlPath),
      dirHasFiles(layout.currentCodeDir),
      dirHasFiles(layout.templateCodeDir),
      dirHasFiles(layout.hiddenTestsDir) || dirHasFiles(layout.allTestsDir),
      hasAnswerArtifacts(layout),
      hasPath(path.join(layout.metaDir, 'task.json')),
    ]);

  return {
    statement: statementReady
      ? 'ready'
      : options.fullSync
        ? options.detail.problemMaterial || options.problemClientReady
          ? 'missing'
          : 'unavailable'
        : 'missing',
    currentCode: currentCodeReady ? 'ready' : 'missing',
    templateCode: templateReady ? 'ready' : 'missing',
    tests: testsReady ? 'ready' : 'missing',
    answers: answersReady
      ? 'ready'
      : options.fullSync
        ? options.answerClientReady
          ? 'missing'
          : 'unavailable'
        : 'missing',
    metadata: metadataReady ? 'ready' : 'missing',
  };
}

async function hasPath(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function dirHasFiles(targetPath: string): Promise<boolean> {
  try {
    const entries = await readdir(targetPath, { withFileTypes: true });
    return entries.some((entry) => entry.isFile() || entry.isDirectory());
  } catch {
    return false;
  }
}

async function hasAnswerArtifacts(layout: TaskLayoutPaths): Promise<boolean> {
  const [unlockedReady, answerEntryCount] = await Promise.all([
    hasAnswerFiles(layout.answersDir),
    readAnswerEntryCount(layout.taskRoot, layout.answersDir),
  ]);

  return unlockedReady || answerEntryCount > 0;
}
