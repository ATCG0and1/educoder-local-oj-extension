import type { CollectionIndex } from '../api/educoderClient.js';
import { getCollectionRoot } from '../workspace/directoryLayout.js';
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
  productRoot: string;
  courseId: string;
  categoryId: string;
}

export interface SyncCollectionIndexResult {
  rootDir: string;
  manifest: CollectionManifest;
}

export async function syncCollectionIndex({
  client,
  productRoot,
  courseId,
  categoryId,
}: SyncCollectionIndexInput): Promise<SyncCollectionIndexResult> {
  const incoming = await client.getCollectionIndex({ courseId, categoryId });
  const rootDir = getCollectionRoot({
    productRoot,
    courseId: incoming.courseId,
    courseName: incoming.courseName,
    categoryId: incoming.categoryId,
    categoryName: incoming.categoryName,
  });
  const existing = await loadCollectionManifest(rootDir);
  const merged = mergeCollectionManifests(existing, incoming);

  await writeCollectionManifestArtifacts(rootDir, merged);

  return {
    rootDir,
    manifest: merged,
  };
}
