import { createCachedFollowingCommunityFeedService } from '@/services/community/cachedFollowingCommunityFeedService';
import { COMMUNITY_CACHE_FRESHNESS } from '@/services/community/communityCachePolicy';
import {
  beginCommunitySessionForUser,
  invalidateFollowingAuthorForSession,
} from '@/services/community/communitySessionState';
import type { CommunityFeedService } from '@/services/contracts';
import type { CachedCommunityReview, CommunityCacheRepository } from '@/services/local/communityCacheTypes';
import type { CommunityReview } from '@/types/domain';

const now = new Date('2026-09-27T18:00:00.000Z');
const options = { mediaFilter: 'all' as const, sort: 'newest' as const };

function review(id: string, overrides: Partial<CommunityReview> = {}): CommunityReview {
  return {
    id,
    authorId: 'author-1',
    author: { id: 'author-1', displayName: 'Author', handle: 'author', handleNormalized: 'author', profileImage: null, accountPrivacy: 'public', followerCount: 0, followingCount: 0 },
    movieTitle: id,
    reviewText: 'Thoughtful review.',
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
      authorizedAt: item.visibility === 'followers' ? '2026-09-27T12:00:00.000Z' : null,
      authorizationExpiresAt: item.visibility === 'followers' ? '2026-09-27T18:00:00.000Z' : null,
      lastRelationshipValidatedAt: item.visibility === 'followers' ? '2026-09-27T12:00:00.000Z' : null,
      cachedRelationshipStatus: item.visibility === 'followers' ? 'active' : null,
      lastSeenAt: '2026-09-27T12:00:00.000Z',
      ...overrides,
    },
  };
}

function setup() {
  const remote = { list: jest.fn() } as jest.Mocked<CommunityFeedService>;
  const cache = {
    upsertReview: jest.fn(), upsertFeedEntry: jest.fn(), listForFeed: jest.fn(),
    removeReview: jest.fn(), removeFeedEntry: jest.fn(), invalidateFollowingAuthor: jest.fn(), pruneUnreferencedSnapshots: jest.fn(),
    enforceBounds: jest.fn(), clearForViewer: jest.fn(),
  } as jest.Mocked<CommunityCacheRepository>;
  return { remote, cache, service: createCachedFollowingCommunityFeedService(remote, cache, () => now) };
}

