import { Timestamp } from 'firebase-admin/firestore';

export type PersistedPublicReview = {
  reviewId: string;
  value: Record<string, unknown>;
};

export type UnsafePublicReview = {
  reviewId: string;
  userId: string | null;
  movieTitle: string | null;
  issues: string[];
};

export type PublicReviewSchemaInventoryResult = {
  publicReviewsScanned: number;
  querySafeReviews: number;
  queryUnsafeReviews: number;
  unsafeReviews: UnsafePublicReview[];
};

const nonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const isFirestoreTimestamp = (value: unknown): value is Timestamp =>
  value instanceof Timestamp;

const isQuerySafeRating = (value: unknown) =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= 1 &&
  value <= 5;

/**
 * Checks persisted values rather than client-normalized domain values. This is
 * deliberately narrower than the full write schema: it identifies data that
 * cannot safely participate in the proposed public Everyone feed queries or
 * be represented by its shared-review reader.
 */
export const classifyPublicReview = (
  review: PersistedPublicReview
): UnsafePublicReview | null => {
  const { value } = review;
  const issues: string[] = [];
  const movie =
    value.movie && typeof value.movie === 'object'
      ? (value.movie as Record<string, unknown>)
      : null;

  if (!isFirestoreTimestamp(value.createdAt)) {
    issues.push('createdAt: expected Firestore Timestamp');
  }
  if (!isQuerySafeRating(value.rating)) {
    issues.push('rating: expected numeric integer from 1 through 5');
  }
  if (!movie) {
    issues.push('movie: expected object with mediaType');
  } else {
    if (movie.mediaType !== 'movie' && movie.mediaType !== 'tv') {
      issues.push('movie.mediaType: expected "movie" or "tv"');
    }
    const validTargetType =
      (movie.mediaType === 'movie' && movie.reviewTargetType === 'movie') ||
      (movie.mediaType === 'tv' && movie.reviewTargetType === 'series');
    if (!validTargetType) {
      issues.push('movie.reviewTargetType: incompatible with mediaType');
    }
  }
  if (!nonEmptyString(value.userId)) {
    issues.push('userId: expected nonempty string');
  }
  if (!nonEmptyString(value.movieTitle)) {
    issues.push('movieTitle: expected nonempty string');
  }
  if (typeof value.reviewText !== 'string') {
    issues.push('reviewText: expected string');
  }
  if (typeof value.spoilerWarning !== 'boolean') {
    issues.push('spoilerWarning: expected boolean');
  }

  return issues.length === 0
    ? null
    : {
        reviewId: review.reviewId,
        userId: nonEmptyString(value.userId) ? value.userId : null,
        movieTitle: nonEmptyString(value.movieTitle) ? value.movieTitle : null,
        issues,
      };
};

/** Trusted, read-only maintenance workflow. It intentionally has no mutation API. */
export class PublicReviewSchemaInventoryJob {
  constructor(
    private readonly repository: {
      listPublicReviews(): Promise<PersistedPublicReview[]>;
    }
  ) {}

  async run(): Promise<PublicReviewSchemaInventoryResult> {
    const reviews = await this.repository.listPublicReviews();
    const unsafeReviews = reviews.flatMap((review) => {
      const unsafe = classifyPublicReview(review);
      return unsafe ? [unsafe] : [];
    });
    return {
      publicReviewsScanned: reviews.length,
      querySafeReviews: reviews.length - unsafeReviews.length,
      queryUnsafeReviews: unsafeReviews.length,
      unsafeReviews,
    };
  }
}
