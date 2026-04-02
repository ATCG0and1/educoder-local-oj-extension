import { describe, expect, it } from 'vitest';
import { TaskDetailClient, parseEditablePaths } from '../../src/core/api/taskDetailClient.js';

describe('TaskDetailClient', () => {
  it('normalizes task detail payload into stable hydration metadata', async () => {
    const client = new TaskDetailClient({
      get: async <T>() =>
        ({
        challenge: {
          id: 4132394,
          subject: '基本实训：链表操作',
          position: 1,
          path: 'test1/tasks.h；test1/test1.cpp',
        },
        game: {
          id: 215617259,
          myshixun_id: 62237677,
        },
        myshixun: {
          identifier: 'obcts7i5fx',
        },
        shixun: {
          identifier: 'a9k8ufmh',
        },
        code_editor: {
          shixun_environment_id: 1309307,
        },
        user: {
          user_id: 2312645,
          login: 'mbzfstnkj',
        },
        homework_common_name: '2-2 基本实训-链表操作',
        test_sets: [{ is_public: false, input: '1\n', output: '2\n' }],
      }) as T,
    });

    await expect(
      client.getTaskDetail({
        taskId: 'fc7pz3fm6yjh',
        homeworkId: '3727439',
      }),
    ).resolves.toMatchObject({
      taskId: 'fc7pz3fm6yjh',
      homeworkId: '3727439',
      taskName: '基本实训：链表操作',
      challengeId: 4132394,
      challengePosition: 1,
      gameId: 215617259,
      myshixunId: 62237677,
      myshixunIdentifier: 'obcts7i5fx',
      shixunIdentifier: 'a9k8ufmh',
      shixunEnvironmentId: 1309307,
      currentUserId: 2312645,
      userLogin: 'mbzfstnkj',
      editablePaths: ['test1/tasks.h', 'test1/test1.cpp'],
      testSets: [{ is_public: false, input: '1\n', output: '2\n' }],
    });
  });

  it('splits Chinese semicolon separated path lists into editable file paths', () => {
    expect(parseEditablePaths('test1/tasks.h；test1/main.cpp\nnotes.md')).toEqual([
      'test1/tasks.h',
      'test1/main.cpp',
      'notes.md',
    ]);
  });
});
