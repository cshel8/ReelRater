import type { CommunityReview, FollowStatus } from '@/types/domain';

/** The only Community feeds eligible for device-local membership caching. */
export type CommunityCacheFeedMode = 'following' | 'everyone';

export const COMMUNITY_CACHE_LIMITS = {
  reviewSnapshots: 80,
  followingFeedEntries: 50,
  everyoneFeedEntries: 50,
} as const;

export type CommunityCacheReviewMetadata = {
  contentValidatedAt: string;
  authorizedAt: string | null;
  authorizationExpiresAt: string | null;
  lastRelationshipValidatedAt: string | null;
  cachedRelationshipStatus: FollowStatus | null;
  lastSeenAt: string;
};

export type CachedCommunityReview = {
  review: CommunityReview;
  metadata: CommunityCacheReviewMetadata;
};

/**
 * Local-only Community persistence. It deliberately has no remote/cache
 * policy: later orchestration decides when content is safe to store or read.
 */
export interface CommunityCacheRepository {
  upsertReview(
    viewerId: string,
    review: CommunityReview,
    metadata: CommunityCacheReviewMetadata
  ): Promise<void>;
  upsertFeedEntry(
    viewerId: string,
    feedMode: CommunityCacheFeedMode,
    reviewId: string,
    lastSeenAt: string
  ): Promise<void>;
  listForFeed(
    viewerId: string,
    feedMode: CommunityCacheFeedMode
  ): Promise<CachedCommunityReview[]>;
  removeReview(viewerId: string, reviewId: string): Promise<void>;
  removeFeedEntry(
    viewerId: string,
    feedMode: CommunityCacheFeedMode,
    reviewId: string
  ): Promise<void>;
  /**
   * Removes an author's Following membership for one viewer and immediately
   * destroys that viewer's Followers Only snapshots for the author.
   */
  invalidateFollowingAuthor(viewerId: string, authorId: string): Promise<void>;
  pruneUnreferencedSnapshots(viewerId: string): Promise<void>;
  enforceBounds(viewerId: string): Promise<void>;
  clearForViewer(viewerId: string): Promise<void>;
}
