import type { MovieCatalogService } from '@/services/contracts';
import type { MovieCacheRepository } from '@/services/local/movieCacheTypes';
import { createMovieCacheMaintenanceService } from '@/services/movies/movieCacheMaintenanceService';

const createRemote = (): jest.Mocked<MovieCatalogService> => ({
  search: jest.fn(),
  getById: jest.fn(),
});

const createCache = (): jest.Mocked<MovieCacheRepository> => ({
  cache: jest.fn().mockResolvedValue(undefined),
  search: jest.fn().mockResolvedValue([]),
  getById: jest.fn().mockResolvedValue(null),
  listDueForRefresh: jest.fn().mockResolvedValue([]),
  purgeExpired: jest.fn().mockResolvedValue(undefined),
  markAccessed: jest.fn().mockResolvedValue(undefined),
  clear: jest.fn().mockResolvedValue(undefined),
});

describe('movie cache maintenance', () => {
  it('purges expired data and refreshes due entries from the remote adapter', async () => {
    const remote = createRemote();
    const cache = createCache();
    const refreshedMovie = {
      catalogId: 'catalog:1',
      title: 'Arrival',
      releaseYear: 2016,
      genres: ['Science Fiction'],
      posterUrl: null,
      overview: null,
    };
    cache.listDueForRefresh.mockResolvedValue(['catalog:1', 'catalog:2']);
    remote.getById
      .mockResolvedValueOnce(refreshedMovie)
      .mockRejectedValueOnce(new Error('Network unavailable'));
    const maintenance = createMovieCacheMaintenanceService(remote, cache);

    await expect(maintenance.run()).resolves.toEqual({
      refreshedCount: 1,
      failedCount: 1,
    });
    expect(cache.purgeExpired).toHaveBeenCalledTimes(1);
    expect(cache.cache).toHaveBeenCalledWith([refreshedMovie]);
  });

  it('shares one active maintenance run between simultaneous callers', async () => {
    const remote = createRemote();
    const cache = createCache();
    let releaseRefreshList: (() => void) | undefined;
    cache.listDueForRefresh.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseRefreshList = () => resolve([]);
        })
    );
    const maintenance = createMovieCacheMaintenanceService(remote, cache);

    const firstRun = maintenance.run();
    const secondRun = maintenance.run();
    await Promise.resolve();
    releaseRefreshList?.();

    await expect(Promise.all([firstRun, secondRun])).resolves.toEqual([
      { refreshedCount: 0, failedCount: 0 },
      { refreshedCount: 0, failedCount: 0 },
    ]);
    expect(cache.listDueForRefresh).toHaveBeenCalledTimes(1);
  });
});
