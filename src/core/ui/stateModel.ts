import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { LocalJudgeReport } from '../judge/resultStore.js';
import { extractFirstCompileDiagnosticBlock } from '../judge/compileDiagnostics.js';
import { readLocalJudgeReport } from '../judge/resultStore.js';
import { readHistoryIndex } from '../recovery/historyStore.js';
import { readRecoveryMetadata, type RecoveryMetadata } from '../recovery/materialStore.js';
import { readLatestOfficialJudgeReport, type OfficialJudgeReport } from '../remote/officialLogStore.js';
import type { TaskManifest } from '../sync/manifestStore.js';
import { hasAnswerFiles, readAnswerEntryCount } from '../workspace/answerSurface.js';
import { resolveTaskPackagePaths } from '../workspace/taskPackageMigration.js';

export const APPROVED_TASK_STATES = [
  '未同步',
  '已同步',
  '可本地评测',
  '本地评测未过',
  '本地评测已过',
  '官方评测未过',
  '官方评测已过（通关）',
] as const;

export const APPROVED_SOLVE_STATES = [
  '未开始',
  '作答中',
  '本地测试未过',
  '本地测试已过',
  '头哥评测已过',
] as const;

export type TaskMaterialState = 'ready' | 'missing' | 'unavailable' | 'failed';

export interface TaskMaterialsState {
  statement: TaskMaterialState;
  template: TaskMaterialState;
  currentCode: TaskMaterialState;
  tests: TaskMaterialState;
  answers: TaskMaterialState;
  metadata: TaskMaterialState;
}

export interface TaskStateModelInput {
  taskManifest?: TaskManifest;
  workspaceReady?: boolean;
  hiddenTestsCached?: boolean;
  hiddenTestsCount?: number;
  localReport?: LocalJudgeReport;
  officialReport?: OfficialJudgeReport;
  recoveryMetadata?: RecoveryMetadata;
  historyEntryCount?: number;
  materials?: Partial<TaskMaterialsState>;
  workingTreeDirty?: boolean;
}

export interface TaskLocalJudgeSummary {
  source: string;
  compileVerdict: 'compiled' | 'compile_error';
  total: number;
  passed: number;
  failed: number;
  headline?: string;
  detail?: string;
  failureCaseId?: string;
  failureInputPath?: string;
  failureOutputPath?: string;
}

export interface TaskOfficialJudgeSummary {
  verdict: 'passed' | 'failed';
  headline: string;
  detail?: string;
}

export interface TaskStateModel {
  taskId?: string;
  taskName?: string;
  displayTitle?: string;
  state: string;
  solveState?: string;
  availableStates: readonly string[];
  readiness: 'missing_workspace' | 'workspace_only' | 'local_ready';
  hiddenTestsCached: boolean;
  localCaseCount: number;
  materials?: TaskMaterialsState;
  templateReady: boolean;
  passedReady: boolean;
  answerEntryCount: number;
  unlockedAnswerCount: number;
  repositoryReady: boolean;
  repositoryFileCount: number;
  historyEntryCount: number;
  localJudge?: TaskLocalJudgeSummary;
  officialJudge?: TaskOfficialJudgeSummary;
  lastRecoverySyncAt?: string;
  lastRepositorySyncAt?: string;
  lastAnswerSyncAt?: string;
  lastLocalJudgeAt?: string;
  lastOfficialJudgeAt?: string;
}

