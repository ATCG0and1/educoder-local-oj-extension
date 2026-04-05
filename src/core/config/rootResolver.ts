import { access } from 'node:fs/promises';
import path from 'node:path';
import {
  getStoredRootFolderPath,
  setStoredRootFolderUri,
  toRootFolderUri,
  type ExtensionContextLike,
} from './extensionState.js';

export const ROOT_FOLDER_REQUIRED_ERROR_MESSAGE = '请选择题目包存放目录';
export const ROOT_FOLDER_PICKER_LABEL = '选择题目包存放目录';

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
  pathExists?: (targetPath: string) => Promise<boolean>;
}

const inFlightRootFolderSelections = new WeakMap<ExtensionContextLike, Promise<string>>();

export async function ensureRootFolder({ context, window, pathExists }: RootResolverDeps): Promise<string> {
  const validatePath = pathExists ?? hasPath;
  const storedRootFolderPath = getStoredRootFolderPath(context);
  if (storedRootFolderPath && (await validatePath(storedRootFolderPath))) {
    return storedRootFolderPath;
  }

  const inFlightSelection = inFlightRootFolderSelections.get(context);
  if (inFlightSelection) {
    return inFlightSelection;
  }

  const selectionPromise = (async () => {
    try {
      return await pickRootFolder({ context, window, pathExists });
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

export async function pickRootFolder({ context, window }: RootResolverDeps): Promise<string> {
  const selection = await window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: ROOT_FOLDER_PICKER_LABEL,
  });
  const rootFolderPath = selection?.[0]?.fsPath?.trim();

  if (!rootFolderPath) {
    throw new Error(ROOT_FOLDER_REQUIRED_ERROR_MESSAGE);
  }

  await setStoredRootFolderUri(context, toRootFolderUri(rootFolderPath));
  return rootFolderPath;
}

async function hasPath(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}
