import { access, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import * as vscode from 'vscode';
import { readLocalJudgeReport } from '../core/judge/resultStore.js';
import { resolveTaskPackagePaths } from '../core/workspace/taskPackageMigration.js';
import { revealInExplorer as defaultRevealInExplorer } from '../core/workspace/workspaceBinding.js';
import { findFirstAnswerFilePath } from '../core/workspace/answerSurface.js';

export const TASK_TESTS_REQUIRED_ERROR_MESSAGE =
  '当前题目还没有测试集，请先同步题目包。';
export const TASK_ANSWERS_REQUIRED_ERROR_MESSAGE =
  '当前题目还没有答案，请先同步答案。';
export const TASK_FAILURE_CASE_REQUIRED_ERROR_MESSAGE =
  '最近一次本地测试没有可打开的失败用例，请先运行测试并确认存在失败输入/输出。';

export interface OpenTaskPackageFileDeps {
  openTextDocument?: (targetPath: string) => Promise<any>;
  showTextDocument?: (document: any) => Promise<unknown>;
  revealInExplorer?: (targetPath: string) => Promise<unknown>;
}

export interface OpenTaskPackageFileResult {
  openedPath: string;
  openedKind: 'file' | 'directory';
}

export async function openTaskTestsCommand(
  taskRoot: string,
  deps: OpenTaskPackageFileDeps = {},
): Promise<OpenTaskPackageFileResult> {
  const canonicalTestsDir = path.join(taskRoot, 'tests', 'all');

  if (await pathExists(canonicalTestsDir)) {
    return revealDirectoryPath(canonicalTestsDir, deps);
  }

  const testsDir = path.join(taskRoot, 'tests');
  if (await pathExists(testsDir)) {
    return revealDirectoryPath(testsDir, deps);
  }

  throw new Error(TASK_TESTS_REQUIRED_ERROR_MESSAGE);
}

export async function openTaskAnswersCommand(
  taskRoot: string,
  deps: OpenTaskPackageFileDeps = {},
): Promise<OpenTaskPackageFileResult> {
  const resolvedPaths = await resolveTaskPackagePaths(taskRoot);
  const firstAnswerFile = await findFirstAnswerFilePath(resolvedPaths.answersDir);
  if (firstAnswerFile) {
    return openFilePath(firstAnswerFile, deps);
  }

  if (await pathExists(resolvedPaths.answersDir)) {
    return revealDirectoryPath(resolvedPaths.answersDir, deps);
  }

  throw new Error(TASK_ANSWERS_REQUIRED_ERROR_MESSAGE);
}

export async function openLatestFailureInputCommand(
  taskRoot: string,
  deps: OpenTaskPackageFileDeps = {},
): Promise<OpenTaskPackageFileResult> {
  const firstFailed = await resolveLatestFailedCase(taskRoot);
  if (!firstFailed?.inputPath) {
    throw new Error(TASK_FAILURE_CASE_REQUIRED_ERROR_MESSAGE);
  }

  return openFilePath(path.join(taskRoot, ...firstFailed.inputPath.split('/')), deps);
}

export async function openLatestFailureOutputCommand(
  taskRoot: string,
  deps: OpenTaskPackageFileDeps = {},
): Promise<OpenTaskPackageFileResult> {
  const firstFailed = await resolveLatestFailedCase(taskRoot);
  if (!firstFailed?.outputPath) {
    throw new Error(TASK_FAILURE_CASE_REQUIRED_ERROR_MESSAGE);
  }

  return openFilePath(path.join(taskRoot, ...firstFailed.outputPath.split('/')), deps);
}

async function openFilePath(
  targetPath: string,
  deps: OpenTaskPackageFileDeps,
): Promise<OpenTaskPackageFileResult> {
  const document = await (deps.openTextDocument ?? defaultOpenTextDocument)(targetPath);
  await (deps.showTextDocument ?? defaultShowTextDocument)(document);
  return {
    openedPath: targetPath,
    openedKind: 'file',
  };
}

async function revealDirectoryPath(
  targetPath: string,
  deps: OpenTaskPackageFileDeps,
): Promise<OpenTaskPackageFileResult> {
  await (deps.revealInExplorer ?? defaultRevealInExplorer)(targetPath);
  return {
    openedPath: targetPath,
    openedKind: 'directory',
  };
}

async function defaultOpenTextDocument(targetPath: string): Promise<unknown> {
  return vscode.workspace.openTextDocument(vscode.Uri.file(targetPath));
}

async function defaultShowTextDocument(document: unknown): Promise<unknown> {
  return vscode.window.showTextDocument(document as vscode.TextDocument);
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    const info = await stat(targetPath);
    return info.isFile() || info.isDirectory();
  } catch {
    try {
      await access(targetPath);
      return true;
    } catch {
      return false;
    }
  }
}

async function resolveLatestFailedCase(
  taskRoot: string,
): Promise<{ inputPath?: string; outputPath?: string } | undefined> {
  const report = await readLocalJudgeReport(taskRoot);
  return report?.caseResults.find((item) => item.verdict !== 'passed');
}
