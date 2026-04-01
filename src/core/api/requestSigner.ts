import crypto from 'node:crypto';
import type { HttpHeaders, HttpMethod } from './httpTypes.js';

export const EDU_AK = 'e9dd5b4322f9f7d83d009de9bfa100c3';
export const EDU_SK = '2e3da06ae26ba9f76a5d8d355746f2fe';
export const EDU_REQUEST_TYPE = 'pc';

export interface EduSignatureInput {
  method: HttpMethod;
  timestamp: string;
}

export function buildEduRequestSignature({
  method,
  timestamp,
}: EduSignatureInput): string {
  const raw = `method=${method}&ak=${EDU_AK}&sk=${EDU_SK}&time=${timestamp}`;
  const encoded = Buffer.from(raw, 'utf8').toString('base64');

  return crypto.createHash('md5').update(encoded).digest('hex');
}

export function buildEduRequestHeaders(input: EduSignatureInput): HttpHeaders {
  return {
    'X-EDU-Type': EDU_REQUEST_TYPE,
    'X-EDU-Timestamp': input.timestamp,
    'X-EDU-Signature': buildEduRequestSignature(input),
  };
}
