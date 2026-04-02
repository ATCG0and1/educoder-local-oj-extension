import { Buffer } from 'node:buffer';
import type { WorkspaceFile } from '../workspace/workspaceInit.js';
import type { EducoderGetClient } from './taskDetailClient.js';

export interface FetchSourceFilesInput {
  taskId: string;
  homeworkId?: string;
  filePaths: string[];
}

interface RepContentResponse {
  content?: {
    content?: string;
  };
  filename?: string;
}

export interface SourceFetchClientLike {
  fetchSourceFiles(input: FetchSourceFilesInput): Promise<WorkspaceFile[]>;
}

export class SourceFetchClient implements SourceFetchClientLike {
  constructor(private readonly client: EducoderGetClient) {}

  async fetchSourceFiles(input: FetchSourceFilesInput): Promise<WorkspaceFile[]> {
    const files = await Promise.all(
      input.filePaths.map(async (filePath) => ({
        path: filePath,
        content: await this.fetchSourceFile(input.taskId, filePath, input.homeworkId),
      })),
    );

    return files;
  }

  private async fetchSourceFile(
    taskId: string,
    filePath: string,
    homeworkId?: string,
  ): Promise<string> {
    const response = await this.client.get<RepContentResponse>(
      `/api/tasks/${taskId}/rep_content.json`,
      {
        path: filePath,
        homework_common_id: homeworkId,
      },
    );

    return decodeEducoderContent(response.content?.content ?? '');
  }
}

export function decodeEducoderContent(encodedContent: string): string {
  if (!encodedContent) {
    return '';
  }

  if (!/^[A-Za-z0-9+/=\r\n]+$/.test(encodedContent)) {
    return encodedContent;
  }

  try {
    const decoded = Buffer.from(encodedContent, 'base64').toString('utf8');
    return decoded.includes('\uFFFD') ? encodedContent : decoded;
  } catch {
    return encodedContent;
  }
}
