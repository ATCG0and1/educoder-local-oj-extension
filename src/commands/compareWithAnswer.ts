import { readdir } from 'node:fs/promises';
import path from 'node:path';
import * as vscode from 'vscode';

export interface CompareWithAnswerDeps {
  openDiff?: (leftPath: string, rightPath: string, title: string) => Promise<unknown>;
}

export async function compareWithAnswer(
  taskRoot: string,
  relativePath?: string,
  answerId?: number,
  deps: CompareWithAnswerDeps = {},
): Promise<void> {
  const targetPath = relativePath ?? (await findFirstRelativeFile(path.join(taskRoot, 'workspace')));
  if (!targetPath) {
    throw new Error('No workspace file found to compare.');
  }

  const resolvedAnswerId = answerId ?? (await findFirstAnswerId(path.join(taskRoot, '_educoder', 'answer', 'unlocked')));
  if (!resolvedAnswerId) {
    throw new Error('No unlocked answer found to compare.');
  }

  const leftPath = path.join(taskRoot, 'workspace', targetPath);
  const rightPath = path.join(taskRoot, '_educoder', 'answer', 'unlocked', `answer-${resolvedAnswerId}.md`);
  const title = `Answer Compare: ${targetPath} ↔ answer-${resolvedAnswerId}`;

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

async function findFirstAnswerId(unlockedDir: string): Promise<number | undefined> {
  const entries = await readdir(unlockedDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const match = /^answer-(\d+)\.md$/i.exec(entry.name);
    if (match) {
      return Number(match[1]);
    }
  }

  return undefined;
}
