import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';

export const TEMPLATE_SNAPSHOT_REQUIRED_ERROR_MESSAGE =
  '模板快照为空，请先同步模板后再执行回滚。';
export const PASSED_SNAPSHOT_REQUIRED_ERROR_MESSAGE =
  '通关快照为空，请先同步通过代码后再执行回滚。';

export async function restoreTemplateSnapshot(taskRoot: string): Promise<void> {
  await ensureSnapshotHasFiles(
    path.join(taskRoot, '_educoder', 'template'),
    TEMPLATE_SNAPSHOT_REQUIRED_ERROR_MESSAGE,
  );
  await restoreWorkspaceFromSnapshot(
    path.join(taskRoot, '_educoder', 'template'),
    path.join(taskRoot, 'code', 'current'),
  );
}

export async function restorePassedSnapshot(taskRoot: string): Promise<void> {
  await ensureSnapshotHasFiles(
    path.join(taskRoot, '_educoder', 'passed'),
    PASSED_SNAPSHOT_REQUIRED_ERROR_MESSAGE,
  );
  await restoreWorkspaceFromSnapshot(
    path.join(taskRoot, '_educoder', 'passed'),
    path.join(taskRoot, 'code', 'current'),
  );
}

async function restoreWorkspaceFromSnapshot(snapshotDir: string, workspaceDir: string): Promise<void> {
  await mkdir(workspaceDir, { recursive: true });
  await cp(snapshotDir, workspaceDir, { recursive: true, force: true });
}

async function ensureSnapshotHasFiles(snapshotDir: string, errorMessage: string): Promise<void> {
  if (!(await hasFiles(snapshotDir))) {
    throw new Error(errorMessage);
  }
}

async function hasFiles(targetDir: string): Promise<boolean> {
  try {
    const { readdir } = await import('node:fs/promises');
    const entries = await readdir(targetDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        return true;
      }

      if (entry.isDirectory() && (await hasFiles(path.join(targetDir, entry.name)))) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}
