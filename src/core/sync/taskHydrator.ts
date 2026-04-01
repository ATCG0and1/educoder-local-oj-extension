import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getTaskLayoutPaths, type TaskLayoutPaths } from '../workspace/directoryLayout.js';
import { writeWorkspaceFiles, type WorkspaceFile } from '../workspace/workspaceInit.js';

export interface HiddenTestCase {
  input: string;
  output: string;
}

export interface HydrateTaskInput {
  collectionRoot: string;
  homeworkId: string;
  taskId: string;
  templateFiles: WorkspaceFile[];
  hiddenTests: HiddenTestCase[];
  answerFiles?: WorkspaceFile[];
  answerInfo?: unknown;
  passedFiles?: WorkspaceFile[];
  historyFiles?: WorkspaceFile[];
  meta?: unknown;
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
  ]);

  return layout;
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
