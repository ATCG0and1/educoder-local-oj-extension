import { describe, expect, it } from 'vitest';
import { APPROVED_TASK_STATES, buildTaskStateModel } from '../../src/core/ui/stateModel.js';

describe('stateModel', () => {
  it('exposes only the seven approved frozen task states', () => {
    expect(APPROVED_TASK_STATES).toEqual([
      '未同步',
      '已同步',
      '可本地评测',
      '本地评测未过',
      '本地评测已过',
      '官方评测未过',
      '官方评测已过（通关）',
    ]);
  });

  it('maps manifests and local results into the expected frozen states', () => {
    expect(buildTaskStateModel({}).state).toBe('未同步');
    expect(
      buildTaskStateModel({
        taskManifest: { taskId: 'task-1', name: 'Task 1', position: 1, folderName: '01 Task 1 [task-1]' },
        recoveryMetadata: {
          templateReady: true,
          templateFileCount: 1,
          passedReady: true,
          passedFileCount: 1,
          answerReady: true,
          answerEntryCount: 2,
          unlockedAnswerCount: 1,
          historyReady: true,
          historyFileCount: 1,
          repositoryReady: true,
          repositoryFileCount: 4,
          lastRepositorySyncAt: '2026-04-02T00:00:00.000Z',
          lastAnswerSyncAt: '2026-04-02T00:05:00.000Z',
          updatedAt: '2026-04-02T00:00:00.000Z',
        },
        historyEntryCount: 1,
      }),
    ).toMatchObject({
      state: '已同步',
      readiness: 'missing_workspace',
      hiddenTestsCached: false,
      templateReady: true,
      passedReady: true,
      answerEntryCount: 2,
      unlockedAnswerCount: 1,
      repositoryReady: true,
      repositoryFileCount: 4,
      historyEntryCount: 1,
      lastRecoverySyncAt: '2026-04-02T00:00:00.000Z',
      lastRepositorySyncAt: '2026-04-02T00:00:00.000Z',
      lastAnswerSyncAt: '2026-04-02T00:05:00.000Z',
    });
    expect(
      buildTaskStateModel({
        taskManifest: { taskId: 'task-1', name: 'Task 1', position: 1, folderName: '01 Task 1 [task-1]' },
        workspaceReady: true,
        recoveryMetadata: {
          templateReady: true,
          templateFileCount: 1,
          passedReady: false,
          passedFileCount: 0,
          answerReady: false,
          answerEntryCount: 0,
          unlockedAnswerCount: 0,
          historyReady: false,
          historyFileCount: 0,
          repositoryReady: false,
          repositoryFileCount: 0,
          updatedAt: '2026-04-02T00:00:00.000Z',
        },
      }),
    ).toMatchObject({
      state: '可本地评测',
      readiness: 'workspace_only',
      templateReady: true,
      passedReady: false,
      repositoryReady: false,
    });
    expect(
      buildTaskStateModel({
        taskManifest: { taskId: 'task-1', name: 'Task 1', position: 1, folderName: '01 Task 1 [task-1]' },
        workspaceReady: true,
        hiddenTestsCached: true,
        localReport: {
          runMode: 'full',
          generatedAt: '2026-04-01T00:00:00.000Z',
          compile: { verdict: 'compiled', stdout: '', stderr: '', executablePath: 'app.exe' },
          caseResults: [],
          summary: { total: 1, passed: 0, failed: 1 },
        },
      }),
    ).toMatchObject({
      state: '本地评测未过',
      readiness: 'local_ready',
      hiddenTestsCached: true,
      localCaseCount: 1,
      lastLocalJudgeAt: '2026-04-01T00:00:00.000Z',
    });
    expect(
      buildTaskStateModel({
        taskManifest: { taskId: 'task-1', name: 'Task 1', position: 1, folderName: '01 Task 1 [task-1]' },
        workspaceReady: true,
        hiddenTestsCached: true,
        localReport: {
          runMode: 'full',
          compile: { verdict: 'compiled', stdout: '', stderr: '', executablePath: 'app.exe' },
          caseResults: [],
          summary: { total: 1, passed: 1, failed: 0 },
        },
      }),
    ).toMatchObject({
      state: '本地评测已过',
      readiness: 'local_ready',
      hiddenTestsCached: true,
    });
  });

  it('prefers the official pass state as the final state', () => {
    const model = buildTaskStateModel({
      taskManifest: { taskId: 'task-1', name: 'Task 1', position: 1, folderName: '01 Task 1 [task-1]' },
      workspaceReady: true,
      localReport: {
        runMode: 'full',
        compile: { verdict: 'compiled', stdout: '', stderr: '', executablePath: 'app.exe' },
        caseResults: [],
        summary: { total: 1, passed: 1, failed: 0 },
      },
      officialReport: {
        source: 'remote',
        codeHash: 'abc',
        generatedAt: '2026-04-01T01:00:00.000Z',
        summary: {
          verdict: 'passed',
          score: 100,
          message: 'Accepted',
          rawLogPath: '_educoder/logs/remote/run.json',
        },
      },
    });

    expect(model).toMatchObject({
      state: '官方评测已过（通关）',
      lastOfficialJudgeAt: '2026-04-01T01:00:00.000Z',
    });
  });
});
