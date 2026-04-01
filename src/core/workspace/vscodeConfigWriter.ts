import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function writeTaskDebugConfig(taskRoot: string): Promise<void> {
  const vscodeDir = path.join(taskRoot, '.vscode');
  const workspaceDir = path.join(taskRoot, 'workspace');

  await mkdir(vscodeDir, { recursive: true });

  await Promise.all([
    writeFile(
      path.join(vscodeDir, 'tasks.json'),
      JSON.stringify(
        {
          version: '2.0.0',
          tasks: [
            {
              label: 'Educoder: Build Workspace',
              type: 'shell',
              command: 'g++',
              args: ['-g', '${file}', '-o', path.join(workspaceDir, 'app.exe')],
              options: {
                cwd: workspaceDir,
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
              name: 'Educoder: Debug Workspace',
              type: 'cppdbg',
              request: 'launch',
              program: path.join(workspaceDir, 'app.exe'),
              cwd: workspaceDir,
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
