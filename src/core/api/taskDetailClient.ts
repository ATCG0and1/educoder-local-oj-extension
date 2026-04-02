import type { HiddenTestSetPayload } from './hiddenTestFetchClient.js';

export interface EducoderGetClient {
  get<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T>;
}

export interface LoadTaskDetailInput {
  taskId: string;
  homeworkId?: string;
}

export interface TaskDetailSummary {
  taskId: string;
  homeworkId?: string;
  taskName: string;
  homeworkName?: string;
  challengeId?: number;
  challengePosition?: number;
  gameId?: number;
  myshixunId?: number;
  myshixunIdentifier?: string;
  shixunIdentifier?: string;
  shixunEnvironmentId?: number;
  currentUserId?: number;
  userLogin?: string;
  secKey?: string;
  editablePaths: string[];
  testSets: HiddenTestSetPayload[];
  raw: unknown;
}

interface TaskDetailResponse {
  game?: {
    id?: number;
    myshixun_id?: number;
    identifier?: string;
  };
  challenge?: {
    id?: number;
    subject?: string;
    position?: number;
    path?: string;
  };
  shixun?: {
    identifier?: string;
    name?: string;
  };
  myshixun?: {
    id?: number;
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
  sec_key?: string;
  homework_common_id?: string | number;
  homework_common_name?: string;
  test_sets?: HiddenTestSetPayload[];
}

export interface TaskDetailClientLike {
  getTaskDetail(input: LoadTaskDetailInput): Promise<TaskDetailSummary>;
}

export class TaskDetailClient implements TaskDetailClientLike {
  constructor(private readonly client: EducoderGetClient) {}

  async getTaskDetail(input: LoadTaskDetailInput): Promise<TaskDetailSummary> {
    const response = await this.client.get<TaskDetailResponse>(
      `/api/tasks/${input.taskId}.json`,
      {
        homework_common_id: input.homeworkId,
      },
    );

    return normalizeTaskDetail(response, input);
  }
}

export function normalizeTaskDetail(
  response: TaskDetailResponse,
  input: LoadTaskDetailInput,
): TaskDetailSummary {
  return {
    taskId: input.taskId,
    homeworkId:
      input.homeworkId ??
      (response.homework_common_id == null ? undefined : String(response.homework_common_id)),
    taskName:
      response.challenge?.subject?.trim() ||
      response.homework_common_name?.trim() ||
      response.shixun?.name?.trim() ||
      input.taskId,
    homeworkName: response.homework_common_name?.trim() || response.shixun?.name?.trim(),
    challengeId: response.challenge?.id,
    challengePosition: response.challenge?.position,
    gameId: response.game?.id,
    myshixunId: response.myshixun?.id ?? response.game?.myshixun_id,
    myshixunIdentifier: response.myshixun?.identifier,
    shixunIdentifier: response.shixun?.identifier,
    shixunEnvironmentId:
      response.code_editor?.shixun_environment_id ??
      response.shixun_environments?.[0]?.shixun_environment_id,
    currentUserId: response.user?.user_id,
    userLogin: response.user?.login,
    secKey: response.sec_key,
    editablePaths: parseEditablePaths(response.challenge?.path),
    testSets: response.test_sets ?? [],
    raw: response,
  };
}

export function parseEditablePaths(rawPath: string | undefined): string[] {
  if (!rawPath) {
    return [];
  }

  return rawPath
    .split(/[;；,\r\n]+/)
    .map((value) => value.trim())
    .filter(Boolean);
}
