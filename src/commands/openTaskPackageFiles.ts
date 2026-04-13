import { access, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as vscode from 'vscode';
import { normalizeAnswerMarkdownForPreview } from '../core/content/markdownPreview.js';
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
export const TASK_COMPILE_ERROR_REQUIRED_ERROR_MESSAGE =
  '最近一次本地测试没有可打开的编译报错，请先运行本地测试并确认编译失败。';

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

export async function openLatestCompileErrorCommand(
  taskRoot: string,
  deps: OpenTaskPackageFileDeps = {},
): Promise<OpenTaskPackageFileResult> {
  const report = await readLocalJudgeReport(taskRoot);
  if (!report || report.compile.verdict !== 'compile_error') {
    throw new Error(TASK_COMPILE_ERROR_REQUIRED_ERROR_MESSAGE);
  }

  const totalCases = await countCanonicalLocalCases(taskRoot);
  const logPath = path.join(taskRoot, '_educoder', 'judge', 'latest_compile_error.log');
  const logContent = buildCompileErrorLog(report, totalCases);

  await mkdir(path.dirname(logPath), { recursive: true });
  await writeFile(logPath, logContent, 'utf8');
  return openFilePath(logPath, deps);
}

async function openFilePath(
  targetPath: string,
  deps: OpenTaskPackageFileDeps,
): Promise<OpenTaskPackageFileResult> {
  if (targetPath.toLowerCase().endsWith('.md')) {
    await normalizeMarkdownFileInPlace(targetPath, normalizeAnswerMarkdownForPreview);
  }
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

async function countCanonicalLocalCases(taskRoot: string): Promise<number> {
  try {
    const entries = await readdir(path.join(taskRoot, 'tests', 'all'), { withFileTypes: true });
    return entries.filter((entry) => entry.isFile() && entry.name.endsWith('_input.txt')).length;
  } catch {
    return 0;
  }
}

function buildCompileErrorLog(
  report: NonNullable<Awaited<ReturnType<typeof readLocalJudgeReport>>>,
  totalCases: number,
): string {
  const sourceFiles = report.compile.sourceFiles ?? [];
  const sourceSummary =
    sourceFiles.length > 0
      ? sourceFiles.map((item) => `- ${item}`).join('\n')
      : '- (未记录源文件列表)';
  const header = totalCases > 0 ? `0/${totalCases}` : '编译失败';

  return [
    `本地结果：${header}`,
    '',
    '【编译源文件】',
    sourceSummary,
    '',
    '【stderr】',
    report.compile.stderr.trim().length > 0 ? report.compile.stderr : '(空)',
    '',
    '【stdout】',
    report.compile.stdout.trim().length > 0 ? report.compile.stdout : '(空)',
  ].join('\n');
}

async function normalizeMarkdownFileInPlace(
  targetPath: string,
  normalize: (content: string) => string,
): Promise<void> {
  try {
    const original = await readFile(targetPath, 'utf8');
    const next = normalize(original);
    if (next !== original) {
      await writeFile(targetPath, next, 'utf8');
    }
  } catch {
    // Best-effort only: normalization should not block opening answer markdown.
  }
}
