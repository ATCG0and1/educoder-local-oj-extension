import type { TransportTraceEvent } from '../api/fetchTransport.js';

export interface ApiEndpointSummary {
  method: string;
  host?: string;
  path: string;
  calls: number;
  lastStatus: number;
  lastOk: boolean;
  lastDurationMs: number;
  sampleUrl: string;
  businessStatuses: number[];
}

export interface ApiInventory {
  record(event: TransportTraceEvent): void;
  list(): ApiEndpointSummary[];
  events(): TransportTraceEvent[];
}

export function createApiInventory(): ApiInventory {
  const orderedEvents: Array<TransportTraceEvent & { path: string }> = [];
  const summaryMap = new Map<string, ApiEndpointSummary>();

  return {
    record(event: TransportTraceEvent): void {
      const normalizedEvent = normalizeTraceEvent(event);
      orderedEvents.push(normalizedEvent);

      const key = `${normalizedEvent.method}\u0000${normalizedEvent.host ?? ''}\u0000${normalizedEvent.path}`;
      const existing = summaryMap.get(key);
      if (!existing) {
        summaryMap.set(key, {
          method: normalizedEvent.method,
          host: normalizedEvent.host,
          path: normalizedEvent.path,
          calls: 1,
          lastStatus: normalizedEvent.status,
          lastOk: normalizedEvent.ok,
          lastDurationMs: normalizedEvent.durationMs,
          sampleUrl: normalizedEvent.url,
          businessStatuses:
            normalizedEvent.businessStatus === undefined ? [] : [normalizedEvent.businessStatus],
        });
        return;
      }

      existing.calls += 1;
      existing.lastStatus = normalizedEvent.status;
      existing.lastOk = normalizedEvent.ok;
      existing.lastDurationMs = normalizedEvent.durationMs;
      existing.sampleUrl = normalizedEvent.url;
      if (
        normalizedEvent.businessStatus !== undefined &&
        !existing.businessStatuses.includes(normalizedEvent.businessStatus)
      ) {
        existing.businessStatuses.push(normalizedEvent.businessStatus);
        existing.businessStatuses.sort((left, right) => left - right);
      }
    },

    list(): ApiEndpointSummary[] {
      return [...summaryMap.values()].sort((left, right) =>
        `${left.host ?? ''}\u0000${left.path}\u0000${left.method}`.localeCompare(
          `${right.host ?? ''}\u0000${right.path}\u0000${right.method}`,
        ),
      );
    },

    events(): TransportTraceEvent[] {
      return orderedEvents.map((event) => ({ ...event }));
    },
  };
}

function normalizeTraceEvent(event: TransportTraceEvent): TransportTraceEvent & { path: string } {
  if (event.path) {
    return {
      ...event,
      path: event.path,
    };
  }

  try {
    const parsed = new URL(event.url);
    return {
      ...event,
      host: event.host ?? parsed.host,
      path: event.path ?? parsed.pathname,
    };
  } catch {
    return {
      ...event,
      host: event.host,
      path: event.path ?? event.url,
    };
  }
}
