import { randomUUID } from 'node:crypto';
import { URL } from 'node:url';
import { buildEduRequestHeaders } from './requestSigner.js';
import { BusinessRequestError, HttpRequestError } from './fetchTransport.js';
import type { HttpHeaders, HttpMethod } from './httpTypes.js';
import type { SessionCookies } from '../auth/sessionManager.js';

export interface EducoderRequestOptions {
  method: HttpMethod;
  path: string;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  headers?: HttpHeaders;
}

export interface EducoderTransport {
  request<T>(url: string, init: {
    method: HttpMethod;
    headers: HttpHeaders;
    body?: string;
  }): Promise<T>;
}

export interface EducoderClientDeps {
  transport: EducoderTransport;
  resolveSession(forceRefresh?: boolean): Promise<SessionCookies>;
  baseUrl?: string;
}

export interface CollectionTaskIndex {
  taskId: string;
  name: string;
  position: number;
}

export interface CollectionHomeworkIndex {
  homeworkId: string;
  name: string;
  shixunIdentifier: string;
  myshixunIdentifier?: string;
  studentWorkId?: string;
  tasks: CollectionTaskIndex[];
}

export interface CollectionIndex {
  courseId: string;
  courseName?: string;
  categoryId: string;
  categoryName?: string;
  homeworks: CollectionHomeworkIndex[];
}

export interface CourseCollectionCategoryIndex {
  categoryId: string;
  name: string;
  position: number;
  url?: string;
}

interface HomeworkCommonsListResponse {
  category_id?: number | string;
  category_name?: string;
  homeworks?: Array<{
    homework_id: number | string;
    name: string;
    shixun_identifier?: string;
    myshixun_identifier?: string;
    student_work_id?: number | string;
    shixun_name?: string;
  }>;
  homework_commons_list?: {
    category_id: number | string;
    category_name?: string;
    homeworks?: Array<{
      homework_id: number | string;
      name: string;
      shixun_identifier?: string;
      myshixun_identifier?: string;
      student_work_id?: number | string;
      shixun_name?: string;
    }>;
  };
}

interface ShixunChallengeResponseItem {
  challenge_id?: number | string;
  id?: number | string;
  identifier?: string;
  name?: string;
  subject?: string;
  position?: number | string;
}

interface ShixunChallengeResponse {
  challenge_list?: ShixunChallengeResponseItem[];
}

interface ShixunExecResponse {
  game_identifier?: string;
  identifier?: string;
  challenge?: {
    subject?: string;
    position?: number | string;
  };
}

interface TaskChainStepResponse {
  prev_game?: string;
  next_game?: string;
  challenge?: {
    subject?: string;
    position?: number | string;
  };
}

interface ChallengeTaskSeed {
  taskId?: string;
  name: string;
  position: number;
}

interface CourseLeftBannerCategoryNode {
  category_id?: number | string;
  category_name?: string;
  position?: number | string;
  second_category_url?: string;
  third_category?: CourseLeftBannerCategoryNode[];
}

interface CourseLeftBannerModule {
  type?: string;
  second_category?: CourseLeftBannerCategoryNode[];
}

interface CourseLeftBannerResponse {
  course_modules?: CourseLeftBannerModule[];
  hidden_modules?: CourseLeftBannerModule[];
}

export class EducoderClient {
  private static readonly MAX_TASK_CHAIN_LENGTH = 50;
  private readonly baseUrl: string;

  constructor(private readonly deps: EducoderClientDeps) {
    this.baseUrl = deps.baseUrl ?? 'https://data.educoder.net';
  }

  async get<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T> {
    return this.request<T>({ method: 'GET', path, query });
  }

  async post<T>(
    path: string,
    body?: unknown,
    query?: Record<string, string | number | undefined>,
  ): Promise<T> {
    return this.request<T>({ method: 'POST', path, query, body });
  }

  async getCollectionIndex({
    courseId,
    categoryId,
    page = 1,
    limit = 100,
  }: {
    courseId: string;
    categoryId: string;
    page?: number;
    limit?: number;
  }): Promise<CollectionIndex> {
    const response = await this.get<HomeworkCommonsListResponse>(
      `/api/courses/${courseId}/homework_commons/list.json`,
      {
        id: courseId,
        type: 4,
        category: categoryId,
        status: 0,
        page,
        limit,
        order: 0,
      },
    );

    const payload = normalizeHomeworkCommonsListPayload(response);
    const homeworks = await Promise.all(
      (payload?.homeworks ?? []).map<Promise<CollectionHomeworkIndex>>(async (homework) => ({
        homeworkId: String(homework.homework_id),
        name: homework.name,
        shixunIdentifier: homework.shixun_identifier ?? '',
        myshixunIdentifier: homework.myshixun_identifier,
        studentWorkId: homework.student_work_id == null ? undefined : String(homework.student_work_id),
        tasks: await this.resolveHomeworkTasks({
          homeworkId: String(homework.homework_id),
          shixunIdentifier: homework.shixun_identifier ?? '',
          homeworkName: homework.shixun_name ?? homework.name,
        }),
      })),
    );

    return {
      courseId,
      courseName: undefined,
      categoryId: String(payload?.category_id ?? categoryId),
      categoryName: payload?.category_name,
      homeworks,
    };
  }

