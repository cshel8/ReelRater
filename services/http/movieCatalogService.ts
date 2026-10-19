import { apiBaseUrl } from '@/config/api';
import type { MediaCatalogService } from '@/services/contracts';
import type {
  MediaDetails,
  MediaSearchPage,
  MediaSummary,
  ReviewMediaTarget,
} from '@/types/domain';

const readMediaTarget = (
  candidate: Record<string, unknown>
): ReviewMediaTarget =>
  candidate.mediaType === 'tv' && candidate.reviewTargetType === 'series'
    ? { mediaType: 'tv', reviewTargetType: 'series' }
    : { mediaType: 'movie', reviewTargetType: 'movie' };

export const readMediaSummary = (value: unknown): MediaSummary | null => {
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
    ...readMediaTarget(candidate),
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
    ...(typeof candidate.backdropUrl === 'string'
      ? { backdropUrl: candidate.backdropUrl }
      : {}),
  };
};

export const getCatalogErrorMessage = async (response: Response) => {
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

/**
 * A fast reachability probe against the ReelRater API's health endpoint,
 * used to distinguish "no matches" from "the catalog could not be searched"
 * when a search returns nothing.
 */
export const isCatalogServiceReachable = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${apiBaseUrl}/health`, {
      headers: { Accept: 'application/json' },
    });
    return response.ok;
  } catch {
    return false;
  }
};

export const httpMediaCatalogService: MediaCatalogService = {
  async search(query, options): Promise<MediaSearchPage> {
    const url = new URL(`${apiBaseUrl}/api/v1/media/search`);
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
    if (options?.mediaType) {
      url.searchParams.set('mediaType', options.mediaType);
    }

    const response = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(await getCatalogErrorMessage(response));
    }

    const body = await response.json() as {
      items?: unknown;
      movies?: unknown;
      nextCursor?: unknown;
    };
    const rawItems = Array.isArray(body.items) ? body.items : body.movies;
    return {
      items: Array.isArray(rawItems)
        ? rawItems.flatMap((item) => {
            const parsed = readMediaSummary(item);
            return parsed ? [parsed] : [];
          })
        : [],
      nextCursor:
        typeof body.nextCursor === 'string' ? body.nextCursor : null,
    };
  },

  async getById(catalogId): Promise<MediaDetails | null> {
    const response = await fetch(
      `${apiBaseUrl}/api/v1/media/${encodeURIComponent(catalogId)}`,
      { headers: { Accept: 'application/json' } }
    );
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(await getCatalogErrorMessage(response));
    }

    const body = await response.json() as Record<string, unknown>;
    const summary = readMediaSummary(body);
    return summary
      ? {
          ...summary,
          overview: typeof body.overview === 'string' ? body.overview : null,
          ...(typeof body.rating === 'number'
            ? { rating: body.rating }
            : {}),
        }
      : null;
  },
};

/** @deprecated Prefer httpMediaCatalogService for new code. */
export const httpMovieCatalogService = httpMediaCatalogService;
