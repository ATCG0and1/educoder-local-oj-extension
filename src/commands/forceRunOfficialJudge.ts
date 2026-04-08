import {
  submitTaskCommand,
  type SubmitTaskCommandDeps,
} from './submitTask.js';

export async function forceRunOfficialJudgeCommand(
  taskRoot: string,
  deps: Omit<SubmitTaskCommandDeps, 'force'> = {},
) {
  return submitTaskCommand(taskRoot, {
    ...deps,
    force: true,
  });
}
