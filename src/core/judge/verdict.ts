export type LocalCaseVerdict = 'passed' | 'failed' | 'runtime_error' | 'time_limit';

export interface ClassifyCaseVerdictInput {
  exitCode: number;
  expected: string;
  actual: string;
  timedOut?: boolean;
}

export function classifyCaseVerdict(input: ClassifyCaseVerdictInput): LocalCaseVerdict {
  if (input.timedOut) {
    return 'time_limit';
  }

  if (input.exitCode !== 0) {
    return 'runtime_error';
  }

  return input.expected === input.actual ? 'passed' : 'failed';
}
