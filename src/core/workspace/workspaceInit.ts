import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface WorkspaceFile {
  path: string;
  content: string;
}

export async function writeWorkspaceFiles(rootDir: string, files: WorkspaceFile[]): Promise<void> {
  await mkdir(rootDir, { recursive: true });

  for (const file of files) {
    const targetPath = path.join(rootDir, file.path);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, file.content, 'utf8');
  }
}
