import {
  createCommunityReconnectReconciliationService,
  REVIEW_REVALIDATION_BUDGET,
} from '@/services/community/communityReconnectReconciliationService';
import { beginCommunitySessionForUser } from '@/services/community/communitySessionState';
import type { FollowService, RemoteCommunityReviewService } from '@/services/contracts';
import type { CachedCommunityReview, CommunityCacheRepository } from '@/services/local/communityCacheTypes';

const now = new Date('2026-09-28T12:00:00.000Z');

function entry(id: string, visibility: 'public' | 'followers', authorId = 'maya'): CachedCommunityReview {
  return {
    review: {
      id, authorId, movieTitle: id, reviewText: 'Review.', rating: 4,
      spoilerWarning: false, visibility, createdAt: '2026-09-27T12:00:00.000Z', syncStatus: 'synced',
      author: { id: authorId, displayName: authorId, handle: authorId, handleNormalized: authorId, profileImage: null, accountPrivacy: 'public', followerCount: 0, followingCount: 0 },
    },
    metadata: {
      contentValidatedAt: '2026-09-27T12:00:00.000Z',
      authorizedAt: visibility === 'followers' ? '2026-09-27T12:00:00.000Z' : null,
      authorizationExpiresAt: visibility === 'followers' ? '2026-09-27T18:00:00.000Z' : null,
      lastRelationshipValidatedAt: visibility === 'followers' ? '2026-09-27T12:00:00.000Z' : null,
      cachedRelationshipStatus: visibility === 'followers' ? 'active' : null,
      lastSeenAt: '2026-09-27T12:00:00.000Z',
    },
  };
}

function setup(following: CachedCommunityReview[] = [], everyone: CachedCommunityReview[] = []) {
  beginCommunitySessionForUser('viewer-a');
  const cache = {
    listForFeed: jest.fn(async (_viewer: string, mode: string) => mode === 'following' ? following : everyone),
    upsertReview: jest.fn(), invalidateFollowingAuthor: jest.fn(), removeReview: jest.fn(), removeFeedEntry: jest.fn(),
  } as unknown as jest.Mocked<CommunityCacheRepository>;
  const follows = { getStatusFromServer: jest.fn() } as unknown as jest.Mocked<FollowService>;
  const reviews = { getVisibleFromAuthorFromServer: jest.fn() } as unknown as jest.Mocked<RemoteCommunityReviewService>;
  return { cache, follows, reviews, service: createCommunityReconnectReconciliationService(cache, follows, reviews, () => now) };
}

describe('Community reconnect reconciliation', () => {
  beforeEach(() => beginCommunitySessionForUser(null));

  it('refreshes protected authorization only after authoritative active status', async () => {
    const protectedEntry = entry('protected', 'followers');
    const { cache, follows, reviews, service } = setup([protectedEntry]);
    follows.getStatusFromServer.mockResolvedValue('active');
    reviews.getVisibleFromAuthorFromServer.mockResolvedValue(protectedEntry.review);

    await service.handleConnectivityChange('viewer-a', true);
    expect(follows.getStatusFromServer).toHaveBeenCalledWith('viewer-a', 'maya');
    expect(cache.upsertReview).toHaveBeenCalledWith('viewer-a', protectedEntry.review, expect.objectContaining({
      authorizedAt: now.toISOString(),
      authorizationExpiresAt: new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString(),
    }));
  });

  it('purges a protected author after an authoritative non-active status but not after transport failure', async () => {
    const removed = setup([entry('protected', 'followers')]);
    removed.follows.getStatusFromServer.mockResolvedValue(null);
    await removed.service.handleConnectivityChange('viewer-a', true);
    expect(removed.cache.invalidateFollowingAuthor).toHaveBeenCalledWith('viewer-a', 'maya');

    const failed = setup([entry('protected', 'followers')]);
    failed.follows.getStatusFromServer.mockRejectedValue(new Error('offline'));
    await failed.service.handleConnectivityChange('viewer-a', true);
    expect(failed.cache.invalidateFollowingAuthor).not.toHaveBeenCalled();
    expect(failed.cache.upsertReview).not.toHaveBeenCalled();
  });

  it('uses a deterministic maximum 20-review validation budget', async () => {
    const items = Array.from({ length: REVIEW_REVALIDATION_BUDGET + 3 }, (_, index) =>
      entry(`review-${String(index).padStart(2, '0')}`, 'public', `author-${index}`)
    );
    const { reviews, service } = setup(items);
    reviews.getVisibleFromAuthorFromServer.mockResolvedValue(null);
    await service.handleConnectivityChange('viewer-a', true);
    expect(reviews.getVisibleFromAuthorFromServer).toHaveBeenCalledTimes(REVIEW_REVALIDATION_BUDGET);
    expect(reviews.getVisibleFromAuthorFromServer.mock.calls[0][2]).toBe('review-00');
  });

  it('deduplicates protected author validation and ignores duplicate online events', async () => {
    const { follows, reviews, service } = setup([
      entry('one', 'followers', 'maya'), entry('two', 'followers', 'maya'),
    ]);
    follows.getStatusFromServer.mockResolvedValue('active');
    reviews.getVisibleFromAuthorFromServer.mockResolvedValue(null);
    await Promise.all([
      service.handleConnectivityChange('viewer-a', true),
      service.handleConnectivityChange('viewer-a', true),
    ]);
    expect(follows.getStatusFromServer).toHaveBeenCalledTimes(1);
  });
});
