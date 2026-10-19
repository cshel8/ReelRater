import type { MediaCatalogId } from '@/types/domain';

export type HomeImageCacheEntry = {
  /** The cache identity: the exact remote poster/backdrop URL. */
  sourceUrl: string;
  catalogId: MediaCatalogId;
  localUri: string;
  lastAccessedAt: string;
};

export interface HomeImageCacheMetadataRepository {
  get(sourceUrl: string): Promise<HomeImageCacheEntry | null>;
  /** Upserts the entry and returns local URIs evicted beyond the limit. */
  saveAndPrune(
    entry: HomeImageCacheEntry,
    maximumEntries: number
  ): Promise<string[]>;
  remove(sourceUrl: string): Promise<string | null>;
  /** Removes entries not accessed since the cutoff; returns their URIs. */
  takeStale(accessedBefore: string): Promise<string[]>;
  listLocalUris(): Promise<string[]>;
  markAccessed(sourceUrl: string, accessedAt: string): Promise<void>;
  clear(): Promise<string[]>;
}

export interface HomeImageCacheService {
  /**
   * Returns a verified local file URI for the image, downloading it when
   * permitted. Returns null on any failure; callers fall back to the remote
   * URL or a placeholder, so cached Home metadata stays usable without images.
   */
  resolve(input: {
    catalogId: MediaCatalogId;
    sourceUrl: string;
    allowDownload?: boolean;
  }): Promise<string | null>;
  /** Removes stale metadata/files and sweeps orphaned files. */
  purgeStale(): Promise<void>;
  clear(): Promise<void>;
}
