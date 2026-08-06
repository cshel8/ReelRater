import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import type { RemoteCommunityReviewService } from '@/services/contracts';
import { applyCommunityReviewOptions } from '@/services/community/communityReviewOrdering';
import type {
  ReviewVisibility,
  SharedReview,
} from '@/types/domain';
import { readReviewMovieSnapshot } from '@/utils/reviewMovie';

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

const readSharedReviews = (
  snapshots: Awaited<ReturnType<typeof getDocs>>[]
): SharedReview[] =>
  snapshots.flatMap((snapshot) =>
    snapshot.docs.flatMap((reviewDocument) => {
      const review = readSharedReview(reviewDocument.id, reviewDocument.data());
      return review ? [review] : [];
    })
  );

function readSharedReview(
  id: string,
  value: unknown
): SharedReview | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const data = value as Record<string, unknown>;

  if (
    typeof data.userId !== 'string' ||
    typeof data.movieTitle !== 'string' ||
    typeof data.reviewText !== 'string' ||
    typeof data.rating !== 'string' ||
    !isSharedVisibility(data.visibility)
  ) {
    return null;
  }

  return {
    id,
    authorId: data.userId,
    movieTitle: data.movieTitle,
    movie: readReviewMovieSnapshot(data.movie, data.movieTitle),
    reviewText: data.reviewText,
    rating: data.rating,
    visibility: data.visibility,
    createdAt: readCreatedAt(data.createdAt),
    syncStatus: 'synced',
  };
}

const queryAuthorReviews = async (
  authorId: string,
  visibility: Exclude<ReviewVisibility, 'private'>
) => {
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
    console.log(`Unable to query ${visibility} reviews for ${authorId}:`, code);
    throw error;
  }
};

type ReviewPageCursor = {
  createdAt: string;
  reviewId: string;
};

const encodePageCursor = (cursor: ReviewPageCursor) =>
  encodeURIComponent(JSON.stringify(cursor));

const decodePageCursor = (cursor: string): ReviewPageCursor => {
  const value = JSON.parse(decodeURIComponent(cursor)) as Partial<ReviewPageCursor>;
  if (
    typeof value.createdAt !== 'string' ||
    !Number.isFinite(new Date(value.createdAt).getTime()) ||
    typeof value.reviewId !== 'string' ||
    !value.reviewId
  ) {
    throw new Error('Invalid review page cursor.');
  }
  return { createdAt: value.createdAt, reviewId: value.reviewId };
};

export const firebaseCommunityReviewService: RemoteCommunityReviewService = {
  async listVisibleFromAuthors(_viewerId, authorIds, options = {}) {
    if (authorIds.length === 0) {
      return [];
    }

    const snapshots = await Promise.all(
      [...new Set(authorIds)].flatMap((authorId) =>
        (['public', 'followers'] as const).map((visibility) =>
          queryAuthorReviews(authorId, visibility)
        )
      )
    );

    return applyCommunityReviewOptions(readSharedReviews(snapshots), options);
  },

  async listVisibleFromAuthor(
    _viewerId,
    authorId,
    includeFollowersOnly,
    maximumResults = 20
  ) {
    const visibilities: Exclude<ReviewVisibility, 'private'>[] =
      includeFollowersOnly ? ['public', 'followers'] : ['public'];
    const snapshots = await Promise.all(
      visibilities.map((visibility) =>
        queryAuthorReviews(authorId, visibility)
      )
    );

    return applyCommunityReviewOptions(readSharedReviews(snapshots), {
      maximumResults,
    });
  },

  async listVisibleFromAuthorPage(
    _viewerId,
    authorId,
    includeFollowersOnly,
    options
  ) {
    const maximumResults = Math.min(
      50,
      Math.max(1, options?.maximumResults ?? 10)
    );
    const visibilities: Exclude<ReviewVisibility, 'private'>[] =
      includeFollowersOnly ? ['public', 'followers'] : ['public'];
    const cursor = options?.cursor
      ? decodePageCursor(options.cursor)
      : null;
    const constraints = [
      where('userId', '==', authorId),
      visibilities.length === 1
        ? where('visibility', '==', visibilities[0])
        : where('visibility', 'in', visibilities),
      orderBy('createdAt', 'desc'),
      orderBy(documentId(), 'desc'),
      ...(cursor
        ? [startAfter(new Date(cursor.createdAt), cursor.reviewId)]
        : []),
      limit(maximumResults + 1),
    ];
    const snapshot = await getDocs(
      query(collection(db, 'reviews'), ...constraints)
    );
    const hasMore = snapshot.docs.length > maximumResults;
    const pageDocuments = snapshot.docs.slice(0, maximumResults);
    const reviews = pageDocuments.flatMap((reviewDocument) => {
      const review = readSharedReview(reviewDocument.id, reviewDocument.data());
      return review ? [review] : [];
    });
    const finalDocument = pageDocuments.at(-1);

    return {
      reviews,
      nextCursor:
        hasMore && finalDocument
          ? encodePageCursor({
              createdAt: readCreatedAt(finalDocument.data().createdAt),
              reviewId: finalDocument.id,
            })
          : null,
    };
  },

  async getVisibleFromAuthor(
    _viewerId,
    authorId,
    reviewId,
    includeFollowersOnly
  ) {
    try {
      const snapshot = await getDoc(doc(db, 'reviews', reviewId));
      if (!snapshot.exists()) {
        return null;
      }

      const review = readSharedReview(snapshot.id, snapshot.data());
      if (
        !review ||
        review.authorId !== authorId ||
        (review.visibility === 'followers' && !includeFollowersOnly)
      ) {
        return null;
      }
      return review;
    } catch (error) {
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String(error.code)
          : 'unknown';
      if (code === 'permission-denied' || code === 'firestore/permission-denied') {
        return null;
      }
      throw error;
    }
  },
};
