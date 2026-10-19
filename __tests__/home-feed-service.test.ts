import type {
  MediaBrowseService,
} from '@/services/contracts';
import type { HomeSnapshotRepository } from '@/services/local/homeSnapshotTypes';
import type { MovieCacheRepository } from '@/services/local/movieCacheTypes';
import { createHomeFeedService } from '@/services/movies/homeFeedService';
import type { MediaSummary } from '@/types/domain';

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

const severance: MediaSummary = {
  mediaType: 'tv',
  reviewTargetType: 'series',
  catalogId: 'tmdb:tv:95396',
  title: 'Severance',
  releaseYear: 2022,
  genres: ['Drama'],
  posterUrl: null,
};

const now = new Date('2026-10-18T12:00:00.000Z');

const createBrowse = (): jest.Mocked<MediaBrowseService> => ({
  trending: jest.fn().mockResolvedValue([dune]),
  popular: jest.fn().mockResolvedValue([severance]),
  recommendationsFor: jest.fn().mockResolvedValue([]),
});

const createSnapshots = (): jest.Mocked<HomeSnapshotRepository> => ({
  get: jest.fn().mockResolvedValue(null),
  replace: jest.fn().mockResolvedValue(undefined),
  clear: jest.fn().mockResolvedValue(undefined),
});

const createMovieCache = (): jest.Mocked<MovieCacheRepository> => ({
  cache: jest.fn().mockResolvedValue(undefined),
  search: jest.fn().mockResolvedValue([]),
  getById: jest.fn().mockResolvedValue(null),
  listDueForRefresh: jest.fn().mockResolvedValue([]),
  purgeExpired: jest.fn().mockResolvedValue(undefined),
  markAccessed: jest.fn().mockResolvedValue(undefined),
  clear: jest.fn().mockResolvedValue(undefined),
});

describe('Home feed service', () => {
  it('fetches a section remotely, snapshots it, and seeds the movie cache', async () => {
    const browse = createBrowse();
    const snapshots = createSnapshots();
    const movieCache = createMovieCache();
    const service = createHomeFeedService(
      browse,
      snapshots,
      movieCache,
      () => now
    );

    await expect(service.getSection('trending')).resolves.toEqual({
      items: [dune],
      source: 'remote',
      fetchedAt: now.toISOString(),
      remoteError: null,
    });
    expect(browse.trending).toHaveBeenCalledWith({ maximumResults: 10 });
    expect(snapshots.replace).toHaveBeenCalledWith({
      section: 'trending',
      items: [dune],
      fetchedAt: now.toISOString(),
    });
    expect(movieCache.cache).toHaveBeenCalledWith([dune]);
  });

  it('routes popular sections to the matching media type', async () => {
    const browse = createBrowse();
    const service = createHomeFeedService(
      browse,
      createSnapshots(),
      createMovieCache(),
      () => now
    );

    await service.getSection('popularMovies');
    await service.getSection('popularTv');

    expect(browse.popular).toHaveBeenNthCalledWith(1, 'movie', {
      maximumResults: 20,
    });
    expect(browse.popular).toHaveBeenNthCalledWith(2, 'tv', {
      maximumResults: 20,
    });
  });

  it('serves a fresh snapshot without contacting the catalog', async () => {
    const browse = createBrowse();
    const snapshots = createSnapshots();
    const fetchedAt = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
    snapshots.get.mockResolvedValue({
      section: 'trending',
      items: [dune],
      fetchedAt,
    });
    const service = createHomeFeedService(
      browse,
      snapshots,
      createMovieCache(),
      () => now
    );

    await expect(service.getSection('trending')).resolves.toEqual({
      items: [dune],
      source: 'cache',
      fetchedAt,
      remoteError: null,
    });
    expect(browse.trending).not.toHaveBeenCalled();
  });

  it('refreshes a stale snapshot and replaces it', async () => {
    const browse = createBrowse();
    const snapshots = createSnapshots();
    snapshots.get.mockResolvedValue({
      section: 'trending',
      items: [severance],
      fetchedAt: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
    });
    const service = createHomeFeedService(
      browse,
      snapshots,
      createMovieCache(),
      () => now
    );

    await expect(service.getSection('trending')).resolves.toMatchObject({
      items: [dune],
      source: 'remote',
    });
    expect(snapshots.replace).toHaveBeenCalled();
  });

  it('bypasses a fresh snapshot when a refresh is forced', async () => {
    const browse = createBrowse();
    const snapshots = createSnapshots();
    snapshots.get.mockResolvedValue({
      section: 'trending',
      items: [severance],
      fetchedAt: now.toISOString(),
    });
    const service = createHomeFeedService(
      browse,
      snapshots,
      createMovieCache(),
      () => now
    );

    await expect(
      service.getSection('trending', { forceRefresh: true })
    ).resolves.toMatchObject({ items: [dune], source: 'remote' });
  });

  it('falls back to the stored snapshot when the catalog is unreachable', async () => {
    const browse = createBrowse();
    const snapshots = createSnapshots();
    browse.trending.mockRejectedValue(new Error('Network unavailable'));
    const fetchedAt = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    snapshots.get.mockResolvedValue({
      section: 'trending',
      items: [dune],
      fetchedAt,
    });
    const service = createHomeFeedService(
      browse,
      snapshots,
      createMovieCache(),
      () => now
    );

    await expect(service.getSection('trending')).resolves.toEqual({
      items: [dune],
      source: 'cache',
      fetchedAt,
      remoteError: 'Network unavailable',
    });
    expect(snapshots.replace).not.toHaveBeenCalled();
  });

  it('reports an empty section when offline with no stored snapshot', async () => {
    const browse = createBrowse();
    browse.trending.mockRejectedValue(new Error('Network unavailable'));
    const service = createHomeFeedService(
      browse,
      createSnapshots(),
      createMovieCache(),
      () => now
    );

    await expect(service.getSection('trending')).resolves.toEqual({
      items: [],
      source: 'cache',
      fetchedAt: null,
      remoteError: 'Network unavailable',
    });
  });

  it('shares one in-flight load per section', async () => {
    const browse = createBrowse();
    let releaseTrending!: (items: MediaSummary[]) => void;
    browse.trending.mockReturnValue(
      new Promise((resolve) => {
        releaseTrending = resolve;
      })
    );
    const service = createHomeFeedService(
      browse,
      createSnapshots(),
      createMovieCache(),
      () => now
    );

    const first = service.getSection('trending');
    const second = service.getSection('trending');
    releaseTrending([dune]);
    await Promise.all([first, second]);

    expect(browse.trending).toHaveBeenCalledTimes(1);

    await service.getSection('trending', { forceRefresh: true });
    expect(browse.trending).toHaveBeenCalledTimes(2);
  });

  it('still returns remote results when snapshot persistence fails', async () => {
    const browse = createBrowse();
    const snapshots = createSnapshots();
    snapshots.get.mockRejectedValue(new Error('Database unavailable'));
    snapshots.replace.mockRejectedValue(new Error('Database unavailable'));
    const movieCache = createMovieCache();
    movieCache.cache.mockRejectedValue(new Error('Database unavailable'));
    const service = createHomeFeedService(
      browse,
      snapshots,
      movieCache,
      () => now
    );

    await expect(service.getSection('trending')).resolves.toMatchObject({
      items: [dune],
      source: 'remote',
      remoteError: null,
    });
  });
});
