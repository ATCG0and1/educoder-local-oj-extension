import { describe, expect, it } from 'vitest';
import { createApiInventory } from '../../src/core/recon/apiInventory.js';

describe('createApiInventory', () => {
  it('deduplicates the same endpoint across query variants and keeps the latest status', () => {
    const inventory = createApiInventory();

    inventory.record({
      method: 'GET',
      url: 'https://data.educoder.net/api/tasks/fc7pz3fm6yjh.json?foo=1',
      status: 200,
      ok: true,
      durationMs: 18,
    });
    inventory.record({
      method: 'GET',
      url: 'https://data.educoder.net/api/tasks/fc7pz3fm6yjh.json?foo=2',
      status: 401,
      ok: false,
      durationMs: 26,
      businessStatus: 401,
      businessMessage: '请登录后再操作',
    });

    expect(inventory.list()).toEqual([
      expect.objectContaining({
        method: 'GET',
        host: 'data.educoder.net',
        path: '/api/tasks/fc7pz3fm6yjh.json',
        calls: 2,
        lastStatus: 401,
        businessStatuses: [401],
      }),
    ]);
  });

  it('keeps ordered request events for later recon export', () => {
    const inventory = createApiInventory();

    inventory.record({
      method: 'GET',
      url: 'https://data.educoder.net/api/demo-a',
      status: 200,
      ok: true,
      durationMs: 11,
    });
    inventory.record({
      method: 'POST',
      url: 'https://data.educoder.net/api/demo-b',
      status: 500,
      ok: false,
      durationMs: 13,
      errorMessage: 'boom',
    });

    expect(inventory.events()).toEqual([
      expect.objectContaining({
        method: 'GET',
        path: '/api/demo-a',
      }),
      expect.objectContaining({
        method: 'POST',
        path: '/api/demo-b',
        errorMessage: 'boom',
      }),
    ]);
  });
});
