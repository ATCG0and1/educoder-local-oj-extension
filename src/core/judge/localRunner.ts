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
import { resolveTaskPackagePaths } from '../workspace/taskPackageMigration.js';
import { normalizeSafeRelativeFilePath } from '../workspace/workspaceInit.js';

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
  compileWorkspace?: (input: {
    workspaceDir: string;
    preferredSourcePaths?: string[];
    compileScopes?: string[];
  }) => Promise<CompileWorkspaceResult>;
  executeBinary?: (input: ExecuteBinaryInput) => Promise<ExecuteBinaryResult>;
}

export const HIDDEN_TESTS_REQUIRED_ERROR_MESSAGE =
  '未找到本地测试，请先打开题目并完成同步后再运行本地评测。';

interface HiddenCaseFile {
  caseId: string;
  inputPath: string;
  outputPath: string;
  reportInputPath: string;
  reportOutputPath: string;
}

const KNOWN_ENV_MISSING_HELPER_PATTERNS = [
  /python:\s*can't open file\s+'[^']*myshixun[^']*check\.py'/i,
  /myshixun[^\r\n]*memory\.sh:\s*No such file or directory/i,
];

const KNOWN_CHECKER_TRAILING_LINES = new Set([
  '您的算法时间复杂度处于一般阶段',
  '您的算法时间复杂度处于优秀阶段',
  '没有额外使用辅助空间',
  '额外使用了辅助空间',
]);

const KNOWN_CHECKER_TRAILING_LINE_PATTERNS = [
  /^time=\d+\s*,\s*mem=\d+$/i,
];

