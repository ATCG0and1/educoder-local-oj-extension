import type { TaskMaterialsState, TaskMaterialState, TaskStateModel } from '../../core/ui/stateModel.js';

export function renderTask(model: TaskStateModel, taskRoot?: string): string {
  const taskTitle = escapeHtml(model.taskName ?? model.taskId ?? '未选择任务');
  const solveState = escapeHtml(model.solveState ?? model.state);
  const taskPath = taskRoot ? escapeHtml(taskRoot.replaceAll('\\', '/')) : '';
  const materials = resolveTaskMaterials(model);
  const localTests = escapeHtml(
    model.hiddenTestsCached ? `已缓存（${model.localCaseCount}）` : '未缓存',
  );
  const repositoryStatus = escapeHtml(
    model.repositoryReady ? `已同步（${model.repositoryFileCount} files）` : '未同步',
  );

  return `
    <section class="task-card">
      <div class="eyebrow">Current Task</div>
      <h2>${taskTitle}</h2>
      <p>做题状态：${solveState}</p>
      ${taskPath ? `<p class="muted">本地目录：<code>${taskPath}</code></p>` : ''}
      <div class="action-group">
        <h3>状态概览</h3>
        <div class="pill-row">
          <span class="pill">本地测试：${localTests}</span>
          <span class="pill">历史记录：${model.historyEntryCount}</span>
          <span class="pill">已解锁答案：${model.unlockedAnswerCount}</span>
          <span class="pill">远端仓库：${repositoryStatus}</span>
        </div>
      </div>
      <div class="action-group">
        <h3>资料完整度</h3>
        <div class="pill-row">
          ${renderMaterialPill('题面', materials.statement)}
          ${renderMaterialPill('模板', materials.template)}
          ${renderMaterialPill('当前代码', materials.currentCode)}
          ${renderMaterialPill('测试', materials.tests)}
          ${renderMaterialPill('答案', materials.answers)}
          ${renderMaterialPill('元数据', materials.metadata)}
        </div>
      </div>
      <div class="action-group">
        <h3>开始做题</h3>
        <div class="action-row">
          ${renderActionButton('打开当前题目', 'educoderLocalOj.openTask', taskRoot, 'primary')}
          ${renderActionButton('拉全题目资料', 'educoderLocalOj.syncTaskPackage', taskRoot, 'primary')}
          ${renderActionButton('打开题面', 'educoderLocalOj.openTaskStatement', taskRoot)}
          ${renderActionButton('打开当前代码', 'educoderLocalOj.openCurrentCode', taskRoot)}
          ${renderActionButton('运行本地测试', 'educoderLocalOj.runLocalJudge', taskRoot)}
          ${renderActionButton('提交评测（本地 + 头哥）', 'educoderLocalOj.submitTask', taskRoot, 'primary')}
        </div>
      </div>
      <div class="action-group">
        <h3>答案与解析</h3>
        <div class="action-row">
          ${renderActionButton('同步答案', 'educoderLocalOj.syncTaskAnswers', taskRoot)}
          ${renderActionButton('对比答案', 'educoderLocalOj.compareWithAnswer', taskRoot)}
        </div>
      </div>
      <div class="action-group">
        <h3>进阶工具</h3>
        <div class="action-row">
          ${renderActionButton('强制提交到头哥', 'educoderLocalOj.forceRunOfficialJudge', taskRoot)}
          ${renderActionButton('仅提交到头哥（高级）', 'educoderLocalOj.runOfficialJudge', taskRoot)}
          ${renderActionButton('同步远端仓库（高级）', 'educoderLocalOj.syncTaskRepository', taskRoot)}
          ${renderActionButton('对比模板', 'educoderLocalOj.compareWithTemplate', taskRoot)}
        </div>
      </div>
    </section>
  `;
}

function resolveTaskMaterials(model: TaskStateModel): TaskMaterialsState {
  return model.materials ?? {
    statement: 'missing',
    template: model.templateReady ? 'ready' : 'missing',
    currentCode: model.readiness === 'missing_workspace' ? 'missing' : 'ready',
    tests: model.hiddenTestsCached ? 'ready' : 'missing',
    answers: model.answerEntryCount > 0 ? 'ready' : 'missing',
    metadata: 'missing',
  };
}

function renderMaterialPill(label: string, state: TaskMaterialState): string {
  return `<span class="pill">${escapeHtml(label)}：${escapeHtml(renderMaterialState(state))}</span>`;
}

function renderMaterialState(state: TaskMaterialState): string {
  switch (state) {
    case 'ready':
      return '已就绪';
    case 'unavailable':
      return '不可获取';
    case 'failed':
      return '同步失败';
    case 'missing':
    default:
      return '缺失';
  }
}

function renderActionButton(
  label: string,
  command: string,
  taskRoot?: string,
  tone: 'default' | 'primary' = 'default',
): string {
  if (!taskRoot) {
    return `<button class="action-button" disabled>${escapeHtml(label)}</button>`;
  }

  const className = tone === 'primary' ? 'action-button primary' : 'action-button';
  return `<button class="${className}" data-educoder-command="${escapeAttribute(command)}" data-task-root="${escapeAttribute(taskRoot)}">${escapeHtml(label)}</button>`;
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/'/g, '&#39;');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