export function buildTaskStateModel(input: TaskStateModelInput): TaskStateModel {
  const hiddenTestsCached = resolveHiddenTestsCached(input);
  const localCaseCount = input.hiddenTestsCount ?? input.localReport?.summary.total ?? 0;
  const materials = resolveTaskMaterials(input, hiddenTestsCached);

  return {
    taskId: input.taskManifest?.taskId,
    taskName: input.taskManifest?.name,
    displayTitle: resolveTaskDisplayTitle(input.taskManifest),
    state: resolveLegacyTaskState(input),
    solveState: resolveSolveState(input, materials),
    availableStates: APPROVED_SOLVE_STATES,
    readiness: resolveTaskReadiness(input),
    hiddenTestsCached,
    localCaseCount,
    materials,
    templateReady: input.recoveryMetadata?.templateReady ?? false,
    passedReady: input.recoveryMetadata?.passedReady ?? false,
    answerEntryCount: input.recoveryMetadata?.answerEntryCount ?? 0,
    unlockedAnswerCount: input.recoveryMetadata?.unlockedAnswerCount ?? 0,
    repositoryReady: input.recoveryMetadata?.repositoryReady ?? false,
    repositoryFileCount: input.recoveryMetadata?.repositoryFileCount ?? 0,
    historyEntryCount: input.historyEntryCount ?? 0,
    localJudge: resolveLocalJudgeSummary(input.localReport, localCaseCount),
    officialJudge: resolveOfficialJudgeSummary(input),
    lastRecoverySyncAt: input.recoveryMetadata?.updatedAt,
    lastRepositorySyncAt: input.recoveryMetadata?.lastRepositorySyncAt,
    lastAnswerSyncAt: input.recoveryMetadata?.lastAnswerSyncAt,
    lastLocalJudgeAt: input.localReport?.generatedAt,
    lastOfficialJudgeAt: input.officialReport?.generatedAt ?? input.officialReport?.cachedAt,
  };
}

export async function loadTaskStateModel(taskRoot: string): Promise<TaskStateModel> {
  const resolvedPaths = await resolveTaskPackagePaths(taskRoot);
  const [taskManifest, localReport, officialReport, recoveryMetadata, historyIndex, currentCodeReady, localTestCount, statementReady, templateReady, answersReady, metadataReady, workingTreeDirty] =
    await Promise.all([
      readTaskManifest(taskRoot),
      readLocalJudgeReport(taskRoot),
      readLatestOfficialJudgeReport(taskRoot),
      readRecoveryMetadata(taskRoot),
      readHistoryIndex(taskRoot),
      dirHasFiles(resolvedPaths.currentCodeDir),
      countLocalTests(taskRoot),
      hasAnyPath([
        path.join(taskRoot, 'problem', 'statement.md'),
        path.join(taskRoot, 'problem', 'statement.html'),
      ]),
      hasTemplateSnapshot(taskRoot),
      hasLegacyAwareAnswers(resolvedPaths.answersDir),
      hasAnyPath([
        path.join(taskRoot, 'problem', 'metadata.json'),
        path.join(taskRoot, '_educoder', 'meta', 'task.json'),
      ]),
      detectWorkingTreeDirty(taskRoot, resolvedPaths.currentCodeDir),
    ]);

  return buildTaskStateModel({
    taskManifest,
    workspaceReady: currentCodeReady,
    hiddenTestsCached: localTestCount > 0,
    hiddenTestsCount: localTestCount,
    localReport,
    officialReport,
    recoveryMetadata,
    historyEntryCount: historyIndex?.evaluations.length ?? 0,
    workingTreeDirty,
    materials: {
      statement: statementReady ? 'ready' : 'missing',
      template:
        templateReady || recoveryMetadata?.templateReady
          ? 'ready'
          : 'missing',
      currentCode: currentCodeReady ? 'ready' : 'missing',
      tests: localTestCount > 0 ? 'ready' : 'missing',
      answers:
        answersReady || recoveryMetadata?.answerReady
          ? 'ready'
          : 'missing',
      metadata: metadataReady ? 'ready' : 'missing',
    },
  });
}

