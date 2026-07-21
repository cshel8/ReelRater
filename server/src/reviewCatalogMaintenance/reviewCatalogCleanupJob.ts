import { randomUUID } from 'node:crypto';
import type { MovieCatalogService } from '../movies/types.js';
import {
  defaultCatalogRetentionPolicy,
  type CatalogRetentionPolicy,
} from './retentionPolicy.js';
import type {
  MaintenanceLease,
  ReviewCatalogMaintenanceRepository,
  ReviewCatalogRecord,
  ReviewCatalogSnapshot,
} from './types.js';

const JOB_LEASE_KEY = 'review-catalog-cleanup';
const DEFAULT_BATCH_SIZE = 25;
const DEFAULT_MAXIMUM_RECORDS = 100;
const LEASE_DURATION_MILLISECONDS = 15 * 60 * 1000;
const REDACTED_TITLE = 'Movie details temporarily unavailable';

export type ReviewCatalogCleanupResult = {
  status: 'completed' | 'skipped';
  scannedCount: number;
  refreshedCount: number;
  redactedCount: number;
  retryPendingCount: number;
  conflictCount: number;
};

const emptyResult = (
  status: ReviewCatalogCleanupResult['status']
): ReviewCatalogCleanupResult => ({
  status,
  scannedCount: 0,
  refreshedCount: 0,
  redactedCount: 0,
  retryPendingCount: 0,
  conflictCount: 0,
});

const normalizedPositiveInteger = (
  value: number | undefined,
  fallback: number
) => {
  if (value === undefined) {
    return fallback;
  }
  if (!Number.isInteger(value) || value < 1) {
    throw new Error('Cleanup limits must be positive integers.');
  }
  return value;
};

const isExpired = (record: ReviewCatalogRecord, currentTime: Date) => {
  const expiresAt = record.snapshot.retention?.expiresAt;
  if (!expiresAt) {
    return true;
  }
  const expirationTime = new Date(expiresAt).getTime();
  return (
    !Number.isFinite(expirationTime) ||
    expirationTime <= currentTime.getTime()
  );
};

const isAlreadyRedacted = (snapshot: ReviewCatalogSnapshot) =>
  snapshot.title === REDACTED_TITLE &&
  snapshot.releaseYear === null &&
  snapshot.genres.length === 0 &&
  snapshot.posterUrl === null;

export class ReviewCatalogCleanupJob {
  private activeRun: Promise<ReviewCatalogCleanupResult> | null = null;

  constructor(
    private readonly repository: ReviewCatalogMaintenanceRepository,
    private readonly movieCatalog: MovieCatalogService,
    private readonly lease: MaintenanceLease,
    private readonly clock: () => Date = () => new Date(),
    private readonly retentionPolicy: CatalogRetentionPolicy =
      defaultCatalogRetentionPolicy,
    private readonly ownerIdFactory: () => string = randomUUID
  ) {}

  run(options: { batchSize?: number; maximumRecords?: number } = {}) {
    if (!this.activeRun) {
      this.activeRun = this.runExclusive(options).finally(() => {
        this.activeRun = null;
      });
    }
    return this.activeRun;
  }

  private async runExclusive(options: {
    batchSize?: number;
    maximumRecords?: number;
  }): Promise<ReviewCatalogCleanupResult> {
    const batchSize = normalizedPositiveInteger(
      options.batchSize,
      DEFAULT_BATCH_SIZE
    );
    const maximumRecords = normalizedPositiveInteger(
      options.maximumRecords,
      DEFAULT_MAXIMUM_RECORDS
    );
    const startedAt = this.clock();
    const ownerId = this.ownerIdFactory();
    const acquired = await this.lease.tryAcquire({
      key: JOB_LEASE_KEY,
      ownerId,
      expiresAt: new Date(
        startedAt.getTime() + LEASE_DURATION_MILLISECONDS
      ).toISOString(),
    });

    if (!acquired) {
      return emptyResult('skipped');
    }

    try {
      const result = emptyResult('completed');
      let cursor: string | undefined;

      while (result.scannedCount < maximumRecords) {
        const remaining = maximumRecords - result.scannedCount;
        const requestedResults = Math.min(batchSize, remaining);
        const page = await this.repository.listDue({
          dueAt: startedAt.toISOString(),
          cursor,
          maximumResults: requestedResults,
        });
        if (page.records.length > requestedResults) {
          throw new Error('Cleanup repository returned more than requested.');
        }

        for (const record of page.records) {
          result.scannedCount += 1;
          await this.processRecord(record, startedAt, result);
        }

        if (!page.nextCursor || page.records.length === 0) {
          break;
        }
        cursor = page.nextCursor;
      }

      return result;
    } finally {
      await this.lease.release({ key: JOB_LEASE_KEY, ownerId });
    }
  }

  private async processRecord(
    record: ReviewCatalogRecord,
    currentTime: Date,
    result: ReviewCatalogCleanupResult
  ) {
    let movie = null;

    try {
      movie = await this.movieCatalog.getById(record.snapshot.catalogId);
    } catch {
      // Expired records are redacted below; unexpired records remain eligible
      // for a later retry.
    }

    if (movie) {
      const updateResult = await this.repository.replaceSnapshot({
        reviewId: record.reviewId,
        expectedVersion: record.version,
        snapshot: {
          catalogId: movie.catalogId,
          title: movie.title,
          releaseYear: movie.releaseYear,
          genres: movie.genres,
          posterUrl: movie.posterUrl,
          retention: this.retentionPolicy.createWindow(currentTime),
        },
      });
      if (updateResult === 'updated') {
        result.refreshedCount += 1;
      } else {
        result.conflictCount += 1;
      }
      return;
    }

    if (!isExpired(record, currentTime) || isAlreadyRedacted(record.snapshot)) {
      result.retryPendingCount += 1;
      return;
    }

    const updateResult = await this.repository.replaceSnapshot({
      reviewId: record.reviewId,
      expectedVersion: record.version,
      snapshot: {
        catalogId: record.snapshot.catalogId,
        title: REDACTED_TITLE,
        releaseYear: null,
        genres: [],
        posterUrl: null,
        retention: record.snapshot.retention,
      },
    });
    if (updateResult === 'updated') {
      result.redactedCount += 1;
    } else {
      result.conflictCount += 1;
    }
  }
}
