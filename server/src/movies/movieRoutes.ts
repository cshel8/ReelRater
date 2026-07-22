import { Router, type Response } from 'express';
import {
  InvalidMovieCatalogIdError,
  InvalidMovieCursorError,
  MovieCatalogUnavailableError,
  MovieCatalogUpstreamError,
  type MovieCatalogService,
} from './types.js';

const respondToCatalogError = (response: Response, error: unknown) => {
  if (
    error instanceof InvalidMovieCatalogIdError ||
    error instanceof InvalidMovieCursorError
  ) {
    response.status(400).json({
      error: { code: 'invalid_request', message: error.message },
    });
    return;
  }
  if (error instanceof MovieCatalogUnavailableError) {
    response.status(503).json({
      error: { code: 'movie_catalog_unavailable', message: error.message },
    });
    return;
  }
  if (error instanceof MovieCatalogUpstreamError) {
    response.status(502).json({
      error: {
        code: 'movie_catalog_error',
        message: 'The external movie catalog could not complete the request.',
      },
    });
    return;
  }

  console.error('Unexpected movie catalog error', error);
  response.status(500).json({
    error: { code: 'internal_error', message: 'Unexpected server error.' },
  });
};

export const createMovieRouter = (movieCatalog: MovieCatalogService) => {
  const router = Router();

  router.get('/search', async (request, response) => {
    const query =
      typeof request.query.query === 'string'
        ? request.query.query.trim()
        : '';
    if (!query) {
      response.status(400).json({
        error: {
          code: 'invalid_request',
          message: 'A non-empty query parameter is required.',
        },
      });
      return;
    }

    const cursor =
      typeof request.query.cursor === 'string'
        ? request.query.cursor
        : undefined;
    const requestedMaximum =
      typeof request.query.maximumResults === 'string'
        ? Number.parseInt(request.query.maximumResults, 10)
        : undefined;
    const maximumResults = Number.isFinite(requestedMaximum)
      ? Math.min(20, Math.max(1, requestedMaximum!))
      : undefined;

    try {
      response.status(200).json(
        await movieCatalog.search(query, { cursor, maximumResults })
      );
    } catch (error) {
      respondToCatalogError(response, error);
    }
  });

  router.get('/:catalogId', async (request, response) => {
    try {
      const movie = await movieCatalog.getById(request.params.catalogId);
      if (!movie) {
        response.status(404).json({
          error: { code: 'movie_not_found', message: 'Movie not found.' },
        });
        return;
      }
      response.status(200).json(movie);
    } catch (error) {
      respondToCatalogError(response, error);
    }
  });

  return router;
};
