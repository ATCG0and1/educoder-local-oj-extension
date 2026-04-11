const DIAGNOSTIC_LINE_PATTERN =
  /^(?<path>.+?):(?<line>\d+):(?<column>\d+): (?<level>fatal error|error|warning|note): (?<message>.+)$/;

export function extractFirstCompileDiagnosticBlock(stderr: string): string | undefined {
  const lines = stderr.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const startIndex = lines.findIndex((line) => isPrimaryErrorDiagnostic(line));
  if (startIndex < 0) {
    return undefined;
  }

  const collected: string[] = [lines[startIndex]!];

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? '';

    if (line.trim().length === 0) {
      break;
    }

    if (isPrimaryErrorDiagnostic(line) || isWarningDiagnostic(line)) {
      break;
    }

    if (isNoteDiagnostic(line)) {
      collected.push(line);
      continue;
    }

    if (isContextWrapperLine(line)) {
      break;
    }

    collected.push(line);
  }

  const normalized = collected.join('\n').trimEnd();
  return normalized.length > 0 ? normalized : undefined;
}

function isPrimaryErrorDiagnostic(line: string): boolean {
  const match = DIAGNOSTIC_LINE_PATTERN.exec(line);
  return match?.groups?.level === 'error' || match?.groups?.level === 'fatal error';
}

function isWarningDiagnostic(line: string): boolean {
  return DIAGNOSTIC_LINE_PATTERN.exec(line)?.groups?.level === 'warning';
}

function isNoteDiagnostic(line: string): boolean {
  return DIAGNOSTIC_LINE_PATTERN.exec(line)?.groups?.level === 'note';
}

function isContextWrapperLine(line: string): boolean {
  const trimmed = line.trim();
  return (
    trimmed.startsWith('In file included from ') ||
    trimmed.startsWith('In function ') ||
    trimmed.startsWith('In member function ') ||
    trimmed.startsWith('At global scope:')
  );
}
