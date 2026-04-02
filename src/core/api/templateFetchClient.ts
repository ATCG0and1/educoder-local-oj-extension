import type { WorkspaceFile } from '../workspace/workspaceInit.js';
import type { EducoderGetClient } from './taskDetailClient.js';

export interface FetchRecoveryFilesInput {
  taskId: string;
  homeworkId?: string;
  filePaths: string[];
}

interface ResetCodeResponse {
  content?: string;
  language?: string;
}

export interface TemplateFetchClientLike {
  fetchTemplateFiles(input: FetchRecoveryFilesInput): Promise<WorkspaceFile[]>;
}

export class TemplateFetchClient implements TemplateFetchClientLike {
  constructor(private readonly client: EducoderGetClient) {}

  async fetchTemplateFiles(input: FetchRecoveryFilesInput): Promise<WorkspaceFile[]> {
    return Promise.all(
      input.filePaths.map(async (filePath) => ({
        path: filePath,
        content: await this.fetchTemplateFile(input.taskId, filePath, input.homeworkId),
      })),
    );
  }

  private async fetchTemplateFile(
    taskId: string,
    filePath: string,
    homeworkId?: string,
  ): Promise<string> {
    const response = await this.client.get<ResetCodeResponse>(
      `/api/tasks/${taskId}/reset_original_code.json`,
      {
        path: filePath,
        homework_common_id: homeworkId,
      },
    );

    return response.content ?? '';
  }
}
