import type { HiddenTestSetPayload } from './hiddenTestFetchClient.js';
import {
  normalizeProblemMaterialLinks,
  type ProblemMaterial,
  type ProblemSample,
} from './problemFetchClient.js';

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
  problemMaterial?: ProblemMaterial;
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
    description?: string;
    description_md?: string;
    task_pass?: string;
    content?: string;
    samples?: Array<{
      input?: string;
      output?: string;
      name?: string;
    }>;
    exec_time?: number | string;
    memory_limit?: number | string;
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
  description?: string;
  description_md?: string;
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
    problemMaterial: extractProblemMaterial(response, input),
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

function extractProblemMaterial(
  response: TaskDetailResponse,
  input: LoadTaskDetailInput,
): ProblemMaterial | undefined {
  const title =
    response.challenge?.subject?.trim() ||
    response.homework_common_name?.trim() ||
    input.taskId;
  const statementMarkdown = firstNonEmptyString(
    response.challenge?.task_pass,
    response.challenge?.description_md,
    response.description_md,
  );
  const statementHtml = firstNonEmptyString(
    response.challenge?.description,
    response.challenge?.content,
    response.description,
  );
  const samples = normalizeProblemSamples(
    response.challenge?.samples,
    response.test_sets ?? [],
  );
  const limits = compactRecord({
    exec_time: response.challenge?.exec_time,
    memory_limit: response.challenge?.memory_limit,
  });

  if (!statementMarkdown && !statementHtml && samples.length === 0 && Object.keys(limits).length === 0) {
    return undefined;
  }

  return normalizeProblemMaterialLinks({
    title,
    statementMarkdown,
    statementHtml,
    samples,
    limits: Object.keys(limits).length > 0 ? limits : undefined,
    raw: response,
    pageSnapshotUrl: buildTaskPageUrl(input),
  });
}

function normalizeProblemSamples(
  challengeSamples:
    | Array<{
        input?: string;
        output?: string;
        name?: string;
      }>
    | undefined,
  fallbackTestSets: HiddenTestSetPayload[],
): ProblemSample[] {
  const normalizedChallengeSamples = (challengeSamples ?? [])
    .filter(
      (sample): sample is NonNullable<typeof challengeSamples>[number] =>
        Boolean(sample) &&
        typeof sample.input === 'string' &&
        typeof sample.output === 'string',
    )
    .map((sample, index) => ({
      name: sample.name?.trim() || `样例 ${index + 1}`,
      input: sample.input ?? '',
      output: sample.output ?? '',
    }));

  if (normalizedChallengeSamples.length > 0) {
    return normalizedChallengeSamples;
  }

  return fallbackTestSets
    .filter((sample) => sample.is_public !== false)
    .filter((sample): sample is HiddenTestSetPayload & { input: string; output: string } =>
      typeof sample.input === 'string' && typeof sample.output === 'string',
    )
    .map((sample, index) => ({
      name: `样例 ${index + 1}`,
      input: sample.input,
      output: sample.output,
    }));
}

function firstNonEmptyString(...values: Array<string | undefined>): string | undefined {
  return values.map((value) => value?.trim()).find((value) => Boolean(value));
}

function compactRecord(
  value: Record<string, string | number | undefined>,
): Record<string, string | number> {
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string | number] =>
        entry[1] !== undefined && entry[1] !== '',
    ),
  );
}

function buildTaskPageUrl(input: LoadTaskDetailInput): string {
  const taskUrl = new URL(`https://www.educoder.net/tasks/${input.taskId}`);
  if (input.homeworkId) {
    taskUrl.searchParams.set('homework_common_id', input.homeworkId);
  }

  return taskUrl.toString();
}
