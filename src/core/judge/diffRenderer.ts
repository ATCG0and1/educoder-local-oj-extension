export type DiffLineKind = 'context' | 'expected' | 'actual';

export interface SmartDiffLine {
  lineNumber: number;
  kind: DiffLineKind;
  text: string;
}

export interface SmartDiffHunk {
  startLine: number;
  endLine: number;
  lines: SmartDiffLine[];
}

export interface RenderSmartDiffInput {
  expected: string;
  actual: string;
  contextLines?: number;
}

interface HunkRange {
  start: number;
  end: number;
}

export function renderSmartDiff(input: RenderSmartDiffInput): SmartDiffHunk[] {
  if (input.expected === input.actual) {
    return [];
  }

  const contextLines = input.contextLines ?? 3;
  const expectedLines = splitLines(input.expected);
  const actualLines = splitLines(input.actual);
  const maxLineCount = Math.max(expectedLines.length, actualLines.length);
  const changedIndexes: number[] = [];

  for (let index = 0; index < maxLineCount; index += 1) {
    if (expectedLines[index] !== actualLines[index]) {
      changedIndexes.push(index);
    }
  }

  if (changedIndexes.length === 0) {
    return [];
  }

  const mergedRanges = mergeRanges(
    changedIndexes.map((index) => ({
      start: Math.max(0, index - contextLines),
      end: Math.min(maxLineCount - 1, index + contextLines),
    })),
  );

  return mergedRanges.map((range) => ({
    startLine: range.start + 1,
    endLine: range.end + 1,
    lines: buildHunkLines(range, expectedLines, actualLines),
  }));
}

function buildHunkLines(
  range: HunkRange,
  expectedLines: string[],
  actualLines: string[],
): SmartDiffLine[] {
  const lines: SmartDiffLine[] = [];

  for (let index = range.start; index <= range.end; index += 1) {
    const expected = expectedLines[index];
    const actual = actualLines[index];
    const lineNumber = index + 1;

    if (expected === actual) {
      if (expected !== undefined) {
        lines.push({
          lineNumber,
          kind: 'context',
          text: expected,
        });
      }

      continue;
    }

    if (expected !== undefined) {
      lines.push({
        lineNumber,
        kind: 'expected',
        text: expected,
      });
    }

    if (actual !== undefined) {
      lines.push({
        lineNumber,
        kind: 'actual',
        text: actual,
      });
    }
  }

  return lines;
}

function mergeRanges(ranges: HunkRange[]): HunkRange[] {
  if (ranges.length === 0) {
    return [];
  }

  const sortedRanges = [...ranges].sort((left, right) => left.start - right.start);
  const merged: HunkRange[] = [sortedRanges[0]!];

  for (const range of sortedRanges.slice(1)) {
    const current = merged[merged.length - 1]!;

    if (range.start <= current.end + 1) {
      current.end = Math.max(current.end, range.end);
      continue;
    }

    merged.push({ ...range });
  }

  return merged;
}

function splitLines(value: string): string[] {
  if (value.length === 0) {
    return [];
  }

  const normalized = value.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');

  if (lines.at(-1) === '') {
    lines.pop();
  }

  return lines;
}
