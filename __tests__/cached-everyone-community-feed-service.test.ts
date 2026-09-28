import { createCachedEveryoneCommunityFeedService } from '@/services/community/cachedEveryoneCommunityFeedService';
import type {
  EveryoneCommunityFeedService,
} from '@/services/contracts';
import type {
  CachedCommunityReview,
  CommunityCacheRepository,
} from '@/services/local/communityCacheTypes';
import type { CommunityReview } from '@/types/domain';

const now = new Date('2026-09-27T18:00:00.000Z');

function review(
  id: string,
  overrides: Partial<CommunityReview> = {}
): CommunityReview {
  return {
    id,
    authorId: 'author-1',
    author: {
      id: 'author-1', displayName: 'Author', handle: 'author',
      handleNormalized: 'author', profileImage: null, accountPrivacy: 'public',
      followerCount: 0, followingCount: 0,
    },
    movieTitle: id,
    reviewText: 'A thoughtful review.',
    rating: 4,
    spoilerWarning: false,
    visibility: 'public',
    createdAt: '2026-09-27T12:00:00.000Z',
    syncStatus: 'synced',
    ...overrides,
  };
}

function cached(item: CommunityReview, overrides: Partial<CachedCommunityReview['metadata']> = {}): CachedCommunityReview {
  return {
    review: item,
    metadata: {
      contentValidatedAt: '2026-09-27T12:00:00.000Z',
      authorizedAt: null,
      authorizationExpiresAt: null,
      lastRelationshipValidatedAt: null,
      cachedRelationshipStatus: null,
      lastSeenAt: '2026-09-27T12:00:00.000Z',
      ...overrides,
    },
  };
}

function setup() {
  const remote = { listPage: jest.fn() } as jest.Mocked<EveryoneCommunityFeedService>;
  const cache = {
    upsertReview: jest.fn(), upsertFeedEntry: jest.fn(), listForFeed: jest.fn(),
    removeReview: jest.fn(), removeFeedEntry: jest.fn(), invalidateFollowingAuthor: jest.fn(), pruneUnreferencedSnapshots: jest.fn(),
    enforceBounds: jest.fn(), clearForViewer: jest.fn(),
  } as jest.Mocked<CommunityCacheRepository>;
  return {
    remote,
    cache,
    service: createCachedEveryoneCommunityFeedService(remote, cache, () => now),
  };
}

const options = { mediaFilter: 'all' as const, sort: 'newest' as const };

describe('cached Everyone Community service', () => {
  it('keeps a successful remote page authoritative while caching only Public reviews', async () => {
    const { remote, cache, service } = setup();
    const publicReview = review('public-review');
    const followersReview = review('followers-review', { visibility: 'followers' });
    remote.listPage.mockResolvedValue({ reviews: [publicReview, followersReview], nextCursor: { values: ['next'] } });

    await expect(service.listPage('viewer-a', options)).resolves.toMatchObject({
      reviews: [publicReview, followersReview], source: 'remote', nextCursor: { values: ['next'] }, remoteError: null,
    });
    expect(cache.upsertReview).toHaveBeenCalledTimes(1);
    expect(cache.upsertReview).toHaveBeenCalledWith(
      'viewer-a', publicReview, expect.objectContaining({ contentValidatedAt: now.toISOString() })
    );
    expect(cache.upsertFeedEntry).toHaveBeenCalledWith(
      'viewer-a', 'everyone', 'public-review', now.toISOString()
    );
  });

  it('uses eligible viewer-scoped saved Public reviews only after an initial remote failure', async () => {
    const { remote, cache, service } = setup();
    remote.listPage.mockRejectedValue(new Error('Network unavailable'));
    cache.listForFeed.mockResolvedValue([
      cached(review('public-review')),
      cached(review('stale-review'), { contentValidatedAt: '2026-09-20T11:59:59.999Z' }),
      cached(review('followers-review', { visibility: 'followers' }) as CommunityReview, {
        authorizedAt: '2026-09-27T12:00:00.000Z', authorizationExpiresAt: '2026-09-27T18:00:00.000Z',
        lastRelationshipValidatedAt: '2026-09-27T12:00:00.000Z', cachedRelationshipStatus: 'active',
      }),
    ]);

    await expect(service.listPage('viewer-a', options)).resolves.toMatchObject({
      reviews: [expect.objectContaining({ id: 'public-review' })],
      source: 'cache', nextCursor: null, remoteError: 'Network unavailable',
    });
    expect(cache.listForFeed).toHaveBeenCalledWith('viewer-a', 'everyone');
    expect(cache.removeReview).not.toHaveBeenCalled();
  });

  it('returns an empty saved result when remote and cache are unavailable without clearing cache', async () => {
    const { remote, cache, service } = setup();
    remote.listPage.mockRejectedValue(new Error('Remote unavailable'));
    cache.listForFeed.mockResolvedValue([]);

    await expect(service.listPage('viewer-a', options)).resolves.toEqual({
      reviews: [], nextCursor: null, source: 'cache', remoteError: 'Remote unavailable',
    });
    expect(cache.upsertReview).not.toHaveBeenCalled();
    expect(cache.removeReview).not.toHaveBeenCalled();
  });

  it('applies existing filters and finalized ordering to saved fallback content', async () => {
    const { remote, cache, service } = setup();
    remote.listPage.mockRejectedValue(new Error('Offline'));
    cache.listForFeed.mockResolvedValue([
      cached(review('z', { movieTitle: 'Zulu', rating: 5, movie: { title: 'Zulu', releaseYear: null, genres: [], posterUrl: null, mediaType: 'movie', reviewTargetType: 'movie', matchStatus: 'manual', catalogId: null } })),
      cached(review('a', { movieTitle: 'Alpha', rating: 5, movie: { title: 'Alpha', releaseYear: null, genres: [], posterUrl: null, mediaType: 'movie', reviewTargetType: 'movie', matchStatus: 'manual', catalogId: null } })),
      cached(review('tv', { movie: { title: 'TV', releaseYear: null, genres: [], posterUrl: null, mediaType: 'tv', reviewTargetType: 'series', matchStatus: 'manual', catalogId: null } })),
    ]);

    const highest = await service.listPage('viewer-a', { mediaFilter: 'movie', sort: 'highest' });
    expect(highest.reviews.map((item) => item.id)).toEqual(['a', 'z']);
    const tv = await service.listPage('viewer-a', { mediaFilter: 'tv', sort: 'newest' });
    expect(tv.reviews.map((item) => item.id)).toEqual(['tv']);
  });

  it('keeps Load More remote-only and does not substitute cached content for a cursor failure', async () => {
    const { remote, cache, service } = setup();
    remote.listPage.mockRejectedValue(new Error('Remote unavailable'));
    await expect(service.listPage('viewer-a', { ...options, cursor: { values: ['cursor'] } })).rejects.toThrow('Remote unavailable');
    expect(cache.listForFeed).not.toHaveBeenCalled();
  });
});
