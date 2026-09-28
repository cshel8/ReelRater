import type { CachedCommunityReview } from '@/services/local/communityCacheTypes';
import type { CommunityCacheReviewMetadata } from '@/services/local/communityCacheTypes';

export const COMMUNITY_CACHE_FRESHNESS = {
  publicContentMs: 7 * 24 * 60 * 60 * 1000,
  followersContentMs: 24 * 60 * 60 * 1000,
  followersAuthorizationMs: 6 * 60 * 60 * 1000,
} as const;

export function createPublicCommunityCacheMetadata(
  validatedAt: Date
): CommunityCacheReviewMetadata {
  const timestamp = validatedAt.toISOString();
  return {
    contentValidatedAt: timestamp,
    authorizedAt: null,
    authorizationExpiresAt: null,
    lastRelationshipValidatedAt: null,
    cachedRelationshipStatus: null,
    lastSeenAt: timestamp,
  };
}

/** Creates the only allowed offline authorization window for protected cache. */
export function createFollowersCommunityCacheMetadata(
  validatedAt: Date
): CommunityCacheReviewMetadata {
  const timestamp = validatedAt.toISOString();
  return {
    contentValidatedAt: timestamp,
    authorizedAt: timestamp,
    authorizationExpiresAt: new Date(
      validatedAt.getTime() + COMMUNITY_CACHE_FRESHNESS.followersAuthorizationMs
    ).toISOString(),
    lastRelationshipValidatedAt: timestamp,
    cachedRelationshipStatus: 'active',
    lastSeenAt: timestamp,
  };
}

function readTimestamp(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function isCommunityContentFresh(
  cached: CachedCommunityReview,
  now: Date = new Date()
): boolean {
  const validatedAt = readTimestamp(cached.metadata.contentValidatedAt);
  if (validatedAt === null) {
    return false;
  }
  const age = now.getTime() - validatedAt;
  if (age < 0) {
    return true;
  }
  return cached.review.visibility === 'public'
    ? age <= COMMUNITY_CACHE_FRESHNESS.publicContentMs
    : cached.review.visibility === 'followers'
      ? age <= COMMUNITY_CACHE_FRESHNESS.followersContentMs
      : false;
}

export function isCommunityAuthorizationValid(
  cached: CachedCommunityReview,
  now: Date = new Date()
): boolean {
  if (cached.review.visibility !== 'followers') {
    return false;
  }
  if (cached.metadata.cachedRelationshipStatus !== 'active') {
    return false;
  }
  const authorizedAt = readTimestamp(cached.metadata.authorizedAt);
  const expiresAt = readTimestamp(cached.metadata.authorizationExpiresAt);
  const relationshipValidatedAt = readTimestamp(
    cached.metadata.lastRelationshipValidatedAt
  );
  if (
    authorizedAt === null ||
    expiresAt === null ||
    relationshipValidatedAt === null ||
    expiresAt <= authorizedAt ||
    expiresAt > authorizedAt + COMMUNITY_CACHE_FRESHNESS.followersAuthorizationMs
  ) {
    return false;
  }
  return now.getTime() <= expiresAt;
}

/**
 * A future Community orchestrator can use this without knowing which local
 * persistence provider supplied the snapshot.
 */
export function isCommunityReviewOfflineEligible(
  cached: CachedCommunityReview,
  now: Date = new Date()
): boolean {
  if (!isCommunityContentFresh(cached, now)) {
    return false;
  }
  return cached.review.visibility === 'public'
    ? true
    : cached.review.visibility === 'followers'
      ? isCommunityAuthorizationValid(cached, now)
      : false;
}
