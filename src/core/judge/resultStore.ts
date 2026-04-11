import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { SmartDiffHunk } from './diffRenderer.js';
import type { LocalCaseVerdict } from './verdict.js';
import type { LocalJudgeRunMode } from './caseScheduler.js';

export interface CompileResultSummary {
  verdict: 'compiled' | 'compile_error';
  stdout: string;
  stderr: string;
  executablePath?: string;
  sourceFiles?: string[];
}

export interface LocalJudgeCaseResult {
  caseId: string;
  verdict: LocalCaseVerdict;
  inputPath?: string;
  outputPath?: string;
  expected: string;
  actual: string;
  stdout: string;
  stderr: string;
  exitCode?: number;
  timedOut?: boolean;
  diffHunks?: SmartDiffHunk[];
}

export interface LocalJudgeSummary {
  total: number;
  passed: number;
  failed: number;
}

export interface LocalJudgeReport {
  generatedAt?: string;
  source?: 'tests/all' | 'tests/hidden-legacy';
  workspacePath?: string;
  runMode: LocalJudgeRunMode;
  reason?: string;
  compile: CompileResultSummary;
  caseResults: LocalJudgeCaseResult[];
  summary: LocalJudgeSummary;
}

export async function readLocalJudgeReport(taskRoot: string): Promise<LocalJudgeReport | undefined> {
  const reportPath = path.join(taskRoot, '_educoder', 'judge', 'latest_local.json');

  try {
    const content = await readFile(reportPath, 'utf8');
    return JSON.parse(content) as LocalJudgeReport;
  } catch {
    return undefined;
  }
}

export async function writeLocalJudgeReport(
  taskRoot: string,
  report: LocalJudgeReport,
): Promise<void> {
  const reportsDir = path.join(taskRoot, '_educoder', 'judge');
  const reportWithTimestamp: LocalJudgeReport = {
    ...report,
    generatedAt: report.generatedAt ?? new Date().toISOString(),
  };
  const payload = JSON.stringify(reportWithTimestamp, null, 2);

  await Promise.all([
    mkdir(reportsDir, { recursive: true }),
    rm(path.join(reportsDir, 'local_runs'), { recursive: true, force: true }),
  ]);

  await writeFile(path.join(reportsDir, 'latest_local.json'), payload, 'utf8');
}
