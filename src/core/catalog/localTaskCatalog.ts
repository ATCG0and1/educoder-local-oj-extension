import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { loadCollectionManifest, toDisplayName } from '../sync/manifestStore.js';
import { getTaskLayoutPaths } from '../workspace/directoryLayout.js';

export interface LocalTaskCatalogTask {
  taskId: string;
  name: string;
  taskRoot: string;
}

export interface LocalTaskCatalogHomework {
  id: string;
  name: string;
  tasks: LocalTaskCatalogTask[];
}

export interface LocalTaskCatalogChapter {
  id: string;
  name: string;
  courseName?: string;
  homeworks: LocalTaskCatalogHomework[];
}

export async function scanLocalTaskCatalog(productRoot: string): Promise<LocalTaskCatalogChapter[]> {
  const manifestPaths = await findCollectionManifestPaths(productRoot);
  const chapters: LocalTaskCatalogChapter[] = [];

  for (const manifestPath of manifestPaths) {
    const collectionRoot = path.dirname(manifestPath);
    const manifest = await loadCollectionManifest(collectionRoot);
    if (!manifest) {
      continue;
    }

    chapters.push({
      id: manifest.categoryId,
      name: toDisplayName(manifest.categoryName ?? manifest.categoryFolderName, manifest.categoryId),
      courseName: stripOptionalDisplayName(manifest.courseName),
      homeworks: manifest.homeworks.map((homework) => ({
        id: homework.homeworkId,
        name: toDisplayName(homework.name ?? homework.folderName, homework.homeworkId),
        tasks: homework.tasks.map((task) => ({
          taskId: task.taskId,
          name: toDisplayName(task.name ?? task.folderName, task.taskId),
          taskRoot: getTaskLayoutPaths({
            collectionRoot,
            homeworkId: homework.homeworkId,
            taskId: task.taskId,
            homeworkDirName: homework.folderName,
            taskDirName: task.folderName,
          }).taskRoot,
        })),
      })),
    });
  }

  return chapters.sort((left, right) =>
    `${left.courseName ?? ''}\u0000${left.name}`.localeCompare(`${right.courseName ?? ''}\u0000${right.name}`),
  );
}

export async function listLocalTaskEntries(productRoot: string): Promise<
  Array<{
    taskId: string;
    name: string;
    taskRoot: string;
    homeworkName: string;
    chapterName: string;
    courseName?: string;
  }>
> {
  const chapters = await scanLocalTaskCatalog(productRoot);
  return chapters.flatMap((chapter) =>
    chapter.homeworks.flatMap((homework) =>
      homework.tasks.map((task) => ({
        taskId: task.taskId,
        name: task.name,
        taskRoot: task.taskRoot,
        homeworkName: homework.name,
        chapterName: chapter.name,
        courseName: chapter.courseName,
      })),
    ),
  );
}

async function findCollectionManifestPaths(rootDir: string): Promise<string[]> {
  try {
    const entries = await readdir(rootDir, { withFileTypes: true });
    const paths = await Promise.all(
      entries.map(async (entry) => {
        const entryPath = path.join(rootDir, entry.name);

        if (entry.isDirectory()) {
          return findCollectionManifestPaths(entryPath);
        }

        return entry.isFile() && entry.name === 'collection.manifest.json' ? [entryPath] : [];
      }),
    );
    return paths.flat();
  } catch {
    return [];
  }
}

function stripOptionalDisplayName(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  return toDisplayName(value, value);
}
