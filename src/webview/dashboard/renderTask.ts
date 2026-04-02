import type { TaskStateModel } from '../../core/ui/stateModel.js';

export function renderTask(model: TaskStateModel, taskRoot?: string): string {
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
        <div class="action-row">
          ${renderActionButton('Sync Full Repository', 'educoderLocalOj.syncTaskRepository', taskRoot)}
          ${renderActionButton('Sync Answers', 'educoderLocalOj.syncTaskAnswers', taskRoot)}
          ${renderActionButton('Compare With Template', 'educoderLocalOj.compareWithTemplate', taskRoot)}
          ${renderActionButton('Compare With Answer', 'educoderLocalOj.compareWithAnswer', taskRoot)}
        </div>
      </div>
    </section>
  `;
}

function renderActionButton(label: string, command: string, taskRoot?: string): string {
  if (!taskRoot) {
    return `<button class="action-button" disabled>${label}</button>`;
  }

  return `<button class="action-button" data-educoder-command="${escapeAttribute(command)}" data-task-root="${escapeAttribute(taskRoot)}">${label}</button>`;
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
