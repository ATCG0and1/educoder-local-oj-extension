import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { compareWithAnswer, extractFirstCodeBlock } from '../../src/commands/compareWithAnswer.js';

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
  it('extracts the first fenced code block and diffs against the extracted code file', async () => {
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
      '说明\n```cpp\nint main() { return 0; }\n```\n总结',
      'utf8',
    );

    const openDiff = vi.fn(async () => undefined);
    await compareWithAnswer(taskRoot, 'test1/tasks.h', 3567559, { openDiff });

    const extractedPath = path.join(taskRoot, '_educoder', 'answer', 'extracted', 'answer-3567559.h');
    expect(openDiff).toHaveBeenCalledWith(
      path.join(taskRoot, 'workspace', 'test1', 'tasks.h'),
      extractedPath,
      'Answer Compare: test1/tasks.h ↔ answer-3567559',
    );
    await expect(readFile(extractedPath, 'utf8')).resolves.toBe('int main() { return 0; }\n');
  });

  it('extractFirstCodeBlock returns undefined when no fenced code exists', () => {
    expect(extractFirstCodeBlock('plain markdown only')).toBeUndefined();
  });
});
