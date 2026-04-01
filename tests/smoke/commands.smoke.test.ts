import { describe, it, expect, vi, beforeEach } from 'vitest';
import type * as VsCode from 'vscode';

const mocked = vi.hoisted(() => {
  const registeredCommands = new Map<string, (...args: unknown[]) => unknown>();
  const registerCommand = vi.fn((command: string, handler: (...args: unknown[]) => unknown) => {
    registeredCommands.set(command, handler);
    return {
      dispose: () => {
        registeredCommands.delete(command);
      },
    };
  });
  const getCommands = vi.fn(async () => [...registeredCommands.keys()]);

  return { registeredCommands, registerCommand, getCommands };
});

vi.mock('vscode', () => ({
  commands: {
    registerCommand: mocked.registerCommand,
    getCommands: mocked.getCommands,
  },
}));

import * as vscode from 'vscode';
import { activate } from '../../src/extension.js';

const frozenCommands = [
  'educoderLocalOj.syncCurrentCollection',
  'educoderLocalOj.openTask',
  'educoderLocalOj.runLocalJudge',
  'educoderLocalOj.rerunFailedCases',
  'educoderLocalOj.runOfficialJudge',
  'educoderLocalOj.forceRunOfficialJudge',
  'educoderLocalOj.rollbackTemplate',
  'educoderLocalOj.rollbackPassed',
] as const;

describe('command registration', () => {
  beforeEach(() => {
    mocked.registeredCommands.clear();
    mocked.registerCommand.mockClear();
    mocked.getCommands.mockClear();
  });

  it('registers frozen MVP commands on activate only', async () => {
    await expect(vscode.commands.getCommands(true)).resolves.toEqual([]);

    const context = {
      subscriptions: [],
    } as unknown as VsCode.ExtensionContext;

    await activate(context);

    expect(mocked.registerCommand).toHaveBeenCalledTimes(frozenCommands.length);

    const commands = await vscode.commands.getCommands(true);
    expect(commands).toEqual(expect.arrayContaining(Array.from(frozenCommands)));
    expect(context.subscriptions).toHaveLength(frozenCommands.length);
  });
});
