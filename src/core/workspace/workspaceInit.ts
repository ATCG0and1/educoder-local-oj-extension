import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface WorkspaceFile {
  path: string;
  content: string;
}

export const UNSAFE_RELATIVE_FILE_PATH_ERROR_MESSAGE = 'Unsafe relative file path';

export async function writeWorkspaceFiles(rootDir: string, files: WorkspaceFile[]): Promise<void> {
  const preparedFiles = files.map((file) => ({
    content: file.content,
    targetPath: resolveSafeWorkspaceFileTarget(rootDir, file.path),
  }));

  await ensureWorkspaceDirectories(rootDir);

  for (const file of preparedFiles) {
    await ensureWorkspaceDirectories(path.dirname(file.targetPath));
    await writeFile(file.targetPath, file.content, 'utf8');
  }
}

export async function ensureWorkspaceDirectories(...dirs: string[]): Promise<void> {
  await Promise.all(dirs.map((dir) => mkdir(dir, { recursive: true })));
}

export function assertSafeWorkspaceFilePaths(rootDir: string, files: WorkspaceFile[]): void {
  for (const file of files) {
    resolveSafeWorkspaceFileTarget(rootDir, file.path);
  }
}

function resolveSafeWorkspaceFileTarget(rootDir: string, relativePath: string): string {
  const normalizedPath = normalizeSafeRelativeFilePath(relativePath);
  const resolvedRoot = path.resolve(rootDir);
  const targetPath = path.resolve(resolvedRoot, ...normalizedPath.split('/'));
  const relativeToRoot = path.relative(resolvedRoot, targetPath);

  if (
    relativeToRoot.startsWith('..') ||
    path.isAbsolute(relativeToRoot) ||
    relativeToRoot.length === 0
  ) {
    throw new Error(`${UNSAFE_RELATIVE_FILE_PATH_ERROR_MESSAGE}: ${relativePath}`);
  }

  return targetPath;
}

export function normalizeSafeRelativeFilePath(relativePath: string): string {
  const trimmedPath = relativePath.trim();
  const normalizedPath = trimmedPath.replaceAll('\\', '/');

  if (
    !trimmedPath ||
    normalizedPath.startsWith('/') ||
    /^[A-Za-z]:/.test(trimmedPath)
  ) {
    throw new Error(`${UNSAFE_RELATIVE_FILE_PATH_ERROR_MESSAGE}: ${relativePath}`);
  }

  const segments = normalizedPath.split('/').filter(Boolean);
  if (
    segments.length === 0 ||
    segments.some((segment) => segment === '.' || segment === '..')
  ) {
    throw new Error(`${UNSAFE_RELATIVE_FILE_PATH_ERROR_MESSAGE}: ${relativePath}`);
  }

  return segments.join('/');
}
