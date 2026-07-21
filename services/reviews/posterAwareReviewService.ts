import type { ReviewService } from '@/services/contracts';
import type { PosterCacheService } from '@/services/local/posterCacheTypes';
import type { Review } from '@/types/domain';
import { isReviewCatalogDataExpired } from '@/utils/reviewMovie';

const MAXIMUM_OFFLINE_POSTERS = 5;

const attachLocalPoster = async (
  review: Review,
  posterCache: PosterCacheService,
  allowDownload: boolean
): Promise<Review> => {
  const movie = review.movie;
  if (
    movie?.matchStatus !== 'matched' ||
    !movie.posterUrl ||
    !movie.catalogDataRetention ||
    isReviewCatalogDataExpired(movie)
  ) {
    return review;
  }

  const localPosterUri = await posterCache.resolve({
    catalogId: movie.catalogId,
    posterUrl: movie.posterUrl,
    catalogDataRetention: movie.catalogDataRetention,
    allowDownload,
  });
  if (!localPosterUri) {
    return review;
  }

  return {
    ...review,
    movie: {
      ...movie,
      localPosterUri,
    },
  };
};

export const createPosterAwareReviewService = (
  reviewService: ReviewService,
  posterCache: PosterCacheService
): ReviewService => ({
  async listForUser(userId) {
    const result = await reviewService.listForUser(userId);
    await posterCache.purgeExpired().catch(() => undefined);
    const recentReviews = await Promise.all(
      result.reviews
        .slice(0, MAXIMUM_OFFLINE_POSTERS)
        .map((review) =>
          attachLocalPoster(
            review,
            posterCache,
            result.remoteAvailable
          ).catch(() => review)
        )
    );

    return {
      ...result,
      reviews: [
        ...recentReviews,
        ...result.reviews.slice(MAXIMUM_OFFLINE_POSTERS),
      ],
    };
  },

  create(userId, input) {
    return reviewService.create(userId, input);
  },

  update(userId, review) {
    return reviewService.update(userId, review);
  },

  remove(userId, reviewId) {
    return reviewService.remove(userId, reviewId);
  },

  syncPending(userId) {
    return reviewService.syncPending(userId);
  },
});
