import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { RepositoryNode } from '../api/repositoryFetchClient.js';
import type { WorkspaceFile } from '../workspace/workspaceInit.js';
import { assertSafeWorkspaceFilePaths, writeWorkspaceFiles } from '../workspace/workspaceInit.js';

export interface RepositoryMetadata {
  ready: boolean;
  fileCount: number;
  updatedAt: string;
}

export interface WriteRepositorySnapshotInput {
  nodes: RepositoryNode[];
  files: WorkspaceFile[];
  updatedAt?: string;
}

export async function writeRepositorySnapshot(
  taskRoot: string,
  input: WriteRepositorySnapshotInput,
): Promise<void> {
  const repositoryDir = path.join(taskRoot, '_educoder', 'repository');
  const repositoryRemoteDir = path.join(repositoryDir, 'remote');
  const metadata: RepositoryMetadata = {
    ready: input.files.length > 0,
    fileCount: input.files.length,
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  };

  assertSafeWorkspaceFilePaths(repositoryRemoteDir, input.files);

  await rm(repositoryRemoteDir, { recursive: true, force: true });

  await Promise.all([
    mkdir(repositoryDir, { recursive: true }),
    writeWorkspaceFiles(repositoryRemoteDir, input.files),
    writeJson(path.join(repositoryDir, 'tree.json'), input.nodes),
    writeJson(
      path.join(repositoryDir, 'index.json'),
      {
        fileCount: input.files.length,
        files: input.files.map((file) => file.path),
        updatedAt: metadata.updatedAt,
      },
    ),
    writeJson(path.join(taskRoot, '_educoder', 'meta', 'repository.json'), metadata),
  ]);
}

export async function readRepositoryMetadata(taskRoot: string): Promise<RepositoryMetadata | undefined> {
  try {
    return JSON.parse(
      await readFile(path.join(taskRoot, '_educoder', 'meta', 'repository.json'), 'utf8'),
    ) as RepositoryMetadata;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined;
    }

    throw error;
  }
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}
