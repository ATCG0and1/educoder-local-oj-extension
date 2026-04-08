import type { ProblemFetchClientLike, ProblemMaterial } from '../api/problemFetchClient.js';
import type { TaskDetailSummary } from '../api/taskDetailClient.js';
import { writeProblemMaterial } from '../recovery/problemMaterialStore.js';
import type { TaskLayoutPaths } from '../workspace/directoryLayout.js';

export interface SyncProblemStatementInput {
  layout: TaskLayoutPaths;
  taskId: string;
  homeworkId?: string;
  taskName?: string;
  detail?: TaskDetailSummary;
  problemClient?: ProblemFetchClientLike;
}

export async function syncProblemStatement(
  input: SyncProblemStatementInput,
): Promise<ProblemMaterial | undefined> {
  const material =
    input.detail?.problemMaterial ??
    (input.problemClient
      ? await input.problemClient.fetchProblemMaterial({
          taskId: input.taskId,
          homeworkId: input.homeworkId,
          taskName: input.taskName,
        })
      : undefined);

  if (!material) {
    return undefined;
  }

  await writeProblemMaterial(input.layout, material);
  return material;
}
