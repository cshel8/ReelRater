import type {
  CatalogDataRetention,
  MediaCatalogId,
} from '@/types/domain';

export type PosterCacheEntry = {
  catalogId: MediaCatalogId;
  sourceUrl: string;
  localUri: string;
  catalogDataRetention: CatalogDataRetention;
  lastAccessedAt: string;
};

export interface PosterCacheMetadataRepository {
  get(catalogId: MediaCatalogId): Promise<PosterCacheEntry | null>;
  saveAndPrune(
    entry: PosterCacheEntry,
    maximumEntries: number
  ): Promise<string[]>;
  remove(catalogId: MediaCatalogId): Promise<string | null>;
  takeExpired(expiredAt: string): Promise<string[]>;
  listLocalUris(): Promise<string[]>;
  markAccessed(catalogId: MediaCatalogId, accessedAt: string): Promise<void>;
  clear(): Promise<string[]>;
}

export interface PosterFileStore {
  download(sourceUrl: string, cacheKey: string): Promise<string>;
  exists(localUri: string): Promise<boolean>;
  remove(localUri: string): Promise<void>;
  list(): Promise<string[]>;
}

export interface PosterCacheService {
  resolve(input: {
    catalogId: MediaCatalogId;
    posterUrl: string;
    catalogDataRetention: CatalogDataRetention;
    allowDownload?: boolean;
  }): Promise<string | null>;
  purgeExpired(): Promise<void>;
  clear(): Promise<void>;
}
