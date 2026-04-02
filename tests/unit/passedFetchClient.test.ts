import { describe, expect, it } from 'vitest';
import { PassedFetchClient } from '../../src/core/api/passedFetchClient.js';

describe('PassedFetchClient', () => {
  it('requests reset_passed_code and returns passed workspace files', async () => {
    const calls: Array<[string, Record<string, string | number | undefined> | undefined]> = [];
    const client = new PassedFetchClient({
      get: async <T>(requestPath: string, query?: Record<string, string | number | undefined>) => {
        calls.push([requestPath, query]);
        return {
          content: 'passed solution\n',
          language: 'c',
        } as T;
      },
    });

    await expect(
      client.fetchPassedFiles({
        taskId: 'fc7pz3fm6yjh',
        homeworkId: '3727439',
        filePaths: ['test1/tasks.h'],
      }),
    ).resolves.toEqual([
      {
        path: 'test1/tasks.h',
        content: 'passed solution\n',
      },
    ]);

    expect(calls).toEqual([
      [
        '/api/tasks/fc7pz3fm6yjh/reset_passed_code.json',
        {
          path: 'test1/tasks.h',
          homework_common_id: '3727439',
        },
      ],
    ]);
  });
});
