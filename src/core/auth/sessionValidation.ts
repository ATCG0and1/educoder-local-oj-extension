import type { SessionCookies } from './sessionManager.js';

export interface HomepageSessionValidatorDeps {
  fetchImpl?: typeof fetch;
  homepageUrl?: string;
  loggedOutMarkers?: string[];
}

const DEFAULT_HOMEPAGE_URL = 'https://www.educoder.net/';
const DEFAULT_LOGGED_OUT_MARKERS = ['登录 / 注册', '登录/注册'];

export function createHomepageSessionValidator(
  deps: HomepageSessionValidatorDeps = {},
): (cookies: SessionCookies) => Promise<boolean> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const homepageUrl = deps.homepageUrl ?? DEFAULT_HOMEPAGE_URL;
  const loggedOutMarkers = deps.loggedOutMarkers ?? DEFAULT_LOGGED_OUT_MARKERS;

  return async (cookies: SessionCookies): Promise<boolean> => {
    if (!cookies._educoder_session?.trim()) {
      return false;
    }

    try {
      const response = await fetchImpl(homepageUrl, {
        method: 'GET',
        headers: {
          Cookie: buildEducoderCookieHeader(cookies),
          'Cache-Control': 'no-cache',
        },
      });

      if (!response.ok) {
        return false;
      }

      const html = await response.text();
      return !looksLoggedOut(response.url || homepageUrl, html, loggedOutMarkers);
    } catch {
      return false;
    }
  };
}

export function buildEducoderCookieHeader(session: SessionCookies): string {
  const cookieParts = [`_educoder_session=${session._educoder_session}`];
  if (session.autologin_trustie) {
    cookieParts.push(`autologin_trustie=${session.autologin_trustie}`);
  }

  return cookieParts.join('; ');
}

function looksLoggedOut(url: string, html: string, loggedOutMarkers: string[]): boolean {
  if (url.includes('/login')) {
    return true;
  }

  const normalized = html.replace(/\s+/g, ' ').trim();
  return loggedOutMarkers.some((marker) => normalized.includes(marker));
}
