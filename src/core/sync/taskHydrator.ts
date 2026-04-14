import { mkdir, rm, writeFile } from 'node:fs/promises';
import type {
  AnswerFetchClientLike,
  AnswerInfoSummary,
  UnlockedAnswerContent,
} from '../api/answerFetchClient.js';
import path from 'node:path';
import type { ProblemFetchClientLike } from '../api/problemFetchClient.js';
import type { RepositoryNode } from '../api/repositoryFetchClient.js';
import type { RepositoryFetchClientLike } from '../api/repositoryFetchClient.js';
import type { HiddenTestFetchClientLike } from '../api/hiddenTestFetchClient.js';
import type { PassedFetchClientLike } from '../api/passedFetchClient.js';
import type { SourceFetchClientLike } from '../api/sourceFetchClient.js';
import type { TaskDetailClientLike, TaskDetailSummary } from '../api/taskDetailClient.js';
import type { TemplateFetchClientLike } from '../api/templateFetchClient.js';
import {
  buildRecoveryMetadata,
  readRecoveryMetadata,
  writeRecoveryMetadata,
  type RecoveryMetadata,
} from '../recovery/materialStore.js';
import { normalizeAnswerMarkdownForPreview } from '../content/markdownPreview.js';
import { writeRepositorySnapshot } from '../recovery/repositoryStore.js';
import { syncProblemStatement } from './problemStatementSync.js';
import { getTaskLayoutPaths, type TaskLayoutPaths } from '../workspace/directoryLayout.js';
import { ensureCanonicalTaskPackageSurface } from '../workspace/taskPackageMigration.js';
import { writeTaskDebugConfig } from '../workspace/vscodeConfigWriter.js';
import { writeWorkspaceFiles, type WorkspaceFile } from '../workspace/workspaceInit.js';

export interface HiddenTestCase {
  input: string;
  output: string;
}

export interface HydrateTaskInput {
  collectionRoot: string;
  homeworkId: string;
  taskId: string;
  homeworkDirName?: string;
  taskDirName?: string;
  workspaceFiles?: WorkspaceFile[];
  templateFiles: WorkspaceFile[];
  hiddenTests: HiddenTestCase[];
  answerFiles?: WorkspaceFile[];
  unlockedAnswerFiles?: WorkspaceFile[];
  answerInfo?: unknown;
  lastAnswerSyncAt?: string;
  passedFiles?: WorkspaceFile[];
  historyFiles?: WorkspaceFile[];
  repositoryNodes?: RepositoryNode[];
  repositoryFiles?: WorkspaceFile[];
  meta?: unknown;
}

export interface HydrateRemoteTaskInput {
  collectionRoot: string;
  homeworkId: string;
  taskId: string;
  homeworkDirName?: string;
  taskDirName?: string;
  taskDetailClient: TaskDetailClientLike;
  sourceClient: SourceFetchClientLike;
  hiddenTestClient: HiddenTestFetchClientLike;
  problemClient?: ProblemFetchClientLike;
  syncProblemMaterial?: boolean;
  repositoryClient?: Pick<RepositoryFetchClientLike, 'collectRepositoryTree'>;
  templateClient?: TemplateFetchClientLike;
  passedClient?: PassedFetchClientLike;
  answerClient?: AnswerFetchClientLike;
  answerSyncMode?: 'none' | 'safe' | 'full';
}

export interface HydrateRemoteTaskResult {
  layout: TaskLayoutPaths;
  detail: TaskDetailSummary;
  templateFiles: WorkspaceFile[];
  hiddenTests: HiddenTestCase[];
}

