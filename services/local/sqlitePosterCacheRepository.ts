import {
  getSQLiteDatabase,
  runSQLiteTransaction,
  runSQLiteWrite,
} from '@/database/sqliteDatabase';
import type {
  PosterCacheEntry,
  PosterCacheMetadataRepository,
} from '@/services/local/posterCacheTypes';

type PosterCacheRow = {
  catalog_id: string;
  source_url: string;
  local_uri: string;
  catalog_fetched_at: string;
  refresh_after: string;
  expires_at: string;
  last_accessed_at: string;
};

const toEntry = (row: PosterCacheRow): PosterCacheEntry => ({
  catalogId: row.catalog_id,
  sourceUrl: row.source_url,
  localUri: row.local_uri,
  catalogDataRetention: {
    fetchedAt: row.catalog_fetched_at,
    refreshAfter: row.refresh_after,
    expiresAt: row.expires_at,
  },
  lastAccessedAt: row.last_accessed_at,
});

export const sqlitePosterCacheRepository: PosterCacheMetadataRepository = {
  async get(catalogId) {
    const database = await getSQLiteDatabase();
    const row = await database.getFirstAsync<PosterCacheRow>(
      `SELECT catalog_id, source_url, local_uri, catalog_fetched_at,
              refresh_after, expires_at, last_accessed_at
       FROM cached_poster_files
       WHERE catalog_id = ?`,
      catalogId
    );
    return row ? toEntry(row) : null;
  },

  async saveAndPrune(entry, maximumEntries) {
    let evictedUris: string[] = [];

    await runSQLiteTransaction(async (transaction) => {
      await transaction.runAsync(
        `INSERT INTO cached_poster_files (
          catalog_id,
          source_url,
          local_uri,
          catalog_fetched_at,
          refresh_after,
          expires_at,
          last_accessed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(catalog_id) DO UPDATE SET
          source_url = excluded.source_url,
          local_uri = excluded.local_uri,
          catalog_fetched_at = excluded.catalog_fetched_at,
          refresh_after = excluded.refresh_after,
          expires_at = excluded.expires_at,
          last_accessed_at = excluded.last_accessed_at`,
        entry.catalogId,
        entry.sourceUrl,
        entry.localUri,
        entry.catalogDataRetention.fetchedAt,
        entry.catalogDataRetention.refreshAfter,
        entry.catalogDataRetention.expiresAt,
        entry.lastAccessedAt
      );

      const evicted = await transaction.getAllAsync<{ local_uri: string }>(
        `SELECT local_uri
         FROM cached_poster_files
         WHERE catalog_id NOT IN (
           SELECT catalog_id
           FROM cached_poster_files
           ORDER BY last_accessed_at DESC
           LIMIT ?
         )`,
        maximumEntries
      );
      evictedUris = evicted.map((row) => row.local_uri);

      await transaction.runAsync(
        `DELETE FROM cached_poster_files
         WHERE catalog_id NOT IN (
           SELECT catalog_id
           FROM cached_poster_files
           ORDER BY last_accessed_at DESC
           LIMIT ?
         )`,
        maximumEntries
      );
    });

    return evictedUris;
  },

  async remove(catalogId) {
    let localUri: string | null = null;
    await runSQLiteTransaction(async (transaction) => {
      const row = await transaction.getFirstAsync<{ local_uri: string }>(
        `SELECT local_uri FROM cached_poster_files WHERE catalog_id = ?`,
        catalogId
      );
      localUri = row?.local_uri ?? null;
      await transaction.runAsync(
        `DELETE FROM cached_poster_files WHERE catalog_id = ?`,
        catalogId
      );
    });
    return localUri;
  },

  async takeExpired(expiredAt) {
    let expiredUris: string[] = [];
    await runSQLiteTransaction(async (transaction) => {
      const rows = await transaction.getAllAsync<{ local_uri: string }>(
        `SELECT local_uri
         FROM cached_poster_files
         WHERE expires_at <= ?`,
        expiredAt
      );
      expiredUris = rows.map((row) => row.local_uri);
      await transaction.runAsync(
        `DELETE FROM cached_poster_files WHERE expires_at <= ?`,
        expiredAt
      );
    });
    return expiredUris;
  },

  async markAccessed(catalogId, accessedAt) {
    await runSQLiteWrite((database) =>
      database.runAsync(
        `UPDATE cached_poster_files
         SET last_accessed_at = ?
         WHERE catalog_id = ?`,
        accessedAt,
        catalogId
      )
    );
  },

  async listLocalUris() {
    const database = await getSQLiteDatabase();
    const rows = await database.getAllAsync<{ local_uri: string }>(
      `SELECT local_uri FROM cached_poster_files`
    );
    return rows.map((row) => row.local_uri);
  },

  async clear() {
    let rows: { local_uri: string }[] = [];
    await runSQLiteTransaction(async (transaction) => {
      rows = await transaction.getAllAsync<{ local_uri: string }>(
        `SELECT local_uri FROM cached_poster_files`
      );
      await transaction.runAsync('DELETE FROM cached_poster_files');
    });
    return rows.map((row) => row.local_uri);
  },
};
