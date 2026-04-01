import { computeWorkspaceCodeHash, readOfficialJudgeCache, writeOfficialJudgeCache } from './officialCache.js';
import {
  writeOfficialJudgeArtifacts,
  type OfficialJudgeReport,
  type OfficialJudgeVerdict,
} from './officialLogStore.js';

export interface RemoteOfficialJudgeResult {
  verdict: OfficialJudgeVerdict;
  score: number;
  message?: string;
  raw: unknown;
}

export interface ExecuteRemoteJudgeInput {
  taskRoot: string;
  codeHash: string;
}

export interface RunOfficialJudgeBridgeInput {
  taskRoot: string;
  force?: boolean;
  executeRemoteJudge: (
    input: ExecuteRemoteJudgeInput,
  ) => Promise<RemoteOfficialJudgeResult>;
}

export async function runOfficialJudgeBridge(
  input: RunOfficialJudgeBridgeInput,
): Promise<OfficialJudgeReport> {
  const codeHash = await computeWorkspaceCodeHash(input.taskRoot);

  if (!input.force) {
    const cached = await readOfficialJudgeCache(input.taskRoot, codeHash);
    if (cached) {
      return {
        source: 'cache',
        codeHash: cached.codeHash,
        summary: cached.summary,
        cachedAt: cached.cachedAt,
      };
    }
  }

  const remoteResult = await input.executeRemoteJudge({
    taskRoot: input.taskRoot,
    codeHash,
  });

  const report = await writeOfficialJudgeArtifacts({
    taskRoot: input.taskRoot,
    codeHash,
    summary: {
      verdict: remoteResult.verdict,
      score: remoteResult.score,
      message: remoteResult.message,
    },
    raw: remoteResult.raw,
  });

  await writeOfficialJudgeCache(input.taskRoot, {
    codeHash,
    summary: report.summary,
    cachedAt: new Date().toISOString(),
  });

  return report;
}
