import type { ReviewService } from '@/services/contracts';
import type { PosterCacheService } from '@/services/local/posterCacheTypes';
import { createPosterAwareReviewService } from '@/services/reviews/posterAwareReviewService';
import type { Review } from '@/types/domain';

const createReview = (index: number): Review => ({
  id: `review-${index}`,
  movieTitle: `Movie ${index}`,
  movie: {
    matchStatus: 'matched',
    catalogId: `catalog:${index}`,
    title: `Movie ${index}`,
    releaseYear: 2026,
    genres: [],
    posterUrl: `https://image.example/${index}.jpg`,
    catalogDataRetention: {
      fetchedAt: '2098-01-01T12:00:00.000Z',
      refreshAfter: '2098-05-31T12:00:00.000Z',
      expiresAt: '2098-06-29T12:00:00.000Z',
    },
  },
  reviewText: 'Review',
  rating: '4',
  visibility: 'private',
  createdAt: `2026-07-${20 - index}T12:00:00.000Z`,
  syncStatus: 'synced',
});

const createBaseService = (): jest.Mocked<ReviewService> => ({
  listForUser: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  syncPending: jest.fn(),
});

const createPosterCache = (): jest.Mocked<PosterCacheService> => ({
  resolve: jest.fn(async ({ catalogId }) => `file://${catalogId}.jpg`),
  purgeExpired: jest.fn().mockResolvedValue(undefined),
  clear: jest.fn().mockResolvedValue(undefined),
});

describe('poster-aware review service', () => {
  it('attaches device-only posters to only the five most recent reviews', async () => {
    const reviews = Array.from({ length: 6 }, (_, index) =>
      createReview(index + 1)
    );
    const base = createBaseService();
    base.listForUser.mockResolvedValue({
      reviews,
      pendingCount: 0,
      remoteAvailable: true,
      remoteError: null,
    });
    const posters = createPosterCache();
    const service = createPosterAwareReviewService(base, posters);

    const result = await service.listForUser('user-1');

    expect(posters.resolve).toHaveBeenCalledTimes(5);
    expect(posters.resolve).toHaveBeenCalledWith(
      expect.objectContaining({ allowDownload: true })
    );
    expect(result.reviews[0].movie).toEqual(
      expect.objectContaining({ localPosterUri: 'file://catalog:1.jpg' })
    );
    expect(result.reviews[5].movie).not.toEqual(
      expect.objectContaining({ localPosterUri: expect.any(String) })
    );
  });

  it('does not request new downloads when the review service is offline', async () => {
    const base = createBaseService();
    base.listForUser.mockResolvedValue({
      reviews: [createReview(1)],
      pendingCount: 0,
      remoteAvailable: false,
      remoteError: 'Network unavailable',
    });
    const posters = createPosterCache();
    const service = createPosterAwareReviewService(base, posters);

    await service.listForUser('user-1');

    expect(posters.resolve).toHaveBeenCalledWith(
      expect.objectContaining({ allowDownload: false })
    );
  });
});
