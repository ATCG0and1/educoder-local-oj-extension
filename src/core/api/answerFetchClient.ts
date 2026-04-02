import type { EducoderGetClient } from './taskDetailClient.js';

export interface FetchAnswerInfoInput {
  taskId: string;
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

export interface AnswerEntry {
  answerId?: number;
  name: string;
  score?: number;
  ratio?: number;
  viewTime?: string;
  content?: string;
}

export interface AnswerInfoSummary {
  status?: number;
  entries: AnswerEntry[];
}

export interface AnswerFetchClientLike {
  fetchAnswerInfo(input: FetchAnswerInfoInput): Promise<AnswerInfoSummary>;
}

export class AnswerFetchClient implements AnswerFetchClientLike {
  constructor(private readonly client: EducoderGetClient) {}

  async fetchAnswerInfo(input: FetchAnswerInfoInput): Promise<AnswerInfoSummary> {
    const response = await this.client.get<AnswerInfoResponse>(
      `/api/tasks/${input.taskId}/get_answer_info.json`,
    );

    return normalizeAnswerInfo(response);
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
