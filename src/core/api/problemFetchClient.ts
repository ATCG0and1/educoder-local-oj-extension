export interface ProblemSample {
  name: string;
  input: string;
  output: string;
}

export interface ProblemMaterial {
  title: string;
  statementMarkdown?: string;
  statementHtml?: string;
  samples: ProblemSample[];
  limits?: Record<string, string | number>;
  raw: unknown;
  pageSnapshotHtml?: string;
  pageSnapshotUrl?: string;
}

export interface FetchProblemMaterialInput {
  taskId: string;
  homeworkId?: string;
  taskName?: string;
}

export interface ProblemPageSnapshot {
  url: string;
  html: string;
  contentType?: string;
}

export interface ProblemPageFetcherLike {
  fetchTaskPageHtml(input: FetchProblemMaterialInput): Promise<ProblemPageSnapshot>;
}

export interface ProblemFetchClientLike {
  fetchProblemMaterial(input: FetchProblemMaterialInput): Promise<ProblemMaterial>;
}

export class ProblemFetchClient implements ProblemFetchClientLike {
  constructor(private readonly deps: ProblemPageFetcherLike) {}

  async fetchProblemMaterial(input: FetchProblemMaterialInput): Promise<ProblemMaterial> {
    const snapshot = await this.deps.fetchTaskPageHtml(input);
    return extractProblemMaterialFromHtml(snapshot.html, {
      fallbackTitle: input.taskName ?? input.taskId,
      snapshot,
    });
  }
}

export function extractProblemMaterialFromHtml(
  html: string,
  options: {
    fallbackTitle: string;
    snapshot?: ProblemPageSnapshot;
  },
): ProblemMaterial {
  const title =
    findFirstMatch(html, [
      /<[^>]+data-problem-title[^>]*>([\s\S]*?)<\/[^>]+>/i,
      /<h1[^>]*>([\s\S]*?)<\/h1>/i,
      /<title[^>]*>([\s\S]*?)<\/title>/i,
    ]) ?? options.fallbackTitle;
  const statementHtml = normalizeOptionalHtml(
    findFirstMatch(html, [
      /<section[^>]+data-problem-statement[^>]*>([\s\S]*?)<\/section>/i,
      /<div[^>]+data-problem-statement[^>]*>([\s\S]*?)<\/div>/i,
    ]),
  );
  const statementMarkdown = normalizeOptionalText(
    findFirstMatch(html, [
      /<textarea[^>]+data-problem-markdown[^>]*>([\s\S]*?)<\/textarea>/i,
    ]),
  );

  return normalizeProblemMaterialLinks({
    title: decodeHtmlEntities(title).trim() || options.fallbackTitle,
    statementMarkdown,
    statementHtml,
    samples: extractSamplesFromHtml(html),
    raw: {
      source: 'task-page-snapshot',
      url: options.snapshot?.url,
      contentType: options.snapshot?.contentType,
    },
    pageSnapshotHtml: options.snapshot?.html,
    pageSnapshotUrl: options.snapshot?.url,
  });
}

export function normalizeProblemMaterialLinks(material: ProblemMaterial): ProblemMaterial {
  if (!material.pageSnapshotUrl) {
    return material;
  }

  return {
    ...material,
    statementMarkdown: material.statementMarkdown
      ? normalizeMarkdownAssetUrls(material.statementMarkdown, material.pageSnapshotUrl)
      : material.statementMarkdown,
    statementHtml: material.statementHtml
      ? normalizeHtmlAssetUrls(material.statementHtml, material.pageSnapshotUrl)
      : material.statementHtml,
  };
}

function extractSamplesFromHtml(html: string): ProblemSample[] {
  const results: ProblemSample[] = [];
  const pattern = /<div[^>]+data-sample-index=["']?(\d+)["']?[^>]*>([\s\S]*?)<\/div>/gi;

  for (const match of html.matchAll(pattern)) {
    const [, indexText, block] = match;
    const input = normalizeOptionalText(
      findFirstMatch(block, [/<pre[^>]+data-sample-input[^>]*>([\s\S]*?)<\/pre>/i]),
    );
    const output = normalizeOptionalText(
      findFirstMatch(block, [/<pre[^>]+data-sample-output[^>]*>([\s\S]*?)<\/pre>/i]),
    );

    if (!input || !output) {
      continue;
    }

    results.push({
      name: `样例 ${Number(indexText) || results.length + 1}`,
      input,
      output,
    });
  }

  return results;
}

function findFirstMatch(html: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match?.[1]) {
      return match[1];
    }
  }

  return undefined;
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = decodeHtmlEntities(value)
    .replace(/\r\n/g, '\n')
    .replace(/^\s+|\s+$/g, '');

  return normalized ? `${normalized}\n` : undefined;
}

function normalizeOptionalHtml(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeMarkdownAssetUrls(markdown: string, baseUrl: string): string {
  const normalizedMarkdownLinks = markdown.replace(
    /(!?\[[^\]]*]\()([^) \t\r\n]+)(\))/g,
    (_match, prefix: string, target: string, suffix: string) =>
      `${prefix}${resolveProblemAssetUrl(target, baseUrl)}${suffix}`,
  );

  return normalizeHtmlAssetUrls(normalizedMarkdownLinks, baseUrl);
}

function normalizeHtmlAssetUrls(html: string, baseUrl: string): string {
  return html.replace(
    /\b(src|href)\s*=\s*(['"])([^'"<>]+)\2/gi,
    (_match, attribute: string, quote: string, target: string) =>
      `${attribute}=${quote}${resolveProblemAssetUrl(target, baseUrl)}${quote}`,
  );
}

function resolveProblemAssetUrl(target: string, baseUrl: string): string {
  const trimmedTarget = target.trim();
  if (!trimmedTarget || trimmedTarget.startsWith('#') || hasExplicitScheme(trimmedTarget)) {
    return target;
  }

  try {
    return new URL(trimmedTarget, baseUrl).toString();
  } catch {
    return target;
  }
}

function hasExplicitScheme(target: string): boolean {
  return /^[A-Za-z][A-Za-z\d+.-]*:/.test(target);
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
