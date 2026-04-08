import {
  runOfficialJudgeBridge,
  type ExecuteRemoteJudgeInput,
  type RemoteOfficialJudgeResult,
} from '../core/remote/officialJudge.js';
import { getDefaultOfficialJudgeExecutor } from '../core/remote/officialJudgeExecutor.js';
import type { OfficialJudgeReport } from '../core/remote/officialLogStore.js';

export interface RunOfficialJudgeCommandOptions {
  force?: boolean;
}

export async function runOfficialJudgeCommand(
  taskRoot: string,
  executeRemoteJudge: (
    input: ExecuteRemoteJudgeInput,
  ) => Promise<RemoteOfficialJudgeResult> = getDefaultOfficialJudgeExecutor(),
  options: RunOfficialJudgeCommandOptions = {},
): Promise<OfficialJudgeReport> {
  return runOfficialJudgeBridge({
    taskRoot,
    force: options.force,
    executeRemoteJudge,
  });
}
