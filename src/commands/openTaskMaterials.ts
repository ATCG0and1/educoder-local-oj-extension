import { access, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as vscode from 'vscode';
import { normalizeStatementMarkdownForPreview } from '../core/content/markdownPreview.js';
import { normalizeSafeRelativeFilePath } from '../core/workspace/workspaceInit.js';
import { resolveTaskPackagePaths } from '../core/workspace/taskPackageMigration.js';

export const TASK_STATEMENT_REQUIRED_ERROR_MESSAGE =
  '当前题目还没有题面，请先拉全题目资料。';

export const CURRENT_CODE_REQUIRED_ERROR_MESSAGE =
  '当前题目还没有当前代码，请先同步题目包。';

export interface OpenTaskMaterialDeps {
  openTextDocument?: (targetPath: string) => Promise<any>;
  showTextDocument?: (
    document: any,
    options?: { preview?: boolean; preserveFocus?: boolean },
  ) => Promise<unknown>;
  previewMarkdown?: (targetPath: string) => Promise<unknown>;
}

export interface OpenTaskMaterialResult {
  openedPath: string;
}

export interface OpenTaskPrimaryEditorsResult {
  statement?: OpenTaskMaterialResult;
  currentCode?: OpenTaskMaterialResult;
}

export interface OpenTaskPrimaryEditorsDeps extends OpenTaskMaterialDeps {
  continueOnError?: boolean;
}

export async function openTaskStatementCommand(
  taskRoot: string,
  deps: OpenTaskMaterialDeps = {},
): Promise<OpenTaskMaterialResult> {
  const targetPath = await resolveTaskStatementPath(taskRoot);
  if (targetPath.toLowerCase().endsWith('.md')) {
    await normalizeMarkdownFileInPlace(targetPath, normalizeStatementMarkdownForPreview);
    await (deps.previewMarkdown ?? defaultPreviewMarkdown)(targetPath);
    return { openedPath: targetPath };
  }

  const document = await (deps.openTextDocument ?? defaultOpenTextDocument)(targetPath);
  await (deps.showTextDocument ?? defaultShowTextDocument)(document, {
    preview: true,
    preserveFocus: true,
  });
  return { openedPath: targetPath };
}

export async function openCurrentCodeCommand(
  taskRoot: string,
  deps: OpenTaskMaterialDeps = {},
): Promise<OpenTaskMaterialResult> {
  const targetPath = await resolveCurrentCodePath(taskRoot);
  const document = await (deps.openTextDocument ?? defaultOpenTextDocument)(targetPath);
  await (deps.showTextDocument ?? defaultShowTextDocument)(document, {
    preview: false,
    preserveFocus: false,
  });
  return { openedPath: targetPath };
}

export async function openTaskPrimaryEditors(
  taskRoot: string,
  deps: OpenTaskPrimaryEditorsDeps = {},
): Promise<OpenTaskPrimaryEditorsResult> {
  const result: OpenTaskPrimaryEditorsResult = {};
  let firstError: unknown;

  try {
    result.statement = await openTaskStatementCommand(taskRoot, deps);
  } catch (error) {
    firstError = error;
    if (!deps.continueOnError) {
      throw error;
    }
  }

  try {
    result.currentCode = await openCurrentCodeCommand(taskRoot, deps);
  } catch (error) {
    firstError ??= error;
    if (!deps.continueOnError) {
      throw error;
    }
  }

  if (!result.statement && !result.currentCode && firstError) {
    throw firstError;
  }

  return result;
}

async function resolveTaskStatementPath(taskRoot: string): Promise<string> {
  const candidatePaths = [
    path.join(taskRoot, 'problem', 'statement.md'),
    path.join(taskRoot, 'problem', 'statement.html'),
  ];

  for (const candidate of candidatePaths) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }

  throw new Error(TASK_STATEMENT_REQUIRED_ERROR_MESSAGE);
}

async function resolveCurrentCodePath(taskRoot: string): Promise<string> {
  const resolvedPaths = await resolveTaskPackagePaths(taskRoot);
  if (resolvedPaths.currentCodeSource === 'missing') {
    throw new Error(CURRENT_CODE_REQUIRED_ERROR_MESSAGE);
  }

  const preferredPath = await resolvePreferredEditablePath(taskRoot, resolvedPaths.currentCodeDir);
  if (preferredPath) {
    return preferredPath;
  }

  const fallbackPath = await findFirstFilePath(resolvedPaths.currentCodeDir);
  if (fallbackPath) {
    return fallbackPath;
  }

  throw new Error(CURRENT_CODE_REQUIRED_ERROR_MESSAGE);
}

async function resolvePreferredEditablePath(
  taskRoot: string,
  currentCodeDir: string,
): Promise<string | undefined> {
  try {
    const taskMeta = JSON.parse(
      await readFile(path.join(taskRoot, '_educoder', 'meta', 'task.json'), 'utf8'),
    ) as { editablePaths?: unknown };
    if (!Array.isArray(taskMeta.editablePaths)) {
      return undefined;
    }

    for (const item of taskMeta.editablePaths) {
      if (typeof item !== 'string' || item.trim().length === 0) {
        continue;
      }

      try {
        const normalizedPath = normalizeSafeRelativeFilePath(item);
        const candidate = path.join(currentCodeDir, normalizedPath);
        if (await pathExists(candidate)) {
          return candidate;
        }
      } catch {
        continue;
      }
    }

    return undefined;
  } catch {
    return undefined;
  }
}

async function findFirstFilePath(rootDir: string): Promise<string | undefined> {
  try {
    const entries = await readdir(rootDir, { withFileTypes: true });
    const sortedEntries = entries
      .slice()
      .sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of sortedEntries) {
      const candidate = path.join(rootDir, entry.name);
      if (entry.isFile()) {
        return candidate;
      }

      if (entry.isDirectory()) {
        const nested = await findFirstFilePath(candidate);
        if (nested) {
          return nested;
        }
      }
    }

    return undefined;
  } catch {
    return undefined;
  }
}

async function defaultOpenTextDocument(targetPath: string): Promise<unknown> {
  return vscode.workspace.openTextDocument(vscode.Uri.file(targetPath));
}

async function defaultShowTextDocument(
  document: unknown,
  options?: { preview?: boolean; preserveFocus?: boolean },
): Promise<unknown> {
  return vscode.window.showTextDocument(document as vscode.TextDocument, options);
}

async function defaultPreviewMarkdown(targetPath: string): Promise<unknown> {
  return vscode.commands.executeCommand('markdown.showPreview', vscode.Uri.file(targetPath));
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
    // Best-effort only: preview normalization should never block opening the target file.
  }
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}
