import { getSQLiteDatabase } from '@/database/sqliteDatabase';
import type {
  PendingReviewOperation,
  PendingReviewRepository,
} from '@/services/local/pendingReviewTypes';

interface PendingReviewRow {
  operation_id: string;
  review_id: string;
  user_id: string;
  operation_type: 'create' | 'delete';
  payload_json: string | null;
  status: 'pending' | 'failed';
  attempt_count: number;
  created_at: string;
  last_attempt_at: string | null;
  last_error: string | null;
}

function toOperation(row: PendingReviewRow): PendingReviewOperation {
  const parsedPayload = row.payload_json
    ? (JSON.parse(row.payload_json) as PendingReviewOperation['payload'])
    : null;

  return {
    operationId: row.operation_id,
    reviewId: row.review_id,
    userId: row.user_id,
    operationType: row.operation_type,
    payload: parsedPayload
      ? {
          ...parsedPayload,
          visibility: parsedPayload.visibility ?? 'private',
        }
      : null,
    status: row.status,
    attemptCount: row.attempt_count,
    createdAt: row.created_at,
    lastAttemptAt: row.last_attempt_at,
    lastError: row.last_error,
  };
}

async function insertOperation(
  database: Awaited<ReturnType<typeof getSQLiteDatabase>>,
  operation: PendingReviewOperation
): Promise<void> {
  await database.runAsync(
    `INSERT INTO pending_review_operations (
      operation_id,
      review_id,
      user_id,
      operation_type,
      payload_json,
      status,
      attempt_count,
      created_at,
      last_attempt_at,
      last_error
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    operation.operationId,
    operation.reviewId,
    operation.userId,
    operation.operationType,
    operation.payload ? JSON.stringify(operation.payload) : null,
    operation.status,
    operation.attemptCount,
    operation.createdAt,
    operation.lastAttemptAt,
    operation.lastError
  );
}

export const sqlitePendingReviewRepository: PendingReviewRepository = {
  async enqueueCreate(operation) {
    const database = await getSQLiteDatabase();

    await database.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.runAsync(
        `DELETE FROM pending_review_operations
         WHERE user_id = ? AND review_id = ?`,
        operation.userId,
        operation.reviewId
      );
      await insertOperation(transaction, operation);
    });
  },

  async replaceWithDelete(operation) {
    const database = await getSQLiteDatabase();

    await database.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.runAsync(
        `DELETE FROM pending_review_operations
         WHERE user_id = ? AND review_id = ?`,
        operation.userId,
        operation.reviewId
      );
      await insertOperation(transaction, operation);
    });
  },

  async listForUser(userId) {
    const database = await getSQLiteDatabase();
    const rows = await database.getAllAsync<PendingReviewRow>(
      `SELECT * FROM pending_review_operations
       WHERE user_id = ?
       ORDER BY created_at ASC`,
      userId
    );

    return rows.map(toOperation);
  },

  async markAttempting(operationId) {
    const database = await getSQLiteDatabase();
    await database.runAsync(
      `UPDATE pending_review_operations
       SET status = 'pending',
           attempt_count = attempt_count + 1,
           last_attempt_at = ?,
           last_error = NULL
       WHERE operation_id = ?`,
      new Date().toISOString(),
      operationId
    );
  },

  async markFailed(operationId, message) {
    const database = await getSQLiteDatabase();
    await database.runAsync(
      `UPDATE pending_review_operations
       SET status = 'failed',
           last_attempt_at = ?,
           last_error = ?
       WHERE operation_id = ?`,
      new Date().toISOString(),
      message,
      operationId
    );
  },

  async remove(operationId) {
    const database = await getSQLiteDatabase();
    await database.runAsync(
      'DELETE FROM pending_review_operations WHERE operation_id = ?',
      operationId
    );
  },

  async countForUser(userId) {
    const database = await getSQLiteDatabase();
    const row = await database.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) AS count
       FROM pending_review_operations
       WHERE user_id = ?`,
      userId
    );

    return row?.count ?? 0;
  },
};
