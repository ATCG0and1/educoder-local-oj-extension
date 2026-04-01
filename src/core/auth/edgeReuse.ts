export interface SessionCookies {
  _educoder_session: string;
  autologin_trustie?: string;
}

export interface EdgeSessionLoader {
  loadFromEdge(): Promise<SessionCookies | undefined>;
}

export interface DevtoolsTarget {
  type?: string;
  url?: string;
  webSocketDebuggerUrl?: string;
}

export interface DevtoolsCookie {
  name: string;
  value: string;
  domain?: string;
}

export interface JsonFetchLike {
  <T>(url: string): Promise<T>;
}

export interface WebSocketLike {
  addEventListener(
    type: 'open' | 'message' | 'error' | 'close',
    listener: (event: any) => void,
  ): void;
  send(data: string): void;
  close(): void;
}

export type WebSocketFactory = (url: string) => WebSocketLike;

export const EDGE_DEBUG_PORT_ENV = 'EDUCODER_EDGE_DEBUG_PORT';

export async function loadSessionFromEdge(): Promise<SessionCookies | undefined> {
  const port = Number(process.env[EDGE_DEBUG_PORT_ENV]);
  if (!Number.isInteger(port) || port <= 0) {
    return undefined;
  }

  return loadSessionFromDevtoolsPort(port);
}

export async function loadSessionFromDevtoolsPort(
  port: number,
  deps: {
    fetchJson?: JsonFetchLike;
    openSocket?: WebSocketFactory;
  } = {},
): Promise<SessionCookies | undefined> {
  const targets = await (deps.fetchJson ?? fetchJson)<DevtoolsTarget[]>(
    `http://127.0.0.1:${port}/json/list`,
  );
  const target = pickEducoderTarget(targets);
  if (!target?.webSocketDebuggerUrl) {
    return undefined;
  }

  const cookies = await readCookiesFromDevtools(
    target.webSocketDebuggerUrl,
    deps.openSocket ?? createWebSocket,
  );
  return selectEducoderSessionCookies(cookies);
}

export function pickEducoderTarget(targets: DevtoolsTarget[]): DevtoolsTarget | undefined {
  return (
    targets.find(
      (target) =>
        Boolean(target.webSocketDebuggerUrl) &&
        target.type === 'page' &&
        target.url?.includes('educoder.net'),
    ) ??
    targets.find((target) => Boolean(target.webSocketDebuggerUrl) && target.type === 'page') ??
    targets.find((target) => Boolean(target.webSocketDebuggerUrl))
  );
}

export function selectEducoderSessionCookies(
  cookies: DevtoolsCookie[],
): SessionCookies | undefined {
  const sessionCookie = cookies.find((cookie) => cookie.name === '_educoder_session');
  if (!sessionCookie?.value) {
    return undefined;
  }

  const trustieCookie = cookies.find((cookie) => cookie.name === 'autologin_trustie')?.value;

  return {
    _educoder_session: sessionCookie.value,
    autologin_trustie: trustieCookie || undefined,
  };
}

async function readCookiesFromDevtools(
  webSocketDebuggerUrl: string,
  openSocket: WebSocketFactory,
): Promise<DevtoolsCookie[]> {
  return new Promise<DevtoolsCookie[]>((resolve, reject) => {
    const socket = openSocket(webSocketDebuggerUrl);
    let settled = false;

    const finish = (callback: () => void) => {
      if (settled) {
        return;
      }

      settled = true;
      try {
        socket.close();
      } catch {
        // ignore close errors on shutdown
      }
      callback();
    };

    socket.addEventListener('open', () => {
      socket.send(
        JSON.stringify({
          id: 1,
          method: 'Network.getAllCookies',
        }),
      );
    });

    socket.addEventListener('message', (event: { data: string | Buffer }) => {
      try {
        const raw = typeof event.data === 'string' ? event.data : event.data.toString('utf8');
        const payload = JSON.parse(raw) as {
          id?: number;
          error?: { message?: string };
          result?: { cookies?: DevtoolsCookie[] };
        };

        if (payload.id !== 1) {
          return;
        }

        if (payload.error) {
          finish(() =>
            reject(new Error(payload.error?.message ?? '无法从 Edge DevTools 读取登录态')),
          );
          return;
        }

        finish(() => resolve(payload.result?.cookies ?? []));
      } catch (error) {
        finish(() => reject(error));
      }
    });

    socket.addEventListener('error', () => {
      finish(() => reject(new Error('无法连接 Edge DevTools 调试通道')));
    });

    socket.addEventListener('close', () => {
      if (!settled) {
        settled = true;
        reject(new Error('Edge DevTools 调试通道已关闭'));
      }
    });
  });
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`无法访问 Edge DevTools：${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

function createWebSocket(url: string): WebSocketLike {
  const WebSocketCtor = (globalThis as { WebSocket?: new (url: string) => WebSocketLike }).WebSocket;
  if (!WebSocketCtor) {
    throw new Error('当前环境不支持 WebSocket，无法读取 Edge 调试数据');
  }

  return new WebSocketCtor(url);
}
