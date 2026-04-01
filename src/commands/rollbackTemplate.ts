import { restoreTemplateSnapshot } from '../core/workspace/snapshotManager.js';

export async function rollbackTemplate(taskRoot: string): Promise<void> {
  await restoreTemplateSnapshot(taskRoot);
}
