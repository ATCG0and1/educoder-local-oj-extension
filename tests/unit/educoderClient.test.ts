import { describe, expect, it } from 'vitest';
import { EducoderClient } from '../../src/core/api/educoderClient.js';
import { BusinessRequestError } from '../../src/core/api/fetchTransport.js';

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

  it('supports top-level homework list payloads and resolves multi-step task chains from next_game', async () => {
    const client = new EducoderClient({
      transport: {
        request: async <T>(url: string) => {
          if (url.includes('/homework_commons/list.json')) {
            return {
              category_id: '1316861',
              category_name: '第二章 线性表及应用',
              homeworks: [
                {
                  homework_id: '3727439',
                  name: '2-2 基本实训-链表操作',
                  shixun_identifier: 'single-shixun',
                  myshixun_identifier: 'single-myshixun',
                },
                {
                  homework_id: '3727443',
                  name: '2-5 基本实训：约瑟夫环问题',
                  shixun_identifier: 'multi-shixun',
                },
              ],
            } as T;
          }

          if (url.includes('/api/shixuns/single-shixun/challenges.json')) {
            return {
              challenge_list: [
                {
                  challenge_id: 1,
                  name: '基本实训：链表操作',
                  position: 1,
                },
              ],
            } as T;
          }

          if (url.includes('/api/shixuns/single-shixun/shixun_exec.json')) {
            return {
              game_identifier: 'single-task',
            } as T;
          }

          if (url.includes('/api/shixuns/multi-shixun/challenges.json')) {
            return {
              challenge_list: [
                {
                  challenge_id: 11,
                  name: '第 1 关',
                  position: 1,
                },
                {
                  challenge_id: 12,
                  name: '第 2 关',
                  position: 2,
                },
              ],
            } as T;
          }

          if (url.includes('/api/shixuns/multi-shixun/shixun_exec.json')) {
            return {
              game_identifier: 'task-1',
            } as T;
          }

          if (url.includes('/api/tasks/task-1.json')) {
            return {
              challenge: {
                subject: '第 1 关',
                position: 1,
              },
              next_game: 'task-2',
            } as T;
          }

          if (url.includes('/api/tasks/task-2.json')) {
            return {
              challenge: {
                subject: '第 2 关',
                position: 2,
              },
              next_game: undefined,
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
      categoryId: '1316861',
      categoryName: '第二章 线性表及应用',
      homeworks: [
        {
          homeworkId: '3727439',
          myshixunIdentifier: 'single-myshixun',
          tasks: [{ taskId: 'single-task', name: '基本实训：链表操作', position: 1 }],
        },
        {
          homeworkId: '3727443',
          tasks: [
            { taskId: 'task-1', name: '第 1 关', position: 1 },
            { taskId: 'task-2', name: '第 2 关', position: 2 },
          ],
        },
      ],
    });
  });

  it('continues following next_game when challenges.json only exposes the first task identifier', async () => {
    const client = new EducoderClient({
      transport: {
        request: async <T>(url: string) => {
          if (url.includes('/homework_commons/list.json')) {
            return {
              category_id: '1316861',
              category_name: '第二章 线性表及应用',
              homeworks: [
                {
                  homework_id: '3727443',
                  name: '2-5 基本实训：约瑟夫环问题',
                  shixun_identifier: 'multi-shixun',
                },
              ],
            } as T;
          }

          if (url.includes('/api/shixuns/multi-shixun/challenges.json')) {
            return {
              challenge_list: [
                {
                  identifier: 'task-1',
                  subject: '第 1 关',
                  position: 1,
                },
              ],
            } as T;
          }

          if (url.includes('/api/shixuns/multi-shixun/shixun_exec.json')) {
            return {
              game_identifier: 'task-1',
            } as T;
          }

          if (url.includes('/api/tasks/task-1.json')) {
            return {
              challenge: {
                subject: '第 1 关',
                position: 1,
              },
              next_game: 'task-2',
            } as T;
          }

          if (url.includes('/api/tasks/task-2.json')) {
            return {
              challenge: {
                subject: '第 2 关',
                position: 2,
              },
              next_game: 'task-3',
            } as T;
          }

          if (url.includes('/api/tasks/task-3.json')) {
            return {
              challenge: {
                subject: '第 3 关',
                position: 3,
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
          homeworkId: '3727443',
          tasks: [
            { taskId: 'task-1', name: '第 1 关', position: 1 },
            { taskId: 'task-2', name: '第 2 关', position: 2 },
            { taskId: 'task-3', name: '第 3 关', position: 3 },
          ],
        },
      ],
    });
  });

  it('walks backward via prev_game when shixun_exec starts from the current non-first task', async () => {
    const client = new EducoderClient({
      transport: {
        request: async <T>(url: string) => {
          if (url.includes('/homework_commons/list.json')) {
            return {
              category_id: '1316861',
              category_name: '第二章 线性表及应用',
              homeworks: [
                {
                  homework_id: '3727443',
                  name: '2-5 基本实训：约瑟夫环问题',
                  shixun_identifier: 'multi-shixun',
                },
              ],
            } as T;
          }

          if (url.includes('/api/shixuns/multi-shixun/challenges.json')) {
            return {
              challenge_list: [
                {
                  challenge_id: 11,
                  subject: '第 1 关',
                  position: 1,
                },
                {
                  challenge_id: 12,
                  subject: '第 2 关',
                  position: 2,
                },
              ],
            } as T;
          }

          if (url.includes('/api/shixuns/multi-shixun/shixun_exec.json')) {
            return {
              game_identifier: 'task-2',
              challenge: {
                subject: '第 2 关',
                position: 2,
              },
            } as T;
          }

          if (url.includes('/api/tasks/task-2.json')) {
            return {
              challenge: {
                subject: '第 2 关',
                position: 2,
              },
              prev_game: 'task-1',
              next_game: undefined,
            } as T;
          }

          if (url.includes('/api/tasks/task-1.json')) {
            return {
              challenge: {
                subject: '第 1 关',
                position: 1,
              },
              prev_game: undefined,
              next_game: 'task-2',
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
          homeworkId: '3727443',
          tasks: [
            { taskId: 'task-1', name: '第 1 关', position: 1 },
            { taskId: 'task-2', name: '第 2 关', position: 2 },
          ],
        },
      ],
    });
  });

  it('retries once with a fresh session after an authentication business error', async () => {
    let requestCount = 0;
    const resolveSessionCalls: Array<boolean | undefined> = [];
    const client = new EducoderClient({
      transport: {
        request: async <T>(url: string, init: { headers: Record<string, string> }) => {
          requestCount += 1;

          if (requestCount === 1) {
            expect(init.headers.Cookie).toContain('_educoder_session=stale-session');
            throw new BusinessRequestError(
              'Educoder business request failed: 401 请登录后再操作',
              401,
              '请登录后再操作',
              { status: 401, message: '请登录后再操作' },
            );
          }

          expect(url).toContain('/homework_commons/list.json');
          expect(init.headers.Cookie).toContain('_educoder_session=fresh-session');
          return {
            homework_commons_list: {
              category_id: '1316861',
              category_name: '第二章 线性表及应用',
              homeworks: [],
            },
          } as T;
        },
      },
      resolveSession: async (forceRefresh?: boolean) => {
        resolveSessionCalls.push(forceRefresh);
        return forceRefresh
          ? { _educoder_session: 'fresh-session' }
          : { _educoder_session: 'stale-session' };
      },
    });

    await expect(
      client.getCollectionIndex({
        courseId: 'ufr7sxlc',
        categoryId: '1316861',
      }),
    ).resolves.toMatchObject({
      homeworks: [],
    });

    expect(resolveSessionCalls).toEqual([undefined, true]);
  });
});

describe('EducoderClient.getCourseCollectionCategories', () => {
  it('extracts all shixun_homework chapter categories from left_banner.json', async () => {
    const client = new EducoderClient({
      transport: {
        request: async <T>(url: string) => {
          if (url.includes('/left_banner.json')) {
            return {
              course_modules: [
                {
                  type: 'common_homework',
                  second_category: [
                    {
                      category_id: '1316857',
                      category_name: '图文作业第一章',
                      position: 1,
                    },
                  ],
                },
                {
                  type: 'shixun_homework',
                  second_category: [
                    {
                      category_id: '1316859',
                      category_name: '第一章 绪论',
                      position: 2,
                      second_category_url: '/classrooms/ufr7sxlc/shixun_homework/1316859',
                    },
                    {
                      category_id: '1316861',
                      category_name: '第二章 线性表及应用',
                      position: 3,
                      second_category_url: '/classrooms/ufr7sxlc/shixun_homework/1316861',
                      third_category: [
                        {
                          category_id: '1316862',
                          category_name: '第二章 扩展实验',
                          position: 4,
                          second_category_url: '/classrooms/ufr7sxlc/shixun_homework/1316862',
                        },
                      ],
                    },
                  ],
                },
              ],
            } as T;
          }

          throw new Error(`Unexpected url: ${url}`);
        },
      },
      resolveSession: async () => ({ _educoder_session: 'session' }),
    });

    await expect(
      client.getCourseCollectionCategories({
        courseId: 'ufr7sxlc',
      }),
    ).resolves.toEqual([
      {
        categoryId: '1316859',
        name: '第一章 绪论',
        position: 2,
        url: '/classrooms/ufr7sxlc/shixun_homework/1316859',
      },
      {
        categoryId: '1316861',
        name: '第二章 线性表及应用',
        position: 3,
        url: '/classrooms/ufr7sxlc/shixun_homework/1316861',
      },
      {
        categoryId: '1316862',
        name: '第二章 扩展实验',
        position: 4,
        url: '/classrooms/ufr7sxlc/shixun_homework/1316862',
      },
    ]);
  });
});
