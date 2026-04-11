import * as vscode from 'vscode';
import { loadTaskStateModel, type TaskStateModel } from '../../core/ui/stateModel.js';
import { renderTask } from './renderTask.js';

export const DASHBOARD_SIDEBAR_VIEW_ID = 'educoderLocalOj.sidebar';

export interface DashboardSidebarCommandMessage {
  type: 'runCommand';
  command: string;
  taskRoot?: string;
}

export interface DashboardSidebarRefreshMessage {
  type: 'refresh';
}

export interface DashboardSidebarDeps {
  executeCommand?: (command: string, taskRoot?: string) => PromiseLike<unknown>;
  loadTaskModel?: (taskRoot: string) => Promise<TaskStateModel | undefined>;
}

export class DashboardSidebarProvider implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | undefined;
  private currentTaskRoot: string | undefined;
  private currentTask: TaskStateModel | undefined;

  constructor(private readonly deps: DashboardSidebarDeps = {}) {}

  async resolveWebviewView(view: vscode.WebviewView): Promise<void> {
    this.view = view;
    view.webview.options = {
      enableScripts: true,
    };
    view.webview.onDidReceiveMessage((message: DashboardSidebarCommandMessage | DashboardSidebarRefreshMessage) =>
      this.handleMessage(message),
    );
    this.render();
  }

  async showTask(taskRoot?: string): Promise<void> {
    this.currentTaskRoot = taskRoot;
    this.currentTask = taskRoot ? await this.safeLoadTask(taskRoot) : undefined;
    this.render();
  }

  async refresh(): Promise<void> {
    await this.showTask(this.currentTaskRoot);
  }

  private async handleMessage(
    message: DashboardSidebarCommandMessage | DashboardSidebarRefreshMessage | { type?: string },
  ): Promise<void> {
    try {
      if (message.type === 'refresh') {
        await this.refresh();
        return;
      }

      if (message.type !== 'runCommand' || !(message as DashboardSidebarCommandMessage).command) {
        return;
      }

      const payload = message as DashboardSidebarCommandMessage;
      const result = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Educoder Local OJ',
        },
        async () =>
          (this.deps.executeCommand ?? defaultExecuteCommand)(
            payload.command,
            payload.taskRoot,
          ),
      );
      await this.showTask(resolveTaskRootFromCommandResult(payload, result, this.currentTaskRoot));
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error);
      void vscode.window.showErrorMessage(messageText);
    }
  }

  private async safeLoadTask(taskRoot: string): Promise<TaskStateModel | undefined> {
    try {
      return await (this.deps.loadTaskModel ?? loadTaskStateModel)(taskRoot);
    } catch {
      return undefined;
    }
  }

  private render(): void {
    if (!this.view) {
      return;
    }

    this.view.webview.html = renderSidebarHtml({
      task: this.currentTask,
      taskRoot: this.currentTaskRoot,
    });
  }
}

async function defaultExecuteCommand(command: string, taskRoot?: string): Promise<unknown> {
  return vscode.commands.executeCommand(command, taskRoot);
}

function resolveTaskRootFromCommandResult(
  payload: DashboardSidebarCommandMessage,
  result: unknown,
  currentTaskRoot?: string,
): string | undefined {
  if (payload.taskRoot) {
    return payload.taskRoot;
  }

  if (
    typeof result === 'object' &&
    result !== null &&
    'taskRoot' in result &&
    typeof (result as { taskRoot?: unknown }).taskRoot === 'string'
  ) {
    return (result as { taskRoot: string }).taskRoot;
  }

  if (
    typeof result === 'object' &&
    result !== null &&
    'firstTask' in result &&
    typeof (result as { firstTask?: { taskRoot?: unknown } }).firstTask?.taskRoot === 'string'
  ) {
    return (result as { firstTask: { taskRoot: string } }).firstTask.taskRoot;
  }

  return currentTaskRoot;
}

