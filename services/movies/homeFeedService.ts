import type {
  HomeFeedService,
  HomeSection,
  HomeSectionContent,
  MediaBrowseService,
} from '@/services/contracts';
import type { HomeSnapshotRepository } from '@/services/local/homeSnapshotTypes';
import type { MovieCacheRepository } from '@/services/local/movieCacheTypes';
import type { MediaSummary } from '@/types/domain';

const DEFAULT_FRESHNESS_WINDOW_MS = 15 * 60 * 1000;

const SECTION_MAXIMUMS: Record<HomeSection, number> = {
  trending: 10,
  popularMovies: 20,
  popularTv: 20,
};

const isFresh = (
  fetchedAt: string,
  now: Date,
  freshnessWindowMs: number
) => {
  const fetchedAtMs = new Date(fetchedAt).getTime();
  return (
    Number.isFinite(fetchedAtMs) &&
    now.getTime() - fetchedAtMs < freshnessWindowMs
  );
};

export const createHomeFeedService = (
  browseCatalog: MediaBrowseService,
  snapshots: HomeSnapshotRepository,
  movieCache: MovieCacheRepository,
  clock: () => Date = () => new Date(),
  freshnessWindowMs = DEFAULT_FRESHNESS_WINDOW_MS
): HomeFeedService => {
  const activeLoads = new Map<HomeSection, Promise<HomeSectionContent>>();

  const fetchSection = (section: HomeSection): Promise<MediaSummary[]> => {
    const maximumResults = SECTION_MAXIMUMS[section];
    switch (section) {
      case 'trending':
        return browseCatalog.trending({ maximumResults });
      case 'popularMovies':
        return browseCatalog.popular('movie', { maximumResults });
      case 'popularTv':
        return browseCatalog.popular('tv', { maximumResults });
    }
  };

  const loadSection = async (
    section: HomeSection,
    forceRefresh: boolean
  ): Promise<HomeSectionContent> => {
    const snapshot = await snapshots
      .get(section)
      .catch(() => null);

    if (
      snapshot &&
      !forceRefresh &&
      isFresh(snapshot.fetchedAt, clock(), freshnessWindowMs)
    ) {
      return {
        items: snapshot.items,
        source: 'cache',
        fetchedAt: snapshot.fetchedAt,
        remoteError: null,
      };
    }

    try {
      const items = await fetchSection(section);
      const fetchedAt = clock().toISOString();
      await snapshots
        .replace({ section, items, fetchedAt })
        .catch((error) => {
          console.log(
            'Unable to persist Home snapshot:',
            error instanceof Error ? error.message : error
          );
        });
      await movieCache.cache(items).catch((error) => {
        console.log(
          'Unable to cache Home browse results:',
          error instanceof Error ? error.message : error
        );
      });
      return { items, source: 'remote', fetchedAt, remoteError: null };
    } catch (error) {
      const remoteError =
        error instanceof Error
          ? error.message
          : 'Unable to load catalog content.';
      if (snapshot) {
        return {
          items: snapshot.items,
          source: 'cache',
          fetchedAt: snapshot.fetchedAt,
          remoteError,
        };
      }
      return { items: [], source: 'cache', fetchedAt: null, remoteError };
    }
  };

  return {
    getSection(section, options) {
      const active = activeLoads.get(section);
      if (active) {
        return active;
      }

      const load = loadSection(section, options?.forceRefresh === true)
        .finally(() => {
          activeLoads.delete(section);
        });
      activeLoads.set(section, load);
      return load;
    },
  };
};
