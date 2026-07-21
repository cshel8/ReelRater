import express from 'express';
import { hostname } from 'node:os';
import { createMovieRouter } from './movies/movieRoutes.js';
import { TmdbMovieCatalog } from './movies/tmdbMovieCatalog.js';
import type { MovieCatalogService } from './movies/types.js';
import { unavailableMovieCatalog } from './movies/unavailableMovieCatalog.js';

export const createApp = (
  options: { movieCatalog?: MovieCatalogService } = {}
) => {
  const app = express();
  const token = process.env.TMDB_READ_ACCESS_TOKEN?.trim();
  const movieCatalog =
    options.movieCatalog ??
    (token ? new TmdbMovieCatalog(token) : unavailableMovieCatalog);

  app.disable('x-powered-by');
  app.use(express.json());

  app.get('/health', (_request, response) => {
    response.set('Cache-Control', 'no-store');
    response.status(200).json({
      ok: true,
      app: 'reelrater',
      served_by: hostname(),
      time: new Date().toISOString(),
    });
  });

  app.use('/api/v1/movies', createMovieRouter(movieCatalog));

  return app;
};
