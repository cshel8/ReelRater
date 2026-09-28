import type {
  CachedFollowingCommunityFeedService,
  CommunityFeedService,
} from '@/services/contracts';
import {
  createFollowersCommunityCacheMetadata,
  createPublicCommunityCacheMetadata,
  isCommunityReviewOfflineEligible,
} from '@/services/community/communityCachePolicy';
import { applyCommunityReviewOptions } from '@/services/community/communityReviewOrdering';
import { isFollowingAuthorInvalidatedForSession } from '@/services/community/communitySessionState';
import type { CommunityCacheRepository } from '@/services/local/communityCacheTypes';

const OFFLINE_FOLLOWING_MAXIMUM_RESULTS = 50;

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Your Following feed could not be loaded.';
}

export function createCachedFollowingCommunityFeedService(
  remote: CommunityFeedService,
  cache: CommunityCacheRepository,
  now: () => Date = () => new Date()
): CachedFollowingCommunityFeedService {
  async function cacheRemoteReviews(
    viewerId: string,
    reviews: Awaited<ReturnType<CommunityFeedService['list']>>['reviews']
  ): Promise<void> {
    const validatedAt = now();
    for (const review of reviews) {
      if (review.visibility !== 'public' && review.visibility !== 'followers') {
        continue;
      }
      try {
        // The remote Following service reaches this point only after its
        // active-relationship query and visibility-aware review query succeed.
        const metadata = review.visibility === 'followers'
          ? createFollowersCommunityCacheMetadata(validatedAt)
          : createPublicCommunityCacheMetadata(validatedAt);
        await cache.upsertReview(viewerId, review, metadata);
        await cache.upsertFeedEntry(
          viewerId,
          'following',
          review.id,
          metadata.lastSeenAt
        );
      } catch {
        // Never let a single malformed local snapshot replace or fail an
        // otherwise authoritative Following response.
      }
    }
  }

  return {
    async list(viewerId, options = {}) {
      try {
        const remoteResult = await remote.list(viewerId, options);
        await cacheRemoteReviews(viewerId, remoteResult.reviews);
        return { ...remoteResult, source: 'remote', remoteError: null };
      } catch (remoteError) {
        let cached = [] as Awaited<ReturnType<CommunityCacheRepository['listForFeed']>>;
        try {
          cached = await cache.listForFeed(viewerId, 'following');
        } catch {
          // Avoid making fallback failures look like an authoritative empty
          // Following response; return an unavailable saved-content result.
        }
        const reviews = applyCommunityReviewOptions(
          cached
            .filter(
              (entry) =>
                !isFollowingAuthorInvalidatedForSession(
                  viewerId,
                  entry.review.authorId
                ) && isCommunityReviewOfflineEligible(entry, now())
            )
            .map((entry) => entry.review),
          { ...options, maximumResults: OFFLINE_FOLLOWING_MAXIMUM_RESULTS }
        );
        return {
          reviews,
          followsAnyone: reviews.length > 0,
          source: 'cache',
          remoteError: errorMessage(remoteError),
        };
      }
    },
  };
}
