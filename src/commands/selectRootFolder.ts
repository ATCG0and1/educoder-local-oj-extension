import path from 'node:path';
import { pickRootFolder, type RootResolverDeps } from '../core/config/rootResolver.js';

export interface SelectRootFolderResult {
  rootFolderPath: string;
  productRoot: string;
}

export async function selectRootFolderCommand(
  deps: RootResolverDeps,
): Promise<SelectRootFolderResult> {
  const rootFolderPath = await pickRootFolder(deps);

  return {
    rootFolderPath,
    productRoot: path.join(rootFolderPath, 'Educoder Local OJ'),
  };
}
