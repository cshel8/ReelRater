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

describe('SQLite Home v13 migration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetFirstAsync.mockResolvedValue({ user_version: 12 });
  });

  it('adds Home snapshot/image tables and the overview column without touching existing data', async () => {
    await getSQLiteDatabase();

    const migrationSql = mockExecAsync.mock.calls
      .map(([sql]) => String(sql))
      .find((sql) => sql.includes('home_section_snapshots'));

    expect(migrationSql).toContain(
      'ALTER TABLE cached_movies\n          ADD COLUMN overview TEXT'
    );
    expect(migrationSql).toContain(
      'CREATE TABLE IF NOT EXISTS home_section_snapshots'
    );
    expect(migrationSql).toContain(
      "section IN ('trending', 'popularMovies', 'popularTv')"
    );
    expect(migrationSql).toContain(
      'CREATE TABLE IF NOT EXISTS cached_home_images'
    );
    expect(migrationSql).toContain('source_url TEXT PRIMARY KEY NOT NULL');
    expect(migrationSql).toContain('PRAGMA user_version = 13');
    expect(migrationSql).not.toContain('viewer_uid');
    expect(migrationSql).not.toContain('DROP TABLE');
    expect(migrationSql).not.toContain('ALTER TABLE cached_reviews');
  });
});
