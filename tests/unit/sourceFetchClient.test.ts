import { describe, expect, it } from 'vitest';
import { SourceFetchClient, decodeEducoderContent } from '../../src/core/api/sourceFetchClient.js';

describe('SourceFetchClient', () => {
  it('decodes base64 rep_content payloads into workspace files', async () => {
    const sourceClient = new SourceFetchClient({
      get: async <T>() =>
        ({
        content: {
          content: Buffer.from('#pragma once\n', 'utf8').toString('base64'),
        },
      }) as T,
    });

    await expect(
      sourceClient.fetchSourceFiles({
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
  });

  it('falls back to the raw content when payload is not valid base64', () => {
    expect(decodeEducoderContent('raw-content')).toBe('raw-content');
  });
});
