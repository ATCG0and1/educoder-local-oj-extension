import { describe, expect, it } from 'vitest';
import { ProblemFetchClient } from '../../src/core/api/problemFetchClient.js';

describe('ProblemFetchClient', () => {
  it('extracts problem materials from a task page snapshot when task detail lacks statement fields', async () => {
    const client = new ProblemFetchClient({
      fetchTaskPageHtml: async () => ({
        url: 'https://www.educoder.net/tasks/ufr7sxlc/3727439/fc7pz3fm6yjh',
        contentType: 'text/html; charset=utf-8',
        html: `
          <html>
            <body>
              <h1 data-problem-title>第1关 基本实训：链表操作</h1>
              <section data-problem-statement>
                <p>给定两个整数，输出它们的和。</p>
              </section>
              <textarea data-problem-markdown>## 题目描述
给定两个整数，输出它们的和。</textarea>
              <div data-sample-index="1">
                <pre data-sample-input>1 2
</pre>
                <pre data-sample-output>3
</pre>
              </div>
            </body>
          </html>
        `,
      }),
    });

    await expect(
      client.fetchProblemMaterial({
        taskId: 'fc7pz3fm6yjh',
        homeworkId: '3727439',
        taskName: '第1关 基本实训：链表操作',
      }),
    ).resolves.toMatchObject({
      title: '第1关 基本实训：链表操作',
      statementMarkdown: expect.stringContaining('题目描述'),
      statementHtml: expect.stringContaining('给定两个整数'),
      samples: [{ name: '样例 1', input: '1 2\n', output: '3\n' }],
      pageSnapshotHtml: expect.stringContaining('data-problem-statement'),
    });
  });

  it('normalizes relative statement asset urls against the fetched task page url', async () => {
    const client = new ProblemFetchClient({
      fetchTaskPageHtml: async () => ({
        url: 'https://www.educoder.net/tasks/fc7pz3fm6yjh?homework_common_id=3727439',
        contentType: 'text/html; charset=utf-8',
        html: `
          <html>
            <body>
              <h1 data-problem-title>第1关 基本实训：链表操作</h1>
              <section data-problem-statement>
                <p><img src="../uploads/problem.png" /></p>
                <p><a href="/attachments/hint.pdf">查看提示</a></p>
              </section>
              <textarea data-problem-markdown>## 题目描述
![示意图](../uploads/problem.png)
[查看提示](/attachments/hint.pdf)</textarea>
            </body>
          </html>
        `,
      }),
    });

    await expect(
      client.fetchProblemMaterial({
        taskId: 'fc7pz3fm6yjh',
        homeworkId: '3727439',
        taskName: '第1关 基本实训：链表操作',
      }),
    ).resolves.toMatchObject({
      statementMarkdown: expect.stringContaining(
        'https://www.educoder.net/uploads/problem.png',
      ),
      statementHtml: expect.stringContaining(
        'https://www.educoder.net/uploads/problem.png',
      ),
    });
  });
});
