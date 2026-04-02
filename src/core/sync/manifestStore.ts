import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { CollectionHomeworkIndex, CollectionIndex, CollectionTaskIndex } from '../api/educoderClient.js';
import { formatStableFolderName } from '../workspace/nameSanitizer.js';

export interface TaskManifest extends CollectionTaskIndex {
  folderName: string;
}

export interface HomeworkManifest {
  homeworkId: string;
  name: string;
  folderName: string;
  shixunIdentifier: string;
  myshixunIdentifier?: string;
  studentWorkId?: string;
  tasks: TaskManifest[];
}

export interface CollectionManifest {
  courseId: string;
  courseName?: string;
  courseFolderName: string;
  categoryId: string;
  categoryName?: string;
  categoryFolderName: string;
  homeworks: HomeworkManifest[];
}

export async function loadCollectionManifest(rootDir: string): Promise<CollectionManifest | undefined> {
  const manifestPath = path.join(rootDir, 'collection.manifest.json');

  try {
    return JSON.parse(await readFile(manifestPath, 'utf8')) as CollectionManifest;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined;
    }

    throw error;
  }
}

export function mergeCollectionManifests(
  existing: CollectionManifest | undefined,
  incoming: CollectionIndex,
): CollectionManifest {
  const byHomeworkId = new Map<string, HomeworkManifest>();

  for (const homework of existing?.homeworks ?? []) {
    byHomeworkId.set(homework.homeworkId, {
      ...homework,
      tasks: [...homework.tasks],
    });
  }

  for (const homework of incoming.homeworks) {
    const mergedHomework = byHomeworkId.get(homework.homeworkId) ?? {
      homeworkId: homework.homeworkId,
      name: homework.name,
      folderName: formatStableFolderName(homework.name, homework.homeworkId, {
        fallbackName: '作业',
      }),
      shixunIdentifier: homework.shixunIdentifier,
      myshixunIdentifier: homework.myshixunIdentifier,
      studentWorkId: homework.studentWorkId,
      tasks: [],
    };

    mergedHomework.name = homework.name;
    mergedHomework.folderName = formatStableFolderName(homework.name, homework.homeworkId, {
      fallbackName: '作业',
    });
    mergedHomework.shixunIdentifier = homework.shixunIdentifier;
    mergedHomework.myshixunIdentifier = homework.myshixunIdentifier;
    mergedHomework.studentWorkId = homework.studentWorkId;
    mergedHomework.tasks = mergeTasks(mergedHomework.tasks, homework.tasks);

    byHomeworkId.set(homework.homeworkId, mergedHomework);
  }

  return {
    courseId: incoming.courseId,
    courseName: incoming.courseName,
    courseFolderName: formatStableFolderName(incoming.courseName, incoming.courseId, {
      fallbackName: '课程',
    }),
    categoryId: incoming.categoryId,
    categoryName: incoming.categoryName,
    categoryFolderName: formatStableFolderName(incoming.categoryName, incoming.categoryId, {
      fallbackName: '章节',
    }),
    homeworks: [...byHomeworkId.values()],
  };
}

export async function writeCollectionManifestArtifacts(
  rootDir: string,
  manifest: CollectionManifest,
): Promise<void> {
  await mkdir(rootDir, { recursive: true });
  await writeJson(path.join(rootDir, 'collection.manifest.json'), manifest);

  for (const homework of manifest.homeworks) {
    const homeworkDir = path.join(rootDir, 'homeworks', homework.folderName);
    await mkdir(path.join(homeworkDir, 'tasks'), { recursive: true });
    await writeJson(path.join(homeworkDir, 'homework.manifest.json'), homework);

    for (const task of homework.tasks) {
      const taskDir = path.join(homeworkDir, 'tasks', task.folderName);
      await mkdir(taskDir, { recursive: true });
      await writeJson(path.join(taskDir, 'task.manifest.json'), task);
    }
  }
}

function mergeTasks(existing: TaskManifest[], incoming: CollectionTaskIndex[]): TaskManifest[] {
  const byTaskId = new Map(existing.map((task) => [task.taskId, task]));

  for (const task of incoming) {
    byTaskId.set(task.taskId, {
      taskId: task.taskId,
      name: task.name,
      position: task.position,
      folderName: formatStableFolderName(task.name, task.taskId, {
        index: task.position,
        fallbackName: '任务',
      }),
    });
  }

  return [...byTaskId.values()].sort((left, right) => left.position - right.position);
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}
