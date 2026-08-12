import express from 'express';
import { hostname } from 'node:os';
import { createMediaRouter, createMovieRouter } from './movies/movieRoutes.js';
import { TmdbMediaCatalog } from './movies/tmdbMovieCatalog.js';
import type { MediaCatalogService } from './movies/types.js';
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
import { createSocialRouter } from './social/socialRoutes.js';
import { firebaseSocialGraph } from './social/firebaseSocialGraph.js';
import type { SocialGraphService } from './social/types.js';

export const createApp = (
  options: {
    mediaCatalog?: MediaCatalogService;
    /** @deprecated Prefer mediaCatalog. */
    movieCatalog?: MediaCatalogService;
    accountIdentityVerifier?: AccountIdentityVerifier;
    accountDataDeleter?: AccountDataDeleter;
    socialGraph?: SocialGraphService;
  } = {}
) => {
  const app = express();
  const token = process.env.TMDB_READ_ACCESS_TOKEN?.trim();
  const mediaCatalog =
    options.mediaCatalog ??
    options.movieCatalog ??
    (token ? new TmdbMediaCatalog(token) : unavailableMovieCatalog);

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

  app.use('/api/v1/media', createMediaRouter(mediaCatalog));
  app.use('/api/v1/movies', createMovieRouter(mediaCatalog));
  app.use(
    '/api/v1/account',
    createAccountRouter(
      options.accountIdentityVerifier ?? firebaseAccountIdentityVerifier,
      options.accountDataDeleter ?? firebaseAccountDataDeleter
    )
  );
  app.use(
    '/api/v1/social',
    createSocialRouter(
      options.accountIdentityVerifier ?? firebaseAccountIdentityVerifier,
      options.socialGraph ?? firebaseSocialGraph
    )
  );

  return app;
};
