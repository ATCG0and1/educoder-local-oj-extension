import { describe, expect, it, vi } from 'vitest';
import { handleDashboardMessage } from '../../src/webview/dashboard/panel.js';

describe('dashboard panel message handling', () => {
  it('executes the requested command and refreshes the task model when taskRoot is provided', async () => {
    const executeCommand = vi.fn(async () => undefined);
    const refreshTask = vi.fn(async () => undefined);

    await handleDashboardMessage(
      {
        type: 'runCommand',
        command: 'educoderLocalOj.syncTaskAnswers',
        taskRoot: 'C:/task-root',
      },
      {
        executeCommand,
        refreshTask,
      },
    );

    expect(executeCommand).toHaveBeenCalledWith('educoderLocalOj.syncTaskAnswers', 'C:/task-root');
    expect(refreshTask).toHaveBeenCalledWith('C:/task-root');
  });

  it('ignores unknown messages', async () => {
    const executeCommand = vi.fn(async () => undefined);
    const refreshTask = vi.fn(async () => undefined);

    await handleDashboardMessage({ type: 'noop' }, { executeCommand, refreshTask });

    expect(executeCommand).not.toHaveBeenCalled();
    expect(refreshTask).not.toHaveBeenCalled();
  });
});
