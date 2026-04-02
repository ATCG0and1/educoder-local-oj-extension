import { decodeEducoderContent } from './sourceFetchClient.js';
import type { EducoderGetClient } from './taskDetailClient.js';

interface EvaluateLogsResponseItem {
  query_index?: number;
  created_at?: string;
  output_detail?: string;
  ts_time?: number;
  ts_mem?: number;
  test_set_passed_rate?: number;
}

interface EvaluateLogsResponse {
  status?: number;
  message?: string;
  data?: {
    count?: number;
    path?: string;
    list?: EvaluateLogsResponseItem[];
  };
}

interface RedoLogsResponseItem {
  created_at?: string;
  redo_type?: number;
  operator_id?: number;
  operator?: string;
}

interface RedoLogsResponse {
  status?: number;
  message?: string;
  data?: {
    count?: number;
    list?: RedoLogsResponseItem[];
  };
}

interface HistorySnapshotResponse {
  status?: number;
  content?: string;
  data?: EvaluateLogsResponseItem;
  message?: string;
}

export interface HistoryEvaluation {
  queryIndex: number;
  createdAt?: string;
  outputDetail?: string;
  tsTime?: number;
  tsMem?: number;
  testSetPassedRate?: number;
}

export interface HistoryRedoLog {
  createdAt?: string;
  redoType?: number;
  operatorId?: number;
  operator?: string;
}

export interface HistoryIndexSummary {
  filePath?: string;
  evaluations: HistoryEvaluation[];
  redoLogs: HistoryRedoLog[];
  rawEvaluateLogs: unknown;
  rawRedoLogs: unknown;
}

export interface HistorySnapshot {
  queryIndex: number;
  filePath: string;
  content: string;
  createdAt?: string;
  outputDetail?: string;
  tsTime?: number;
  tsMem?: number;
  testSetPassedRate?: number;
  raw: unknown;
}

export interface FetchHistoryIndexInput {
  taskId: string;
}

export interface FetchHistorySnapshotInput {
  taskId: string;
  homeworkId?: string;
  queryIndex: number;
  filePath: string;
}

export interface HistoryFetchClientLike {
  fetchHistoryIndex(input: FetchHistoryIndexInput): Promise<HistoryIndexSummary>;
  fetchHistorySnapshot(input: FetchHistorySnapshotInput): Promise<HistorySnapshot>;
}

export class HistoryFetchClient implements HistoryFetchClientLike {
  constructor(private readonly client: EducoderGetClient) {}

  async fetchHistoryIndex(input: FetchHistoryIndexInput): Promise<HistoryIndexSummary> {
    const [evaluateLogs, redoLogs] = await Promise.all([
      this.client.get<EvaluateLogsResponse>(`/api/tasks/${input.taskId}/evaluate_logs.json`),
      this.client.get<RedoLogsResponse>(`/api/tasks/${input.taskId}/redo_logs.json`),
    ]);

    return {
      filePath: normalizeHistoryPath(evaluateLogs.data?.path),
      evaluations: (evaluateLogs.data?.list ?? [])
        .filter((item): item is EvaluateLogsResponseItem & { query_index: number } =>
          typeof item.query_index === 'number',
        )
        .map((item) => ({
          queryIndex: item.query_index,
          createdAt: item.created_at,
          outputDetail: item.output_detail,
          tsTime: item.ts_time,
          tsMem: item.ts_mem,
          testSetPassedRate: item.test_set_passed_rate,
        })),
      redoLogs: (redoLogs.data?.list ?? []).map((item) => ({
        createdAt: item.created_at,
        redoType: item.redo_type,
        operatorId: item.operator_id,
        operator: item.operator,
      })),
      rawEvaluateLogs: evaluateLogs,
      rawRedoLogs: redoLogs,
    };
  }

  async fetchHistorySnapshot(input: FetchHistorySnapshotInput): Promise<HistorySnapshot> {
    const response = await this.client.get<HistorySnapshotResponse>(
      `/api/tasks/${input.taskId}/get_content_for_commit_id.json`,
      {
        query_index: input.queryIndex,
        path: input.filePath,
        homework_common_id: input.homeworkId,
      },
    );

    return {
      queryIndex: input.queryIndex,
      filePath: input.filePath,
      content: decodeEducoderContent(response.content ?? ''),
      createdAt: response.data?.created_at,
      outputDetail: response.data?.output_detail,
      tsTime: response.data?.ts_time,
      tsMem: response.data?.ts_mem,
      testSetPassedRate: response.data?.test_set_passed_rate,
      raw: response,
    };
  }
}

function normalizeHistoryPath(rawPath: string | undefined): string | undefined {
  return rawPath?.split(/[;；,\r\n]+/).map((item) => item.trim()).find(Boolean);
}
