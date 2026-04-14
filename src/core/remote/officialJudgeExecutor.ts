import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import type { EducoderClient } from '../api/educoderClient.js';
import type { ExecuteRemoteJudgeInput, RemoteOfficialJudgeResult } from './officialJudge.js';
import { normalizeSafeRelativeFilePath } from '../workspace/workspaceInit.js';
import { resolveTaskPackagePaths } from '../workspace/taskPackageMigration.js';

export const OFFICIAL_JUDGE_META_REQUIRED_ERROR_MESSAGE =
  '任务元数据缺失，请先打开题目完成同步后再运行官方评测。';
export const OFFICIAL_JUDGE_CODE_REQUIRED_ERROR_MESSAGE = '当前代码目录中没有可提交的源文件。';

export interface OfficialJudgeTaskMeta {
  taskId: string;
  homeworkId?: string;
  gameId?: number;
  challengeId?: number;
  shixunEnvironmentId?: number;
  currentUserId?: number;
  userLogin?: string;
  myshixunIdentifier?: string;
  editablePaths?: string[];
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

interface TaskDetailMetaResponse {
  game?: {
    id?: number;
  };
  challenge?: {
    id?: number;
    path?: string;
  };
  myshixun?: {
    identifier?: string;
  };
  code_editor?: {
    shixun_environment_id?: number;
  };
  shixun_environments?: Array<{
    shixun_environment_id?: number;
  }>;
  user?: {
    user_id?: number;
    login?: string;
  };
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
    const storedMeta = await readOfficialJudgeMeta(taskRoot);
    const meta = await refreshOfficialJudgeMeta(client, storedMeta);
    const workspaceFiles = await readWorkspaceFiles(taskRoot, meta);

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
      throw new Error(OFFICIAL_JUDGE_CODE_REQUIRED_ERROR_MESSAGE);
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

async function refreshOfficialJudgeMeta(
  client: EducoderClient,
  storedMeta: OfficialJudgeTaskMeta,
): Promise<OfficialJudgeTaskMeta> {
  const get = (client as { get?: EducoderClient['get'] }).get;
  if (typeof get !== 'function') {
    return storedMeta;
  }

  try {
    const detail = await get<TaskDetailMetaResponse>(
      `/api/tasks/${storedMeta.taskId}.json`,
      {
        homework_common_id: storedMeta.homeworkId,
      },
    );

    const refreshedEditablePaths = parseEditablePaths(detail.challenge?.path);

    return {
      ...storedMeta,
      gameId: detail.game?.id ?? storedMeta.gameId,
      challengeId: detail.challenge?.id ?? storedMeta.challengeId,
      shixunEnvironmentId:
        detail.code_editor?.shixun_environment_id ??
        detail.shixun_environments?.[0]?.shixun_environment_id ??
        storedMeta.shixunEnvironmentId,
      currentUserId: detail.user?.user_id ?? storedMeta.currentUserId,
      userLogin: detail.user?.login ?? storedMeta.userLogin,
      myshixunIdentifier: detail.myshixun?.identifier ?? storedMeta.myshixunIdentifier,
      editablePaths:
        refreshedEditablePaths.length > 0 ? refreshedEditablePaths : storedMeta.editablePaths,
    };
  } catch {
    return storedMeta;
  }
}

function parseEditablePaths(rawPath: string | undefined): string[] {
  if (!rawPath) {
    return [];
  }

  return rawPath
    .split(/[;；,\r\n]+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

export async function readOfficialJudgeMeta(taskRoot: string): Promise<OfficialJudgeTaskMeta> {
  try {
    return JSON.parse(
      await readFile(path.join(taskRoot, '_educoder', 'meta', 'task.json'), 'utf8'),
    ) as OfficialJudgeTaskMeta;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(OFFICIAL_JUDGE_META_REQUIRED_ERROR_MESSAGE);
    }

    throw error;
  }
}

async function readWorkspaceFiles(
  taskRoot: string,
  meta?: OfficialJudgeTaskMeta,
): Promise<Array<{ path: string; content: string }>> {
  const resolvedPaths = await resolveTaskPackagePaths(taskRoot);
  const workspaceDir = resolvedPaths.currentCodeDir;
  const relativePaths = await collectWorkspaceFiles(workspaceDir, workspaceDir);
  const orderedPaths = orderWorkspacePaths(relativePaths, meta?.editablePaths);
  return Promise.all(
    orderedPaths.map(async (relativePath) => ({
      path: relativePath,
      content: await readFile(path.join(workspaceDir, relativePath), 'utf8'),
    })),
  );
}

function orderWorkspacePaths(
  relativePaths: string[],
  editablePaths: string[] | undefined,
): string[] {
  if (editablePaths === undefined) {
    return relativePaths;
  }

  if (editablePaths.length === 0) {
    return [];
  }

  const existing = new Set(relativePaths);
  const orderedEditablePaths = editablePaths
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => {
      try {
        return normalizeSafeRelativeFilePath(item);
      } catch {
        return undefined;
      }
    })
    .filter((item): item is string => Boolean(item))
    .filter((item, index, items) => items.indexOf(item) === index)
    .filter((item) => existing.has(item));

  return orderedEditablePaths;
}

async function collectWorkspaceFiles(rootDir: string, currentDir: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(currentDir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }

    throw error;
  }
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
