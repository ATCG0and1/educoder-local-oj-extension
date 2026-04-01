import type { EducoderTransport } from './educoderClient.js';
import type { HttpHeaders, HttpMethod } from './httpTypes.js';

interface FetchLikeResponse {
  ok: boolean;
  status: number;
  statusText: string;
  headers: {
    get(name: string): string | null;
  };
  text(): Promise<string>;
}

type FetchLike = (
  input: string,
  init: {
    method: HttpMethod;
    headers: HttpHeaders;
    body?: string;
  },
) => Promise<FetchLikeResponse>;

export class HttpRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: string,
  ) {
    super(message);
  }
}

export function createFetchTransport(fetchImpl: FetchLike = fetch as FetchLike): EducoderTransport {
  return {
    request: async <T>(
      url: string,
      init: {
        method: HttpMethod;
        headers: HttpHeaders;
        body?: string;
      },
    ): Promise<T> => {
      const response = await fetchImpl(url, init);
      const rawText = await response.text();

      if (!response.ok) {
        throw new HttpRequestError(
          `Educoder request failed: ${response.status} ${response.statusText}`,
          response.status,
          rawText,
        );
      }

      if (!rawText) {
        return undefined as T;
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        return JSON.parse(rawText) as T;
      }

      return rawText as T;
    },
  };
}
