import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { writeRepositorySnapshot } from '../../src/core/recovery/repositoryStore.js';

const tempDirs: string[] = [];

async function createTempTaskRoot(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'educoder-repository-store-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('repositoryStore', () => {
  it('writes repository tree, index, remote snapshot files, and metadata', async () => {
    const taskRoot = await createTempTaskRoot();

    await writeRepositorySnapshot(taskRoot, {
      nodes: [
        { path: 'test1', name: 'test1', type: 'tree' },
        { path: 'test1/tasks.h', name: 'tasks.h', type: 'blob' },
      ],
      files: [
        { path: 'test1/tasks.h', content: '#pragma once\n' },
      ],
      updatedAt: '2026-04-02T00:00:00.000Z',
    });

    await expect(
      readFile(path.join(taskRoot, '_educoder', 'repository', 'tree.json'), 'utf8'),
    ).resolves.toContain('"test1/tasks.h"');
    await expect(
      readFile(path.join(taskRoot, '_educoder', 'repository', 'index.json'), 'utf8'),
    ).resolves.toContain('"fileCount": 1');
    await expect(
      readFile(path.join(taskRoot, '_educoder', 'repository', 'remote', 'test1', 'tasks.h'), 'utf8'),
    ).resolves.toBe('#pragma once\n');
    await expect(
      readFile(path.join(taskRoot, '_educoder', 'meta', 'repository.json'), 'utf8'),
    ).resolves.toContain('"ready": true');
  });

  it('removes stale remote snapshot files before writing the refreshed repository state', async () => {
    const taskRoot = await createTempTaskRoot();

    await writeRepositorySnapshot(taskRoot, {
      nodes: [
        { path: 'stale.cpp', name: 'stale.cpp', type: 'blob' },
      ],
      files: [
        { path: 'stale.cpp', content: 'stale\n' },
      ],
      updatedAt: '2026-04-02T00:00:00.000Z',
    });

    await writeRepositorySnapshot(taskRoot, {
      nodes: [
        { path: 'fresh.cpp', name: 'fresh.cpp', type: 'blob' },
      ],
      files: [
        { path: 'fresh.cpp', content: 'fresh\n' },
      ],
      updatedAt: '2026-04-02T00:10:00.000Z',
    });

    await expect(
      access(path.join(taskRoot, '_educoder', 'repository', 'remote', 'stale.cpp')),
    ).rejects.toBeDefined();
    await expect(
      readFile(path.join(taskRoot, '_educoder', 'repository', 'remote', 'fresh.cpp'), 'utf8'),
    ).resolves.toBe('fresh\n');
  });

  it('rejects unsafe repository paths without deleting the existing remote snapshot', async () => {
    const taskRoot = await createTempTaskRoot();

    await writeRepositorySnapshot(taskRoot, {
      nodes: [{ path: 'safe.cpp', name: 'safe.cpp', type: 'blob' }],
      files: [{ path: 'safe.cpp', content: 'safe\n' }],
      updatedAt: '2026-04-02T00:00:00.000Z',
    });

    await expect(
      writeRepositorySnapshot(taskRoot, {
        nodes: [{ path: '../escape.txt', name: 'escape.txt', type: 'blob' }],
        files: [{ path: '../escape.txt', content: 'escape\n' }],
        updatedAt: '2026-04-02T00:10:00.000Z',
      }),
    ).rejects.toThrow('Unsafe relative file path');

    await expect(
      readFile(path.join(taskRoot, '_educoder', 'repository', 'remote', 'safe.cpp'), 'utf8'),
    ).resolves.toBe('safe\n');
    await expect(
      access(path.join(taskRoot, '_educoder', 'repository', 'escape.txt')),
    ).rejects.toBeDefined();
  });
});
