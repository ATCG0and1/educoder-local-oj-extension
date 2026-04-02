import { describe, expect, it } from 'vitest';
import { TemplateFetchClient } from '../../src/core/api/templateFetchClient.js';

describe('TemplateFetchClient', () => {
  it('requests reset_original_code and returns workspace files', async () => {
    const calls: Array<[string, Record<string, string | number | undefined> | undefined]> = [];
    const client = new TemplateFetchClient({
      get: async <T>(requestPath: string, query?: Record<string, string | number | undefined>) => {
        calls.push([requestPath, query]);
        return {
          content: '#pragma once\n',
          language: 'c',
        } as T;
      },
    });

    await expect(
      client.fetchTemplateFiles({
        taskId: 'fc7pz3fm6yjh',
        homeworkId: '3727439',
        filePaths: ['test1/tasks.h'],
      }),
    ).resolves.toEqual([
      {
        path: 'test1/tasks.h',
        content: '#pragma once\n',
      },
    ]);

    expect(calls).toEqual([
      [
        '/api/tasks/fc7pz3fm6yjh/reset_original_code.json',
        {
          path: 'test1/tasks.h',
          homework_common_id: '3727439',
        },
      ],
    ]);
  });
});