export async function runLocalJudge(input: RunLocalJudgeInput): Promise<LocalJudgeReport> {
  const resolvedPaths = await resolveTaskPackagePaths(input.taskRoot);
  const workspaceDir = resolvedPaths.currentCodeDir;
  const workspacePath = normalizeReportPrefix(input.taskRoot, workspaceDir);
  const discoveredCases = await discoverLocalCases(input.taskRoot, resolvedPaths.hiddenTestsDir);
  if (!discoveredCases || discoveredCases.caseFiles.length === 0) {
    throw new Error(HIDDEN_TESTS_REQUIRED_ERROR_MESSAGE);
  }

  const schedule = planCaseRun({
    allCaseIds: discoveredCases.caseFiles.map((item) => item.caseId),
    rerunFailedOnly: input.rerunFailedOnly,
    lastReport: input.lastReport,
  });

  const compileWorkspaceFn = input.compileWorkspace ?? compileWorkspace;
  const executeBinaryFn = input.executeBinary ?? executeBinary;
  const compilePreferences = await readCompilePreferences(input.taskRoot);
  const compilation = await compileWorkspaceFn({
    workspaceDir,
    preferredSourcePaths: compilePreferences.preferredSourcePaths,
    compileScopes: compilePreferences.compileScopes,
  });
  const compileSummary = toCompileSummary(compilation);

  if (!compilation.success || !compilation.executablePath) {
    const report: LocalJudgeReport = {
      source: discoveredCases.source,
      workspacePath,
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

  const hiddenCaseMap = new Map(discoveredCases.caseFiles.map((item) => [item.caseId, item] as const));
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

    const normalizedActual = normalizeKnownEnvNoiseOutput({
      expected,
      actual: execution.stdout,
      stderr: execution.stderr,
    });

    const verdict = classifyCaseVerdict({
      exitCode: execution.exitCode,
      expected,
      actual: normalizedActual,
      timedOut: execution.timedOut,
    });

    caseResults.push({
      caseId,
      verdict,
      inputPath: hiddenCase.reportInputPath,
      outputPath: hiddenCase.reportOutputPath,
      expected,
      actual: normalizedActual,
      stdout: execution.stdout,
      stderr: execution.stderr,
      exitCode: execution.exitCode,
      timedOut: execution.timedOut,
      diffHunks:
        verdict === 'failed'
          ? renderSmartDiff({
              expected,
              actual: normalizedActual,
            })
          : [],
    });
  }

  const report: LocalJudgeReport = {
    source: discoveredCases.source,
    workspacePath,
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
    sourceFiles: compilation.sourceFiles,
  };
}

async function readCompilePreferences(taskRoot: string): Promise<{
  preferredSourcePaths?: string[];
  compileScopes?: string[];
}> {
  try {
    const raw = JSON.parse(
      await readFile(path.join(taskRoot, '_educoder', 'meta', 'task.json'), 'utf8'),
    ) as { editablePaths?: unknown };
    if (!Array.isArray(raw.editablePaths)) {
      return {};
    }

    const preferredSourcePaths = raw.editablePaths
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((item) => {
        try {
          return normalizeSafeRelativeFilePath(item);
        } catch {
          return undefined;
        }
      })
      .filter((item, index, items): item is string => item !== undefined && items.indexOf(item) === index);

    if (preferredSourcePaths.length === 0) {
      return {};
    }

    const compileScopes = preferredSourcePaths
      .map((relativePath) => path.posix.dirname(relativePath))
      .map((scope) => (scope === '.' ? '' : scope))
      .filter((scope, index, scopes) => scopes.indexOf(scope) === index);

    return {
      preferredSourcePaths,
      compileScopes,
    };
  } catch {
    return {};
  }
}

async function discoverLocalCases(
  taskRoot: string,
  fallbackHiddenTestsDir: string,
): Promise<{ source: 'tests/all' | 'tests/hidden-legacy'; caseFiles: HiddenCaseFile[] } | undefined> {
  const canonicalCases = await discoverCaseFiles(path.join(taskRoot, 'tests', 'all'), 'tests/all');
  if (canonicalCases.length > 0) {
    return {
      source: 'tests/all',
      caseFiles: canonicalCases,
    };
  }

  const hiddenCases = await discoverCaseFiles(
    fallbackHiddenTestsDir,
    normalizeReportPrefix(taskRoot, fallbackHiddenTestsDir),
  );
  if (hiddenCases.length > 0) {
    return {
      source: 'tests/hidden-legacy',
      caseFiles: hiddenCases,
    };
  }

  return undefined;
}

async function discoverCaseFiles(caseDir: string, reportPrefix: string): Promise<HiddenCaseFile[]> {
  try {
    const entries = await readdir(caseDir, { withFileTypes: true });
    const hiddenCases = entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name.match(/^(case_\d+)_input\.txt$/))
      .filter((match): match is RegExpMatchArray => match !== null)
      .map((match) => ({
        caseId: match[1],
        inputPath: path.join(caseDir, `${match[1]}_input.txt`),
        outputPath: path.join(caseDir, `${match[1]}_output.txt`),
        reportInputPath: `${reportPrefix}/${match[1]}_input.txt`,
        reportOutputPath: `${reportPrefix}/${match[1]}_output.txt`,
      }));

    return hiddenCases.sort((left, right) => left.caseId.localeCompare(right.caseId));
  } catch {
    return [];
  }
}

function normalizeReportPrefix(taskRoot: string, targetDir: string): string {
  const relative = path.relative(taskRoot, targetDir).replaceAll('\\', '/');
  return relative.length > 0 ? relative : 'tests/hidden-legacy';
}

function normalizeKnownEnvNoiseOutput(input: {
  expected: string;
  actual: string;
  stderr: string;
}): string {
  if (!KNOWN_ENV_MISSING_HELPER_PATTERNS.some((pattern) => pattern.test(input.stderr))) {
    return input.actual;
  }

  const expectedLines = normalizeJudgeLines(input.expected);
  const actualLines = normalizeJudgeLines(input.actual);

  if (actualLines.length < expectedLines.length) {
    return input.actual;
  }

  for (let index = 0; index < expectedLines.length; index += 1) {
    if (actualLines[index] !== expectedLines[index]) {
      return input.actual;
    }
  }

  const trailingLines = actualLines.slice(expectedLines.length);
  if (trailingLines.length === 0) {
    return input.actual;
  }

  const isKnownTrailingNoise = trailingLines.every((line) => {
    const normalized = line.trim();
    return (
      KNOWN_CHECKER_TRAILING_LINES.has(normalized) ||
      KNOWN_CHECKER_TRAILING_LINE_PATTERNS.some((pattern) => pattern.test(normalized))
    );
  });

  return isKnownTrailingNoise ? input.expected : input.actual;
}

function normalizeJudgeLines(value: string): string[] {
  const lines = value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''));

  while (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }

  return lines;
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