function resolveLegacyTaskState(input: TaskStateModelInput): string {
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

function resolveSolveState(input: TaskStateModelInput, materials: TaskMaterialsState): string {
  if (input.officialReport?.summary.verdict === 'passed') {
    return '头哥评测已过';
  }

  if (input.localReport) {
    if (input.localReport.compile.verdict === 'compile_error' || input.localReport.summary.failed > 0) {
      return '本地测试未过';
    }

    if (input.localReport.summary.total > 0) {
      return '本地测试已过';
    }
  }

  if (
    materials.currentCode === 'ready' &&
    (input.workingTreeDirty || (input.historyEntryCount ?? 0) > 0)
  ) {
    return '作答中';
  }

  return '未开始';
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

function resolveTaskMaterials(
  input: TaskStateModelInput,
  hiddenTestsCached: boolean,
): TaskMaterialsState {
  return {
    statement: input.materials?.statement ?? 'missing',
    template:
      input.materials?.template ??
      (input.recoveryMetadata?.templateReady ? 'ready' : 'missing'),
    currentCode:
      input.materials?.currentCode ??
      (input.workspaceReady ? 'ready' : 'missing'),
    tests: input.materials?.tests ?? (hiddenTestsCached ? 'ready' : 'missing'),
    answers:
      input.materials?.answers ??
      (input.recoveryMetadata?.answerReady ? 'ready' : 'missing'),
    metadata: input.materials?.metadata ?? 'missing',
  };
}

function resolveLocalJudgeSummary(
  localReport?: LocalJudgeReport,
  hiddenTestsCount?: number,
): TaskLocalJudgeSummary | undefined {
  if (!localReport) {
    return undefined;
  }

  const insight = buildLocalJudgeInsight(localReport, hiddenTestsCount);
  return {
    source: localReport.source ?? 'tests/all',
    compileVerdict: localReport.compile.verdict,
    total: localReport.summary.total,
    passed: localReport.summary.passed,
    failed: localReport.summary.failed,
    headline: insight.headline,
    detail: insight.detail,
    failureCaseId: insight.failureCaseId,
    failureInputPath: insight.failureInputPath,
    failureOutputPath: insight.failureOutputPath,
  };
}

function resolveOfficialJudgeSummary(
  input: TaskStateModelInput,
): TaskOfficialJudgeSummary | undefined {
  const officialReport = input.officialReport;
  if (!officialReport) {
    return undefined;
  }

  const detail = officialReport.summary.message?.trim();
  const passCounts = deriveOfficialPassCounts(input);
  return {
    verdict: officialReport.summary.verdict,
    headline: formatOfficialJudgeHeadline(officialReport.summary.verdict, passCounts),
    detail: detail && detail.length > 0 ? detail : undefined,
  };
}

function buildLocalJudgeInsight(localReport: LocalJudgeReport, hiddenTestsCount?: number): {
  headline?: string;
  detail?: string;
  failureCaseId?: string;
  failureInputPath?: string;
  failureOutputPath?: string;
} {
  if (localReport.compile.verdict === 'compile_error') {
    const compileFailedHeadline =
      typeof hiddenTestsCount === 'number' && hiddenTestsCount > 0
        ? `0/${hiddenTestsCount} 编译失败`
        : '编译失败';
    const diagnosticBlock =
      extractFirstCompileDiagnosticBlock(localReport.compile.stderr) ??
      extractFirstCompileDiagnosticBlock(localReport.compile.stdout);
    const compileContext = diagnosticBlock ? undefined : summarizeCompileContext(localReport);
    return {
      headline: compileFailedHeadline,
      detail:
        [
          diagnosticBlock ??
            firstNonEmptyLine(localReport.compile.stderr) ??
            firstNonEmptyLine(localReport.compile.stdout) ??
            '请检查编译输出。',
          compileContext,
        ]
          .filter((item): item is string => Boolean(item))
          .join('\n'),
    };
  }

  const firstFailed = localReport.caseResults.find((item) => item.verdict !== 'passed');
  if (firstFailed) {
    const expected = previewCaseText(firstFailed.expected);
    const actual = previewCaseText(firstFailed.actual);
    const detailParts = [];
    if (firstFailed.inputPath) {
      detailParts.push(`输入 ${firstFailed.inputPath}`);
    }
    detailParts.push(`期望：${expected}`);
    detailParts.push(`实际：${actual}`);

    return {
      headline: `首个失败：${firstFailed.caseId}`,
      detail: detailParts.join('\n'),
      failureCaseId: firstFailed.caseId,
      failureInputPath: firstFailed.inputPath,
      failureOutputPath: firstFailed.outputPath,
    };
  }

  if (localReport.summary.total > 0 && localReport.summary.failed === 0) {
    return {
      headline: `本地已通过 ${localReport.summary.passed}/${localReport.summary.total}`,
      detail: `可继续提交到头哥，默认来源 ${localReport.source ?? 'tests/all'}`,
    };
  }

  return {};
}

function deriveOfficialPassCounts(input: TaskStateModelInput): {
  passedCount?: number;
  totalCount?: number;
} {
  const officialSummary = input.officialReport?.summary;
  if (!officialSummary) {
    return {};
  }

  const totalCount =
    normalizeCount(officialSummary.totalCount) ??
    normalizeCount(input.hiddenTestsCount) ??
    normalizeCount(input.localReport?.summary.total);

  const explicitPassedCount = normalizeCount(officialSummary.passedCount);
  if (explicitPassedCount !== undefined) {
    return {
      passedCount: totalCount === undefined ? explicitPassedCount : Math.min(explicitPassedCount, totalCount),
      totalCount,
    };
  }

  if (totalCount === undefined) {
    return {};
  }

  if (typeof officialSummary.score === 'number' && Number.isFinite(officialSummary.score)) {
    const ratio = Math.max(0, Math.min(100, officialSummary.score)) / 100;
    return {
      passedCount: Math.round(totalCount * ratio),
      totalCount,
    };
  }

  if (officialSummary.verdict === 'passed') {
    return {
      passedCount: totalCount,
      totalCount,
    };
  }

  return {
    totalCount,
  };
}

function formatOfficialJudgeHeadline(
  verdict: 'passed' | 'failed',
  counts: {
    passedCount?: number;
    totalCount?: number;
  },
): string {
  if (
    typeof counts.passedCount === 'number' &&
    Number.isFinite(counts.passedCount) &&
    typeof counts.totalCount === 'number' &&
    Number.isFinite(counts.totalCount) &&
    counts.totalCount > 0
  ) {
    return `${verdict === 'passed' ? '已通过' : '未通过'} ${counts.passedCount}/${counts.totalCount}`;
  }

  return verdict === 'passed' ? '已通过' : '未通过';
}

function resolveTaskDisplayTitle(taskManifest?: TaskManifest): string | undefined {
  if (!taskManifest?.name) {
    return taskManifest?.taskId;
  }

  if (typeof taskManifest.position === 'number' && Number.isFinite(taskManifest.position)) {
    return `${taskManifest.position} · ${taskManifest.name}`;
  }

  return taskManifest.name;
}

function previewCaseText(value: string): string {
  const normalized = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\s+$/g, '');
  if (!normalized.trim()) {
    return '空输出';
  }

  const lines = normalized.split('\n');
  const previewLines = lines.slice(0, 2).map((line) => (line.length > 48 ? `${line.slice(0, 45)}…` : line));
  const preview = previewLines.join('\n');
  return lines.length > previewLines.length ? `${preview}\n…（共 ${lines.length} 行）` : preview;
}

function firstNonEmptyLine(value?: string): string | undefined {
  return value
    ?.split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);
}

