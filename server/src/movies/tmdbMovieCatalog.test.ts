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

test('TMDB adapter normalizes trending and popular browse results', async () => {
  const fetchMock = (async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.pathname.endsWith('/configuration')) {
      return Response.json({
        images: {
          secure_base_url: 'https://image.example/',
          poster_sizes: ['w342'],
          backdrop_sizes: ['w300', 'w780', 'original'],
        },
      });
    }
    if (url.pathname.endsWith('/genre/movie/list')) {
      return Response.json({
        genres: [{ id: 878, name: 'Science Fiction' }],
      });
    }
    if (url.pathname.endsWith('/genre/tv/list')) {
      return Response.json({
        genres: [{ id: 18, name: 'Drama' }],
      });
    }
    if (url.pathname.endsWith('/trending/movie/week')) {
      return Response.json({
        page: 1,
        total_pages: 1,
        results: [
          {
            id: 693134,
            title: 'Dune: Part Two',
            release_date: '2024-02-27',
            genre_ids: [878],
            poster_path: '/dune2.jpg',
            backdrop_path: '/dune2-wide.jpg',
          },
          {
            id: 1,
            title: 'No Backdrop',
            release_date: '2020-01-01',
            genre_ids: [],
            poster_path: null,
            backdrop_path: null,
          },
        ],
      });
    }
    if (url.pathname.endsWith('/movie/popular')) {
      return Response.json({
        page: 1,
        total_pages: 1,
        results: [
          {
            id: 329865,
            title: 'Arrival',
            release_date: '2016-11-11',
            genre_ids: [878],
            poster_path: '/arrival.jpg',
            backdrop_path: '/arrival-wide.jpg',
          },
        ],
      });
    }
    if (url.pathname.endsWith('/tv/popular')) {
      return Response.json({
        page: 1,
        total_pages: 1,
        results: [
          {
            id: 95396,
            name: 'Severance',
            first_air_date: '2022-02-17',
            genre_ids: [18],
            poster_path: '/severance.jpg',
            backdrop_path: '/severance-wide.jpg',
          },
        ],
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  }) as typeof fetch;

  const catalog = new TmdbMovieCatalog('test-token', fetchMock);

  assert.deepEqual(await catalog.trending({ maximumResults: 20 }), [
    {
      mediaType: 'movie',
      reviewTargetType: 'movie',
      catalogId: 'tmdb:movie:693134',
      title: 'Dune: Part Two',
      releaseYear: 2024,
      genres: ['Science Fiction'],
      posterUrl: 'https://image.example/w342/dune2.jpg',
      backdropUrl: 'https://image.example/w780/dune2-wide.jpg',
    },
    {
      mediaType: 'movie',
      reviewTargetType: 'movie',
      catalogId: 'tmdb:movie:1',
      title: 'No Backdrop',
      releaseYear: 2020,
      genres: [],
      posterUrl: null,
      backdropUrl: null,
    },
  ]);

  assert.deepEqual((await catalog.trending({ maximumResults: 1 })).length, 1);

  assert.deepEqual(await catalog.popular('movie'), [
    {
      mediaType: 'movie',
      reviewTargetType: 'movie',
      catalogId: 'tmdb:movie:329865',
      title: 'Arrival',
      releaseYear: 2016,
      genres: ['Science Fiction'],
      posterUrl: 'https://image.example/w342/arrival.jpg',
      backdropUrl: 'https://image.example/w780/arrival-wide.jpg',
    },
  ]);

  assert.deepEqual(await catalog.popular('tv'), [
    {
      mediaType: 'tv',
      reviewTargetType: 'series',
      catalogId: 'tmdb:tv:95396',
      title: 'Severance',
      releaseYear: 2022,
      genres: ['Drama'],
      posterUrl: 'https://image.example/w342/severance.jpg',
      backdropUrl: 'https://image.example/w780/severance-wide.jpg',
    },
  ]);
});

test('TMDB adapter omits backdrops when the configuration lacks sizes', async () => {
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
    if (url.pathname.endsWith('/genre/movie/list')) {
      return Response.json({ genres: [] });
    }
    if (url.pathname.endsWith('/trending/movie/week')) {
      return Response.json({
        page: 1,
        total_pages: 1,
        results: [
          {
            id: 7,
            title: 'Sized Out',
            release_date: '2021-05-01',
            poster_path: '/sized.jpg',
            backdrop_path: '/sized-wide.jpg',
          },
        ],
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  }) as typeof fetch;

  const catalog = new TmdbMovieCatalog('test-token', fetchMock);
  const [item] = await catalog.trending();
  assert.equal(item.backdropUrl, null);
});

test('TMDB adapter normalizes movie details', async () => {
  const fetchMock = (async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.pathname.endsWith('/configuration')) {
      return Response.json({
        images: {
          secure_base_url: 'https://image.example/',
          poster_sizes: ['w500'],
          backdrop_sizes: ['w780', 'original'],
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
        backdrop_path: '/arrival-wide.jpg',
        overview: 'A linguist works with the military.',
        vote_average: 7.543,
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
    backdropUrl: 'https://image.example/w780/arrival-wide.jpg',
    overview: 'A linguist works with the military.',
    rating: 7.543,
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
        vote_average: 0,
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
    backdropUrl: null,
    overview: 'An updated version of Dragon Ball Z.',
    rating: null,
  });
});
