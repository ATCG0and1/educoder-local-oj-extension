import { describe, expect, it } from 'vitest';
import { AnswerFetchClient } from '../../src/core/api/answerFetchClient.js';

describe('AnswerFetchClient', () => {
  it('normalizes answer entries from get_answer_info', async () => {
    const calls: Array<[string, Record<string, string | number | undefined> | undefined]> = [];
    const client = new AnswerFetchClient({
      get: async <T>(requestPath: string, query?: Record<string, string | number | undefined>) => {
        calls.push([requestPath, query]);
        return {
          status: 3,
          message: [
            {
              answer_id: 3567559,
              answer_name: '解题思路1',
              answer_score: 50,
              answer_ratio: 10,
              view_time: null,
              answer_contents: '```cpp\nint main() {}\n```',
            },
          ],
        } as T;
      },
    });

    await expect(
      client.fetchAnswerInfo({
        taskId: 'fc7pz3fm6yjh',
      }),
    ).resolves.toEqual({
      status: 3,
      entries: [
        {
          answerId: 3567559,
          name: '解题思路1',
          score: 50,
          ratio: 10,
          viewTime: undefined,
          content: '```cpp\nint main() {}\n```',
        },
      ],
    });

    expect(calls).toEqual([['/api/tasks/fc7pz3fm6yjh/get_answer_info.json', undefined]]);
  });

  it('unlocks answer bodies by answer id', async () => {
    const calls: Array<[string, Record<string, string | number | undefined> | undefined]> = [];
    const client = new AnswerFetchClient({
      get: async <T>(requestPath: string, query?: Record<string, string | number | undefined>) => {
        calls.push([requestPath, query]);
        return {
          contents: '```cpp\nint main() { return 0; }\n```',
        } as T;
      },
    });

    await expect(
      client.unlockAnswer({
        taskId: 'fc7pz3fm6yjh',
        answerId: 3567559,
      }),
    ).resolves.toEqual({
      answerId: 3567559,
      content: '```cpp\nint main() { return 0; }\n```',
      unlocked: true,
    });

    expect(calls).toEqual([
      ['/api/tasks/fc7pz3fm6yjh/unlock_answer.json', { answer_id: 3567559 }],
    ]);
  });
});
