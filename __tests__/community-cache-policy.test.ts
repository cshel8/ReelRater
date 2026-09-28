import {
  COMMUNITY_CACHE_FRESHNESS,
  isCommunityAuthorizationValid,
  isCommunityContentFresh,
  isCommunityReviewOfflineEligible,
} from '@/services/community/communityCachePolicy';
import type { CachedCommunityReview } from '@/services/local/communityCacheTypes';

const now = new Date('2026-09-27T18:00:00.000Z');

function cachedReview(
  visibility: 'public' | 'followers',
  overrides: Partial<CachedCommunityReview['metadata']> = {}
): CachedCommunityReview {
  return {
    review: {
      id: 'review-1',
      authorId: 'author-1',
      author: {
        id: 'author-1', displayName: 'Author', handle: 'author',
        handleNormalized: 'author', profileImage: null, accountPrivacy: 'public',
        followerCount: 0, followingCount: 0,
      },
      movieTitle: 'Arrival', reviewText: 'Excellent.', rating: 5,
      spoilerWarning: false, visibility, createdAt: '2026-09-20T18:00:00.000Z',
      syncStatus: 'synced',
    },
    metadata: {
      contentValidatedAt: '2026-09-27T18:00:00.000Z',
      authorizedAt: visibility === 'followers' ? '2026-09-27T12:00:00.000Z' : null,
      authorizationExpiresAt: visibility === 'followers' ? '2026-09-27T18:00:00.000Z' : null,
      lastRelationshipValidatedAt: visibility === 'followers' ? '2026-09-27T12:00:00.000Z' : null,
      cachedRelationshipStatus: visibility === 'followers' ? 'active' : null,
      lastSeenAt: '2026-09-27T18:00:00.000Z',
      ...overrides,
    },
  };
}

describe('Community cache policy', () => {
  it('uses a seven-day Public content freshness boundary', () => {
    expect(isCommunityContentFresh(cachedReview('public', {
      contentValidatedAt: '2026-09-20T18:00:00.000Z',
    }), now)).toBe(true);
    expect(isCommunityContentFresh(cachedReview('public', {
      contentValidatedAt: '2026-09-20T17:59:59.999Z',
    }), now)).toBe(false);
  });

  it('uses a 24-hour Followers Only content freshness boundary', () => {
    expect(isCommunityContentFresh(cachedReview('followers', {
      contentValidatedAt: '2026-09-26T18:00:00.000Z',
    }), now)).toBe(true);
    expect(isCommunityContentFresh(cachedReview('followers', {
      contentValidatedAt: '2026-09-26T17:59:59.999Z',
    }), now)).toBe(false);
  });

  it('treats followers authorization validity separately from content freshness', () => {
    const freshButExpired = cachedReview('followers', {
      authorizationExpiresAt: '2026-09-27T17:59:59.999Z',
    });
    expect(isCommunityContentFresh(freshButExpired, now)).toBe(true);
    expect(isCommunityAuthorizationValid(freshButExpired, now)).toBe(false);
    expect(isCommunityReviewOfflineEligible(freshButExpired, now)).toBe(false);
  });

  it('allows potentially eligible Followers Only content only with valid active authorization', () => {
    const valid = cachedReview('followers');
    expect(isCommunityAuthorizationValid(valid, now)).toBe(true);
    expect(isCommunityReviewOfflineEligible(valid, now)).toBe(true);
    expect(isCommunityReviewOfflineEligible(cachedReview('followers', {
      cachedRelationshipStatus: 'pending',
    }), now)).toBe(false);
  });

  it('keeps policy durations centralized', () => {
    expect(COMMUNITY_CACHE_FRESHNESS.publicContentMs).toBe(7 * 24 * 60 * 60 * 1000);
    expect(COMMUNITY_CACHE_FRESHNESS.followersContentMs).toBe(24 * 60 * 60 * 1000);
    expect(COMMUNITY_CACHE_FRESHNESS.followersAuthorizationMs).toBe(6 * 60 * 60 * 1000);
  });
});
