import { getSQLiteDatabase } from '@/database/sqliteDatabase';
import {
  createSQLiteMovieCacheRepository,
  escapeMovieLikePattern,
  normalizeMovieTitle,
} from '@/services/local/sqliteMovieCacheRepository';
import type { MovieCacheRepository } from '@/services/local/movieCacheTypes';

jest.mock('@/database/sqliteDatabase', () => ({
  getSQLiteDatabase: jest.fn(),
}));

const runAsync = jest.fn();
const getAllAsync = jest.fn();
const getFirstAsync = jest.fn();
const database = {
  getAllAsync,
  getFirstAsync,
  runAsync,
  withExclusiveTransactionAsync: jest.fn(
    async (operation: (transaction: { runAsync: typeof runAsync }) => unknown) =>
      operation({ runAsync })
  ),
};

const now = new Date('2026-01-01T12:00:00.000Z');
let movieCache: MovieCacheRepository;

describe('SQLite movie cache repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSQLiteDatabase as jest.Mock).mockResolvedValue(database);
    movieCache = createSQLiteMovieCacheRepository({ clock: () => now });
  });

  it('normalizes titles and escapes SQLite wildcard characters', () => {
    expect(normalizeMovieTitle('  The MOVIE  ')).toBe('the movie');
    expect(escapeMovieLikePattern('100%_fun\\night')).toBe(
      '100\\%\\_fun\\\\night'
    );
  });

  it('caches normalized movie metadata and prunes older entries', async () => {
    await movieCache.cache([
      {
        catalogId: 'tmdb:329865',
        title: 'Arrival',
        releaseYear: 2016,
        genres: ['Drama', 'Science Fiction'],
        posterUrl: 'https://image.example/arrival.jpg',
      },
    ]);

    expect(runAsync).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('INSERT INTO cached_movies'),
      'tmdb:329865',
      'Arrival',
      'arrival',
      2016,
      '["Drama","Science Fiction"]',
      'https://image.example/arrival.jpg',
      '2026-01-01T12:00:00.000Z',
      '2026-01-01T12:00:00.000Z',
      '2026-05-31T12:00:00.000Z',
      '2026-06-29T12:00:00.000Z'
    );
    expect(runAsync).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('expires_at IS NULL'),
      '2026-01-01T12:00:00.000Z'
    );
    expect(runAsync).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('DELETE FROM cached_movies'),
      200
    );
  });

  it('searches cached titles and converts database rows', async () => {
    getAllAsync.mockResolvedValue([
      {
        catalog_id: 'tmdb:329865',
        title: 'Arrival',
        release_year: 2016,
        genres_json: '["Drama","Science Fiction"]',
        poster_url: null,
        cached_at: '2025-08-01T12:00:00.000Z',
        refresh_after: '2025-12-29T12:00:00.000Z',
        expires_at: '2026-01-27T12:00:00.000Z',
      },
    ]);

    await expect(
      movieCache.search('  Arr%_  ', 10)
    ).resolves.toEqual([
      {
        catalogId: 'tmdb:329865',
        title: 'Arrival',
        releaseYear: 2016,
        genres: ['Drama', 'Science Fiction'],
        posterUrl: null,
        catalogDataRetention: {
          fetchedAt: '2025-08-01T12:00:00.000Z',
          refreshAfter: '2025-12-29T12:00:00.000Z',
          expiresAt: '2026-01-27T12:00:00.000Z',
        },
      },
    ]);
    expect(getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('FROM cached_movies'),
      '2026-01-01T12:00:00.000Z',
      '%arr\\%\\_%',
      'arr%_',
      'arr\\%\\_%',
      10
    );
  });

  it('returns no results for an empty search without opening SQLite', async () => {
    await expect(movieCache.search('   ')).resolves.toEqual([]);
    expect(getSQLiteDatabase).not.toHaveBeenCalled();
  });

  it('purges expired entries and lists only cache entries due for refresh', async () => {
    getAllAsync.mockResolvedValue([
      { catalog_id: 'catalog:oldest' },
      { catalog_id: 'catalog:newer' },
    ]);

    await expect(movieCache.listDueForRefresh(5)).resolves.toEqual([
      'catalog:oldest',
      'catalog:newer',
    ]);
    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('expires_at IS NULL'),
      '2026-01-01T12:00:00.000Z'
    );
    expect(getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('refresh_after <= ?'),
      '2026-01-01T12:00:00.000Z',
      '2026-01-01T12:00:00.000Z',
      5
    );
  });
});
