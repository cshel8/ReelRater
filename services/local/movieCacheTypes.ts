import type {
  MediaCatalogId,
  MediaSearchOptions,
  MediaSummary,
} from '@/types/domain';

/**
 * A cacheable catalog record. `overview` is stored when supplied (details
 * fetches) and preserved when later writes omit it (search/browse results).
 */
export type CachedMediaMetadata = MediaSummary & {
  overview?: string | null;
};

export interface MovieCacheRepository {
  cache(items: CachedMediaMetadata[]): Promise<void>;
  search(query: string, options?: MediaSearchOptions): Promise<MediaSummary[]>;
  getById(catalogId: MediaCatalogId): Promise<CachedMediaMetadata | null>;
  listDueForRefresh(maximumResults?: number): Promise<MediaCatalogId[]>;
  purgeExpired(): Promise<void>;
  markAccessed(catalogId: MediaCatalogId): Promise<void>;
  clear(): Promise<void>;
}
