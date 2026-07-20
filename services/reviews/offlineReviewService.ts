import { randomUUID } from 'expo-crypto';
import type {
  RemoteReviewService,
  ReviewService,
} from '@/services/contracts';
import type {
  PendingReviewOperation,
  PendingReviewRepository,
} from '@/services/local/pendingReviewTypes';
import type { CachedReviewRepository } from '@/services/local/cachedReviewTypes';
import {
  createReviewSyncService,
  type ReviewSyncService,
} from '@/services/reviews/reviewSyncService';
import type { Review } from '@/types/domain';

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
  syncService: ReviewSyncService = createReviewSyncService(
    pendingRepository,
    remoteService
  )
): ReviewService {
  return {
    async listForUser(userId) {
      let remoteReviews: Review[] = [];
      let remoteAvailable = true;
      let remoteError: string | null = null;

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

      const operations = await pendingRepository.listForUser(userId);

      return {
        reviews: mergeReviews(remoteReviews, operations),
        pendingCount: operations.length,
        remoteAvailable,
        remoteError,
      };
    },

    async create(userId, input) {
      const review: Review = {
        id: randomUUID(),
        ...input,
        createdAt: new Date().toISOString(),
        syncStatus: 'pending',
      };

      await pendingRepository.enqueueCreate(
        createOperation(userId, review.id, 'create', review)
      );
      await syncService.sync(userId);

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
        syncStatus: 'pending',
      };

      await pendingRepository.enqueueCreate(
        createOperation(userId, review.id, 'create', pendingReview)
      );
      await syncService.sync(userId);

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
      await syncService.sync(userId);
    },

    syncPending(userId) {
      return syncService.sync(userId);
    },
  };
}
