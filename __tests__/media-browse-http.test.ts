import { httpMediaBrowseService } from '@/services/http/mediaBrowseService';

describe('HTTP media browse service', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('requests trending titles and preserves backdrop URLs', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
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
        ],
      }),
    } as Response);

    await expect(
      httpMediaBrowseService.trending({ maximumResults: 10 })
    ).resolves.toEqual([
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
      },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/media\/trending\?maximumResults=10$/),
      { headers: { Accept: 'application/json' } }
    );
  });

  it('requests popular titles by media type', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          {
            mediaType: 'tv',
            reviewTargetType: 'series',
            catalogId: 'tmdb:tv:95396',
            title: 'Severance',
            releaseYear: 2022,
            genres: ['Drama'],
            posterUrl: null,
          },
        ],
      }),
    } as Response);

    await expect(httpMediaBrowseService.popular('tv')).resolves.toEqual([
      {
        mediaType: 'tv',
        reviewTargetType: 'series',
        catalogId: 'tmdb:tv:95396',
        title: 'Severance',
        releaseYear: 2022,
        genres: ['Drama'],
        posterUrl: null,
      },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/media\/popular\?mediaType=tv$/),
      { headers: { Accept: 'application/json' } }
    );
  });

  it('does not expose malformed browse records to the app', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        items: [{ title: 'Missing an ID' }, 'not-an-object'],
      }),
    } as Response);

    await expect(httpMediaBrowseService.trending()).resolves.toEqual([]);
  });

  it('surfaces catalog error messages from failed responses', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({
        error: { message: 'Media search is not configured.' },
      }),
    } as Response);

    await expect(httpMediaBrowseService.popular('movie')).rejects.toThrow(
      'Media search is not configured.'
    );
  });
});
