import { parseEducoderCollectionUrl, type EducoderCollectionUrl } from './educoderUrl.js';

export const CLIPBOARD_URL_ERROR_MESSAGE =
  '请复制或粘贴头歌 shixun_homework 页面链接（https://www.educoder.net/classrooms/.../shixun_homework/...）';

export interface ClipboardEnv {
  clipboard: {
    readText(): PromiseLike<string> | Promise<string>;
  };
}

export async function resolveCollectionUrlFromClipboard(vscodeEnv: ClipboardEnv): Promise<EducoderCollectionUrl> {
  try {
    const raw = await vscodeEnv.clipboard.readText();
    return parseEducoderCollectionUrl(raw);
  } catch {
    throw new Error(CLIPBOARD_URL_ERROR_MESSAGE);
  }
}
