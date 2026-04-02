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
        <span class="pill">answer unlocked: ${model.unlockedAnswerCount}</span>
        <span class="pill">repo: ${model.repositoryReady ? `ready (${model.repositoryFileCount} files)` : 'missing'}</span>
        <span class="pill">history: ${model.historyEntryCount}</span>
      </div>
      <div class="action-group">
        <h3>Learning Actions</h3>
        <ul>
          <li>Sync Full Repository</li>
          <li>Sync Answers</li>
          <li>Compare With Template</li>
          <li>Compare With Answer</li>
        </ul>
      </div>
    </section>
  `;
}
