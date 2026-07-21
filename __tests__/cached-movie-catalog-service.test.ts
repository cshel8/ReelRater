import { createCachedMovieCatalogService } from '@/services/movies/cachedMovieCatalogService';
import type { MovieCatalogService } from '@/services/contracts';
import type { MovieCacheRepository } from '@/services/local/movieCacheTypes';
import type { MovieSummary } from '@/types/domain';

const arrival: MovieSummary = {
  catalogId: 'tmdb:329865',
  title: 'Arrival',
  releaseYear: 2016,
  genres: ['Science Fiction'],
  posterUrl: null,
};

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

describe('cached movie catalog service', () => {
  it('stores successful online search results in the local cache', async () => {
    const remote = createRemote();
    const cache = createCache();
    remote.search.mockResolvedValue({
      movies: [arrival],
      nextCursor: 'next-page',
    });
    const service = createCachedMovieCatalogService(remote, cache);

    await expect(service.search('Arrival')).resolves.toEqual({
      movies: [arrival],
      nextCursor: 'next-page',
    });
    expect(cache.cache).toHaveBeenCalledWith([arrival]);
  });

  it('uses cached title results when the initial online search fails', async () => {
    const remote = createRemote();
    const cache = createCache();
    remote.search.mockRejectedValue(new Error('Network unavailable'));
    cache.search.mockResolvedValue([arrival]);
    const service = createCachedMovieCatalogService(remote, cache);

    await expect(
      service.search('Arrival', { maximumResults: 10 })
    ).resolves.toEqual({ movies: [arrival], nextCursor: null });
    expect(cache.search).toHaveBeenCalledWith('Arrival', 10);
  });

  it('does not reuse a remote pagination cursor against local ordering', async () => {
    const remote = createRemote();
    const cache = createCache();
    const networkError = new Error('Network unavailable');
    remote.search.mockRejectedValue(networkError);
    const service = createCachedMovieCatalogService(remote, cache);

    await expect(
      service.search('Arrival', { cursor: 'remote-next-page' })
    ).rejects.toBe(networkError);
    expect(cache.search).not.toHaveBeenCalled();
  });

  it('returns cached details when the remote catalog cannot be reached', async () => {
    const remote = createRemote();
    const cache = createCache();
    remote.getById.mockRejectedValue(new Error('Network unavailable'));
    cache.getById.mockResolvedValue(arrival);
    const service = createCachedMovieCatalogService(remote, cache);

    await expect(service.getById(arrival.catalogId)).resolves.toEqual({
      ...arrival,
      overview: null,
    });
    expect(cache.markAccessed).toHaveBeenCalledWith(arrival.catalogId);
  });
});
