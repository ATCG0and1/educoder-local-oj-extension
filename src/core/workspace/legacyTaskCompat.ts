import { access, cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getCanonicalAnswerInfoPath, getInternalAnswersDir } from './answerSurface.js';

export interface LegacyTaskCompatResult {
  migratedCurrentCode: boolean;
  migratedHiddenTests: boolean;
  migratedAllTests: boolean;
  migratedAnswers: boolean;
}

export async function applyLegacyTaskCompat(taskRoot: string): Promise<LegacyTaskCompatResult> {
  const migratedAnswers = await migrateAnswersToCanonicalSurface(taskRoot);

  return {
    migratedCurrentCode: await copyDirIfTargetMissingOrEmpty(
      path.join(taskRoot, 'workspace'),
      path.join(taskRoot, 'code', 'current'),
    ),
    migratedHiddenTests: await copyDirIfTargetMissingOrEmpty(
      path.join(taskRoot, '_educoder', 'tests', 'hidden'),
      path.join(taskRoot, 'tests', 'hidden'),
    ),
    migratedAllTests: await copyDirIfTargetMissingOrEmpty(
      path.join(taskRoot, '_educoder', 'tests', 'hidden'),
      path.join(taskRoot, 'tests', 'all'),
    ),
    migratedAnswers,
  };
}

async function copyDirIfTargetMissingOrEmpty(sourceDir: string, targetDir: string): Promise<boolean> {
  if (!(await pathExists(sourceDir))) {
    return false;
  }

  if (await dirHasEntries(targetDir)) {
    return false;
  }

  await mkdir(path.dirname(targetDir), { recursive: true });
  await cp(sourceDir, targetDir, { recursive: true });
  return true;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function dirHasEntries(targetPath: string): Promise<boolean> {
  try {
    const entries = await readdir(targetPath, { withFileTypes: true });
    return entries.length > 0;
  } catch {
    return false;
  }
}

async function migrateAnswersToCanonicalSurface(taskRoot: string): Promise<boolean> {
  const canonicalAnswersDir = path.join(taskRoot, 'answers');
  const legacyAnswerDir = path.join(taskRoot, '_educoder', 'answer');
  const legacyUnlockedDir = path.join(legacyAnswerDir, 'unlocked');
  const canonicalUnlockedDir = path.join(canonicalAnswersDir, 'unlocked');
  const internalAnswersDir = getInternalAnswersDir(taskRoot);
  const canonicalAnswerInfoPath = getCanonicalAnswerInfoPath(taskRoot);

  let migrated = false;

  if ((await collectDirectAnswerFiles(canonicalAnswersDir)).length === 0) {
    const legacyAnswerFiles = await collectAnswerFiles(legacyUnlockedDir);
    const canonicalAnswerFiles = await collectAnswerFiles(canonicalUnlockedDir);
    const sourceFiles = legacyAnswerFiles.length > 0 ? legacyAnswerFiles : canonicalAnswerFiles;

    if (sourceFiles.length > 0) {
      await mkdir(canonicalAnswersDir, { recursive: true });
      await Promise.all(
        sourceFiles.map((file) =>
          cp(file, path.join(canonicalAnswersDir, path.basename(file)), { force: false }),
        ),
      );
      migrated = true;
    }
  }

  if (!(await pathExists(canonicalAnswerInfoPath))) {
    const answerInfoCandidates = [
      path.join(canonicalAnswersDir, 'answer_info.json'),
      path.join(legacyAnswerDir, 'answer_info.json'),
    ];

    for (const candidatePath of answerInfoCandidates) {
      if (!(await pathExists(candidatePath))) {
        continue;
      }

      await mkdir(internalAnswersDir, { recursive: true });
      await writeFile(canonicalAnswerInfoPath, await readFile(candidatePath, 'utf8'), 'utf8');
      migrated = true;
      break;
    }
  }

  if (await pathExists(canonicalUnlockedDir)) {
    await rm(canonicalUnlockedDir, { recursive: true, force: true });
  }

  if (await pathExists(path.join(canonicalAnswersDir, 'answer_info.json'))) {
    await rm(path.join(canonicalAnswersDir, 'answer_info.json'), { force: true });
  }

  return migrated;
}

async function collectAnswerFiles(rootDir: string): Promise<string[]> {
  try {
    const entries = await readdir(rootDir, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      const fullPath = path.join(rootDir, entry.name);
      if (entry.isFile() && /^answer-\d+\.md$/i.test(entry.name)) {
        files.push(fullPath);
      }

      if (entry.isDirectory()) {
        files.push(...(await collectAnswerFiles(fullPath)));
      }
    }

    return files.sort((left, right) => left.localeCompare(right));
  } catch {
    return [];
  }
}

async function collectDirectAnswerFiles(rootDir: string): Promise<string[]> {
  try {
    const entries = await readdir(rootDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && /^answer-\d+\.md$/i.test(entry.name))
      .map((entry) => path.join(rootDir, entry.name))
      .sort((left, right) => left.localeCompare(right));
  } catch {
    return [];
  }
}
