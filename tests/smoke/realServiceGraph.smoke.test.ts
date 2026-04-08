import { access, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import * as vscode from 'vscode';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SESSION_CACHE_KEY, type SessionCookies } from '../../src/core/auth/sessionManager.js';

const tempDirs: string[] = [];

async function createTempRoot(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'educoder-real-graph-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('real command service graph', () => {
  it('sync command uses default runtime services instead of the test-only handler override', async () => {
    const rootDir = await createTempRoot();
    const vscodeMock = (vscode as any).__mock;
    const cachedSession: SessionCookies = {
      _educoder_session: 'cached-session',
      autologin_trustie: 'cached-trustie',
    };

    vscodeMock.globalStateStore.set(SESSION_CACHE_KEY, cachedSession);
    vscodeMock.clipboardReadText.mockResolvedValue(
      'https://www.educoder.net/classrooms/ufr7sxlc/shixun_homework/1316861?tabs=0',
    );
    vscodeMock.showOpenDialog.mockResolvedValue([{ fsPath: rootDir }]);

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('www.educoder.net/classrooms/ufr7sxlc/shixun_homework/1316861')) {
          return new Response('<html><body>classroom snapshot</body></html>', {
            status: 200,
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
            },
          });
        }

        const payload = url.includes('/api/shixuns/a9k8ufmh/challenges.json')
          ? [
              {
                identifier: 'fc7pz3fm6yjh',
                subject: '第1关 基本实训：链表操作',
                position: 1,
              },
            ]
          : {
              homework_commons_list: {
                category_id: '1316861',
                category_name: '第二章 线性表及应用',
                homeworks: [
                  {
                    homework_id: '3727439',
                    name: '2-2 基本实训-链表操作',
                    shixun_identifier: 'a9k8ufmh',
                    myshixun_identifier: 'obcts7i5fx',
                    student_work_id: '286519999',
                    shixun_name: '第1关 基本实训：链表操作',
                  },
                ],
              },
            };

        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }),
    );

    const result = await vscode.commands.executeCommand('educoderLocalOj.syncCurrentCollection');

    expect(result).toMatchObject({
      productRoot: path.join(rootDir, 'Educoder Local OJ'),
      collectionRoot: path.join(
        rootDir,
        'Educoder Local OJ',
        '课程 [ufr7sxlc]',
        '第二章 线性表及应用 [1316861]',
      ),
      manifest: {
        courseId: 'ufr7sxlc',
        categoryId: '1316861',
      },
    });
    await expect(
      access(
        path.join(
          rootDir,
          'Educoder Local OJ',
          '课程 [ufr7sxlc]',
          '第二章 线性表及应用 [1316861]',
          'collection.manifest.json',
        ),
      ),
    ).resolves.toBeUndefined();

    await expect(
      access(
        path.join(
          rootDir,
          'Educoder Local OJ',
          '课程 [ufr7sxlc]',
          '第二章 线性表及应用 [1316861]',
          'collection.page.html',
        ),
      ),
    ).resolves.toBeUndefined();

    await expect(
      access(
        path.join(
          rootDir,
          'Educoder Local OJ',
          '课程 [ufr7sxlc]',
          '第二章 线性表及应用 [1316861]',
          'collection.page.meta.json',
        ),
      ),
    ).resolves.toBeUndefined();
  });
});
