import path from 'node:path';
import { formatStableFolderName } from './nameSanitizer.js';

export interface TaskLayoutInput {
  collectionRoot: string;
  homeworkId: string;
  taskId: string;
  homeworkDirName?: string;
  taskDirName?: string;
}

export interface CollectionLayoutInput {
  productRoot: string;
  courseId: string;
  courseName?: string;
  categoryId: string;
  categoryName?: string;
}

export interface TaskLayoutPaths {
  taskRoot: string;
  workspaceDir: string;
  educoderDir: string;
  metaDir: string;
  hiddenTestsDir: string;
  answerDir: string;
  answerUnlockedDir: string;
  templateDir: string;
  passedDir: string;
  historyDir: string;
  repositoryDir: string;
  repositoryRemoteDir: string;
  reportsDir: string;
  vscodeDir: string;
}

export function getTaskLayoutPaths({
  collectionRoot,
  homeworkId,
  taskId,
  homeworkDirName,
  taskDirName,
}: TaskLayoutInput): TaskLayoutPaths {
  const taskRoot = path.join(
    collectionRoot,
    'homeworks',
    homeworkDirName ?? homeworkId,
    'tasks',
    taskDirName ?? taskId,
  );
  const educoderDir = path.join(taskRoot, '_educoder');
  const answerDir = path.join(educoderDir, 'answer');
  const repositoryDir = path.join(educoderDir, 'repository');

  return {
    taskRoot,
    workspaceDir: path.join(taskRoot, 'workspace'),
    educoderDir,
    metaDir: path.join(educoderDir, 'meta'),
    hiddenTestsDir: path.join(educoderDir, 'tests', 'hidden'),
    answerDir,
    answerUnlockedDir: path.join(answerDir, 'unlocked'),
    templateDir: path.join(educoderDir, 'template'),
    passedDir: path.join(educoderDir, 'passed'),
    historyDir: path.join(educoderDir, 'history'),
    repositoryDir,
    repositoryRemoteDir: path.join(repositoryDir, 'remote'),
    reportsDir: path.join(taskRoot, 'reports'),
    vscodeDir: path.join(taskRoot, '.vscode'),
  };
}

export function getCollectionRoot({
  productRoot,
  courseId,
  courseName,
  categoryId,
  categoryName,
}: CollectionLayoutInput): string {
  return path.join(
    productRoot,
    formatStableFolderName(courseName, courseId, { fallbackName: '课程' }),
    formatStableFolderName(categoryName, categoryId, { fallbackName: '章节' }),
  );
}
