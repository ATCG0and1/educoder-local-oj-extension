import { describe, expect, it, vi } from 'vitest';
import {
  EDGE_DEBUG_PORT_ENV,
  loadSessionFromDevtoolsPort,
  loadSessionFromEdge,
  pickEducoderTarget,
  selectEducoderSessionCookies,
  type DevtoolsTarget,
} from '../../src/core/auth/edgeReuse.js';

describe('edgeReuse helpers', () => {
  it('selects educoder cookies from a devtools snapshot', () => {
    expect(
      selectEducoderSessionCookies([
        { name: 'foo', value: 'bar' },
        { name: '_educoder_session', value: 'session-1' },
        { name: 'autologin_trustie', value: 'trust-1' },
      ]),
    ).toEqual({
      _educoder_session: 'session-1',
      autologin_trustie: 'trust-1',
    });
  });

  it('prefers an educoder page target when choosing a devtools websocket target', () => {
    const targets: DevtoolsTarget[] = [
      { type: 'page', url: 'https://example.com', webSocketDebuggerUrl: 'ws://example' },
      {
        type: 'page',
        url: 'https://www.educoder.net/classrooms/ufr7sxlc/shixun_homework/1316861',
        webSocketDebuggerUrl: 'ws://educoder',
      },
    ];

    expect(pickEducoderTarget(targets)?.webSocketDebuggerUrl).toBe('ws://educoder');
  });

  it('loads session cookies from a devtools websocket target', async () => {
    const fakeSocket = createFakeSocket(
      JSON.stringify({
        id: 1,
        result: {
          cookies: [
            { name: '_educoder_session', value: 'ws-session' },
            { name: 'autologin_trustie', value: 'ws-trustie' },
          ],
        },
      }),
    );

    await expect(
      loadSessionFromDevtoolsPort(9222, {
        fetchJson: async <T>() =>
          [
            {
              type: 'page',
              url: 'https://www.educoder.net/',
              webSocketDebuggerUrl: 'ws://educoder',
            },
          ] as T,
        openSocket: () => {
          queueMicrotask(() => fakeSocket.triggerOpen());
          return fakeSocket;
        },
      }),
    ).resolves.toEqual({
      _educoder_session: 'ws-session',
      autologin_trustie: 'ws-trustie',
    });
  });

  it('returns undefined when no debug port is configured for edge reuse', async () => {
    const originalValue = process.env[EDGE_DEBUG_PORT_ENV];
    delete process.env[EDGE_DEBUG_PORT_ENV];

    try {
      await expect(loadSessionFromEdge()).resolves.toBeUndefined();
    } finally {
      if (originalValue) {
        process.env[EDGE_DEBUG_PORT_ENV] = originalValue;
      }
    }
  });
});

function createFakeSocket(messagePayload: string) {
  const listeners = new Map<string, Array<(event: any) => void>>();

  const emit = (type: string, event: any) => {
    for (const listener of listeners.get(type) ?? []) {
      listener(event);
    }
  };

  return {
    addEventListener(type: string, listener: (event: any) => void) {
      listeners.set(type, [...(listeners.get(type) ?? []), listener]);
    },
    send: vi.fn(() => {
      queueMicrotask(() => emit('message', { data: messagePayload }));
    }),
    close: vi.fn(),
    triggerOpen() {
      emit('open', {});
    },
  };
}
