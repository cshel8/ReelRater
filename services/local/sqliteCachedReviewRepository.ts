import { getSQLiteDatabase } from '@/database/sqliteDatabase';
import type { CachedReviewRepository } from '@/services/local/cachedReviewTypes';
import type { Review } from '@/types/domain';

const MAX_CACHED_REVIEWS = 5;

interface CachedReviewRow {
  review_id: string;
  movie_title: string;
  review_text: string;
  rating: string;
  visibility: string;
  created_at: string;
}

function toReview(row: CachedReviewRow): Review {
  return {
    id: row.review_id,
    movieTitle: row.movie_title,
    reviewText: row.review_text,
    rating: row.rating,
    visibility:
      row.visibility === 'public' || row.visibility === 'followers'
        ? row.visibility
        : 'private',
    createdAt: row.created_at,
    syncStatus: 'synced',
  };
}

export const sqliteCachedReviewRepository: CachedReviewRepository = {
  async listForUser(userId) {
    const database = await getSQLiteDatabase();
    const rows = await database.getAllAsync<CachedReviewRow>(
      `SELECT review_id, movie_title, review_text, rating, visibility, created_at
       FROM cached_reviews
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      userId,
      MAX_CACHED_REVIEWS
    );

    return rows.map(toReview);
  },

  async replaceForUser(userId, reviews) {
    const database = await getSQLiteDatabase();
    const reviewsToCache = [...reviews]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, MAX_CACHED_REVIEWS);

    await database.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.runAsync(
        'DELETE FROM cached_reviews WHERE user_id = ?',
        userId
      );

      for (const review of reviewsToCache) {
        await transaction.runAsync(
          `INSERT INTO cached_reviews (
            review_id,
            user_id,
            movie_title,
            review_text,
            rating,
            visibility,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          review.id,
          userId,
          review.movieTitle,
          review.reviewText,
          review.rating,
          review.visibility,
          review.createdAt
        );
      }
    });
  },

  async remove(userId, reviewId) {
    const database = await getSQLiteDatabase();
    await database.runAsync(
      `DELETE FROM cached_reviews
       WHERE user_id = ? AND review_id = ?`,
      userId,
      reviewId
    );
  },
};
