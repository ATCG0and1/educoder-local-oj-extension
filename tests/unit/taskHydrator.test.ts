import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { hydrateTask } from '../../src/core/sync/taskHydrator.js';

const tempDirs: string[] = [];

async function exists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function createTempRoot(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'educoder-hydrate-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('hydrateTask', () => {
  it('creates the visible workspace, educoder cache, reports, and vscode directories', async () => {
    const rootDir = await createTempRoot();

    const layout = await hydrateTask({
      collectionRoot: rootDir,
      homeworkId: '3727439',
      taskId: 'fc7pz3fm6yjh',
      templateFiles: [
        { path: 'test1/test1.cpp', content: '#include <iostream>\n' },
      ],
      hiddenTests: [
        { input: '1 2\n', output: '3\n' },
      ],
    });

    await expect(exists(layout.workspaceDir)).resolves.toBe(true);
    await expect(exists(path.join(layout.taskRoot, '_educoder'))).resolves.toBe(true);
    await expect(exists(layout.reportsDir)).resolves.toBe(true);
    await expect(exists(layout.vscodeDir)).resolves.toBe(true);
  });

  it('writes the official template into workspace', async () => {
    const rootDir = await createTempRoot();

    const layout = await hydrateTask({
      collectionRoot: rootDir,
      homeworkId: '3727439',
      taskId: 'fc7pz3fm6yjh',
      templateFiles: [
        { path: 'test1/tasks.h', content: '#pragma once\n' },
        { path: 'test1/test1.cpp', content: 'int main() { return 0; }\n' },
      ],
      hiddenTests: [],
    });

    await expect(
      readFile(path.join(layout.workspaceDir, 'test1', 'test1.cpp'), 'utf8'),
    ).resolves.toBe('int main() { return 0; }\n');
    await expect(
      readFile(path.join(layout.workspaceDir, 'test1', 'tasks.h'), 'utf8'),
    ).resolves.toBe('#pragma once\n');
  });

  it('writes hidden tests, answers, template snapshots, passed code, and history into _educoder', async () => {
    const rootDir = await createTempRoot();

    const layout = await hydrateTask({
      collectionRoot: rootDir,
      homeworkId: '3727439',
      taskId: 'fc7pz3fm6yjh',
      templateFiles: [
        { path: 'test1/test1.cpp', content: 'template\n' },
      ],
      hiddenTests: [
        { input: 'in-1\n', output: 'out-1\n' },
        { input: 'in-2\n', output: 'out-2\n' },
      ],
      answerFiles: [
        { path: 'reference_code.cpp', content: 'answer\n' },
      ],
      answerInfo: {
        canView: true,
      },
      passedFiles: [
        { path: 'passed.cpp', content: 'passed\n' },
      ],
      historyFiles: [
        { path: 'query_001.cpp', content: 'history\n' },
      ],
      meta: {
        taskId: 'fc7pz3fm6yjh',
      },
    });

    await expect(
      readFile(path.join(layout.hiddenTestsDir, 'case_001_input.txt'), 'utf8'),
    ).resolves.toBe('in-1\n');
    await expect(
      readFile(path.join(layout.hiddenTestsDir, 'case_002_output.txt'), 'utf8'),
    ).resolves.toBe('out-2\n');
    await expect(
      readFile(path.join(layout.answerDir, 'answer_info.json'), 'utf8'),
    ).resolves.toContain('"canView": true');
    await expect(
      readFile(path.join(layout.answerDir, 'reference_code.cpp'), 'utf8'),
    ).resolves.toBe('answer\n');
    await expect(
      readFile(path.join(layout.templateDir, 'test1', 'test1.cpp'), 'utf8'),
    ).resolves.toBe('template\n');
    await expect(
      readFile(path.join(layout.passedDir, 'passed.cpp'), 'utf8'),
    ).resolves.toBe('passed\n');
    await expect(
      readFile(path.join(layout.historyDir, 'query_001.cpp'), 'utf8'),
    ).resolves.toBe('history\n');
    await expect(
      readFile(path.join(layout.metaDir, 'task.json'), 'utf8'),
    ).resolves.toContain('"taskId": "fc7pz3fm6yjh"');
  });
});
