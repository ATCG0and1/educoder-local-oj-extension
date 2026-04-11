export function normalizeAnswerMarkdownForPreview(content: string): string {
  const normalized = normalizeLineEndings(content).replace(/\s+$/g, '');
  if (!normalized) {
    return '';
  }

  if (looksLikeStructuredMarkdown(normalized)) {
    return ensureTrailingNewline(normalized);
  }

  if (looksLikeCodeAnswer(normalized)) {
    return `\`\`\`cpp\n${normalized}\n\`\`\`\n`;
  }

  return ensureTrailingNewline(normalized);
}

export function normalizeStatementMarkdownForPreview(content: string): string {
  const normalized = normalizeLineEndings(content).replace(/\s+$/g, '');
  if (!normalized) {
    return '';
  }

  const lines = normalized.split('\n');
  const output: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    output.push(line);

    if (!isStatementBlockLabel(line)) {
      continue;
    }

    const nextLine = lines[index + 1];
    if (nextLine?.trim() === '```text' || nextLine?.trim() === '```') {
      continue;
    }

    const blockLines: string[] = [];
    let cursor = index + 1;
    while (cursor < lines.length) {
      const current = lines[cursor] ?? '';
      if (!current.trim()) {
        break;
      }
      if (isStatementBlockBoundary(current)) {
        break;
      }
      blockLines.push(current);
      cursor += 1;
    }

    if (blockLines.length === 0) {
      continue;
    }

    output.push('```text');
    output.push(...blockLines);
    output.push('```');
    index = cursor - 1;
  }

  return output.join('\n');
}

function looksLikeStructuredMarkdown(content: string): boolean {
  return (
    /^#{1,6}\s/m.test(content) ||
    /```/.test(content) ||
    /^\s*[-*+]\s/m.test(content) ||
    /^\s*\d+\.\s/m.test(content) ||
    /^\s*>/m.test(content) ||
    /\[[^\]]+]\([^)]+\)/.test(content) ||
    /<img\b|<table\b|<div\b|<section\b/i.test(content)
  );
}

function looksLikeCodeAnswer(content: string): boolean {
  const lineCount = content.split('\n').length;
  if (lineCount === 1 && !/[;{}]/.test(content)) {
    return false;
  }

  return (
    /#include\b|template\s*<|class\s+\w+|void\s+\w+\s*\(|int\s+\w+\s*\(|return\b|std::|vector\s*</.test(content) ||
    /代码开始|代码结束/.test(content) ||
    /[{};]/.test(content)
  );
}

function isStatementBlockLabel(line: string): boolean {
  const trimmed = line.trim();
  return /^(【样例输入】|【样例输出】|测试输入：|预期输出：)$/.test(trimmed);
}

function isStatementBlockBoundary(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith('#') || isStatementBlockLabel(trimmed);
}

function normalizeLineEndings(content: string): string {
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function ensureTrailingNewline(content: string): string {
  return content.endsWith('\n') ? content : `${content}\n`;
}
