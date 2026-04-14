import * as vscode from 'vscode';
import type { AnswerFetchClientLike } from '../core/api/answerFetchClient.js';
import { syncTaskAnswers } from './syncTaskAnswers.js';

const FULL_SYNC_CONTINUE_LABEL = '仍要同步';
const FULL_SYNC_CANCEL_LABEL = '取消';
const FULL_SYNC_WARNING_MESSAGE =
  '完整同步答案会调用头哥解锁答案接口，可能导致该题被判 0 分，仍要继续吗？';

export interface SyncTaskAnswersCommandDeps {
  answerClient: AnswerFetchClientLike;
  window?: {
    showWarningMessage?(
      message: string,
      ...items: string[]
    ): PromiseLike<string | undefined> | Promise<string | undefined>;
  };
}

export async function syncTaskAnswersSafeCommand(
  taskRoot: string,
  deps: SyncTaskAnswersCommandDeps,
): Promise<void> {
  await syncTaskAnswers(taskRoot, { answerClient: deps.answerClient }, { mode: 'safe' });
}

export async function syncTaskAnswersFullCommand(
  taskRoot: string,
  deps: SyncTaskAnswersCommandDeps,
): Promise<boolean> {
  const window = deps.window ?? vscode.window;
  const choice = await window.showWarningMessage?.(
    FULL_SYNC_WARNING_MESSAGE,
    FULL_SYNC_CONTINUE_LABEL,
    FULL_SYNC_CANCEL_LABEL,
  );

  if (choice !== FULL_SYNC_CONTINUE_LABEL) {
    return false;
  }

  await syncTaskAnswers(taskRoot, { answerClient: deps.answerClient }, { mode: 'full' });
  return true;
}

export const syncTaskAnswersCommandMessages = {
  FULL_SYNC_CANCEL_LABEL,
  FULL_SYNC_CONTINUE_LABEL,
  FULL_SYNC_WARNING_MESSAGE,
} as const;
