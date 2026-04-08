import { describe, expect, it } from 'vitest';
import {
  clearEdgeDebugPort,
  getEdgeDebugPort,
  setEdgeDebugPort,
} from '../../src/core/auth/edgeDebugPortStore.js';

describe('edgeDebugPortStore', () => {
  it('returns undefined when no port is set', () => {
    const store = new Map<string, unknown>();
    const context = {
      globalState: {
        get: <T>(key: string) => store.get(key) as T | undefined,
        update: async (key: string, value: unknown) => {
          store.set(key, value);
        },
      },
    };

    expect(getEdgeDebugPort(context)).toBeUndefined();
  });

  it('stores and reads a valid port', async () => {
    const store = new Map<string, unknown>();
    const context = {
      globalState: {
        get: <T>(key: string) => store.get(key) as T | undefined,
        update: async (key: string, value: unknown) => {
          store.set(key, value);
        },
      },
    };

    await setEdgeDebugPort(context, 9222);
    expect(getEdgeDebugPort(context)).toBe(9222);

    await clearEdgeDebugPort(context);
    expect(getEdgeDebugPort(context)).toBeUndefined();
  });

  it('rejects invalid ports', async () => {
    const store = new Map<string, unknown>();
    const context = {
      globalState: {
        get: <T>(key: string) => store.get(key) as T | undefined,
        update: async (key: string, value: unknown) => {
          store.set(key, value);
        },
      },
    };

    await expect(setEdgeDebugPort(context, 0)).rejects.toThrow();
    await expect(setEdgeDebugPort(context, -1)).rejects.toThrow();
    await expect(setEdgeDebugPort(context, 1.5)).rejects.toThrow();
    await expect(setEdgeDebugPort(context, Number.NaN)).rejects.toThrow();
  });

  it('treats non-number stored values as missing', async () => {
    const store = new Map<string, unknown>();
    store.set('educoderEdgeDebugPort', '9222');

    const context = {
      globalState: {
        get: <T>(key: string) => store.get(key) as T | undefined,
        update: async (key: string, value: unknown) => {
          store.set(key, value);
        },
      },
    };

    expect(getEdgeDebugPort(context)).toBeUndefined();
  });
});
