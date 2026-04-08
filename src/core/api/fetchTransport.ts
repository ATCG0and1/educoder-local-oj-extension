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

export interface TransportTraceEvent {
  method: HttpMethod;
  url: string;
  host?: string;
  path?: string;
  status: number;
  ok: boolean;
  durationMs: number;
  contentType?: string;
  businessStatus?: number;
  businessMessage?: string;
  errorMessage?: string;
}

export interface FetchTransportOptions {
  onSettled?(event: TransportTraceEvent): void;
}

export class HttpRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: string,
  ) {
    super(message);
  }
}

export class BusinessRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly businessMessage: string,
    readonly payload?: unknown,
  ) {
    super(message);
    this.name = 'BusinessRequestError';
  }
}

export function createFetchTransport(
  fetchImpl: FetchLike = fetch as FetchLike,
  options: FetchTransportOptions = {},
): EducoderTransport {
  return {
    request: async <T>(
      url: string,
      init: {
        method: HttpMethod;
        headers: HttpHeaders;
        body?: string;
      },
    ): Promise<T> => {
      const startedAt = Date.now();
      let traceEmitted = false;
      const traceLocation = resolveTraceLocation(url);
      const emitTrace = (event: Omit<TransportTraceEvent, 'method' | 'url' | 'host' | 'path'>) => {
        traceEmitted = true;
        options.onSettled?.({
          method: init.method,
          url,
          host: traceLocation.host,
          path: traceLocation.path,
          ...event,
        });
      };

      try {
        const response = await fetchImpl(url, init);
        const rawText = await response.text();
        const parsedJson = tryParseJson(rawText);
        const businessError = toBusinessRequestError(parsedJson);
        const contentType = response.headers.get('content-type') ?? undefined;
        const durationMs = Date.now() - startedAt;

        if (!response.ok) {
          emitTrace({
            status: response.status,
            ok: false,
            durationMs,
            contentType,
            businessStatus: businessError?.status,
            businessMessage: businessError?.businessMessage,
          });

          if (businessError) {
            throw businessError;
          }

          throw new HttpRequestError(
            `Educoder request failed: ${response.status} ${response.statusText}`,
            response.status,
            rawText,
          );
        }

        if (!rawText) {
          emitTrace({
            status: response.status,
            ok: true,
            durationMs,
            contentType,
          });
          return undefined as T;
        }

        if ((contentType ?? '').includes('application/json')) {
          if (businessError) {
            emitTrace({
              status: response.status,
              ok: false,
              durationMs,
              contentType,
              businessStatus: businessError.status,
              businessMessage: businessError.businessMessage,
            });
            throw businessError;
          }

          emitTrace({
            status: response.status,
            ok: true,
            durationMs,
            contentType,
          });
          return parsedJson as T;
        }

        emitTrace({
          status: response.status,
          ok: true,
          durationMs,
          contentType,
        });
        return rawText as T;
      } catch (error) {
        if (!traceEmitted) {
          emitTrace({
            status: 0,
            ok: false,
            durationMs: Date.now() - startedAt,
            errorMessage: error instanceof Error ? error.message : String(error),
          });
        }
        throw error;
      }
    },
  };
}

function tryParseJson(rawText: string): unknown {
  if (!rawText.trim()) {
    return undefined;
  }

  try {
    return JSON.parse(rawText) as unknown;
  } catch {
    return undefined;
  }
}

function toBusinessRequestError(payload: unknown): BusinessRequestError | undefined {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const status = Reflect.get(payload, 'status');
  const message = Reflect.get(payload, 'message');
  if (typeof status !== 'number' || status < 400 || typeof message !== 'string' || !message.trim()) {
    return undefined;
  }

  return new BusinessRequestError(
    `Educoder business request failed: ${status} ${message}`,
    status,
    message,
    payload,
  );
}

function resolveTraceLocation(url: string): { host?: string; path: string } {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.host,
      path: parsed.pathname,
    };
  } catch {
    return {
      host: undefined,
      path: url,
    };
  }
}
