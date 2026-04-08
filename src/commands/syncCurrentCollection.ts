import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ClipboardEnv } from '../core/url/clipboardUrlResolver.js';
import { getProductRoot, type RootResolverDeps } from '../core/config/rootResolver.js';
import { formatErrorChain } from '../core/logging/errorFormat.js';
import { noopLogger, type Logger } from '../core/logging/logger.js';
import { syncCollectionIndex, type CollectionIndexClient } from '../core/sync/collectionSync.js';
import { getTaskLayoutPaths } from '../core/workspace/directoryLayout.js';
import type { CollectionManifest, HomeworkManifest, TaskManifest } from '../core/sync/manifestStore.js';
import { resolveCollectionUrl, type ManualCollectionUrlInput } from '../core/url/urlInputFlow.js';

export interface CollectionPageSnapshot {
  url: string;
  html: string;
  contentType?: string;
}

export type CollectionPageHtmlFetcher = (input: {
  courseId: string;
  categoryId: string;
}) => Promise<CollectionPageSnapshot>;

export interface SyncCurrentCollectionDeps extends RootResolverDeps {
  clipboardEnv: ClipboardEnv;
  input: ManualCollectionUrlInput;
  client: CollectionIndexClient;
  fetchCollectionPageHtml?: CollectionPageHtmlFetcher;
  logger?: Logger;
}

export interface SyncCurrentCollectionResult {
  productRoot: string;
  collectionRoot: string;
  manifest: CollectionManifest;
  tasks: Array<{
    homework: HomeworkManifest;
    task: TaskManifest;
    taskRoot: string;
  }>;
  firstTask?: {
    homework: HomeworkManifest;
    task: TaskManifest;
    taskRoot: string;
  };
}

export async function syncCurrentCollection(
  deps: SyncCurrentCollectionDeps,
): Promise<SyncCurrentCollectionResult> {
  const logger = deps.logger ?? noopLogger;
  const { courseId, categoryId } = await resolveCollectionUrl({
    clipboard: deps.clipboardEnv.clipboard,
    input: deps.input,
  });
  const productRoot = await getProductRoot(deps);
  const syncResult = await syncCollectionIndex({
    client: deps.client,
    productRoot,
    courseId,
    categoryId,
  });
  const { rootDir: collectionRoot, manifest } = syncResult;

  if (deps.fetchCollectionPageHtml) {
    await writeCollectionPageSnapshot({
      fetchCollectionPageHtml: deps.fetchCollectionPageHtml,
      courseId,
      categoryId,
      collectionRoot,
      logger,
    });
  }

  const tasks = manifest.homeworks.flatMap((homework) =>
    homework.tasks.map((task) => ({
      homework,
      task,
      taskRoot: getTaskLayoutPaths({
        collectionRoot,
        homeworkId: homework.homeworkId,
        taskId: task.taskId,
        homeworkDirName: homework.folderName,
        taskDirName: task.folderName,
      }).taskRoot,
    })),
  );
  const firstTask = tasks[0];

  if (!firstTask) {
    return {
      productRoot,
      collectionRoot,
      manifest,
      tasks,
    };
  }

  return {
    productRoot,
    collectionRoot,
    manifest,
    tasks,
    firstTask: {
      homework: firstTask.homework,
      task: firstTask.task,
      taskRoot: firstTask.taskRoot,
    },
  };
}

async function writeCollectionPageSnapshot(input: {
  fetchCollectionPageHtml: CollectionPageHtmlFetcher;
  courseId: string;
  categoryId: string;
  collectionRoot: string;
  logger: Logger;
}): Promise<void> {
  const htmlPath = path.join(input.collectionRoot, 'collection.page.html');
  const metaPath = path.join(input.collectionRoot, 'collection.page.meta.json');
  const errorPath = path.join(input.collectionRoot, 'collection.page.error.txt');
  const fetchedAt = new Date().toISOString();

  try {
    const snapshot = await input.fetchCollectionPageHtml({
      courseId: input.courseId,
      categoryId: input.categoryId,
    });
    const sizeBytes = Buffer.byteLength(snapshot.html ?? '', 'utf8');

    const loggedOutReason = detectLoggedOutShellHtml(snapshot.html ?? '');

    await writeFile(htmlPath, snapshot.html ?? '', 'utf8');

    await writeFile(
      metaPath,
      JSON.stringify(
        {
          ok: true,
          url: snapshot.url,
          courseId: input.courseId,
          categoryId: input.categoryId,
          fetchedAt,
          sizeBytes,
          contentType: snapshot.contentType,
          warning: loggedOutReason,
        },
        null,
        2,
      ),
      'utf8',
    );

    if (loggedOutReason) {
      await writeFile(errorPath, loggedOutReason, 'utf8');
      input.logger.warn(
        `[sync] collection page snapshot looks logged-out (shell page)\n${loggedOutReason}`,
      );
      return;
    }

    input.logger.info(`[sync] collection page snapshot saved: ${htmlPath}`);
  } catch (error) {
    const errorText = formatErrorChain(error);

    input.logger.warn(`[sync] collection page snapshot failed\n${errorText}`);
    await writeFile(errorPath, errorText, 'utf8');
    await writeFile(
      metaPath,
      JSON.stringify(
        {
          ok: false,
          url: `https://www.educoder.net/classrooms/${input.courseId}/shixun_homework/${input.categoryId}?tabs=0`,
          courseId: input.courseId,
          categoryId: input.categoryId,
          fetchedAt,
          error: errorText,
        },
        null,
        2,
      ),
      'utf8',
    );
  }
}

function detectLoggedOutShellHtml(html: string): string | undefined {
  // Heuristic: unauthenticated pages often show a "登录 / 注册" entry in the global nav.
  // We keep this check intentionally specific to avoid false positives.
  if (!html) {
    return undefined;
  }

  const normalized = html.replace(/\s+/g, ' ').trim();
  if (normalized.includes('登录 / 注册') || normalized.includes('登录/注册')) {
    return '疑似未登录/壳页面：章节页 HTML 含“登录/注册”入口。该站点可能是前端渲染（CSR），仅凭原始 HTML 不能 100% 判断登录态；建议结合 meta.sizeBytes、同步索引是否成功、以及 OutputChannel 日志综合判断。';
  }

  return undefined;
}
