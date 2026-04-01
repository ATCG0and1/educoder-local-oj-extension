import * as vscode from 'vscode';
import { describe, it, expect } from 'vitest';

describe('command registration', () => {
  it('registers frozen MVP commands', async () => {
    const commands = await vscode.commands.getCommands(true);
    expect(commands).toContain('educoderLocalOj.syncCurrentCollection');
    expect(commands).toContain('educoderLocalOj.openTask');
    expect(commands).toContain('educoderLocalOj.runLocalJudge');
    expect(commands).toContain('educoderLocalOj.rerunFailedCases');
    expect(commands).toContain('educoderLocalOj.runOfficialJudge');
    expect(commands).toContain('educoderLocalOj.forceRunOfficialJudge');
    expect(commands).toContain('educoderLocalOj.rollbackTemplate');
    expect(commands).toContain('educoderLocalOj.rollbackPassed');
  });
});
