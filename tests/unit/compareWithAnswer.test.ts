import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { compareWithAnswer } from '../../src/commands/compareWithAnswer.js';

const tempDirs: string[] = [];

async function createTempTaskRoot(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'educoder-compare-answer-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('compareWithAnswer', () => {
  it('opens a diff between workspace and unlocked answer files', async () => {
    const taskRoot = await createTempTaskRoot();
    await import('node:fs/promises').then(({ mkdir }) =>
      Promise.all([
        mkdir(path.join(taskRoot, 'workspace', 'test1'), { recursive: true }),
        mkdir(path.join(taskRoot, '_educoder', 'answer', 'unlocked'), { recursive: true }),
      ]),
    );
    await writeFile(path.join(taskRoot, 'workspace', 'test1', 'tasks.h'), 'current\n', 'utf8');
    await writeFile(
      path.join(taskRoot, '_educoder', 'answer', 'unlocked', 'answer-3567559.md'),
      '```cpp\nint main() { return 0; }\n```',
      'utf8',
    );

    const openDiff = vi.fn(async () => undefined);
    await compareWithAnswer(taskRoot, 'test1/tasks.h', 3567559, { openDiff });

    expect(openDiff).toHaveBeenCalledWith(
      path.join(taskRoot, 'workspace', 'test1', 'tasks.h'),
      path.join(taskRoot, '_educoder', 'answer', 'unlocked', 'answer-3567559.md'),
      'Answer Compare: test1/tasks.h ↔ answer-3567559',
    );
  });
});
