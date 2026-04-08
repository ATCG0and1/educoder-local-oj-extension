import { describe, it, expect } from 'vitest';
import { resolveCollectionUrlFromClipboard } from '../../src/core/url/clipboardUrlResolver.js';

describe('resolveCollectionUrlFromClipboard', () => {
  it('reads and parses collection url from clipboard', async () => {
    const vscodeEnv = {
      clipboard: {
        readText: async () => 'https://www.educoder.net/classrooms/ufr7sxlc/shixun_homework/1316861?tabs=0',
      },
    };

    await expect(resolveCollectionUrlFromClipboard(vscodeEnv)).resolves.toEqual({
      courseId: 'ufr7sxlc',
      categoryId: '1316861',
    });
  });

  it('throws fixed message when clipboard text is invalid', async () => {
    const vscodeEnv = {
      clipboard: {
        readText: async () => 'https://www.educoder.net/problems/1',
      },
    };

    await expect(resolveCollectionUrlFromClipboard(vscodeEnv)).rejects.toThrow(
      '请复制或粘贴头歌 shixun_homework 页面链接（https://www.educoder.net/classrooms/.../shixun_homework/...）',
    );
  });

  it('throws fixed message when clipboard read fails', async () => {
    const vscodeEnv = {
      clipboard: {
        readText: async () => {
          throw new Error('clipboard unavailable');
        },
      },
    };

    await expect(resolveCollectionUrlFromClipboard(vscodeEnv)).rejects.toThrow(
      '请复制或粘贴头歌 shixun_homework 页面链接（https://www.educoder.net/classrooms/.../shixun_homework/...）',
    );
  });
});
