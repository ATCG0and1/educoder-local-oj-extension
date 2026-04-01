import { describe, expect, it, vi } from 'vitest';
import {
  LOGIN_CONFIRM_LABEL,
  LOGIN_PROMPT_MESSAGE,
  promptEducoderLogin,
} from '../../src/core/auth/loginFlow.js';
import type { SessionCookies } from '../../src/core/auth/sessionManager.js';

describe('promptEducoderLogin', () => {
  it('returns captured session after the user confirms login completion', async () => {
    const browser = {
      port: 9223,
      waitUntilReady: vi.fn(async () => undefined),
      dispose: vi.fn(async () => undefined),
    };
    const session: SessionCookies = {
      _educoder_session: 'fresh-session',
      autologin_trustie: 'fresh-trustie',
    };
    const showInformationMessage = vi.fn(async () => LOGIN_CONFIRM_LABEL);
    const extractSession = vi.fn(async () => session);

    await expect(
      promptEducoderLogin({
        window: { showInformationMessage },
        launchBrowser: async () => browser,
        extractSession,
      }),
    ).resolves.toEqual(session);

    expect(browser.waitUntilReady).toHaveBeenCalledTimes(1);
    expect(showInformationMessage).toHaveBeenCalledWith(
      LOGIN_PROMPT_MESSAGE,
      LOGIN_CONFIRM_LABEL,
      '取消',
    );
    expect(extractSession).toHaveBeenCalledWith(9223);
    expect(browser.dispose).toHaveBeenCalledTimes(1);
  });

  it('returns undefined when the user cancels the login flow', async () => {
    const browser = {
      port: 9555,
      waitUntilReady: vi.fn(async () => undefined),
      dispose: vi.fn(async () => undefined),
    };
    const extractSession = vi.fn(async () => {
      throw new Error('should not be called');
    });

    await expect(
      promptEducoderLogin({
        window: {
          showInformationMessage: async () => '取消',
        },
        launchBrowser: async () => browser,
        extractSession,
      }),
    ).resolves.toBeUndefined();

    expect(extractSession).not.toHaveBeenCalled();
    expect(browser.dispose).toHaveBeenCalledTimes(1);
  });
});
