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
  answer_name?: string;
  answer_score?: number;
  answer_ratio?: number;
  view_time?: string | null;
  answer_contents?: string;
}

interface AnswerInfoResponse {
  status?: number;
  message?: AnswerInfoResponseItem[];
}

interface UnlockAnswerResponse {
  contents?: string;
}

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
  return {
    status: response.status,
    entries: (response.message ?? []).map((item, index) => ({
      answerId: item.answer_id,
      name: item.answer_name?.trim() || `答案 ${index + 1}`,
      score: item.answer_score,
      ratio: item.answer_ratio,
      viewTime: item.view_time ?? undefined,
      content: item.answer_contents,
    })),
  };
}

export function normalizeUnlockedAnswer(
  response: UnlockAnswerResponse,
  answerId: number,
): UnlockedAnswerContent {
  const content = response.contents ?? '';
  return {
    answerId,
    content,
    unlocked: content.length > 0,
  };
}
