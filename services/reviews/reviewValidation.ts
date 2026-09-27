import type { Review } from '@/types/domain';

export const MAX_REVIEW_TITLE_LENGTH = 200;
export const MAX_REVIEW_TEXT_LENGTH = 3000;

export const reviewValidationMessage = (
  review: Pick<
    Review,
    'movieTitle' | 'rating' | 'reviewText' | 'spoilerWarning'
  >
): string | null => {
  if (
    typeof review.rating !== 'number' ||
    !Number.isInteger(review.rating) ||
    review.rating < 1 ||
    review.rating > 5
  ) {
    return 'Choose a whole-star rating from 1 to 5.';
  }
  if (
    !review.movieTitle.trim() ||
    review.movieTitle.length > MAX_REVIEW_TITLE_LENGTH
  ) {
    return `Choose a title up to ${MAX_REVIEW_TITLE_LENGTH} characters.`;
  }
  if (
    !review.reviewText.trim() ||
    review.reviewText.length > MAX_REVIEW_TEXT_LENGTH
  ) {
    return `Write a review of up to ${MAX_REVIEW_TEXT_LENGTH} characters.`;
  }
  if (typeof review.spoilerWarning !== 'boolean') {
    return 'Choose whether this review contains spoilers.';
  }
  return null;
};

export const assertValidReview = (
  review: Pick<
    Review,
    'movieTitle' | 'rating' | 'reviewText' | 'spoilerWarning'
  >
) => {
  const message = reviewValidationMessage(review);
  if (message) {
    throw new Error(message);
  }
};
