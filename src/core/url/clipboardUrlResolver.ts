import { parseEducoderCollectionUrl, type EducoderCollectionUrl } from './educoderUrl';

export const CLIPBOARD_URL_ERROR_MESSAGE = '请先在 Edge 复制头歌 shixun_homework 页面链接';

export interface ClipboardEnv {
  clipboard: {
    readText(): Thenable<string> | Promise<string>;
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
