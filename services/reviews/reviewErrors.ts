import type { Review } from '@/types/domain';

export class DuplicateReviewError extends Error {
  readonly reviewId: string;

  constructor(
    readonly existingReview: Review | null,
    reviewId?: string
  ) {
    super('A review already exists for this media target.');
    this.name = 'DuplicateReviewError';
    this.reviewId = existingReview?.id ?? reviewId ?? '';
  }
}
