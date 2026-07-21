import type {
  CatalogDataRetention,
  MovieCatalogId,
} from '@/types/domain';

export type PosterCacheEntry = {
  catalogId: MovieCatalogId;
  sourceUrl: string;
  localUri: string;
  catalogDataRetention: CatalogDataRetention;
  lastAccessedAt: string;
};

export interface PosterCacheMetadataRepository {
  get(catalogId: MovieCatalogId): Promise<PosterCacheEntry | null>;
  saveAndPrune(
    entry: PosterCacheEntry,
    maximumEntries: number
  ): Promise<string[]>;
  remove(catalogId: MovieCatalogId): Promise<string | null>;
  takeExpired(expiredAt: string): Promise<string[]>;
  listLocalUris(): Promise<string[]>;
  markAccessed(catalogId: MovieCatalogId, accessedAt: string): Promise<void>;
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
    catalogId: MovieCatalogId;
    posterUrl: string;
    catalogDataRetention: CatalogDataRetention;
    allowDownload?: boolean;
  }): Promise<string | null>;
  purgeExpired(): Promise<void>;
  clear(): Promise<void>;
}
