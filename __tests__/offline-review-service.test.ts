import { randomUUID } from 'expo-crypto';
import { createOfflineReviewService } from '@/services/reviews/offlineReviewService';
import { DuplicateReviewError } from '@/services/reviews/reviewErrors';
import type { RemoteReviewService } from '@/services/contracts';
import type { CachedReviewRepository } from '@/services/local/cachedReviewTypes';
import type { ReviewTargetIdentityRepository } from '@/services/local/reviewTargetIdentityTypes';
import type {
  PendingReviewOperation,
  PendingReviewRepository,
} from '@/services/local/pendingReviewTypes';
import type { Review } from '@/types/domain';
import { createMatchedMediaSnapshot } from '@/utils/reviewMovie';
import { readReviewTargetKey } from '@/utils/reviewTargetIdentity';

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(),
}));

function createMemoryRepository() {
  const operations: PendingReviewOperation[] = [];

  const repository: PendingReviewRepository = {
    enqueueCreate: jest.fn(async (operation) => {
      operations.push(operation);
    }),
    replaceWithDelete: jest.fn(async (operation) => {
      const existingIndex = operations.findIndex(
        (candidate) =>
          candidate.userId === operation.userId &&
          candidate.reviewId === operation.reviewId
      );
      if (existingIndex >= 0) {
        operations.splice(existingIndex, 1);
      }
      operations.push(operation);
    }),
    listForUser: jest.fn(async (userId) =>
      operations.filter((operation) => operation.userId === userId)
    ),
    markAttempting: jest.fn(async (operationId) => {
      const operation = operations.find(
        (candidate) => candidate.operationId === operationId
      );
      if (operation) {
        operation.status = 'pending';
      }
    }),
    markFailed: jest.fn(async (operationId, message) => {
      const operation = operations.find(
        (candidate) => candidate.operationId === operationId
      );
      if (operation) {
        operation.status = 'failed';
        operation.lastError = message;
      }
    }),
    remove: jest.fn(async (operationId) => {
      const index = operations.findIndex(
        (candidate) => candidate.operationId === operationId
      );
      if (index >= 0) {
        operations.splice(index, 1);
      }
    }),
    countForUser: jest.fn(
      async (userId) =>
        operations.filter((operation) => operation.userId === userId).length
    ),
  };

  return { operations, repository };
}

function createRemoteService(): jest.Mocked<RemoteReviewService> {
  return {
    listForUser: jest.fn().mockResolvedValue([]),
    save: jest.fn(),
    remove: jest.fn(),
  };
}

function createMemoryCache(initialReviews: Review[] = []) {
  let cachedReviews = [...initialReviews];

  const repository: CachedReviewRepository = {
    listForUser: jest.fn(async () => cachedReviews),
    replaceForUser: jest.fn(async (_userId, reviews) => {
      cachedReviews = [...reviews]
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, 5);
    }),
    save: jest.fn(async (_userId, review) => {
      cachedReviews = [
        review,
        ...cachedReviews.filter((candidate) => candidate.id !== review.id),
      ]
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, 5);
    }),
    remove: jest.fn(async (_userId, reviewId) => {
      cachedReviews = cachedReviews.filter((review) => review.id !== reviewId);
    }),
  };

  return { getCachedReviews: () => cachedReviews, repository };
}

function createMemoryIdentityRepository() {
  const identities = new Map<string, string>();
  const keyFor = (userId: string, targetKey: string) =>
    `${userId}\u0000${targetKey}`;
  const repository: ReviewTargetIdentityRepository = {
    findReviewId: jest.fn(async (userId, targetKey) =>
      identities.get(keyFor(userId, targetKey)) ?? null
    ),
    replaceForUser: jest.fn(async (userId, reviews) => {
      for (const key of [...identities.keys()]) {
        if (key.startsWith(`${userId}\u0000`)) {
          identities.delete(key);
        }
      }
      for (const review of reviews) {
        const snapshot = createReviewSnapshot(review);
        const targetKey = readReviewTargetKey(snapshot);
        if (targetKey && !identities.has(keyFor(userId, targetKey))) {
          identities.set(keyFor(userId, targetKey), review.id);
        }
      }
    }),
    save: jest.fn(async (userId, review) => {
      for (const [key, reviewId] of identities) {
        if (key.startsWith(`${userId}\u0000`) && reviewId === review.id) {
          identities.delete(key);
        }
      }
      const snapshot = createReviewSnapshot(review);
      const targetKey = readReviewTargetKey(snapshot);
      if (targetKey) {
        identities.set(keyFor(userId, targetKey), review.id);
      }
    }),
    remove: jest.fn(async (userId, reviewId) => {
      for (const [key, candidateReviewId] of identities) {
        if (
          key.startsWith(`${userId}\u0000`) &&
          candidateReviewId === reviewId
        ) {
          identities.delete(key);
        }
      }
    }),
  };
  return { identities, repository };
}

