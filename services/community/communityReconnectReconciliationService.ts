import {
  createFollowersCommunityCacheMetadata,
  createPublicCommunityCacheMetadata,
} from '@/services/community/communityCachePolicy';
import {
  isCommunitySessionActiveForUser,
} from '@/services/community/communitySessionState';
import type {
  FollowService,
  RemoteCommunityReviewService,
} from '@/services/contracts';
import type {
  CachedCommunityReview,
  CommunityCacheRepository,
} from '@/services/local/communityCacheTypes';

export const REVIEW_REVALIDATION_BUDGET = 20;
const MAX_PROTECTED_AUTHORS = 50;

type CachedEntry = CachedCommunityReview & {
  memberships: Set<'following' | 'everyone'>;
};

function timestamp(entry: CachedEntry): number {
  const value = new Date(entry.metadata.contentValidatedAt).getTime();
  return Number.isFinite(value) ? value : 0;
}

/**
 * Bounded, best-effort maintenance triggered by connectivity. Only explicit
 * Firestore server reads are allowed to advance cache validation timestamps.
 */
export function createCommunityReconnectReconciliationService(
  cache: CommunityCacheRepository,
  followService: FollowService,
  reviewService: RemoteCommunityReviewService,
  now: () => Date = () => new Date()
) {
  const onlineByViewer = new Map<string, boolean>();
  const inFlight = new Map<string, Promise<void>>();

  async function readEntries(viewerId: string): Promise<CachedEntry[]> {
    const [following, everyone] = await Promise.all([
      cache.listForFeed(viewerId, 'following'),
      cache.listForFeed(viewerId, 'everyone'),
    ]);
    const entries = new Map<string, CachedEntry>();
    for (const [mode, records] of [
      ['following', following],
      ['everyone', everyone],
    ] as const) {
      for (const record of records) {
        const current = entries.get(record.review.id);
        if (current) {
          current.memberships.add(mode);
        } else {
          entries.set(record.review.id, { ...record, memberships: new Set([mode]) });
        }
      }
    }
    return [...entries.values()];
  }

  async function reconcile(viewerId: string): Promise<void> {
    // The authenticated lifecycle establishes the session. Never revive an
    // older viewer merely because an in-flight reconnect callback finishes.
    if (!isCommunitySessionActiveForUser(viewerId)) return;
    let entries: CachedEntry[];
    try {
      entries = await readEntries(viewerId);
    } catch (error) {
      console.log('Community reconnect cache read failed:', error instanceof Error ? error.message : error);
      return;
    }

    const protectedAuthors = [...new Set(
      entries
        .filter((entry) => entry.review.visibility === 'followers')
        .map((entry) => entry.review.authorId)
    )].sort().slice(0, MAX_PROTECTED_AUTHORS);
    const activeAuthors = new Set<string>();
    for (const authorId of protectedAuthors) {
      try {
        const status = await followService.getStatusFromServer(viewerId, authorId);
        if (!isCommunitySessionActiveForUser(viewerId)) return;
        if (status !== 'active') {
          await cache.invalidateFollowingAuthor(viewerId, authorId);
          continue;
        }
        activeAuthors.add(authorId);
        const refreshed = createFollowersCommunityCacheMetadata(now());
        for (const entry of entries.filter(
          (item) => item.review.authorId === authorId && item.review.visibility === 'followers'
        )) {
          await cache.upsertReview(viewerId, entry.review, {
            ...refreshed,
            lastSeenAt: entry.metadata.lastSeenAt,
          });
        }
      } catch (error) {
        // Transport failure is not an authoritative negative result.
        console.log('Community relationship reconciliation failed:', error instanceof Error ? error.message : error);
      }
    }

    if (!isCommunitySessionActiveForUser(viewerId)) return;
    entries = await readEntries(viewerId);
    const selected = [...entries]
      .sort((left, right) => {
        const protectedOrder = Number(right.review.visibility === 'followers') - Number(left.review.visibility === 'followers');
        return protectedOrder || timestamp(left) - timestamp(right) || left.review.id.localeCompare(right.review.id);
      })
      .slice(0, REVIEW_REVALIDATION_BUDGET);

    for (const entry of selected) {
      try {
        const remote = await reviewService.getVisibleFromAuthorFromServer(
          viewerId,
          entry.review.authorId,
          entry.review.id
        );
        if (!isCommunitySessionActiveForUser(viewerId)) return;
        if (!remote) {
          await cache.removeReview(viewerId, entry.review.id);
          continue;
        }
        const reconciledReview = { ...remote, author: entry.review.author };
        if (remote.visibility === 'followers') {
          let active = activeAuthors.has(remote.authorId);
          if (!active) {
            const status = await followService.getStatusFromServer(viewerId, remote.authorId);
            if (!isCommunitySessionActiveForUser(viewerId)) return;
            active = status === 'active';
          }
          if (!active) {
            await cache.removeReview(viewerId, entry.review.id);
            continue;
          }
          if (entry.memberships.has('everyone')) {
            await cache.removeFeedEntry(viewerId, 'everyone', entry.review.id);
          }
          if (!entry.memberships.has('following')) {
            // A readable direct document is not proof of Following membership.
            await cache.removeReview(viewerId, entry.review.id);
            continue;
          }
          const metadata = createFollowersCommunityCacheMetadata(now());
          await cache.upsertReview(viewerId, reconciledReview, {
            ...metadata,
            lastSeenAt: entry.metadata.lastSeenAt,
          });
          continue;
        }
        await cache.upsertReview(viewerId, reconciledReview, {
          ...createPublicCommunityCacheMetadata(now()),
          lastSeenAt: entry.metadata.lastSeenAt,
        });
      } catch (error) {
        // Server failure must not erase or refresh a locally cached review.
        console.log('Community review reconciliation failed:', error instanceof Error ? error.message : error);
      }
    }
  }

  return {
    async handleConnectivityChange(viewerId: string, online: boolean): Promise<void> {
      const previous = onlineByViewer.get(viewerId);
      onlineByViewer.set(viewerId, online);
      if (!online || previous === true || inFlight.has(viewerId)) return;
      const task = reconcile(viewerId).finally(() => inFlight.delete(viewerId));
      inFlight.set(viewerId, task);
      await task;
    },
    reconcile,
  };
}

export type CommunityReconnectReconciliationService = ReturnType<
  typeof createCommunityReconnectReconciliationService
>;
