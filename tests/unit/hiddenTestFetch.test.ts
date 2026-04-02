import { describe, expect, it } from 'vitest';
import {
  HiddenTestFetchClient,
  normalizeHiddenTests,
} from '../../src/core/api/hiddenTestFetchClient.js';

describe('HiddenTestFetchClient', () => {
  it('normalizes all returned test sets into cached local cases', async () => {
    const hiddenClient = new HiddenTestFetchClient({
      get: async <T>() =>
        ({
        test_sets: [
          { is_public: true, input: '1 2\n', output: '3\n' },
          { is_public: false, input: '4 5\n', output: '9\n' },
        ],
      }) as T,
    });

    await expect(hiddenClient.fetchHiddenTests({ taskId: 'fc7pz3fm6yjh' })).resolves.toEqual([
      { input: '1 2\n', output: '3\n' },
      { input: '4 5\n', output: '9\n' },
    ]);
  });

  it('can filter to only hidden cases when includePublic is disabled', () => {
    expect(
      normalizeHiddenTests(
        [
          { is_public: true, input: '1\n', output: '1\n' },
          { is_public: false, input: '2\n', output: '2\n' },
        ],
        false,
      ),
    ).toEqual([{ input: '2\n', output: '2\n' }]);
  });
});
