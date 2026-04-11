import * as vscode from 'vscode';
import { loadTaskStateModel } from '../../core/ui/stateModel.js';
import { renderHome } from './renderHome.js';
import { renderTask } from './renderTask.js';
import type { TaskStateModel } from '../../core/ui/stateModel.js';

let activePanel: vscode.WebviewPanel | undefined;
let currentModel: DashboardPanelModel | undefined;

export interface DashboardPanelModel {
  totalTasks?: number;
  completedTasks?: number;
  task?: TaskStateModel;
  taskRoot?: string;
}

export interface DashboardCommandMessage {
  type: 'runCommand';
  command: string;
  taskRoot?: string;
}

export interface HandleDashboardMessageDeps {
  executeCommand: (command: string, taskRoot?: string) => PromiseLike<unknown>;
  refreshTask: (taskRoot: string) => Promise<void>;
}

export function openOrRevealDashboardPanel(model: DashboardPanelModel): vscode.WebviewPanel {
  currentModel = model;
  const column = vscode.ViewColumn.Active;
  const panel =
    activePanel ??
    vscode.window.createWebviewPanel('educoderLocalOj.dashboard', 'Educoder Local OJ', column, {
      enableScripts: true,
      retainContextWhenHidden: true,
    });

  if (!activePanel) {
    activePanel = panel;
    panel.onDidDispose(() => {
      activePanel = undefined;
      currentModel = undefined;
    });
    panel.webview.onDidReceiveMessage((message: DashboardCommandMessage | { type?: string }) =>
      handleDashboardMessage(message, {
        executeCommand: (command, taskRoot) => vscode.commands.executeCommand(command, taskRoot),
        refreshTask: async (taskRoot) => {
          const task = await loadTaskStateModel(taskRoot);
          currentModel = {
            ...currentModel,
            task,
            taskRoot,
          };
          panel.webview.html = renderDashboardHtml(currentModel);
        },
      }),
    );
  } else {
    panel.reveal(column);
  }

  const taskTitle = model.task?.displayTitle ?? model.task?.taskName;
  panel.title = taskTitle ? `题目工作台 - ${taskTitle}` : '题目工作台';
  panel.webview.html = renderDashboardHtml(model);
  return panel;
}

export async function handleDashboardMessage(
  message: DashboardCommandMessage | { type?: string },
  deps: HandleDashboardMessageDeps,
): Promise<void> {
  try {
    if (message.type !== 'runCommand' || !(message as DashboardCommandMessage).command) {
      return;
    }

    const payload = message as DashboardCommandMessage;
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Educoder Local OJ',
      },
      async () => deps.executeCommand(payload.command, payload.taskRoot),
    );
    if (payload.taskRoot) {
      await deps.refreshTask(payload.taskRoot);
    }
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    void vscode.window.showErrorMessage(messageText);
  }
}

function renderDashboardHtml(model: DashboardPanelModel | undefined): string {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Educoder Local OJ</title>
    <style>
      :root { color-scheme: light dark; }
      body {
        font-family: var(--vscode-font-family);
        background: var(--vscode-editor-background);
        color: var(--vscode-foreground);
        margin: 0;
        padding: 16px;
      }
      .home-card,.task-card {
        background: linear-gradient(180deg, color-mix(in srgb, var(--vscode-editorWidget-background) 92%, transparent), var(--vscode-editorWidget-background));
        border-radius: 18px;
        padding: 16px;
        margin-bottom: 16px;
        border: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
        box-shadow: 0 14px 36px rgba(0, 0, 0, 0.16);
      }
      .pill-row { display:flex; gap:8px; flex-wrap:wrap; margin-top:12px; }
      .pill { display:inline-flex; padding:5px 10px; border-radius:999px; background: color-mix(in srgb, var(--vscode-editor-background) 86%, transparent); border:1px solid color-mix(in srgb, var(--vscode-inputOption-activeBorder, var(--vscode-button-background)) 32%, transparent); font-size:12px; }
      .action-group { margin-top:16px; }
      .action-group h3 { margin:0 0 8px 0; font-size:14px; }
      .action-row { display:flex; gap:8px; flex-wrap:wrap; }
      .muted { color: var(--vscode-descriptionForeground); font-size: 12px; line-height: 1.6; }
      .task-card--compact .eyebrow { margin-bottom: 6px; }
      .task-card--compact h2 { margin: 0 0 6px 0; font-size: 18px; line-height: 1.35; }
      .summary-list {
        display: grid;
        gap: 8px;
        margin-top: 14px;
      }
      .summary-row {
        display: grid;
        grid-template-columns: 72px minmax(0, 1fr);
        gap: 4px 10px;
        padding: 10px 12px;
        border-radius: 12px;
        background: color-mix(in srgb, var(--vscode-editor-background) 88%, transparent);
        border: 1px solid color-mix(in srgb, var(--vscode-panel-border) 70%, transparent);
      }
      .summary-label {
        color: var(--vscode-descriptionForeground);
        font-size: 12px;
        align-self: center;
      }
      .summary-value {
        font-weight: 600;
        line-height: 1.5;
      }
      .summary-detail {
        grid-column: 2;
        color: var(--vscode-descriptionForeground);
        font-size: 12px;
        line-height: 1.5;
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
        gap: 8px;
        margin-top: 14px;
      }
      .text-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 12px;
        align-items: center;
      }
      .text-action {
        border: none;
        padding: 0;
        background: transparent;
        color: var(--vscode-textLink-foreground);
        cursor: pointer;
        font: inherit;
        font-size: 12px;
      }
      .text-action:hover { text-decoration: underline; }
      .text-action.disabled {
        color: var(--vscode-disabledForeground);
        cursor: not-allowed;
      }
      .action-button {
        padding: 8px 12px;
        border-radius: 10px;
        border: 1px solid color-mix(in srgb, var(--vscode-button-border, var(--vscode-contrastBorder)) 65%, transparent);
        background: color-mix(in srgb, var(--vscode-button-secondaryBackground, var(--vscode-editor-background)) 88%, transparent);
        color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
        cursor: pointer;
      }
      .action-button:hover { background: var(--vscode-button-secondaryHoverBackground, var(--vscode-list-hoverBackground)); }
      .action-button.primary {
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
      }
      .action-button.primary:hover { background: var(--vscode-button-hoverBackground); }
      .action-button:disabled { opacity:0.5; cursor:not-allowed; }
      .tips {
        margin-top: 12px;
        padding: 10px 12px;
        border-radius: 12px;
        background: color-mix(in srgb, var(--vscode-textBlockQuote-background, var(--vscode-editor-background)) 85%, transparent);
        border: 1px solid color-mix(in srgb, var(--vscode-button-background) 22%, transparent);
      }
    </style>
  </head>
  <body>
    ${renderHome({
      totalTasks: model?.totalTasks ?? 0,
      completedTasks: model?.completedTasks ?? 0,
    })}
    ${model?.task ? renderTask(model.task, model.taskRoot) : ''}
    <script>
      const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : undefined;
      document.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }
        const button = target.closest('[data-educoder-command]');
        if (!(button instanceof HTMLElement) || !vscode) {
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