describe('cached Following Community service', () => {
  beforeEach(() => beginCommunitySessionForUser(null));
  it('keeps remote Following authoritative and caches Public plus active-authorized Followers Only reviews', async () => {
    const { remote, cache, service } = setup();
    const publicReview = review('public-review');
    const protectedReview = review('followers-review', { visibility: 'followers' });
    remote.list.mockResolvedValue({ reviews: [publicReview, protectedReview], followsAnyone: true });

    await expect(service.list('viewer-a', options)).resolves.toMatchObject({
      reviews: [publicReview, protectedReview], followsAnyone: true, source: 'remote', remoteError: null,
    });
    expect(cache.upsertReview).toHaveBeenCalledWith(
      'viewer-a', publicReview, expect.objectContaining({ authorizedAt: null })
    );
    expect(cache.upsertReview).toHaveBeenCalledWith(
      'viewer-a', protectedReview, expect.objectContaining({
        authorizedAt: now.toISOString(),
        authorizationExpiresAt: new Date(now.getTime() + COMMUNITY_CACHE_FRESHNESS.followersAuthorizationMs).toISOString(),
        cachedRelationshipStatus: 'active',
      })
    );
    expect(cache.upsertFeedEntry).toHaveBeenCalledTimes(2);
  });

  it('does not cache private content or let a malformed protected snapshot become a saved result', async () => {
    const { remote, cache, service } = setup();
    remote.list.mockResolvedValue({
      reviews: [review('private-review', { visibility: 'private' as never })], followsAnyone: true,
    });
    await service.list('viewer-a', options);
    expect(cache.upsertReview).not.toHaveBeenCalled();

    remote.list.mockRejectedValue(new Error('Offline'));
    cache.listForFeed.mockResolvedValue([
      cached(review('bad-protected', { visibility: 'followers' }), {
        cachedRelationshipStatus: 'pending',
      }),
    ]);
    await expect(service.list('viewer-a', options)).resolves.toMatchObject({
      reviews: [], source: 'cache', remoteError: 'Offline',
    });
  });

  it('uses eligible persisted Public and active Followers Only data after remote failure without extending authorization', async () => {
    const { remote, cache, service } = setup();
    remote.list.mockRejectedValue(new Error('Remote unavailable'));
    const validProtected = cached(review('protected', { visibility: 'followers' }));
    const expiredProtected = cached(review('expired', { visibility: 'followers' }), {
      authorizationExpiresAt: '2026-09-27T17:59:59.999Z',
    });
    const staleProtected = cached(review('stale', { visibility: 'followers' }), {
      contentValidatedAt: '2026-09-26T17:59:59.999Z',
    });
    cache.listForFeed.mockResolvedValue([cached(review('public')), validProtected, expiredProtected, staleProtected]);

    const result = await service.list('viewer-a', options);
    expect(result).toMatchObject({ source: 'cache', remoteError: 'Remote unavailable' });
    expect(result.reviews.map((item) => item.id)).toEqual(['public', 'protected']);
    expect(cache.upsertReview).not.toHaveBeenCalled();
    expect(cache.upsertFeedEntry).not.toHaveBeenCalled();
  });

  it('applies the existing media filters and finalized rating ordering to saved Following data', async () => {
    const { remote, cache, service } = setup();
    remote.list.mockRejectedValue(new Error('Offline'));
    cache.listForFeed.mockResolvedValue([
      cached(review('z', { movieTitle: 'Zulu', rating: 5, movie: { title: 'Zulu', releaseYear: null, genres: [], posterUrl: null, mediaType: 'movie', reviewTargetType: 'movie', matchStatus: 'manual', catalogId: null } })),
      cached(review('a', { movieTitle: 'Alpha', rating: 5, movie: { title: 'Alpha', releaseYear: null, genres: [], posterUrl: null, mediaType: 'movie', reviewTargetType: 'movie', matchStatus: 'manual', catalogId: null } })),
      cached(review('tv', { movie: { title: 'TV', releaseYear: null, genres: [], posterUrl: null, mediaType: 'tv', reviewTargetType: 'series', matchStatus: 'manual', catalogId: null } })),
    ]);

    const highest = await service.list('viewer-a', { mediaFilter: 'movie', sort: 'highest' });
    expect(highest.reviews.map((item) => item.id)).toEqual(['a', 'z']);
    const tv = await service.list('viewer-a', { mediaFilter: 'tv', sort: 'newest' });
    expect(tv.reviews.map((item) => item.id)).toEqual(['tv']);
  });

  it('keeps cache reads viewer-scoped and supports a shared Public snapshot through feed membership', async () => {
    const { remote, cache, service } = setup();
    remote.list.mockRejectedValue(new Error('Offline'));
    cache.listForFeed.mockResolvedValue([]);
    await service.list('viewer-a', options);
    expect(cache.listForFeed).toHaveBeenCalledWith('viewer-a', 'following');
  });

  it('fails closed for an author locally invalidated after a successful unfollow, even if SQLite cleanup failed', async () => {
    const { remote, cache, service } = setup();
    remote.list.mockRejectedValue(new Error('Server unavailable'));
    const protectedReview = cached(
      review('protected', { visibility: 'followers', authorId: 'maya' })
    );
    protectedReview.review.author.id = 'maya';
    cache.listForFeed.mockResolvedValue([protectedReview]);
    beginCommunitySessionForUser('viewer-a');
    invalidateFollowingAuthorForSession('viewer-a', 'maya');

    await expect(service.list('viewer-a', options)).resolves.toMatchObject({
      reviews: [],
      source: 'cache',
    });
  });
});
