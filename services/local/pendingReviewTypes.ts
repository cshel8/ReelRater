import type { Review } from '@/types/domain';

export type PendingReviewOperationType = 'create' | 'delete';
export type PendingReviewOperationStatus = 'pending' | 'failed';

export interface PendingReviewOperation {
  operationId: string;
  reviewId: string;
  userId: string;
  operationType: PendingReviewOperationType;
  payload: Review | null;
  status: PendingReviewOperationStatus;
  attemptCount: number;
  createdAt: string;
  lastAttemptAt: string | null;
  lastError: string | null;
}

export interface PendingReviewRepository {
  enqueueCreate(operation: PendingReviewOperation): Promise<void>;
  replaceWithDelete(operation: PendingReviewOperation): Promise<void>;
  listForUser(userId: string): Promise<PendingReviewOperation[]>;
  markAttempting(operationId: string): Promise<void>;
  markFailed(operationId: string, message: string): Promise<void>;
  remove(operationId: string): Promise<void>;
  countForUser(userId: string): Promise<number>;
}
