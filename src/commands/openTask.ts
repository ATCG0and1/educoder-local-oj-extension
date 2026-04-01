import { loadTaskStateModel, type TaskStateModel } from '../core/ui/stateModel.js';

export async function openTaskCommand(taskRoot: string): Promise<TaskStateModel> {
  return loadTaskStateModel(taskRoot);
}
