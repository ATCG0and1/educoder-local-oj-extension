import { readdir } from 'node:fs/promises';
import path from 'node:path';
import * as vscode from 'vscode';

export interface CompareWithTemplateDeps {
  openDiff?: (leftPath: string, rightPath: string, title: string) => Promise<unknown>;
}

export async function compareWithTemplate(
  taskRoot: string,
  relativePath?: string,
  deps: CompareWithTemplateDeps = {},
): Promise<void> {
  const targetPath = relativePath ?? (await findFirstRelativeFile(path.join(taskRoot, 'workspace')));
  if (!targetPath) {
    throw new Error('No workspace file found to compare.');
  }

  const leftPath = path.join(taskRoot, 'workspace', targetPath);
  const rightPath = path.join(taskRoot, '_educoder', 'template', targetPath);
  const title = `Template Compare: ${targetPath}`;

  await (deps.openDiff ?? defaultOpenDiff)(leftPath, rightPath, title);
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
