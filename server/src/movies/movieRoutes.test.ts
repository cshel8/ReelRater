import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { after, before, test } from 'node:test';
import { createApp } from '../app.js';
import type { MediaSummary, MovieCatalogService } from './types.js';
import { unavailableMovieCatalog } from './unavailableMovieCatalog.js';

let server: Server;
let baseUrl: string;
const searches: unknown[][] = [];
const browseCalls: unknown[][] = [];

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
  async trending(options) {
    browseCalls.push(['trending', options]);
    return [
      {
        mediaType: 'movie',
        reviewTargetType: 'movie',
        catalogId: 'catalog:2',
        title: 'Dune: Part Two',
        releaseYear: 2024,
        genres: ['Science Fiction'],
        posterUrl: null,
        backdropUrl: 'https://image.example/w780/dune.jpg',
      },
    ];
  },
  async popular(mediaType, options) {
    browseCalls.push(['popular', mediaType, options]);
    return [
      mediaType === 'tv'
        ? {
            mediaType: 'tv',
            reviewTargetType: 'series',
            catalogId: 'catalog:tv:2',
            title: 'Severance',
            releaseYear: 2022,
            genres: ['Drama'],
            posterUrl: null,
            backdropUrl: null,
          }
        : {
            mediaType: 'movie',
            reviewTargetType: 'movie',
            catalogId: 'catalog:3',
            title: 'Arrival',
            releaseYear: 2016,
            genres: ['Science Fiction'],
            posterUrl: null,
            backdropUrl: null,
          },
    ];
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

test('trending endpoint returns browse items with backdrops', async () => {
  const response = await fetch(
    `${baseUrl}/api/v1/media/trending?maximumResults=10`
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    items: [
      {
        mediaType: 'movie',
        reviewTargetType: 'movie',
        catalogId: 'catalog:2',
        title: 'Dune: Part Two',
        releaseYear: 2024,
        genres: ['Science Fiction'],
        posterUrl: null,
        backdropUrl: 'https://image.example/w780/dune.jpg',
      },
    ],
  });
  assert.deepEqual(browseCalls.at(-1), [
    'trending',
    { maximumResults: 10 },
  ]);
});

test('popular endpoint returns movies and TV by mediaType', async () => {
  const movieResponse = await fetch(
    `${baseUrl}/api/v1/media/popular?mediaType=movie`
  );
  assert.equal(movieResponse.status, 200);
  const movieBody = await movieResponse.json() as {
    items: { catalogId: string }[];
  };
  assert.equal(movieBody.items[0].catalogId, 'catalog:3');

  const tvResponse = await fetch(
    `${baseUrl}/api/v1/media/popular?mediaType=tv`
  );
  assert.equal(tvResponse.status, 200);
  const tvBody = await tvResponse.json() as {
    items: { catalogId: string; mediaType: string }[];
  };
  assert.deepEqual(
    [tvBody.items[0].catalogId, tvBody.items[0].mediaType],
    ['catalog:tv:2', 'tv']
  );
});

test('popular endpoint rejects a missing or invalid mediaType', async () => {
  for (const suffix of ['', '?mediaType=book']) {
    const response = await fetch(`${baseUrl}/api/v1/media/popular${suffix}`);
    const body = await response.json() as { error: { code: string } };
    assert.equal(response.status, 400);
    assert.equal(body.error.code, 'invalid_request');
  }
});

test('legacy movie router does not expose browse endpoints', async () => {
  const response = await fetch(`${baseUrl}/api/v1/movies/trending`);
  assert.equal(response.status, 404);
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
