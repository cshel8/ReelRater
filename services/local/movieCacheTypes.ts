import type {
  MediaCatalogId,
  MediaSearchOptions,
  MediaSummary,
} from '@/types/domain';

export interface MovieCacheRepository {
  cache(items: MediaSummary[]): Promise<void>;
  search(query: string, options?: MediaSearchOptions): Promise<MediaSummary[]>;
  getById(catalogId: MediaCatalogId): Promise<MediaSummary | null>;
  listDueForRefresh(maximumResults?: number): Promise<MediaCatalogId[]>;
  purgeExpired(): Promise<void>;
  markAccessed(catalogId: MediaCatalogId): Promise<void>;
  clear(): Promise<void>;
}
