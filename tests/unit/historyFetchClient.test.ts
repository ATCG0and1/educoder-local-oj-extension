import { describe, expect, it } from 'vitest';
import { HistoryFetchClient } from '../../src/core/api/historyFetchClient.js';

describe('HistoryFetchClient', () => {
  it('loads evaluate logs and redo logs into a stable history index', async () => {
    const calls: Array<[string, Record<string, string | number | undefined> | undefined]> = [];
    const client = new HistoryFetchClient({
      get: async <T>(requestPath: string, query?: Record<string, string | number | undefined>) => {
        calls.push([requestPath, query]);

        if (requestPath.endsWith('/evaluate_logs.json')) {
          return {
            status: 0,
            data: {
              count: 2,
              path: 'test1/tasks.h；',
              list: [
                {
                  query_index: 14,
                  created_at: '2026-03-31T16:09:26.000+08:00',
                  output_detail: '评测通过',
                  ts_time: 0.11,
                  ts_mem: 286.2,
                  test_set_passed_rate: 1,
                },
              ],
            },
          } as T;
        }

        return {
          status: 0,
          data: {
            count: 1,
            list: [
              {
                created_at: '2026-03-31T14:42:02.000+08:00',
                redo_type: 2,
                operator_id: 2312645,
                operator: '钟宇阳',
              },
            ],
          },
        } as T;
      },
    });

    await expect(
      client.fetchHistoryIndex({
        taskId: 'fc7pz3fm6yjh',
      }),
    ).resolves.toMatchObject({
      filePath: 'test1/tasks.h',
      evaluations: [
        {
          queryIndex: 14,
          createdAt: '2026-03-31T16:09:26.000+08:00',
          outputDetail: '评测通过',
          testSetPassedRate: 1,
        },
      ],
      redoLogs: [
        {
          createdAt: '2026-03-31T14:42:02.000+08:00',
          redoType: 2,
          operatorId: 2312645,
          operator: '钟宇阳',
        },
      ],
    });

    expect(calls).toEqual([
      ['/api/tasks/fc7pz3fm6yjh/evaluate_logs.json', undefined],
      ['/api/tasks/fc7pz3fm6yjh/redo_logs.json', undefined],
    ]);
  });

  it('loads a historical snapshot by query_index and decodes the returned code', async () => {
    const calls: Array<[string, Record<string, string | number | undefined> | undefined]> = [];
    const client = new HistoryFetchClient({
      get: async <T>(requestPath: string, query?: Record<string, string | number | undefined>) => {
        calls.push([requestPath, query]);
        return {
          status: 0,
          content: Buffer.from('#pragma once\n', 'utf8').toString('base64'),
          data: {
            query_index: 14,
            created_at: '2026-03-31T16:09:26.000+08:00',
            output_detail: '评测通过',
            ts_time: 0.11,
            ts_mem: 286.2,
            test_set_passed_rate: 1,
          },
        } as T;
      },
    });

    await expect(
      client.fetchHistorySnapshot({
        taskId: 'fc7pz3fm6yjh',
        homeworkId: '3727439',
        queryIndex: 14,
        filePath: 'test1/tasks.h',
      }),
    ).resolves.toMatchObject({
      queryIndex: 14,
      filePath: 'test1/tasks.h',
      content: '#pragma once\n',
      createdAt: '2026-03-31T16:09:26.000+08:00',
      outputDetail: '评测通过',
    });

    expect(calls).toEqual([
      [
        '/api/tasks/fc7pz3fm6yjh/get_content_for_commit_id.json',
        {
          query_index: 14,
          path: 'test1/tasks.h',
          homework_common_id: '3727439',
        },
      ],
    ]);
  });
});
