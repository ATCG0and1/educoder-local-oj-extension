import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { SmartDiffHunk } from './diffRenderer.js';
import type { LocalCaseVerdict } from './verdict.js';
import type { LocalJudgeRunMode } from './caseScheduler.js';

export interface CompileResultSummary {
  verdict: 'compiled' | 'compile_error';
  stdout: string;
  stderr: string;
  executablePath?: string;
}

export interface LocalJudgeCaseResult {
  caseId: string;
  verdict: LocalCaseVerdict;
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
  runMode: LocalJudgeRunMode;
  reason?: string;
  compile: CompileResultSummary;
  caseResults: LocalJudgeCaseResult[];
  summary: LocalJudgeSummary;
}

export async function readLocalJudgeReport(taskRoot: string): Promise<LocalJudgeReport | undefined> {
  const reportPath = path.join(taskRoot, 'reports', 'latest_local.json');

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
  const reportsDir = path.join(taskRoot, 'reports');
  const runArchiveDir = path.join(reportsDir, 'local_runs');
  const timestamp = new Date().toISOString().replaceAll(':', '-');
  const payload = JSON.stringify(report, null, 2);

  await Promise.all([
    mkdir(reportsDir, { recursive: true }),
    mkdir(runArchiveDir, { recursive: true }),
  ]);

  await Promise.all([
    writeFile(path.join(reportsDir, 'latest_local.json'), payload, 'utf8'),
    writeFile(path.join(runArchiveDir, `${timestamp}.json`), payload, 'utf8'),
  ]);
}
