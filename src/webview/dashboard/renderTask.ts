import type { TaskStateModel } from '../../core/ui/stateModel.js';

export function renderTask(model: TaskStateModel): string {
  return `
    <section class="task-card">
      <h2>${model.taskName ?? model.taskId ?? '未选择任务'}</h2>
      <p>当前状态：${model.state}</p>
    </section>
  `;
}
