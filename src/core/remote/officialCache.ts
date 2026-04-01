import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { OfficialJudgeSummary } from './officialLogStore.js';

export interface CachedOfficialJudgeEntry {
  codeHash: string;
  summary: OfficialJudgeSummary;
  cachedAt: string;
}

interface OfficialJudgeCacheIndex {
  entries: Record<string, CachedOfficialJudgeEntry>;
}

export async function computeWorkspaceCodeHash(taskRoot: string): Promise<string> {
  const workspaceDir = path.join(taskRoot, 'workspace');
  const filePaths = await collectFilePaths(workspaceDir, workspaceDir);
  const hash = createHash('sha256');

  for (const relativePath of filePaths) {
    const absolutePath = path.join(workspaceDir, relativePath);
    const content = await readFile(absolutePath);
    hash.update(relativePath);
    hash.update('\0');
    hash.update(content);
    hash.update('\0');
  }

  return hash.digest('hex');
}

export async function readOfficialJudgeCache(
  taskRoot: string,
  codeHash: string,
): Promise<CachedOfficialJudgeEntry | undefined> {
  const index = await readOfficialJudgeCacheIndex(taskRoot);
  return index.entries[codeHash];
}

export async function writeOfficialJudgeCache(
  taskRoot: string,
  entry: CachedOfficialJudgeEntry,
): Promise<void> {
  const cacheDir = path.join(taskRoot, '_educoder', 'cache');
  const indexPath = path.join(cacheDir, 'official_hash_index.json');
  const index = await readOfficialJudgeCacheIndex(taskRoot);

  index.entries[entry.codeHash] = entry;

  await mkdir(cacheDir, { recursive: true });
  await writeFile(indexPath, JSON.stringify(index, null, 2), 'utf8');
}

async function readOfficialJudgeCacheIndex(taskRoot: string): Promise<OfficialJudgeCacheIndex> {
  const indexPath = path.join(taskRoot, '_educoder', 'cache', 'official_hash_index.json');

  try {
    return JSON.parse(await readFile(indexPath, 'utf8')) as OfficialJudgeCacheIndex;
  } catch {
    return { entries: {} };
  }
}

async function collectFilePaths(rootDir: string, currentDir: string): Promise<string[]> {
  try {
    const entries = await readdir(currentDir, { withFileTypes: true });
    const nested = await Promise.all(
      entries.map(async (entry) => {
        const absolutePath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          return collectFilePaths(rootDir, absolutePath);
        }

        return [path.relative(rootDir, absolutePath).replaceAll('\\', '/')];
      }),
    );

    return nested.flat().sort((left, right) => left.localeCompare(right));
  } catch {
    return [];
  }
}
