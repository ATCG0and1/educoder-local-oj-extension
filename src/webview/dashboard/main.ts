import { renderHome } from './renderHome.js';
import { renderTask } from './renderTask.js';
import type { TaskStateModel } from '../../core/ui/stateModel.js';

declare global {
  interface Window {
    __EDUCODER_DASHBOARD_MODEL__?: {
      totalTasks?: number;
      completedTasks?: number;
      task?: TaskStateModel;
    };
  }
}

const root = globalThis.document?.getElementById('app');
const model = globalThis.window?.__EDUCODER_DASHBOARD_MODEL__;

if (root) {
  root.innerHTML = `
    ${renderHome({
      totalTasks: model?.totalTasks ?? 0,
      completedTasks: model?.completedTasks ?? 0,
    })}
    ${model?.task ? renderTask(model.task) : ''}
  `;
}
