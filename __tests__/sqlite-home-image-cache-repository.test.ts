import {
  getSQLiteDatabase,
  runSQLiteTransaction,
  runSQLiteWrite,
} from '@/database/sqliteDatabase';
import { sqliteHomeImageCacheRepository } from '@/services/local/sqliteHomeImageCacheRepository';

jest.mock('@/database/sqliteDatabase', () => ({
  getSQLiteDatabase: jest.fn(),
  runSQLiteTransaction: jest.fn(),
  runSQLiteWrite: jest.fn(),
}));

const runAsync = jest.fn();
const getAllAsync = jest.fn();
const getFirstAsync = jest.fn();
const database = { runAsync, getAllAsync, getFirstAsync };

describe('SQLite Home image cache repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getAllAsync.mockResolvedValue([]);
    getFirstAsync.mockResolvedValue(null);
    (getSQLiteDatabase as jest.Mock).mockResolvedValue(database);
    (runSQLiteTransaction as jest.Mock).mockImplementation(
      (operation) => operation(database)
    );
    (runSQLiteWrite as jest.Mock).mockImplementation(
      (operation) => operation(database)
    );
  });

  it('reads entries by source URL', async () => {
    getFirstAsync.mockResolvedValue({
      source_url: 'https://image.example/w780/dune2-wide.jpg',
      catalog_id: 'tmdb:movie:693134',
      local_uri: 'file://cache/reelrater-home-images/dune2.jpg',
      last_accessed_at: '2026-10-18T12:00:00.000Z',
    });

    await expect(
      sqliteHomeImageCacheRepository.get(
        'https://image.example/w780/dune2-wide.jpg'
      )
    ).resolves.toEqual({
      sourceUrl: 'https://image.example/w780/dune2-wide.jpg',
      catalogId: 'tmdb:movie:693134',
      localUri: 'file://cache/reelrater-home-images/dune2.jpg',
      lastAccessedAt: '2026-10-18T12:00:00.000Z',
    });
    expect(getFirstAsync).toHaveBeenCalledWith(
      expect.stringContaining('WHERE source_url = ?'),
      'https://image.example/w780/dune2-wide.jpg'
    );
  });

  it('upserts by source URL and reports entries evicted beyond the limit', async () => {
    getAllAsync.mockResolvedValue([
      { local_uri: 'file://cache/reelrater-home-images/old.jpg' },
    ]);

    await expect(
      sqliteHomeImageCacheRepository.saveAndPrune(
        {
          sourceUrl: 'https://image.example/w780/dune2-wide.jpg',
          catalogId: 'tmdb:movie:693134',
          localUri: 'file://cache/reelrater-home-images/dune2.jpg',
          lastAccessedAt: '2026-10-18T12:00:00.000Z',
        },
        80
      )
    ).resolves.toEqual(['file://cache/reelrater-home-images/old.jpg']);

    const [insertSql] = runAsync.mock.calls[0];
    expect(insertSql).toContain('INSERT INTO cached_home_images');
    expect(insertSql).toContain('ON CONFLICT(source_url) DO UPDATE');
    const [pruneSql, pruneLimit] = runAsync.mock.calls[1];
    expect(pruneSql).toContain('DELETE FROM cached_home_images');
    expect(pruneSql).toContain('ORDER BY last_accessed_at DESC');
    expect(pruneLimit).toBe(80);
  });

  it('removes one entry and returns its local URI', async () => {
    getFirstAsync.mockResolvedValue({
      local_uri: 'file://cache/reelrater-home-images/dune2.jpg',
    });

    await expect(
      sqliteHomeImageCacheRepository.remove(
        'https://image.example/w780/dune2-wide.jpg'
      )
    ).resolves.toBe('file://cache/reelrater-home-images/dune2.jpg');
    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM cached_home_images WHERE source_url = ?'),
      'https://image.example/w780/dune2-wide.jpg'
    );
  });

  it('takes stale entries by last access and deletes their rows', async () => {
    getAllAsync.mockResolvedValue([
      { local_uri: 'file://cache/reelrater-home-images/stale.jpg' },
    ]);

    await expect(
      sqliteHomeImageCacheRepository.takeStale('2026-09-18T12:00:00.000Z')
    ).resolves.toEqual(['file://cache/reelrater-home-images/stale.jpg']);
    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('WHERE last_accessed_at <= ?'),
      '2026-09-18T12:00:00.000Z'
    );
  });

  it('marks entries accessed and clears all rows', async () => {
    await sqliteHomeImageCacheRepository.markAccessed(
      'https://image.example/w780/dune2-wide.jpg',
      '2026-10-18T12:00:00.000Z'
    );
    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('SET last_accessed_at = ?'),
      '2026-10-18T12:00:00.000Z',
      'https://image.example/w780/dune2-wide.jpg'
    );

    getAllAsync.mockResolvedValue([
      { local_uri: 'file://cache/reelrater-home-images/dune2.jpg' },
    ]);
    await expect(sqliteHomeImageCacheRepository.clear()).resolves.toEqual([
      'file://cache/reelrater-home-images/dune2.jpg',
    ]);
    expect(runAsync).toHaveBeenCalledWith(
      'DELETE FROM cached_home_images'
    );
  });
});
