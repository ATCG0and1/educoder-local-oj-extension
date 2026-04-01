export interface SessionCookies {
  _educoder_session: string;
  autologin_trustie?: string;
}

export interface EdgeSessionLoader {
  loadFromEdge(): Promise<SessionCookies | undefined>;
}

export async function loadSessionFromEdge(): Promise<SessionCookies | undefined> {
  return undefined;
}
