import { createExactMediaCommunitySearchService } from '@/services/community/exactMediaCommunitySearchService';
import { createCommunityFeedService } from '@/services/community/communityFeedService';
import type {
  CommunityFeedService,
  EveryoneCommunityFeedService,
  FollowService,
  RemoteCommunityReviewService,
  UserDirectoryService,
} from '@/services/contracts';

const selectedMovie = {
  catalogId: 'tmdb:movie:42',
  mediaType: 'movie' as const,
  reviewTargetType: 'movie' as const,
};

function setup() {
  const following = { list: jest.fn() } as jest.Mocked<CommunityFeedService>;
  const everyone = { listPage: jest.fn() } as jest.Mocked<EveryoneCommunityFeedService>;
  return {
    following,
    everyone,
    service: createExactMediaCommunitySearchService(following, everyone),
  };
}

describe('exact-media Community search service', () => {
  it('uses a paginated, repository-scoped Everyone request for the selected identity', async () => {
    const { following, everyone, service } = setup();
    const page = { reviews: [], nextCursor: { values: [5, 'Arrival', 'time', 'review-1'] } };
    everyone.listPage.mockResolvedValue(page);

    await expect(service.search('viewer-1', {
      scope: 'everyone', selectedMedia: selectedMovie, sort: 'highest',
      maximumResults: 10, cursor: { values: [4, 'Dune', 'older', 'review-2'] },
    })).resolves.toEqual({
      reviews: [],
      pagination: { retrieval: 'paginated', nextCursor: page.nextCursor },
    });

    expect(everyone.listPage).toHaveBeenCalledWith('viewer-1', {
      mediaFilter: 'movie', exactMedia: selectedMovie, sort: 'highest',
      maximumResults: 10, cursor: { values: [4, 'Dune', 'older', 'review-2'] },
    });
    expect(following.list).not.toHaveBeenCalled();
  });

  it('uses the existing bounded Following source rather than a local-cache fallback', async () => {
    const { following, everyone, service } = setup();
    following.list.mockResolvedValue({ followsAnyone: true, reviews: [] });

    await expect(service.search('viewer-1', {
      scope: 'following', selectedMedia: selectedMovie, sort: 'newest', maximumResults: 12,
    })).resolves.toEqual({
      reviews: [], pagination: { retrieval: 'bounded', nextCursor: null },
    });

    expect(following.list).toHaveBeenCalledWith('viewer-1', {
      mediaFilter: 'movie', exactMedia: selectedMovie, sort: 'newest', maximumResults: 12,
    });
    expect(everyone.listPage).not.toHaveBeenCalled();
  });

  it('rejects malformed identity rather than broadening to a title or generic feed query', async () => {
    const { following, everyone, service } = setup();
    await expect(service.search('viewer-1', {
      scope: 'everyone',
      selectedMedia: { catalogId: '42', mediaType: 'movie', reviewTargetType: 'movie' },
      sort: 'newest',
    })).rejects.toThrow('valid media identity');
    expect(following.list).not.toHaveBeenCalled();
    expect(everyone.listPage).not.toHaveBeenCalled();
  });

  it('stops returning protected exact-media reviews immediately after the active relationship is lost', async () => {
    const followService = {
      listFollowingFromServer: jest.fn()
        .mockResolvedValueOnce([{
          followerId: 'viewer-1', followedUserId: 'author-1', status: 'active',
          createdAt: '2026-10-01T12:00:00.000Z', acceptedAt: '2026-10-01T12:00:00.000Z',
        }])
        // A pending or removed relationship is absent from the active-only
        // server relationship result.
        .mockResolvedValueOnce([]),
    } as unknown as jest.Mocked<FollowService>;
    const directory = {
      getById: jest.fn().mockResolvedValue({
        id: 'author-1', displayName: 'Author', handle: 'author',
        handleNormalized: 'author', profileImage: null, accountPrivacy: 'private',
        followerCount: 0, followingCount: 0,
      }),
    } as unknown as jest.Mocked<UserDirectoryService>;
    const reviews = {
      listVisibleFromAuthorsFromServer: jest.fn().mockResolvedValue([
        {
          id: 'public-review', authorId: 'author-1', movieTitle: 'Arrival',
          movie: { ...selectedMovie, title: 'Arrival', releaseYear: 2016, genres: [], posterUrl: null, matchStatus: 'matched' },
          reviewText: 'Public', rating: 4, spoilerWarning: false, visibility: 'public',
          createdAt: '2026-10-01T12:00:00.000Z', syncStatus: 'synced',
        },
        {
          id: 'followers-review', authorId: 'author-1', movieTitle: 'Arrival',
          movie: { ...selectedMovie, title: 'Arrival', releaseYear: 2016, genres: [], posterUrl: null, matchStatus: 'matched' },
          reviewText: 'Followers only', rating: 5, spoilerWarning: false, visibility: 'followers',
          createdAt: '2026-10-02T12:00:00.000Z', syncStatus: 'synced',
        },
      ]),
    } as unknown as jest.Mocked<RemoteCommunityReviewService>;
    const following = createCommunityFeedService(followService, directory, reviews);
    const everyone = { listPage: jest.fn() } as jest.Mocked<EveryoneCommunityFeedService>;
    const service = createExactMediaCommunitySearchService(following, everyone);

    const activeResult = await service.search('viewer-1', {
      scope: 'following', selectedMedia: selectedMovie, sort: 'newest',
    });
    expect(activeResult.reviews.map((review) => [review.id, review.visibility]))
      .toEqual([
        ['public-review', 'public'],
        ['followers-review', 'followers'],
      ]);

    await expect(service.search('viewer-1', {
      scope: 'following', selectedMedia: selectedMovie, sort: 'newest',
    })).resolves.toEqual({
      reviews: [], pagination: { retrieval: 'bounded', nextCursor: null },
    });
    expect(reviews.listVisibleFromAuthorsFromServer).toHaveBeenCalledTimes(1);
  });

  it('propagates a Following server-query failure rather than serving stale protected results', async () => {
    const following = {
      list: jest.fn().mockRejectedValue(new Error('Server unavailable')),
    } as jest.Mocked<CommunityFeedService>;
    const everyone = { listPage: jest.fn() } as jest.Mocked<EveryoneCommunityFeedService>;
    const service = createExactMediaCommunitySearchService(following, everyone);

    await expect(service.search('viewer-1', {
      scope: 'following', selectedMedia: selectedMovie, sort: 'newest',
    })).rejects.toThrow('Server unavailable');
    expect(everyone.listPage).not.toHaveBeenCalled();
  });
});
