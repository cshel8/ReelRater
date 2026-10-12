import type { CommunityExactMediaSearchRequest } from '@/services/contracts';
import {
  createCommunityExactMediaQueryPlan,
  isProviderQualifiedCommunityCatalogId,
  matchesCommunityReviewKeyword,
  matchesCommunitySelectedMedia,
  toCommunitySelectedMedia,
} from '@/services/community/communitySearch';
import {
  createManualMediaSnapshot,
  createMatchedMediaSnapshot,
} from '@/utils/reviewMovie';

const movie = {
  catalogId: 'tmdb:movie:42',
  mediaType: 'movie' as const,
  reviewTargetType: 'movie' as const,
  title: 'Arrival',
  releaseYear: 2016,
  genres: [],
  posterUrl: null,
};

const tv = {
  catalogId: 'tmdb:tv:42',
  mediaType: 'tv' as const,
  reviewTargetType: 'series' as const,
  title: 'Arrival',
  releaseYear: 2026,
  genres: [],
  posterUrl: null,
};

describe('Community Search contracts and query planning', () => {
  it('keeps movie and TV identities distinct even when their numeric IDs match', () => {
    const selectedMovie = toCommunitySelectedMedia(movie);
    const selectedTv = toCommunitySelectedMedia(tv);

    expect(selectedMovie).toEqual({
      catalogId: 'tmdb:movie:42',
      mediaType: 'movie',
      reviewTargetType: 'movie',
    });
    expect(selectedTv).not.toEqual(selectedMovie);
    expect(
      matchesCommunitySelectedMedia(
        { movie: createMatchedMediaSnapshot(tv) },
        selectedMovie!
      )
    ).toBe(false);
  });

  it('rejects malformed, unqualified, and target-inconsistent catalog suggestions', () => {
    expect(isProviderQualifiedCommunityCatalogId('42')).toBe(false);
    expect(isProviderQualifiedCommunityCatalogId('tmdb::42')).toBe(false);
    expect(toCommunitySelectedMedia({ ...movie, catalogId: '42' })).toBeNull();
    expect(
      toCommunitySelectedMedia({
        ...movie,
        reviewTargetType: 'series',
      } as never)
    ).toBeNull();
  });

  it('does not let manual snapshots masquerade as an exact matched target', () => {
    const selectedMovie = toCommunitySelectedMedia(movie)!;
    expect(
      matchesCommunitySelectedMedia(
        {
          movie: createManualMediaSnapshot('Arrival', {
            mediaType: 'movie',
            reviewTargetType: 'movie',
          }),
        },
        selectedMovie
      )
    ).toBe(false);
    expect(
      matchesCommunitySelectedMedia(
        { movie: createMatchedMediaSnapshot(movie) },
        selectedMovie
      )
    ).toBe(true);
  });

  it('preserves scope and distinguishes Everyone pagination from bounded Following', () => {
    const selectedMedia = toCommunitySelectedMedia(movie)!;
    const everyoneRequest: CommunityExactMediaSearchRequest = {
      scope: 'everyone',
      selectedMedia,
      sort: 'highest',
      cursor: { values: [5, 'Arrival'] },
    };
    expect(createCommunityExactMediaQueryPlan(everyoneRequest)).toEqual({
      scope: 'everyone',
      visibility: 'public',
      selectedMedia,
      sort: 'highest',
      cursor: { values: [5, 'Arrival'] },
      retrieval: 'paginated',
    });
    expect(
      createCommunityExactMediaQueryPlan({
        scope: 'following',
        selectedMedia,
        sort: 'newest',
        maximumResults: 20,
      })
    ).toEqual({
      scope: 'following',
      visibleToActiveFollowedAuthorsOnly: true,
      selectedMedia,
      sort: 'newest',
      maximumResults: 20,
      retrieval: 'bounded',
    });
  });

  it('keeps Following keyword matching case-insensitive across titles and review text', () => {
    expect(
      matchesCommunityReviewKeyword(
        { movieTitle: 'Arrival', reviewText: 'Thoughtful science fiction.' },
        'ARR'
      )
    ).toBe(true);
    expect(
      matchesCommunityReviewKeyword(
        { movieTitle: 'Dune', reviewText: 'An arrival of sand and spice.' },
        'arrival'
      )
    ).toBe(true);
    expect(
      matchesCommunityReviewKeyword(
        { movieTitle: 'Dune', reviewText: 'Sand and spice.' },
        'arrival'
      )
    ).toBe(false);
  });
});
