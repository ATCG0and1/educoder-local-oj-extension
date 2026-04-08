import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const EDUCORDER_EXCLUDED_PATHS: Record<string, boolean> = {
  _educoder: true,
  '.vscode': true,
  'code/template': true,
  'code/passed': true,
  '**/_educoder': true,
  '**/.vscode': true,
  '**/tests/hidden': true,
  '**/code/template': true,
  '**/code/passed': true,
  '**/*.manifest.json': true,
  '**/metadata.json': true,
  '**/recovery.json': true,
  '**/judge/*.json': true,
  '**/judge/**/*.json': true,
  '**/sync.json': true,
};

export async function writeTaskDebugConfig(taskRoot: string): Promise<void> {
  const vscodeDir = path.join(taskRoot, '.vscode');
  const currentCodeDir = path.join(taskRoot, 'code', 'current');

  await mkdir(vscodeDir, { recursive: true });

  await Promise.all([
    writeExplorerVisibilityConfig(taskRoot),
    writeFile(
      path.join(vscodeDir, 'tasks.json'),
      JSON.stringify(
        {
          version: '2.0.0',
          tasks: [
            {
              label: 'Educoder: Build Code',
              type: 'shell',
              command: 'g++',
              args: ['-g', '${file}', '-o', path.join(currentCodeDir, 'app.exe')],
              options: {
                cwd: currentCodeDir,
              },
              problemMatcher: ['$gcc'],
            },
          ],
        },
        null,
        2,
      ),
      'utf8',
    ),
    writeFile(
      path.join(vscodeDir, 'launch.json'),
      JSON.stringify(
        {
          version: '0.2.0',
          configurations: [
            {
              name: 'Educoder: Debug Code',
              type: 'cppdbg',
              request: 'launch',
              program: path.join(currentCodeDir, 'app.exe'),
              cwd: currentCodeDir,
              args: [],
              stopAtEntry: false,
              MIMode: 'gdb',
            },
          ],
        },
        null,
        2,
      ),
      'utf8',
    ),
  ]);
}

export async function writeExplorerVisibilityConfig(rootDir: string): Promise<void> {
  const vscodeDir = path.join(rootDir, '.vscode');
  const settingsPath = path.join(vscodeDir, 'settings.json');

  await mkdir(vscodeDir, { recursive: true });

  const existingSettings = await readSettingsJson(settingsPath);
  const existingFilesExclude = isRecord(existingSettings['files.exclude'])
    ? existingSettings['files.exclude']
    : {};
  const nextSettings = {
    ...existingSettings,
    'files.exclude': {
      ...existingFilesExclude,
      ...EDUCORDER_EXCLUDED_PATHS,
    },
  };

  await writeFile(settingsPath, JSON.stringify(nextSettings, null, 2), 'utf8');
}

async function readSettingsJson(settingsPath: string): Promise<Record<string, unknown>> {
  try {
    const parsed = JSON.parse(await readFile(settingsPath, 'utf8')) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
