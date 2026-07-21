import type {
  MovieCatalogService,
  ReviewService,
} from '@/services/contracts';
import { resolveReviewCatalogData } from '@/services/movies/reviewCatalogResolver';
import { isReviewCatalogDataRefreshDue } from '@/utils/reviewMovie';

const MAX_SNAPSHOT_REFRESHES_PER_LOAD = 10;

export const createCatalogAwareReviewService = (
  reviewService: ReviewService,
  movieCatalog: MovieCatalogService,
  clock: () => Date = () => new Date()
): ReviewService => ({
  async listForUser(userId) {
    const result = await reviewService.listForUser(userId);
    let attemptedRefreshes = 0;
    const reviews = [];

    for (const review of result.reviews) {
      const currentTime = clock();
      const shouldResolve = isReviewCatalogDataRefreshDue(
        review.movie,
        currentTime
      );
      if (
        !shouldResolve ||
        attemptedRefreshes >= MAX_SNAPSHOT_REFRESHES_PER_LOAD
      ) {
        reviews.push(review);
        continue;
      }

      attemptedRefreshes += 1;

      const resolution = await resolveReviewCatalogData(
        review,
        movieCatalog,
        currentTime
      );

      if (resolution.changed && result.remoteAvailable) {
        try {
          reviews.push(await reviewService.update(userId, resolution.review));
          continue;
        } catch {
          // The resolved or redacted version is still safer to display even
          // when the persistence write fails during this session.
        }
      }

      reviews.push(resolution.review);
    }

    return { ...result, reviews };
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
