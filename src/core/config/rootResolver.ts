import path from 'node:path';
import {
  getStoredRootFolderPath,
  setStoredRootFolderUri,
  toRootFolderUri,
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

const inFlightRootFolderSelections = new WeakMap<ExtensionContextLike, Promise<string>>();

export async function ensureRootFolder({ context, window }: RootResolverDeps): Promise<string> {
  const storedRootFolderPath = getStoredRootFolderPath(context);
  if (storedRootFolderPath) {
    return storedRootFolderPath;
  }

  const inFlightSelection = inFlightRootFolderSelections.get(context);
  if (inFlightSelection) {
    return inFlightSelection;
  }

  const selectionPromise = (async () => {
    try {
      const selection = await window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: '选择本地 OJ 根目录',
      });
      const rootFolderPath = selection?.[0]?.fsPath?.trim();

      if (!rootFolderPath) {
        throw new Error(ROOT_FOLDER_REQUIRED_ERROR_MESSAGE);
      }

      await setStoredRootFolderUri(context, toRootFolderUri(rootFolderPath));
      return rootFolderPath;
    } finally {
      inFlightRootFolderSelections.delete(context);
    }
  })();

  inFlightRootFolderSelections.set(context, selectionPromise);
  return selectionPromise;
}

export async function getProductRoot(deps: RootResolverDeps): Promise<string> {
  const rootFolderPath = await ensureRootFolder(deps);
  return path.join(rootFolderPath, 'Educoder Local OJ');
}
