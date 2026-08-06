import type { MediaSummary, ReviewMediaSnapshot } from '@/types/domain';

type MatchedReviewTarget = Pick<
  MediaSummary,
  'catalogId' | 'mediaType' | 'reviewTargetType'
>;

export const createReviewTargetKey = (target: MatchedReviewTarget): string =>
  JSON.stringify([
    target.mediaType,
    target.reviewTargetType,
    target.catalogId,
  ]);

export const readReviewTargetKey = (
  snapshot: ReviewMediaSnapshot
): string | null =>
  snapshot.matchStatus === 'matched'
    ? createReviewTargetKey(snapshot)
    : null;
