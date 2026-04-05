import * as vscode from 'vscode';
import { describe, expect, it } from 'vitest';

describe('dashboard sidebar smoke', () => {
  it('resolves the registered sidebar view and shows launcher actions', async () => {
    const vscodeMock = (vscode as any).__mock;
    const view = await vscodeMock.resolveWebviewView('educoderLocalOj.sidebar');

    expect(view).toBeDefined();
    expect(view.webview.html).toContain('一键同步本章');
    expect(view.webview.html).toContain('更换存放目录');
    expect(view.webview.html).toContain('打开当前题目');
    expect(view.webview.html).toContain('刷新状态');
  });
});
