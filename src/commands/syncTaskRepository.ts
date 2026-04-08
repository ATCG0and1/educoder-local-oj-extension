import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { RepositoryFetchClientLike } from '../core/api/repositoryFetchClient.js';
import type { SourceFetchClientLike } from '../core/api/sourceFetchClient.js';
import {
  readRecoveryMetadata,
  writeRecoveryMetadata,
  type RecoveryMetadata,
} from '../core/recovery/materialStore.js';
import { writeRepositorySnapshot } from '../core/recovery/repositoryStore.js';
import type { HomeworkManifest, TaskManifest } from '../core/sync/manifestStore.js';

export interface SyncTaskRepositoryDeps {
  repositoryClient: RepositoryFetchClientLike;
  sourceClient: SourceFetchClientLike;
}

export async function syncTaskRepository(
  taskRoot: string,
  deps: SyncTaskRepositoryDeps,
): Promise<void> {
  const manifests = await readManifestBundle(taskRoot);
  const taskMeta = await readOptionalJson<Record<string, unknown>>(
    path.join(taskRoot, '_educoder', 'meta', 'task.json'),
  );
  const myshixunIdentifier =
    stringOrUndefined(taskMeta?.myshixunIdentifier) ?? manifests.homeworkManifest.myshixunIdentifier;

  if (!myshixunIdentifier) {
    throw new Error('myshixunIdentifier is missing. Open the task first.');
  }

  const nodes = await deps.repositoryClient.collectRepositoryTree({
    myshixunIdentifier,
    rootPath: '',
  });
  const blobPaths = nodes.filter((node) => node.type === 'blob').map((node) => node.path);
  const files = await deps.sourceClient.fetchSourceFiles({
    taskId: manifests.taskManifest.taskId,
    homeworkId: manifests.homeworkManifest.homeworkId,
    filePaths: blobPaths,
  });

  const syncedAt = new Date().toISOString();
  await writeRepositorySnapshot(taskRoot, {
    nodes,
    files,
    updatedAt: syncedAt,
  });
  await writeFile(
    path.join(taskRoot, '_educoder', 'repository', 'README.md'),
    renderRepositoryGuide(manifests.taskManifest.name, syncedAt),
    'utf8',
  );

  const existing = (await readRecoveryMetadata(taskRoot)) ?? emptyRecoveryMetadata();
  await writeRecoveryMetadata(taskRoot, {
    ...existing,
    repositoryReady: files.length > 0,
    repositoryFileCount: files.length,
    lastRepositorySyncAt: syncedAt,
    updatedAt: syncedAt,
  });
}

async function readManifestBundle(taskRoot: string): Promise<{
  taskManifest: TaskManifest;
  homeworkManifest: HomeworkManifest;
}> {
  const taskManifest = JSON.parse(
    await readFile(path.join(taskRoot, 'task.manifest.json'), 'utf8'),
  ) as TaskManifest;
  const homeworkManifest = JSON.parse(
    await readFile(path.join(taskRoot, '..', '..', 'homework.manifest.json'), 'utf8'),
  ) as HomeworkManifest;

  return {
    taskManifest,
    homeworkManifest,
  };
}

async function readOptionalJson<T>(filePath: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined;
    }

    throw error;
  }
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function renderRepositoryGuide(taskName: string, syncedAt: string): string {
  return [
    '# 远端仓库快照',
    '',
    `- 任务：${taskName}`,
    `- 同步时间：${syncedAt}`,
    '- 该目录属于高级调试资料，用于排查远端仓库结构、源码分布和抓包验证。',
    '- 它不是做题主入口；日常请优先使用 `problem/`、`code/`、`tests/`、`answers/`。',
    '',
    '## 目录说明',
    '',
    '- `remote/`：远端仓库文件快照',
    '- `tree.json`：仓库树索引',
    '- `index.json`：本次同步文件清单',
    '',
  ].join('\n');
}

function emptyRecoveryMetadata(): RecoveryMetadata {
  return {
    templateReady: false,
    templateFileCount: 0,
    passedReady: false,
    passedFileCount: 0,
    answerReady: false,
    answerEntryCount: 0,
    unlockedAnswerCount: 0,
    historyReady: false,
    historyFileCount: 0,
    repositoryReady: false,
    repositoryFileCount: 0,
    updatedAt: new Date(0).toISOString(),
  };
}
