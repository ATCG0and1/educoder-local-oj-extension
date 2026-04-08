import { describe, expect, it } from 'vitest';
import {
  BusinessRequestError,
  createFetchTransport,
} from '../../src/core/api/fetchTransport.js';

describe('createFetchTransport', () => {
  it('throws business errors carried in a 200 JSON response', async () => {
    const transport = createFetchTransport(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: {
        get: () => 'application/json',
      },
      text: async () => JSON.stringify({ status: 401, message: '请登录后再操作' }),
    }));

    await expect(
      transport.request('https://data.educoder.net/api/demo', {
        method: 'GET',
        headers: {},
      }),
    ).rejects.toMatchObject({
      status: 401,
      businessMessage: '请登录后再操作',
    });
  });

  it('keeps answer-info style success payloads with numeric status and array message', async () => {
    const transport = createFetchTransport(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: {
        get: () => 'application/json',
      },
      text: async () => JSON.stringify({ status: 3, message: [{ answer_id: 1 }] }),
    }));

    await expect(
      transport.request('https://data.educoder.net/api/demo', {
        method: 'GET',
        headers: {},
      }),
    ).resolves.toEqual({ status: 3, message: [{ answer_id: 1 }] });
  });

  it('emits a request trace for recon logging', async () => {
    const traces: unknown[] = [];
    const transport = createFetchTransport(
      async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get: () => 'application/json',
        },
        text: async () => JSON.stringify({ ok: true }),
      }),
      {
        onSettled: (event) => {
          traces.push(event);
        },
      },
    );

    await expect(
      transport.request('https://data.educoder.net/api/demo?foo=bar', {
        method: 'POST',
        headers: {},
        body: JSON.stringify({ hello: 'world' }),
      }),
    ).resolves.toEqual({ ok: true });

    expect(traces).toEqual([
      expect.objectContaining({
        method: 'POST',
        host: 'data.educoder.net',
        path: '/api/demo',
        status: 200,
        ok: true,
      }),
    ]);
  });
});
