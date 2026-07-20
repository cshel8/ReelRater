import {
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import type { RemoteCommunityReviewService } from '@/services/contracts';
import type {
  ReviewVisibility,
  SharedReview,
} from '@/types/domain';

function readCreatedAt(value: unknown): string {
  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof value.toDate === 'function'
  ) {
    return value.toDate().toISOString();
  }

  if (typeof value === 'string') {
    return value;
  }

  return new Date(0).toISOString();
}

function isSharedVisibility(
  visibility: unknown
): visibility is Exclude<ReviewVisibility, 'private'> {
  return visibility === 'public' || visibility === 'followers';
}

export const firebaseCommunityReviewService: RemoteCommunityReviewService = {
  async listVisibleFromAuthors(_viewerId, authorIds, maximumResults = 20) {
    if (authorIds.length === 0) {
      return [];
    }

    const snapshots = await Promise.all(
      [...new Set(authorIds)].flatMap((authorId) =>
        (['public', 'followers'] as const).map(async (visibility) => {
          try {
            return await getDocs(
              query(
                collection(db, 'reviews'),
                where('userId', '==', authorId),
                where('visibility', '==', visibility)
              )
            );
          } catch (error) {
            const code =
              error && typeof error === 'object' && 'code' in error
                ? String(error.code)
                : 'unknown';
            console.log(
              `Unable to query ${visibility} reviews for ${authorId}:`,
              code
            );
            throw error;
          }
        })
      )
    );

    return snapshots
      .flatMap((snapshot) =>
        snapshot.docs.flatMap((reviewDocument) => {
          const data = reviewDocument.data();

          if (
            typeof data.userId !== 'string' ||
            typeof data.movieTitle !== 'string' ||
            typeof data.reviewText !== 'string' ||
            typeof data.rating !== 'string' ||
            !isSharedVisibility(data.visibility)
          ) {
            return [];
          }

          return [
            {
              id: reviewDocument.id,
              authorId: data.userId,
              movieTitle: data.movieTitle,
              reviewText: data.reviewText,
              rating: data.rating,
              visibility: data.visibility,
              createdAt: readCreatedAt(data.createdAt),
              syncStatus: 'synced',
            } satisfies SharedReview,
          ];
        })
      )
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, maximumResults);
  },
};
