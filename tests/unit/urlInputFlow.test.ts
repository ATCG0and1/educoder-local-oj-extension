import { describe, expect, it, vi } from 'vitest';
import { resolveCollectionUrl } from '../../src/core/url/urlInputFlow.js';

describe('resolveCollectionUrl', () => {
  it('uses clipboard value when it already contains a valid collection url', async () => {
    const prompt = {
      showInputBox: vi.fn(async () => undefined),
    };

    await expect(
      resolveCollectionUrl({
        clipboard: {
          readText: async () =>
            'https://www.educoder.net/classrooms/ufr7sxlc/shixun_homework/1316861?tabs=0',
        },
        input: prompt,
      }),
    ).resolves.toEqual({
      courseId: 'ufr7sxlc',
      categoryId: '1316861',
    });

    expect(prompt.showInputBox).not.toHaveBeenCalled();
  });

  it('falls back to manual url paste when clipboard text is invalid', async () => {
    const prompt = {
      showInputBox: vi.fn(async () => 'https://www.educoder.net/classrooms/course/shixun_homework/chapter'),
    };

    await expect(
      resolveCollectionUrl({
        clipboard: {
          readText: async () => 'https://www.educoder.net/problems/1',
        },
        input: prompt,
      }),
    ).resolves.toEqual({
      courseId: 'course',
      categoryId: 'chapter',
    });

    expect(prompt.showInputBox).toHaveBeenCalledTimes(1);
  });

  it('throws the fixed educoder guidance message when fallback input is still invalid', async () => {
    await expect(
      resolveCollectionUrl({
        clipboard: {
          readText: async () => '',
        },
        input: {
          showInputBox: async () => 'https://www.educoder.net/problems/1',
        },
      }),
    ).rejects.toThrow('请先在 Edge 复制头歌 shixun_homework 页面链接');
  });

  it('throws the fixed educoder guidance message when the user cancels fallback input', async () => {
    await expect(
      resolveCollectionUrl({
        clipboard: {
          readText: async () => '',
        },
        input: {
          showInputBox: async () => undefined,
        },
      }),
    ).rejects.toThrow('请先在 Edge 复制头歌 shixun_homework 页面链接');
  });
});
