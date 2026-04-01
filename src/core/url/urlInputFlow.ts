import { parseEducoderCollectionUrl, type EducoderCollectionUrl } from './educoderUrl.js';
import { CLIPBOARD_URL_ERROR_MESSAGE, type ClipboardEnv } from './clipboardUrlResolver.js';

export const MANUAL_COLLECTION_URL_PROMPT = '请粘贴头歌 shixun_homework 页面链接';
export const MANUAL_COLLECTION_URL_PLACEHOLDER =
  '例如：https://www.educoder.net/classrooms/ufr7sxlc/shixun_homework/1316861';

export interface ManualCollectionUrlInput {
  showInputBox(options: {
    prompt: string;
    placeHolder: string;
    ignoreFocusOut: boolean;
    validateInput(value: string): string | undefined;
  }): PromiseLike<string | undefined> | string | undefined;
}

export interface CollectionUrlInputDeps extends ClipboardEnv {
  input: ManualCollectionUrlInput;
}

export async function resolveCollectionUrl(
  deps: CollectionUrlInputDeps,
): Promise<EducoderCollectionUrl> {
  try {
    return parseEducoderCollectionUrl(await deps.clipboard.readText());
  } catch {
    const manualInput = await deps.input.showInputBox({
      prompt: MANUAL_COLLECTION_URL_PROMPT,
      placeHolder: MANUAL_COLLECTION_URL_PLACEHOLDER,
      ignoreFocusOut: true,
      validateInput: (value) => {
        try {
          parseEducoderCollectionUrl(value);
          return undefined;
        } catch {
          return CLIPBOARD_URL_ERROR_MESSAGE;
        }
      },
    });

    try {
      return parseEducoderCollectionUrl(manualInput ?? '');
    } catch {
      throw new Error(CLIPBOARD_URL_ERROR_MESSAGE);
    }
  }
}
