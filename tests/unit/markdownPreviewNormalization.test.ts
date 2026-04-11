import { describe, expect, it } from 'vitest';
import {
  normalizeAnswerMarkdownForPreview,
  normalizeStatementMarkdownForPreview,
} from '../../src/core/content/markdownPreview.js';

describe('markdown preview normalization', () => {
  it('wraps raw code answers in fenced cpp blocks so markdown preview keeps line breaks', () => {
    const input = [
      'void change_vector(vector<string> &stu,int n,int m)',
      '{',
      '    //=========代码开始==========',
      '    int k=0;',
      '}',
    ].join('\n');

    expect(normalizeAnswerMarkdownForPreview(input)).toBe([
      '```cpp',
      'void change_vector(vector<string> &stu,int n,int m)',
      '{',
      '    //=========代码开始==========',
      '    int k=0;',
      '}',
      '```',
      '',
    ].join('\n'));
  });

  it('keeps real markdown answers unchanged', () => {
    const input = '## 解题思路\n\n```cpp\nint main() { return 0; }\n```\n';
    expect(normalizeAnswerMarkdownForPreview(input)).toBe(input);
  });

  it('turns statement sample sections into fenced text blocks for markdown preview', () => {
    const input = [
      '## 样例数据',
      '【样例输入】',
      '5 3',
      '1 0 2 1 3 2 4 3 3 6',
      '3 0 2 4 5 6',
      '',
      '【样例输出】',
      '4+2x+3x^2+4x^3+2x^4+8x^6',
    ].join('\n');

    expect(normalizeStatementMarkdownForPreview(input)).toBe([
      '## 样例数据',
      '【样例输入】',
      '```text',
      '5 3',
      '1 0 2 1 3 2 4 3 3 6',
      '3 0 2 4 5 6',
      '```',
      '',
      '【样例输出】',
      '```text',
      '4+2x+3x^2+4x^3+2x^4+8x^6',
      '```',
    ].join('\n'));
  });
});
