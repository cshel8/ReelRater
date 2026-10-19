import type {
  HomeRecommendationsService,
  MediaBrowseService,
  ReviewService,
} from '@/services/contracts';
import type { MediaCatalogId, MediaSummary, Review } from '@/types/domain';

const MAXIMUM_SEEDS = 3;
const MAXIMUM_RECOMMENDATIONS = 20;
const RESULTS_PER_SEED = 10;
const POSITIVE_RATING_MINIMUM = 4;

const matchedCatalogId = (review: Review): MediaCatalogId | null =>
  review.movie?.matchStatus === 'matched' && review.movie.catalogId
    ? review.movie.catalogId
    : null;

/**
 * Deterministic, online-only personalization: up to three of the user's
 * newest 4–5 star catalog-matched reviews seed TMDB's recommendation
 * endpoint, and the per-seed result lists are merged round-robin with
 * duplicates and already-reviewed titles removed. Any failure or lack of
 * qualifying seeds resolves to an empty list so Home simply hides the row.
 */
export const createHomeRecommendationsService = (
  reviewService: Pick<ReviewService, 'listForUser'>,
  browseCatalog: Pick<MediaBrowseService, 'recommendationsFor'>
): HomeRecommendationsService => ({
  async getForUser(userId) {
    const { reviews } = await reviewService.listForUser(userId);

    const reviewedCatalogIds = new Set(
      reviews.flatMap((review) => {
        const catalogId = matchedCatalogId(review);
        return catalogId ? [catalogId] : [];
      })
    );

    const seedCatalogIds: MediaCatalogId[] = [];
    const newestFirst = [...reviews].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
    for (const review of newestFirst) {
      if (review.rating < POSITIVE_RATING_MINIMUM) {
        continue;
      }
      const catalogId = matchedCatalogId(review);
      if (!catalogId || seedCatalogIds.includes(catalogId)) {
        continue;
      }
      seedCatalogIds.push(catalogId);
      if (seedCatalogIds.length === MAXIMUM_SEEDS) {
        break;
      }
    }

    if (seedCatalogIds.length === 0) {
      return [];
    }

    const resultsPerSeed = await Promise.all(
      seedCatalogIds.map((catalogId) =>
        browseCatalog
          .recommendationsFor(catalogId, {
            maximumResults: RESULTS_PER_SEED,
          })
          .catch(() => [] as MediaSummary[])
      )
    );

    const recommendations: MediaSummary[] = [];
    const seenCatalogIds = new Set<MediaCatalogId>(reviewedCatalogIds);
    const longestList = Math.max(
      ...resultsPerSeed.map((list) => list.length)
    );
    for (
      let position = 0;
      position < longestList &&
      recommendations.length < MAXIMUM_RECOMMENDATIONS;
      position += 1
    ) {
      for (const list of resultsPerSeed) {
        const item = list[position];
        if (!item || seenCatalogIds.has(item.catalogId)) {
          continue;
        }
        seenCatalogIds.add(item.catalogId);
        recommendations.push(item);
        if (recommendations.length === MAXIMUM_RECOMMENDATIONS) {
          break;
        }
      }
    }

    return recommendations;
  },
});
