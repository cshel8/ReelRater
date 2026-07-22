import { runSQLiteTransaction } from '@/database/sqliteDatabase';

export const accountLocalDataService = {
  async removeForUser(userId: string): Promise<void> {
    await runSQLiteTransaction(async (transaction) => {
      await transaction.runAsync(
        'DELETE FROM pending_review_operations WHERE user_id = ?',
        userId
      );
      await transaction.runAsync(
        'DELETE FROM cached_reviews WHERE user_id = ?',
        userId
      );
    });
  },
};
