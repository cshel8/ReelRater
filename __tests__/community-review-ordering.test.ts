import { applyCommunityReviewOptions } from '@/services/community/communityReviewOrdering';
import type { SharedReview } from '@/types/domain';
import { createMatchedMediaSnapshot } from '@/utils/reviewMovie';

const createReview = ({
  id,
  mediaType,
  rating,
  createdAt,
  title = `Title ${id}`,
}: {
  id: string;
  mediaType: 'movie' | 'tv';
  rating: number;
  createdAt: string;
  title?: string;
}): SharedReview => {
  const target =
    mediaType === 'tv'
      ? ({ mediaType: 'tv', reviewTargetType: 'series' } as const)
      : ({ mediaType: 'movie', reviewTargetType: 'movie' } as const);
  return {
    id,
    authorId: 'author-1',
    movieTitle: title,
    movie: createMatchedMediaSnapshot({
      ...target,
      catalogId: `catalog:${id}`,
      title,
      releaseYear: 2026,
      genres: [],
      posterUrl: null,
    }),
    reviewText: 'Review',
    rating,
    spoilerWarning: false,
    visibility: 'public',
    createdAt,
    syncStatus: 'synced',
  };
};

describe('community review filtering and sorting', () => {
  it('filters by media type before applying the result limit', () => {
    const reviews = [
      createReview({
        id: 'new-movie',
        mediaType: 'movie',
        rating: 3,
        createdAt: '2026-08-03T12:00:00.000Z',
      }),
      createReview({
        id: 'older-tv',
        mediaType: 'tv',
        rating: 5,
        createdAt: '2026-08-01T12:00:00.000Z',
      }),
    ];

    expect(
      applyCommunityReviewOptions(reviews, {
        maximumResults: 1,
        mediaFilter: 'tv',
      }).map((review) => review.id)
    ).toEqual(['older-tv']);
  });

  it('sorts rating ties by title A-Z and then review ID', () => {
    const reviews = [
      createReview({
        id: 'low',
        mediaType: 'movie',
        rating: 1,
        createdAt: '2026-08-04T12:00:00.000Z',
      }),
      createReview({
        id: 'zeta',
        mediaType: 'tv',
        rating: 5,
        createdAt: '2026-08-01T12:00:00.000Z', title: 'Zulu',
      }),
      createReview({
        id: 'alpha-b',
        mediaType: 'movie',
        rating: 5,
        createdAt: '2026-08-03T12:00:00.000Z', title: 'Alpha',
      }),
      createReview({
        id: 'alpha-a', mediaType: 'movie', rating: 5,
        createdAt: '2026-08-02T12:00:00.000Z', title: 'Alpha',
      }),
    ];

    expect(
      applyCommunityReviewOptions(reviews, { sort: 'highest' }).map(
        (review) => review.id
      )
    ).toEqual(['alpha-b', 'alpha-a', 'zeta', 'low']);
    expect(
      applyCommunityReviewOptions(reviews, { sort: 'lowest' }).map(
        (review) => review.id
      )
    ).toEqual(['low', 'alpha-b', 'alpha-a', 'zeta']);
  });

  it('uses review ID descending only when rating, title, and timestamp tie', () => {
    const reviews = [
      createReview({ id: 'a', mediaType: 'movie', rating: 4, title: 'Same', createdAt: '2026-08-03T12:00:00.000Z' }),
      createReview({ id: 'z', mediaType: 'tv', rating: 4, title: 'Same', createdAt: '2026-08-03T12:00:00.000Z' }),
    ];
    expect(applyCommunityReviewOptions(reviews, { sort: 'highest' }).map((review) => review.id)).toEqual(['z', 'a']);
    expect(applyCommunityReviewOptions(reviews, { sort: 'lowest' }).map((review) => review.id)).toEqual(['z', 'a']);
  });

  it('searches after filtering and before sorting and applying the result limit', () => {
    const reviews = [
      {
        ...createReview({
          id: 'movie-match',
          mediaType: 'movie',
          rating: 2,
          createdAt: '2026-08-01T12:00:00.000Z',
        }),
        reviewText: 'An Arrival-like mystery.',
      },
      createReview({
        id: 'tv-title-match',
        mediaType: 'tv',
        rating: 5,
        createdAt: '2026-08-03T12:00:00.000Z',
      }),
      {
        ...createReview({
          id: 'tv-text-match',
          mediaType: 'tv',
          rating: 4,
          createdAt: '2026-08-02T12:00:00.000Z',
        }),
        reviewText: 'A great arrival for this series.',
      },
    ];

    expect(
      applyCommunityReviewOptions(reviews, {
        maximumResults: 1,
        mediaFilter: 'tv',
        searchQuery: 'ARRIVAL',
        sort: 'highest',
      }).map((review) => review.id)
    ).toEqual(['tv-text-match']);
  });

  it('uses the complete matched identity when an exact Community target is supplied', () => {
    const selectedMedia = {
      catalogId: 'tmdb:movie:42',
      mediaType: 'movie' as const,
      reviewTargetType: 'movie' as const,
    };
    const matchingMovie = createReview({
      id: 'matching', mediaType: 'movie', rating: 5,
      createdAt: '2026-08-03T12:00:00.000Z', title: 'Arrival',
    });
    matchingMovie.movie = createMatchedMediaSnapshot({
      ...selectedMedia, title: 'Arrival', releaseYear: 2016, genres: [], posterUrl: null,
    });
    const sameProviderNumberTv = createReview({
      id: 'tv-collision', mediaType: 'tv', rating: 5,
      createdAt: '2026-08-02T12:00:00.000Z', title: 'Arrival',
    });
    sameProviderNumberTv.movie = createMatchedMediaSnapshot({
      catalogId: 'tmdb:tv:42', mediaType: 'tv', reviewTargetType: 'series',
      title: 'Arrival', releaseYear: 2026, genres: [], posterUrl: null,
    });
    const manual = createReview({
      id: 'manual', mediaType: 'movie', rating: 5,
      createdAt: '2026-08-01T12:00:00.000Z', title: 'Arrival',
    });
    manual.movie = {
      title: 'Arrival', releaseYear: null, genres: [], posterUrl: null,
      mediaType: 'movie', reviewTargetType: 'movie', matchStatus: 'manual', catalogId: null,
    };

    expect(applyCommunityReviewOptions(
      [matchingMovie, sameProviderNumberTv, manual],
      { exactMedia: selectedMedia, mediaFilter: 'all' }
    ).map((review) => review.id)).toEqual(['matching']);
  });
});
