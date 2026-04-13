import { describe, expect, it } from 'vitest';
import { renderTask } from '../../src/webview/dashboard/renderTask.js';

describe('renderTask', () => {
  it('escapes remote task metadata before injecting it into webview html', () => {
    const html = renderTask(
      {
        taskId: 'fc7pz3fm6yjh',
        taskName: '</h2><img src=x onerror="alert(1)">',
        state: '已同步',
        solveState: '未开始',
        availableStates: ['未开始'],
        readiness: 'missing_workspace',
        hiddenTestsCached: false,
        localCaseCount: 0,
        materials: {
          statement: 'missing',
          template: 'missing',
          currentCode: 'missing',
          tests: 'missing',
          answers: 'missing',
          metadata: 'missing',
        },
        templateReady: false,
        passedReady: false,
        answerEntryCount: 0,
        unlockedAnswerCount: 0,
        repositoryReady: false,
        repositoryFileCount: 0,
        historyEntryCount: 0,
      },
      'C:/task-root',
    );

    expect(html).not.toContain('<img src=x onerror="alert(1)">');
    expect(html).toContain('&lt;/h2&gt;&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  });

  it('renders a doing-first current-task surface with answer status and explicit local-first submit guidance', () => {
    const html = renderTask(
      {
        taskId: 'fc7pz3fm6yjh',
        taskName: '第1关 基本实训：链表操作',
        displayTitle: '2-2 · 第1关 基本实训：链表操作',
        state: '已同步',
        solveState: '作答中',
        availableStates: ['作答中'],
        readiness: 'missing_workspace',
        hiddenTestsCached: false,
        localCaseCount: 0,
        materials: {
          statement: 'ready',
          template: 'ready',
          currentCode: 'ready',
          tests: 'ready',
          answers: 'ready',
          metadata: 'ready',
        },
        templateReady: false,
        passedReady: false,
        answerEntryCount: 2,
        unlockedAnswerCount: 0,
        repositoryReady: false,
        repositoryFileCount: 0,
        historyEntryCount: 0,
        officialJudge: {
          verdict: 'failed',
          headline: '未通过 2/3',
          detail: '等待下一次提交',
        },
        localJudge: {
          source: 'tests/all',
          compileVerdict: 'compiled',
          total: 3,
          passed: 2,
          failed: 1,
          headline: '首个失败：case_002',
          detail: '输入 tests/all/case_002_input.txt · 期望 5 · 实际 4',
          failureInputPath: 'tests/all/case_002_input.txt',
          failureOutputPath: 'tests/all/case_002_output.txt',
        },
      },
      'C:/task-root',
    );

    expect(html).toContain('2-2 · 第1关 基本实训：链表操作');
    expect(html).toContain('做题状态：作答中');
    expect(html).toContain('头哥结果');
    expect(html).toContain('未通过 2/3');
    expect(html).toContain('本地结果');
    expect(html).toContain('失败 1/3 · 首个失败：case_002');
    expect(html).toContain('打开题面');
    expect(html).toContain('data-educoder-command="educoderLocalOj.openTaskStatement"');
    expect(html).toContain('打开代码');
    expect(html).toContain('data-educoder-command="educoderLocalOj.openCurrentCode"');
    expect(html).toContain('测试集');
    expect(html).toContain('data-educoder-command="educoderLocalOj.openTaskTests"');
    expect(html).toContain('打开答案');
    expect(html).toContain('data-educoder-command="educoderLocalOj.openTaskAnswers"');
    expect(html).toContain('失败输入');
    expect(html).toContain('data-educoder-command="educoderLocalOj.openLatestFailureInput"');
    expect(html).toContain('失败输出');
    expect(html).toContain('data-educoder-command="educoderLocalOj.openLatestFailureOutput"');
    expect(html).not.toContain('打开 README');
    expect(html).not.toContain('data-educoder-command="educoderLocalOj.openTaskReadme"');
    expect(html).not.toContain('打开报告');
    expect(html).not.toContain('data-educoder-command="educoderLocalOj.openLatestReport"');
    expect(html).toContain('等待下一次提交');
    expect(html).toContain('运行测试');
    expect(html).toContain('提交评测');
    expect(html).toContain('data-educoder-command="educoderLocalOj.submitTask"');
    expect(html).not.toContain('资料完整度');
    expect(html).not.toContain('材料导航');
    expect(html).not.toContain('开始做题');
    expect(html).not.toContain('答案与解析');
    expect(html).not.toContain('进阶工具');
    expect(html).not.toContain('打开当前代码');
    expect(html).not.toContain('打开测试集');
    expect(html).not.toContain('答案与解析');
    expect(html).not.toContain('运行本地测试');
    expect(html).not.toContain('提交到头哥（先跑本地）');
    expect(html).not.toContain('强制提交到头哥');
    expect(html).not.toContain('更多操作');
    expect(html).not.toContain('重新拉答案（高级）');
    expect(html).not.toContain('拉全题目资料（高级）');
    expect(html).not.toContain('同步远端仓库（高级）');
    expect(html).not.toContain('data-educoder-command="educoderLocalOj.syncTaskRepository"');
    expect(html).not.toContain('data-educoder-command="educoderLocalOj.compareWithTemplate"');
    expect(html).not.toContain('data-educoder-command="educoderLocalOj.compareWithAnswer"');
    expect(html).not.toContain('同步完整仓库');
    expect(html).not.toContain('100 分');
  });

  it('hides failure input/output links when the latest local result has no failed case files', () => {
    const html = renderTask(
      {
        taskId: 'fc7pz3fm6yjh',
        taskName: '第1关 基本实训：链表操作',
        displayTitle: '2-2 · 第1关 基本实训：链表操作',
        state: '已同步',
        solveState: '本地测试已过',
        availableStates: ['本地测试已过'],
        readiness: 'local_ready',
        hiddenTestsCached: true,
        localCaseCount: 3,
        materials: {
          statement: 'ready',
          template: 'ready',
          currentCode: 'ready',
          tests: 'ready',
          answers: 'ready',
          metadata: 'ready',
        },
        templateReady: false,
        passedReady: false,
        answerEntryCount: 2,
        unlockedAnswerCount: 0,
        repositoryReady: false,
        repositoryFileCount: 0,
        historyEntryCount: 0,
        localJudge: {
          source: 'tests/all',
          compileVerdict: 'compiled',
          total: 3,
          passed: 3,
          failed: 0,
          headline: '本地已通过 3/3',
          detail: '可继续提交到头哥，默认来源 tests/all',
        },
      },
      'C:/task-root',
    );

    expect(html).not.toContain('失败输入');
    expect(html).not.toContain('失败输出');
  });

  it('shows local-pass guidance when headguy has not been submitted yet', () => {
    const html = renderTask(
      {
        taskId: 'fc7pz3fm6yjh',
        taskName: '第1关 基本实训：链表操作',
        displayTitle: '2-2 · 第1关 基本实训：链表操作',
        state: '本地评测已过',
        solveState: '本地测试已过',
        availableStates: ['本地测试已过'],
        readiness: 'local_ready',
        hiddenTestsCached: true,
        localCaseCount: 5,
        materials: {
          statement: 'ready',
          template: 'ready',
          currentCode: 'ready',
          tests: 'ready',
          answers: 'ready',
          metadata: 'ready',
        },
        templateReady: true,
        passedReady: false,
        answerEntryCount: 0,
        unlockedAnswerCount: 0,
        repositoryReady: false,
        repositoryFileCount: 0,
        historyEntryCount: 1,
        localJudge: {
          source: 'tests/all',
          compileVerdict: 'compiled',
          total: 5,
          passed: 5,
          failed: 0,
          headline: '本地已通过 5/5',
          detail: '可继续提交到头哥，默认来源 tests/all',
        },
      },
      'C:/task-root',
    );

    expect(html).toContain('头哥结果');
    expect(html).toContain('待提交');
    expect(html).toContain('本地已通过，可提交到头哥');
  });

  it('shows a full compile-error action when the latest local result is compile_error', () => {
    const html = renderTask(
      {
        taskId: 'fc7pz3fm6yjh',
        taskName: '第1关 基本实训：链表操作',
        displayTitle: '2-2 · 第1关 基本实训：链表操作',
        state: '本地评测未过',
        solveState: '本地测试未过',
        availableStates: ['本地测试未过'],
        readiness: 'local_ready',
        hiddenTestsCached: true,
        localCaseCount: 4,
        materials: {
          statement: 'ready',
          template: 'ready',
          currentCode: 'ready',
          tests: 'ready',
          answers: 'ready',
          metadata: 'ready',
        },
        templateReady: true,
        passedReady: false,
        answerEntryCount: 0,
        unlockedAnswerCount: 0,
        repositoryReady: false,
        repositoryFileCount: 0,
        historyEntryCount: 1,
        localJudge: {
          source: 'tests/all',
          compileVerdict: 'compile_error',
          total: 0,
          passed: 0,
          failed: 0,
          headline: '编译失败',
          detail: 'test2.cpp:12:1: error: ...',
        },
      },
      'C:/task-root',
    );

    expect(html).toContain('完整报错');
    expect(html).toContain('data-educoder-command="educoderLocalOj.openLatestCompileError"');
  });
});
