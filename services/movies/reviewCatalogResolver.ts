import type { MovieCatalogService } from '@/services/contracts';
import type { Review } from '@/types/domain';
import {
  createMatchedMovieSnapshot,
  isReviewCatalogDataExpired,
  isReviewCatalogDataRefreshDue,
  redactExpiredReviewCatalogData,
} from '@/utils/reviewMovie';

export type ReviewCatalogResolution<T extends Review> = {
  review: T;
  changed: boolean;
};

export const resolveReviewCatalogData = async <T extends Review>(
  review: T,
  movieCatalog: MovieCatalogService,
  currentTime = new Date()
): Promise<ReviewCatalogResolution<T>> => {
  if (!isReviewCatalogDataRefreshDue(review.movie, currentTime)) {
    return { review, changed: false };
  }

  if (review.movie?.matchStatus !== 'matched') {
    return { review, changed: false };
  }

  try {
    const movie = await movieCatalog.getById(review.movie.catalogId);
    if (movie) {
      const snapshot = createMatchedMovieSnapshot(movie, currentTime);
      const previousFetch = review.movie.catalogDataRetention?.fetchedAt;
      const resolvedFetch =
        snapshot.matchStatus === 'matched'
          ? snapshot.catalogDataRetention?.fetchedAt
          : undefined;

      // A due local-cache fallback is still useful before expiration, but it
      // must not be written back as though it were freshly downloaded.
      if (resolvedFetch && resolvedFetch !== previousFetch) {
        return {
          changed: true,
          review: {
            ...review,
            movieTitle: snapshot.title,
            movie: snapshot,
          },
        };
      }
    }
  } catch {
    // Expiration handling below is the same whether the provider is offline,
    // unavailable, or has removed this catalog entry.
  }

  if (isReviewCatalogDataExpired(review.movie, currentTime)) {
    const redactedReview = redactExpiredReviewCatalogData(review, currentTime);
    return {
      changed: redactedReview !== review,
      review: redactedReview,
    };
  }

  return { review, changed: false };
};
