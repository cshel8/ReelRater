import {
  getSQLiteDatabase,
  runSQLiteTransaction,
  runSQLiteWrite,
} from '@/database/sqliteDatabase';
import type {
  HomeImageCacheEntry,
  HomeImageCacheMetadataRepository,
} from '@/services/local/homeImageCacheTypes';

type HomeImageCacheRow = {
  source_url: string;
  catalog_id: string;
  local_uri: string;
  last_accessed_at: string;
};

const toEntry = (row: HomeImageCacheRow): HomeImageCacheEntry => ({
  sourceUrl: row.source_url,
  catalogId: row.catalog_id,
  localUri: row.local_uri,
  lastAccessedAt: row.last_accessed_at,
});

export const sqliteHomeImageCacheRepository: HomeImageCacheMetadataRepository = {
  async get(sourceUrl) {
    const database = await getSQLiteDatabase();
    const row = await database.getFirstAsync<HomeImageCacheRow>(
      `SELECT source_url, catalog_id, local_uri, last_accessed_at
       FROM cached_home_images
       WHERE source_url = ?`,
      sourceUrl
    );
    return row ? toEntry(row) : null;
  },

  async saveAndPrune(entry, maximumEntries) {
    let evictedUris: string[] = [];

    await runSQLiteTransaction(async (transaction) => {
      await transaction.runAsync(
        `INSERT INTO cached_home_images (
          source_url,
          catalog_id,
          local_uri,
          last_accessed_at
        ) VALUES (?, ?, ?, ?)
        ON CONFLICT(source_url) DO UPDATE SET
          catalog_id = excluded.catalog_id,
          local_uri = excluded.local_uri,
          last_accessed_at = excluded.last_accessed_at`,
        entry.sourceUrl,
        entry.catalogId,
        entry.localUri,
        entry.lastAccessedAt
      );

      const evicted = await transaction.getAllAsync<{ local_uri: string }>(
        `SELECT local_uri
         FROM cached_home_images
         WHERE source_url NOT IN (
           SELECT source_url
           FROM cached_home_images
           ORDER BY last_accessed_at DESC
           LIMIT ?
         )`,
        maximumEntries
      );
      evictedUris = evicted.map((row) => row.local_uri);

      await transaction.runAsync(
        `DELETE FROM cached_home_images
         WHERE source_url NOT IN (
           SELECT source_url
           FROM cached_home_images
           ORDER BY last_accessed_at DESC
           LIMIT ?
         )`,
        maximumEntries
      );
    });

    return evictedUris;
  },

  async remove(sourceUrl) {
    let localUri: string | null = null;
    await runSQLiteTransaction(async (transaction) => {
      const row = await transaction.getFirstAsync<{ local_uri: string }>(
        `SELECT local_uri FROM cached_home_images WHERE source_url = ?`,
        sourceUrl
      );
      localUri = row?.local_uri ?? null;
      await transaction.runAsync(
        `DELETE FROM cached_home_images WHERE source_url = ?`,
        sourceUrl
      );
    });
    return localUri;
  },

  async takeStale(accessedBefore) {
    let staleUris: string[] = [];
    await runSQLiteTransaction(async (transaction) => {
      const rows = await transaction.getAllAsync<{ local_uri: string }>(
        `SELECT local_uri
         FROM cached_home_images
         WHERE last_accessed_at <= ?`,
        accessedBefore
      );
      staleUris = rows.map((row) => row.local_uri);
      await transaction.runAsync(
        `DELETE FROM cached_home_images WHERE last_accessed_at <= ?`,
        accessedBefore
      );
    });
    return staleUris;
  },

  async markAccessed(sourceUrl, accessedAt) {
    await runSQLiteWrite((database) =>
      database.runAsync(
        `UPDATE cached_home_images
         SET last_accessed_at = ?
         WHERE source_url = ?`,
        accessedAt,
        sourceUrl
      )
    );
  },

  async listLocalUris() {
    const database = await getSQLiteDatabase();
    const rows = await database.getAllAsync<{ local_uri: string }>(
      `SELECT local_uri FROM cached_home_images`
    );
    return rows.map((row) => row.local_uri);
  },

  async clear() {
    let rows: { local_uri: string }[] = [];
    await runSQLiteTransaction(async (transaction) => {
      rows = await transaction.getAllAsync<{ local_uri: string }>(
        `SELECT local_uri FROM cached_home_images`
      );
      await transaction.runAsync('DELETE FROM cached_home_images');
    });
    return rows.map((row) => row.local_uri);
  },
};
