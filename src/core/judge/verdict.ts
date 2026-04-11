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

  return normalizeJudgeText(input.expected) === normalizeJudgeText(input.actual) ? 'passed' : 'failed';
}

function normalizeJudgeText(value: string): string {
  const lines = value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''));

  while (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }

  return lines.join('\n');
}