export async function hydrateTask(input: HydrateTaskInput): Promise<TaskLayoutPaths> {
  const layout = getTaskLayoutPaths(input);
  const workspaceFiles = input.workspaceFiles ?? input.templateFiles;
  const existingRecoveryMetadata = await readRecoveryMetadata(layout.taskRoot);
  const nextRecoveryMetadata = mergeRecoveryMetadata(
    existingRecoveryMetadata,
    buildRecoveryMetadata({
      templateFiles: input.templateFiles,
      passedFiles: input.passedFiles,
      answerInfo: input.answerInfo,
      unlockedAnswerFiles: input.unlockedAnswerFiles,
      historyFiles: input.historyFiles,
      repositoryFiles: input.repositoryFiles,
      lastAnswerSyncAt: input.lastAnswerSyncAt,
    }),
    input,
  );

  await ensureCanonicalTaskPackageSurface(layout);

  await Promise.all([
    writeWorkspaceFiles(layout.workspaceDir, workspaceFiles),
    writeWorkspaceFiles(layout.templateDir, input.templateFiles),
    writeAnswerArtifacts(layout, input),
    writeWorkspaceFiles(layout.passedDir, input.passedFiles ?? []),
    writeWorkspaceFiles(layout.historyDir, input.historyFiles ?? []),
    writeTestArtifacts(layout, input.hiddenTests),
    writeOptionalJson(path.join(layout.metaDir, 'task.json'), input.meta),
    input.repositoryNodes || input.repositoryFiles
      ? writeRepositorySnapshot(layout.taskRoot, {
          nodes: input.repositoryNodes ?? [],
          files: input.repositoryFiles ?? [],
        })
      : Promise.resolve(),
    writeRecoveryMetadata(layout.taskRoot, nextRecoveryMetadata),
  ]);

  return layout;
}

export async function hydrateTaskFromRemote(
  input: HydrateRemoteTaskInput,
): Promise<HydrateRemoteTaskResult> {
  const detail = await input.taskDetailClient.getTaskDetail({
    taskId: input.taskId,
    homeworkId: input.homeworkId,
  });
  const editableWorkspaceFiles = await input.sourceClient.fetchSourceFiles({
    taskId: input.taskId,
    homeworkId: input.homeworkId,
    filePaths: detail.editablePaths,
  });
  const repositorySnapshot = await fetchRepositorySnapshot({
    taskId: input.taskId,
    homeworkId: input.homeworkId,
    detail,
    sourceClient: input.sourceClient,
    repositoryClient: input.repositoryClient,
  });
  const workspaceFiles = overlayWorkspaceFiles({
    repositoryFiles: repositorySnapshot?.files,
    editableFiles: editableWorkspaceFiles,
  });
  const hiddenTests = await input.hiddenTestClient.fetchHiddenTests({
    taskId: input.taskId,
    fallbackTestSets: detail.testSets,
  });
  const [templateFiles, passedFiles, answerInfo] = await Promise.all([
    input.templateClient
      ? input.templateClient.fetchTemplateFiles({
          taskId: input.taskId,
          homeworkId: input.homeworkId,
          filePaths: detail.editablePaths,
        })
      : workspaceFiles,
    input.passedClient
      ? input.passedClient.fetchPassedFiles({
          taskId: input.taskId,
          homeworkId: input.homeworkId,
          filePaths: detail.editablePaths,
        })
      : [],
    input.answerClient && (input.answerSyncMode ?? 'none') !== 'none'
      ? input.answerClient.fetchAnswerInfo({ taskId: input.taskId }).catch(() => undefined)
      : undefined,
  ]);
  const answerSyncedAt = answerInfo ? new Date().toISOString() : undefined;
  const unlockedAnswers = await resolveUnlockedAnswers({
    taskId: input.taskId,
    answerInfo,
    answerClient: input.answerClient,
    mode: input.answerSyncMode ?? 'none',
  });
  const unlockedAnswerFiles = materializeUnlockedAnswerFiles(unlockedAnswers);
  const layout = await hydrateTask({
    collectionRoot: input.collectionRoot,
    homeworkId: input.homeworkId,
    taskId: input.taskId,
    homeworkDirName: input.homeworkDirName,
    taskDirName: input.taskDirName,
    workspaceFiles,
    templateFiles,
    hiddenTests,
    unlockedAnswerFiles,
    answerInfo,
    lastAnswerSyncAt: answerSyncedAt,
    passedFiles,
    repositoryNodes: repositorySnapshot?.nodes,
    repositoryFiles: repositorySnapshot?.files,
    meta: {
      ...detail,
      hiddenTestsCount: hiddenTests.length,
      sourceFileCount: workspaceFiles.length,
      hydratedAt: new Date().toISOString(),
    },
  });

  if (input.syncProblemMaterial !== false) {
    await syncProblemStatement({
      layout,
      taskId: input.taskId,
      homeworkId: input.homeworkId,
      taskName: detail.taskName,
      detail,
      problemClient: input.problemClient,
    });
  }

  await writeTaskDebugConfig(layout.taskRoot);

  return {
    layout,
    detail,
    templateFiles,
    hiddenTests,
  };
}