  async getCourseCollectionCategories({
    courseId,
    type = 'shixun_homework',
  }: {
    courseId: string;
    type?: string;
  }): Promise<CourseCollectionCategoryIndex[]> {
    const response = await this.get<CourseLeftBannerResponse>(
      `/api/courses/${courseId}/left_banner.json`,
      {
        id: courseId,
      },
    );

    const discovered = new Map<string, CourseCollectionCategoryIndex>();
    for (const module of [...(response.course_modules ?? []), ...(response.hidden_modules ?? [])]) {
      if ((module.type ?? '').trim() !== type) {
        continue;
      }

      for (const category of flattenCourseLeftBannerCategories(module.second_category ?? [])) {
        if (!category.categoryId) {
          continue;
        }

        const existing = discovered.get(category.categoryId);
        if (!existing || category.position < existing.position) {
          discovered.set(category.categoryId, category);
        }
      }
    }

    return [...discovered.values()].sort((left, right) => left.position - right.position);
  }

  private async resolveHomeworkTasks(input: {
    homeworkId: string;
    shixunIdentifier: string;
    homeworkName: string;
  }): Promise<CollectionTaskIndex[]> {
    if (!input.shixunIdentifier) {
      return [];
    }

    const challengeTasks = await this.loadShixunChallenges(
      input.shixunIdentifier,
      input.homeworkId,
    );
    const challengeTaskIds = challengeTasks
      .filter((task) => Boolean(task.taskId))
      .map((task) => ({
        taskId: task.taskId as string,
        name: task.name,
        position: task.position,
      }));

    const fallbackTask = await this.loadShixunExecTask(
      input.shixunIdentifier,
      input.homeworkName,
      input.homeworkId,
    );
    const taskChain = fallbackTask
      ? await this.loadTaskChain({
          seedTaskId: fallbackTask.taskId,
          homeworkId: input.homeworkId,
          fallbackTasks: challengeTasks,
          fallbackName: input.homeworkName,
        }).catch(() => [])
      : [];

    if (taskChain.length > challengeTaskIds.length) {
      return taskChain;
    }

    if (challengeTaskIds.length > 0 && challengeTaskIds.length === challengeTasks.length) {
      return challengeTaskIds;
    }

    if (taskChain.length > 0) {
      return taskChain;
    }

    if (challengeTaskIds.length > 0) {
      return challengeTaskIds;
    }

    if (!fallbackTask) {
      return [];
    }

    return [
      {
        taskId: fallbackTask.taskId,
        name: challengeTasks[0]?.name ?? fallbackTask.name,
        position: challengeTasks[0]?.position ?? fallbackTask.position,
      },
    ];
  }

  private async loadShixunChallenges(
    shixunIdentifier: string,
    homeworkId: string,
  ): Promise<ChallengeTaskSeed[]> {
    try {
      const response = await this.get<ShixunChallengeResponseItem[] | ShixunChallengeResponse>(
        `/api/shixuns/${shixunIdentifier}/challenges.json`,
        {
          id: shixunIdentifier,
          homework_common_id: homeworkId,
        },
      );

      return normalizeChallengeItems(response)
        .map((challenge, index) => {
          return {
            taskId: challenge.identifier?.trim() || undefined,
            name: challenge.subject?.trim() || challenge.name?.trim() || `第${index + 1}关`,
            position: Number(challenge.position ?? index + 1),
          };
        })
        .sort((left, right) => left.position - right.position);
    } catch {
      return [];
    }
  }

  private async loadShixunExecTask(
    shixunIdentifier: string,
    homeworkName: string,
    homeworkId: string,
  ): Promise<CollectionTaskIndex | undefined> {
    try {
      const response = await this.get<ShixunExecResponse>(
        `/api/shixuns/${shixunIdentifier}/shixun_exec.json`,
        {
          id: shixunIdentifier,
          homework_common_id: homeworkId,
        },
      );

      const taskId = response.game_identifier?.trim() || response.identifier?.trim();
      if (!taskId) {
        return undefined;
      }

      return {
        taskId,
        name: response.challenge?.subject?.trim() || homeworkName,
        position: Number(response.challenge?.position ?? 1),
      };
    } catch {
      return undefined;
    }
  }

