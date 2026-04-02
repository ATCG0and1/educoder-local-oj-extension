import { ensurePassedSnapshot, type EnsurePassedSnapshotDeps } from '../core/recovery/ensureRecoverySnapshot.js';
import { restorePassedSnapshot } from '../core/workspace/snapshotManager.js';

export async function rollbackPassed(
  taskRoot: string,
  deps: EnsurePassedSnapshotDeps = {},
): Promise<void> {
  await ensurePassedSnapshot(taskRoot, deps);
  await restorePassedSnapshot(taskRoot);
}
