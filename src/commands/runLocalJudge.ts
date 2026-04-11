import * as vscode from 'vscode';
import { extractFirstCompileDiagnosticBlock } from '../core/judge/compileDiagnostics.js';
import { runLocalJudge } from '../core/judge/localRunner.js';
import type { LocalJudgeReport } from '../core/judge/resultStore.js';

interface JudgeFeedbackWindow {
  showInformationMessage(message: string): PromiseLike<unknown>;
  showErrorMessage(message: string): PromiseLike<unknown>;
}

interface SaveableWorkspaceLike {
  saveAll(includeUntitled?: boolean): Thenable<boolean> | Promise<boolean>;
}

export interface RunLocalJudgeCommandDeps {
  notify?: boolean;
  saveBeforeRun?: boolean;
  runLocalJudge?: typeof runLocalJudge;
  window?: JudgeFeedbackWindow;
  workspace?: SaveableWorkspaceLike;
}

export async function runLocalJudgeCommand(
  taskRoot: string,
  deps: RunLocalJudgeCommandDeps = {},
): Promise<LocalJudgeReport> {
  if (deps.saveBeforeRun !== false) {
    await ensureWorkspaceSaved(
      deps.workspace ?? (vscode.workspace as typeof vscode.workspace & SaveableWorkspaceLike),
      '保存当前代码失败，已停止本地测试。',
    );
  }

  const report = await (deps.runLocalJudge ?? runLocalJudge)({ taskRoot });

  if (deps.notify === true) {
    await notifyLocalJudgeResult(report, deps.window ?? vscode.window);
  }

  return report;
}

async function notifyLocalJudgeResult(
  report: LocalJudgeReport,
  window: JudgeFeedbackWindow,
): Promise<void> {
  if (report.compile.verdict === 'compile_error') {
    const diagnosticBlock =
      extractFirstCompileDiagnosticBlock(report.compile.stderr) ??
      extractFirstCompileDiagnosticBlock(report.compile.stdout);
    const detail =
      diagnosticBlock ??
      firstNonEmptyLine(report.compile.stderr) ??
      firstNonEmptyLine(report.compile.stdout) ??
      '请检查编译输出。';
    void window.showErrorMessage(
      diagnosticBlock
        ? ['本地结果：编译失败', detail].join('\n')
        : `本地结果：编译失败 · ${detail}`,
    );
    return;
  }

  if (report.summary.failed > 0) {
    const firstFailed = report.caseResults.find((item) => item.verdict !== 'passed');
    const failedLabel = firstFailed?.caseId
      ? `失败 ${firstFailed.caseId}（${report.summary.failed}/${report.summary.total}）`
      : `失败 ${report.summary.failed}/${report.summary.total}`;
    const guidance =
      firstFailed?.inputPath && firstFailed?.outputPath
        ? ' · 可直接查看失败输入/输出。'
        : ' · 请查看失败详情。';
    void window.showErrorMessage(`本地结果：${failedLabel}${guidance}`);
    return;
  }

  void window.showInformationMessage(`本地结果：通过 ${report.summary.passed}/${report.summary.total}`);
}

async function ensureWorkspaceSaved(
  workspace: SaveableWorkspaceLike,
  errorMessage: string,
): Promise<void> {
  const saved = await workspace.saveAll(false);
  if (!saved) {
    throw new Error(errorMessage);
  }
}

function firstNonEmptyLine(value?: string): string | undefined {
  return value
    ?.split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);
}