function normalizeCount(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.trunc(value)
    : undefined;
}

function summarizeCompileContext(localReport: LocalJudgeReport): string | undefined {
  const contextParts: string[] = [];
  if (localReport.workspacePath) {
    contextParts.push(`目录：${localReport.workspacePath}`);
  }

  const sourceFiles = localReport.compile.sourceFiles ?? [];
  if (sourceFiles.length === 1) {
    contextParts.push(`文件：${sourceFiles[0]}`);
  } else if (sourceFiles.length > 1) {
    const [firstSource, ...rest] = sourceFiles;
    contextParts.push(`文件：${firstSource}${rest.length > 0 ? ` 等 ${sourceFiles.length} 个` : ''}`);
  }

  return contextParts.length > 0 ? contextParts.join(' · ') : undefined;
}

async function readTaskManifest(taskRoot: string): Promise<TaskManifest | undefined> {
  try {
    return JSON.parse(await readFile(path.join(taskRoot, 'task.manifest.json'), 'utf8')) as TaskManifest;
  } catch {
    return undefined;
  }
}

async function countLocalTests(taskRoot: string): Promise<number> {
  const allTestsDir = path.join(taskRoot, 'tests', 'all');
  const resolved = await resolveTaskPackagePaths(taskRoot);
  const caseEntries = await readCaseEntries(allTestsDir);
  if (caseEntries.length > 0) {
    return caseEntries.length;
  }

  return readCaseEntries(resolved.hiddenTestsDir).then((entries) => entries.length);
}

