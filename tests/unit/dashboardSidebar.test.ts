import { describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { DashboardSidebarProvider } from '../../src/webview/dashboard/sidebar.js';

function createMockView() {
  let messageListener: ((message: unknown) => void) | undefined;
  return {
    webview: {
      html: '',
      options: {},
      onDidReceiveMessage: (listener: (message: unknown) => void) => {
        messageListener = listener;
        return { dispose: vi.fn() };
      },
    },
    __dispatchMessage: (message: unknown) => {
      return messageListener?.(message);
    },
  };
}

describe('dashboard sidebar provider', () => {
  it('renders the global launcher actions in empty state', async () => {
    const provider = new DashboardSidebarProvider({
      executeCommand: async () => undefined,
      loadTaskModel: async () => undefined,
    });
    const view = createMockView();

    await provider.resolveWebviewView(view as never);

    expect(view.webview.html).toContain('一键同步本章');
    expect(view.webview.html).not.toContain('同步章节目录');
    expect(view.webview.html).toContain('更换存放目录');
    expect(view.webview.html).toContain('打开当前题目');
    expect(view.webview.html).toContain('刷新状态');
    expect(view.webview.html).toContain('粘贴头哥章节链接后，一键同步本章全部题目包并自动打开第一题');
  });

  it('refreshes into task state after open-task style command result returns a task root', async () => {
    const executeCommand = vi.fn(async () => ({
      taskRoot: 'C:/task-root',
      value: undefined,
    }));
    const loadTaskModel = vi.fn(async () => ({
      taskId: 'fc7pz3fm6yjh',
      taskName: '第1关 基本实训：链表操作',
      state: '已同步' as const,
      availableStates: ['已同步'] as const,
      readiness: 'missing_workspace' as const,
      hiddenTestsCached: false,
      localCaseCount: 0,
      templateReady: false,
      passedReady: false,
      answerEntryCount: 0,
      unlockedAnswerCount: 0,
      repositoryReady: false,
      repositoryFileCount: 0,
      historyEntryCount: 0,
    }));
    const provider = new DashboardSidebarProvider({
      executeCommand,
      loadTaskModel,
    });
    const view = createMockView();

    await provider.resolveWebviewView(view as never);
    await view.__dispatchMessage({
      type: 'runCommand',
      command: 'educoderLocalOj.openTask',
    });

    expect(executeCommand).toHaveBeenCalledWith('educoderLocalOj.openTask', undefined);
    expect(loadTaskModel).toHaveBeenCalledWith('C:/task-root');
    expect(view.webview.html).toContain('第1关 基本实训：链表操作');
  });

  it('uses the first synced task as current context after syncing a collection', async () => {
    const executeCommand = vi.fn(async () => ({
      collectionRoot: 'C:/collection-root',
      manifest: { homeworks: [] },
      firstTask: {
        taskRoot: 'C:/task-root',
      },
    }));
    const loadTaskModel = vi.fn(async () => ({
      taskId: 'fc7pz3fm6yjh',
      taskName: '第1关 基本实训：链表操作',
      state: '已同步' as const,
      availableStates: ['已同步'] as const,
      readiness: 'missing_workspace' as const,
      hiddenTestsCached: false,
      localCaseCount: 0,
      templateReady: false,
      passedReady: false,
      answerEntryCount: 0,
      unlockedAnswerCount: 0,
      repositoryReady: false,
      repositoryFileCount: 0,
      historyEntryCount: 0,
    }));
    const provider = new DashboardSidebarProvider({
      executeCommand,
      loadTaskModel,
    });
    const view = createMockView();

    await provider.resolveWebviewView(view as never);
    await view.__dispatchMessage({
      type: 'runCommand',
      command: 'educoderLocalOj.syncCollectionPackages',
    });

    expect(executeCommand).toHaveBeenCalledWith('educoderLocalOj.syncCollectionPackages', undefined);
    expect(loadTaskModel).toHaveBeenCalledWith('C:/task-root');
    expect(view.webview.html).toContain('第1关 基本实训：链表操作');
  });

  it('shows an error message instead of failing silently when command execution rejects', async () => {
    const vscodeMock = (vscode as any).__mock;
    const provider = new DashboardSidebarProvider({
      executeCommand: async () => {
        throw new Error('请登录后再操作');
      },
      loadTaskModel: async () => undefined,
    });
    const view = createMockView();

    await provider.resolveWebviewView(view as never);
    await view.__dispatchMessage({
      type: 'runCommand',
      command: 'educoderLocalOj.syncCollectionPackages',
    });

    expect(vscodeMock.withProgress).toHaveBeenCalled();
    expect(vscodeMock.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('请登录后再操作'),
    );
  });
});
