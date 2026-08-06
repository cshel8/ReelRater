import { randomUUID } from 'expo-crypto';
import type {
  ConnectivityService,
  RemoteReviewService,
  ReviewService,
} from '@/services/contracts';
import type {
  PendingReviewOperation,
  PendingReviewRepository,
} from '@/services/local/pendingReviewTypes';
import type { CachedReviewRepository } from '@/services/local/cachedReviewTypes';
import {
  noopReviewTargetIdentityRepository,
  type ReviewTargetIdentityRepository,
} from '@/services/local/reviewTargetIdentityTypes';
import {
  createReviewSyncService,
  type ReviewSyncService,
} from '@/services/reviews/reviewSyncService';
import { DuplicateReviewError } from '@/services/reviews/reviewErrors';
import type { Review } from '@/types/domain';
import { readReviewMovieSnapshot } from '@/utils/reviewMovie';
import { createReviewTargetKey } from '@/utils/reviewTargetIdentity';

const findMatchingReview = (
  reviews: Review[],
  media: {
    catalogId: string;
    mediaType: 'movie' | 'tv';
    reviewTargetType: 'movie' | 'series';
  }
) =>
  reviews.find((review) => {
    const snapshot = readReviewMovieSnapshot(review.movie, review.movieTitle);
    return (
      snapshot.matchStatus === 'matched' &&
      snapshot.catalogId === media.catalogId &&
      snapshot.mediaType === media.mediaType &&
      snapshot.reviewTargetType === media.reviewTargetType
    );
  }) ?? null;

function createOperation(
  userId: string,
  reviewId: string,
  operationType: 'create' | 'delete',
  payload: Review | null
): PendingReviewOperation {
  return {
    operationId: randomUUID(),
    reviewId,
    userId,
    operationType,
    payload,
    status: 'pending',
    attemptCount: 0,
    createdAt: new Date().toISOString(),
    lastAttemptAt: null,
    lastError: null,
  };
}

function mergeReviews(
  remoteReviews: Review[],
  operations: PendingReviewOperation[]
): Review[] {
  const reviewsById = new Map(
    remoteReviews.map((review) => [review.id, review])
  );

  for (const operation of operations) {
    if (operation.operationType === 'delete') {
      reviewsById.delete(operation.reviewId);
      continue;
    }

    if (operation.payload) {
      reviewsById.set(operation.reviewId, {
        ...operation.payload,
        syncStatus: operation.status,
      });
    }
  }

  return [...reviewsById.values()].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  );
}

function getErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = String(error.code);
    const message =
      'message' in error ? String(error.message) : 'Firebase request failed';
    return `${code}: ${message}`;
  }

  return error instanceof Error ? error.message : 'Unknown Firebase error';
}

