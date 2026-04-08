import { describe, expect, it } from 'vitest';
import * as vscode from 'vscode';
import { TaskTreeProvider } from '../../src/views/taskTreeProvider.js';

describe('TaskTreeProvider', () => {
  it('returns chapter, homework, and task nodes with open-task command on tasks', async () => {
    const provider = new TaskTreeProvider({
      loadCatalog: async () => [
        {
          id: '1316861',
          name: '第二章 线性表及应用 [1316861]',
          courseName: '数据结构',
          homeworks: [
            {
              id: '3727439',
              name: '2-2 基本实训-链表操作 [3727439]',
              tasks: [
                {
                  taskId: 'fc7pz3fm6yjh',
                  name: '第1关 基本实训：链表操作 [fc7pz3fm6yjh]',
                  taskRoot: 'C:/task-root',
                },
              ],
            },
          ],
        },
      ],
    });

    const chapters = await provider.getChildren();
    expect(chapters).toHaveLength(1);
    expect(provider.getTreeItem(chapters[0])).toMatchObject({
      label: '第二章 线性表及应用',
      description: '数据结构',
      collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
    });

    const homeworks = await provider.getChildren(chapters[0]);
    expect(homeworks).toHaveLength(1);
    expect(provider.getTreeItem(homeworks[0])).toMatchObject({
      label: '2-2 基本实训-链表操作',
      collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
    });

    const tasks = await provider.getChildren(homeworks[0]);
    expect(tasks).toHaveLength(1);
    expect(provider.getTreeItem(tasks[0])).toMatchObject({
      label: '第1关 基本实训：链表操作',
      collapsibleState: vscode.TreeItemCollapsibleState.None,
      command: {
        command: 'educoderLocalOj.openTask',
        arguments: ['C:/task-root'],
      },
    });
    expect(String(provider.getTreeItem(chapters[0]).label)).not.toContain('[');
    expect(String(provider.getTreeItem(homeworks[0]).label)).not.toContain('[');
    expect(String(provider.getTreeItem(tasks[0]).label)).not.toContain('[');
  });

  it('marks the currently opened task in the tree item rendering', async () => {
    const provider = new TaskTreeProvider({
      loadCatalog: async () => [
        {
          id: '1316861',
          name: '第二章 线性表及应用',
          courseName: '数据结构',
          homeworks: [
            {
              id: '3727439',
              name: '2-2 基本实训-链表操作',
              tasks: [
                {
                  taskId: 'fc7pz3fm6yjh',
                  name: '第1关 基本实训：链表操作',
                  taskRoot: 'C:/task-root',
                },
              ],
            },
          ],
        },
      ],
    });

    const chapters = await provider.getChildren();
    const homeworks = await provider.getChildren(chapters[0]);
    const tasks = await provider.getChildren(homeworks[0]);

    provider.setCurrentTask('C:/task-root');

    expect(provider.getTreeItem(tasks[0])).toMatchObject({
      label: '第1关 基本实训：链表操作',
      description: '当前',
    });
  });

  it('keeps the whole chapter subtree when the chapter name matches the filter', async () => {
    const provider = new TaskTreeProvider({
      loadCatalog: async () => [
        {
          id: '1316861',
          name: '第二章 线性表及应用',
          courseName: '数据结构',
          homeworks: [
            {
              id: '3727439',
              name: '链表作业',
              tasks: [
                { taskId: 'a', name: '链表入门', taskRoot: 'C:/a' },
                { taskId: 'b', name: '链表进阶', taskRoot: 'C:/b' },
              ],
            },
            {
              id: '3727440',
              name: '顺序表作业',
              tasks: [{ taskId: 'c', name: '顺序表基础', taskRoot: 'C:/c' }],
            },
          ],
        },
      ],
    });

    provider.setFilter('线性表');

    const chapters = await provider.getChildren();
    const homeworks = await provider.getChildren(chapters[0]);
    const firstHomeworkTasks = await provider.getChildren(homeworks[0]);

    expect(chapters).toHaveLength(1);
    expect(homeworks).toHaveLength(2);
    expect(firstHomeworkTasks).toHaveLength(2);
    expect(provider.getTreeItem(chapters[0]).collapsibleState).toBe(vscode.TreeItemCollapsibleState.Expanded);
    expect(provider.getTreeItem(homeworks[0]).collapsibleState).toBe(vscode.TreeItemCollapsibleState.Expanded);
  });

  it('keeps the whole homework subtree when the homework name matches the filter', async () => {
    const provider = new TaskTreeProvider({
      loadCatalog: async () => [
        {
          id: '1316861',
          name: '第二章 线性表及应用',
          courseName: '数据结构',
          homeworks: [
            {
              id: '3727439',
              name: '链表作业',
              tasks: [
                { taskId: 'a', name: '链表入门', taskRoot: 'C:/a' },
                { taskId: 'b', name: '链表进阶', taskRoot: 'C:/b' },
              ],
            },
            {
              id: '3727440',
              name: '顺序表作业',
              tasks: [{ taskId: 'c', name: '顺序表基础', taskRoot: 'C:/c' }],
            },
          ],
        },
      ],
    });

    provider.setFilter('链表作业');

    const chapters = await provider.getChildren();
    const homeworks = await provider.getChildren(chapters[0]);
    const tasks = await provider.getChildren(homeworks[0]);

    expect(chapters).toHaveLength(1);
    expect(homeworks).toHaveLength(1);
    expect(homeworks[0].data.name).toBe('链表作业');
    expect(tasks).toHaveLength(2);
  });

  it('keeps only the matching task paths when task names match the filter', async () => {
    const provider = new TaskTreeProvider({
      loadCatalog: async () => [
        {
          id: '1316861',
          name: '第二章 线性表及应用',
          courseName: '数据结构',
          homeworks: [
            {
              id: '3727439',
              name: '链表作业',
              tasks: [
                { taskId: 'a', name: '链表入门', taskRoot: 'C:/a' },
                { taskId: 'b', name: '栈基础', taskRoot: 'C:/b' },
              ],
            },
            {
              id: '3727440',
              name: '图作业',
              tasks: [{ taskId: 'c', name: '图遍历', taskRoot: 'C:/c' }],
            },
          ],
        },
      ],
    });

    provider.setFilter('栈');

    const chapters = await provider.getChildren();
    const homeworks = await provider.getChildren(chapters[0]);
    const tasks = await provider.getChildren(homeworks[0]);

    expect(chapters).toHaveLength(1);
    expect(homeworks).toHaveLength(1);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].data.name).toBe('栈基础');
  });
});
