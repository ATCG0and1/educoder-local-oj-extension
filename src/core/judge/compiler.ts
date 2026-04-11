import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { normalizeSafeRelativeFilePath } from '../workspace/workspaceInit.js';

export interface CompileWorkspaceInput {
  workspaceDir: string;
  compilerPath?: string;
  outputName?: string;
  extraArgs?: string[];
  preferredSourcePaths?: string[];
  compileScopes?: string[];
}

export interface CompileWorkspaceResult {
  success: boolean;
  executablePath?: string;
  stdout: string;
  stderr: string;
  sourceFiles?: string[];
}

export async function compileWorkspace(
  input: CompileWorkspaceInput,
): Promise<CompileWorkspaceResult> {
  const sourcePlan = await resolveCompileSourcePlan(input);
  const sourceFiles = sourcePlan.orderedRelativeSourceFiles;

  if (sourceFiles.length === 0) {
    return {
      success: false,
      stdout: '',
      stderr: 'No C++ source files found in workspace.',
      sourceFiles: [],
    };
  }

  const executablePath = path.join(input.workspaceDir, input.outputName ?? 'app.exe');
  const args = [
    '-std=c++17',
    '-g',
    ...(input.extraArgs ?? []),
    ...sourceFiles,
    '-o',
    executablePath,
  ];

  const runResult = await spawnAndCapture(input.compilerPath ?? 'g++', args, input.workspaceDir);

  return {
    success: runResult.exitCode === 0,
    executablePath: runResult.exitCode === 0 ? executablePath : undefined,
    stdout: runResult.stdout,
    stderr: runResult.stderr,
    sourceFiles,
  };
}

export async function resolveCompileSourcePlan(input: Pick<
  CompileWorkspaceInput,
  'workspaceDir' | 'preferredSourcePaths' | 'compileScopes'
>): Promise<{
  orderedRelativeSourceFiles: string[];
  orderedAbsoluteSourceFiles: string[];
}> {
  const allRelativeSourceFiles = await collectRelativeSourceFiles(input.workspaceDir, input.workspaceDir);
  const scopedSourceFiles = filterSourceFilesByScopes(allRelativeSourceFiles, input.compileScopes);
  const compileSourceFiles =
    scopedSourceFiles.length > 0 ? scopedSourceFiles : allRelativeSourceFiles;
  const orderedRelativeSourceFiles = orderSourceFiles(compileSourceFiles, input.preferredSourcePaths);

  return {
    orderedRelativeSourceFiles,
    orderedAbsoluteSourceFiles: orderedRelativeSourceFiles.map((relativePath) =>
      path.join(input.workspaceDir, relativePath),
    ),
  };
}

async function collectRelativeSourceFiles(rootDir: string, currentDir: string): Promise<string[]> {
  const entries = await readdir(currentDir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const targetPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        return collectRelativeSourceFiles(rootDir, targetPath);
      }

      return entry.name.endsWith('.cpp')
        ? [path.relative(rootDir, targetPath).replaceAll('\\', '/')]
        : [];
    }),
  );

  return files.flat().sort((left, right) => left.localeCompare(right));
}

function filterSourceFilesByScopes(relativeSourceFiles: string[], compileScopes?: string[]): string[] {
  const normalizedScopes = (compileScopes ?? [])
    .map((scope) => normalizeCompileScope(scope))
    .filter((scope, index, scopes): scope is string => scope !== undefined && scopes.indexOf(scope) === index);

  if (normalizedScopes.length === 0) {
    return [];
  }

  if (normalizedScopes.includes('')) {
    return relativeSourceFiles;
  }

  return relativeSourceFiles.filter((relativePath) =>
    normalizedScopes.some((scope) => relativePath === scope || relativePath.startsWith(`${scope}/`)),
  );
}

function orderSourceFiles(relativeSourceFiles: string[], preferredSourcePaths?: string[]): string[] {
  const existing = new Set(relativeSourceFiles);
  const preferredCppPaths = (preferredSourcePaths ?? [])
    .map((item) => normalizePreferredSourcePath(item))
    .filter((item, index, items): item is string => item !== undefined && items.indexOf(item) === index)
    .filter((item) => item.endsWith('.cpp') && existing.has(item));

  return [
    ...preferredCppPaths,
    ...relativeSourceFiles.filter((item) => !preferredCppPaths.includes(item)),
  ];
}

function normalizePreferredSourcePath(value: string): string | undefined {
  try {
    return normalizeSafeRelativeFilePath(value);
  } catch {
    return undefined;
  }
}

function normalizeCompileScope(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '.') {
    return '';
  }

  try {
    return normalizeSafeRelativeFilePath(trimmed);
  } catch {
    return undefined;
  }
}

interface SpawnResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

function spawnAndCapture(command: string, args: string[], cwd: string): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (exitCode) => {
      resolve({
        exitCode,
        stdout,
        stderr,
      });
    });
  });
}
