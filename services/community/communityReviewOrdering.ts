import type {
  CommunityFeedOptions,
  CommunityReviewSort,
} from '@/services/contracts';
import type { SharedReview } from '@/types/domain';
import {
  getDisplayReviewMovieTitle,
  readReviewMediaSnapshot,
} from '@/utils/reviewMovie';
import {
  matchesCommunityReviewKeyword,
  matchesCommunitySelectedMedia,
} from '@/services/community/communitySearch';

const reviewTime = (review: SharedReview) => {
  const value = new Date(review.createdAt).getTime();
  return Number.isFinite(value) ? value : 0;
};

const compareReviews = (
  left: SharedReview,
  right: SharedReview,
  sort: CommunityReviewSort
) => {
  if (sort === 'oldest') {
    return reviewTime(left) - reviewTime(right);
  }
  if (sort === 'highest') {
    return right.rating - left.rating ||
      left.movieTitle.localeCompare(right.movieTitle) ||
      reviewTime(right) - reviewTime(left) ||
      right.id.localeCompare(left.id);
  }
  if (sort === 'lowest') {
    return left.rating - right.rating ||
      left.movieTitle.localeCompare(right.movieTitle) ||
      reviewTime(right) - reviewTime(left) ||
      right.id.localeCompare(left.id);
  }
  return reviewTime(right) - reviewTime(left);
};

export const applyCommunityReviewOptions = <T extends SharedReview>(
  reviews: T[],
  options: CommunityFeedOptions = {}
): T[] => {
  const mediaFilter = options.mediaFilter ?? 'all';
  const sort = options.sort ?? 'newest';
  const maximumResults = Math.min(
    50,
    Math.max(1, options.maximumResults ?? 20)
  );
  const exactIdentityReviews = options.exactMedia
    ? reviews.filter((review) =>
        matchesCommunitySelectedMedia(review, options.exactMedia!)
      )
    : reviews;
  const matchingReviews =
    mediaFilter === 'all'
      ? exactIdentityReviews
      : exactIdentityReviews.filter(
          (review) =>
            readReviewMediaSnapshot(review.movie, review.movieTitle)
              .mediaType === mediaFilter
        );
  const normalizedSearchQuery = options.searchQuery?.trim();
  const searchedReviews = normalizedSearchQuery
    ? matchingReviews.filter((review) =>
        matchesCommunityReviewKeyword(
          { ...review, movieTitle: getDisplayReviewMovieTitle(review) },
          normalizedSearchQuery
        )
      )
    : matchingReviews;

  return [...searchedReviews]
    .sort((left, right) => compareReviews(left, right, sort))
    .slice(0, maximumResults);
};
