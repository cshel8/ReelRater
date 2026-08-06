import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TmdbMovieCatalog } from './tmdbMovieCatalog.js';

test('TMDB adapter normalizes search results and keeps pagination opaque', async () => {
  const requests: { url: URL; authorization: string | null }[] = [];
  const fetchMock = (async (
    input: string | URL | Request,
    init?: RequestInit
  ) => {
    const url = new URL(input instanceof Request ? input.url : input);
    requests.push({
      url,
      authorization: new Headers(init?.headers).get('authorization'),
    });

    if (url.pathname.endsWith('/configuration')) {
      return Response.json({
        images: {
          secure_base_url: 'https://image.example/',
          poster_sizes: ['w185', 'w342', 'original'],
        },
      });
    }
    if (url.pathname.endsWith('/genre/movie/list')) {
      return Response.json({
        genres: [
          { id: 18, name: 'Drama' },
          { id: 878, name: 'Science Fiction' },
        ],
      });
    }
    if (url.pathname.endsWith('/search/movie')) {
      const page = Number.parseInt(url.searchParams.get('page') ?? '1', 10);
      return Response.json({
        page,
        total_pages: 2,
        results: [
          {
            id: 329865,
            title: 'Arrival',
            release_date: '2016-11-11',
            genre_ids: [18, 878],
            poster_path: '/arrival.jpg',
          },
        ],
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  }) as typeof fetch;

  const catalog = new TmdbMovieCatalog('test-token', fetchMock);
  const firstPage = await catalog.search('Arrival');

  assert.deepEqual(firstPage.items, [
    {
      mediaType: 'movie',
      reviewTargetType: 'movie',
      catalogId: 'tmdb:movie:329865',
      title: 'Arrival',
      releaseYear: 2016,
      genres: ['Drama', 'Science Fiction'],
      posterUrl: 'https://image.example/w342/arrival.jpg',
    },
  ]);
  assert.notEqual(firstPage.nextCursor, null);

  await catalog.search('Arrival', { cursor: firstPage.nextCursor! });
  const searchRequests = requests.filter((request) =>
    request.url.pathname.endsWith('/search/movie')
  );
  assert.equal(searchRequests[1].url.searchParams.get('page'), '2');
  assert.equal(
    requests.every(
      (request) => request.authorization === 'Bearer test-token'
    ),
    true
  );
});

test('TMDB adapter normalizes movie details', async () => {
  const fetchMock = (async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.pathname.endsWith('/configuration')) {
      return Response.json({
        images: {
          secure_base_url: 'https://image.example/',
          poster_sizes: ['w500'],
        },
      });
    }
    if (url.pathname.endsWith('/movie/329865')) {
      return Response.json({
        id: 329865,
        title: 'Arrival',
        release_date: '2016-11-11',
        genres: [{ id: 878, name: 'Science Fiction' }],
        poster_path: '/arrival.jpg',
        overview: 'A linguist works with the military.',
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  }) as typeof fetch;

  const catalog = new TmdbMovieCatalog('test-token', fetchMock);

  assert.deepEqual(await catalog.getById('tmdb:329865'), {
    mediaType: 'movie',
    reviewTargetType: 'movie',
    catalogId: 'tmdb:movie:329865',
    title: 'Arrival',
    releaseYear: 2016,
    genres: ['Science Fiction'],
    posterUrl: 'https://image.example/w500/arrival.jpg',
    overview: 'A linguist works with the military.',
  });
});

test('TMDB adapter normalizes TV series search and details', async () => {
  const fetchMock = (async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.pathname.endsWith('/configuration')) {
      return Response.json({
        images: {
          secure_base_url: 'https://image.example/',
          poster_sizes: ['w342'],
        },
      });
    }
    if (url.pathname.endsWith('/genre/tv/list')) {
      return Response.json({
        genres: [
          { id: 16, name: 'Animation' },
          { id: 10759, name: 'Action & Adventure' },
        ],
      });
    }
    if (url.pathname.endsWith('/search/tv')) {
      return Response.json({
        page: 1,
        total_pages: 1,
        results: [
          {
            id: 61709,
            name: 'Dragon Ball Z Kai',
            first_air_date: '2009-04-05',
            genre_ids: [16, 10759],
            poster_path: '/kai.jpg',
          },
        ],
      });
    }
    if (url.pathname.endsWith('/tv/61709')) {
      return Response.json({
        id: 61709,
        name: 'Dragon Ball Z Kai',
        first_air_date: '2009-04-05',
        genres: [{ id: 16, name: 'Animation' }],
        poster_path: '/kai.jpg',
        overview: 'An updated version of Dragon Ball Z.',
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  }) as typeof fetch;

  const catalog = new TmdbMovieCatalog('test-token', fetchMock);

  assert.deepEqual(
    await catalog.search('Dragon Ball Z Kai', { mediaType: 'tv' }),
    {
      items: [
        {
          mediaType: 'tv',
          reviewTargetType: 'series',
          catalogId: 'tmdb:tv:61709',
          title: 'Dragon Ball Z Kai',
          releaseYear: 2009,
          genres: ['Animation', 'Action & Adventure'],
          posterUrl: 'https://image.example/w342/kai.jpg',
        },
      ],
      nextCursor: null,
    }
  );
  assert.deepEqual(await catalog.getById('tmdb:tv:61709'), {
    mediaType: 'tv',
    reviewTargetType: 'series',
    catalogId: 'tmdb:tv:61709',
    title: 'Dragon Ball Z Kai',
    releaseYear: 2009,
    genres: ['Animation'],
    posterUrl: 'https://image.example/w342/kai.jpg',
    overview: 'An updated version of Dragon Ball Z.',
  });
});
