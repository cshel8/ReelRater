import {
  MovieCatalogUnavailableError,
  type MovieCatalogService,
} from './types.js';

const unavailable = (): never => {
  throw new MovieCatalogUnavailableError(
    'Movie search is not configured. Set TMDB_READ_ACCESS_TOKEN on the API server.'
  );
};

export const unavailableMovieCatalog: MovieCatalogService = {
  search: unavailable,
  getById: unavailable,
};
