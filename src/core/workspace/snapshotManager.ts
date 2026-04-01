import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

export async function restoreTemplateSnapshot(taskRoot: string): Promise<void> {
  await restoreWorkspaceFromSnapshot(
    path.join(taskRoot, '_educoder', 'template'),
    path.join(taskRoot, 'workspace'),
  );
}

export async function restorePassedSnapshot(taskRoot: string): Promise<void> {
  await restoreWorkspaceFromSnapshot(
    path.join(taskRoot, '_educoder', 'passed'),
    path.join(taskRoot, 'workspace'),
  );
}

async function restoreWorkspaceFromSnapshot(snapshotDir: string, workspaceDir: string): Promise<void> {
  await rm(workspaceDir, { recursive: true, force: true });
  await mkdir(workspaceDir, { recursive: true });
  await cp(snapshotDir, workspaceDir, { recursive: true, force: true });
}
