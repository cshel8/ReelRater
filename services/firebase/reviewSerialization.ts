import { Timestamp } from 'firebase/firestore';
import type { ReviewMediaSnapshot } from '@/types/domain';
import {
  readCatalogDataRetention,
  readReviewMediaSnapshot,
} from '@/utils/reviewMovie';

type FirestoreMovie = Record<string, unknown>;

const toTimestamp = (value: string): Timestamp => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new Error('Review catalog retention contains an invalid timestamp.');
  }
  return Timestamp.fromDate(date);
};

const toIsoString = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }

  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof value.toDate === 'function'
  ) {
    const date = value.toDate();
    return date instanceof Date && Number.isFinite(date.getTime())
      ? date.toISOString()
      : null;
  }
  return null;
};

export const serializeReviewMovie = (
  movie: ReviewMediaSnapshot
): FirestoreMovie => {
  const serializedMovie =
    movie.matchStatus === 'matched'
      ? (() => {
          const { localPosterUri: _localPosterUri, ...snapshot } = movie;
          return snapshot;
        })()
      : movie;
  if (movie.matchStatus !== 'matched' || !movie.catalogDataRetention) {
    return serializedMovie;
  }

  return {
    ...serializedMovie,
    catalogDataRetention: {
      fetchedAt: toTimestamp(movie.catalogDataRetention.fetchedAt),
      refreshAfter: toTimestamp(movie.catalogDataRetention.refreshAfter),
      expiresAt: toTimestamp(movie.catalogDataRetention.expiresAt),
    },
  };
};

export const deserializeReviewMovie = (
  value: unknown,
  fallbackTitle: string
): ReviewMediaSnapshot => {
  if (!value || typeof value !== 'object') {
    return readReviewMediaSnapshot(value, fallbackTitle);
  }

  const movie = value as FirestoreMovie;
  const retention = movie.catalogDataRetention;
  if (!retention || typeof retention !== 'object') {
    return readReviewMediaSnapshot(movie, fallbackTitle);
  }

  const rawRetention = retention as Record<string, unknown>;
  const normalizedRetention = readCatalogDataRetention({
    fetchedAt: toIsoString(rawRetention.fetchedAt),
    refreshAfter: toIsoString(rawRetention.refreshAfter),
    expiresAt: toIsoString(rawRetention.expiresAt),
  });

  return readReviewMediaSnapshot(
    {
      ...movie,
      ...(normalizedRetention
        ? { catalogDataRetention: normalizedRetention }
        : { catalogDataRetention: undefined }),
    },
    fallbackTitle
  );
};

const LEGACY_RATINGS = {
  '1': 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
} as const;

export const readFirestoreRating = (value: unknown): number | null => {
  if (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 5
  ) {
    return value;
  }

  return typeof value === 'string' && value in LEGACY_RATINGS
    ? LEGACY_RATINGS[value as keyof typeof LEGACY_RATINGS]
    : null;
};

/**
 * A query that returns documents which cannot be safely represented in the
 * domain must not be mistaken for an authoritative empty review list.
 */
export class ReviewDeserializationError extends Error {
  constructor(rejectedDocumentCount: number) {
    super(
      `${rejectedDocumentCount} review document${
        rejectedDocumentCount === 1 ? ' was' : 's were'
      } returned by Firestore but could not be read safely.`
    );
    this.name = 'ReviewDeserializationError';
  }
}
