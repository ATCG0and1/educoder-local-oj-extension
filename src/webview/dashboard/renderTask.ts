import type { TaskStateModel } from '../../core/ui/stateModel.js';

export function renderTask(model: TaskStateModel): string {
  return `
    <section class="task-card">
      <h2>${model.taskName ?? model.taskId ?? '未选择任务'}</h2>
      <p>当前状态：${model.state}</p>
      <div class="pill-row">
        <span class="pill">readiness: ${model.readiness}</span>
        <span class="pill">hidden tests: ${model.hiddenTestsCached ? `ready (${model.localCaseCount})` : 'missing'}</span>
        <span class="pill">template: ${model.templateReady ? 'ready' : 'missing'}</span>
        <span class="pill">passed: ${model.passedReady ? 'ready' : 'missing'}</span>
        <span class="pill">answer: ${model.answerEntryCount}</span>
        <span class="pill">history: ${model.historyEntryCount}</span>
      </div>
    </section>
  `;
}
