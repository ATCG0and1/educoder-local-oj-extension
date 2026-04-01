import { describe, expect, it } from 'vitest';
import { planCaseRun } from '../../src/core/judge/caseScheduler.js';

describe('planCaseRun', () => {
  it('schedules all hidden cases on the first run', () => {
    const schedule = planCaseRun({
      allCaseIds: ['case_001', 'case_002', 'case_003'],
      rerunFailedOnly: false,
    });

    expect(schedule.runMode).toBe('full');
    expect(schedule.caseIds).toEqual(['case_001', 'case_002', 'case_003']);
  });

  it('schedules only previously failed cases in rerun mode', () => {
    const schedule = planCaseRun({
      allCaseIds: ['case_001', 'case_002', 'case_003'],
      rerunFailedOnly: true,
      lastReport: {
        runMode: 'full',
        caseResults: [
          { caseId: 'case_001', verdict: 'passed' },
          { caseId: 'case_002', verdict: 'failed' },
          { caseId: 'case_003', verdict: 'runtime_error' },
        ],
      },
    });

    expect(schedule.runMode).toBe('failed-only');
    expect(schedule.caseIds).toEqual(['case_002', 'case_003']);
  });

  it('requests a full recheck after a failed-only rerun turns all cases green', () => {
    const schedule = planCaseRun({
      allCaseIds: ['case_001', 'case_002', 'case_003'],
      rerunFailedOnly: true,
      lastReport: {
        runMode: 'failed-only',
        caseResults: [
          { caseId: 'case_002', verdict: 'passed' },
          { caseId: 'case_003', verdict: 'passed' },
        ],
      },
    });

    expect(schedule.runMode).toBe('full');
    expect(schedule.reason).toBe('full-recheck');
    expect(schedule.caseIds).toEqual(['case_001', 'case_002', 'case_003']);
  });
});
