const REDACTED = '<redacted>';

export function redactSensitiveText(text: string): string {
  return (
    text
      // Cookie key-value pairs
      .replace(/(_educoder_session=)[^;\s,]+/g, `$1${REDACTED}`)
      .replace(/(autologin_trustie=)[^;\s,]+/g, `$1${REDACTED}`)
      // Header-like patterns
      .replace(/\b(Pc-Authorization\s*:\s*)([^\s;]+)/gi, `$1${REDACTED}`)
      .replace(/\b(Cookie\s*:\s*)([^\n\r]*)/gi, (_m, prefix, rest) => {
        // Redact values inside the cookie header while keeping cookie names visible.
        return `${prefix}${String(rest)}`
          .replace(/(_educoder_session=)[^;\s,]+/g, `$1${REDACTED}`)
          .replace(/(autologin_trustie=)[^;\s,]+/g, `$1${REDACTED}`);
      })
      // JSON payloads
      .replace(/("_educoder_session"\s*:\s*")[^"]*(")/g, `$1${REDACTED}$2`)
      .replace(/("autologin_trustie"\s*:\s*")[^"]*(")/g, `$1${REDACTED}$2`)
  );
}

export function formatErrorChain(
  error: unknown,
  options: {
    maxDepth?: number;
  } = {},
): string {
  const maxDepth = options.maxDepth ?? 6;
  const lines: string[] = [];

  let current: unknown = error;
  for (let depth = 0; depth < maxDepth; depth++) {
    const prefix = depth === 0 ? 'Error' : 'Caused by';

    if (current instanceof Error) {
      lines.push(`${prefix}: ${current.name}: ${current.message}`);
      const cause = (current as { cause?: unknown }).cause;
      if (cause === undefined) {
        break;
      }
      current = cause;
      continue;
    }

    if (current === undefined) {
      break;
    }

    lines.push(`${prefix}: ${String(current)}`);
    break;
  }

  return redactSensitiveText(lines.join('\n'));
}