export function createOfflineReviewService(
  pendingRepository: PendingReviewRepository,
  cachedRepository: CachedReviewRepository,
  remoteService: RemoteReviewService,
  connectivityService: ConnectivityService = {
    async isOnline() {
      return true;
    },
  },
  syncService: ReviewSyncService = createReviewSyncService(
    pendingRepository,
    remoteService
  ),
  identityRepository: ReviewTargetIdentityRepository =
    noopReviewTargetIdentityRepository
): ReviewService {
  const canSynchronize = async () => {
    try {
      return await connectivityService.isOnline();
    } catch {
      return false;
    }
  };

  const listForUser = async (userId: string) => {
    let remoteReviews: Review[] = [];
    let remoteAvailable = true;
    let remoteError: string | null = null;

    if (!(await canSynchronize())) {
      remoteAvailable = false;
      remoteError = 'Device is offline';
      remoteReviews = await cachedRepository.listForUser(userId);
    } else {
      try {
        remoteReviews = await remoteService.listForUser(userId);
        try {
          await cachedRepository.replaceForUser(userId, remoteReviews);
        } catch (cacheError) {
          const message =
            cacheError instanceof Error
              ? cacheError.message
              : 'Unknown local cache error';
          console.log('Unable to update the offline review cache:', message);
        }
      } catch (error) {
        remoteAvailable = false;
        remoteError = getErrorMessage(error);
        console.log('Unable to load reviews from the remote service:', remoteError);
        remoteReviews = await cachedRepository.listForUser(userId);
      }
    }

    const operations = await pendingRepository.listForUser(userId);
    const reviews = mergeReviews(remoteReviews, operations);

    if (remoteAvailable) {
      try {
        await identityRepository.replaceForUser(userId, reviews);
      } catch (identityError) {
        const message =
          identityError instanceof Error
            ? identityError.message
            : 'Unknown local identity index error';
        console.log('Unable to update the offline review identity index:', message);
      }
    }

    return {
      reviews,
      pendingCount: operations.length,
      remoteAvailable,
      remoteError,
    };
  };

  return {
    listForUser,

    async findForMedia(userId, media) {
      const result = await listForUser(userId);
      const existingReview = findMatchingReview(result.reviews, media);
      if (existingReview) {
        return existingReview;
      }

      const indexedReviewId = await identityRepository.findReviewId(
        userId,
        createReviewTargetKey(media)
      );
      if (indexedReviewId) {
        throw new DuplicateReviewError(null, indexedReviewId);
      }
      return null;
    },

    async create(userId, input) {
      const mediaSnapshot = readReviewMovieSnapshot(
        input.movie,
        input.movieTitle
      );
      if (mediaSnapshot.matchStatus === 'matched') {
        const result = await listForUser(userId);
        const existingReview = findMatchingReview(
          result.reviews,
          mediaSnapshot
        );
        if (existingReview) {
          throw new DuplicateReviewError(existingReview);
        }
        const indexedReviewId = await identityRepository.findReviewId(
          userId,
          createReviewTargetKey(mediaSnapshot)
        );
        if (indexedReviewId) {
          throw new DuplicateReviewError(null, indexedReviewId);
        }
      }

      const review: Review = {
        id: randomUUID(),
        ...input,
        movie: mediaSnapshot,
        createdAt: new Date().toISOString(),
        syncStatus: 'pending',
      };

      try {
        await identityRepository.save(userId, review);
      } catch (identityError) {
        if (mediaSnapshot.matchStatus === 'matched') {
          const indexedReviewId = await identityRepository.findReviewId(
            userId,
            createReviewTargetKey(mediaSnapshot)
          );
          if (indexedReviewId) {
            throw new DuplicateReviewError(null, indexedReviewId);
          }
        }
        throw identityError;
      }
      try {
        await pendingRepository.enqueueCreate(
          createOperation(userId, review.id, 'create', review)
        );
        await cachedRepository.save(userId, review);
      } catch (localSaveError) {
        await identityRepository.remove(userId, review.id).catch(() => undefined);
        throw localSaveError;
      }
      if (await canSynchronize()) {
        await syncService.sync(userId);
      }

      const remainingOperation = (
        await pendingRepository.listForUser(userId)
      ).find((operation) => operation.reviewId === review.id);

      return {
        ...review,
        syncStatus: remainingOperation?.status ?? 'synced',
      };
    },

    async update(userId, review) {
      const pendingReview: Review = {
        ...review,
        movie: readReviewMovieSnapshot(review.movie, review.movieTitle),
        syncStatus: 'pending',
      };

      await pendingRepository.enqueueCreate(
        createOperation(userId, review.id, 'create', pendingReview)
      );
      await cachedRepository.save(userId, pendingReview);
      try {
        await identityRepository.save(userId, pendingReview);
      } catch (identityError) {
        const message =
          identityError instanceof Error
            ? identityError.message
            : 'Unknown local identity index error';
        console.log('Unable to update the review identity index:', message);
      }
      if (await canSynchronize()) {
        await syncService.sync(userId);
      }

      const remainingOperation = (
        await pendingRepository.listForUser(userId)
      ).find((operation) => operation.reviewId === review.id);

      return {
        ...pendingReview,
        syncStatus: remainingOperation?.status ?? 'synced',
      };
    },

    async remove(userId, reviewId) {
      await pendingRepository.replaceWithDelete(
        createOperation(userId, reviewId, 'delete', null)
      );
      try {
        await cachedRepository.remove(userId, reviewId);
      } catch (cacheError) {
        const message =
          cacheError instanceof Error
            ? cacheError.message
            : 'Unknown local cache error';
        console.log('Unable to remove the cached review:', message);
      }
      try {
        await identityRepository.remove(userId, reviewId);
      } catch (identityError) {
        const message =
          identityError instanceof Error
            ? identityError.message
            : 'Unknown local identity index error';
        console.log('Unable to remove the review identity:', message);
      }
      if (await canSynchronize()) {
        await syncService.sync(userId);
      }
    },

    syncPending(userId) {
      return syncService.sync(userId);
    },
  };
}
