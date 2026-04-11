import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { writeProblemMaterial } from '../../src/core/recovery/problemMaterialStore.js';
import { getTaskLayoutPaths } from '../../src/core/workspace/directoryLayout.js';

const tempDirs: string[] = [];

async function createTempCollectionRoot(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'educoder-problem-material-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('problemMaterialStore', () => {
  it('keeps html-only statements out of statement.md so markdown preview does not flatten the original layout', async () => {
    const collectionRoot = await createTempCollectionRoot();
    const layout = getTaskLayoutPaths({
      collectionRoot,
      homeworkId: '3727439',
      taskId: 'fc7pz3fm6yjh',
    });
    const staleMarkdownPath = path.join(layout.problemDir, 'statement.md');

    await mkdir(layout.problemDir, { recursive: true });
    await writeFile(staleMarkdownPath, '<p>stale markdown placeholder</p>', 'utf8');

    await writeProblemMaterial(layout, {
      title: '一元多项式的加法',
      statementHtml: '<section><h1>样例数据</h1><p>5 3<br>1 0 2 1 3 2 4 3 3 6<br>3 0 2 4 5 6</p></section>',
      samples: [],
      raw: { source: 'task-detail' },
    });

    await expect(access(layout.statementMarkdownPath)).rejects.toBeDefined();
    await expect(access(layout.statementHtmlPath)).resolves.toBeUndefined();
  });
});
