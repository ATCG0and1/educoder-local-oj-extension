import { describe, expect, it } from 'vitest';
import { renderSmartDiff } from '../../src/core/judge/diffRenderer.js';

describe('renderSmartDiff', () => {
  it('returns no hunks when outputs are identical', () => {
    expect(renderSmartDiff({ expected: 'a\nb\n', actual: 'a\nb\n' })).toEqual([]);
  });

  it('collapses equal lines and keeps ±3 lines around differences', () => {
    const expected = [
      'line 1',
      'line 2',
      'line 3',
      'line 4',
      'line 5 expected',
      'line 6',
      'line 7',
      'line 8',
      'line 9',
      'line 10',
    ].join('\n');
    const actual = [
      'line 1',
      'line 2',
      'line 3',
      'line 4',
      'line 5 actual',
      'line 6',
      'line 7',
      'line 8',
      'line 9',
      'line 10',
    ].join('\n');

    const hunks = renderSmartDiff({ expected, actual, contextLines: 3 });

    expect(hunks).toHaveLength(1);
    expect(hunks[0]?.lines.map((line) => `${line.kind}:${line.text}`)).toEqual([
      'context:line 2',
      'context:line 3',
      'context:line 4',
      'expected:line 5 expected',
      'actual:line 5 actual',
      'context:line 6',
      'context:line 7',
      'context:line 8',
    ]);
  });
});
