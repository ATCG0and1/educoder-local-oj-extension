import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import * as vscode from 'vscode';
import { normalizeSafeRelativeFilePath } from '../core/workspace/workspaceInit.js';
import { resolveTaskPackagePaths } from '../core/workspace/taskPackageMigration.js';

export const TEMPLATE_COMPARE_REQUIRED_ERROR_MESSAGE =
  '未找到模板快照，请先同步/打开题目后再执行模板对比。';

export interface CompareWithTemplateDeps {
  openDiff?: (leftPath: string, rightPath: string, title: string) => Promise<unknown>;
}

export async function compareWithTemplate(
  taskRoot: string,
  relativePath?: string,
  deps: CompareWithTemplateDeps = {},
): Promise<void> {
  const resolvedPaths = await resolveTaskPackagePaths(taskRoot);
  const templateDir = await resolveTemplateDir(taskRoot);
  const targetPath =
    (relativePath ? normalizeSafeRelativeFilePath(relativePath) : undefined) ??
    (await resolveDefaultComparePath(taskRoot, resolvedPaths.currentCodeDir));
  if (!targetPath) {
    throw new Error('No workspace file found to compare.');
  }

  const leftPath = path.join(resolvedPaths.currentCodeDir, targetPath);
  const rightPath = path.join(templateDir, targetPath);
  await ensureFileExists(leftPath, 'No workspace file found to compare.');
  await ensureFileExists(rightPath, TEMPLATE_COMPARE_REQUIRED_ERROR_MESSAGE);
  const title = `Template Compare: ${targetPath}`;

  await (deps.openDiff ?? defaultOpenDiff)(leftPath, rightPath, title);
}

async function resolveDefaultComparePath(
  taskRoot: string,
  currentCodeDir: string,
): Promise<string | undefined> {
  try {
    const taskMeta = JSON.parse(
      await readFile(path.join(taskRoot, '_educoder', 'meta', 'task.json'), 'utf8'),
    ) as { editablePaths?: unknown };
    const editablePaths = taskMeta.editablePaths;
    if (Array.isArray(editablePaths)) {
      for (const item of editablePaths) {
        if (typeof item !== 'string' || item.trim().length === 0) {
          continue;
        }

        let normalizedPath: string;
        try {
          normalizedPath = normalizeSafeRelativeFilePath(item);
        } catch {
          continue;
        }

        try {
          await access(path.join(currentCodeDir, normalizedPath));
          return normalizedPath;
        } catch {
          continue;
        }
      }

      return undefined;
    }
  } catch {
    // ignore and fall back to workspace scan
  }

  try {
    return await findFirstRelativeFile(currentCodeDir);
  } catch {
    return undefined;
  }
}

async function resolveTemplateDir(taskRoot: string): Promise<string> {
  const internalTemplateDir = path.join(taskRoot, '_educoder', 'template');
  try {
    await access(internalTemplateDir);
    return internalTemplateDir;
  } catch {
    // ignore
  }

  const canonicalTemplateDir = path.join(taskRoot, 'code', 'template');
  try {
    await access(canonicalTemplateDir);
    return canonicalTemplateDir;
  } catch {
    return path.join(taskRoot, '_educoder', 'template');
  }
}

async function defaultOpenDiff(leftPath: string, rightPath: string, title: string): Promise<unknown> {
  return vscode.commands.executeCommand(
    'vscode.diff',
    vscode.Uri.file(leftPath),
    vscode.Uri.file(rightPath),
    title,
  );
}

async function findFirstRelativeFile(rootDir: string, prefix = ''): Promise<string | undefined> {
  const entries = await readdir(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isFile()) {
      return relative;
    }

    if (entry.isDirectory()) {
      const nested = await findFirstRelativeFile(path.join(rootDir, entry.name), relative);
      if (nested) {
        return nested;
      }
    }
  }

  return undefined;
}

async function ensureFileExists(targetPath: string, message: string): Promise<void> {
  try {
    await access(targetPath);
  } catch {
    throw new Error(message);
  }
}
