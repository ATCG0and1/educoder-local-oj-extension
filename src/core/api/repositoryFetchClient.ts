export interface EducoderPostClient {
  post<T>(
    path: string,
    body?: unknown,
    query?: Record<string, string | number | undefined>,
  ): Promise<T>;
}

interface RepositoryTreeResponse {
  trees?: Array<{
    name?: string;
    type?: string;
  }>;
}

export interface RepositoryNode {
  path: string;
  name: string;
  type: 'blob' | 'tree';
}

export interface ListRepositoryInput {
  myshixunIdentifier: string;
  path: string;
}

export interface CollectRepositoryTreeInput {
  myshixunIdentifier: string;
  rootPath?: string;
}

export interface RepositoryFetchClientLike {
  listRepository(input: ListRepositoryInput): Promise<RepositoryNode[]>;
  collectRepositoryTree(input: CollectRepositoryTreeInput): Promise<RepositoryNode[]>;
}

export class RepositoryFetchClient implements RepositoryFetchClientLike {
  constructor(private readonly client: EducoderPostClient) {}

  async listRepository(input: ListRepositoryInput): Promise<RepositoryNode[]> {
    const response = await this.client.post<RepositoryTreeResponse>(
      `/api/myshixuns/${input.myshixunIdentifier}/repository.json`,
      {
        path: input.path,
      },
    );

    return normalizeRepositoryNodes(input.path, response);
  }

  async collectRepositoryTree(input: CollectRepositoryTreeInput): Promise<RepositoryNode[]> {
    const queue = [input.rootPath ?? ''];
    const visited = new Set<string>();
    const nodes: RepositoryNode[] = [];

    while (queue.length > 0) {
      const currentPath = queue.shift() ?? '';
      if (visited.has(currentPath)) {
        continue;
      }

      visited.add(currentPath);
      const currentNodes = await this.listRepository({
        myshixunIdentifier: input.myshixunIdentifier,
        path: currentPath,
      });

      nodes.push(...currentNodes);

      for (const node of currentNodes) {
        if (node.type === 'tree' && !visited.has(node.path)) {
          queue.push(node.path);
        }
      }
    }

    return nodes.sort((left, right) => left.path.localeCompare(right.path));
  }
}

function normalizeRepositoryNodes(
  parentPath: string,
  response: RepositoryTreeResponse,
): RepositoryNode[] {
  return (response.trees ?? [])
    .map((entry) => {
      const name = entry.name?.trim();
      const type = entry.type === 'tree' ? 'tree' : entry.type === 'blob' ? 'blob' : undefined;
      if (!name || !type) {
        return undefined;
      }

      return {
        path: joinRepositoryPath(parentPath, name),
        name,
        type,
      } satisfies RepositoryNode;
    })
    .filter((node): node is RepositoryNode => Boolean(node));
}

function joinRepositoryPath(basePath: string, name: string): string {
  return [basePath.trim(), name.trim()].filter(Boolean).join('/');
}
