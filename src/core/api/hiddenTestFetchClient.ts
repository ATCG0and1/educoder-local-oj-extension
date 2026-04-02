import type { HiddenTestCase } from '../sync/taskHydrator.js';
import type { EducoderGetClient } from './taskDetailClient.js';

export interface HiddenTestSetPayload {
  is_public?: boolean;
  input?: string;
  output?: string;
}

interface CheckTestSetsResponse {
  test_sets?: HiddenTestSetPayload[];
}

export interface FetchHiddenTestsInput {
  taskId: string;
  includePublic?: boolean;
  fallbackTestSets?: HiddenTestSetPayload[];
}

export interface HiddenTestFetchClientLike {
  fetchHiddenTests(input: FetchHiddenTestsInput): Promise<HiddenTestCase[]>;
}

export class HiddenTestFetchClient implements HiddenTestFetchClientLike {
  constructor(private readonly client: EducoderGetClient) {}

  async fetchHiddenTests(input: FetchHiddenTestsInput): Promise<HiddenTestCase[]> {
    const response = await this.client.get<CheckTestSetsResponse>(
      `/api/tasks/${input.taskId}/check_test_sets.json`,
    );

    const payload = response.test_sets?.length ? response.test_sets : input.fallbackTestSets ?? [];
    return normalizeHiddenTests(payload, input.includePublic ?? true);
  }
}

export function normalizeHiddenTests(
  payload: HiddenTestSetPayload[],
  includePublic = true,
): HiddenTestCase[] {
  return payload
    .filter((item) => includePublic || item.is_public === false)
    .filter((item) => typeof item.input === 'string' && typeof item.output === 'string')
    .map((item) => ({
      input: item.input ?? '',
      output: item.output ?? '',
    }));
}
