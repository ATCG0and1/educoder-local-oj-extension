import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  restorePassedSnapshot,
  restoreTemplateSnapshot,
} from '../../src/core/workspace/snapshotManager.js';
import { writeTaskDebugConfig } from '../../src/core/workspace/vscodeConfigWriter.js';

const tempDirs: string[] = [];

async function createTempTaskRoot(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'educoder-snapshot-'));
  tempDirs.push(dir);
  return dir;
}

async function writeTextFile(targetPath: string, content: string): Promise<void> {
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, content, 'utf8');
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('snapshotManager', () => {
  it('generates .vscode/tasks.json and .vscode/launch.json', async () => {
    const taskRoot = await createTempTaskRoot();

    await writeTaskDebugConfig(taskRoot);

    await expect(access(path.join(taskRoot, '.vscode', 'tasks.json'))).resolves.toBeUndefined();
    await expect(access(path.join(taskRoot, '.vscode', 'launch.json'))).resolves.toBeUndefined();
  });

  it('restores workspace from the template snapshot', async () => {
    const taskRoot = await createTempTaskRoot();
    await writeTextFile(path.join(taskRoot, '_educoder', 'template', 'test1', 'test1.cpp'), 'template\n');
    await writeTextFile(path.join(taskRoot, 'workspace', 'test1', 'stale.cpp'), 'stale\n');

    await restoreTemplateSnapshot(taskRoot);

    await expect(readFile(path.join(taskRoot, 'workspace', 'test1', 'test1.cpp'), 'utf8')).resolves.toBe(
      'template\n',
    );
    await expect(access(path.join(taskRoot, 'workspace', 'test1', 'stale.cpp'))).rejects.toBeDefined();
  });

  it('restores workspace from the passed snapshot', async () => {
    const taskRoot = await createTempTaskRoot();
    await writeTextFile(path.join(taskRoot, '_educoder', 'passed', 'test1', 'test1.cpp'), 'passed\n');
    await writeTextFile(path.join(taskRoot, 'workspace', 'test1', 'stale.cpp'), 'stale\n');

    await restorePassedSnapshot(taskRoot);

    await expect(readFile(path.join(taskRoot, 'workspace', 'test1', 'test1.cpp'), 'utf8')).resolves.toBe(
      'passed\n',
    );
    await expect(access(path.join(taskRoot, 'workspace', 'test1', 'stale.cpp'))).rejects.toBeDefined();
  });
});
