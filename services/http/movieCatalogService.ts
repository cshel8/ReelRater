import { apiBaseUrl } from '@/config/api';
import type { MovieCatalogService } from '@/services/contracts';
import type {
  MovieDetails,
  MovieSearchPage,
  MovieSummary,
} from '@/types/domain';

const readMovieSummary = (value: unknown): MovieSummary | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.catalogId !== 'string' ||
    typeof candidate.title !== 'string'
  ) {
    return null;
  }

  return {
    catalogId: candidate.catalogId,
    title: candidate.title,
    releaseYear:
      typeof candidate.releaseYear === 'number'
        ? candidate.releaseYear
        : null,
    genres: Array.isArray(candidate.genres)
      ? candidate.genres.filter(
          (genre): genre is string => typeof genre === 'string'
        )
      : [],
    posterUrl:
      typeof candidate.posterUrl === 'string' ? candidate.posterUrl : null,
  };
};

const getErrorMessage = async (response: Response) => {
  try {
    const body = await response.json() as {
      error?: { message?: unknown };
    };
    if (typeof body.error?.message === 'string') {
      return body.error.message;
    }
  } catch {
    // The status-based fallback below also handles non-JSON responses.
  }
  return `Movie service request failed with status ${response.status}`;
};

export const httpMovieCatalogService: MovieCatalogService = {
  async search(query, options): Promise<MovieSearchPage> {
    const url = new URL(`${apiBaseUrl}/api/v1/movies/search`);
    url.searchParams.set('query', query);
    if (options?.cursor) {
      url.searchParams.set('cursor', options.cursor);
    }
    if (options?.maximumResults !== undefined) {
      url.searchParams.set(
        'maximumResults',
        String(options.maximumResults)
      );
    }

    const response = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(await getErrorMessage(response));
    }

    const body = await response.json() as {
      movies?: unknown;
      nextCursor?: unknown;
    };
    return {
      movies: Array.isArray(body.movies)
        ? body.movies.flatMap((movie) => {
            const parsed = readMovieSummary(movie);
            return parsed ? [parsed] : [];
          })
        : [],
      nextCursor:
        typeof body.nextCursor === 'string' ? body.nextCursor : null,
    };
  },

  async getById(catalogId): Promise<MovieDetails | null> {
    const response = await fetch(
      `${apiBaseUrl}/api/v1/movies/${encodeURIComponent(catalogId)}`,
      { headers: { Accept: 'application/json' } }
    );
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(await getErrorMessage(response));
    }

    const body = await response.json() as Record<string, unknown>;
    const summary = readMovieSummary(body);
    return summary
      ? {
          ...summary,
          overview: typeof body.overview === 'string' ? body.overview : null,
        }
      : null;
  },
};
