import path from 'node:path';
import * as vscode from 'vscode';

export interface WorkspaceFolderLike {
  name?: string;
  uri: {
    fsPath: string;
    scheme?: string;
  };
}

export interface WorkspaceBindingDeps {
  workspace?: {
    workspaceFolders?: readonly WorkspaceFolderLike[];
    updateWorkspaceFolders(
      start: number,
      deleteCount?: number,
      ...workspaceFoldersToAdd: WorkspaceFolderLike[]
    ): boolean;
  };
  uriFile?: (fsPath: string) => WorkspaceFolderLike['uri'];
}

export interface ExplorerRevealDeps {
  executeCommand?: (command: string, ...args: unknown[]) => Promise<unknown>;
  uriFile?: (fsPath: string) => { fsPath: string; scheme?: string };
}

export interface WorkspaceBindingResult {
  added: boolean;
  alreadyPresent: boolean;
  folderName: string;
}

export async function bindProductRootToWorkspace(
  productRoot: string,
  deps: WorkspaceBindingDeps = {},
): Promise<WorkspaceBindingResult> {
  const workspace = deps.workspace ?? vscode.workspace;
  const uriFile = deps.uriFile ?? vscode.Uri.file;
  const existingFolders = workspace.workspaceFolders ?? [];
  const normalizedProductRoot = normalizeFsPath(productRoot);
  const folderName = path.basename(productRoot);

  if (
    existingFolders.some((folder) => normalizeFsPath(folder.uri.fsPath) === normalizedProductRoot)
  ) {
    return {
      added: false,
      alreadyPresent: true,
      folderName,
    };
  }

  const added = workspace.updateWorkspaceFolders(existingFolders.length, 0, {
    name: folderName,
    uri: uriFile(productRoot),
  });

  return {
    added,
    alreadyPresent: false,
    folderName,
  };
}

export async function revealInExplorer(
  targetPath: string,
  deps: ExplorerRevealDeps = {},
): Promise<void> {
  const executeCommand = deps.executeCommand ?? vscode.commands.executeCommand;
  const uriFile = deps.uriFile ?? vscode.Uri.file;

  await executeCommand('revealInExplorer', uriFile(targetPath));
}

function normalizeFsPath(targetPath: string): string {
  return path.normalize(targetPath).replaceAll('\\', '/').toLocaleLowerCase();
}
