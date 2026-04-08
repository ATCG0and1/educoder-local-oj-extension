export function resolveTaskRootFromTreeInput(input: unknown): string | undefined {
  if (typeof input === 'string' && input.trim().length > 0) {
    return input;
  }

  if (
    typeof input === 'object' &&
    input !== null &&
    'taskRoot' in input &&
    typeof (input as { taskRoot?: unknown }).taskRoot === 'string'
  ) {
    return (input as { taskRoot: string }).taskRoot;
  }

  if (
    typeof input === 'object' &&
    input !== null &&
    'kind' in input &&
    (input as { kind?: unknown }).kind === 'task' &&
    'data' in input &&
    typeof (input as { data?: unknown }).data === 'object' &&
    (input as { data?: unknown }).data !== null &&
    'taskRoot' in (input as { data: Record<string, unknown> }).data &&
    typeof (input as { data: { taskRoot?: unknown } }).data.taskRoot === 'string'
  ) {
    return (input as { data: { taskRoot: string } }).data.taskRoot;
  }

  return undefined;
}
