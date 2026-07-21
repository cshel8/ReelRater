import type { MovieCatalogId, MovieSummary } from '@/types/domain';

export interface MovieCacheRepository {
  cache(movies: MovieSummary[]): Promise<void>;
  search(query: string, maximumResults?: number): Promise<MovieSummary[]>;
  getById(catalogId: MovieCatalogId): Promise<MovieSummary | null>;
  listDueForRefresh(maximumResults?: number): Promise<MovieCatalogId[]>;
  purgeExpired(): Promise<void>;
  markAccessed(catalogId: MovieCatalogId): Promise<void>;
  clear(): Promise<void>;
}
