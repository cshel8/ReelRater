import {
  getSQLiteDatabase,
  runSQLiteWrite,
} from '@/database/sqliteDatabase';
import type {
  HomeSectionSnapshot,
  HomeSnapshotRepository,
} from '@/services/local/homeSnapshotTypes';
import type { MediaSummary } from '@/types/domain';

interface HomeSnapshotRow {
  section: string;
  items_json: string;
  fetched_at: string;
}

const readStoredMediaSummary = (value: unknown): MediaSummary | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.catalogId !== 'string' ||
    typeof candidate.title !== 'string'
  ) {
    return null;
  }

  return {
    ...(candidate.mediaType === 'tv' &&
    candidate.reviewTargetType === 'series'
      ? ({ mediaType: 'tv', reviewTargetType: 'series' } as const)
      : ({ mediaType: 'movie', reviewTargetType: 'movie' } as const)),
    catalogId: candidate.catalogId,
    title: candidate.title,
    releaseYear:
      typeof candidate.releaseYear === 'number'
        ? candidate.releaseYear
        : null,
    genres: Array.isArray(candidate.genres)
      ? candidate.genres.filter(
          (genre): genre is string => typeof genre === 'string'
        )
      : [],
    posterUrl:
      typeof candidate.posterUrl === 'string' ? candidate.posterUrl : null,
    ...(typeof candidate.backdropUrl === 'string'
      ? { backdropUrl: candidate.backdropUrl }
      : {}),
  };
};

const parseItems = (itemsJson: string): MediaSummary[] => {
  try {
    const parsed = JSON.parse(itemsJson) as unknown;
    return Array.isArray(parsed)
      ? parsed.flatMap((item) => {
          const summary = readStoredMediaSummary(item);
          return summary ? [summary] : [];
        })
      : [];
  } catch {
    return [];
  }
};

export const sqliteHomeSnapshotRepository: HomeSnapshotRepository = {
  async get(section) {
    const database = await getSQLiteDatabase();
    const row = await database.getFirstAsync<HomeSnapshotRow>(
      `SELECT section, items_json, fetched_at
       FROM home_section_snapshots
       WHERE section = ?`,
      section
    );
    if (!row) {
      return null;
    }

    return {
      section,
      items: parseItems(row.items_json),
      fetchedAt: row.fetched_at,
    };
  },

  async replace(snapshot: HomeSectionSnapshot) {
    await runSQLiteWrite((database) =>
      database.runAsync(
        `INSERT INTO home_section_snapshots (section, items_json, fetched_at)
         VALUES (?, ?, ?)
         ON CONFLICT(section) DO UPDATE SET
           items_json = excluded.items_json,
           fetched_at = excluded.fetched_at`,
        snapshot.section,
        JSON.stringify(snapshot.items),
        snapshot.fetchedAt
      )
    );
  },

  async clear() {
    await runSQLiteWrite((database) =>
      database.runAsync('DELETE FROM home_section_snapshots')
    );
  },
};
