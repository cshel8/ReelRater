import * as SQLite from 'expo-sqlite';

const DATABASE_NAME = 'reel-rater.db';
const DATABASE_VERSION = 7;

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function migrate(database: SQLite.SQLiteDatabase): Promise<void> {
  const versionRow = await database.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version'
  );
  const currentVersion = versionRow?.user_version ?? 0;

  if (currentVersion >= DATABASE_VERSION) {
    return;
  }

  await database.withExclusiveTransactionAsync(async (transaction) => {
    if (currentVersion < 1) {
      await transaction.execAsync(`
        CREATE TABLE IF NOT EXISTS pending_review_operations (
          operation_id TEXT PRIMARY KEY NOT NULL,
          review_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          operation_type TEXT NOT NULL CHECK(operation_type IN ('create', 'delete')),
          payload_json TEXT,
          status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'failed')),
          attempt_count INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          last_attempt_at TEXT,
          last_error TEXT
        );

        CREATE INDEX IF NOT EXISTS pending_review_operations_user_index
          ON pending_review_operations(user_id, created_at);

        PRAGMA user_version = 1;
      `);
    }

    if (currentVersion < 2) {
      await transaction.execAsync(`
        CREATE TABLE IF NOT EXISTS cached_reviews (
          review_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          movie_title TEXT NOT NULL,
          review_text TEXT NOT NULL,
          rating TEXT NOT NULL,
          created_at TEXT NOT NULL,
          PRIMARY KEY (user_id, review_id)
        );

        CREATE INDEX IF NOT EXISTS cached_reviews_user_date_index
          ON cached_reviews(user_id, created_at DESC);

        PRAGMA user_version = 2;
      `);
    }

    if (currentVersion < 3) {
      await transaction.execAsync(`
        ALTER TABLE cached_reviews
          ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private';

        PRAGMA user_version = 3;
      `);
    }

    if (currentVersion < 4) {
      await transaction.execAsync(`
        CREATE TABLE IF NOT EXISTS cached_movies (
          catalog_id TEXT PRIMARY KEY NOT NULL,
          title TEXT NOT NULL,
          normalized_title TEXT NOT NULL,
          release_year INTEGER,
          genres_json TEXT NOT NULL,
          poster_url TEXT,
          cached_at TEXT NOT NULL,
          last_accessed_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS cached_movies_title_index
          ON cached_movies(normalized_title);

        CREATE INDEX IF NOT EXISTS cached_movies_access_index
          ON cached_movies(last_accessed_at DESC);

        PRAGMA user_version = 4;
      `);
    }

    if (currentVersion < 5) {
      await transaction.execAsync(`
        ALTER TABLE cached_reviews
          ADD COLUMN movie_json TEXT;

        PRAGMA user_version = 5;
      `);
    }

    if (currentVersion < 6) {
      await transaction.execAsync(`
        ALTER TABLE cached_movies
          ADD COLUMN refresh_after TEXT;

        ALTER TABLE cached_movies
          ADD COLUMN expires_at TEXT;

        UPDATE cached_movies
        SET
          refresh_after = strftime(
            '%Y-%m-%dT%H:%M:%fZ',
            cached_at,
            '+150 days'
          ),
          expires_at = strftime(
            '%Y-%m-%dT%H:%M:%fZ',
            cached_at,
            '+179 days'
          );

        CREATE INDEX IF NOT EXISTS cached_movies_refresh_index
          ON cached_movies(refresh_after);

        CREATE INDEX IF NOT EXISTS cached_movies_expiration_index
          ON cached_movies(expires_at);

        PRAGMA user_version = 6;
      `);
    }

    if (currentVersion < 7) {
      await transaction.execAsync(`
        CREATE TABLE IF NOT EXISTS cached_poster_files (
          catalog_id TEXT PRIMARY KEY NOT NULL,
          source_url TEXT NOT NULL,
          local_uri TEXT NOT NULL,
          catalog_fetched_at TEXT NOT NULL,
          refresh_after TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          last_accessed_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS cached_poster_files_expiration_index
          ON cached_poster_files(expires_at);

        CREATE INDEX IF NOT EXISTS cached_poster_files_access_index
          ON cached_poster_files(last_accessed_at DESC);

        PRAGMA user_version = 7;
      `);
    }
  });
}

export async function getSQLiteDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = (async () => {
      const database = await SQLite.openDatabaseAsync(DATABASE_NAME);
      await database.execAsync('PRAGMA journal_mode = WAL');
      await migrate(database);
      return database;
    })();
  }

  return databasePromise;
}
