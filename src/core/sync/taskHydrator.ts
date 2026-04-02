import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { HiddenTestFetchClientLike } from '../api/hiddenTestFetchClient.js';
import type { SourceFetchClientLike } from '../api/sourceFetchClient.js';
import type { TaskDetailClientLike, TaskDetailSummary } from '../api/taskDetailClient.js';
import { buildRecoveryMetadata, writeRecoveryMetadata } from '../recovery/materialStore.js';
import { getTaskLayoutPaths, type TaskLayoutPaths } from '../workspace/directoryLayout.js';
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
  templateFiles: WorkspaceFile[];
  hiddenTests: HiddenTestCase[];
  answerFiles?: WorkspaceFile[];
  answerInfo?: unknown;
  passedFiles?: WorkspaceFile[];
  historyFiles?: WorkspaceFile[];
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
}

export interface HydrateRemoteTaskResult {
  layout: TaskLayoutPaths;
  detail: TaskDetailSummary;
  templateFiles: WorkspaceFile[];
  hiddenTests: HiddenTestCase[];
}

export async function hydrateTask(input: HydrateTaskInput): Promise<TaskLayoutPaths> {
  const layout = getTaskLayoutPaths(input);

  await Promise.all([
    mkdir(layout.workspaceDir, { recursive: true }),
    mkdir(layout.metaDir, { recursive: true }),
    mkdir(layout.hiddenTestsDir, { recursive: true }),
    mkdir(layout.answerDir, { recursive: true }),
    mkdir(layout.templateDir, { recursive: true }),
    mkdir(layout.passedDir, { recursive: true }),
    mkdir(layout.historyDir, { recursive: true }),
    mkdir(layout.reportsDir, { recursive: true }),
    mkdir(layout.vscodeDir, { recursive: true }),
  ]);

  await Promise.all([
    writeWorkspaceFiles(layout.workspaceDir, input.templateFiles),
    writeWorkspaceFiles(layout.templateDir, input.templateFiles),
    writeWorkspaceFiles(layout.answerDir, input.answerFiles ?? []),
    writeWorkspaceFiles(layout.passedDir, input.passedFiles ?? []),
    writeWorkspaceFiles(layout.historyDir, input.historyFiles ?? []),
    writeHiddenTests(layout.hiddenTestsDir, input.hiddenTests),
    writeOptionalJson(path.join(layout.answerDir, 'answer_info.json'), input.answerInfo),
    writeOptionalJson(path.join(layout.metaDir, 'task.json'), input.meta),
    writeRecoveryMetadata(
      layout.taskRoot,
      buildRecoveryMetadata({
        templateFiles: input.templateFiles,
        passedFiles: input.passedFiles,
        answerInfo: input.answerInfo,
        historyFiles: input.historyFiles,
      }),
    ),
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
  const templateFiles = await input.sourceClient.fetchSourceFiles({
    taskId: input.taskId,
    homeworkId: input.homeworkId,
    filePaths: detail.editablePaths,
  });
  const hiddenTests = await input.hiddenTestClient.fetchHiddenTests({
    taskId: input.taskId,
    fallbackTestSets: detail.testSets,
  });

  const layout = await hydrateTask({
    collectionRoot: input.collectionRoot,
    homeworkId: input.homeworkId,
    taskId: input.taskId,
    homeworkDirName: input.homeworkDirName,
    taskDirName: input.taskDirName,
    templateFiles,
    hiddenTests,
    meta: {
      ...detail,
      hiddenTestsCount: hiddenTests.length,
      sourceFileCount: templateFiles.length,
      hydratedAt: new Date().toISOString(),
    },
  });

  await writeTaskDebugConfig(layout.taskRoot);

  return {
    layout,
    detail,
    templateFiles,
    hiddenTests,
  };
}

async function writeHiddenTests(hiddenTestsDir: string, hiddenTests: HiddenTestCase[]): Promise<void> {
  await Promise.all(
    hiddenTests.flatMap((testCase, index) => {
      const caseId = String(index + 1).padStart(3, '0');

      return [
        writeFile(path.join(hiddenTestsDir, `case_${caseId}_input.txt`), testCase.input, 'utf8'),
        writeFile(path.join(hiddenTestsDir, `case_${caseId}_output.txt`), testCase.output, 'utf8'),
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
