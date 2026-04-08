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
  problemDir: string;
  statementMarkdownPath: string;
  statementHtmlPath: string;
  problemMetadataPath: string;
  codeDir: string;
  currentCodeDir: string;
  templateCodeDir: string;
  passedCodeDir: string;
  testsDir: string;
  allTestsDir: string;
  visibleTestsDir: string;
  answersDir: string;
  unlockedAnswersDir: string;
  internalAnswersDir: string;
  answerInfoPath: string;
  educoderDir: string;
  metaDir: string;
  rawDir: string;
  logsDir: string;
  syncMetadataPath: string;
  legacyWorkspaceDir: string;
  workspaceDir: string;
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
  const problemDir = path.join(taskRoot, 'problem');
  const codeDir = path.join(taskRoot, 'code');
  const testsDir = path.join(taskRoot, 'tests');
  const answersDir = path.join(taskRoot, 'answers');
  const educoderDir = path.join(taskRoot, '_educoder');
  const currentCodeDir = path.join(codeDir, 'current');
  const templateCodeDir = path.join(educoderDir, 'template');
  const passedCodeDir = path.join(educoderDir, 'passed');
  const hiddenTestsDir = path.join(educoderDir, 'tests', 'hidden');
  const answerDir = answersDir;
  const internalAnswersDir = path.join(educoderDir, 'answers');
  const repositoryDir = path.join(educoderDir, 'repository');

  return {
    taskRoot,
    problemDir,
    statementMarkdownPath: path.join(problemDir, 'statement.md'),
    statementHtmlPath: path.join(problemDir, 'statement.html'),
    problemMetadataPath: path.join(problemDir, 'metadata.json'),
    codeDir,
    currentCodeDir,
    templateCodeDir,
    passedCodeDir,
    testsDir,
    allTestsDir: path.join(testsDir, 'all'),
    visibleTestsDir: path.join(testsDir, 'visible'),
    answersDir,
    unlockedAnswersDir: answersDir,
    internalAnswersDir,
    answerInfoPath: path.join(internalAnswersDir, 'answer_info.json'),
    educoderDir,
    metaDir: path.join(educoderDir, 'meta'),
    rawDir: path.join(educoderDir, 'raw'),
    logsDir: path.join(educoderDir, 'logs'),
    syncMetadataPath: path.join(educoderDir, 'sync.json'),
    legacyWorkspaceDir: path.join(taskRoot, 'workspace'),
    workspaceDir: currentCodeDir,
    hiddenTestsDir,
    answerDir,
    answerUnlockedDir: answersDir,
    templateDir: templateCodeDir,
    passedDir: passedCodeDir,
    historyDir: path.join(educoderDir, 'history'),
    repositoryDir,
    repositoryRemoteDir: path.join(repositoryDir, 'remote'),
    reportsDir: path.join(educoderDir, 'judge'),
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