async function fetchRepositorySnapshot(input: {
  taskId: string;
  homeworkId?: string;
  detail: TaskDetailSummary;
  sourceClient: SourceFetchClientLike;
  repositoryClient?: Pick<RepositoryFetchClientLike, 'collectRepositoryTree'>;
}): Promise<{ nodes: RepositoryNode[]; files: WorkspaceFile[] } | undefined> {
  if (!input.repositoryClient || !input.detail.myshixunIdentifier) {
    return undefined;
  }

  const nodes = await input.repositoryClient.collectRepositoryTree({
    myshixunIdentifier: input.detail.myshixunIdentifier,
    rootPath: '',
  });
  const blobPaths = nodes.filter((node) => node.type === 'blob').map((node) => node.path);
  const files =
    blobPaths.length > 0
      ? await input.sourceClient.fetchSourceFiles({
          taskId: input.taskId,
          homeworkId: input.homeworkId,
          filePaths: blobPaths,
        })
      : [];

  return { nodes, files };
}

function overlayWorkspaceFiles(input: {
  repositoryFiles?: WorkspaceFile[];
  editableFiles: WorkspaceFile[];
}): WorkspaceFile[] {
  const mergedFiles = new Map<string, WorkspaceFile>();

  for (const file of input.repositoryFiles ?? []) {
    mergedFiles.set(file.path, file);
  }

  for (const file of input.editableFiles) {
    mergedFiles.set(file.path, file);
  }

  return [...mergedFiles.values()].sort((left, right) => left.path.localeCompare(right.path));
}

async function writeTestArtifacts(layout: TaskLayoutPaths, hiddenTests: HiddenTestCase[]): Promise<void> {
  await Promise.all([
    rm(layout.allTestsDir, { recursive: true, force: true }),
    rm(layout.hiddenTestsDir, { recursive: true, force: true }),
    rm(path.join(layout.testsDir, 'hidden'), { recursive: true, force: true }),
    rm(layout.visibleTestsDir, { recursive: true, force: true }),
  ]);

  await Promise.all([
    mkdir(layout.allTestsDir, { recursive: true }),
    mkdir(layout.hiddenTestsDir, { recursive: true }),
  ]);

  const cases = hiddenTests.map((testCase, index) => {
    const caseId = String(index + 1).padStart(3, '0');
    return {
      id: caseId,
      scope: 'hidden' as const,
      input: testCase.input,
      output: testCase.output,
      inputPath: `all/case_${caseId}_input.txt`,
      outputPath: `all/case_${caseId}_output.txt`,
      hiddenInputPath: `hidden/case_${caseId}_input.txt`,
      hiddenOutputPath: `hidden/case_${caseId}_output.txt`,
    };
  });

  await Promise.all(
    cases.flatMap((testCase) => {
      return [
        writeFile(path.join(layout.hiddenTestsDir, `case_${testCase.id}_input.txt`), testCase.input, 'utf8'),
        writeFile(path.join(layout.hiddenTestsDir, `case_${testCase.id}_output.txt`), testCase.output, 'utf8'),
        writeFile(path.join(layout.allTestsDir, `case_${testCase.id}_input.txt`), testCase.input, 'utf8'),
        writeFile(path.join(layout.allTestsDir, `case_${testCase.id}_output.txt`), testCase.output, 'utf8'),
      ];
    }),
  );

}

