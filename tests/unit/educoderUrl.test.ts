import { describe, it, expect } from 'vitest';
import { parseEducoderCollectionUrl } from '../../src/core/url/educoderUrl.js';

describe('parseEducoderCollectionUrl', () => {
  it('accepts shixun_homework collection urls', () => {
    const result = parseEducoderCollectionUrl('https://www.educoder.net/classrooms/ufr7sxlc/shixun_homework/1316861?tabs=0');
    expect(result.courseId).toBe('ufr7sxlc');
    expect(result.categoryId).toBe('1316861');
  });

  it('accepts shixun_homework collection urls with extra path segments', () => {
    const result = parseEducoderCollectionUrl(
      'https://www.educoder.net/classrooms/ufr7sxlc/shixun_homework/1316861/homeworks/3727447',
    );
    expect(result.courseId).toBe('ufr7sxlc');
    expect(result.categoryId).toBe('1316861');
  });

  it('rejects unrelated urls', () => {
    expect(() => parseEducoderCollectionUrl('https://www.educoder.net/problems/1')).toThrow();
  });

  it('rejects urls from the wrong host', () => {
    expect(() => parseEducoderCollectionUrl('https://example.com/classrooms/ufr7sxlc/shixun_homework/1316861')).toThrow();
  });

  it('rejects urls with the wrong scheme', () => {
    expect(() => parseEducoderCollectionUrl('http://www.educoder.net/classrooms/ufr7sxlc/shixun_homework/1316861')).toThrow();
  });
});
