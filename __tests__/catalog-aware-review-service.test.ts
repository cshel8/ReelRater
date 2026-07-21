import type {
  MovieCatalogService,
  ReviewService,
} from '@/services/contracts';
import { createCatalogAwareReviewService } from '@/services/reviews/catalogAwareReviewService';
import type { Review } from '@/types/domain';
import { createMatchedMovieSnapshot } from '@/utils/reviewMovie';

const expiredReview: Review = {
  id: 'review-1',
  movieTitle: 'Arrival',
  movie: createMatchedMovieSnapshot(
    {
      catalogId: 'catalog:1',
      title: 'Arrival',
      releaseYear: 2016,
      genres: [],
      posterUrl: 'https://image.example/arrival.jpg',
    },
    new Date('2026-01-01T12:00:00.000Z')
  ),
  reviewText: 'Excellent',
  rating: '5',
  visibility: 'private',
  createdAt: '2026-01-01T12:00:00.000Z',
  syncStatus: 'synced',
};

const createBaseService = (): jest.Mocked<ReviewService> => ({
  listForUser: jest.fn(),
  create: jest.fn(),
  update: jest.fn(async (_userId, review) => review),
  remove: jest.fn(),
  syncPending: jest.fn(),
});

const createCatalog = (): jest.Mocked<MovieCatalogService> => ({
  search: jest.fn(),
  getById: jest.fn(),
});

describe('catalog-aware review service', () => {
  it('persists redacted expired data when the review service is online', async () => {
    const base = createBaseService();
    const catalog = createCatalog();
    base.listForUser.mockResolvedValue({
      reviews: [expiredReview],
      pendingCount: 0,
      remoteAvailable: true,
      remoteError: null,
    });
    catalog.getById.mockRejectedValue(new Error('Catalog unavailable'));
    const service = createCatalogAwareReviewService(
      base,
      catalog,
      () => new Date('2026-06-29T12:00:00.000Z')
    );

    const result = await service.listForUser('user-1');

    expect(base.update).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        movieTitle: 'Movie details temporarily unavailable',
      })
    );
    expect(result.reviews[0].movieTitle).toBe(
      'Movie details temporarily unavailable'
    );
  });

  it('does not queue a cleanup write while the review service is offline', async () => {
    const base = createBaseService();
    const catalog = createCatalog();
    base.listForUser.mockResolvedValue({
      reviews: [expiredReview],
      pendingCount: 0,
      remoteAvailable: false,
      remoteError: 'Network unavailable',
    });
    catalog.getById.mockRejectedValue(new Error('Catalog unavailable'));
    const service = createCatalogAwareReviewService(
      base,
      catalog,
      () => new Date('2026-06-29T12:00:00.000Z')
    );

    const result = await service.listForUser('user-1');

    expect(base.update).not.toHaveBeenCalled();
    expect(result.reviews[0].movieTitle).toBe(
      'Movie details temporarily unavailable'
    );
  });
});
