import { readdir } from 'node:fs/promises';
import path from 'node:path';

export interface HealthIssue {
  code: 'missing_compiler' | 'invalid_session' | 'missing_hidden_tests';
  message: string;
  severity: 'error' | 'warning';
}

export interface RunHealthCheckInput {
  compilerAvailable: boolean;
  sessionValid: boolean;
  taskRoot?: string;
}

export async function runHealthCheck(input: RunHealthCheckInput): Promise<HealthIssue[]> {
  const issues: HealthIssue[] = [];

  if (!input.compilerAvailable) {
    issues.push({
      code: 'missing_compiler',
      message: '未检测到本地 g++ 编译器。',
      severity: 'error',
    });
  }

  if (!input.sessionValid) {
    issues.push({
      code: 'invalid_session',
      message: 'Educoder 登录态无效，请重新登录。',
      severity: 'error',
    });
  }

  if (input.taskRoot && !(await hasHiddenTests(input.taskRoot))) {
    issues.push({
      code: 'missing_hidden_tests',
      message: '任务目录缺少 hidden tests，无法执行本地评测。',
      severity: 'warning',
    });
  }

  return issues;
}

async function hasHiddenTests(taskRoot: string): Promise<boolean> {
  try {
    const hiddenTestsDir = path.join(taskRoot, '_educoder', 'tests', 'hidden');
    const entries = await readdir(hiddenTestsDir, { withFileTypes: true });
    return entries.some((entry) => entry.isFile() && entry.name.endsWith('_input.txt'));
  } catch {
    return false;
  }
}
