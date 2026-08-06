import {
  getSQLiteDatabase,
  runSQLiteTransaction,
  runSQLiteWrite,
} from '@/database/sqliteDatabase';
import type { MovieCacheRepository } from '@/services/local/movieCacheTypes';
import {
  defaultMovieCachePolicy,
  type MovieCachePolicy,
} from '@/services/movies/movieCachePolicy';
import type { MediaCatalogId, MediaSummary } from '@/types/domain';

const MAX_CACHED_MOVIES = 200;
const DEFAULT_SEARCH_RESULTS = 20;
const MAX_SEARCH_RESULTS = 50;
const DEFAULT_REFRESH_RESULTS = 10;
const MAX_REFRESH_RESULTS = 25;

interface CachedMovieRow {
  catalog_id: string;
  media_type: string;
  review_target_type: string;
  title: string;
  release_year: number | null;
  genres_json: string;
  poster_url: string | null;
  cached_at: string;
  refresh_after: string;
  expires_at: string;
}

export const normalizeMovieTitle = (title: string) =>
  title.trim().toLocaleLowerCase('en-US');

export const escapeMovieLikePattern = (value: string) =>
  value.replace(/[\\%_]/g, (character) => `\\${character}`);

const parseGenres = (value: string) => {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((genre): genre is string => typeof genre === 'string')
      : [];
  } catch {
    return [];
  }
};

const toMedia = (row: CachedMovieRow): MediaSummary => ({
  ...(row.media_type === 'tv' && row.review_target_type === 'series'
    ? ({ mediaType: 'tv', reviewTargetType: 'series' } as const)
    : ({ mediaType: 'movie', reviewTargetType: 'movie' } as const)),
  catalogId: row.catalog_id,
  title: row.title,
  releaseYear: row.release_year,
  genres: parseGenres(row.genres_json),
  posterUrl: row.poster_url,
  catalogDataRetention: {
    fetchedAt: row.cached_at,
    refreshAfter: row.refresh_after,
    expiresAt: row.expires_at,
  },
});

const normalizedLimit = (
  value: number | undefined,
  defaultValue: number,
  maximumValue: number
) => {
  const requestedLimit = Number.isFinite(value)
    ? Math.floor(value as number)
    : defaultValue;
  return Math.min(maximumValue, Math.max(1, requestedLimit));
};

