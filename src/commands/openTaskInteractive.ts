import {
  getProductRoot,
  type RootResolverDeps,
  type WindowLike,
} from '../core/config/rootResolver.js';
import { listLocalTaskEntries } from '../core/catalog/localTaskCatalog.js';

export const OPEN_TASK_PICK_PLACEHOLDER = '选择要打开的题目';
export const NO_SYNCED_TASK_FOUND_ERROR_MESSAGE =
  'No synced task found. Run Sync Current Collection first.';

export interface TaskQuickPickItem {
  label: string;
  description?: string;
  detail?: string;
  taskRoot: string;
}

export interface OpenTaskInteractiveWindow extends WindowLike {
  showQuickPick<T extends TaskQuickPickItem>(
    items: readonly T[] | PromiseLike<readonly T[]>,
    options: {
      placeHolder: string;
      matchOnDescription: boolean;
      matchOnDetail: boolean;
    },
  ): PromiseLike<T | undefined> | T | undefined;
}

export interface OpenTaskInteractiveDeps<T> extends RootResolverDeps {
  window: OpenTaskInteractiveWindow;
  openTask: (taskRoot: string) => Promise<T>;
}

export interface OpenTaskInteractiveResult<T> {
  taskRoot: string;
  value: T;
}

export async function openTaskInteractive<T>(
  deps: OpenTaskInteractiveDeps<T>,
): Promise<OpenTaskInteractiveResult<T> | undefined> {
  const productRoot = await getProductRoot(deps);
  const items = await discoverTaskQuickPickItems(productRoot);

  if (items.length === 0) {
    throw new Error(NO_SYNCED_TASK_FOUND_ERROR_MESSAGE);
  }

  const picked = await deps.window.showQuickPick(items, {
    placeHolder: OPEN_TASK_PICK_PLACEHOLDER,
    matchOnDescription: true,
    matchOnDetail: true,
  });

  if (!picked) {
    return undefined;
  }

  return {
    taskRoot: picked.taskRoot,
    value: await deps.openTask(picked.taskRoot),
  };
}

async function discoverTaskQuickPickItems(productRoot: string): Promise<TaskQuickPickItem[]> {
  const tasks = await listLocalTaskEntries(productRoot);
  return tasks
    .map((task) => ({
      label: task.name,
      description: task.homeworkName,
      detail: `${task.courseName ?? ''} / ${task.chapterName}`.replace(/^ \/ /, ''),
      taskRoot: task.taskRoot,
    }))
    .sort((left, right) =>
      `${left.detail}\u0000${left.description}\u0000${left.label}`.localeCompare(
        `${right.detail}\u0000${right.description}\u0000${right.label}`,
      ),
    );
}
