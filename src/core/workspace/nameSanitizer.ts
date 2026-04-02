const WINDOWS_ILLEGAL_CHAR_MAP: Record<string, string> = {
  '<': '＜',
  '>': '＞',
  ':': '：',
  '"': '＂',
  '/': '／',
  '\\': '＼',
  '|': '｜',
  '?': '？',
  '*': '＊',
};

export function sanitizePathSegment(input: string | undefined, fallback = '未命名'): string {
  const normalized = (input ?? '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[<>:"/\\|?*]/g, (char) => WINDOWS_ILLEGAL_CHAR_MAP[char] ?? ' ');

  const sanitized = normalized.replace(/[. ]+$/g, '').trim();
  return sanitized || fallback;
}

export function formatStableFolderName(
  name: string | undefined,
  id: string,
  options: {
    index?: number;
    fallbackName?: string;
  } = {},
): string {
  const prefix = options.index == null ? '' : `${String(options.index).padStart(2, '0')} `;
  const label = sanitizePathSegment(name, options.fallbackName ?? '未命名');
  return `${prefix}${label} [${id}]`;
}
