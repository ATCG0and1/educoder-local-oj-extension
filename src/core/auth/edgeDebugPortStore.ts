export const EDGE_DEBUG_PORT_STATE_KEY = 'educoderEdgeDebugPort';

export interface GlobalStateLike {
  get<T>(key: string): T | undefined;
  update(key: string, value: unknown): PromiseLike<void> | void;
}

export interface EdgeDebugPortContextLike {
  globalState: GlobalStateLike;
}

export function getEdgeDebugPort(context: EdgeDebugPortContextLike): number | undefined {
  const raw = context.globalState.get<unknown>(EDGE_DEBUG_PORT_STATE_KEY);
  if (typeof raw !== 'number') {
    return undefined;
  }

  if (!Number.isInteger(raw) || raw <= 0) {
    return undefined;
  }

  return raw;
}

export async function setEdgeDebugPort(
  context: EdgeDebugPortContextLike,
  port: number,
): Promise<void> {
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('Invalid Edge debug port');
  }

  await context.globalState.update(EDGE_DEBUG_PORT_STATE_KEY, port);
}

export async function clearEdgeDebugPort(context: EdgeDebugPortContextLike): Promise<void> {
  await context.globalState.update(EDGE_DEBUG_PORT_STATE_KEY, undefined);
}
