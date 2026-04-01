import { fileURLToPath, pathToFileURL } from 'node:url';

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

export function getStoredRootFolderPath(context: ExtensionContextLike): string | undefined {
  const rootFolderUri = getStoredRootFolderUri(context);
  if (!rootFolderUri) {
    return undefined;
  }

  return rootFolderUri.startsWith('file:') ? fileURLToPath(rootFolderUri) : rootFolderUri;
}

export function toRootFolderUri(rootFolderPath: string): string {
  return pathToFileURL(rootFolderPath).toString();
}

export async function setStoredRootFolderUri(
  context: ExtensionContextLike,
  rootFolderUri: string,
): Promise<void> {
  await context.globalState.update(ROOT_FOLDER_URI_KEY, rootFolderUri);
}
