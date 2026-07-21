import type { MovieCatalogService } from '@/services/contracts';
import type { MovieCacheRepository } from '@/services/local/movieCacheTypes';

export type MovieCacheMaintenanceResult = {
  refreshedCount: number;
  failedCount: number;
};

export interface MovieCacheMaintenanceService {
  run(maximumRefreshes?: number): Promise<MovieCacheMaintenanceResult>;
}

export const createMovieCacheMaintenanceService = (
  remoteCatalog: MovieCatalogService,
  movieCache: MovieCacheRepository
): MovieCacheMaintenanceService => {
  let activeRun: Promise<MovieCacheMaintenanceResult> | null = null;

  const runMaintenance = async (maximumRefreshes = 10) => {
    await movieCache.purgeExpired();
    const catalogIds = await movieCache.listDueForRefresh(maximumRefreshes);
    let refreshedCount = 0;
    let failedCount = 0;

    for (const catalogId of catalogIds) {
      try {
        const movie = await remoteCatalog.getById(catalogId);
        if (!movie) {
          failedCount += 1;
          continue;
        }

        await movieCache.cache([movie]);
        refreshedCount += 1;
      } catch {
        failedCount += 1;
      }
    }

    return { refreshedCount, failedCount };
  };

  return {
    run(maximumRefreshes) {
      if (!activeRun) {
        activeRun = runMaintenance(maximumRefreshes).finally(() => {
          activeRun = null;
        });
      }
      return activeRun;
    },
  };
};
