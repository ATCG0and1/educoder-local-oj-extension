import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { planCaseRun } from './caseScheduler.js';
import { compileWorkspace, type CompileWorkspaceResult } from './compiler.js';
import { renderSmartDiff } from './diffRenderer.js';
import {
  writeLocalJudgeReport,
  type CompileResultSummary,
  type LocalJudgeCaseResult,
  type LocalJudgeReport,
} from './resultStore.js';
import { classifyCaseVerdict } from './verdict.js';

export interface ExecuteBinaryInput {
  executablePath: string;
  input: string;
  caseId: string;
  taskRoot: string;
}

export interface ExecuteBinaryResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
}

export interface RunLocalJudgeInput {
  taskRoot: string;
  rerunFailedOnly?: boolean;
  lastReport?: LocalJudgeReport;
  compileWorkspace?: (input: { workspaceDir: string }) => Promise<CompileWorkspaceResult>;
  executeBinary?: (input: ExecuteBinaryInput) => Promise<ExecuteBinaryResult>;
}

interface HiddenCaseFile {
  caseId: string;
  inputPath: string;
  outputPath: string;
}

export async function runLocalJudge(input: RunLocalJudgeInput): Promise<LocalJudgeReport> {
  const workspaceDir = path.join(input.taskRoot, 'workspace');
  const hiddenTestsDir = path.join(input.taskRoot, '_educoder', 'tests', 'hidden');
  const hiddenCaseFiles = await discoverHiddenCases(hiddenTestsDir);
  const schedule = planCaseRun({
    allCaseIds: hiddenCaseFiles.map((item) => item.caseId),
    rerunFailedOnly: input.rerunFailedOnly,
    lastReport: input.lastReport,
  });

  const compileWorkspaceFn = input.compileWorkspace ?? compileWorkspace;
  const executeBinaryFn = input.executeBinary ?? executeBinary;
  const compilation = await compileWorkspaceFn({ workspaceDir });
  const compileSummary = toCompileSummary(compilation);

  if (!compilation.success || !compilation.executablePath) {
    const report: LocalJudgeReport = {
      runMode: schedule.runMode,
      reason: schedule.reason,
      compile: compileSummary,
      caseResults: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
      },
    };

    await writeLocalJudgeReport(input.taskRoot, report);
    return report;
  }

  const hiddenCaseMap = new Map(hiddenCaseFiles.map((item) => [item.caseId, item] as const));
  const caseResults: LocalJudgeCaseResult[] = [];

  for (const caseId of schedule.caseIds) {
    const hiddenCase = hiddenCaseMap.get(caseId);

    if (!hiddenCase) {
      continue;
    }

    const [expected, caseInput] = await Promise.all([
      readFile(hiddenCase.outputPath, 'utf8'),
      readFile(hiddenCase.inputPath, 'utf8'),
    ]);

    const execution = await executeBinaryFn({
      executablePath: compilation.executablePath,
      input: caseInput,
      caseId,
      taskRoot: input.taskRoot,
    });

    const verdict = classifyCaseVerdict({
      exitCode: execution.exitCode,
      expected,
      actual: execution.stdout,
      timedOut: execution.timedOut,
    });

    caseResults.push({
      caseId,
      verdict,
      expected,
      actual: execution.stdout,
      stdout: execution.stdout,
      stderr: execution.stderr,
      exitCode: execution.exitCode,
      timedOut: execution.timedOut,
      diffHunks:
        verdict === 'failed'
          ? renderSmartDiff({
              expected,
              actual: execution.stdout,
            })
          : [],
    });
  }

  const report: LocalJudgeReport = {
    runMode: schedule.runMode,
    reason: schedule.reason,
    compile: compileSummary,
    caseResults,
    summary: {
      total: caseResults.length,
      passed: caseResults.filter((item) => item.verdict === 'passed').length,
      failed: caseResults.filter((item) => item.verdict !== 'passed').length,
    },
  };

  await writeLocalJudgeReport(input.taskRoot, report);
  return report;
}

function toCompileSummary(compilation: CompileWorkspaceResult): CompileResultSummary {
  return {
    verdict: compilation.success ? 'compiled' : 'compile_error',
    stdout: compilation.stdout,
    stderr: compilation.stderr,
    executablePath: compilation.executablePath,
  };
}

async function discoverHiddenCases(hiddenTestsDir: string): Promise<HiddenCaseFile[]> {
  try {
    const entries = await readdir(hiddenTestsDir, { withFileTypes: true });
    const hiddenCases = entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name.match(/^(case_\d+)_input\.txt$/))
      .filter((match): match is RegExpMatchArray => match !== null)
      .map((match) => ({
        caseId: match[1],
        inputPath: path.join(hiddenTestsDir, `${match[1]}_input.txt`),
        outputPath: path.join(hiddenTestsDir, `${match[1]}_output.txt`),
      }));

    return hiddenCases.sort((left, right) => left.caseId.localeCompare(right.caseId));
  } catch {
    return [];
  }
}

function executeBinary(input: ExecuteBinaryInput): Promise<ExecuteBinaryResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(input.executablePath, [], {
      cwd: path.dirname(input.executablePath),
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (exitCode) => {
      resolve({
        stdout,
        stderr,
        exitCode: exitCode ?? -1,
        timedOut: false,
      });
    });

    child.stdin.end(input.input);
  });
}
