import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { syncCurrentCollection } from '../../src/commands/syncCurrentCollection.js';

const tempDirs: string[] = [];

async function createTempRoot(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'educoder-snapshot-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function acceptPrefilledUrl(options?: { value?: string }): string | undefined {
  return options?.value;
}

describe('syncCurrentCollection page snapshot', () => {
  it('writes collection.page.html and collection.page.meta.json when a page fetcher is provided', async () => {
    const rootDir = await createTempRoot();

    const result = await syncCurrentCollection({
      context: {
        globalState: {
          get: () => undefined,
          update: async () => undefined,
        },
      },
      window: {
        showOpenDialog: async () => [{ fsPath: rootDir }],
      },
      clipboardEnv: {
        clipboard: {
          readText: async () =>
            'https://www.educoder.net/classrooms/ufr7sxlc/shixun_homework/1316861?tabs=0',
        },
      },
      input: {
        showInputBox: async (options) => acceptPrefilledUrl(options),
      },
      client: {
        getCollectionIndex: async () => ({
          courseId: 'ufr7sxlc',
          categoryId: '1316861',
          categoryName: '第二章 线性表及应用',
          homeworks: [],
        }),
      },
      fetchCollectionPageHtml: async ({ courseId, categoryId }) => ({
        url: `https://www.educoder.net/classrooms/${courseId}/shixun_homework/${categoryId}?tabs=0`,
        html: '<html><body>snapshot</body></html>',
        contentType: 'text/html; charset=utf-8',
      }),
    });

    const htmlPath = path.join(result.collectionRoot, 'collection.page.html');
    const metaPath = path.join(result.collectionRoot, 'collection.page.meta.json');

    await expect(access(htmlPath)).resolves.toBeUndefined();
    await expect(access(metaPath)).resolves.toBeUndefined();

    await expect(readFile(htmlPath, 'utf8')).resolves.toContain('snapshot');

    const meta = JSON.parse(await readFile(metaPath, 'utf8')) as {
      ok: boolean;
      url: string;
      contentType?: string;
    };

    expect(meta.ok).toBe(true);
    expect(meta.url).toContain('/classrooms/ufr7sxlc/shixun_homework/1316861');
    expect(meta.contentType).toContain('text/html');
  });

  it('does not fail the sync command when the snapshot fetcher throws', async () => {
    const rootDir = await createTempRoot();

    const result = await syncCurrentCollection({
      context: {
        globalState: {
          get: () => undefined,
          update: async () => undefined,
        },
      },
      window: {
        showOpenDialog: async () => [{ fsPath: rootDir }],
      },
      clipboardEnv: {
        clipboard: {
          readText: async () =>
            'https://www.educoder.net/classrooms/ufr7sxlc/shixun_homework/1316861?tabs=0',
        },
      },
      input: {
        showInputBox: async (options) => acceptPrefilledUrl(options),
      },
      client: {
        getCollectionIndex: async () => ({
          courseId: 'ufr7sxlc',
          categoryId: '1316861',
          categoryName: '第二章 线性表及应用',
          homeworks: [],
        }),
      },
      fetchCollectionPageHtml: async () => {
        throw new Error('network down');
      },
    });

    const errorPath = path.join(result.collectionRoot, 'collection.page.error.txt');
    const metaPath = path.join(result.collectionRoot, 'collection.page.meta.json');

    await expect(access(errorPath)).resolves.toBeUndefined();
    await expect(access(metaPath)).resolves.toBeUndefined();

    const meta = JSON.parse(await readFile(metaPath, 'utf8')) as { ok: boolean; error?: string };
    expect(meta.ok).toBe(false);
    expect(meta.error).toContain('network down');
  });

  it('writes a warning when the fetched html looks like a logged-out shell', async () => {
    const rootDir = await createTempRoot();

    const result = await syncCurrentCollection({
      context: {
        globalState: {
          get: () => undefined,
          update: async () => undefined,
        },
      },
      window: {
        showOpenDialog: async () => [{ fsPath: rootDir }],
      },
      clipboardEnv: {
        clipboard: {
          readText: async () =>
            'https://www.educoder.net/classrooms/ufr7sxlc/shixun_homework/1316861?tabs=0',
        },
      },
      input: {
        showInputBox: async (options) => acceptPrefilledUrl(options),
      },
      client: {
        getCollectionIndex: async () => ({
          courseId: 'ufr7sxlc',
          categoryId: '1316861',
          categoryName: '第二章 线性表及应用',
          homeworks: [],
        }),
      },
      fetchCollectionPageHtml: async ({ courseId, categoryId }) => ({
        url: `https://www.educoder.net/classrooms/${courseId}/shixun_homework/${categoryId}?tabs=0`,
        html: '<html><body>登录 / 注册</body></html>',
        contentType: 'text/html; charset=utf-8',
      }),
    });

    const errorPath = path.join(result.collectionRoot, 'collection.page.error.txt');
    const metaPath = path.join(result.collectionRoot, 'collection.page.meta.json');

    await expect(access(errorPath)).resolves.toBeUndefined();

    const meta = JSON.parse(await readFile(metaPath, 'utf8')) as { ok: boolean; warning?: string };
    expect(meta.ok).toBe(true);
    expect(meta.warning).toContain('疑似');
  });
});
