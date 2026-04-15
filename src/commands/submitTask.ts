import * as vscode from 'vscode';
import { runLocalJudgeCommand } from './runLocalJudge.js';
import {
  runOfficialJudgeCommand,
  type RunOfficialJudgeCommandOptions,
} from './runOfficialJudge.js';
import type { LocalJudgeReport } from '../core/judge/resultStore.js';
import type {
  ExecuteRemoteJudgeInput,
  RemoteOfficialJudgeResult,
} from '../core/remote/officialJudge.js';
import type { OfficialJudgeReport } from '../core/remote/officialLogStore.js';
import { getDefaultOfficialJudgeExecutor } from '../core/remote/officialJudgeExecutor.js';
import { submitTaskFlow, type SubmitTaskReport } from '../core/remote/submitTaskFlow.js';

const CONTINUE_SUBMIT_LABEL = '继续提交';
const CANCEL_SUBMIT_LABEL = '取消';

export interface SubmitTaskCommandDeps {
  force?: boolean;
  runLocalJudge?: () => Promise<LocalJudgeReport>;
  runRemoteJudge?: (input: { force: boolean }) => Promise<OfficialJudgeReport>;
  executeRemoteJudge?: (
    input: ExecuteRemoteJudgeInput,
  ) => Promise<RemoteOfficialJudgeResult>;
  workspace?: {
    saveAll(includeUntitled?: boolean): PromiseLike<boolean> | Promise<boolean>;
  };
  window?: {
    showWarningMessage?(
      message: string,
      ...items: string[]
    ): PromiseLike<string | undefined> | Promise<string | undefined>;
    showInformationMessage(message: string): PromiseLike<unknown>;
    showErrorMessage(message: string): PromiseLike<unknown>;
  };
}

export async function submitTaskCommand(
  taskRoot: string,
  deps: SubmitTaskCommandDeps = {},
): Promise<SubmitTaskReport> {
  const saved = await (deps.workspace ?? vscode.workspace).saveAll(false);
  if (!saved) {
    throw new Error('保存当前代码失败，已停止提交评测。');
  }

  const window = deps.window ?? vscode.window;
  const runRemoteJudgeImpl =
    deps.runRemoteJudge ??
    ((options: { force: boolean }) =>
      runOfficialJudgeCommand(
        taskRoot,
        deps.executeRemoteJudge ?? getDefaultOfficialJudgeExecutor(),
        options as RunOfficialJudgeCommandOptions,
      ));

  const report = await submitTaskFlow({
    taskRoot,
    force: deps.force,
    runLocalJudge:
      deps.runLocalJudge ?? (() => runLocalJudgeCommand(taskRoot, { notify: false, saveBeforeRun: false })),
    confirmContinueAfterLocalFailure: deps.force
      ? undefined
      : (localReport) => confirmSubmitAfterLocalFailure(localReport, window),
    runRemoteJudge: () => runRemoteJudgeImpl({ force: true }),
  });

  await notifySubmitTaskResult(report, window);
  return report;
}

async function confirmSubmitAfterLocalFailure(
  localReport: LocalJudgeReport,
  window: {
    showWarningMessage?(
      message: string,
      ...items: string[]
    ): PromiseLike<string | undefined> | Promise<string | undefined>;
  },
): Promise<boolean> {
  if (!window.showWarningMessage) {
    return false;
  }

  const choice = await window.showWarningMessage(
    `本地测试未通过（${formatLocalFailureReason(localReport)}），仍要提交到头哥吗？`,
    CONTINUE_SUBMIT_LABEL,
    CANCEL_SUBMIT_LABEL,
  );
  return choice === CONTINUE_SUBMIT_LABEL;
}

async function notifySubmitTaskResult(
  report: SubmitTaskReport,
  window: {
    showInformationMessage(message: string): PromiseLike<unknown>;
    showErrorMessage(message: string): PromiseLike<unknown>;
  },
): Promise<void> {
  if (report.decision === 'stopped_after_local_failure') {
    void window.showErrorMessage(`本地测试未通过，未提交到头哥：${formatStoppedLocalFailureReason(report)}`);
    return;
  }

  const messageParts = [
    `${report.decision === 'force_submitted' ? '已强制提交到头哥' : '已提交到头哥'}：${formatRemoteJudgeHeadline(report)}`,
  ];
  if (report.remote.message) {
    messageParts.push(report.remote.message);
  }
  const messageText = messageParts.join(' · ');

  if (report.remote.verdict === 'passed') {
    void window.showInformationMessage(messageText);
    return;
  }

  void window.showErrorMessage(messageText);
}

function formatLocalFailureReason(localReport: LocalJudgeReport): string {
  return localReport.compile.verdict === 'compile_error'
    ? '编译失败'
    : `未通过 ${localReport.summary.passed}/${localReport.summary.total}`;
}

function formatStoppedLocalFailureReason(report: SubmitTaskReport): string {
  return report.local.compileVerdict === 'compile_error'
    ? '编译失败'
    : `未通过 ${report.local.passedCount ?? 0}/${report.local.total ?? 0}`;
}

function formatRemoteJudgeHeadline(report: SubmitTaskReport): string {
  const prefix = report.remote.verdict === 'passed' ? '已通过' : '未通过';
  if (
    typeof report.remote.passedCount === 'number' &&
    Number.isFinite(report.remote.passedCount) &&
    typeof report.remote.totalCount === 'number' &&
    Number.isFinite(report.remote.totalCount) &&
    report.remote.totalCount > 0
  ) {
    return `${prefix} ${report.remote.passedCount}/${report.remote.totalCount}`;
  }

  return prefix;
}
