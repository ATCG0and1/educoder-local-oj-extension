import {
  runOfficialJudgeBridge,
  type ExecuteRemoteJudgeInput,
  type RemoteOfficialJudgeResult,
} from '../core/remote/officialJudge.js';
import type { OfficialJudgeReport } from '../core/remote/officialLogStore.js';

export async function forceRunOfficialJudgeCommand(
  taskRoot: string,
  executeRemoteJudge: (
    input: ExecuteRemoteJudgeInput,
  ) => Promise<RemoteOfficialJudgeResult> = defaultRemoteJudgeExecutor,
): Promise<OfficialJudgeReport> {
  return runOfficialJudgeBridge({
    taskRoot,
    force: true,
    executeRemoteJudge,
  });
}

async function defaultRemoteJudgeExecutor(): Promise<RemoteOfficialJudgeResult> {
  throw new Error('Official judge executor is not configured.');
}
