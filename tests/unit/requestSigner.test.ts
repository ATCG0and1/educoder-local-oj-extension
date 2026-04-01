import { describe, expect, it } from 'vitest';
import {
  EDU_AK,
  EDU_REQUEST_TYPE,
  EDU_SK,
  buildEduRequestHeaders,
  buildEduRequestSignature,
} from '../../src/core/api/requestSigner.js';

describe('requestSigner', () => {
  it('builds the known signature sample from the recovered algorithm', () => {
    expect(EDU_AK).toBe('e9dd5b4322f9f7d83d009de9bfa100c3');
    expect(EDU_SK).toBe('2e3da06ae26ba9f76a5d8d355746f2fe');

    const signature = buildEduRequestSignature({
      method: 'GET',
      timestamp: '1711963200000',
    });

    expect(signature).toBe('c6dfe434b7cd95d2989c9a173bd439af');
  });

  it('builds signed educoder headers with fixed request type and timestamp', () => {
    const headers = buildEduRequestHeaders({
      method: 'POST',
      timestamp: '1711963200001',
    });

    expect(headers['X-EDU-Type']).toBe(EDU_REQUEST_TYPE);
    expect(headers['X-EDU-Timestamp']).toBe('1711963200001');
    expect(headers['X-EDU-Signature']).toBe(
      buildEduRequestSignature({
        method: 'POST',
        timestamp: '1711963200001',
      }),
    );
  });
});
