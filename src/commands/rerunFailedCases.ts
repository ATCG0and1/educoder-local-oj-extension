import { runLocalJudge } from '../core/judge/localRunner.js';
import { readLocalJudgeReport, type LocalJudgeReport } from '../core/judge/resultStore.js';

export async function rerunFailedCases(taskRoot: string): Promise<LocalJudgeReport> {
  const lastReport = await readLocalJudgeReport(taskRoot);

  return runLocalJudge({
    taskRoot,
    rerunFailedOnly: true,
    lastReport,
  });
}
