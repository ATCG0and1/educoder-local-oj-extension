import { describe, expect, it } from 'vitest';
import { RepositoryFetchClient } from '../../src/core/api/repositoryFetchClient.js';

describe('RepositoryFetchClient', () => {
  it('lists repository nodes for a given path', async () => {
    const calls: Array<[string, Record<string, unknown> | undefined]> = [];
    const fetcher = new RepositoryFetchClient({
      post: async <T>(path: string, body?: Record<string, unknown>) => {
        calls.push([path, body]);
        return {
          trees: [
            { name: 'tasks.h', type: 'blob' },
            { name: 'include', type: 'tree' },
          ],
        } as T;
      },
    });

    await expect(
      fetcher.listRepository({
        myshixunIdentifier: 'obcts7i5fx',
        path: 'test1',
      }),
    ).resolves.toEqual([
      { path: 'test1/tasks.h', name: 'tasks.h', type: 'blob' },
      { path: 'test1/include', name: 'include', type: 'tree' },
    ]);

    expect(calls).toEqual([
      ['/api/myshixuns/obcts7i5fx/repository.json', { path: 'test1' }],
    ]);
  });

  it('recursively collects repository tree nodes from the root path', async () => {
    const calls: Array<[string, Record<string, unknown> | undefined]> = [];
    const responses = new Map<string, { trees: Array<{ name: string; type: string }> }>([
      ['', { trees: [{ name: 'test1', type: 'tree' }, { name: 'README.md', type: 'blob' }] }],
      ['test1', { trees: [{ name: 'tasks.h', type: 'blob' }, { name: 'include', type: 'tree' }] }],
      ['test1/include', { trees: [{ name: 'helper.h', type: 'blob' }] }],
    ]);

    const fetcher = new RepositoryFetchClient({
      post: async <T>(path: string, body?: Record<string, unknown>) => {
        calls.push([path, body]);
        return (responses.get(String(body?.path ?? '')) ?? { trees: [] }) as T;
      },
    });

    await expect(
      fetcher.collectRepositoryTree({
        myshixunIdentifier: 'obcts7i5fx',
        rootPath: '',
      }),
    ).resolves.toEqual([
      { path: 'README.md', name: 'README.md', type: 'blob' },
      { path: 'test1', name: 'test1', type: 'tree' },
      { path: 'test1/include', name: 'include', type: 'tree' },
      { path: 'test1/include/helper.h', name: 'helper.h', type: 'blob' },
      { path: 'test1/tasks.h', name: 'tasks.h', type: 'blob' },
    ]);

    expect(calls).toEqual([
      ['/api/myshixuns/obcts7i5fx/repository.json', { path: '' }],
      ['/api/myshixuns/obcts7i5fx/repository.json', { path: 'test1' }],
      ['/api/myshixuns/obcts7i5fx/repository.json', { path: 'test1/include' }],
    ]);
  });
});
