import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { TaskManifest } from '../sync/manifestStore.js';
import { readLatestOfficialJudgeReport, type OfficialJudgeReport } from '../remote/officialLogStore.js';
import { readLocalJudgeReport, type LocalJudgeReport } from '../judge/resultStore.js';

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
  localReport?: LocalJudgeReport;
  officialReport?: OfficialJudgeReport;
}

export interface TaskStateModel {
  taskId?: string;
  taskName?: string;
  state: ApprovedTaskState;
  availableStates: readonly ApprovedTaskState[];
}

export function buildTaskStateModel(input: TaskStateModelInput): TaskStateModel {
  return {
    taskId: input.taskManifest?.taskId,
    taskName: input.taskManifest?.name,
    state: resolveTaskState(input),
    availableStates: APPROVED_TASK_STATES,
  };
}

export async function loadTaskStateModel(taskRoot: string): Promise<TaskStateModel> {
  const [taskManifest, localReport, officialReport, workspaceReady] = await Promise.all([
    readTaskManifest(taskRoot),
    readLocalJudgeReport(taskRoot),
    readLatestOfficialJudgeReport(taskRoot),
    hasWorkspace(taskRoot),
  ]);

  return buildTaskStateModel({
    taskManifest,
    workspaceReady,
    localReport,
    officialReport,
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
