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
});