export const createSQLiteMovieCacheRepository = ({
  clock = () => new Date(),
  policy = defaultMovieCachePolicy,
}: {
  clock?: () => Date;
  policy?: MovieCachePolicy;
} = {}): MovieCacheRepository => ({
  async cache(items) {
    if (items.length === 0) {
      return;
    }

    const window = policy.createWindow(clock());

    await runSQLiteTransaction(async (transaction) => {
      for (const media of items) {
        await transaction.runAsync(
          `INSERT INTO cached_movies (
            catalog_id,
            media_type,
            review_target_type,
            title,
            normalized_title,
            release_year,
            genres_json,
            poster_url,
            cached_at,
            last_accessed_at,
            refresh_after,
            expires_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(catalog_id) DO UPDATE SET
            media_type = excluded.media_type,
            review_target_type = excluded.review_target_type,
            title = excluded.title,
            normalized_title = excluded.normalized_title,
            release_year = excluded.release_year,
            genres_json = excluded.genres_json,
            poster_url = excluded.poster_url,
            cached_at = excluded.cached_at,
            last_accessed_at = excluded.last_accessed_at,
            refresh_after = excluded.refresh_after,
            expires_at = excluded.expires_at`,
          media.catalogId,
          media.mediaType,
          media.reviewTargetType,
          media.title,
          normalizeMovieTitle(media.title),
          media.releaseYear,
          JSON.stringify(media.genres),
          media.posterUrl,
          window.fetchedAt,
          window.fetchedAt,
          window.refreshAfter,
          window.expiresAt
        );
      }

      await transaction.runAsync(
        `DELETE FROM cached_movies
         WHERE expires_at IS NULL OR expires_at <= ?`,
        window.fetchedAt
      );

      await transaction.runAsync(
        `DELETE FROM cached_movies
         WHERE catalog_id NOT IN (
           SELECT catalog_id
           FROM cached_movies
           ORDER BY last_accessed_at DESC
           LIMIT ?
         )`,
        MAX_CACHED_MOVIES
      );
    });
  },

  async search(query, options = {}) {
    const normalizedQuery = normalizeMovieTitle(query);
    if (!normalizedQuery) {
      return [];
    }

    const database = await getSQLiteDatabase();
    const now = clock().toISOString();
    await runSQLiteWrite((writeDatabase) =>
      writeDatabase.runAsync(
        `DELETE FROM cached_movies
         WHERE expires_at IS NULL OR expires_at <= ?`,
        now
      )
    );
    const escapedQuery = escapeMovieLikePattern(normalizedQuery);
    const limit = normalizedLimit(
      options.maximumResults,
      DEFAULT_SEARCH_RESULTS,
      MAX_SEARCH_RESULTS
    );
    const rows = await database.getAllAsync<CachedMovieRow>(
      `SELECT catalog_id, media_type, review_target_type, title,
              release_year, genres_json, poster_url,
              cached_at, refresh_after, expires_at
       FROM cached_movies
       WHERE expires_at > ?
         AND (? IS NULL OR media_type = ?)
         AND normalized_title LIKE ? ESCAPE '\\'
       ORDER BY
         CASE
           WHEN normalized_title = ? THEN 0
           WHEN normalized_title LIKE ? ESCAPE '\\' THEN 1
           ELSE 2
         END,
         last_accessed_at DESC
       LIMIT ?`,
      now,
      options.mediaType ?? null,
      options.mediaType ?? null,
      `%${escapedQuery}%`,
      normalizedQuery,
      `${escapedQuery}%`,
      limit
    );

    return rows.map(toMedia);
  },

  async getById(catalogId) {
    const database = await getSQLiteDatabase();
    const now = clock().toISOString();
    await runSQLiteWrite((writeDatabase) =>
      writeDatabase.runAsync(
        `DELETE FROM cached_movies
         WHERE expires_at IS NULL OR expires_at <= ?`,
        now
      )
    );
    const row = await database.getFirstAsync<CachedMovieRow>(
      `SELECT catalog_id, media_type, review_target_type, title,
              release_year, genres_json, poster_url,
              cached_at, refresh_after, expires_at
       FROM cached_movies
       WHERE catalog_id = ?
         AND expires_at > ?`,
      catalogId,
      now
    );

    return row ? toMedia(row) : null;
  },

  async listDueForRefresh(maximumResults = DEFAULT_REFRESH_RESULTS) {
    const database = await getSQLiteDatabase();
    const now = clock().toISOString();
    await runSQLiteWrite((writeDatabase) =>
      writeDatabase.runAsync(
        `DELETE FROM cached_movies
         WHERE expires_at IS NULL OR expires_at <= ?`,
        now
      )
    );
    const limit = normalizedLimit(
      maximumResults,
      DEFAULT_REFRESH_RESULTS,
      MAX_REFRESH_RESULTS
    );
    const rows = await database.getAllAsync<{ catalog_id: MediaCatalogId }>(
      `SELECT catalog_id
       FROM cached_movies
       WHERE refresh_after IS NOT NULL
         AND refresh_after <= ?
         AND expires_at > ?
       ORDER BY refresh_after ASC
       LIMIT ?`,
      now,
      now,
      limit
    );

    return rows.map((row) => row.catalog_id);
  },

  async purgeExpired() {
    await runSQLiteWrite((database) =>
      database.runAsync(
        `DELETE FROM cached_movies
         WHERE expires_at IS NULL OR expires_at <= ?`,
        clock().toISOString()
      )
    );
  },

  async markAccessed(catalogId) {
    await runSQLiteWrite((database) =>
      database.runAsync(
        `UPDATE cached_movies
         SET last_accessed_at = ?
         WHERE catalog_id = ?`,
        clock().toISOString(),
        catalogId
      )
    );
  },

  async clear() {
    await runSQLiteWrite((database) =>
      database.runAsync('DELETE FROM cached_movies')
    );
  },
});

export const sqliteMovieCacheRepository =
  createSQLiteMovieCacheRepository();
