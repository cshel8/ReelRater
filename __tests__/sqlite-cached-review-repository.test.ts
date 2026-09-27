const mockGetAllAsync = jest.fn();
const mockRunAsync = jest.fn();
const mockDatabase = {
  getAllAsync: mockGetAllAsync,
  runAsync: mockRunAsync,
};
const mockTransaction = { runAsync: mockRunAsync };

jest.mock('@/database/sqliteDatabase', () => ({
  getSQLiteDatabase: jest.fn(async () => mockDatabase),
  runSQLiteTransaction: jest.fn(async (operation) => operation(mockTransaction)),
  runSQLiteWrite: jest.fn(async (operation) => operation(mockDatabase)),
}));

import { sqliteCachedReviewRepository } from '@/services/local/sqliteCachedReviewRepository';
import type { Review } from '@/types/domain';

const createReview = (spoilerWarning: boolean): Review => ({
  id: spoilerWarning ? 'spoiler-review' : 'normal-review',
  movieTitle: spoilerWarning ? 'Spoiler Movie' : 'Normal Movie',
  reviewText: 'A review.',
  rating: 4,
  spoilerWarning,
  visibility: 'private',
  createdAt: '2026-08-18T12:00:00.000Z',
  syncStatus: 'synced',
});

describe('SQLite cached review spoiler persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('writes all nine cached-review columns for normal and spoiler reviews', async () => {
    await sqliteCachedReviewRepository.replaceForUser('user-1', [
      createReview(false),
      createReview(true),
    ]);

    const inserts = mockRunAsync.mock.calls.filter(([sql]) =>
      String(sql).includes('INSERT INTO cached_reviews')
    );

    expect(inserts).toHaveLength(2);
    expect(inserts[0]).toHaveLength(10);
    expect(inserts[1]).toHaveLength(10);
    expect(inserts[0][7]).toBe(0);
    expect(inserts[1][7]).toBe(1);
    expect(String(inserts[0][0]).match(/\?/g)).toHaveLength(9);
  });

  it('reads existing 0/1 values back as false/true', async () => {
    mockGetAllAsync.mockResolvedValue([
      {
        review_id: 'normal-review',
        movie_title: 'Normal Movie',
        movie_json: null,
        review_text: 'Normal review.',
        rating: 4,
        spoiler_warning: 0,
        visibility: 'private',
        created_at: '2026-08-18T12:00:00.000Z',
      },
      {
        review_id: 'spoiler-review',
        movie_title: 'Spoiler Movie',
        movie_json: null,
        review_text: 'Spoiler review.',
        rating: 5,
        spoiler_warning: 1,
        visibility: 'public',
        created_at: '2026-08-18T12:01:00.000Z',
      },
    ]);

    await expect(sqliteCachedReviewRepository.listForUser('user-1')).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'normal-review', spoilerWarning: false }),
        expect.objectContaining({ id: 'spoiler-review', spoilerWarning: true }),
      ])
    );
  });

  it('omits malformed legacy cached ratings instead of exposing them as reviews', async () => {
    mockGetAllAsync.mockResolvedValue([
      {
        review_id: 'invalid-legacy-review',
        movie_title: 'Invalid legacy review',
        movie_json: null,
        review_text: 'This row should be refreshed from its remote source.',
        rating: 0,
        spoiler_warning: 0,
        visibility: 'private',
        created_at: '2026-08-18T12:00:00.000Z',
      },
    ]);

    await expect(sqliteCachedReviewRepository.listForUser('user-1')).resolves.toEqual(
      []
    );
  });

  it('uses the same nine-value upsert when the spoiler setting is edited', async () => {
    await sqliteCachedReviewRepository.save('user-1', createReview(true));

    const insert = mockRunAsync.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT OR REPLACE INTO cached_reviews')
    );
    expect(insert).toBeDefined();
    expect(insert).toHaveLength(10);
    expect(insert?.[7]).toBe(1);
    expect(String(insert?.[0]).match(/\?/g)).toHaveLength(9);
  });
});
