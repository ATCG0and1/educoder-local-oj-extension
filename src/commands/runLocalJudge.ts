import { runLocalJudge } from '../core/judge/localRunner.js';
import type { LocalJudgeReport } from '../core/judge/resultStore.js';

export async function runLocalJudgeCommand(taskRoot: string): Promise<LocalJudgeReport> {
  return runLocalJudge({ taskRoot });
}
