import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getTaskLayoutPaths } from '../../src/core/workspace/directoryLayout.js';

describe('getTaskLayoutPaths', () => {
  it('returns the visible task workspace layout under the manifest task directory', () => {
    const layout = getTaskLayoutPaths({
      collectionRoot: path.join(
        'C:',
        'Educoder Local OJ',
        '课程 [ufr7sxlc]',
        '第二章 线性表及应用 [1316861]',
      ),
      homeworkId: '3727439',
      taskId: 'fc7pz3fm6yjh',
      homeworkDirName: '2-2 基本实训-链表操作 [3727439]',
      taskDirName: '01 第1关 基本实训：链表操作 [fc7pz3fm6yjh]',
    });

    expect(layout.taskRoot).toBe(
      path.join(
        'C:',
        'Educoder Local OJ',
        '课程 [ufr7sxlc]',
        '第二章 线性表及应用 [1316861]',
        'homeworks',
        '2-2 基本实训-链表操作 [3727439]',
        'tasks',
        '01 第1关 基本实训：链表操作 [fc7pz3fm6yjh]',
      ),
    );
    expect(layout.problemDir).toBe(path.join(layout.taskRoot, 'problem'));
    expect(layout.statementMarkdownPath).toBe(path.join(layout.taskRoot, 'problem', 'statement.md'));
    expect(layout.statementHtmlPath).toBe(path.join(layout.taskRoot, 'problem', 'statement.html'));
    expect(layout.problemMetadataPath).toBe(path.join(layout.taskRoot, 'problem', 'metadata.json'));
    expect(layout.currentCodeDir).toBe(path.join(layout.taskRoot, 'code', 'current'));
    expect(layout.templateCodeDir).toBe(path.join(layout.taskRoot, '_educoder', 'template'));
    expect(layout.passedCodeDir).toBe(path.join(layout.taskRoot, '_educoder', 'passed'));
    expect(layout.workspaceDir).toBe(layout.currentCodeDir);
    expect(layout.testsDir).toBe(path.join(layout.taskRoot, 'tests'));
    expect(layout.allTestsDir).toBe(path.join(layout.taskRoot, 'tests', 'all'));
    expect(layout.visibleTestsDir).toBe(path.join(layout.taskRoot, 'tests', 'visible'));
    expect(layout.hiddenTestsDir).toBe(path.join(layout.taskRoot, '_educoder', 'tests', 'hidden'));
    expect(layout.answersDir).toBe(path.join(layout.taskRoot, 'answers'));
    expect(layout.answerDir).toBe(layout.answersDir);
    expect(layout.unlockedAnswersDir).toBe(layout.answersDir);
    expect(layout.answerUnlockedDir).toBe(layout.answersDir);
    expect(layout.internalAnswersDir).toBe(path.join(layout.taskRoot, '_educoder', 'answers'));
    expect(layout.answerInfoPath).toBe(path.join(layout.taskRoot, '_educoder', 'answers', 'answer_info.json'));
    expect(layout.legacyWorkspaceDir).toBe(path.join(layout.taskRoot, 'workspace'));
    expect(layout.templateDir).toBe(layout.templateCodeDir);
    expect(layout.passedDir).toBe(layout.passedCodeDir);
    expect(layout.historyDir).toBe(path.join(layout.taskRoot, '_educoder', 'history'));
    expect(layout.repositoryDir).toBe(path.join(layout.taskRoot, '_educoder', 'repository'));
    expect(layout.repositoryRemoteDir).toBe(path.join(layout.taskRoot, '_educoder', 'repository', 'remote'));
    expect(layout.reportsDir).toBe(path.join(layout.taskRoot, '_educoder', 'judge'));
    expect(layout.vscodeDir).toBe(path.join(layout.taskRoot, '.vscode'));
  });
});
