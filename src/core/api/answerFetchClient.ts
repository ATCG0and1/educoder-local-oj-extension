import type { EducoderGetClient } from './taskDetailClient.js';

export interface FetchAnswerInfoInput {
  taskId: string;
}

export interface UnlockAnswerInput {
  taskId: string;
  answerId: number;
}

interface AnswerInfoResponseItem {
  answer_id?: number;
  answerId?: number;
  id?: number;
  answer_name?: string;
  answerName?: string;
  name?: string;
  answer_score?: number;
  score?: number;
  answer_ratio?: number;
  ratio?: number;
  view_time?: string | null;
  viewTime?: string | null;
  answer_contents?: string;
  answer_content?: string;
  contents?: string;
  content?: string;
}

interface AnswerInfoResponse {
  status?: number;
  message?: unknown;
}

type UnlockAnswerResponse = unknown;

export interface AnswerEntry {
  answerId?: number;
  name: string;
  score?: number;
  ratio?: number;
  viewTime?: string;
  content?: string;
}

export interface UnlockedAnswerContent {
  answerId: number;
  content: string;
  unlocked: boolean;
}

export interface AnswerInfoSummary {
  status?: number;
  entries: AnswerEntry[];
}

export interface AnswerFetchClientLike {
  fetchAnswerInfo(input: FetchAnswerInfoInput): Promise<AnswerInfoSummary>;
  unlockAnswer(input: UnlockAnswerInput): Promise<UnlockedAnswerContent>;
}

export class AnswerFetchClient implements AnswerFetchClientLike {
  constructor(private readonly client: EducoderGetClient) {}

  async fetchAnswerInfo(input: FetchAnswerInfoInput): Promise<AnswerInfoSummary> {
    const response = await this.client.get<AnswerInfoResponse>(
      `/api/tasks/${input.taskId}/get_answer_info.json`,
    );

    return normalizeAnswerInfo(response);
  }

  async unlockAnswer(input: UnlockAnswerInput): Promise<UnlockedAnswerContent> {
    const response = await this.client.get<UnlockAnswerResponse>(
      `/api/tasks/${input.taskId}/unlock_answer.json`,
      {
        answer_id: input.answerId,
      },
    );

    return normalizeUnlockedAnswer(response, input.answerId);
  }
}

export function normalizeAnswerInfo(response: AnswerInfoResponse): AnswerInfoSummary {
  const entries = extractAnswerEntries(response);

  return {
    status: response.status,
    entries: entries.map((item, index) => ({
      answerId: normalizeNumber(item.answer_id ?? item.answerId ?? item.id),
      name:
        item.answer_name?.trim() ||
        item.answerName?.trim() ||
        item.name?.trim() ||
        `答案 ${index + 1}`,
      score: normalizeNumber(item.answer_score ?? item.score),
      ratio: normalizeNumber(item.answer_ratio ?? item.ratio),
      viewTime: normalizeString(item.view_time ?? item.viewTime) ?? undefined,
      content:
        normalizeString(
          item.answer_contents ??
            item.answer_content ??
            item.contents ??
            item.content,
        ) ?? undefined,
    })),
  };
}

export function normalizeUnlockedAnswer(
  response: UnlockAnswerResponse,
  answerId: number,
): UnlockedAnswerContent {
  const content = resolveNestedString(
    response,
    ['contents', 'content'],
    ['message', 'data', 'result'],
  ) ?? '';
  return {
    answerId,
    content,
    unlocked: content.length > 0,
  };
}

function extractAnswerEntries(response: AnswerInfoResponse): AnswerInfoResponseItem[] {
  const directCandidates = [
    response.message,
    (response as { data?: unknown }).data,
    response,
  ];

  for (const candidate of directCandidates) {
    const entries = resolveNestedArray(candidate, ['answers', 'entries', 'list', 'items', 'data', 'message']);
    if (entries.length > 0) {
      return entries;
    }

    const directEntry = resolveSingleEntry(candidate);
    if (directEntry) {
      return [directEntry];
    }
  }

  return [];
}

function resolveNestedArray(
  payload: unknown,
  nestedKeys: string[],
): AnswerInfoResponseItem[] {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is AnswerInfoResponseItem => typeof item === 'object' && item !== null);
  }

  if (!payload || typeof payload !== 'object') {
    return [];
  }

  for (const key of nestedKeys) {
    if (!(key in payload)) {
      continue;
    }

    const entries = resolveNestedArray((payload as Record<string, unknown>)[key], nestedKeys);
    if (entries.length > 0 || Array.isArray((payload as Record<string, unknown>)[key])) {
      return entries;
    }
  }

  return [];
}

function resolveNestedString(
  payload: unknown,
  valueKeys: string[],
  nestedKeys: string[],
): string | undefined {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  for (const key of valueKeys) {
    const value = normalizeString((payload as Record<string, unknown>)[key]);
    if (value !== undefined) {
      return value;
    }
  }

  for (const key of nestedKeys) {
    const nested = resolveNestedString((payload as Record<string, unknown>)[key], valueKeys, nestedKeys);
    if (nested !== undefined) {
      return nested;
    }
  }

  return undefined;
}

function resolveSingleEntry(payload: unknown): AnswerInfoResponseItem | undefined {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return undefined;
  }

  const candidate = payload as Record<string, unknown>;
  const entryKeys = [
    'answer_id',
    'answerId',
    'id',
    'answer_name',
    'answerName',
    'name',
    'answer_score',
    'score',
    'answer_ratio',
    'ratio',
    'view_time',
    'viewTime',
    'answer_contents',
    'answer_content',
    'contents',
    'content',
  ];

  return entryKeys.some((key) => key in candidate)
    ? (candidate as AnswerInfoResponseItem)
    : undefined;
}

function normalizeString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function normalizeNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
