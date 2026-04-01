import { describe, expect, it } from 'vitest';
import {
  APPROVED_TASK_STATES,
  buildTaskStateModel,
} from '../../src/core/ui/stateModel.js';

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
        taskManifest: { taskId: 'task-1', name: 'Task 1', position: 1 },
      }).state,
    ).toBe('已同步');
    expect(
      buildTaskStateModel({
        taskManifest: { taskId: 'task-1', name: 'Task 1', position: 1 },
        workspaceReady: true,
      }).state,
    ).toBe('可本地评测');
    expect(
      buildTaskStateModel({
        taskManifest: { taskId: 'task-1', name: 'Task 1', position: 1 },
        workspaceReady: true,
        localReport: {
          runMode: 'full',
          compile: { verdict: 'compiled', stdout: '', stderr: '', executablePath: 'app.exe' },
          caseResults: [],
          summary: { total: 1, passed: 0, failed: 1 },
        },
      }).state,
    ).toBe('本地评测未过');
    expect(
      buildTaskStateModel({
        taskManifest: { taskId: 'task-1', name: 'Task 1', position: 1 },
        workspaceReady: true,
        localReport: {
          runMode: 'full',
          compile: { verdict: 'compiled', stdout: '', stderr: '', executablePath: 'app.exe' },
          caseResults: [],
          summary: { total: 1, passed: 1, failed: 0 },
        },
      }).state,
    ).toBe('本地评测已过');
  });

  it('prefers the official pass state as the final state', () => {
    const model = buildTaskStateModel({
      taskManifest: { taskId: 'task-1', name: 'Task 1', position: 1 },
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
        summary: {
          verdict: 'passed',
          score: 100,
          message: 'Accepted',
          rawLogPath: '_educoder/logs/remote/run.json',
        },
      },
    });

    expect(model.state).toBe('官方评测已过（通关）');
  });
});
