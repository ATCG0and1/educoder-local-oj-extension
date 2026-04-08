import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  openTaskPrimaryEditors,
  openCurrentCodeCommand,
  openTaskStatementCommand,
} from '../../src/commands/openTaskMaterials.js';
import {
  openLatestFailureInputCommand,
  openLatestFailureOutputCommand,
  openTaskAnswersCommand,
  openTaskTestsCommand,
} from '../../src/commands/openTaskPackageFiles.js';

const tempDirs: string[] = [];

async function createTempTaskRoot(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'educoder-open-materials-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('open task materials commands', () => {
  it('opens problem/statement.md in markdown preview when the task statement exists', async () => {
    const taskRoot = await createTempTaskRoot();
    const statementPath = path.join(taskRoot, 'problem', 'statement.md');
    await mkdir(path.dirname(statementPath), { recursive: true });
    await writeFile(statementPath, '# 题面\n', 'utf8');

    const openTextDocument = vi.fn(async (targetPath: string) => ({ targetPath }));
    const showTextDocument = vi.fn(async (document: { targetPath: string }) => document);
    const previewMarkdown = vi.fn(async (_targetPath: string) => undefined);

    const result = await openTaskStatementCommand(taskRoot, {
      openTextDocument,
      showTextDocument,
      previewMarkdown,
    });

    expect(result.openedPath).toBe(statementPath);
    expect(previewMarkdown).toHaveBeenCalledWith(statementPath);
    expect(openTextDocument).not.toHaveBeenCalled();
    expect(showTextDocument).not.toHaveBeenCalled();
    await expect(readFile(result.openedPath, 'utf8')).resolves.toContain('# 题面');
  });

  it('opens the first editable file from code/current using task metadata preference', async () => {
    const taskRoot = await createTempTaskRoot();
    const preferredFile = path.join(taskRoot, 'code', 'current', 'src', 'main.cpp');
    const otherFile = path.join(taskRoot, 'code', 'current', 'README.txt');
    const metaPath = path.join(taskRoot, '_educoder', 'meta', 'task.json');
    await Promise.all([
      mkdir(path.dirname(preferredFile), { recursive: true }),
      mkdir(path.dirname(metaPath), { recursive: true }),
    ]);
    await Promise.all([
      writeFile(preferredFile, 'int main() { return 0; }\n', 'utf8'),
      writeFile(otherFile, 'readme\n', 'utf8'),
      writeFile(
        metaPath,
        JSON.stringify({
          editablePaths: ['src/main.cpp'],
        }),
        'utf8',
      ),
    ]);

    const openTextDocument = vi.fn(async (targetPath: string) => ({ targetPath }));
    const showTextDocument = vi.fn(async (document: { targetPath: string }) => document);

    const result = await openCurrentCodeCommand(taskRoot, {
      openTextDocument,
      showTextDocument,
    });

    expect(result.openedPath).toBe(preferredFile);
    expect(openTextDocument).toHaveBeenCalledWith(preferredFile);
    expect(showTextDocument).toHaveBeenCalledWith(
      { targetPath: preferredFile },
      expect.objectContaining({ preview: false, preserveFocus: false }),
    );
  });

  it('opens statement preview first and then the preferred current code file for the editor-first flow', async () => {
    const taskRoot = await createTempTaskRoot();
    const statementPath = path.join(taskRoot, 'problem', 'statement.md');
    const currentCodePath = path.join(taskRoot, 'code', 'current', 'src', 'main.cpp');
    const metaPath = path.join(taskRoot, '_educoder', 'meta', 'task.json');
    await Promise.all([
      mkdir(path.dirname(statementPath), { recursive: true }),
      mkdir(path.dirname(currentCodePath), { recursive: true }),
      mkdir(path.dirname(metaPath), { recursive: true }),
    ]);
    await Promise.all([
      writeFile(statementPath, '# 题面\n', 'utf8'),
      writeFile(currentCodePath, 'int main() { return 0; }\n', 'utf8'),
      writeFile(metaPath, JSON.stringify({ editablePaths: ['src/main.cpp'] }), 'utf8'),
    ]);

    const openTextDocument = vi.fn(async (targetPath: string) => ({ targetPath }));
    const showTextDocument = vi.fn(async (document: { targetPath: string }) => document);
    const previewMarkdown = vi.fn(async (_targetPath: string) => undefined);

    const result = await openTaskPrimaryEditors(taskRoot, {
      openTextDocument,
      showTextDocument,
      previewMarkdown,
    });

    expect(result.statement?.openedPath).toBe(statementPath);
    expect(result.currentCode?.openedPath).toBe(currentCodePath);
    expect(previewMarkdown).toHaveBeenCalledWith(statementPath);
    expect(openTextDocument.mock.calls).toEqual([[currentCodePath]]);
    expect(showTextDocument.mock.calls).toEqual([
      [
        { targetPath: currentCodePath },
        expect.objectContaining({ preview: false, preserveFocus: false }),
      ],
    ]);
  });

  it('reveals tests/all directly instead of opening tests index documents', async () => {
    const taskRoot = await createTempTaskRoot();
    const testsIndexPath = path.join(taskRoot, 'tests', 'index.json');
    const testsAllDir = path.join(taskRoot, 'tests', 'all');
    await Promise.all([
      mkdir(path.dirname(testsIndexPath), { recursive: true }),
      mkdir(testsAllDir, { recursive: true }),
    ]);
    await Promise.all([
      writeFile(testsIndexPath, JSON.stringify({ total: 1 }, null, 2), 'utf8'),
      writeFile(path.join(testsAllDir, 'case_001_input.txt'), '1 2\n', 'utf8'),
      writeFile(path.join(testsAllDir, 'case_001_output.txt'), '3\n', 'utf8'),
    ]);

    const openTextDocument = vi.fn(async (targetPath: string) => ({ targetPath }));
    const showTextDocument = vi.fn(async (document: { targetPath: string }) => document);
    const revealInExplorer = vi.fn(async (_targetPath: string) => undefined);

    const indexResult = await openTaskTestsCommand(taskRoot, {
      openTextDocument,
      showTextDocument,
      revealInExplorer,
    });

    expect(indexResult).toMatchObject({
      openedPath: testsAllDir,
      openedKind: 'directory',
    });
    expect(openTextDocument).not.toHaveBeenCalled();
    expect(revealInExplorer).toHaveBeenCalledWith(testsAllDir);

    await import('node:fs/promises').then(({ rm }) => rm(testsIndexPath, { force: true }));

    const fallbackResult = await openTaskTestsCommand(taskRoot, {
      openTextDocument,
      showTextDocument,
      revealInExplorer,
    });

    expect(fallbackResult).toMatchObject({
      openedPath: testsAllDir,
      openedKind: 'directory',
    });
    expect(revealInExplorer).toHaveBeenCalledWith(testsAllDir);
  });

  it('never reveals internal hidden tests when only the user-facing tests directory should be opened', async () => {
    const taskRoot = await createTempTaskRoot();
    const testsDir = path.join(taskRoot, 'tests');
    const hiddenTestsDir = path.join(taskRoot, '_educoder', 'tests', 'hidden');
    await Promise.all([
      mkdir(testsDir, { recursive: true }),
      mkdir(hiddenTestsDir, { recursive: true }),
    ]);
    await Promise.all([
      writeFile(path.join(hiddenTestsDir, 'case_001_input.txt'), '1 2\n', 'utf8'),
      writeFile(path.join(hiddenTestsDir, 'case_001_output.txt'), '3\n', 'utf8'),
    ]);

    const revealInExplorer = vi.fn(async (_targetPath: string) => undefined);

    const result = await openTaskTestsCommand(taskRoot, {
      revealInExplorer,
    });

    expect(result).toMatchObject({
      openedPath: testsDir,
      openedKind: 'directory',
    });
    expect(revealInExplorer).toHaveBeenCalledWith(testsDir);
    expect(revealInExplorer).not.toHaveBeenCalledWith(hiddenTestsDir);
  });

  it('opens the first answer body directly instead of answer index documents', async () => {
    const taskRoot = await createTempTaskRoot();
    const answerIndexPath = path.join(taskRoot, 'answers', 'index.md');
    const answersDir = path.join(taskRoot, 'answers');
    const fallbackAnswerPath = path.join(answersDir, 'answer-2.md');
    await Promise.all([
      mkdir(path.dirname(answerIndexPath), { recursive: true }),
      mkdir(answersDir, { recursive: true }),
    ]);
    await Promise.all([
      writeFile(answerIndexPath, '# 答案索引\n', 'utf8'),
      writeFile(fallbackAnswerPath, '# answer\n', 'utf8'),
    ]);

    const openTextDocument = vi.fn(async (targetPath: string) => ({ targetPath }));
    const showTextDocument = vi.fn(async (document: { targetPath: string }) => document);

    const indexResult = await openTaskAnswersCommand(taskRoot, {
      openTextDocument,
      showTextDocument,
    });

    expect(indexResult).toMatchObject({
      openedPath: fallbackAnswerPath,
      openedKind: 'file',
    });
    expect(openTextDocument).toHaveBeenCalledWith(fallbackAnswerPath);

    await import('node:fs/promises').then(({ rm }) =>
      Promise.all([
        rm(answerIndexPath, { force: true }),
        rm(fallbackAnswerPath, { force: true }),
      ]),
    );

    const answerInfoPath = path.join(taskRoot, '_educoder', 'answers', 'answer_info.json');
    await mkdir(path.dirname(answerInfoPath), { recursive: true });
    await writeFile(answerInfoPath, JSON.stringify({ entries: [] }, null, 2), 'utf8');
    const revealInExplorer = vi.fn(async (_targetPath: string) => undefined);

    const fallbackResult = await openTaskAnswersCommand(taskRoot, {
      openTextDocument,
      showTextDocument,
      revealInExplorer,
    });

    expect(fallbackResult).toMatchObject({
      openedPath: answersDir,
      openedKind: 'directory',
    });
    expect(revealInExplorer).toHaveBeenCalledWith(answersDir);
  });

  it('opens the latest failed input/output files from the persisted local judge result', async () => {
    const taskRoot = await createTempTaskRoot();
    const inputPath = path.join(taskRoot, 'tests', 'all', 'case_002_input.txt');
    const outputPath = path.join(taskRoot, 'tests', 'all', 'case_002_output.txt');
    const reportPath = path.join(taskRoot, '_educoder', 'judge', 'latest_local.json');
    await Promise.all([
      mkdir(path.dirname(inputPath), { recursive: true }),
      mkdir(path.dirname(reportPath), { recursive: true }),
    ]);
    await Promise.all([
      writeFile(inputPath, '1 2\n', 'utf8'),
      writeFile(outputPath, '3\n', 'utf8'),
      writeFile(
        reportPath,
        JSON.stringify(
          {
            source: 'tests/all',
            runMode: 'full',
            compile: { verdict: 'compiled', stdout: '', stderr: '', executablePath: 'app.exe' },
            caseResults: [
              {
                caseId: 'case_002',
                verdict: 'failed',
                inputPath: 'tests/all/case_002_input.txt',
                outputPath: 'tests/all/case_002_output.txt',
                expected: '3\n',
                actual: '2\n',
                stdout: '2\n',
                stderr: '',
              },
            ],
            summary: { total: 3, passed: 2, failed: 1 },
          },
          null,
          2,
        ),
        'utf8',
      ),
    ]);

    const openTextDocument = vi.fn(async (targetPath: string) => ({ targetPath }));
    const showTextDocument = vi.fn(async (document: { targetPath: string }) => document);

    const inputResult = await openLatestFailureInputCommand(taskRoot, {
      openTextDocument,
      showTextDocument,
    });
    const outputResult = await openLatestFailureOutputCommand(taskRoot, {
      openTextDocument,
      showTextDocument,
    });

    expect(inputResult).toMatchObject({ openedPath: inputPath, openedKind: 'file' });
    expect(outputResult).toMatchObject({ openedPath: outputPath, openedKind: 'file' });
    expect(openTextDocument).toHaveBeenCalledWith(inputPath);
    expect(openTextDocument).toHaveBeenCalledWith(outputPath);
  });

});
