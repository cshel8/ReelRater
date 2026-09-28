import type {
  CachedEveryoneCommunityFeedService,
  CachedEveryoneCommunityPage,
  EveryoneCommunityFeedService,
} from '@/services/contracts';
import {
  isCommunityReviewOfflineEligible,
} from '@/services/community/communityCachePolicy';
import { applyCommunityReviewOptions } from '@/services/community/communityReviewOrdering';
import type { CommunityCacheRepository } from '@/services/local/communityCacheTypes';

const OFFLINE_EVERYONE_MAXIMUM_RESULTS = 50;

function messageFor(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Public reviews could not be loaded.';
}

export function createCachedEveryoneCommunityFeedService(
  remote: EveryoneCommunityFeedService,
  cache: CommunityCacheRepository,
  now: () => Date = () => new Date()
): CachedEveryoneCommunityFeedService {
  async function cacheRemoteReviews(viewerId: string, reviews: CachedEveryoneCommunityPage['reviews']) {
    const timestamp = now().toISOString();
    for (const review of reviews) {
      // Everyone is a Public-only feed. Do not make cache writes expand its
      // audience even if a future remote adapter unexpectedly returns more.
      if (review.visibility !== 'public') {
        continue;
      }
      try {
        await cache.upsertReview(viewerId, review, {
          contentValidatedAt: timestamp,
          authorizedAt: null,
          authorizationExpiresAt: null,
          lastRelationshipValidatedAt: null,
          cachedRelationshipStatus: null,
          lastSeenAt: timestamp,
        });
        await cache.upsertFeedEntry(viewerId, 'everyone', review.id, timestamp);
      } catch {
        // A malformed/non-renderable remote item must not turn an otherwise
        // authoritative page into a failure or enter the local cache.
      }
    }
  }

  return {
    async listPage(viewerId, options) {
      try {
        const remotePage = await remote.listPage(viewerId, options);
        await cacheRemoteReviews(viewerId, remotePage.reviews);
        return { ...remotePage, source: 'remote', remoteError: null };
      } catch (remoteError) {
        // Load-more requests require a real remote cursor. Only initial loads
        // may use the bounded local snapshot as a fallback.
        if (options.cursor) {
          throw remoteError;
        }

        let cached = [] as Awaited<ReturnType<CommunityCacheRepository['listForFeed']>>;
        try {
          cached = await cache.listForFeed(viewerId, 'everyone');
        } catch {
          // Preserve the remote failure message; no cache is safer than an
          // incomplete/unknown local result.
        }
        const reviews = applyCommunityReviewOptions(
          cached
            .filter((entry) => entry.review.visibility === 'public')
            .filter((entry) => isCommunityReviewOfflineEligible(entry, now()))
            .map((entry) => entry.review),
          {
            mediaFilter: options.mediaFilter,
            sort: options.sort,
            maximumResults: OFFLINE_EVERYONE_MAXIMUM_RESULTS,
          }
        );
        return {
          reviews,
          nextCursor: null,
          source: 'cache',
          remoteError: messageFor(remoteError),
        };
      }
    },
  };
}
