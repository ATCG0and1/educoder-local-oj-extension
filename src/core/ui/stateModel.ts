import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { LocalJudgeReport } from '../judge/resultStore.js';
import { readLocalJudgeReport } from '../judge/resultStore.js';
import { readHistoryIndex } from '../recovery/historyStore.js';
import { readRecoveryMetadata, type RecoveryMetadata } from '../recovery/materialStore.js';
import { readLatestOfficialJudgeReport, type OfficialJudgeReport } from '../remote/officialLogStore.js';
import type { TaskManifest } from '../sync/manifestStore.js';

export const APPROVED_TASK_STATES = [
  '未同步',
  '已同步',
  '可本地评测',
  '本地评测未过',
  '本地评测已过',
  '官方评测未过',
  '官方评测已过（通关）',
] as const;

export type ApprovedTaskState = (typeof APPROVED_TASK_STATES)[number];

export interface TaskStateModelInput {
  taskManifest?: TaskManifest;
  workspaceReady?: boolean;
  hiddenTestsCached?: boolean;
  hiddenTestsCount?: number;
  localReport?: LocalJudgeReport;
  officialReport?: OfficialJudgeReport;
  recoveryMetadata?: RecoveryMetadata;
  historyEntryCount?: number;
}

export interface TaskStateModel {
  taskId?: string;
  taskName?: string;
  state: ApprovedTaskState;
  availableStates: readonly ApprovedTaskState[];
  readiness: 'missing_workspace' | 'workspace_only' | 'local_ready';
  hiddenTestsCached: boolean;
  localCaseCount: number;
  templateReady: boolean;
  passedReady: boolean;
  answerEntryCount: number;
  unlockedAnswerCount: number;
  repositoryReady: boolean;
  repositoryFileCount: number;
  historyEntryCount: number;
  lastRecoverySyncAt?: string;
  lastRepositorySyncAt?: string;
  lastAnswerSyncAt?: string;
  lastLocalJudgeAt?: string;
  lastOfficialJudgeAt?: string;
}

export function buildTaskStateModel(input: TaskStateModelInput): TaskStateModel {
  const hiddenTestsCached = resolveHiddenTestsCached(input);
  const localCaseCount = input.localReport?.summary.total ?? input.hiddenTestsCount ?? 0;

  return {
    taskId: input.taskManifest?.taskId,
    taskName: input.taskManifest?.name,
    state: resolveTaskState(input),
    availableStates: APPROVED_TASK_STATES,
    readiness: resolveTaskReadiness(input),
    hiddenTestsCached,
    localCaseCount,
    templateReady: input.recoveryMetadata?.templateReady ?? false,
    passedReady: input.recoveryMetadata?.passedReady ?? false,
    answerEntryCount: input.recoveryMetadata?.answerEntryCount ?? 0,
    unlockedAnswerCount: input.recoveryMetadata?.unlockedAnswerCount ?? 0,
    repositoryReady: input.recoveryMetadata?.repositoryReady ?? false,
    repositoryFileCount: input.recoveryMetadata?.repositoryFileCount ?? 0,
    historyEntryCount: input.historyEntryCount ?? 0,
    lastRecoverySyncAt: input.recoveryMetadata?.updatedAt,
    lastRepositorySyncAt: input.recoveryMetadata?.lastRepositorySyncAt,
    lastAnswerSyncAt: input.recoveryMetadata?.lastAnswerSyncAt,
    lastLocalJudgeAt: input.localReport?.generatedAt,
    lastOfficialJudgeAt: input.officialReport?.generatedAt ?? input.officialReport?.cachedAt,
  };
}

export async function loadTaskStateModel(taskRoot: string): Promise<TaskStateModel> {
  const [taskManifest, localReport, officialReport, workspaceReady, hiddenTestsCount, recoveryMetadata, historyIndex] = await Promise.all([
    readTaskManifest(taskRoot),
    readLocalJudgeReport(taskRoot),
    readLatestOfficialJudgeReport(taskRoot),
    hasWorkspace(taskRoot),
    countHiddenTests(taskRoot),
    readRecoveryMetadata(taskRoot),
    readHistoryIndex(taskRoot),
  ]);

  return buildTaskStateModel({
    taskManifest,
    workspaceReady,
    hiddenTestsCached: hiddenTestsCount > 0,
    hiddenTestsCount,
    localReport,
    officialReport,
    recoveryMetadata,
    historyEntryCount: historyIndex?.evaluations.length ?? 0,
  });
}

function resolveTaskState(input: TaskStateModelInput): ApprovedTaskState {
  if (!input.taskManifest) {
    return '未同步';
  }

  if (input.officialReport?.summary.verdict === 'passed') {
    return '官方评测已过（通关）';
  }

  if (input.officialReport?.summary.verdict === 'failed') {
    return '官方评测未过';
  }

  if (!input.workspaceReady) {
    return '已同步';
  }

  if (!input.localReport) {
    return '可本地评测';
  }

  if (input.localReport.compile.verdict === 'compile_error' || input.localReport.summary.failed > 0) {
    return '本地评测未过';
  }

  return '本地评测已过';
}

function resolveTaskReadiness(
  input: TaskStateModelInput,
): 'missing_workspace' | 'workspace_only' | 'local_ready' {
  if (!input.workspaceReady) {
    return 'missing_workspace';
  }

  if (!resolveHiddenTestsCached(input)) {
    return 'workspace_only';
  }

  return 'local_ready';
}

function resolveHiddenTestsCached(input: TaskStateModelInput): boolean {
  return Boolean(input.hiddenTestsCached || (input.localReport && input.localReport.summary.total > 0));
}

async function readTaskManifest(taskRoot: string): Promise<TaskManifest | undefined> {
  try {
    return JSON.parse(await readFile(path.join(taskRoot, 'task.manifest.json'), 'utf8')) as TaskManifest;
  } catch {
    return undefined;
  }
}

async function hasWorkspace(taskRoot: string): Promise<boolean> {
  try {
    await access(path.join(taskRoot, 'workspace'));
    return true;
  } catch {
    return false;
  }
}

async function countHiddenTests(taskRoot: string): Promise<number> {
  try {
    const entries = await readdir(path.join(taskRoot, '_educoder', 'tests', 'hidden'), {
      withFileTypes: true,
    });
    return entries.filter((entry) => entry.isFile() && entry.name.endsWith('_input.txt')).length;
  } catch {
    return 0;
  }
}
