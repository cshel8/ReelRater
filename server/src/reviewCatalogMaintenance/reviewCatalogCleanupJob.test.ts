import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { MovieCatalogService } from '../movies/types.js';
import { ReviewCatalogCleanupJob } from './reviewCatalogCleanupJob.js';
import type {
  MaintenanceLease,
  ReviewCatalogMaintenanceRepository,
  ReviewCatalogRecord,
  ReviewCatalogUpdateResult,
} from './types.js';

const retention = {
  fetchedAt: '2026-01-01T12:00:00.000Z',
  refreshAfter: '2026-05-31T12:00:00.000Z',
  expiresAt: '2026-06-29T12:00:00.000Z',
};

const record = (
  reviewId: string,
  catalogId: string
): ReviewCatalogRecord => ({
  reviewId,
  version: `version:${reviewId}`,
  snapshot: {
    catalogId,
    title: `Movie ${reviewId}`,
    releaseYear: 2020,
    genres: ['Drama'],
    posterUrl: `https://image.example/${reviewId}.jpg`,
    retention,
  },
});

const availableLease = (): MaintenanceLease => ({
  tryAcquire: async () => true,
  release: async () => undefined,
});

test('cleanup refreshes, redacts, retries, and conditionally updates records', async () => {
  const retryRecord = record('retry', 'catalog:retry');
  retryRecord.snapshot.retention = {
    fetchedAt: '2026-02-01T12:00:00.000Z',
    refreshAfter: '2026-06-01T12:00:00.000Z',
    expiresAt: '2026-07-30T12:00:00.000Z',
  };
  const records = [
    record('refresh', 'catalog:refresh'),
    record('redact', 'catalog:redact'),
    retryRecord,
    record('conflict', 'catalog:conflict'),
  ];
  const updates: Parameters<
    ReviewCatalogMaintenanceRepository['replaceSnapshot']
  >[0][] = [];
  const repository: ReviewCatalogMaintenanceRepository = {
    async listDue() {
      return { records, nextCursor: null };
    },
    async replaceSnapshot(input) {
      updates.push(input);
      return input.reviewId === 'conflict'
        ? 'conflict'
        : 'updated';
    },
  };
  const catalog: MovieCatalogService = {
    async search() {
      throw new Error('Not used by cleanup');
    },
    async getById(catalogId) {
      if (catalogId === 'catalog:redact') {
        return null;
      }
      if (catalogId === 'catalog:retry') {
        throw new Error('Catalog unavailable');
      }
      return {
        catalogId,
        title: 'Fresh title',
        releaseYear: 2026,
        genres: ['Science Fiction'],
        posterUrl: null,
        overview: null,
      };
    },
  };
  const cleanup = new ReviewCatalogCleanupJob(
    repository,
    catalog,
    availableLease(),
    () => new Date('2026-06-29T12:00:00.000Z'),
    undefined,
    () => 'cleanup-owner'
  );

  assert.deepEqual(await cleanup.run(), {
    status: 'completed',
    scannedCount: 4,
    refreshedCount: 1,
    redactedCount: 1,
    retryPendingCount: 1,
    conflictCount: 1,
  });
  assert.deepEqual(updates[0], {
    reviewId: 'refresh',
    expectedVersion: 'version:refresh',
    snapshot: {
      catalogId: 'catalog:refresh',
      title: 'Fresh title',
      releaseYear: 2026,
      genres: ['Science Fiction'],
      posterUrl: null,
      retention: {
        fetchedAt: '2026-06-29T12:00:00.000Z',
        refreshAfter: '2026-11-26T12:00:00.000Z',
        expiresAt: '2026-12-25T12:00:00.000Z',
      },
    },
  });
  assert.deepEqual(updates[1], {
    reviewId: 'redact',
    expectedVersion: 'version:redact',
    snapshot: {
      catalogId: 'catalog:redact',
      title: 'Movie details temporarily unavailable',
      releaseYear: null,
      genres: [],
      posterUrl: null,
      retention,
    },
  });
});

test('cleanup skips safely when another backend instance owns the lease', async () => {
  let listed = false;
  const repository: ReviewCatalogMaintenanceRepository = {
    async listDue() {
      listed = true;
      return { records: [], nextCursor: null };
    },
    async replaceSnapshot(): Promise<ReviewCatalogUpdateResult> {
      return 'updated';
    },
  };
  const lease: MaintenanceLease = {
    tryAcquire: async () => false,
    release: async () => {
      throw new Error('A lease that was not acquired must not be released');
    },
  };
  const catalog: MovieCatalogService = {
    async search() {
      throw new Error('Not used by cleanup');
    },
    async getById() {
      throw new Error('Not used by cleanup');
    },
  };
  const cleanup = new ReviewCatalogCleanupJob(
    repository,
    catalog,
    lease
  );

  assert.deepEqual(await cleanup.run(), {
    status: 'skipped',
    scannedCount: 0,
    refreshedCount: 0,
    redactedCount: 0,
    retryPendingCount: 0,
    conflictCount: 0,
  });
  assert.equal(listed, false);
});

test('simultaneous calls share one active cleanup run', async () => {
  let releaseList: (() => void) | undefined;
  let listCount = 0;
  let acquireCount = 0;
  const repository: ReviewCatalogMaintenanceRepository = {
    async listDue() {
      listCount += 1;
      await new Promise<void>((resolve) => {
        releaseList = resolve;
      });
      return { records: [], nextCursor: null };
    },
    async replaceSnapshot() {
      return 'updated';
    },
  };
  const lease: MaintenanceLease = {
    async tryAcquire() {
      acquireCount += 1;
      return true;
    },
    async release() {},
  };
  const catalog: MovieCatalogService = {
    async search() {
      throw new Error('Not used by cleanup');
    },
    async getById() {
      throw new Error('Not used by cleanup');
    },
  };
  const cleanup = new ReviewCatalogCleanupJob(
    repository,
    catalog,
    lease
  );

  const first = cleanup.run();
  const second = cleanup.run();
  assert.equal(first, second);
  await new Promise<void>((resolve) => setImmediate(resolve));
  releaseList?.();
  await Promise.all([first, second]);

  assert.equal(listCount, 1);
  assert.equal(acquireCount, 1);
});
