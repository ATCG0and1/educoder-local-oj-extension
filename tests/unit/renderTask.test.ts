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

  it('renders answers as a learning surface while demoting repository sync to advanced tools', () => {
    const html = renderTask(
      {
        taskId: 'fc7pz3fm6yjh',
        taskName: '第1关 基本实训：链表操作',
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
          answers: 'missing',
          metadata: 'ready',
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

    expect(html).toContain('做题状态：作答中');
    expect(html).toContain('资料完整度');
    expect(html).toContain('题面：已就绪');
    expect(html).toContain('答案：缺失');
    expect(html).toContain('打开当前题目');
    expect(html).toContain('data-educoder-command="educoderLocalOj.openTask"');
    expect(html).toContain('拉全题目资料');
    expect(html).toContain('data-educoder-command="educoderLocalOj.syncTaskPackage"');
    expect(html).toContain('打开题面');
    expect(html).toContain('data-educoder-command="educoderLocalOj.openTaskStatement"');
    expect(html).toContain('打开当前代码');
    expect(html).toContain('data-educoder-command="educoderLocalOj.openCurrentCode"');
    expect(html).toContain('运行本地测试');
    expect(html).toContain('提交评测（本地 + 头哥）');
    expect(html).toContain('data-educoder-command="educoderLocalOj.submitTask"');
    expect(html).toContain('答案与解析');
    expect(html).toContain('同步答案');
    expect(html).toContain('进阶工具');
    expect(html).toContain('强制提交到头哥');
    expect(html).toContain('同步远端仓库（高级）');
    expect(html).toContain('data-educoder-command="educoderLocalOj.syncTaskRepository"');
    expect(html).not.toContain('同步完整仓库');
  });
});
