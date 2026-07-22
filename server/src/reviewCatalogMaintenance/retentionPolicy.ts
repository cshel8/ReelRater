import type { CatalogDataRetention } from './types.js';

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

export interface CatalogRetentionPolicy {
  createWindow(fetchedAt: Date): CatalogDataRetention;
}

export const createAgeBasedCatalogRetentionPolicy = ({
  refreshAfterDays,
  expireAfterDays,
}: {
  refreshAfterDays: number;
  expireAfterDays: number;
}): CatalogRetentionPolicy => {
  if (
    !Number.isInteger(refreshAfterDays) ||
    !Number.isInteger(expireAfterDays) ||
    refreshAfterDays < 1 ||
    expireAfterDays <= refreshAfterDays
  ) {
    throw new Error(
      'Catalog expiration must be later than its refresh threshold.'
    );
  }

  return {
    createWindow(fetchedAt) {
      const fetchedAtMilliseconds = fetchedAt.getTime();
      if (!Number.isFinite(fetchedAtMilliseconds)) {
        throw new Error('A valid catalog fetch date is required.');
      }

      return {
        fetchedAt: fetchedAt.toISOString(),
        refreshAfter: new Date(
          fetchedAtMilliseconds + refreshAfterDays * DAY_IN_MILLISECONDS
        ).toISOString(),
        expiresAt: new Date(
          fetchedAtMilliseconds + expireAfterDays * DAY_IN_MILLISECONDS
        ).toISOString(),
      };
    },
  };
};

export const defaultCatalogRetentionPolicy =
  createAgeBasedCatalogRetentionPolicy({
    refreshAfterDays: 150,
    expireAfterDays: 179,
  });
