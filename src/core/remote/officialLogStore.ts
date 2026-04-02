import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type OfficialJudgeVerdict = 'passed' | 'failed';

export interface OfficialJudgeSummary {
  verdict: OfficialJudgeVerdict;
  score: number;
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
  const reportsDir = path.join(input.taskRoot, 'reports');
  const remoteLogDir = path.join(input.taskRoot, '_educoder', 'logs', 'remote');
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
  try {
    return JSON.parse(
      await readFile(path.join(taskRoot, 'reports', 'latest_remote.json'), 'utf8'),
    ) as OfficialJudgeReport;
  } catch {
    return undefined;
  }
}
