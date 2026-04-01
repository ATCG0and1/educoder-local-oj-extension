import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

export interface CompileWorkspaceInput {
  workspaceDir: string;
  compilerPath?: string;
  outputName?: string;
  extraArgs?: string[];
}

export interface CompileWorkspaceResult {
  success: boolean;
  executablePath?: string;
  stdout: string;
  stderr: string;
}

export async function compileWorkspace(
  input: CompileWorkspaceInput,
): Promise<CompileWorkspaceResult> {
  const sourceFiles = await collectSourceFiles(input.workspaceDir);

  if (sourceFiles.length === 0) {
    return {
      success: false,
      stdout: '',
      stderr: 'No C++ source files found in workspace.',
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
  };
}

async function collectSourceFiles(rootDir: string): Promise<string[]> {
  const entries = await readdir(rootDir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const targetPath = path.join(rootDir, entry.name);

      if (entry.isDirectory()) {
        return collectSourceFiles(targetPath);
      }

      return entry.name.endsWith('.cpp') ? [targetPath] : [];
    }),
  );

  return files.flat().sort((left, right) => left.localeCompare(right));
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
