import { access, cp } from 'node:fs/promises';
import path from 'node:path';
import type { TaskLayoutPaths } from './directoryLayout.js';
import { ensureWorkspaceDirectories } from './workspaceInit.js';

export interface ResolvedTaskPackagePaths {
  currentCodeDir: string;
  currentCodeSource: 'canonical' | 'legacy' | 'missing';
  hiddenTestsDir: string;
  hiddenTestsSource: 'canonical' | 'legacy' | 'missing';
  answersDir: string;
  answersSource: 'canonical' | 'legacy' | 'missing';
}

export async function resolveTaskPackagePaths(taskRoot: string): Promise<ResolvedTaskPackagePaths> {
  const canonicalCurrentCodeDir = path.join(taskRoot, 'code', 'current');
  const legacyWorkspaceDir = path.join(taskRoot, 'workspace');
  const canonicalHiddenTestsDir = path.join(taskRoot, '_educoder', 'tests', 'hidden');
  const legacyHiddenTestsDir = path.join(taskRoot, 'tests', 'hidden');
  const canonicalAnswersDir = path.join(taskRoot, 'answers');
  const legacyAnswersDir = path.join(taskRoot, '_educoder', 'answer');

  const [hasCanonicalCurrent, hasLegacyCurrent, hasCanonicalHidden, hasLegacyHidden, hasCanonicalAnswers, hasLegacyAnswers] =
    await Promise.all([
      pathExists(canonicalCurrentCodeDir),
      pathExists(legacyWorkspaceDir),
      pathExists(canonicalHiddenTestsDir),
      pathExists(legacyHiddenTestsDir),
      pathExists(canonicalAnswersDir),
      pathExists(legacyAnswersDir),
    ]);

  return {
    currentCodeDir: hasCanonicalCurrent ? canonicalCurrentCodeDir : legacyWorkspaceDir,
    currentCodeSource: hasCanonicalCurrent ? 'canonical' : hasLegacyCurrent ? 'legacy' : 'missing',
    hiddenTestsDir: hasCanonicalHidden ? canonicalHiddenTestsDir : legacyHiddenTestsDir,
    hiddenTestsSource: hasCanonicalHidden ? 'canonical' : hasLegacyHidden ? 'legacy' : 'missing',
    answersDir: hasCanonicalAnswers ? canonicalAnswersDir : legacyAnswersDir,
    answersSource: hasCanonicalAnswers ? 'canonical' : hasLegacyAnswers ? 'legacy' : 'missing',
  };
}

export async function ensureCanonicalTaskPackageSurface(layout: TaskLayoutPaths): Promise<void> {
  await ensureWorkspaceDirectories(
    layout.problemDir,
    layout.currentCodeDir,
    layout.templateCodeDir,
    layout.passedCodeDir,
    layout.allTestsDir,
    layout.hiddenTestsDir,
    layout.answersDir,
    layout.internalAnswersDir,
    layout.metaDir,
    layout.rawDir,
    layout.logsDir,
    layout.historyDir,
    layout.repositoryRemoteDir,
    layout.reportsDir,
    layout.vscodeDir,
  );
}

export async function migrateLegacyWorkspaceToCurrentCode(layout: TaskLayoutPaths): Promise<void> {
  if ((await pathExists(layout.currentCodeDir)) || !(await pathExists(layout.legacyWorkspaceDir))) {
    return;
  }

  await ensureWorkspaceDirectories(layout.currentCodeDir);
  await cp(layout.legacyWorkspaceDir, layout.currentCodeDir, { recursive: true });
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}
