import {
  getSQLiteDatabase,
  runSQLiteWrite,
} from '@/database/sqliteDatabase';
import { sqliteHomeSnapshotRepository } from '@/services/local/sqliteHomeSnapshotRepository';
import type { MediaSummary } from '@/types/domain';

jest.mock('@/database/sqliteDatabase', () => ({
  getSQLiteDatabase: jest.fn(),
  runSQLiteWrite: jest.fn(),
}));

const runAsync = jest.fn();
const getFirstAsync = jest.fn();
const database = { runAsync, getFirstAsync };

const dune: MediaSummary = {
  mediaType: 'movie',
  reviewTargetType: 'movie',
  catalogId: 'tmdb:movie:693134',
  title: 'Dune: Part Two',
  releaseYear: 2024,
  genres: ['Science Fiction'],
  posterUrl: 'https://image.example/w342/dune2.jpg',
  backdropUrl: 'https://image.example/w780/dune2-wide.jpg',
};

describe('SQLite Home snapshot repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSQLiteDatabase as jest.Mock).mockResolvedValue(database);
    (runSQLiteWrite as jest.Mock).mockImplementation(
      (operation) => operation(database)
    );
  });

  it('replaces a section snapshot atomically in one upsert', async () => {
    await sqliteHomeSnapshotRepository.replace({
      section: 'trending',
      items: [dune],
      fetchedAt: '2026-10-18T12:00:00.000Z',
    });

    expect(runAsync).toHaveBeenCalledTimes(1);
    const [sql, section, itemsJson, fetchedAt] = runAsync.mock.calls[0];
    expect(sql).toContain('INSERT INTO home_section_snapshots');
    expect(sql).toContain('ON CONFLICT(section) DO UPDATE');
    expect(section).toBe('trending');
    expect(JSON.parse(itemsJson)).toEqual([dune]);
    expect(fetchedAt).toBe('2026-10-18T12:00:00.000Z');
  });

  it('restores stored items including backdrop URLs', async () => {
    getFirstAsync.mockResolvedValue({
      section: 'trending',
      items_json: JSON.stringify([dune]),
      fetched_at: '2026-10-18T12:00:00.000Z',
    });

    await expect(
      sqliteHomeSnapshotRepository.get('trending')
    ).resolves.toEqual({
      section: 'trending',
      items: [dune],
      fetchedAt: '2026-10-18T12:00:00.000Z',
    });
  });

  it('returns null when no snapshot is stored', async () => {
    getFirstAsync.mockResolvedValue(null);

    await expect(
      sqliteHomeSnapshotRepository.get('popularTv')
    ).resolves.toBeNull();
  });

  it('drops corrupted or malformed stored items instead of surfacing them', async () => {
    getFirstAsync.mockResolvedValueOnce({
      section: 'trending',
      items_json: 'not-json{',
      fetched_at: '2026-10-18T12:00:00.000Z',
    });
    await expect(
      sqliteHomeSnapshotRepository.get('trending')
    ).resolves.toMatchObject({ items: [] });

    getFirstAsync.mockResolvedValueOnce({
      section: 'trending',
      items_json: JSON.stringify([{ title: 'Missing an ID' }, dune]),
      fetched_at: '2026-10-18T12:00:00.000Z',
    });
    await expect(
      sqliteHomeSnapshotRepository.get('trending')
    ).resolves.toMatchObject({ items: [dune] });
  });

  it('clears all stored snapshots', async () => {
    await sqliteHomeSnapshotRepository.clear();

    expect(runAsync).toHaveBeenCalledWith(
      'DELETE FROM home_section_snapshots'
    );
  });
});
