import {
  getSQLiteDatabase,
  runSQLiteTransaction,
  runSQLiteWrite,
} from '@/database/sqliteDatabase';
import type { ReviewTargetIdentityRepository } from '@/services/local/reviewTargetIdentityTypes';
import type { Review } from '@/types/domain';
import { readReviewMovieSnapshot } from '@/utils/reviewMovie';
import { readReviewTargetKey } from '@/utils/reviewTargetIdentity';

const getIdentity = (review: Review) => {
  const snapshot = readReviewMovieSnapshot(review.movie, review.movieTitle);
  const targetKey = readReviewTargetKey(snapshot);
  return targetKey ? { reviewId: review.id, targetKey } : null;
};

export const sqliteReviewTargetIdentityRepository: ReviewTargetIdentityRepository = {
  async findReviewId(userId, targetKey) {
    const database = await getSQLiteDatabase();
    const row = await database.getFirstAsync<{ review_id: string }>(
      `SELECT review_id
       FROM review_target_identities
       WHERE user_id = ? AND target_key = ?`,
      userId,
      targetKey
    );
    return row?.review_id ?? null;
  },

  async replaceForUser(userId, reviews) {
    await runSQLiteTransaction(async (transaction) => {
      await transaction.runAsync(
        'DELETE FROM review_target_identities WHERE user_id = ?',
        userId
      );

      for (const review of reviews) {
        const identity = getIdentity(review);
        if (!identity) {
          continue;
        }
        // Legacy data may already contain duplicates. Retain the first review
        // from the newest-first remote list without deleting user content.
        await transaction.runAsync(
          `INSERT OR IGNORE INTO review_target_identities (
            user_id,
            target_key,
            review_id
          ) VALUES (?, ?, ?)`,
          userId,
          identity.targetKey,
          identity.reviewId
        );
      }
    });
  },

  async save(userId, review) {
    const identity = getIdentity(review);
    await runSQLiteTransaction(async (transaction) => {
      await transaction.runAsync(
        `DELETE FROM review_target_identities
         WHERE user_id = ? AND review_id = ?`,
        userId,
        review.id
      );
      if (identity) {
        await transaction.runAsync(
          `INSERT INTO review_target_identities (
            user_id,
            target_key,
            review_id
          ) VALUES (?, ?, ?)`,
          userId,
          identity.targetKey,
          identity.reviewId
        );
      }
    });
  },

  async remove(userId, reviewId) {
    await runSQLiteWrite((database) =>
      database.runAsync(
        `DELETE FROM review_target_identities
         WHERE user_id = ? AND review_id = ?`,
        userId,
        reviewId
      )
    );
  },
};
