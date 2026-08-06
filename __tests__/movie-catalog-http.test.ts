import { httpMediaCatalogService } from '@/services/http/movieCatalogService';

describe('HTTP movie catalog service', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('requests normalized movie search results from the ReelRater API', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        movies: [
          {
            catalogId: 'tmdb:329865',
            title: 'Arrival',
            releaseYear: 2016,
            genres: ['Science Fiction'],
            posterUrl: null,
          },
        ],
        nextCursor: 'next-page',
      }),
    } as Response);

    await expect(
      httpMediaCatalogService.search('Arrival', {
        maximumResults: 8,
        mediaType: 'movie',
      })
    ).resolves.toEqual({
      items: [
        {
          mediaType: 'movie',
          reviewTargetType: 'movie',
          catalogId: 'tmdb:329865',
          title: 'Arrival',
          releaseYear: 2016,
          genres: ['Science Fiction'],
          posterUrl: null,
        },
      ],
      nextCursor: 'next-page',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(
        /\/api\/v1\/media\/search\?query=Arrival&maximumResults=8&mediaType=movie$/
      ),
      { headers: { Accept: 'application/json' } }
    );
  });

  it('does not expose malformed server movie records to the app', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        movies: [{ title: 'Missing an ID' }],
        nextCursor: null,
      }),
    } as Response);

    await expect(httpMediaCatalogService.search('Movie')).resolves.toEqual({
      items: [],
      nextCursor: null,
    });
  });

  it('preserves a normalized TV series returned by a media endpoint', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          {
            mediaType: 'tv',
            reviewTargetType: 'series',
            catalogId: 'tmdb:tv:61709',
            title: 'Dragon Ball Z Kai',
            releaseYear: 2009,
            genres: ['Animation'],
            posterUrl: null,
          },
        ],
        nextCursor: null,
      }),
    } as Response);

    await expect(
      httpMediaCatalogService.search('Dragon Ball Z Kai', {
        mediaType: 'tv',
      })
    ).resolves.toEqual({
      items: [
        expect.objectContaining({
          mediaType: 'tv',
          reviewTargetType: 'series',
          catalogId: 'tmdb:tv:61709',
        }),
      ],
      nextCursor: null,
    });
  });
});