async function readCaseEntries(targetDir: string): Promise<string[]> {
  try {
    const entries = await readdir(targetDir, {
      withFileTypes: true,
    });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('_input.txt'))
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

async function detectWorkingTreeDirty(taskRoot: string, currentCodeDir: string): Promise<boolean> {
  const templateDir = await resolveTemplateSnapshotDir(taskRoot);
  if (!templateDir) {
    return false;
  }

  const [currentFiles, templateFiles] = await Promise.all([
    listRelativeFiles(currentCodeDir),
    listRelativeFiles(templateDir),
  ]);

  if (currentFiles.length === 0 || templateFiles.length === 0) {
    return false;
  }

  if (currentFiles.length !== templateFiles.length) {
    return true;
  }

  const currentSet = new Set(currentFiles);
  if (templateFiles.some((file) => !currentSet.has(file))) {
    return true;
  }

  for (const relativePath of currentFiles) {
    const [currentContent, templateContent] = await Promise.all([
      readFile(path.join(currentCodeDir, relativePath), 'utf8'),
      readFile(path.join(templateDir, relativePath), 'utf8'),
    ]);
    if (currentContent !== templateContent) {
      return true;
    }
  }

  return false;
}

async function listRelativeFiles(rootDir: string): Promise<string[]> {
  try {
    const entries = await readdir(rootDir, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      const fullPath = path.join(rootDir, entry.name);
      if (entry.isFile()) {
        files.push(entry.name);
        continue;
      }

      if (entry.isDirectory()) {
        const nested = await listRelativeFiles(fullPath);
        files.push(...nested.map((item) => `${entry.name}/${item}`));
      }
    }

    return files.sort((left, right) => left.localeCompare(right));
  } catch {
    return [];
  }
}

async function hasPath(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function dirHasFiles(targetPath: string): Promise<boolean> {
  try {
    const entries = await readdir(targetPath, { withFileTypes: true });
    return entries.some((entry) => entry.isFile() || entry.isDirectory());
  } catch {
    return false;
  }
}

async function hasAnyPath(paths: string[]): Promise<boolean> {
  const results = await Promise.all(paths.map((targetPath) => hasPath(targetPath)));
  return results.some(Boolean);
}

async function hasLegacyAwareAnswers(answerDir: string): Promise<boolean> {
  const [answerEntryCount, unlockedReady] = await Promise.all([
    readAnswerEntryCount(path.dirname(answerDir), answerDir),
    hasAnswerFiles(answerDir),
  ]);
  return answerEntryCount > 0 || unlockedReady;
}

async function hasTemplateSnapshot(taskRoot: string): Promise<boolean> {
  const templateDir = await resolveTemplateSnapshotDir(taskRoot);
  if (!templateDir) {
    return false;
  }

  return dirHasFiles(templateDir);
}

async function resolveTemplateSnapshotDir(taskRoot: string): Promise<string | undefined> {
  const candidates = [
    path.join(taskRoot, '_educoder', 'template'),
    path.join(taskRoot, 'code', 'template'),
  ];

  for (const candidate of candidates) {
    if (await dirHasFiles(candidate)) {
      return candidate;
    }
  }

  return undefined;
}
