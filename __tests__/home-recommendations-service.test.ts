import { createHomeRecommendationsService } from '@/services/movies/homeRecommendationsService';
import type { Review, MediaSummary } from '@/types/domain';

const review = (
  id: string,
  rating: number,
  createdAt: string,
  movie?: Review['movie']
): Review => ({
  id,
  movieTitle: `Movie ${id}`,
  movie,
  reviewText: 'Review text.',
  rating,
  spoilerWarning: false,
  visibility: 'private',
  createdAt,
  syncStatus: 'synced',
});

const matched = (catalogId: string): Review['movie'] => ({
  matchStatus: 'matched',
  catalogId,
  mediaType: 'movie',
  reviewTargetType: 'movie',
  title: `Title ${catalogId}`,
  releaseYear: 2020,
  genres: [],
  posterUrl: null,
});

const manual = (): Review['movie'] => ({
  matchStatus: 'manual',
  catalogId: null,
  mediaType: 'movie',
  reviewTargetType: 'movie',
  title: 'Manual Title',
  releaseYear: null,
  genres: [],
  posterUrl: null,
});

const media = (catalogId: string): MediaSummary => ({
  mediaType: 'movie',
  reviewTargetType: 'movie',
  catalogId,
  title: `Rec ${catalogId}`,
  releaseYear: 2024,
  genres: [],
  posterUrl: null,
});

const createService = (
  reviews: Review[],
  recommendationsBySeed: Record<string, MediaSummary[] | Error>
) => {
  const recommendationsFor = jest.fn(async (catalogId: string) => {
    const result = recommendationsBySeed[catalogId] ?? [];
    if (result instanceof Error) {
      throw result;
    }
    return result;
  });
  const service = createHomeRecommendationsService(
    {
      listForUser: jest.fn().mockResolvedValue({
        reviews,
        pendingCount: 0,
        remoteAvailable: true,
        remoteError: null,
      }),
    },
    { recommendationsFor }
  );
  return { service, recommendationsFor };
};

describe('Home recommendations service', () => {
  it('seeds from the newest 4-5 star matched reviews, capped at three', async () => {
    const reviews = [
      review('r1', 5, '2026-10-10T00:00:00Z', matched('tmdb:movie:1')),
      review('r2', 4, '2026-10-12T00:00:00Z', matched('tmdb:movie:2')),
      review('r3', 3, '2026-10-19T00:00:00Z', matched('tmdb:movie:3')),
      review('r4', 5, '2026-10-18T00:00:00Z', manual()),
      review('r5', 5, '2026-10-17T00:00:00Z', matched('tmdb:tv:4')),
      review('r6', 4, '2026-10-01T00:00:00Z', matched('tmdb:movie:5')),
      review('r7', 5, '2026-10-16T00:00:00Z', undefined),
    ];
    const { service, recommendationsFor } = createService(reviews, {});

    await service.getForUser('user-1');

    // Newest-first qualifying seeds: tv:4 (10-17), movie:2 (10-12),
    // movie:1 (10-10). The 3-star, manual, and snapshot-less reviews are
    // skipped, and the oldest 4-star never becomes a fourth seed.
    expect(recommendationsFor.mock.calls.map(([id]) => id)).toEqual([
      'tmdb:tv:4',
      'tmdb:movie:2',
      'tmdb:movie:1',
    ]);
  });

  it('merges seed results round-robin and removes duplicates', async () => {
    const reviews = [
      review('r1', 5, '2026-10-19T00:00:00Z', matched('tmdb:movie:1')),
      review('r2', 5, '2026-10-18T00:00:00Z', matched('tmdb:movie:2')),
    ];
    const { service } = createService(reviews, {
      'tmdb:movie:1': [media('tmdb:movie:10'), media('tmdb:movie:11')],
      'tmdb:movie:2': [media('tmdb:movie:10'), media('tmdb:movie:12')],
    });

    const items = await service.getForUser('user-1');

    expect(items.map((item) => item.catalogId)).toEqual([
      'tmdb:movie:10',
      'tmdb:movie:11',
      'tmdb:movie:12',
    ]);
  });

  it('excludes titles the user already reviewed, regardless of rating', async () => {
    const reviews = [
      review('r1', 5, '2026-10-19T00:00:00Z', matched('tmdb:movie:1')),
      review('r2', 2, '2026-10-18T00:00:00Z', matched('tmdb:movie:20')),
    ];
    const { service } = createService(reviews, {
      'tmdb:movie:1': [
        media('tmdb:movie:20'),
        media('tmdb:movie:1'),
        media('tmdb:movie:21'),
      ],
    });

    const items = await service.getForUser('user-1');

    expect(items.map((item) => item.catalogId)).toEqual(['tmdb:movie:21']);
  });

  it('returns an empty list with no reviews or no qualifying seeds', async () => {
    const { service: emptyService, recommendationsFor: emptyFetch } =
      createService([], {});
    await expect(emptyService.getForUser('user-1')).resolves.toEqual([]);
    expect(emptyFetch).not.toHaveBeenCalled();

    const lowRated = [
      review('r1', 3, '2026-10-19T00:00:00Z', matched('tmdb:movie:1')),
    ];
    const { service: lowService, recommendationsFor: lowFetch } =
      createService(lowRated, {});
    await expect(lowService.getForUser('user-1')).resolves.toEqual([]);
    expect(lowFetch).not.toHaveBeenCalled();
  });

  it('treats failed or empty seed requests as no recommendations', async () => {
    const reviews = [
      review('r1', 5, '2026-10-19T00:00:00Z', matched('tmdb:movie:1')),
      review('r2', 5, '2026-10-18T00:00:00Z', matched('tmdb:movie:2')),
    ];
    const { service } = createService(reviews, {
      'tmdb:movie:1': new Error('Network unavailable'),
      'tmdb:movie:2': [media('tmdb:movie:30')],
    });

    await expect(service.getForUser('user-1')).resolves.toEqual([
      media('tmdb:movie:30'),
    ]);

    const { service: allFailed } = createService(reviews, {
      'tmdb:movie:1': new Error('Network unavailable'),
      'tmdb:movie:2': new Error('Network unavailable'),
    });
    await expect(allFailed.getForUser('user-1')).resolves.toEqual([]);
  });

  it('caps the merged list at twenty recommendations', async () => {
    const reviews = [
      review('r1', 5, '2026-10-19T00:00:00Z', matched('tmdb:movie:1')),
    ];
    const bigList = Array.from({ length: 30 }, (_, index) =>
      media(`tmdb:movie:${100 + index}`)
    );
    const { service } = createService(reviews, {
      'tmdb:movie:1': bigList,
    });

    const items = await service.getForUser('user-1');
    expect(items).toHaveLength(20);
    expect(items[0].catalogId).toBe('tmdb:movie:100');
  });
});
