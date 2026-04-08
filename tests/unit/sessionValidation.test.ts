import { describe, expect, it, vi } from 'vitest';
import { createHomepageSessionValidator } from '../../src/core/auth/sessionValidation.js';
import type { SessionCookies } from '../../src/core/auth/sessionManager.js';

const sessionCookies: SessionCookies = {
  _educoder_session: 'cached-session',
  autologin_trustie: 'cached-trustie',
};

describe('createHomepageSessionValidator', () => {
  it('accepts a session when the homepage probe does not look like a logged-out shell', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response('<html><body><div>workspace</div></body></html>', {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      }),
    );

    const validate = createHomepageSessionValidator({ fetchImpl });

    await expect(validate(sessionCookies)).resolves.toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://www.educoder.net/',
      expect.objectContaining({
        headers: expect.objectContaining({
          Cookie: '_educoder_session=cached-session; autologin_trustie=cached-trustie',
        }),
      }),
    );
  });

  it('rejects a session when the homepage probe redirects to login shell html', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response('<html><body>登录 / 注册</body></html>', {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      }),
    );

    const validate = createHomepageSessionValidator({ fetchImpl });

    await expect(validate(sessionCookies)).resolves.toBe(false);
  });

  it('rejects a session when the probe request fails', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('network down');
    });

    const validate = createHomepageSessionValidator({ fetchImpl });

    await expect(validate(sessionCookies)).resolves.toBe(false);
  });
});
