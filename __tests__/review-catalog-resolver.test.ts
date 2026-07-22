import type { MovieCatalogService } from '@/services/contracts';
import { resolveReviewCatalogData } from '@/services/movies/reviewCatalogResolver';
import type { Review } from '@/types/domain';
import { createMatchedMovieSnapshot } from '@/utils/reviewMovie';

const createCatalog = (): jest.Mocked<MovieCatalogService> => ({
  search: jest.fn(),
  getById: jest.fn(),
});

const createReview = (fetchedAt: string): Review => ({
  id: 'review-1',
  movieTitle: 'Arrival',
  movie: createMatchedMovieSnapshot(
    {
      catalogId: 'catalog:1',
      title: 'Arrival',
      releaseYear: 2016,
      genres: ['Science Fiction'],
      posterUrl: 'https://image.example/arrival.jpg',
    },
    new Date(fetchedAt)
  ),
  reviewText: 'Excellent',
  rating: '5',
  visibility: 'private',
  createdAt: '2026-01-01T12:00:00.000Z',
  syncStatus: 'synced',
});

describe('review catalog resolver', () => {
  it('does not contact the catalog while snapshot data is fresh', async () => {
    const catalog = createCatalog();
    const review = createReview('2026-01-01T12:00:00.000Z');

    await expect(
      resolveReviewCatalogData(
        review,
        catalog,
        new Date('2026-05-01T12:00:00.000Z')
      )
    ).resolves.toEqual({ review, changed: false });
    expect(catalog.getById).not.toHaveBeenCalled();
  });

  it('replaces due snapshot data after a fresh catalog response', async () => {
    const catalog = createCatalog();
    const review = createReview('2026-01-01T12:00:00.000Z');
    catalog.getById.mockResolvedValue({
      catalogId: 'catalog:1',
      title: 'Arrival Updated',
      releaseYear: 2016,
      genres: ['Drama'],
      posterUrl: null,
      overview: null,
    });

    const resolution = await resolveReviewCatalogData(
      review,
      catalog,
      new Date('2026-06-01T12:00:00.000Z')
    );

    expect(resolution.changed).toBe(true);
    expect(resolution.review.movieTitle).toBe('Arrival Updated');
    expect(resolution.review.movie).toEqual(
      expect.objectContaining({
        catalogDataRetention: expect.objectContaining({
          fetchedAt: '2026-06-01T12:00:00.000Z',
        }),
      })
    );
  });

  it('redacts expired fields when the catalog cannot refresh them', async () => {
    const catalog = createCatalog();
    const review = createReview('2026-01-01T12:00:00.000Z');
    catalog.getById.mockRejectedValue(new Error('Network unavailable'));

    const resolution = await resolveReviewCatalogData(
      review,
      catalog,
      new Date('2026-06-29T12:00:00.000Z')
    );

    expect(resolution).toEqual({
      changed: true,
      review: expect.objectContaining({
        movieTitle: 'Movie details temporarily unavailable',
        movie: expect.objectContaining({
          catalogId: 'catalog:1',
          posterUrl: null,
          releaseYear: null,
          genres: [],
        }),
      }),
    });
  });

  it('does not repeatedly rewrite a snapshot that is already redacted', async () => {
    const catalog = createCatalog();
    catalog.getById.mockRejectedValue(new Error('Network unavailable'));
    const currentTime = new Date('2026-06-29T12:00:00.000Z');
    const firstResolution = await resolveReviewCatalogData(
      createReview('2026-01-01T12:00:00.000Z'),
      catalog,
      currentTime
    );

    await expect(
      resolveReviewCatalogData(firstResolution.review, catalog, currentTime)
    ).resolves.toEqual({
      review: firstResolution.review,
      changed: false,
    });
  });
});
