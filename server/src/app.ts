import express from 'express';
import { hostname } from 'node:os';
import { createMovieRouter } from './movies/movieRoutes.js';
import { TmdbMovieCatalog } from './movies/tmdbMovieCatalog.js';
import type { MovieCatalogService } from './movies/types.js';
import { unavailableMovieCatalog } from './movies/unavailableMovieCatalog.js';
import { createAccountRouter } from './accounts/accountRoutes.js';
import {
  firebaseAccountDataDeleter,
  firebaseAccountIdentityVerifier,
} from './accounts/firebaseAccountDeletion.js';
import type {
  AccountDataDeleter,
  AccountIdentityVerifier,
} from './accounts/types.js';

export const createApp = (
  options: {
    movieCatalog?: MovieCatalogService;
    accountIdentityVerifier?: AccountIdentityVerifier;
    accountDataDeleter?: AccountDataDeleter;
  } = {}
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
  app.use(
    '/api/v1/account',
    createAccountRouter(
      options.accountIdentityVerifier ?? firebaseAccountIdentityVerifier,
      options.accountDataDeleter ?? firebaseAccountDataDeleter
    )
  );

  return app;
};
