const mockExecAsync = jest.fn();
const mockGetFirstAsync = jest.fn();
const mockTransaction = { execAsync: mockExecAsync };
const mockDatabase = {
  execAsync: mockExecAsync,
  getFirstAsync: mockGetFirstAsync,
  withExclusiveTransactionAsync: jest.fn(async (operation) => operation(mockTransaction)),
};

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(async () => mockDatabase),
}));

import { getSQLiteDatabase } from '@/database/sqliteDatabase';

describe('SQLite Community cache v12 migration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetFirstAsync.mockResolvedValue({ user_version: 11 });
  });

  it('adds isolated Community snapshot and feed-membership tables without rebuilding My Reviews', async () => {
    await getSQLiteDatabase();

    const migrationSql = mockExecAsync.mock.calls
      .map(([sql]) => String(sql))
      .find((sql) => sql.includes('community_cached_reviews'));

    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS community_cached_reviews');
    expect(migrationSql).toContain('PRIMARY KEY (viewer_uid, review_id)');
    expect(migrationSql).toContain("CHECK(visibility IN ('public', 'followers'))");
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS community_cached_feed_entries');
    expect(migrationSql).toContain("CHECK(feed_mode IN ('following', 'everyone'))");
    expect(migrationSql).toContain('last_seen_at DESC');
    expect(migrationSql).toContain('PRAGMA user_version = 12');
    expect(migrationSql).not.toContain('ALTER TABLE cached_reviews');
    expect(migrationSql).not.toContain('DROP TABLE cached_reviews');
  });
});