async function writeOptionalJson(filePath: string, data: unknown): Promise<void> {
  if (data === undefined) {
    return;
  }

  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

async function writeAnswerArtifacts(layout: TaskLayoutPaths, input: HydrateTaskInput): Promise<void> {
  if (
    input.answerFiles === undefined &&
    input.unlockedAnswerFiles === undefined &&
    input.answerInfo === undefined
  ) {
    return;
  }

  const answerFiles = [
    ...(input.answerFiles ?? []),
    ...(input.unlockedAnswerFiles ?? []),
  ];

  await rm(layout.answersDir, { recursive: true, force: true });
  await mkdir(layout.answersDir, { recursive: true });
  await mkdir(layout.internalAnswersDir, { recursive: true });
  await writeWorkspaceFiles(layout.answersDir, answerFiles);

  if (input.answerInfo !== undefined) {
    await writeFile(layout.answerInfoPath, JSON.stringify(input.answerInfo, null, 2), 'utf8');
  }
}

function materializeUnlockedAnswerFiles(unlockedAnswers: UnlockedAnswerContent[]): WorkspaceFile[] {
  return unlockedAnswers
    .filter((entry) => entry.unlocked && entry.content.length > 0)
    .map((entry) => ({
      path: `answer-${entry.answerId}.md`,
      content: normalizeAnswerMarkdownForPreview(entry.content),
    }));
}

async function resolveUnlockedAnswers(input: {
  taskId: string;
  answerInfo?: AnswerInfoSummary;
  answerClient?: AnswerFetchClientLike;
  mode: 'none' | 'safe' | 'full';
}): Promise<UnlockedAnswerContent[]> {
  if (input.mode === 'none') {
    return [];
  }

  const entries = input.answerInfo?.entries ?? [];
  const embeddedContent = entries
    .filter((entry): entry is typeof entry & { answerId: number; content: string } =>
      typeof entry.answerId === 'number' &&
      typeof entry.content === 'string' &&
      entry.content.length > 0,
    )
    .map((entry) => ({
      answerId: entry.answerId,
      content: entry.content,
      unlocked: true,
    }));
  const embeddedIds = new Set(embeddedContent.map((entry) => entry.answerId));
  const unlockTargets = entries
    .filter((entry): entry is typeof entry & { answerId: number } => typeof entry.answerId === 'number')
    .filter((entry) => !embeddedIds.has(entry.answerId));

  if (input.mode !== 'full' || !input.answerClient || unlockTargets.length === 0) {
    return embeddedContent;
  }

  const unlockedFromApi = await Promise.all(
    unlockTargets.map((entry) =>
      input.answerClient!
        .unlockAnswer({ taskId: input.taskId, answerId: entry.answerId })
        .catch(() => ({
          answerId: entry.answerId,
          content: '',
          unlocked: false,
        })),
    ),
  );

  return [...embeddedContent, ...unlockedFromApi];
}

function mergeRecoveryMetadata(
  existing: RecoveryMetadata | undefined,
  next: RecoveryMetadata,
  input: HydrateTaskInput,
): RecoveryMetadata {
  if (!existing) {
    return next;
  }

  return {
    ...next,
    passedReady: input.passedFiles === undefined ? existing.passedReady : next.passedReady,
    passedFileCount: input.passedFiles === undefined ? existing.passedFileCount : next.passedFileCount,
    answerReady:
      input.answerInfo === undefined && input.unlockedAnswerFiles === undefined
        ? existing.answerReady
        : next.answerReady,
    answerEntryCount:
      input.answerInfo === undefined && input.unlockedAnswerFiles === undefined
        ? existing.answerEntryCount
        : next.answerEntryCount,
    unlockedAnswerCount:
      input.answerInfo === undefined && input.unlockedAnswerFiles === undefined
        ? existing.unlockedAnswerCount
        : next.unlockedAnswerCount,
    historyReady: input.historyFiles === undefined ? existing.historyReady : next.historyReady,
    historyFileCount: input.historyFiles === undefined ? existing.historyFileCount : next.historyFileCount,
    repositoryReady:
      input.repositoryNodes === undefined && input.repositoryFiles === undefined
        ? existing.repositoryReady
        : next.repositoryReady,
    repositoryFileCount:
      input.repositoryNodes === undefined && input.repositoryFiles === undefined
        ? existing.repositoryFileCount
        : next.repositoryFileCount,
    lastRepositorySyncAt: existing.lastRepositorySyncAt,
    lastAnswerSyncAt: existing.lastAnswerSyncAt,
  };
}
