import { describe, expect, it } from 'vitest';
import { classifyCaseVerdict } from '../../src/core/judge/verdict.js';

describe('classifyCaseVerdict', () => {
  it('treats CRLF differences as equivalent output', () => {
    expect(
      classifyCaseVerdict({
        exitCode: 0,
        expected: '4 9 3\r\n3 9 0\r\n',
        actual: '4 9 3\n3 9 0\n',
      }),
    ).toBe('passed');
  });

  it('ignores trailing whitespace-only differences at line endings', () => {
    expect(
      classifyCaseVerdict({
        exitCode: 0,
        expected: 'accepted\n42\n',
        actual: 'accepted  \r\n42\t\r\n\r\n',
      }),
    ).toBe('passed');
  });

  it('still fails when the visible content is actually different', () => {
    expect(
      classifyCaseVerdict({
        exitCode: 0,
        expected: '4 9 3\n3 9 0\n',
        actual: '4 9 3\n3 9 1\n',
      }),
    ).toBe('failed');
  });
});
