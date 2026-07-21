import type { MovieCatalogService } from '@/services/contracts';
import type { MovieCacheRepository } from '@/services/local/movieCacheTypes';

export const createCachedMovieCatalogService = (
  remoteCatalog: MovieCatalogService,
  movieCache: MovieCacheRepository
): MovieCatalogService => ({
  async search(query, options) {
    try {
      const page = await remoteCatalog.search(query, options);
      await movieCache.cache(page.movies).catch((error) => {
        console.log(
          'Unable to cache movie search results:',
          error instanceof Error ? error.message : error
        );
      });
      return page;
    } catch (error) {
      // A remote continuation cursor cannot be meaningfully applied to the
      // differently ordered local cache. Initial searches can safely fall back.
      if (options?.cursor) {
        throw error;
      }

      return {
        movies: await movieCache.search(query, options?.maximumResults),
        nextCursor: null,
      };
    }
  },

  async getById(catalogId) {
    try {
      const movie = await remoteCatalog.getById(catalogId);
      if (movie) {
        await movieCache.cache([movie]).catch((error) => {
          console.log(
            'Unable to cache movie details:',
            error instanceof Error ? error.message : error
          );
        });
        await movieCache.markAccessed(catalogId).catch(() => undefined);
      }
      return movie;
    } catch {
      const cachedMovie = await movieCache.getById(catalogId);
      if (!cachedMovie) {
        return null;
      }
      await movieCache.markAccessed(catalogId).catch(() => undefined);
      return { ...cachedMovie, overview: null };
    }
  },
});
