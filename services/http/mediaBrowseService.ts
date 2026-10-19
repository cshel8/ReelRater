import { apiBaseUrl } from '@/config/api';
import type {
  MediaBrowseOptions,
  MediaBrowseService,
} from '@/services/contracts';
import {
  getCatalogErrorMessage,
  readMediaSummary,
} from '@/services/http/movieCatalogService';
import type { MediaSummary } from '@/types/domain';

const fetchBrowseItems = async (
  url: URL,
  options?: MediaBrowseOptions
): Promise<MediaSummary[]> => {
  if (options?.maximumResults !== undefined) {
    url.searchParams.set('maximumResults', String(options.maximumResults));
  }

  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(await getCatalogErrorMessage(response));
  }

  const body = await response.json() as { items?: unknown };
  return Array.isArray(body.items)
    ? body.items.flatMap((item) => {
        const parsed = readMediaSummary(item);
        return parsed ? [parsed] : [];
      })
    : [];
};

export const httpMediaBrowseService: MediaBrowseService = {
  async trending(options) {
    return fetchBrowseItems(
      new URL(`${apiBaseUrl}/api/v1/media/trending`),
      options
    );
  },

  async popular(mediaType, options) {
    const url = new URL(`${apiBaseUrl}/api/v1/media/popular`);
    url.searchParams.set('mediaType', mediaType);
    return fetchBrowseItems(url, options);
  },
};
