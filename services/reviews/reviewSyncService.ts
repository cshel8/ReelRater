import type {
  RemoteReviewService,
  ReviewSyncResult,
} from '@/services/contracts';
import type { PendingReviewRepository } from '@/services/local/pendingReviewTypes';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown synchronization error';
}

export interface ReviewSyncService {
  sync(userId: string): Promise<ReviewSyncResult>;
}

export function createReviewSyncService(
  repository: PendingReviewRepository,
  remoteService: RemoteReviewService
): ReviewSyncService {
  const activeSyncs = new Map<
    string,
    {
      promise: Promise<ReviewSyncResult>;
      rerunRequested: boolean;
    }
  >();

  const runSync = async (userId: string): Promise<ReviewSyncResult> => {
    const operations = await repository.listForUser(userId);
    let syncedCount = 0;
    let failedCount = 0;

    for (const operation of operations) {
      await repository.markAttempting(operation.operationId);

      try {
        if (operation.operationType === 'create') {
          if (!operation.payload) {
            throw new Error('The queued review data is missing');
          }

          await remoteService.save(userId, operation.payload);
        } else {
          await remoteService.remove(userId, operation.reviewId);
        }

        await repository.remove(operation.operationId);
        syncedCount += 1;
      } catch (error) {
        await repository.markFailed(
          operation.operationId,
          getErrorMessage(error)
        );
        failedCount += 1;
      }
    }

    return {
      syncedCount,
      failedCount,
      pendingCount: await repository.countForUser(userId),
    };
  };

  return {
    sync(userId) {
      const existingSync = activeSyncs.get(userId);
      if (existingSync) {
        existingSync.rerunRequested = true;
        return existingSync.promise;
      }

      const state = {
        promise: Promise.resolve({
          syncedCount: 0,
          failedCount: 0,
          pendingCount: 0,
        }),
        rerunRequested: false,
      };

      state.promise = (async () => {
        let result: ReviewSyncResult;

        do {
          state.rerunRequested = false;
          result = await runSync(userId);
        } while (state.rerunRequested);

        return result;
      })().finally(() => {
        if (activeSyncs.get(userId) === state) {
          activeSyncs.delete(userId);
        }
      });

      activeSyncs.set(userId, state);
      return state.promise;
    },
  };
}
