export type MediaCatalogId = string;

export type MediaTarget =
  | { mediaType: 'movie'; reviewTargetType: 'movie' }
  | { mediaType: 'tv'; reviewTargetType: 'series' };

export type MediaSummary = MediaTarget & {
  catalogId: MediaCatalogId;
  title: string;
  releaseYear: number | null;
  genres: string[];
  posterUrl: string | null;
  /** Wide hero image; supplied only by browse (trending/popular) results. */
  backdropUrl?: string | null;
};

export type MediaDetails = MediaSummary & {
  overview: string | null;
  /** The catalog's 0–10 community score, when it has one. */
  rating?: number | null;
};

export type MediaSearchOptions = {
  cursor?: string;
  maximumResults?: number;
  mediaType?: MediaTarget['mediaType'];
};

export type MediaSearchPage = {
  items: MediaSummary[];
  nextCursor: string | null;
};

export type MediaBrowseOptions = {
  maximumResults?: number;
};

export interface MediaCatalogService {
  search(
    query: string,
    options?: MediaSearchOptions
  ): Promise<MediaSearchPage>;
  getById(catalogId: MediaCatalogId): Promise<MediaDetails | null>;
  trending(options?: MediaBrowseOptions): Promise<MediaSummary[]>;
  popular(
    mediaType: MediaTarget['mediaType'],
    options?: MediaBrowseOptions
  ): Promise<MediaSummary[]>;
  /** Titles the catalog recommends alongside the given movie or series. */
  recommendationsFor(
    catalogId: MediaCatalogId,
    options?: MediaBrowseOptions
  ): Promise<MediaSummary[]>;
}

/** Compatibility aliases while existing movie-specific files are migrated. */
export type MovieCatalogId = MediaCatalogId;
export type MovieSummary = MediaSummary;
export type MovieDetails = MediaDetails;
export type MovieSearchOptions = MediaSearchOptions;
export type MovieSearchPage = MediaSearchPage;
export type MovieCatalogService = MediaCatalogService;

export class InvalidMovieCatalogIdError extends Error {}

export class InvalidMovieCursorError extends Error {}

export class MovieCatalogUnavailableError extends Error {}

export class MovieCatalogUpstreamError extends Error {
  constructor(public readonly status: number) {
    super(`Movie catalog request failed with status ${status}`);
  }
}
