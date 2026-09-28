import { runSQLiteTransaction } from '@/database/sqliteDatabase';
import { beginCommunitySessionForUser } from '@/services/community/communitySessionState';
import { asyncStorageCommunityPreferenceRepository } from '@/services/local/asyncStorageCommunityPreferenceRepository';

export const accountLocalDataService = {
  async removeForUser(userId: string): Promise<void> {
    const cleanupResults = await Promise.allSettled([
      runSQLiteTransaction(async (transaction) => {
        await transaction.runAsync(
          'DELETE FROM pending_review_operations WHERE user_id = ?',
          userId
        );
        await transaction.runAsync(
          'DELETE FROM cached_reviews WHERE user_id = ?',
          userId
        );
        await transaction.runAsync(
          'DELETE FROM review_target_identities WHERE user_id = ?',
          userId
        );
        await transaction.runAsync(
          'DELETE FROM community_cached_feed_entries WHERE viewer_uid = ?',
          userId
        );
        await transaction.runAsync(
          'DELETE FROM community_cached_reviews WHERE viewer_uid = ?',
          userId
        );
      }),
      asyncStorageCommunityPreferenceRepository.removeForUser(userId),
    ]);
    beginCommunitySessionForUser(null);

    const failedCleanup = cleanupResults.find(
      (result) => result.status === 'rejected'
    );
    if (failedCleanup?.status === 'rejected') {
      throw failedCleanup.reason;
    }
  },
};
