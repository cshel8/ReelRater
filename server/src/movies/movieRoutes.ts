import { Router, type Response } from 'express';
import {
  InvalidMovieCatalogIdError,
  InvalidMovieCursorError,
  MovieCatalogUnavailableError,
  MovieCatalogUpstreamError,
  type MediaCatalogService,
  type MediaTarget,
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

type MediaRouterOptions = {
  forcedMediaType?: MediaTarget['mediaType'];
  legacyMovieResponse?: boolean;
};

export const createMediaRouter = (
  mediaCatalog: MediaCatalogService,
  options: MediaRouterOptions = {}
) => {
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
    const requestedMediaType =
      typeof request.query.mediaType === 'string'
        ? request.query.mediaType
        : undefined;
    if (
      requestedMediaType !== undefined &&
      requestedMediaType !== 'movie' &&
      requestedMediaType !== 'tv'
    ) {
      response.status(400).json({
        error: {
          code: 'invalid_request',
          message: 'mediaType must be either movie or tv.',
        },
      });
      return;
    }
    const mediaType =
      options.forcedMediaType ?? requestedMediaType ?? 'movie';

    try {
      const page = await mediaCatalog.search(query, {
        cursor,
        maximumResults,
        mediaType,
      });
      response.status(200).json(
        options.legacyMovieResponse
          ? { movies: page.items, nextCursor: page.nextCursor }
          : page
      );
    } catch (error) {
      respondToCatalogError(response, error);
    }
  });

  router.get('/:catalogId', async (request, response) => {
    try {
      const media = await mediaCatalog.getById(request.params.catalogId);
      if (!media) {
        response.status(404).json({
          error: { code: 'media_not_found', message: 'Media not found.' },
        });
        return;
      }
      response.status(200).json(media);
    } catch (error) {
      respondToCatalogError(response, error);
    }
  });

  return router;
};

export const createMovieRouter = (mediaCatalog: MediaCatalogService) =>
  createMediaRouter(mediaCatalog, {
    forcedMediaType: 'movie',
    legacyMovieResponse: true,
  });
