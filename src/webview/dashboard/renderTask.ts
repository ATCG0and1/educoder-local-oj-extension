import type { TaskOfficialJudgeSummary, TaskStateModel } from '../../core/ui/stateModel.js';

export function renderTask(model: TaskStateModel, taskRoot?: string): string {
  const taskTitle = escapeHtml(model.displayTitle ?? model.taskName ?? model.taskId ?? '未选择任务');
  const solveState = escapeHtml(model.solveState ?? model.state);
  const officialSummary = formatOfficialJudgeSummary(model);
  const localSummary = formatLocalJudgeSummary(model);

  return `
    <section class="task-card task-card--compact">
      <div class="eyebrow">当前题目</div>
      <h2>${taskTitle}</h2>
      <p class="task-status">做题状态：${solveState}</p>
      <div class="summary-list">
        ${renderSummaryRow('头哥结果', officialSummary.headline, officialSummary.tone, officialSummary.detail)}
        ${renderSummaryRow('本地结果', localSummary.headline, localSummary.tone, localSummary.detail)}
      </div>
      <div class="action-grid">
        ${renderActionButton('打开题面', 'educoderLocalOj.openTaskStatement', taskRoot)}
        ${renderActionButton('打开代码', 'educoderLocalOj.openCurrentCode', taskRoot)}
        ${renderActionButton('运行测试', 'educoderLocalOj.runLocalJudge', taskRoot)}
        ${renderActionButton('提交评测', 'educoderLocalOj.submitTask', taskRoot, 'primary')}
      </div>
      <div class="text-actions" aria-label="做题资料">
        ${renderTextAction('测试集', 'educoderLocalOj.openTaskTests', taskRoot)}
        ${model.materials?.answers === 'ready'
          ? renderTextAction('打开答案', 'educoderLocalOj.openTaskAnswers', taskRoot)
          : renderTextAction('完整同步答案（可能影响评分）', 'educoderLocalOj.syncTaskAnswers', taskRoot)}
        ${model.localJudge?.compileVerdict === 'compile_error'
          ? renderTextAction('完整报错', 'educoderLocalOj.openLatestCompileError', taskRoot)
          : ''}
        ${model.localJudge?.failureInputPath
          ? renderTextAction('失败输入', 'educoderLocalOj.openLatestFailureInput', taskRoot)
          : ''}
        ${model.localJudge?.failureOutputPath
          ? renderTextAction('失败输出', 'educoderLocalOj.openLatestFailureOutput', taskRoot)
          : ''}
      </div>
    </section>
  `;
}

function formatLocalJudgeSummary(model: TaskStateModel): {
  headline: string;
  detail?: string;
  tone: 'success' | 'error' | 'warning' | 'muted';
} {
  if (!model.localJudge) {
    return {
      headline: '未运行',
      tone: 'muted',
    };
  }

  if (model.localJudge.compileVerdict === 'compile_error') {
    return {
      headline: '编译失败',
      detail: model.localJudge.detail,
      tone: 'error',
    };
  }

  if (model.localJudge.failed > 0) {
    return {
      headline: `失败 ${model.localJudge.failed}/${model.localJudge.total} · ${model.localJudge.headline ?? '请检查失败用例'}`,
      detail: model.localJudge.detail,
      tone: 'error',
    };
  }

  return {
    headline: `通过 ${model.localJudge.passed}/${model.localJudge.total}`,
    detail: model.localJudge.detail,
    tone: 'success',
  };
}

function renderSummaryRow(
  label: string,
  value: string,
  tone: 'success' | 'error' | 'warning' | 'muted',
  detail?: string,
): string {
  const detailHtml = detail ? `<span class="summary-detail">${escapeHtml(detail)}</span>` : '';
  return `
    <div class="summary-row tone-${tone}">
      <span class="summary-label">${escapeHtml(label)}</span>
      <span class="summary-value">${escapeHtml(value)}</span>
      ${detailHtml}
    </div>
  `;
}

function renderTextAction(label: string, command: string, taskRoot?: string): string {
  if (!taskRoot) {
    return `<span class="text-action disabled">${escapeHtml(label)}</span>`;
  }

  return `<button class="text-action" data-educoder-command="${escapeAttribute(command)}" data-task-root="${escapeAttribute(taskRoot)}">${escapeHtml(label)}</button>`;
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

function formatOfficialJudgeSummary(
  model: TaskStateModel,
): {
  headline: string;
  detail?: string;
  tone: 'success' | 'error' | 'warning' | 'muted';
} {
  const officialJudge = model.officialJudge;
  if (!officialJudge) {
    if (
      model.localJudge &&
      (model.localJudge.compileVerdict === 'compile_error' || model.localJudge.failed > 0)
    ) {
      return {
        headline: '未提交',
        detail: '本地未通过，仍可提交到头哥（会二次确认）',
        tone: 'warning',
      };
    }

    if (
      model.localJudge &&
      model.localJudge.compileVerdict === 'compiled' &&
      model.localJudge.total > 0 &&
      model.localJudge.failed === 0
    ) {
      return {
        headline: '待提交',
        detail: '本地已通过，可提交到头哥',
        tone: 'warning',
      };
    }

    return {
      headline: '未提交',
      tone: 'muted',
    };
  }

  return {
    headline: officialJudge.headline,
    detail: officialJudge.detail,
    tone: officialJudge.verdict === 'passed' ? 'success' : 'warning',
  };
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
