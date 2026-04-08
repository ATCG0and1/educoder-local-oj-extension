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
  it('prefers canonical current code and answers surfaces when they exist', async () => {
    const taskRoot = await createTempTaskRoot();
    await import('node:fs/promises').then(({ mkdir }) =>
      Promise.all([
        mkdir(path.join(taskRoot, 'code', 'current', 'src'), { recursive: true }),
        mkdir(path.join(taskRoot, 'answers', 'unlocked'), { recursive: true }),
      ]),
    );
    await writeFile(path.join(taskRoot, 'code', 'current', 'src', 'main.cpp'), 'current\n', 'utf8');
    await writeFile(
      path.join(taskRoot, 'answers', 'unlocked', 'answer-12.md'),
      '说明\n```cpp\nint main() { return 0; }\n```',
      'utf8',
    );

    const openDiff = vi.fn(async () => undefined);
    await compareWithAnswer(taskRoot, 'src/main.cpp', 12, { openDiff });

    expect(openDiff).toHaveBeenCalledWith(
      path.join(taskRoot, 'code', 'current', 'src', 'main.cpp'),
      path.join(taskRoot, '_educoder', 'answers', 'extracted', 'answer-12.cpp'),
      'Answer Compare: src/main.cpp ↔ answer-12',
    );
  });

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

    const extractedPath = path.join(taskRoot, '_educoder', 'answers', 'extracted', 'answer-3567559.h');
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

  it('fails with a friendly message when the answer file is missing', async () => {
    const taskRoot = await createTempTaskRoot();
    await import('node:fs/promises').then(({ mkdir }) =>
      mkdir(path.join(taskRoot, 'workspace', 'test1'), { recursive: true }),
    );
    await writeFile(path.join(taskRoot, 'workspace', 'test1', 'tasks.h'), 'current\n', 'utf8');

    await expect(compareWithAnswer(taskRoot, 'test1/tasks.h', 3567559)).rejects.toThrow('未找到答案');
  });

  it('fails with a friendly message when no answer material exists and no answer id is provided', async () => {
    const taskRoot = await createTempTaskRoot();
    await import('node:fs/promises').then(({ mkdir }) =>
      mkdir(path.join(taskRoot, 'workspace', 'test1'), { recursive: true }),
    );
    await writeFile(path.join(taskRoot, 'workspace', 'test1', 'tasks.h'), 'current\n', 'utf8');

    await expect(compareWithAnswer(taskRoot, 'test1/tasks.h')).rejects.toThrow('未找到答案');
  });

  it('prefers the first editable path from task metadata when no relative path is provided', async () => {
    const taskRoot = await createTempTaskRoot();
    await import('node:fs/promises').then(({ mkdir }) =>
      Promise.all([
        mkdir(path.join(taskRoot, 'workspace', 'a'), { recursive: true }),
        mkdir(path.join(taskRoot, 'workspace', 'b'), { recursive: true }),
        mkdir(path.join(taskRoot, '_educoder', 'answer', 'unlocked'), { recursive: true }),
        mkdir(path.join(taskRoot, '_educoder', 'meta'), { recursive: true }),
      ]),
    );
    await writeFile(path.join(taskRoot, 'workspace', 'a', 'first.cpp'), 'first\n', 'utf8');
    await writeFile(path.join(taskRoot, 'workspace', 'b', 'chosen.cpp'), 'chosen\n', 'utf8');
    await writeFile(
      path.join(taskRoot, '_educoder', 'answer', 'unlocked', 'answer-3567559.md'),
      '```cpp\nint main() { return 0; }\n```',
      'utf8',
    );
    await writeFile(
      path.join(taskRoot, '_educoder', 'meta', 'task.json'),
      JSON.stringify({ editablePaths: ['b/chosen.cpp', 'a/first.cpp'] }, null, 2),
      'utf8',
    );

    const openDiff = vi.fn(async () => undefined);
    await compareWithAnswer(taskRoot, undefined, 3567559, { openDiff });

    expect(openDiff).toHaveBeenCalledWith(
      path.join(taskRoot, 'workspace', 'b', 'chosen.cpp'),
      path.join(taskRoot, '_educoder', 'answers', 'extracted', 'answer-3567559.cpp'),
      'Answer Compare: b/chosen.cpp ↔ answer-3567559',
    );
  });

  it('prefers the first unlocked answer from answer_info metadata order when no answer id is provided', async () => {
    const taskRoot = await createTempTaskRoot();
    await import('node:fs/promises').then(({ mkdir }) =>
      Promise.all([
        mkdir(path.join(taskRoot, 'workspace', 'test1'), { recursive: true }),
        mkdir(path.join(taskRoot, '_educoder', 'answer', 'unlocked'), { recursive: true }),
      ]),
    );
    await writeFile(path.join(taskRoot, 'workspace', 'test1', 'tasks.h'), 'current\n', 'utf8');
    await writeFile(
      path.join(taskRoot, '_educoder', 'answer', 'answer_info.json'),
      JSON.stringify(
        {
          status: 3,
          entries: [
            { answerId: 4000002, name: '第二个答案' },
            { answerId: 3567559, name: '第一个答案' },
          ],
        },
        null,
        2,
      ),
      'utf8',
    );
    await writeFile(
      path.join(taskRoot, '_educoder', 'answer', 'unlocked', 'answer-3567559.md'),
      '```cpp\nint first() { return 1; }\n```',
      'utf8',
    );
    await writeFile(
      path.join(taskRoot, '_educoder', 'answer', 'unlocked', 'answer-4000002.md'),
      '```cpp\nint second() { return 2; }\n```',
      'utf8',
    );

    const openDiff = vi.fn(async () => undefined);
    await compareWithAnswer(taskRoot, 'test1/tasks.h', undefined, { openDiff });

    expect(openDiff).toHaveBeenCalledWith(
      path.join(taskRoot, 'workspace', 'test1', 'tasks.h'),
      path.join(taskRoot, '_educoder', 'answers', 'extracted', 'answer-4000002.h'),
      'Answer Compare: test1/tasks.h ↔ answer-4000002',
    );
  });

  it('skips missing editable paths from task metadata instead of falling back to a random workspace file', async () => {
    const taskRoot = await createTempTaskRoot();
    await import('node:fs/promises').then(({ mkdir }) =>
      Promise.all([
        mkdir(path.join(taskRoot, 'workspace', 'a'), { recursive: true }),
        mkdir(path.join(taskRoot, 'workspace', 'b'), { recursive: true }),
        mkdir(path.join(taskRoot, '_educoder', 'answer', 'unlocked'), { recursive: true }),
        mkdir(path.join(taskRoot, '_educoder', 'meta'), { recursive: true }),
      ]),
    );
    await writeFile(path.join(taskRoot, 'workspace', 'a', 'random.cpp'), 'random\n', 'utf8');
    await writeFile(path.join(taskRoot, 'workspace', 'b', 'chosen.cpp'), 'chosen\n', 'utf8');
    await writeFile(
      path.join(taskRoot, '_educoder', 'answer', 'unlocked', 'answer-3567559.md'),
      '```cpp\nint main() { return 0; }\n```',
      'utf8',
    );
    await writeFile(
      path.join(taskRoot, '_educoder', 'meta', 'task.json'),
      JSON.stringify({ editablePaths: ['missing.cpp', 'b/chosen.cpp'] }, null, 2),
      'utf8',
    );

    const openDiff = vi.fn(async () => undefined);
    await compareWithAnswer(taskRoot, undefined, 3567559, { openDiff });

    expect(openDiff).toHaveBeenCalledWith(
      path.join(taskRoot, 'workspace', 'b', 'chosen.cpp'),
      path.join(taskRoot, '_educoder', 'answers', 'extracted', 'answer-3567559.cpp'),
      'Answer Compare: b/chosen.cpp ↔ answer-3567559',
    );
  });
});
