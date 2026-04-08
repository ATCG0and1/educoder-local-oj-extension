import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as vscode from 'vscode';
import { normalizeSafeRelativeFilePath } from '../core/workspace/workspaceInit.js';
import { readAnswerInfo } from '../core/workspace/answerSurface.js';
import { resolveTaskPackagePaths } from '../core/workspace/taskPackageMigration.js';

export const ANSWER_COMPARE_REQUIRED_ERROR_MESSAGE =
  '未找到答案，请先同步答案后再执行答案对比。';

export interface CompareWithAnswerDeps {
  openDiff?: (leftPath: string, rightPath: string, title: string) => Promise<unknown>;
}

export async function compareWithAnswer(
  taskRoot: string,
  relativePath?: string,
  answerId?: number,
  deps: CompareWithAnswerDeps = {},
): Promise<void> {
  const resolvedPaths = await resolveTaskPackagePaths(taskRoot);
  const targetPath =
    (relativePath ? normalizeSafeRelativeFilePath(relativePath) : undefined) ??
    (await resolveDefaultComparePath(taskRoot, resolvedPaths.currentCodeDir));
  if (!targetPath) {
    throw new Error('No workspace file found to compare.');
  }

  const resolvedAnswerId =
    answerId ??
    (await resolveDefaultAnswerId(taskRoot, resolvedPaths.answersDir)) ??
    (await findFirstAnswerId(resolvedPaths.answersDir));
  if (!resolvedAnswerId) {
    throw new Error(ANSWER_COMPARE_REQUIRED_ERROR_MESSAGE);
  }

  const leftPath = path.join(resolvedPaths.currentCodeDir, targetPath);
  const unlockedPath = await resolveAnswerMarkdownPath(taskRoot, resolvedPaths.answersDir, resolvedAnswerId);
  await ensureFileExists(leftPath, 'No workspace file found to compare.');
  await ensureFileExists(unlockedPath, ANSWER_COMPARE_REQUIRED_ERROR_MESSAGE);
  const rightPath = await resolveAnswerComparePath(
    taskRoot,
    targetPath,
    resolvedAnswerId,
    unlockedPath,
  );
  const title = `Answer Compare: ${targetPath} ↔ answer-${resolvedAnswerId}`;

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

async function resolveDefaultAnswerId(taskRoot: string, answersDir: string): Promise<number | undefined> {
  const answerInfo = await readAnswerInfo<{ entries?: unknown }>(taskRoot, answersDir);
  const entries = answerInfo?.entries;
  if (!Array.isArray(entries)) {
    return undefined;
  }

  for (const entry of entries) {
    const answerId = typeof (entry as { answerId?: unknown }).answerId === 'number'
      ? (entry as { answerId: number }).answerId
      : undefined;
    if (!answerId) {
      continue;
    }

    try {
      await access(await resolveAnswerMarkdownPath(taskRoot, answersDir, answerId));
      return answerId;
    } catch {
      continue;
    }
  }

  return undefined;
}

export function extractFirstCodeBlock(markdown: string): string | undefined {
  const match = /```[^\r\n]*\r?\n([\s\S]*?)\r?\n```/.exec(markdown);
  return match?.[1];
}

async function resolveAnswerComparePath(
  taskRoot: string,
  relativePath: string,
  answerId: number,
  unlockedPath: string,
): Promise<string> {
  const markdown = await readFile(unlockedPath, 'utf8');
  const extracted = extractFirstCodeBlock(markdown);
  if (!extracted) {
    return unlockedPath;
  }

  const extension = path.extname(relativePath) || '.txt';
  const extractedDir = path.join(taskRoot, '_educoder', 'answers', 'extracted');
  const extractedPath = path.join(extractedDir, `answer-${answerId}${extension}`);
  await mkdir(extractedDir, { recursive: true });
  await writeFile(extractedPath, `${extracted}\n`, 'utf8');
  return extractedPath;
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
  const entries = await import('node:fs/promises').then(({ readdir }) =>
    readdir(rootDir, { withFileTypes: true }),
  );
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

async function findFirstAnswerId(unlockedDir: string): Promise<number | undefined> {
  try {
    const entries = await import('node:fs/promises').then(({ readdir }) =>
      readdir(unlockedDir, { withFileTypes: true }),
    );
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => /^answer-(\d+)\.md$/i.exec(entry.name))
      .filter((match): match is RegExpExecArray => Boolean(match))
      .map((match) => Number(match[1]))
      .sort((left, right) => left - right)[0];
  } catch {
    return undefined;
  }
}

async function resolveAnswerMarkdownPath(
  taskRoot: string,
  answersDir: string,
  answerId: number,
): Promise<string> {
  const candidates = [
    path.join(answersDir, `answer-${answerId}.md`),
    path.join(answersDir, 'unlocked', `answer-${answerId}.md`),
    path.join(taskRoot, '_educoder', 'answer', 'unlocked', `answer-${answerId}.md`),
  ];

  for (const candidatePath of candidates) {
    try {
      await access(candidatePath);
      return candidatePath;
    } catch {
      continue;
    }
  }

  return candidates[0];
}
