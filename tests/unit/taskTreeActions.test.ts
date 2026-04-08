import { describe, expect, it } from 'vitest';
import { resolveTaskRootFromTreeInput } from '../../src/commands/taskTreeActions.js';

describe('resolveTaskRootFromTreeInput', () => {
  it('extracts taskRoot from a task tree node payload', () => {
    expect(
      resolveTaskRootFromTreeInput({
        kind: 'task',
        data: {
          taskRoot: 'C:/task-root',
        },
      }),
    ).toBe('C:/task-root');
  });

  it('returns undefined for non-task payloads', () => {
    expect(resolveTaskRootFromTreeInput({ kind: 'homework', data: {} })).toBeUndefined();
  });
});
