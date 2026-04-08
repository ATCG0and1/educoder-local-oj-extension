import type { TaskLayoutPaths } from './directoryLayout.js';

export interface WriteTaskReadmeInput {
  taskTitle?: string;
}

export async function writeTaskReadme(
  _layout: TaskLayoutPaths,
  _input: WriteTaskReadmeInput = {},
): Promise<void> {
  return Promise.resolve();
}
