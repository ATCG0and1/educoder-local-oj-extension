import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { WorkspaceFile } from '../workspace/workspaceInit.js';

export interface RecoveryMetadata {
  templateReady: boolean;
  templateFileCount: number;
  passedReady: boolean;
  passedFileCount: number;
  answerReady: boolean;
  answerEntryCount: number;
  unlockedAnswerCount: number;
  historyReady: boolean;
  historyFileCount: number;
  repositoryReady: boolean;
  repositoryFileCount: number;
  lastRepositorySyncAt?: string;
  lastAnswerSyncAt?: string;
  updatedAt: string;
}

export interface BuildRecoveryMetadataInput {
  templateFiles?: WorkspaceFile[];
  passedFiles?: WorkspaceFile[];
  answerInfo?: unknown;
  unlockedAnswerFiles?: WorkspaceFile[];
  historyFiles?: WorkspaceFile[];
  repositoryFiles?: WorkspaceFile[];
  updatedAt?: string;
  lastRepositorySyncAt?: string;
  lastAnswerSyncAt?: string;
}

export async function writeRecoveryMetadata(
  taskRoot: string,
  metadata: RecoveryMetadata,
): Promise<void> {
  const metaDir = path.join(taskRoot, '_educoder', 'meta');
  await mkdir(metaDir, { recursive: true });
  await writeFile(path.join(metaDir, 'recovery.json'), JSON.stringify(metadata, null, 2), 'utf8');
}

export async function readRecoveryMetadata(taskRoot: string): Promise<RecoveryMetadata | undefined> {
  try {
    return JSON.parse(
      await readFile(path.join(taskRoot, '_educoder', 'meta', 'recovery.json'), 'utf8'),
    ) as RecoveryMetadata;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined;
    }

    throw error;
  }
}

export function buildRecoveryMetadata(input: BuildRecoveryMetadataInput): RecoveryMetadata {
  const templateFileCount = input.templateFiles?.length ?? 0;
  const passedFileCount = input.passedFiles?.length ?? 0;
  const historyFileCount = input.historyFiles?.length ?? 0;
  const answerEntryCount = extractAnswerEntryCount(input.answerInfo);
  const unlockedAnswerCount = input.unlockedAnswerFiles?.length ?? 0;
  const repositoryFileCount = input.repositoryFiles?.length ?? 0;

  return {
    templateReady: templateFileCount > 0,
    templateFileCount,
    passedReady: passedFileCount > 0,
    passedFileCount,
    answerReady: answerEntryCount > 0 || unlockedAnswerCount > 0,
    answerEntryCount,
    unlockedAnswerCount,
    historyReady: historyFileCount > 0,
    historyFileCount,
    repositoryReady: repositoryFileCount > 0,
    repositoryFileCount,
    lastRepositorySyncAt: input.lastRepositorySyncAt,
    lastAnswerSyncAt: input.lastAnswerSyncAt,
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  };
}

function extractAnswerEntryCount(answerInfo: unknown): number {
  if (!answerInfo || typeof answerInfo !== 'object') {
    return 0;
  }

  const entries = (answerInfo as { entries?: unknown }).entries;
  return Array.isArray(entries) ? entries.length : 0;
}
