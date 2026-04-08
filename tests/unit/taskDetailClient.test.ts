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

  it('normalizes embedded statement markdown/html/sample metadata when task detail already carries problem content', async () => {
    const client = new TaskDetailClient({
      get: async <T>() =>
        ({
          challenge: {
            subject: '基本实训：链表操作',
            description: '<p>给定两个整数，输出它们的和。</p>',
            description_md: '## 题目描述\n给定两个整数，输出它们的和。',
            samples: [{ input: '1 2\n', output: '3\n', name: '样例 1' }],
            exec_time: 1000,
            memory_limit: 128,
          },
          test_sets: [{ is_public: true, input: '1 2\n', output: '3\n' }],
        }) as T,
    });

    await expect(
      client.getTaskDetail({
        taskId: 'fc7pz3fm6yjh',
      }),
    ).resolves.toMatchObject({
      taskName: '基本实训：链表操作',
      problemMaterial: {
        title: '基本实训：链表操作',
        statementMarkdown: '## 题目描述\n给定两个整数，输出它们的和。',
        statementHtml: '<p>给定两个整数，输出它们的和。</p>',
        samples: [{ name: '样例 1', input: '1 2\n', output: '3\n' }],
        limits: {
          exec_time: 1000,
          memory_limit: 128,
        },
      },
    });
  });

  it('normalizes relative statement asset urls from task detail payloads using the task page url', async () => {
    const client = new TaskDetailClient({
      get: async <T>() =>
        ({
          challenge: {
            subject: '基本实训：链表操作',
            description: '<p><img src="../uploads/problem.png"></p>',
            description_md: '![示意图](../uploads/problem.png)',
          },
          test_sets: [{ is_public: true, input: '1 2\n', output: '3\n' }],
        }) as T,
    });

    await expect(
      client.getTaskDetail({
        taskId: 'fc7pz3fm6yjh',
        homeworkId: '3727439',
      }),
    ).resolves.toMatchObject({
      problemMaterial: {
        statementMarkdown: '![示意图](https://www.educoder.net/uploads/problem.png)',
        statementHtml: '<p><img src="https://www.educoder.net/uploads/problem.png"></p>',
        pageSnapshotUrl: 'https://www.educoder.net/tasks/fc7pz3fm6yjh?homework_common_id=3727439',
      },
    });
  });

  it('treats challenge.task_pass as the real statement markdown when detail json uses that field', async () => {
    const client = new TaskDetailClient({
      get: async <T>() =>
        ({
          challenge: {
            subject: '一元多项式的加法',
            task_pass: '## 题目任务\\n给定两个一元多项式，计算它们的和。',
          },
          test_sets: [{ is_public: true, input: '1 2\\n', output: '3\\n' }],
        }) as T,
    });

    await expect(
      client.getTaskDetail({
        taskId: 'lzpgkhefi93w',
      }),
    ).resolves.toMatchObject({
      taskName: '一元多项式的加法',
      problemMaterial: {
        title: '一元多项式的加法',
        statementMarkdown: '## 题目任务\\n给定两个一元多项式，计算它们的和。',
        samples: [{ name: '样例 1', input: '1 2\\n', output: '3\\n' }],
      },
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
