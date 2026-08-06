import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { after, before, test } from 'node:test';
import { createApp } from '../app.js';
import type { MediaSummary, MovieCatalogService } from './types.js';
import { unavailableMovieCatalog } from './unavailableMovieCatalog.js';

let server: Server;
let baseUrl: string;
const searches: unknown[][] = [];

const fakeCatalog: MovieCatalogService = {
  async search(query, options) {
    searches.push([query, options]);
    const isTv = options?.mediaType === 'tv';
    const item: MediaSummary = isTv
      ? {
          mediaType: 'tv',
          reviewTargetType: 'series',
          catalogId: 'catalog:tv:1',
          title: 'Dragon Ball Z Kai',
          releaseYear: 2009,
          genres: ['Animation'],
          posterUrl: null,
        }
      : {
          mediaType: 'movie',
          reviewTargetType: 'movie',
          catalogId: 'catalog:1',
          title: 'Arrival',
          releaseYear: 2016,
          genres: ['Science Fiction'],
          posterUrl: null,
        };
    return {
      items: [item],
      nextCursor: 'next-page',
    };
  },
  async getById(catalogId) {
    return catalogId === 'catalog:1'
      ? {
          mediaType: 'movie',
          reviewTargetType: 'movie',
          catalogId,
          title: 'Arrival',
          releaseYear: 2016,
          genres: ['Science Fiction'],
          posterUrl: null,
          overview: 'First contact.',
        }
      : null;
  },
};

before(async () => {
  server = createApp({ movieCatalog: fakeCatalog }).listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Test server did not bind to a TCP port');
  }
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test('movie search endpoint returns normalized catalog results', async () => {
  const response = await fetch(
    `${baseUrl}/api/v1/movies/search?query=Arrival&maximumResults=5`
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    movies: [
      {
        mediaType: 'movie',
        reviewTargetType: 'movie',
        catalogId: 'catalog:1',
        title: 'Arrival',
        releaseYear: 2016,
        genres: ['Science Fiction'],
        posterUrl: null,
      },
    ],
    nextCursor: 'next-page',
  });
  assert.deepEqual(searches[0], [
    'Arrival',
    { cursor: undefined, maximumResults: 5, mediaType: 'movie' },
  ]);
});

test('media search endpoint returns normalized TV series', async () => {
  const response = await fetch(
    `${baseUrl}/api/v1/media/search?query=Dragon%20Ball%20Z%20Kai&mediaType=tv`
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    items: [
      {
        mediaType: 'tv',
        reviewTargetType: 'series',
        catalogId: 'catalog:tv:1',
        title: 'Dragon Ball Z Kai',
        releaseYear: 2009,
        genres: ['Animation'],
        posterUrl: null,
      },
    ],
    nextCursor: 'next-page',
  });
  assert.deepEqual(searches[1], [
    'Dragon Ball Z Kai',
    { cursor: undefined, maximumResults: undefined, mediaType: 'tv' },
  ]);
});

test('movie details endpoint returns a normalized movie', async () => {
  const response = await fetch(
    `${baseUrl}/api/v1/movies/${encodeURIComponent('catalog:1')}`
  );

  assert.equal(response.status, 200);
  assert.equal((await response.json() as { title: string }).title, 'Arrival');
});

test('movie search endpoint rejects an empty query', async () => {
  const response = await fetch(`${baseUrl}/api/v1/movies/search`);
  const body = await response.json() as { error: { code: string } };

  assert.equal(response.status, 400);
  assert.equal(body.error.code, 'invalid_request');
});

test('unconfigured movie catalog returns a service-unavailable response', async () => {
  const unavailableServer = createApp({
    movieCatalog: unavailableMovieCatalog,
  }).listen(0, '127.0.0.1');
  await new Promise<void>((resolve) =>
    unavailableServer.once('listening', resolve)
  );

  try {
    const address = unavailableServer.address();
    if (!address || typeof address === 'string') {
      throw new Error('Test server did not bind to a TCP port');
    }
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/v1/movies/search?query=Arrival`
    );
    const body = await response.json() as { error: { code: string } };

    assert.equal(response.status, 503);
    assert.equal(body.error.code, 'movie_catalog_unavailable');
  } finally {
    await new Promise<void>((resolve, reject) => {
      unavailableServer.close((error) =>
        error ? reject(error) : resolve()
      );
    });
  }
});
