import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type OfficialJudgeVerdict = 'passed' | 'failed';

export interface OfficialJudgeSummary {
  verdict: OfficialJudgeVerdict;
  score: number;
  passedCount?: number;
  totalCount?: number;
  message?: string;
  rawLogPath: string;
}

export interface OfficialJudgeReport {
  source: 'remote' | 'cache';
  codeHash: string;
  summary: OfficialJudgeSummary;
  cachedAt?: string;
  generatedAt?: string;
}

export interface PersistOfficialJudgeInput {
  taskRoot: string;
  codeHash: string;
  summary: Omit<OfficialJudgeSummary, 'rawLogPath'>;
  raw: unknown;
}

export async function writeOfficialJudgeArtifacts(
  input: PersistOfficialJudgeInput,
): Promise<OfficialJudgeReport> {
  const reportsDir = path.join(input.taskRoot, '_educoder', 'judge');
  const remoteLogDir = path.join(reportsDir, 'remote_runs');
  const timestamp = new Date().toISOString().replaceAll(':', '-');
  const rawLogPath = path.join(remoteLogDir, `${timestamp}.json`);

  await Promise.all([
    mkdir(reportsDir, { recursive: true }),
    mkdir(remoteLogDir, { recursive: true }),
  ]);

  await writeFile(rawLogPath, JSON.stringify(input.raw, null, 2), 'utf8');

  const report: OfficialJudgeReport = {
    source: 'remote',
    codeHash: input.codeHash,
    generatedAt: new Date().toISOString(),
    summary: {
      ...input.summary,
      rawLogPath,
    },
  };

  await writeFile(path.join(reportsDir, 'latest_remote.json'), JSON.stringify(report, null, 2), 'utf8');

  return report;
}

export async function readLatestOfficialJudgeReport(
  taskRoot: string,
): Promise<OfficialJudgeReport | undefined> {
  const candidatePaths = [
    path.join(taskRoot, '_educoder', 'judge', 'latest_remote.json'),
    path.join(taskRoot, 'reports', 'latest_remote.json'),
  ];

  try {
    for (const candidatePath of candidatePaths) {
      try {
        return JSON.parse(await readFile(candidatePath, 'utf8')) as OfficialJudgeReport;
      } catch {
        continue;
      }
    }
  } catch {
    // no-op: fall through to undefined
  }

  return undefined;
}
