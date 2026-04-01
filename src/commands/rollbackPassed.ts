import { restorePassedSnapshot } from '../core/workspace/snapshotManager.js';

export async function rollbackPassed(taskRoot: string): Promise<void> {
  await restorePassedSnapshot(taskRoot);
}
