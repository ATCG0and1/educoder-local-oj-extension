import { ensureTemplateSnapshot, type EnsureTemplateSnapshotDeps } from '../core/recovery/ensureRecoverySnapshot.js';
import { restoreTemplateSnapshot } from '../core/workspace/snapshotManager.js';

export async function rollbackTemplate(
  taskRoot: string,
  deps: EnsureTemplateSnapshotDeps = {},
): Promise<void> {
  await ensureTemplateSnapshot(taskRoot, deps);
  await restoreTemplateSnapshot(taskRoot);
}