function createReviewSnapshot(review: Review) {
  return review.movie ?? {
    mediaType: 'movie' as const,
    reviewTargetType: 'movie' as const,
    matchStatus: 'manual' as const,
    catalogId: null,
    title: review.movieTitle,
    releaseYear: null,
    genres: [],
    posterUrl: null,
  };
}

describe('offline review service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (randomUUID as jest.Mock)
      .mockReturnValueOnce('review-1')
      .mockReturnValueOnce('operation-1');
  });

  it('stores a review locally before attempting the remote write', async () => {
    const { operations, repository } = createMemoryRepository();
    const cache = createMemoryCache();
    const remoteService = createRemoteService();
    remoteService.save.mockImplementation(async (_userId, review) => {
      expect(operations[0].reviewId).toBe(review.id);
    });
    const reviewService = createOfflineReviewService(
      repository,
      cache.repository,
      remoteService
    );

    const review = await reviewService.create('user-1', {
      movieTitle: 'Arrival',
      reviewText: 'Excellent',
      rating: '5',
      visibility: 'followers',
    });

    expect(review.id).toBe('review-1');
    expect(remoteService.save).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ id: 'review-1' })
    );
    expect(review.syncStatus).toBe('synced');
    expect(operations).toHaveLength(0);
  });

  it('returns a failed local review when the network write fails', async () => {
    const { operations, repository } = createMemoryRepository();
    const cache = createMemoryCache();
    const remoteService = createRemoteService();
    remoteService.save.mockRejectedValue(new Error('Network unavailable'));
    const reviewService = createOfflineReviewService(
      repository,
      cache.repository,
      remoteService
    );

    const review = await reviewService.create('user-1', {
      movieTitle: 'Arrival',
      reviewText: 'Excellent',
      rating: '5',
      visibility: 'private',
    });

    expect(review.syncStatus).toBe('failed');
    expect(operations).toHaveLength(1);
    expect(operations[0].lastError).toBe('Network unavailable');
  });

  it('queues an edit using the existing review ID', async () => {
    const { operations, repository } = createMemoryRepository();
    const cache = createMemoryCache();
    const remoteService = createRemoteService();
    remoteService.save.mockRejectedValue(new Error('Network unavailable'));
    const reviewService = createOfflineReviewService(
      repository,
      cache.repository,
      remoteService
    );

    const updatedReview = await reviewService.update('user-1', {
      id: 'existing-review',
      movieTitle: 'Arrival',
      reviewText: 'Updated while offline',
      rating: '4',
      visibility: 'public',
      createdAt: '2026-07-18T12:00:00.000Z',
      syncStatus: 'synced',
    });

    expect(updatedReview.id).toBe('existing-review');
    expect(updatedReview.syncStatus).toBe('failed');
    expect(operations[0].reviewId).toBe('existing-review');
    expect(operations[0].payload?.reviewText).toBe('Updated while offline');
  });

  it('saves an offline edit immediately without waiting for Firebase', async () => {
    const { operations, repository } = createMemoryRepository();
    const cache = createMemoryCache();
    const remoteService = createRemoteService();
    const reviewService = createOfflineReviewService(
      repository,
      cache.repository,
      remoteService,
      { isOnline: jest.fn().mockResolvedValue(false) }
    );

    const updatedReview = await reviewService.update('user-1', {
      id: 'existing-review',
      movieTitle: 'Arrival',
      reviewText: 'Saved locally while offline',
      rating: '5',
      visibility: 'private',
      createdAt: '2026-07-18T12:00:00.000Z',
      syncStatus: 'synced',
    });

    expect(remoteService.save).not.toHaveBeenCalled();
    expect(updatedReview.syncStatus).toBe('pending');
    expect(operations).toHaveLength(1);
    expect(cache.getCachedReviews()[0].reviewText).toBe(
      'Saved locally while offline'
    );
  });

  it('loads cached reviews without contacting Firebase while offline', async () => {
    const { repository } = createMemoryRepository();
    const cachedReview: Review = {
      id: 'cached-review',
      movieTitle: 'Arrival',
      reviewText: 'Available offline',
      rating: '5',
      visibility: 'private',
      createdAt: '2026-07-18T12:00:00.000Z',
      syncStatus: 'synced',
    };
    const cache = createMemoryCache([cachedReview]);
    const remoteService = createRemoteService();
    const reviewService = createOfflineReviewService(
      repository,
      cache.repository,
      remoteService,
      { isOnline: jest.fn().mockResolvedValue(false) }
    );

    const result = await reviewService.listForUser('user-1');

    expect(remoteService.listForUser).not.toHaveBeenCalled();
    expect(result.remoteAvailable).toBe(false);
    expect(result.reviews).toEqual([cachedReview]);
  });

  it('finds a matching review that is still pending offline', async () => {
    const { repository } = createMemoryRepository();
    const cache = createMemoryCache();
    const remoteService = createRemoteService();
    const reviewService = createOfflineReviewService(
      repository,
      cache.repository,
      remoteService,
      { isOnline: jest.fn().mockResolvedValue(false) }
    );
    const media = {
      mediaType: 'movie' as const,
      reviewTargetType: 'movie' as const,
      catalogId: 'tmdb:movie:329865',
      title: 'Arrival',
      releaseYear: 2016,
      genres: ['Drama'],
      posterUrl: null,
    };

    const createdReview = await reviewService.create('user-1', {
      movieTitle: media.title,
      movie: createMatchedMediaSnapshot(media),
      reviewText: 'Excellent.',
      rating: '5',
      visibility: 'private',
    });
    const duplicate = await reviewService.findForMedia('user-1', media);

    expect(duplicate?.id).toBe(createdReview.id);
    expect(remoteService.listForUser).not.toHaveBeenCalled();
    await expect(
      reviewService.create('user-1', {
        movieTitle: media.title,
        movie: createMatchedMediaSnapshot(media),
        reviewText: 'A second review.',
        rating: '4',
        visibility: 'private',
      })
    ).rejects.toBeInstanceOf(DuplicateReviewError);
  });

  it('uses only the five newest synchronized reviews when offline', async () => {
    const { repository } = createMemoryRepository();
    const cache = createMemoryCache();
    const remoteService = createRemoteService();
    const remoteReviews: Review[] = Array.from({ length: 6 }, (_, index) => ({
      id: `review-${index + 1}`,
      movieTitle: `Movie ${index + 1}`,
      reviewText: 'Review',
      rating: '4',
      visibility: 'private',
      createdAt: `2026-07-${String(index + 10).padStart(2, '0')}T12:00:00.000Z`,
      syncStatus: 'synced',
    }));
    remoteService.listForUser
      .mockResolvedValueOnce(remoteReviews)
      .mockRejectedValueOnce(new Error('Network unavailable'));
    const reviewService = createOfflineReviewService(
      repository,
      cache.repository,
      remoteService
    );

    await reviewService.listForUser('user-1');
    const offlineResult = await reviewService.listForUser('user-1');

    expect(cache.getCachedReviews()).toHaveLength(5);
    expect(offlineResult.remoteAvailable).toBe(false);
    expect(offlineResult.reviews.map((review) => review.id)).toEqual([
      'review-6',
      'review-5',
      'review-4',
      'review-3',
      'review-2',
    ]);
  });

  it('remembers older review identities without caching their full content', async () => {
    const { repository } = createMemoryRepository();
    const cache = createMemoryCache();
    const identities = createMemoryIdentityRepository();
    const remoteService = createRemoteService();
    const mediaItems = Array.from({ length: 6 }, (_, index) => ({
      mediaType: 'movie' as const,
      reviewTargetType: 'movie' as const,
      catalogId: `tmdb:movie:${index + 1}`,
      title: `Movie ${index + 1}`,
      releaseYear: 2020 + index,
      genres: [],
      posterUrl: null,
    }));
    remoteService.listForUser.mockResolvedValue(
      mediaItems.map((media, index) => ({
        id: `review-${index + 1}`,
        movieTitle: media.title,
        movie: createMatchedMediaSnapshot(media),
        reviewText: `Review ${index + 1}`,
        rating: '4',
        visibility: 'private',
        createdAt: `2026-07-${String(index + 10).padStart(2, '0')}T12:00:00.000Z`,
        syncStatus: 'synced',
      }))
    );
    const connectivity = {
      isOnline: jest
        .fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValue(false),
    };
    const reviewService = createOfflineReviewService(
      repository,
      cache.repository,
      remoteService,
      connectivity,
      undefined,
      identities.repository
    );

    await reviewService.listForUser('user-1');

    expect(cache.getCachedReviews()).toHaveLength(5);
    await expect(
      reviewService.findForMedia('user-1', mediaItems[0])
    ).rejects.toMatchObject({
      existingReview: null,
      reviewId: 'review-1',
    });
  });
});
