import { access, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { writeTaskReadme } from '../../src/core/workspace/taskReadmeWriter.js';
import { getTaskLayoutPaths } from '../../src/core/workspace/directoryLayout.js';

const tempDirs: string[] = [];

async function createTempLayout() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'educoder-task-readme-'));
  tempDirs.push(dir);
  return getTaskLayoutPaths({
    collectionRoot: dir,
    homeworkId: '3727439',
    taskId: 'fc7pz3fm6yjh',
    homeworkDirName: '2-2 基本实训-链表操作 [3727439]',
    taskDirName: '01 第1关 基本实训：链表操作 [fc7pz3fm6yjh]',
  });
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('taskReadmeWriter', () => {
  it('no longer writes a root README for task packages', async () => {
    const layout = await createTempLayout();

    await writeTaskReadme(layout, {
      taskTitle: '第1关 基本实训：链表操作',
    });

    await expect(access(path.join(layout.taskRoot, 'README.md'))).rejects.toBeDefined();
  });
});
