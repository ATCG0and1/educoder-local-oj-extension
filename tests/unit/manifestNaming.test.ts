import { describe, expect, it } from 'vitest';
import { formatStableFolderName, sanitizePathSegment } from '../../src/core/workspace/nameSanitizer.js';

describe('nameSanitizer', () => {
  it('preserves readable chinese names while replacing windows-illegal characters', () => {
    expect(sanitizePathSegment('第二章: 线性表/应用?')).toBe('第二章： 线性表／应用？');
  });

  it('formats stable folder names with readable labels and ids', () => {
    expect(
      formatStableFolderName('第1关 基本实训：链表操作', 'fc7pz3fm6yjh', {
        index: 1,
        fallbackName: '任务',
      }),
    ).toBe('01 第1关 基本实训：链表操作 [fc7pz3fm6yjh]');
  });
});
