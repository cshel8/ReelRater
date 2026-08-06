import {
  createManualMovieSnapshot,
  createMatchedMovieSnapshot,
  getDisplayReviewMovie,
  getDisplayReviewMovieMetadata,
  getDisplayReviewMovieTitle,
  isReviewCatalogDataExpired,
  readReviewMovieSnapshot,
} from '@/utils/reviewMovie';

describe('review movie snapshots', () => {
  it('creates a manual snapshot without an external dependency', () => {
    expect(createManualMovieSnapshot('  Arrival  ')).toEqual({
      mediaType: 'movie',
      reviewTargetType: 'movie',
      matchStatus: 'manual',
      catalogId: null,
      title: 'Arrival',
      releaseYear: null,
      genres: [],
      posterUrl: null,
    });
  });

  it('copies normalized catalog metadata into a matched snapshot', () => {
    expect(
      createMatchedMovieSnapshot(
        {
          catalogId: 'tmdb:329865',
          title: 'Arrival',
          releaseYear: 2016,
          genres: ['Science Fiction'],
          posterUrl: 'https://image.example/arrival.jpg',
        },
        new Date('2026-01-01T12:00:00.000Z')
      )
    ).toEqual({
      mediaType: 'movie',
      reviewTargetType: 'movie',
      matchStatus: 'matched',
      catalogId: 'tmdb:329865',
      title: 'Arrival',
      releaseYear: 2016,
      genres: ['Science Fiction'],
      posterUrl: 'https://image.example/arrival.jpg',
      catalogDataRetention: {
        fetchedAt: '2026-01-01T12:00:00.000Z',
        refreshAfter: '2026-05-31T12:00:00.000Z',
        expiresAt: '2026-06-29T12:00:00.000Z',
      },
    });
  });

  it('converts a legacy title-only review into a manual snapshot', () => {
    expect(readReviewMovieSnapshot(undefined, 'Arrival')).toEqual(
      createManualMovieSnapshot('Arrival')
    );
  });

  it('treats a legacy snapshot without a media type as a movie', () => {
    expect(
      readReviewMovieSnapshot(
        {
          matchStatus: 'manual',
          catalogId: null,
          title: 'Dragon Ball Z Kai',
          releaseYear: null,
          genres: [],
          posterUrl: null,
        },
        'Dragon Ball Z Kai'
      )
    ).toEqual(
      expect.objectContaining({
        mediaType: 'movie',
        reviewTargetType: 'movie',
        title: 'Dragon Ball Z Kai',
      })
    );
  });

  it('preserves a valid TV series target while reading a snapshot', () => {
    expect(
      readReviewMovieSnapshot(
        {
          mediaType: 'tv',
          reviewTargetType: 'series',
          matchStatus: 'matched',
          catalogId: 'tmdb:tv:61709',
          title: 'Dragon Ball Z Kai',
          releaseYear: 2009,
          genres: ['Animation', 'Action & Adventure'],
          posterUrl: null,
        },
        'Dragon Ball Z Kai'
      )
    ).toEqual(
      expect.objectContaining({
        mediaType: 'tv',
        reviewTargetType: 'series',
        catalogId: 'tmdb:tv:61709',
      })
    );
  });

  it('preserves the original retention window for an offline cached movie', () => {
    const snapshot = createMatchedMovieSnapshot(
      {
        catalogId: 'catalog:1',
        title: 'Arrival',
        releaseYear: 2016,
        genres: [],
        posterUrl: null,
        catalogDataRetention: {
          fetchedAt: '2025-08-01T12:00:00.000Z',
          refreshAfter: '2025-12-29T12:00:00.000Z',
          expiresAt: '2026-01-27T12:00:00.000Z',
        },
      },
      new Date('2026-01-01T12:00:00.000Z')
    );

    expect(snapshot).toEqual(
      expect.objectContaining({
        catalogDataRetention: expect.objectContaining({
          fetchedAt: '2025-08-01T12:00:00.000Z',
        }),
      })
    );
  });

  it('formats the saved release year and genres for review displays', () => {
    const movie = createMatchedMovieSnapshot({
      catalogId: 'catalog:1',
      title: 'Arrival',
      releaseYear: 2016,
      genres: ['Drama', 'Science Fiction'],
      posterUrl: null,
    });

    expect(getDisplayReviewMovieMetadata({ movie })).toBe(
      '2016 · Drama, Science Fiction'
    );
    expect(
      getDisplayReviewMovieMetadata({
        movie: createManualMovieSnapshot('Manual movie'),
      })
    ).toBeNull();
  });

  it('replaces expired catalog fields with safe display placeholders', () => {
    const movie = createMatchedMovieSnapshot(
      {
        catalogId: 'catalog:1',
        title: 'Arrival',
        releaseYear: 2016,
        genres: ['Science Fiction'],
        posterUrl: 'https://image.example/arrival.jpg',
      },
      new Date('2026-01-01T12:00:00.000Z')
    );
    const currentTime = new Date('2026-06-29T12:00:00.000Z');

    expect(isReviewCatalogDataExpired(movie, currentTime)).toBe(true);
    expect(getDisplayReviewMovie(movie, currentTime)).toEqual(
      expect.objectContaining({
        title: 'Movie details temporarily unavailable',
        releaseYear: null,
        genres: [],
        posterUrl: null,
      })
    );
    expect(
      getDisplayReviewMovieTitle(
        { movie, movieTitle: 'Arrival' },
        currentTime
      )
    ).toBe('Movie details temporarily unavailable');
  });
});
