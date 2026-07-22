import type { CatalogDataRetention } from '@/types/domain';

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

export interface MovieCachePolicy {
  createWindow(fetchedAt: Date): CatalogDataRetention;
}

export const createAgeBasedMovieCachePolicy = ({
  refreshAfterDays,
  expireAfterDays,
}: {
  refreshAfterDays: number;
  expireAfterDays: number;
}): MovieCachePolicy => {
  if (
    !Number.isInteger(refreshAfterDays) ||
    !Number.isInteger(expireAfterDays) ||
    refreshAfterDays < 1 ||
    expireAfterDays <= refreshAfterDays
  ) {
    throw new Error(
      'Movie cache expiration must be later than its refresh threshold.'
    );
  }

  return {
    createWindow(fetchedAt) {
      const fetchedAtMilliseconds = fetchedAt.getTime();
      if (!Number.isFinite(fetchedAtMilliseconds)) {
        throw new Error('A valid movie cache fetch date is required.');
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

export const defaultMovieCachePolicy = createAgeBasedMovieCachePolicy({
  refreshAfterDays: 150,
  expireAfterDays: 179,
});
