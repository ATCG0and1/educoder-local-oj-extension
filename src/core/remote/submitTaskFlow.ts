import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { LocalJudgeReport } from '../judge/resultStore.js';
import type { OfficialJudgeReport, OfficialJudgeVerdict } from './officialLogStore.js';

function getJudgeDir(taskRoot: string): string {
  return path.join(taskRoot, '_educoder', 'judge');
}

export interface SubmitTaskReport {
  generatedAt: string;
  local: {
    executed: boolean;
    passed: boolean;
    source?: LocalJudgeReport['source'];
    compileVerdict?: LocalJudgeReport['compile']['verdict'];
    total?: number;
    passedCount?: number;
    failedCount?: number;
    reportPath?: string;
  };
  remote: {
    executed: boolean;
    verdict?: OfficialJudgeVerdict;
    score?: number;
    passedCount?: number;
    totalCount?: number;
    message?: string;
    reportPath?: string;
  };
  decision: 'stopped_after_local_failure' | 'submitted_after_local_pass' | 'force_submitted';
}

export interface SubmitTaskFlowInput {
  taskRoot: string;
  force?: boolean;
  runLocalJudge: () => Promise<LocalJudgeReport>;
  runRemoteJudge: (input: { force: boolean }) => Promise<OfficialJudgeReport>;
}

export async function submitTaskFlow(input: SubmitTaskFlowInput): Promise<SubmitTaskReport> {
  const localReport = await input.runLocalJudge();
  const localPassed = isLocalJudgePassed(localReport);

  if (!localPassed && !input.force) {
    return persistSubmitTaskReport(input.taskRoot, {
      generatedAt: new Date().toISOString(),
      local: {
        executed: true,
        passed: false,
        source: localReport.source,
        compileVerdict: localReport.compile.verdict,
        total: localReport.summary.total,
        passedCount: localReport.summary.passed,
        failedCount: localReport.summary.failed,
        reportPath: path.join(getJudgeDir(input.taskRoot), 'latest_local.json'),
      },
      remote: {
        executed: false,
      },
      decision: 'stopped_after_local_failure',
    });
  }

  const remoteReport = await input.runRemoteJudge({ force: Boolean(input.force) });
  const remoteCounts = deriveRemotePassCounts(remoteReport, localReport);

  return persistSubmitTaskReport(input.taskRoot, {
    generatedAt: new Date().toISOString(),
    local: {
      executed: true,
      passed: localPassed,
      source: localReport.source,
      compileVerdict: localReport.compile.verdict,
      total: localReport.summary.total,
      passedCount: localReport.summary.passed,
      failedCount: localReport.summary.failed,
      reportPath: path.join(getJudgeDir(input.taskRoot), 'latest_local.json'),
    },
    remote: {
      executed: true,
      verdict: remoteReport.summary.verdict,
      score: remoteReport.summary.score,
      passedCount: remoteCounts.passedCount,
      totalCount: remoteCounts.totalCount,
      message: remoteReport.summary.message,
      reportPath: remoteReport.summary.rawLogPath,
    },
    decision: input.force ? 'force_submitted' : 'submitted_after_local_pass',
  });
}

function isLocalJudgePassed(report: LocalJudgeReport): boolean {
  return (
    report.compile.verdict === 'compiled' &&
    report.summary.total > 0 &&
    report.summary.failed === 0
  );
}

function deriveRemotePassCounts(
  remoteReport: OfficialJudgeReport,
  localReport: LocalJudgeReport,
): {
  passedCount?: number;
  totalCount?: number;
} {
  const totalCount =
    normalizeCount(remoteReport.summary.totalCount) ??
    normalizeCount(localReport.summary.total);

  const explicitPassedCount = normalizeCount(remoteReport.summary.passedCount);
  if (explicitPassedCount !== undefined) {
    return {
      passedCount: totalCount === undefined ? explicitPassedCount : Math.min(explicitPassedCount, totalCount),
      totalCount,
    };
  }

  if (totalCount === undefined) {
    return {};
  }

  if (typeof remoteReport.summary.score === 'number' && Number.isFinite(remoteReport.summary.score)) {
    const ratio = Math.max(0, Math.min(100, remoteReport.summary.score)) / 100;
    return {
      passedCount: Math.round(totalCount * ratio),
      totalCount,
    };
  }

  if (remoteReport.summary.verdict === 'passed') {
    return {
      passedCount: totalCount,
      totalCount,
    };
  }

  return {
    totalCount,
  };
}

function normalizeCount(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.trunc(value)
    : undefined;
}

async function persistSubmitTaskReport(
  taskRoot: string,
  report: SubmitTaskReport,
): Promise<SubmitTaskReport> {
  const reportsDir = getJudgeDir(taskRoot);
  const payload = JSON.stringify(report, null, 2);

  await Promise.all([
    mkdir(reportsDir, { recursive: true }),
    rm(path.join(reportsDir, 'submit_runs'), { recursive: true, force: true }),
  ]);

  await writeFile(path.join(reportsDir, 'latest_submit.json'), payload, 'utf8');

  return report;
}