function renderSidebarHtml(model: {
  task?: TaskStateModel;
  taskRoot?: string;
}): string {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Educoder Local OJ</title>
    <style>
      :root {
        color-scheme: light dark;
      }
      body {
        font-family: var(--vscode-font-family);
        background: var(--vscode-sideBar-background);
        color: var(--vscode-foreground);
        margin: 0;
        padding: 12px;
      }
      .stack { display:flex; flex-direction:column; gap:12px; }
      .card {
        background: linear-gradient(180deg, color-mix(in srgb, var(--vscode-editorWidget-background) 92%, transparent), var(--vscode-editorWidget-background));
        border-radius: 18px;
        padding: 16px;
        border: 1px solid var(--vscode-widget-border, var(--vscode-sideBarSectionHeader-border));
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.16);
      }
      .hero {
        background:
          radial-gradient(circle at top right, color-mix(in srgb, var(--vscode-button-background) 28%, transparent), transparent 42%),
          linear-gradient(180deg, color-mix(in srgb, var(--vscode-editorWidget-background) 90%, transparent), var(--vscode-editorWidget-background));
      }
      .eyebrow {
        font-size: 11px;
        letter-spacing: 0.06em;
        color: var(--vscode-descriptionForeground);
        margin-bottom: 6px;
      }
      h1, h2 { margin: 0 0 8px 0; line-height: 1.25; text-wrap: balance; }
      h1 {
        font-size: 20px;
        letter-spacing: -0.02em;
      }
      .muted {
        color: var(--vscode-descriptionForeground);
        font-size: 12px;
        line-height: 1.7;
        margin: 0;
      }
      .action-row { display:flex; gap:8px; flex-wrap:wrap; margin-top:12px; }
      .action-button {
        min-height: 38px;
        padding: 8px 12px;
        border-radius: 12px;
        border: 1px solid color-mix(in srgb, var(--vscode-button-border, var(--vscode-contrastBorder)) 65%, transparent);
        background: color-mix(in srgb, var(--vscode-button-secondaryBackground, var(--vscode-editor-background)) 88%, transparent);
        color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
        cursor: pointer;
        transition: transform .12s ease, background .12s ease, border-color .12s ease;
        font: inherit;
      }
      .action-button:hover {
        transform: translateY(-1px);
        background: var(--vscode-button-secondaryHoverBackground, var(--vscode-list-hoverBackground));
      }
      .action-button.primary {
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border-color: color-mix(in srgb, var(--vscode-button-background) 70%, transparent);
      }
      .action-button.primary:hover {
        background: var(--vscode-button-hoverBackground);
      }
      .tips {
        margin-top: 12px;
        padding: 10px 12px;
        border-radius: 12px;
        background: color-mix(in srgb, var(--vscode-textBlockQuote-background, var(--vscode-editor-background)) 85%, transparent);
        border: 1px solid color-mix(in srgb, var(--vscode-button-background) 22%, transparent);
      }
      .task-card--compact .eyebrow { margin-bottom: 8px; }
      .task-card--compact h2 {
        margin: 0;
        font-size: clamp(18px, 3.2vw, 24px);
        line-height: 1.2;
        letter-spacing: -0.03em;
      }
      .task-status {
        margin: 14px 0 0 0;
        color: var(--vscode-foreground);
        font-size: 13px;
        line-height: 1.6;
      }
      .summary-list {
        display: grid;
        gap: 10px;
        margin-top: 16px;
      }
      .summary-row {
        display: grid;
        grid-template-columns: 76px minmax(0, 1fr);
        gap: 4px 12px;
        padding: 12px 14px;
        border-radius: 14px;
        background:
          linear-gradient(180deg, color-mix(in srgb, var(--vscode-editor-background) 90%, transparent), color-mix(in srgb, var(--vscode-editor-background) 82%, transparent));
        border: 1px solid color-mix(in srgb, var(--vscode-panel-border) 72%, transparent);
      }
      .summary-label {
        color: var(--vscode-descriptionForeground);
        font-size: 12px;
        line-height: 1.6;
        align-self: start;
      }
      .summary-value {
        font-weight: 600;
        line-height: 1.45;
      }
      .summary-detail {
        grid-column: 2;
        color: var(--vscode-descriptionForeground);
        font-size: 12px;
        line-height: 1.6;
        white-space: pre-wrap;
        word-break: break-word;
      }
      .tone-success .summary-value { color: var(--vscode-testing-iconPassed, var(--vscode-terminal-ansiGreen)); }
      .tone-error .summary-value { color: var(--vscode-testing-iconFailed, var(--vscode-errorForeground)); }
      .tone-warning .summary-value { color: var(--vscode-testing-iconQueued, var(--vscode-terminal-ansiYellow)); }
      .tone-muted .summary-value { color: var(--vscode-descriptionForeground); }
      .action-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
        margin-top: 16px;
      }
      .action-grid .action-button {
        width: 100%;
        justify-content: center;
      }
      .text-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        align-items: center;
        margin-top: 14px;
      }
      .text-action {
        border: none;
        padding: 0;
        background: transparent;
        color: var(--vscode-textLink-foreground);
        cursor: pointer;
        font: inherit;
        font-size: 12px;
        line-height: 1.6;
      }
      .text-action:hover {
        text-decoration: underline;
        text-underline-offset: 0.12em;
      }
      .text-action.disabled {
        color: var(--vscode-disabledForeground);
        cursor: not-allowed;
      }
    </style>
  </head>
  <body>
    <div class="stack">
      <section class="card hero">
        <div class="eyebrow">Educoder Local OJ</div>
        <h1>题目工作台</h1>
        <p class="muted">粘贴头哥章节链接后，一键同步本章全部题目包并自动打开第一题；随后直接在 VS Code 里看题、写代码、跑测试。</p>
        <div class="action-row">
          <button class="action-button primary" data-educoder-command="educoderLocalOj.syncCollectionPackages">一键同步本章</button>
          <button class="action-button" data-educoder-command="educoderLocalOj.selectRootFolder">更换存放目录</button>
          <button class="action-button" data-educoder-command="educoderLocalOj.openTask">选择/打开题目</button>
        </div>
        <div class="tips">
          <p class="muted">首次点击会自动询问存放目录；之后可以随时点击“更换存放目录”切换位置。</p>
        </div>
      </section>
      ${model.task ? renderTask(model.task, model.taskRoot) : renderEmptyTaskHint()}
    </div>
    <script>
      const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : undefined;
      document.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement) || !vscode) {
          return;
        }
        const button = target.closest('[data-educoder-command]');
        if (!(button instanceof HTMLElement)) {
          return;
        }
        vscode.postMessage({
          type: 'runCommand',
          command: button.dataset.educoderCommand,
          taskRoot: button.dataset.taskRoot,
        });
      });
    </script>
  </body>
</html>`;
}

function renderEmptyTaskHint(): string {
  return `
    <section class="card">
      <h2>当前未打开题目</h2>
      <p class="muted">
        先粘贴章节链接，再点击“一键同步本章”；同步完成后会自动定位首题，你也可以随时点“选择/打开题目”切回当前做题上下文。
      </p>
    </section>
  `;
}
