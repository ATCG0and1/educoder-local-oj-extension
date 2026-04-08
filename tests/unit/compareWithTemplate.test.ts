import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { compareWithTemplate } from '../../src/commands/compareWithTemplate.js';

const tempDirs: string[] = [];

async function createTempTaskRoot(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'educoder-compare-template-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('compareWithTemplate', () => {
  it('prefers the internal _educoder template snapshot even when legacy visible template files still exist', async () => {
    const taskRoot = await createTempTaskRoot();
    await import('node:fs/promises').then(({ mkdir }) =>
      Promise.all([
        mkdir(path.join(taskRoot, 'code', 'current', 'src'), { recursive: true }),
        mkdir(path.join(taskRoot, 'code', 'template', 'src'), { recursive: true }),
        mkdir(path.join(taskRoot, '_educoder', 'template', 'src'), { recursive: true }),
      ]),
    );
    await writeFile(path.join(taskRoot, 'code', 'current', 'src', 'main.cpp'), 'current\n', 'utf8');
    await writeFile(path.join(taskRoot, 'code', 'template', 'src', 'main.cpp'), 'legacy template\n', 'utf8');
    await writeFile(path.join(taskRoot, '_educoder', 'template', 'src', 'main.cpp'), 'template\n', 'utf8');

    const openDiff = vi.fn(async () => undefined);
    await compareWithTemplate(taskRoot, 'src/main.cpp', { openDiff });

    expect(openDiff).toHaveBeenCalledWith(
      path.join(taskRoot, 'code', 'current', 'src', 'main.cpp'),
      path.join(taskRoot, '_educoder', 'template', 'src', 'main.cpp'),
      'Template Compare: src/main.cpp',
    );
  });

  it('opens a diff between workspace and template files', async () => {
    const taskRoot = await createTempTaskRoot();
    await import('node:fs/promises').then(({ mkdir }) =>
      Promise.all([
        mkdir(path.join(taskRoot, 'workspace', 'test1'), { recursive: true }),
        mkdir(path.join(taskRoot, '_educoder', 'template', 'test1'), { recursive: true }),
      ]),
    );
    await writeFile(path.join(taskRoot, 'workspace', 'test1', 'tasks.h'), 'current\n', 'utf8');
    await writeFile(path.join(taskRoot, '_educoder', 'template', 'test1', 'tasks.h'), 'template\n', 'utf8');

    const openDiff = vi.fn(async () => undefined);
    await compareWithTemplate(taskRoot, 'test1/tasks.h', { openDiff });

    expect(openDiff).toHaveBeenCalledWith(
      path.join(taskRoot, 'workspace', 'test1', 'tasks.h'),
      path.join(taskRoot, '_educoder', 'template', 'test1', 'tasks.h'),
      'Template Compare: test1/tasks.h',
    );
  });

  it('fails with a friendly message when the template snapshot is missing', async () => {
    const taskRoot = await createTempTaskRoot();
    await import('node:fs/promises').then(({ mkdir }) =>
      mkdir(path.join(taskRoot, 'workspace', 'test1'), { recursive: true }),
    );
    await writeFile(path.join(taskRoot, 'workspace', 'test1', 'tasks.h'), 'current\n', 'utf8');

    await expect(compareWithTemplate(taskRoot, 'test1/tasks.h')).rejects.toThrow('未找到模板快照');
  });

  it('fails with a friendly workspace message when the task has not been opened yet', async () => {
    const taskRoot = await createTempTaskRoot();

    await expect(compareWithTemplate(taskRoot)).rejects.toThrow('No workspace file found to compare.');
  });

  it('prefers the first editable path from task metadata when no relative path is provided', async () => {
    const taskRoot = await createTempTaskRoot();
    await import('node:fs/promises').then(({ mkdir }) =>
      Promise.all([
        mkdir(path.join(taskRoot, 'workspace', 'a'), { recursive: true }),
        mkdir(path.join(taskRoot, 'workspace', 'b'), { recursive: true }),
        mkdir(path.join(taskRoot, '_educoder', 'template', 'b'), { recursive: true }),
        mkdir(path.join(taskRoot, '_educoder', 'meta'), { recursive: true }),
      ]),
    );
    await writeFile(path.join(taskRoot, 'workspace', 'a', 'first.cpp'), 'first\n', 'utf8');
    await writeFile(path.join(taskRoot, 'workspace', 'b', 'chosen.cpp'), 'chosen\n', 'utf8');
    await writeFile(path.join(taskRoot, '_educoder', 'template', 'b', 'chosen.cpp'), 'template\n', 'utf8');
    await writeFile(
      path.join(taskRoot, '_educoder', 'meta', 'task.json'),
      JSON.stringify({ editablePaths: ['b/chosen.cpp', 'a/first.cpp'] }, null, 2),
      'utf8',
    );

    const openDiff = vi.fn(async () => undefined);
    await compareWithTemplate(taskRoot, undefined, { openDiff });

    expect(openDiff).toHaveBeenCalledWith(
      path.join(taskRoot, 'workspace', 'b', 'chosen.cpp'),
      path.join(taskRoot, '_educoder', 'template', 'b', 'chosen.cpp'),
      'Template Compare: b/chosen.cpp',
    );
  });

  it('skips missing editable paths from task metadata instead of falling back to a random workspace file', async () => {
    const taskRoot = await createTempTaskRoot();
    await import('node:fs/promises').then(({ mkdir }) =>
      Promise.all([
        mkdir(path.join(taskRoot, 'workspace', 'a'), { recursive: true }),
        mkdir(path.join(taskRoot, 'workspace', 'b'), { recursive: true }),
        mkdir(path.join(taskRoot, '_educoder', 'template', 'b'), { recursive: true }),
        mkdir(path.join(taskRoot, '_educoder', 'meta'), { recursive: true }),
      ]),
    );
    await writeFile(path.join(taskRoot, 'workspace', 'a', 'random.cpp'), 'random\n', 'utf8');
    await writeFile(path.join(taskRoot, 'workspace', 'b', 'chosen.cpp'), 'chosen\n', 'utf8');
    await writeFile(path.join(taskRoot, '_educoder', 'template', 'b', 'chosen.cpp'), 'template\n', 'utf8');
    await writeFile(
      path.join(taskRoot, '_educoder', 'meta', 'task.json'),
      JSON.stringify({ editablePaths: ['missing.cpp', 'b/chosen.cpp'] }, null, 2),
      'utf8',
    );

    const openDiff = vi.fn(async () => undefined);
    await compareWithTemplate(taskRoot, undefined, { openDiff });

    expect(openDiff).toHaveBeenCalledWith(
      path.join(taskRoot, 'workspace', 'b', 'chosen.cpp'),
      path.join(taskRoot, '_educoder', 'template', 'b', 'chosen.cpp'),
      'Template Compare: b/chosen.cpp',
    );
  });
});
