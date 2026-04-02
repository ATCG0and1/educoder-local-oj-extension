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

  panel.title = model.task?.taskName
    ? `Educoder Local OJ - ${model.task.taskName}`
    : 'Educoder Local OJ';
  panel.webview.html = renderDashboardHtml(model);
  return panel;
}

export async function handleDashboardMessage(
  message: DashboardCommandMessage | { type?: string },
  deps: HandleDashboardMessageDeps,
): Promise<void> {
  if (message.type !== 'runCommand' || !(message as DashboardCommandMessage).command) {
    return;
  }

  const payload = message as DashboardCommandMessage;
  await deps.executeCommand(payload.command, payload.taskRoot);
  if (payload.taskRoot) {
    await deps.refreshTask(payload.taskRoot);
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
      body { font-family: "Microsoft YaHei", sans-serif; background:#111827; color:#f9fafb; margin:0; padding:16px; }
      .home-card,.task-card { background:#1f2937; border-radius:12px; padding:16px; margin-bottom:16px; border:1px solid #374151; }
      .pill-row { display:flex; gap:8px; flex-wrap:wrap; margin-top:12px; }
      .pill { display:inline-flex; padding:4px 10px; border-radius:999px; background:#0f172a; border:1px solid #475569; font-size:12px; }
      .action-group { margin-top:16px; }
      .action-group h3 { margin:0 0 8px 0; font-size:14px; }
      .action-row { display:flex; gap:8px; flex-wrap:wrap; }
      .action-button { padding:6px 12px; border-radius:8px; border:1px solid #475569; background:#111827; color:#f9fafb; cursor:pointer; }
      .action-button:disabled { opacity:0.5; cursor:not-allowed; }
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
