import { describe, expect, it } from 'vitest';
import { extractFirstCompileDiagnosticBlock } from '../../src/core/judge/compileDiagnostics.js';

describe('extractFirstCompileDiagnosticBlock', () => {
  it('extracts the first gcc-style error block and skips function-context lines', () => {
    const stderr = [
      'add/polynomial.cpp: In member function `float polynomial::sum() const`:',
      'add/polynomial.cpp:15:11: error: expected `;` at end of member declaration',
      '    float coef// 系数',
      '          ^',
      'add/polynomial.cpp:16:5: note: something else',
    ].join('\n');

    expect(extractFirstCompileDiagnosticBlock(stderr)).toBe([
      'add/polynomial.cpp:15:11: error: expected `;` at end of member declaration',
      '    float coef// 系数',
      '          ^',
      'add/polynomial.cpp:16:5: note: something else',
    ].join('\n'));
  });

  it('handles included-header style compiler output by returning the first real diagnostic block', () => {
    const stderr = [
      'In file included from add/polynomial.cpp:1:0:',
      'add/polynomial.h:22:5: error: `node` does not name a type',
      '    node* next;',
      '    ^~~~',
    ].join('\n');

    expect(extractFirstCompileDiagnosticBlock(stderr)).toBe([
      'add/polynomial.h:22:5: error: `node` does not name a type',
      '    node* next;',
      '    ^~~~',
    ].join('\n'));
  });

  it('returns undefined when stderr has no structured compiler diagnostic block', () => {
    expect(extractFirstCompileDiagnosticBlock('g++: fatal error: no input files')).toBeUndefined();
  });
});
