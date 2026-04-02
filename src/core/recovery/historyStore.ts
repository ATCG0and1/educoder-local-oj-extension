import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  HistoryEvaluation,
  HistoryRedoLog,
  HistorySnapshot,
} from '../api/historyFetchClient.js';

export interface HistoryIndex {
  filePath?: string;
  evaluations: HistoryEvaluation[];
  redoLogs: HistoryRedoLog[];
  updatedAt: string;
}

export interface WriteHistoryArtifactsInput {
  rawEvaluateLogs: unknown;
  rawRedoLogs: unknown;
  index: HistoryIndex;
}

export async function writeHistoryArtifacts(
  taskRoot: string,
  input: WriteHistoryArtifactsInput,
): Promise<void> {
  const historyDir = path.join(taskRoot, '_educoder', 'history');
  await mkdir(historyDir, { recursive: true });

  await Promise.all([
    writeJson(path.join(historyDir, 'evaluate_logs.json'), input.rawEvaluateLogs),
    writeJson(path.join(historyDir, 'redo_logs.json'), input.rawRedoLogs),
    writeJson(path.join(historyDir, 'index.json'), input.index),
  ]);
}

export async function readHistoryIndex(taskRoot: string): Promise<HistoryIndex | undefined> {
  try {
    return JSON.parse(
      await readFile(path.join(taskRoot, '_educoder', 'history', 'index.json'), 'utf8'),
    ) as HistoryIndex;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined;
    }

    throw error;
  }
}

export async function writeHistorySnapshot(taskRoot: string, snapshot: HistorySnapshot): Promise<string> {
  const snapshotRoot = path.join(
    taskRoot,
    '_educoder',
    'history',
    `query_${String(snapshot.queryIndex).padStart(3, '0')}`,
  );
  const targetPath = path.join(snapshotRoot, snapshot.filePath);
  const metadataPath = path.join(snapshotRoot, 'snapshot.json');

  await mkdir(path.dirname(targetPath), { recursive: true });
  await Promise.all([
    writeFile(targetPath, snapshot.content, 'utf8'),
    writeJson(metadataPath, snapshot),
  ]);

  return snapshotRoot;
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}
