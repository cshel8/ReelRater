import { createReviewSyncService } from '@/services/reviews/reviewSyncService';
import type { RemoteReviewService } from '@/services/contracts';
import type {
  PendingReviewOperation,
  PendingReviewRepository,
} from '@/services/local/pendingReviewTypes';

function createOperation(
  overrides: Partial<PendingReviewOperation> = {}
): PendingReviewOperation {
  return {
    operationId: 'operation-1',
    reviewId: 'review-1',
    userId: 'user-1',
    operationType: 'create',
    payload: {
      id: 'review-1',
      movieTitle: 'Arrival',
      reviewText: 'Excellent',
      rating: '5',
      visibility: 'followers',
      createdAt: '2026-07-17T12:00:00.000Z',
      syncStatus: 'pending',
    },
    status: 'pending',
    attemptCount: 0,
    createdAt: '2026-07-17T12:00:00.000Z',
    lastAttemptAt: null,
    lastError: null,
    ...overrides,
  };
}

function createRepository(initial: PendingReviewOperation[]) {
  const operations = [...initial];

  const repository: PendingReviewRepository = {
    enqueueCreate: jest.fn(),
    replaceWithDelete: jest.fn(),
    listForUser: jest.fn(async (userId) =>
      operations.filter((operation) => operation.userId === userId)
    ),
    markAttempting: jest.fn(async (operationId) => {
      const operation = operations.find(
        (candidate) => candidate.operationId === operationId
      );
      if (operation) {
        operation.status = 'pending';
        operation.attemptCount += 1;
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
    listForUser: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };
}

describe('review synchronization', () => {
  it('removes an operation only after Firebase confirms the write', async () => {
    const operation = createOperation();
    const { operations, repository } = createRepository([operation]);
    const remoteService = createRemoteService();
    const syncService = createReviewSyncService(repository, remoteService);

    const result = await syncService.sync('user-1');

    expect(remoteService.save).toHaveBeenCalledWith(
      'user-1',
      operation.payload
    );
    expect(repository.remove).toHaveBeenCalledWith('operation-1');
    expect(operations).toHaveLength(0);
    expect(result).toEqual({
      syncedCount: 1,
      failedCount: 0,
      pendingCount: 0,
    });
  });

  it('keeps a failed operation locally so it can be retried', async () => {
    const operation = createOperation();
    const { operations, repository } = createRepository([operation]);
    const remoteService = createRemoteService();
    remoteService.save.mockRejectedValueOnce(new Error('Network unavailable'));
    const syncService = createReviewSyncService(repository, remoteService);

    const result = await syncService.sync('user-1');

    expect(operations).toHaveLength(1);
    expect(operations[0].status).toBe('failed');
    expect(operations[0].lastError).toBe('Network unavailable');
    expect(result).toEqual({
      syncedCount: 0,
      failedCount: 1,
      pendingCount: 1,
    });
  });

  it('retries a delete safely and clears it after success', async () => {
    const operation = createOperation({
      operationType: 'delete',
      payload: null,
    });
    const { operations, repository } = createRepository([operation]);
    const remoteService = createRemoteService();
    remoteService.remove
      .mockRejectedValueOnce(new Error('Network unavailable'))
      .mockResolvedValueOnce(undefined);
    const syncService = createReviewSyncService(repository, remoteService);

    await syncService.sync('user-1');
    const result = await syncService.sync('user-1');

    expect(remoteService.remove).toHaveBeenCalledTimes(2);
    expect(remoteService.remove).toHaveBeenLastCalledWith(
      'user-1',
      'review-1'
    );
    expect(operations).toHaveLength(0);
    expect(result.pendingCount).toBe(0);
  });
});
