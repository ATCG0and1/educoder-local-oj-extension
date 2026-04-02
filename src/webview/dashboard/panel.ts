import * as vscode from 'vscode';
import type { TaskStateModel } from '../../core/ui/stateModel.js';
import { renderHome } from './renderHome.js';
import { renderTask } from './renderTask.js';

let activePanel: vscode.WebviewPanel | undefined;

export interface DashboardPanelModel {
  totalTasks?: number;
  completedTasks?: number;
  task?: TaskStateModel;
}

export function openOrRevealDashboardPanel(model: DashboardPanelModel): vscode.WebviewPanel {
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
    });
  } else {
    panel.reveal(column);
  }

  panel.title = model.task?.taskName
    ? `Educoder Local OJ - ${model.task.taskName}`
    : 'Educoder Local OJ';
  panel.webview.html = renderDashboardHtml(model);
  return panel;
}

function renderDashboardHtml(model: DashboardPanelModel): string {
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
      .action-group ul { margin:0; padding-left:18px; color:#cbd5e1; }
      .action-group li { margin:4px 0; }
    </style>
  </head>
  <body>
    ${renderHome({
      totalTasks: model.totalTasks ?? 0,
      completedTasks: model.completedTasks ?? 0,
    })}
    ${model.task ? renderTask(model.task) : ''}
  </body>
</html>`;
}
