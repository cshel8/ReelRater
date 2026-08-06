import type {
  CommunityFeedOptions,
  CommunityReviewSort,
} from '@/services/contracts';
import type { SharedReview } from '@/types/domain';
import {
  getDisplayReviewMovieTitle,
  readReviewMediaSnapshot,
} from '@/utils/reviewMovie';

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
    return Number(right.rating) - Number(left.rating) ||
      reviewTime(right) - reviewTime(left);
  }
  if (sort === 'lowest') {
    return Number(left.rating) - Number(right.rating) ||
      reviewTime(right) - reviewTime(left);
  }
  return reviewTime(right) - reviewTime(left);
};

export const applyCommunityReviewOptions = (
  reviews: SharedReview[],
  options: CommunityFeedOptions = {}
) => {
  const mediaFilter = options.mediaFilter ?? 'all';
  const sort = options.sort ?? 'newest';
  const maximumResults = Math.min(
    50,
    Math.max(1, options.maximumResults ?? 20)
  );
  const matchingReviews =
    mediaFilter === 'all'
      ? reviews
      : reviews.filter(
          (review) =>
            readReviewMediaSnapshot(review.movie, review.movieTitle)
              .mediaType === mediaFilter
        );
  const normalizedSearchQuery = options.searchQuery?.trim().toLocaleLowerCase();
  const searchedReviews = normalizedSearchQuery
    ? matchingReviews.filter((review) => {
        const title = getDisplayReviewMovieTitle(review).toLocaleLowerCase();
        const reviewText = review.reviewText.toLocaleLowerCase();
        return (
          title.includes(normalizedSearchQuery) ||
          reviewText.includes(normalizedSearchQuery)
        );
      })
    : matchingReviews;

  return [...searchedReviews]
    .sort((left, right) => compareReviews(left, right, sort))
    .slice(0, maximumResults);
};
