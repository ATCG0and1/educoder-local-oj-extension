import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveCompileSourcePlan } from '../../src/core/judge/compiler.js';

const tempDirs: string[] = [];

async function createTempWorkspace(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'educoder-compiler-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('resolveCompileSourcePlan', () => {
  it('prefers source files inside editable scopes and orders editable cpp files first', async () => {
    const workspaceDir = await createTempWorkspace();
    await Promise.all([
      mkdir(path.join(workspaceDir, 'src'), { recursive: true }),
      mkdir(path.join(workspaceDir, 'legacy'), { recursive: true }),
    ]);
    await Promise.all([
      writeFile(path.join(workspaceDir, 'src', 'main.cpp'), 'int main() { return 0; }\n', 'utf8'),
      writeFile(path.join(workspaceDir, 'src', 'helper.cpp'), 'int helper() { return 1; }\n', 'utf8'),
      writeFile(path.join(workspaceDir, 'legacy', 'old.cpp'), 'int old() { return 2; }\n', 'utf8'),
    ]);

    await expect(
      resolveCompileSourcePlan({
        workspaceDir,
        preferredSourcePaths: ['src/main.cpp', 'src/notes.md'],
        compileScopes: ['src'],
      }),
    ).resolves.toEqual({
      orderedRelativeSourceFiles: ['src/main.cpp', 'src/helper.cpp'],
      orderedAbsoluteSourceFiles: [
        path.join(workspaceDir, 'src', 'main.cpp'),
        path.join(workspaceDir, 'src', 'helper.cpp'),
      ],
    });
  });

  it('falls back to all cpp files when editable scopes do not contain compile targets', async () => {
    const workspaceDir = await createTempWorkspace();
    await Promise.all([
      mkdir(path.join(workspaceDir, 'src'), { recursive: true }),
      mkdir(path.join(workspaceDir, 'docs'), { recursive: true }),
    ]);
    await Promise.all([
      writeFile(path.join(workspaceDir, 'src', 'main.cpp'), 'int main() { return 0; }\n', 'utf8'),
      writeFile(path.join(workspaceDir, 'docs', 'README.md'), '# readme\n', 'utf8'),
    ]);

    await expect(
      resolveCompileSourcePlan({
        workspaceDir,
        preferredSourcePaths: ['docs/README.md'],
        compileScopes: ['docs'],
      }),
    ).resolves.toEqual({
      orderedRelativeSourceFiles: ['src/main.cpp'],
      orderedAbsoluteSourceFiles: [path.join(workspaceDir, 'src', 'main.cpp')],
    });
  });
});
