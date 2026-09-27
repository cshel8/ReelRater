import {
  getSQLiteDatabase,
  runSQLiteTransaction,
  runSQLiteWrite,
} from '@/database/sqliteDatabase';
import type { CachedReviewRepository } from '@/services/local/cachedReviewTypes';
import type { Review } from '@/types/domain';
import { readReviewMovieSnapshot } from '@/utils/reviewMovie';

const MAX_CACHED_REVIEWS = 5;

interface CachedReviewRow {
  review_id: string;
  movie_title: string;
  movie_json: string | null;
  review_text: string;
  rating: number;
  spoiler_warning: number;
  visibility: string;
  created_at: string;
}

function toReview(row: CachedReviewRow): Review | null {
  if (
    !Number.isInteger(row.rating) ||
    row.rating < 1 ||
    row.rating > 5
  ) {
    return null;
  }

  let parsedMovie: unknown = null;
  if (row.movie_json) {
    try {
      parsedMovie = JSON.parse(row.movie_json) as unknown;
    } catch {
      parsedMovie = null;
    }
  }

  return {
    id: row.review_id,
    movieTitle: row.movie_title,
    movie: readReviewMovieSnapshot(parsedMovie, row.movie_title),
    reviewText: row.review_text,
    rating: row.rating,
    spoilerWarning: row.spoiler_warning === 1,
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
      `SELECT review_id, movie_title, movie_json, review_text, rating, spoiler_warning, visibility, created_at
       FROM cached_reviews
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      userId,
      MAX_CACHED_REVIEWS
    );

    return rows.flatMap((row) => {
      const review = toReview(row);
      return review ? [review] : [];
    });
  },

  async replaceForUser(userId, reviews) {
    const reviewsToCache = [...reviews]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, MAX_CACHED_REVIEWS);

    await runSQLiteTransaction(async (transaction) => {
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
            movie_json,
            review_text,
            rating,
            spoiler_warning,
            visibility,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          review.id,
          userId,
          review.movieTitle,
          JSON.stringify(
            readReviewMovieSnapshot(review.movie, review.movieTitle)
          ),
          review.reviewText,
          review.rating,
          review.spoilerWarning ? 1 : 0,
          review.visibility,
          review.createdAt
        );
      }
    });
  },

  async save(userId, review) {
    await runSQLiteTransaction(async (transaction) => {
      await transaction.runAsync(
        `INSERT OR REPLACE INTO cached_reviews (
          review_id,
          user_id,
          movie_title,
          movie_json,
          review_text,
          rating,
          spoiler_warning,
          visibility,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        review.id,
        userId,
        review.movieTitle,
        JSON.stringify(readReviewMovieSnapshot(review.movie, review.movieTitle)),
        review.reviewText,
        review.rating,
        review.spoilerWarning ? 1 : 0,
        review.visibility,
        review.createdAt
      );
      await transaction.runAsync(
        `DELETE FROM cached_reviews
         WHERE user_id = ?
           AND review_id NOT IN (
             SELECT review_id FROM cached_reviews
             WHERE user_id = ?
             ORDER BY created_at DESC
             LIMIT ?
           )`,
        userId,
        userId,
        MAX_CACHED_REVIEWS
      );
    });
  },

  async remove(userId, reviewId) {
    await runSQLiteWrite((database) =>
      database.runAsync(
        `DELETE FROM cached_reviews
         WHERE user_id = ? AND review_id = ?`,
        userId,
        reviewId
      )
    );
  },
};
