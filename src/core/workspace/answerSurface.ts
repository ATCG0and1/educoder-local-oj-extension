import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const IGNORED_ANSWER_FILE_NAMES = new Set(['index.md', 'answer_info.json']);

export function getInternalAnswersDir(taskRoot: string): string {
  return path.join(taskRoot, '_educoder', 'answers');
}

export function getCanonicalAnswerInfoPath(taskRoot: string): string {
  return path.join(getInternalAnswersDir(taskRoot), 'answer_info.json');
}

export function getAnswerInfoCandidatePaths(taskRoot: string, answersDir: string): string[] {
  return [
    getCanonicalAnswerInfoPath(taskRoot),
    path.join(answersDir, 'answer_info.json'),
    path.join(taskRoot, '_educoder', 'answer', 'answer_info.json'),
  ];
}

export async function readAnswerEntryCount(taskRoot: string, answersDir: string): Promise<number> {
  const parsed = await readAnswerInfo<{ entries?: unknown }>(taskRoot, answersDir);
  return Array.isArray(parsed?.entries) ? parsed.entries.length : 0;
}

export async function readAnswerInfo<T>(
  taskRoot: string,
  answersDir: string,
): Promise<T | undefined> {
  for (const candidatePath of getAnswerInfoCandidatePaths(taskRoot, answersDir)) {
    try {
      return JSON.parse(await readFile(candidatePath, 'utf8')) as T;
    } catch {
      continue;
    }
  }

  return undefined;
}

export async function hasAnswerFiles(answerDir: string): Promise<boolean> {
  return Boolean(await findFirstAnswerFilePath(answerDir));
}

export async function findFirstAnswerFilePath(answerDir: string): Promise<string | undefined> {
  try {
    const entries = await readdir(answerDir, { withFileTypes: true });
    const sortedEntries = entries.slice().sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of sortedEntries) {
      const candidatePath = path.join(answerDir, entry.name);
      if (entry.isFile() && !IGNORED_ANSWER_FILE_NAMES.has(entry.name)) {
        return candidatePath;
      }

      if (entry.isDirectory()) {
        const nestedPath = await findFirstAnswerFilePath(candidatePath);
        if (nestedPath) {
          return nestedPath;
        }
      }
    }
  } catch {
    return undefined;
  }

  return undefined;
}
