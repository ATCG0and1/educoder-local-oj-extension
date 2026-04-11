import { describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { handleDashboardMessage, openOrRevealDashboardPanel } from '../../src/webview/dashboard/panel.js';

describe('dashboard panel message handling', () => {
  it('renders the compact solving card with inline summaries and primary actions', () => {
    const panel = openOrRevealDashboardPanel({
      totalTasks: 10,
      completedTasks: 3,
      taskRoot: 'C:/task-root',
      task: {
        taskId: 'fc7pz3fm6yjh',
        taskName: '第1关 基本实训：链表操作',
        displayTitle: '1 · 第1关 基本实训：链表操作',
        state: '已同步',
        solveState: '作答中',
        availableStates: ['未开始', '作答中'],
        readiness: 'local_ready',
        hiddenTestsCached: true,
        localCaseCount: 4,
        materials: {
          statement: 'ready',
          template: 'ready',
          currentCode: 'ready',
          tests: 'ready',
          answers: 'missing',
          metadata: 'ready',
        },
        templateReady: true,
        passedReady: false,
        answerEntryCount: 0,
        unlockedAnswerCount: 0,
        repositoryReady: false,
        repositoryFileCount: 0,
        historyEntryCount: 2,
        officialJudge: {
          verdict: 'failed',
          headline: '未通过',
          detail: '等待下一次提交',
        },
      },
    });

    expect(panel.title).toContain('题目工作台');
    expect(panel.title).toContain('1 · 第1关 基本实训：链表操作');
    expect(panel.webview.html).toContain('做题状态：作答中');
    expect(panel.webview.html).toContain('头哥结果');
    expect(panel.webview.html).toContain('未通过');
    expect(panel.webview.html).toContain('本地结果');
    expect(panel.webview.html).toContain('未运行');
    expect(panel.webview.html).toContain('打开题面');
    expect(panel.webview.html).toContain('打开代码');
    expect(panel.webview.html).toContain('运行测试');
    expect(panel.webview.html).toContain('提交评测');
    expect(panel.webview.html).toContain('测试集');
    expect(panel.webview.html).toContain('打开答案');
    expect(panel.webview.html).not.toContain('资料完整度');
    expect(panel.webview.html).not.toContain('题面：已就绪');
    expect(panel.webview.html).not.toContain('答案：缺失');
    panel.dispose();
  });

  it('executes the requested command and refreshes the task model when taskRoot is provided', async () => {
    const executeCommand = vi.fn(async () => undefined);
    const refreshTask = vi.fn(async () => undefined);

    await handleDashboardMessage(
      {
        type: 'runCommand',
        command: 'educoderLocalOj.syncTaskAnswers',
        taskRoot: 'C:/task-root',
      },
      {
        executeCommand,
        refreshTask,
      },
    );

    expect(executeCommand).toHaveBeenCalledWith('educoderLocalOj.syncTaskAnswers', 'C:/task-root');
    expect(refreshTask).toHaveBeenCalledWith('C:/task-root');
  });

  it('ignores unknown messages', async () => {
    const executeCommand = vi.fn(async () => undefined);
    const refreshTask = vi.fn(async () => undefined);

    await handleDashboardMessage({ type: 'noop' }, { executeCommand, refreshTask });

    expect(executeCommand).not.toHaveBeenCalled();
    expect(refreshTask).not.toHaveBeenCalled();
  });

  it('shows progress and a visible error when command execution fails', async () => {
    const vscodeMock = (vscode as any).__mock;
    const executeCommand = vi.fn(async () => {
      throw new Error('请登录后再操作');
    });
    const refreshTask = vi.fn(async () => undefined);

    await handleDashboardMessage(
      {
        type: 'runCommand',
        command: 'educoderLocalOj.syncTaskAnswers',
        taskRoot: 'C:/task-root',
      },
      {
        executeCommand,
        refreshTask,
      },
    );

    expect(vscodeMock.withProgress).toHaveBeenCalled();
    expect(vscodeMock.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('请登录后再操作'),
    );
    expect(refreshTask).not.toHaveBeenCalled();
  });
});
