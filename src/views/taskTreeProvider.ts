import path from 'node:path';
import * as vscode from 'vscode';
import { getStoredRootFolderPath, type ExtensionContextLike } from '../core/config/extensionState.js';
import {
  scanLocalTaskCatalog,
  type LocalTaskCatalogChapter,
  type LocalTaskCatalogHomework,
  type LocalTaskCatalogTask,
} from '../core/catalog/localTaskCatalog.js';
import { stripStableIdSuffix } from '../core/sync/manifestStore.js';

export const TASK_TREE_VIEW_ID = 'educoderLocalOj.taskTree';

type TaskTreeNode =
  | { kind: 'chapter'; data: LocalTaskCatalogChapter }
  | { kind: 'homework'; data: LocalTaskCatalogHomework }
  | { kind: 'task'; data: LocalTaskCatalogTask };

export interface TaskTreeProviderDeps {
  context?: ExtensionContextLike;
  loadCatalog?: () => Promise<LocalTaskCatalogChapter[]>;
}

export class TaskTreeProvider implements vscode.TreeDataProvider<TaskTreeNode> {
  private readonly emitter = new vscode.EventEmitter<TaskTreeNode | undefined | void>();
  readonly onDidChangeTreeData = this.emitter.event;
  private currentTaskRoot: string | undefined;
  private filterQuery: string | undefined;

  constructor(private readonly deps: TaskTreeProviderDeps = {}) {}

  refresh(): void {
    this.emitter.fire();
  }

  setCurrentTask(taskRoot?: string): void {
    this.currentTaskRoot = taskRoot;
    this.refresh();
  }

  setFilter(query?: string): void {
    const normalized = normalizeFilterQuery(query);
    this.filterQuery = normalized;
    this.refresh();
  }

  clearFilter(): void {
    this.filterQuery = undefined;
    this.refresh();
  }

  async getChildren(element?: TaskTreeNode): Promise<TaskTreeNode[]> {
    if (!element) {
      const chapters = await this.loadCatalog();
      return chapters.map((chapter) => ({ kind: 'chapter', data: chapter }));
    }

    if (element.kind === 'chapter') {
      return element.data.homeworks.map((homework) => ({ kind: 'homework', data: homework }));
    }

    if (element.kind === 'homework') {
      return element.data.tasks.map((task) => ({ kind: 'task', data: task }));
    }

    return [];
  }

  getTreeItem(element: TaskTreeNode): vscode.TreeItem {
    switch (element.kind) {
      case 'chapter':
        return {
          label: cleanTreeLabel(element.data.name),
          description: cleanTreeLabel(element.data.courseName),
          collapsibleState: this.filterQuery
            ? vscode.TreeItemCollapsibleState.Expanded
            : vscode.TreeItemCollapsibleState.Collapsed,
          contextValue: 'chapter',
        };
      case 'homework':
        return {
          label: cleanTreeLabel(element.data.name),
          collapsibleState: this.filterQuery
            ? vscode.TreeItemCollapsibleState.Expanded
            : vscode.TreeItemCollapsibleState.Collapsed,
          contextValue: 'homework',
        };
      case 'task':
        const isCurrent = this.currentTaskRoot === element.data.taskRoot;
        return {
          label: cleanTreeLabel(element.data.name),
          description: isCurrent ? '当前' : undefined,
          collapsibleState: vscode.TreeItemCollapsibleState.None,
          contextValue: 'task',
          iconPath: isCurrent ? new vscode.ThemeIcon('target') : undefined,
          command: {
            command: 'educoderLocalOj.openTask',
            title: '打开题目',
            arguments: [element.data.taskRoot],
          },
        };
    }
  }

  private async loadCatalog(): Promise<LocalTaskCatalogChapter[]> {
    const catalog = await this.loadRawCatalog();
    if (!this.filterQuery) {
      return catalog;
    }

    return filterCatalog(catalog, this.filterQuery);
  }

  private async loadRawCatalog(): Promise<LocalTaskCatalogChapter[]> {
    if (this.deps.loadCatalog) {
      return this.deps.loadCatalog();
    }

    const rootFolderPath = this.deps.context ? getStoredRootFolderPath(this.deps.context) : undefined;
    if (!rootFolderPath) {
      return [];
    }

    return scanLocalTaskCatalog(path.join(rootFolderPath, 'Educoder Local OJ'));
  }
}

function normalizeFilterQuery(query?: string): string | undefined {
  const normalized = query?.trim().toLocaleLowerCase();
  return normalized ? normalized : undefined;
}

function filterCatalog(
  chapters: LocalTaskCatalogChapter[],
  normalizedQuery: string,
): LocalTaskCatalogChapter[] {
  return chapters
    .map((chapter) => filterChapter(chapter, normalizedQuery))
    .filter((chapter): chapter is LocalTaskCatalogChapter => Boolean(chapter));
}

function filterChapter(
  chapter: LocalTaskCatalogChapter,
  normalizedQuery: string,
): LocalTaskCatalogChapter | undefined {
  if (matches(chapter.name, normalizedQuery)) {
    return chapter;
  }

  const homeworks = chapter.homeworks
    .map((homework) => filterHomework(homework, normalizedQuery))
    .filter((homework): homework is LocalTaskCatalogHomework => Boolean(homework));

  return homeworks.length > 0 ? { ...chapter, homeworks } : undefined;
}

function filterHomework(
  homework: LocalTaskCatalogHomework,
  normalizedQuery: string,
): LocalTaskCatalogHomework | undefined {
  if (matches(homework.name, normalizedQuery)) {
    return homework;
  }

  const tasks = homework.tasks.filter((task) => matches(task.name, normalizedQuery));
  return tasks.length > 0 ? { ...homework, tasks } : undefined;
}

function matches(value: string | undefined, normalizedQuery: string): boolean {
  return value?.toLocaleLowerCase().includes(normalizedQuery) ?? false;
}

function cleanTreeLabel(value: string | undefined): string | undefined {
  return stripStableIdSuffix(value) ?? value;
}
