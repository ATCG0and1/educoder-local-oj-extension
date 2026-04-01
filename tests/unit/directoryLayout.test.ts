import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getTaskLayoutPaths } from '../../src/core/workspace/directoryLayout.js';

describe('getTaskLayoutPaths', () => {
  it('returns the visible task workspace layout under the manifest task directory', () => {
    const layout = getTaskLayoutPaths({
      collectionRoot: path.join('C:', 'Educoder Local OJ', 'classroom_ufr7sxlc', 'shixun_homework_1316861'),
      homeworkId: '3727439',
      taskId: 'fc7pz3fm6yjh',
    });

    expect(layout.taskRoot).toBe(
      path.join(
        'C:',
        'Educoder Local OJ',
        'classroom_ufr7sxlc',
        'shixun_homework_1316861',
        'homeworks',
        '3727439',
        'tasks',
        'fc7pz3fm6yjh',
      ),
    );
    expect(layout.workspaceDir).toBe(path.join(layout.taskRoot, 'workspace'));
    expect(layout.hiddenTestsDir).toBe(path.join(layout.taskRoot, '_educoder', 'tests', 'hidden'));
    expect(layout.answerDir).toBe(path.join(layout.taskRoot, '_educoder', 'answer'));
    expect(layout.templateDir).toBe(path.join(layout.taskRoot, '_educoder', 'template'));
    expect(layout.passedDir).toBe(path.join(layout.taskRoot, '_educoder', 'passed'));
    expect(layout.historyDir).toBe(path.join(layout.taskRoot, '_educoder', 'history'));
    expect(layout.reportsDir).toBe(path.join(layout.taskRoot, 'reports'));
    expect(layout.vscodeDir).toBe(path.join(layout.taskRoot, '.vscode'));
  });
});
