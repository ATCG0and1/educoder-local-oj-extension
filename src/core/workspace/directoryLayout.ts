import path from 'node:path';

export interface TaskLayoutInput {
  collectionRoot: string;
  homeworkId: string;
  taskId: string;
}

export interface TaskLayoutPaths {
  taskRoot: string;
  workspaceDir: string;
  educoderDir: string;
  metaDir: string;
  hiddenTestsDir: string;
  answerDir: string;
  templateDir: string;
  passedDir: string;
  historyDir: string;
  reportsDir: string;
  vscodeDir: string;
}

export function getTaskLayoutPaths({
  collectionRoot,
  homeworkId,
  taskId,
}: TaskLayoutInput): TaskLayoutPaths {
  const taskRoot = path.join(collectionRoot, 'homeworks', homeworkId, 'tasks', taskId);
  const educoderDir = path.join(taskRoot, '_educoder');

  return {
    taskRoot,
    workspaceDir: path.join(taskRoot, 'workspace'),
    educoderDir,
    metaDir: path.join(educoderDir, 'meta'),
    hiddenTestsDir: path.join(educoderDir, 'tests', 'hidden'),
    answerDir: path.join(educoderDir, 'answer'),
    templateDir: path.join(educoderDir, 'template'),
    passedDir: path.join(educoderDir, 'passed'),
    historyDir: path.join(educoderDir, 'history'),
    reportsDir: path.join(taskRoot, 'reports'),
    vscodeDir: path.join(taskRoot, '.vscode'),
  };
}
