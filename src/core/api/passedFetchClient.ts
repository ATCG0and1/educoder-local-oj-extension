import type { WorkspaceFile } from '../workspace/workspaceInit.js';
import type { EducoderGetClient } from './taskDetailClient.js';
import type { FetchRecoveryFilesInput } from './templateFetchClient.js';

interface ResetCodeResponse {
  content?: string;
  language?: string;
}

export interface PassedFetchClientLike {
  fetchPassedFiles(input: FetchRecoveryFilesInput): Promise<WorkspaceFile[]>;
}

export class PassedFetchClient implements PassedFetchClientLike {
  constructor(private readonly client: EducoderGetClient) {}

  async fetchPassedFiles(input: FetchRecoveryFilesInput): Promise<WorkspaceFile[]> {
    return Promise.all(
      input.filePaths.map(async (filePath) => ({
        path: filePath,
        content: await this.fetchPassedFile(input.taskId, filePath, input.homeworkId),
      })),
    );
  }

  private async fetchPassedFile(
    taskId: string,
    filePath: string,
    homeworkId?: string,
  ): Promise<string> {
    const response = await this.client.get<ResetCodeResponse>(
      `/api/tasks/${taskId}/reset_passed_code.json`,
      {
        path: filePath,
        homework_common_id: homeworkId,
      },
    );

    return response.content ?? '';
  }
}
