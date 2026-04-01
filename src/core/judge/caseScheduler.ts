import type { LocalCaseVerdict } from './verdict.js';

export type LocalJudgeRunMode = 'full' | 'failed-only';

export interface CaseRunPlan {
  runMode: LocalJudgeRunMode;
  caseIds: string[];
  reason?: 'full-recheck';
}

export interface PlanCaseRunInput {
  allCaseIds: string[];
  rerunFailedOnly?: boolean;
  lastReport?: {
    runMode: LocalJudgeRunMode;
    caseResults: Array<{
      caseId: string;
      verdict: LocalCaseVerdict;
    }>;
  };
}

export function planCaseRun(input: PlanCaseRunInput): CaseRunPlan {
  if (!input.rerunFailedOnly) {
    return {
      runMode: 'full',
      caseIds: [...input.allCaseIds],
    };
  }

  if (!input.lastReport) {
    return {
      runMode: 'full',
      caseIds: [...input.allCaseIds],
    };
  }

  const failedCaseIds = new Set(
    input.lastReport.caseResults
      .filter((caseResult) => caseResult.verdict !== 'passed')
      .map((caseResult) => caseResult.caseId),
  );

  if (input.lastReport.runMode === 'failed-only' && failedCaseIds.size === 0) {
    return {
      runMode: 'full',
      reason: 'full-recheck',
      caseIds: [...input.allCaseIds],
    };
  }

  const scheduledCaseIds = input.allCaseIds.filter((caseId) => failedCaseIds.has(caseId));

  if (scheduledCaseIds.length === 0) {
    return {
      runMode: 'full',
      caseIds: [...input.allCaseIds],
    };
  }

  return {
    runMode: 'failed-only',
    caseIds: scheduledCaseIds,
  };
}
