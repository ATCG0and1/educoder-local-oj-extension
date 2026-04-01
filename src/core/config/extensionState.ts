export const ROOT_FOLDER_URI_KEY = 'rootFolderUri';

export interface ExtensionStateStore {
  get<T>(key: string): T | undefined;
  update(key: string, value: string): PromiseLike<void> | void;
}

export interface ExtensionContextLike {
  globalState: ExtensionStateStore;
}

export function getStoredRootFolderUri(context: ExtensionContextLike): string | undefined {
  return context.globalState.get<string>(ROOT_FOLDER_URI_KEY);
}

export async function setStoredRootFolderUri(
  context: ExtensionContextLike,
  rootFolderUri: string,
): Promise<void> {
  await context.globalState.update(ROOT_FOLDER_URI_KEY, rootFolderUri);
}
