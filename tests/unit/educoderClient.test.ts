import { describe, expect, it } from 'vitest';
import { EducoderClient } from '../../src/core/api/educoderClient.js';

describe('EducoderClient.getCollectionIndex', () => {
  it('resolves real task identifiers from shixun challenge metadata', async () => {
    const client = new EducoderClient({
      transport: {
        request: async <T>(url: string) => {
          if (url.includes('/homework_commons/list.json')) {
            return {
              homework_commons_list: {
                category_id: '1316861',
                category_name: '第二章 线性表及应用',
                homeworks: [
                  {
                    homework_id: '3727439',
                    name: '2-2 基本实训-链表操作',
                    shixun_identifier: 'a9k8ufmh',
                    myshixun_identifier: 'obcts7i5fx',
                  },
                ],
              },
            } as T;
          }

          if (url.includes('/api/shixuns/a9k8ufmh/challenges.json')) {
            return [
              {
                identifier: 'fc7pz3fm6yjh',
                subject: '基本实训：链表操作',
                position: 1,
              },
            ] as T;
          }

          throw new Error(`Unexpected url: ${url}`);
        },
      },
      resolveSession: async () => ({ _educoder_session: 'session' }),
    });

    await expect(
      client.getCollectionIndex({
        courseId: 'ufr7sxlc',
        categoryId: '1316861',
      }),
    ).resolves.toMatchObject({
      homeworks: [
        {
          homeworkId: '3727439',
          tasks: [{ taskId: 'fc7pz3fm6yjh', name: '基本实训：链表操作', position: 1 }],
        },
      ],
    });
  });

  it('falls back to shixun_exec when the challenge endpoint does not expose identifiers', async () => {
    const client = new EducoderClient({
      transport: {
        request: async <T>(url: string) => {
          if (url.includes('/homework_commons/list.json')) {
            return {
              homework_commons_list: {
                category_id: '1316861',
                category_name: '第二章 线性表及应用',
                homeworks: [
                  {
                    homework_id: '3727439',
                    name: '2-2 基本实训-链表操作',
                    shixun_identifier: 'a9k8ufmh',
                  },
                ],
              },
            } as T;
          }

          if (url.includes('/api/shixuns/a9k8ufmh/challenges.json')) {
            return [{ subject: '基本实训：链表操作', position: 1 }] as T;
          }

          if (url.includes('/api/shixuns/a9k8ufmh/shixun_exec.json')) {
            return {
              game_identifier: 'fc7pz3fm6yjh',
              challenge: {
                subject: '基本实训：链表操作',
                position: 1,
              },
            } as T;
          }

          throw new Error(`Unexpected url: ${url}`);
        },
      },
      resolveSession: async () => ({ _educoder_session: 'session' }),
    });

    await expect(
      client.getCollectionIndex({
        courseId: 'ufr7sxlc',
        categoryId: '1316861',
      }),
    ).resolves.toMatchObject({
      homeworks: [
        {
          tasks: [{ taskId: 'fc7pz3fm6yjh', name: '基本实训：链表操作', position: 1 }],
        },
      ],
    });
  });
});
