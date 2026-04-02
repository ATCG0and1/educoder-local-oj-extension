import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import type { EducoderClient } from '../api/educoderClient.js';
import type { ExecuteRemoteJudgeInput, RemoteOfficialJudgeResult } from './officialJudge.js';

export interface OfficialJudgeTaskMeta {
  taskId: string;
  homeworkId?: string;
  gameId?: number;
  challengeId?: number;
  shixunEnvironmentId?: number;
  currentUserId?: number;
  userLogin?: string;
  myshixunIdentifier?: string;
}

interface UpdateFileResponse {
  content?: {
    commitID?: string;
  };
  resubmit?: string;
  sec_key?: string;
  content_modified?: number;
}

interface GameBuildResponse {
  status?: number;
  message?: string;
  had_done?: number;
}

export type OfficialJudgeExecutor = (
  input: ExecuteRemoteJudgeInput,
) => Promise<RemoteOfficialJudgeResult>;

let configuredDefaultOfficialJudgeExecutor: OfficialJudgeExecutor | undefined;

export function configureDefaultOfficialJudgeExecutor(
  executor: OfficialJudgeExecutor | undefined,
): void {
  configuredDefaultOfficialJudgeExecutor = executor;
}

export function getDefaultOfficialJudgeExecutor(): OfficialJudgeExecutor {
  if (!configuredDefaultOfficialJudgeExecutor) {
    throw new Error('Official judge executor is not configured.');
  }

  return configuredDefaultOfficialJudgeExecutor;
}

export function createOfficialJudgeExecutor(client: EducoderClient): OfficialJudgeExecutor {
  return async ({ taskRoot }) => {
    const meta = await readOfficialJudgeMeta(taskRoot);
    const workspaceFiles = await readWorkspaceFiles(taskRoot);

    if (!meta.myshixunIdentifier || !meta.userLogin) {
      throw new Error('任务元数据缺少官方评测所需的 myshixun 标识或用户登录名。');
    }

    let updateResult: UpdateFileResponse | undefined;

    for (const [index, file] of workspaceFiles.entries()) {
      updateResult = await client.post<UpdateFileResponse>(
        `/api/myshixuns/${meta.myshixunIdentifier}/update_file.json`,
        {
          path: file.path,
          evaluate: index === workspaceFiles.length - 1 ? 1 : 0,
          content: file.content,
          game_id: meta.gameId,
          tab_type: 1,
          exercise_id: null,
          homework_common_id: meta.homeworkId,
          extras: {
            exercise_id: '',
            question_id: '',
            challenge_id: meta.challengeId,
            subject_id: '',
            homework_common_id: meta.homeworkId,
            competition_entry_id: '',
            currentUserId: meta.currentUserId,
          },
        },
        {
          zzud: meta.userLogin,
        },
      );
    }

    if (!updateResult) {
      throw new Error('workspace 中没有可提交的源文件。');
    }

    const gameBuild = await client.post<GameBuildResponse>(
      `/api/tasks/${meta.taskId}/game_build.json`,
      {
        sec_key: updateResult.sec_key,
        resubmit: updateResult.resubmit,
        first: 1,
        content_modified: updateResult.content_modified ?? 0,
        shixun_environment_id: meta.shixunEnvironmentId,
        tab_type: 1,
        extras: {
          exercise_id: '',
          question_id: '',
          challenge_id: meta.challengeId,
          subject_id: '',
          homework_common_id: meta.homeworkId,
          competition_entry_id: '',
          commitID: updateResult.content?.commitID,
          currentUserId: meta.currentUserId,
        },
      },
      {
        zzud: meta.userLogin,
      },
    );

    return {
      verdict: gameBuild.status === 1 ? 'passed' : 'failed',
      score: gameBuild.status === 1 ? 100 : 0,
      message: gameBuild.message,
      raw: {
        updateResult,
        gameBuild,
      },
    };
  };
}

export async function readOfficialJudgeMeta(taskRoot: string): Promise<OfficialJudgeTaskMeta> {
  return JSON.parse(
    await readFile(path.join(taskRoot, '_educoder', 'meta', 'task.json'), 'utf8'),
  ) as OfficialJudgeTaskMeta;
}

async function readWorkspaceFiles(taskRoot: string): Promise<Array<{ path: string; content: string }>> {
  const workspaceDir = path.join(taskRoot, 'workspace');
  const relativePaths = await collectWorkspaceFiles(workspaceDir, workspaceDir);
  return Promise.all(
    relativePaths.map(async (relativePath) => ({
      path: relativePath,
      content: await readFile(path.join(workspaceDir, relativePath), 'utf8'),
    })),
  );
}

async function collectWorkspaceFiles(rootDir: string, currentDir: string): Promise<string[]> {
  const entries = await readdir(currentDir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        return collectWorkspaceFiles(rootDir, absolutePath);
      }

      return [path.relative(rootDir, absolutePath).replaceAll('\\', '/')];
    }),
  );

  return nested.flat().sort((left, right) => left.localeCompare(right));
}
