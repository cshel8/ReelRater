import type { MovieCatalogId } from '../movies/types.js';

export type CatalogDataRetention = {
  fetchedAt: string;
  refreshAfter: string;
  expiresAt: string;
};

export type ReviewCatalogSnapshot = {
  catalogId: MovieCatalogId;
  title: string;
  releaseYear: number | null;
  genres: string[];
  posterUrl: string | null;
  retention: CatalogDataRetention | null;
};

export type ReviewCatalogRecord = {
  reviewId: string;
  /** Opaque repository version used for conditional writes. */
  version: string;
  snapshot: ReviewCatalogSnapshot;
};

export type ReviewCatalogPage = {
  records: ReviewCatalogRecord[];
  nextCursor: string | null;
};

export type ReviewCatalogUpdateResult = 'updated' | 'conflict' | 'missing';

/**
 * Persistence boundary for catalog fields embedded in reviews.
 *
 * Implementations must update only the catalog snapshot. They must never
 * replace the user's rating, review text, visibility, author, or timestamps.
 */
export interface ReviewCatalogMaintenanceRepository {
  listDue(input: {
    dueAt: string;
    cursor?: string;
    maximumResults: number;
  }): Promise<ReviewCatalogPage>;
  replaceSnapshot(input: {
    reviewId: string;
    expectedVersion: string;
    snapshot: ReviewCatalogSnapshot;
  }): Promise<ReviewCatalogUpdateResult>;
}

/** A future Firestore, DynamoDB, or other adapter can implement this lease. */
export interface MaintenanceLease {
  tryAcquire(input: {
    key: string;
    ownerId: string;
    expiresAt: string;
  }): Promise<boolean>;
  release(input: { key: string; ownerId: string }): Promise<void>;
}
