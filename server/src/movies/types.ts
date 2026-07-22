export type MovieCatalogId = string;

export type MovieSummary = {
  catalogId: MovieCatalogId;
  title: string;
  releaseYear: number | null;
  genres: string[];
  posterUrl: string | null;
};

export type MovieDetails = MovieSummary & {
  overview: string | null;
};

export type MovieSearchOptions = {
  cursor?: string;
  maximumResults?: number;
};

export type MovieSearchPage = {
  movies: MovieSummary[];
  nextCursor: string | null;
};

export interface MovieCatalogService {
  search(
    query: string,
    options?: MovieSearchOptions
  ): Promise<MovieSearchPage>;
  getById(catalogId: MovieCatalogId): Promise<MovieDetails | null>;
}

export class InvalidMovieCatalogIdError extends Error {}

export class InvalidMovieCursorError extends Error {}

export class MovieCatalogUnavailableError extends Error {}

export class MovieCatalogUpstreamError extends Error {
  constructor(public readonly status: number) {
    super(`Movie catalog request failed with status ${status}`);
  }
}