  private async loadTaskChain(input: {
    seedTaskId: string;
    homeworkId: string;
    fallbackTasks: ChallengeTaskSeed[];
    fallbackName: string;
  }): Promise<CollectionTaskIndex[]> {
    const detailCache = new Map<string, TaskChainStepResponse>();
    const fallbackByPosition = new Map(
      input.fallbackTasks.map((task) => [task.position, task] as const),
    );
    const loadDetail = async (taskId: string): Promise<TaskChainStepResponse> => {
      const cached = detailCache.get(taskId);
      if (cached) {
        return cached;
      }

      const detail = await this.loadTaskChainStep(taskId, input.homeworkId);
      detailCache.set(taskId, detail);
      return detail;
    };

    let firstTaskId = input.seedTaskId;
    const rewindVisitedTaskIds = new Set<string>();

    while (
      firstTaskId &&
      !rewindVisitedTaskIds.has(firstTaskId) &&
      rewindVisitedTaskIds.size < EducoderClient.MAX_TASK_CHAIN_LENGTH
    ) {
      rewindVisitedTaskIds.add(firstTaskId);
      const detail = await loadDetail(firstTaskId);
      const previousTaskId = detail.prev_game?.trim();
      if (!previousTaskId) {
        break;
      }

      firstTaskId = previousTaskId;
    }

    const tasks: CollectionTaskIndex[] = [];
    const visitedTaskIds = new Set<string>();
    let currentTaskId: string | undefined = firstTaskId;
    let index = 0;

    while (
      currentTaskId &&
      !visitedTaskIds.has(currentTaskId) &&
      index < EducoderClient.MAX_TASK_CHAIN_LENGTH
    ) {
      visitedTaskIds.add(currentTaskId);
      const detail = await loadDetail(currentTaskId);
      const resolvedPosition = Number(detail.challenge?.position ?? index + 1);
      const fallbackTask =
        fallbackByPosition.get(resolvedPosition) ?? input.fallbackTasks[index];

      tasks.push({
        taskId: currentTaskId,
        name:
          detail.challenge?.subject?.trim() ||
          fallbackTask?.name ||
          (index === 0 ? input.fallbackName : `第${index + 1}关`),
        position: Number(resolvedPosition ?? fallbackTask?.position ?? index + 1),
      });

      currentTaskId = detail.next_game?.trim() || undefined;
      index += 1;
    }

    return tasks.sort((left, right) => left.position - right.position);
  }

  private async loadTaskChainStep(
    taskId: string,
    homeworkId: string,
  ): Promise<TaskChainStepResponse> {
    return this.get<TaskChainStepResponse>(`/api/tasks/${taskId}.json`, {
      homework_common_id: homeworkId,
    });
  }

  private async request<T>({
    method,
    path,
    query,
    body,
    headers = {},
  }: EducoderRequestOptions): Promise<T> {
    try {
      return await this.requestOnce<T>({
        method,
        path,
        query,
        body,
        headers,
      });
    } catch (error) {
      if (!isAuthenticationError(error)) {
        throw error;
      }

      return this.requestOnce<T>({
        method,
        path,
        query,
        body,
        headers,
        forceRefresh: true,
      });
    }
  }

  private async requestOnce<T>({
    method,
    path,
    query,
    body,
    headers = {},
    forceRefresh = false,
  }: EducoderRequestOptions & { forceRefresh?: boolean }): Promise<T> {
    const session = forceRefresh
      ? await this.deps.resolveSession(true)
      : await this.deps.resolveSession();
    const timestamp = Date.now().toString();
    const url = new URL(path, this.baseUrl);

    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }

    return this.deps.transport.request<T>(url.toString(), {
      method,
      headers: {
        ...buildEduRequestHeaders({ method, timestamp }),
        ...buildSessionHeaders(session),
        'Content-Type': body === undefined ? 'application/json' : 'application/json',
        'X-Request-Id': randomUUID(),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }
}

function normalizeHomeworkCommonsListPayload(
  response: HomeworkCommonsListResponse,
): HomeworkCommonsListResponse['homework_commons_list'] | HomeworkCommonsListResponse {
  return response.homework_commons_list ?? response;
}

function normalizeChallengeItems(
  response: ShixunChallengeResponseItem[] | ShixunChallengeResponse,
): ShixunChallengeResponseItem[] {
  return Array.isArray(response) ? response : response.challenge_list ?? [];
}

function isAuthenticationError(error: unknown): boolean {
  if (error instanceof BusinessRequestError) {
    return error.status === 401 || error.businessMessage.includes('请登录后再操作');
  }

  if (error instanceof HttpRequestError) {
    return error.status === 401;
  }

  return false;
}

function buildSessionHeaders(session: SessionCookies): HttpHeaders {
  const cookieParts = [`_educoder_session=${session._educoder_session}`];
  if (session.autologin_trustie) {
    cookieParts.push(`autologin_trustie=${session.autologin_trustie}`);
  }

  return {
    Cookie: cookieParts.join('; '),
    'Pc-Authorization': session._educoder_session,
  };
}

function flattenCourseLeftBannerCategories(
  nodes: CourseLeftBannerCategoryNode[],
): CourseCollectionCategoryIndex[] {
  const categories: CourseCollectionCategoryIndex[] = [];

  const visit = (node: CourseLeftBannerCategoryNode): void => {
    if (node.category_id != null) {
      categories.push({
        categoryId: String(node.category_id),
        name: node.category_name?.trim() || String(node.category_id),
        position: Number(node.position ?? categories.length + 1),
        url: node.second_category_url?.trim() || undefined,
      });
    }

    for (const child of node.third_category ?? []) {
      visit(child);
    }
  };

  for (const node of nodes) {
    visit(node);
  }

  return categories;
}
