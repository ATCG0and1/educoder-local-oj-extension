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

  const report = await submitTaskFlow({
    taskRoot,
    force: deps.force,
    runLocalJudge:
      deps.runLocalJudge ?? (() => runLocalJudgeCommand(taskRoot, { notify: false, saveBeforeRun: false })),
    runRemoteJudge:
      deps.runRemoteJudge ??
      ((options) =>
        runOfficialJudgeCommand(
          taskRoot,
          deps.executeRemoteJudge ?? getDefaultOfficialJudgeExecutor(),
          options as RunOfficialJudgeCommandOptions,
        )),
  });

  await notifySubmitTaskResult(report, deps.window ?? vscode.window);
  return report;
}

async function notifySubmitTaskResult(
  report: SubmitTaskReport,
  window: {
    showInformationMessage(message: string): PromiseLike<unknown>;
    showErrorMessage(message: string): PromiseLike<unknown>;
  },
): Promise<void> {
  if (report.decision === 'stopped_after_local_failure') {
    const reason =
      report.local.compileVerdict === 'compile_error'
        ? '编译失败'
        : `未通过 ${report.local.passedCount ?? 0}/${report.local.total ?? 0}`;
    await window.showErrorMessage(`本地测试未通过，未提交到头哥：${reason}`);
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
    await window.showInformationMessage(messageText);
    return;
  }

  await window.showErrorMessage(messageText);
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
