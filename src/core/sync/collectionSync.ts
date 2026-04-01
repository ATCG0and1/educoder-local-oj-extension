import type { CollectionIndex } from '../api/educoderClient.js';
import {
  loadCollectionManifest,
  mergeCollectionManifests,
  writeCollectionManifestArtifacts,
  type CollectionManifest,
} from './manifestStore.js';

export interface CollectionIndexClient {
  getCollectionIndex(input: {
    courseId: string;
    categoryId: string;
  }): Promise<CollectionIndex>;
}

export interface SyncCollectionIndexInput {
  client: CollectionIndexClient;
  rootDir: string;
  courseId: string;
  categoryId: string;
}

export async function syncCollectionIndex({
  client,
  rootDir,
  courseId,
  categoryId,
}: SyncCollectionIndexInput): Promise<CollectionManifest> {
  const incoming = await client.getCollectionIndex({ courseId, categoryId });
  const existing = await loadCollectionManifest(rootDir);
  const merged = mergeCollectionManifests(existing, incoming);

  await writeCollectionManifestArtifacts(rootDir, merged);

  return merged;
}
