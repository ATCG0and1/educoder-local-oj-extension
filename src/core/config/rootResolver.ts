import path from 'node:path';
import {
  getStoredRootFolderUri,
  setStoredRootFolderUri,
  type ExtensionContextLike,
} from './extensionState.js';

export const ROOT_FOLDER_REQUIRED_ERROR_MESSAGE = '请选择本地 OJ 根目录';

export interface RootFolderSelection {
  fsPath: string;
}

export interface WindowLike {
  showOpenDialog(options: {
    canSelectFiles: boolean;
    canSelectFolders: boolean;
    canSelectMany: boolean;
    openLabel: string;
  }): PromiseLike<readonly RootFolderSelection[] | undefined> | readonly RootFolderSelection[] | undefined;
}

export interface RootResolverDeps {
  context: ExtensionContextLike;
  window: WindowLike;
}

export async function ensureRootFolder({ context, window }: RootResolverDeps): Promise<string> {
  const storedRootFolderUri = getStoredRootFolderUri(context);
  if (storedRootFolderUri) {
    return storedRootFolderUri;
  }

  const selection = await window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: '选择本地 OJ 根目录',
  });
  const rootFolderUri = selection?.[0]?.fsPath?.trim();

  if (!rootFolderUri) {
    throw new Error(ROOT_FOLDER_REQUIRED_ERROR_MESSAGE);
  }

  await setStoredRootFolderUri(context, rootFolderUri);
  return rootFolderUri;
}

export async function getProductRoot(deps: RootResolverDeps): Promise<string> {
  const rootFolderUri = await ensureRootFolder(deps);
  return path.join(rootFolderUri, 'Educoder Local OJ');
}
