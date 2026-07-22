import { httpMovieCatalogService } from '@/services/http/movieCatalogService';

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
      httpMovieCatalogService.search('Arrival', { maximumResults: 8 })
    ).resolves.toEqual({
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
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(
        /\/api\/v1\/movies\/search\?query=Arrival&maximumResults=8$/
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

    await expect(httpMovieCatalogService.search('Movie')).resolves.toEqual({
      movies: [],
      nextCursor: null,
    });
  });
});
