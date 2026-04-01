import { randomUUID } from 'node:crypto';
import { URL } from 'node:url';
import { buildEduRequestHeaders } from './requestSigner.js';
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
  resolveSession(): Promise<SessionCookies>;
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
  categoryId: string;
  categoryName?: string;
  homeworks: CollectionHomeworkIndex[];
}

interface HomeworkCommonsListResponse {
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

export class EducoderClient {
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

    const payload = response.homework_commons_list;
    const homeworks = (payload?.homeworks ?? []).map<CollectionHomeworkIndex>((homework) => ({
      homeworkId: String(homework.homework_id),
      name: homework.name,
      shixunIdentifier: homework.shixun_identifier ?? '',
      myshixunIdentifier: homework.myshixun_identifier,
      studentWorkId: homework.student_work_id == null ? undefined : String(homework.student_work_id),
      tasks: homework.myshixun_identifier
        ? [
            {
              taskId: homework.myshixun_identifier,
              name: homework.shixun_name ?? homework.name,
              position: 1,
            },
          ]
        : [],
    }));

    return {
      courseId,
      categoryId: String(payload?.category_id ?? categoryId),
      categoryName: payload?.category_name,
      homeworks,
    };
  }

  private async request<T>({
    method,
    path,
    query,
    body,
    headers = {},
  }: EducoderRequestOptions): Promise<T> {
    const session = await this.deps.resolveSession();
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
