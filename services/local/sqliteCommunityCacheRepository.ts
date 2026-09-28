import {
  getSQLiteDatabase,
  runSQLiteTransaction,
  runSQLiteWrite,
} from '@/database/sqliteDatabase';
import type {
  CachedCommunityReview,
  CommunityCacheFeedMode,
  CommunityCacheRepository,
  CommunityCacheReviewMetadata,
} from '@/services/local/communityCacheTypes';
import type { CommunityReview, FollowStatus } from '@/types/domain';
import { reviewValidationMessage } from '@/services/reviews/reviewValidation';
import { COMMUNITY_CACHE_LIMITS as cacheLimits } from '@/services/local/communityCacheTypes';
import { COMMUNITY_CACHE_FRESHNESS } from '@/services/community/communityCachePolicy';

type CommunityCacheRow = {
  viewer_uid: string;
  review_id: string;
  author_id: string;
  visibility: string;
  review_json: string;
  content_validated_at: string;
  authorized_at: string | null;
  authorization_expires_at: string | null;
  last_relationship_validated_at: string | null;
  cached_relationship_status: string | null;
  last_seen_at: string;
};

function assertFeedMode(feedMode: string): asserts feedMode is CommunityCacheFeedMode {
  if (feedMode !== 'following' && feedMode !== 'everyone') {
    throw new Error(`Unsupported Community cache feed mode: ${feedMode}`);
  }
}

function assertCacheableReview(review: CommunityReview): void {
  if (review.visibility !== 'public' && review.visibility !== 'followers') {
    throw new Error('Only public or followers-only reviews can be cached for Community.');
  }
}

function isValidTimestamp(value: string | null): boolean {
  return typeof value === 'string' && Number.isFinite(new Date(value).getTime());
}

function assertCacheableMetadata(
  review: CommunityReview,
  metadata: CommunityCacheReviewMetadata
): void {
  if (!isValidTimestamp(metadata.contentValidatedAt) || !isValidTimestamp(metadata.lastSeenAt)) {
    throw new Error('Community cache timestamps must be valid ISO date strings.');
  }

  if (review.visibility !== 'followers') {
    return;
  }

  const authorizedAt = metadata.authorizedAt;
  const authorizationExpiresAt = metadata.authorizationExpiresAt;
  if (
    metadata.cachedRelationshipStatus !== 'active' ||
    !isValidTimestamp(authorizedAt) ||
    !isValidTimestamp(authorizationExpiresAt) ||
    !isValidTimestamp(metadata.lastRelationshipValidatedAt) ||
    authorizedAt === null ||
    authorizationExpiresAt === null ||
    new Date(authorizationExpiresAt).getTime() <= new Date(authorizedAt).getTime() ||
    new Date(authorizationExpiresAt).getTime() >
      new Date(authorizedAt).getTime() +
        COMMUNITY_CACHE_FRESHNESS.followersAuthorizationMs
  ) {
    throw new Error('Followers-only Community cache entries require active, internally consistent authorization metadata.');
  }
}

function readStatus(value: string | null): FollowStatus | null {
  return value === 'active' || value === 'pending' ? value : null;
}

function readCachedReview(row: CommunityCacheRow): CachedCommunityReview | null {
  try {
    const review = JSON.parse(row.review_json) as CommunityReview;
    if (
      !review ||
      typeof review.id !== 'string' ||
      review.id !== row.review_id ||
      typeof review.authorId !== 'string' ||
      review.authorId !== row.author_id ||
      !review.author ||
      review.author.id !== review.authorId ||
      typeof review.author.displayName !== 'string' ||
      !review.author.displayName.trim() ||
      typeof review.author.handle !== 'string' ||
      !review.author.handle.trim() ||
      typeof review.author.handleNormalized !== 'string' ||
      (review.author.profileImage !== null && typeof review.author.profileImage !== 'string') ||
      (review.visibility !== 'public' && review.visibility !== 'followers') ||
      review.visibility !== row.visibility ||
      reviewValidationMessage(review) !== null ||
      !isValidTimestamp(review.createdAt) ||
      !isValidTimestamp(row.content_validated_at) ||
      !isValidTimestamp(row.last_seen_at)
    ) {
      return null;
    }

    const metadata: CommunityCacheReviewMetadata = {
      contentValidatedAt: row.content_validated_at,
      authorizedAt: row.authorized_at,
      authorizationExpiresAt: row.authorization_expires_at,
      lastRelationshipValidatedAt: row.last_relationship_validated_at,
      cachedRelationshipStatus: readStatus(row.cached_relationship_status),
      lastSeenAt: row.last_seen_at,
    };
    assertCacheableMetadata(review, metadata);

    return {
      review,
      metadata,
    };
  } catch {
    return null;
  }
}

function entryLimit(feedMode: CommunityCacheFeedMode): number {
  return feedMode === 'following'
    ? cacheLimits.followingFeedEntries
    : cacheLimits.everyoneFeedEntries;
}

async function pruneForViewer(
  database: Awaited<ReturnType<typeof getSQLiteDatabase>>,
  viewerId: string
): Promise<void> {
  await database.runAsync(
    `DELETE FROM community_cached_reviews
     WHERE viewer_uid = ?
       AND review_id NOT IN (
         SELECT review_id
         FROM community_cached_feed_entries
         WHERE viewer_uid = ?
       )`,
    viewerId,
    viewerId
  );
}

async function pruneFeedEntries(
  database: Awaited<ReturnType<typeof getSQLiteDatabase>>,
  viewerId: string,
  feedMode: CommunityCacheFeedMode
): Promise<void> {
  await database.runAsync(
    `DELETE FROM community_cached_feed_entries
     WHERE viewer_uid = ? AND feed_mode = ?
       AND review_id NOT IN (
         SELECT review_id
         FROM community_cached_feed_entries
         WHERE viewer_uid = ? AND feed_mode = ?
         ORDER BY last_seen_at DESC, review_id ASC
         LIMIT ?
       )`,
    viewerId,
    feedMode,
    viewerId,
    feedMode,
    entryLimit(feedMode)
  );
}

async function pruneSnapshotLimit(
  database: Awaited<ReturnType<typeof getSQLiteDatabase>>,
  viewerId: string
): Promise<void> {
  const staleReviewIds = `SELECT review_id
    FROM community_cached_reviews
    WHERE viewer_uid = ?
    ORDER BY last_seen_at DESC, review_id ASC
    LIMIT -1 OFFSET ?`;
  await database.runAsync(
    `DELETE FROM community_cached_feed_entries
     WHERE viewer_uid = ? AND review_id IN (${staleReviewIds})`,
    viewerId,
    viewerId,
    cacheLimits.reviewSnapshots
  );
  await database.runAsync(
    `DELETE FROM community_cached_reviews
     WHERE viewer_uid = ? AND review_id IN (${staleReviewIds})`,
    viewerId,
    viewerId,
    cacheLimits.reviewSnapshots
  );
}

async function enforceBoundsForViewer(
  database: Awaited<ReturnType<typeof getSQLiteDatabase>>,
  viewerId: string
): Promise<void> {
  await pruneFeedEntries(database, viewerId, 'following');
  await pruneFeedEntries(database, viewerId, 'everyone');
  await pruneForViewer(database, viewerId);
  await pruneSnapshotLimit(database, viewerId);
}

export const sqliteCommunityCacheRepository: CommunityCacheRepository = {
  async upsertReview(viewerId, review, metadata) {
    assertCacheableReview(review);
    assertCacheableMetadata(review, metadata);
    await runSQLiteWrite((database) =>
      database.runAsync(
        `INSERT OR REPLACE INTO community_cached_reviews (
          viewer_uid, review_id, author_id, visibility, review_json,
          content_validated_at, authorized_at, authorization_expires_at,
          last_relationship_validated_at, cached_relationship_status, last_seen_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        viewerId,
        review.id,
        review.authorId,
        review.visibility,
        JSON.stringify(review),
        metadata.contentValidatedAt,
        metadata.authorizedAt,
        metadata.authorizationExpiresAt,
        metadata.lastRelationshipValidatedAt,
        metadata.cachedRelationshipStatus,
        metadata.lastSeenAt
      )
    );
  },

  async upsertFeedEntry(viewerId, feedMode, reviewId, lastSeenAt) {
    assertFeedMode(feedMode);
    if (!isValidTimestamp(lastSeenAt)) {
      throw new Error('Community cache last-seen time must be a valid ISO date string.');
    }
    await runSQLiteTransaction(async (transaction) => {
      await transaction.runAsync(
        `INSERT OR REPLACE INTO community_cached_feed_entries (
          viewer_uid, feed_mode, review_id, last_seen_at
        ) VALUES (?, ?, ?, ?)`,
        viewerId,
        feedMode,
        reviewId,
        lastSeenAt
      );
      await enforceBoundsForViewer(transaction, viewerId);
    });
  },

  async listForFeed(viewerId, feedMode) {
    assertFeedMode(feedMode);
    const database = await getSQLiteDatabase();
    const rows = await database.getAllAsync<CommunityCacheRow>(
      `SELECT
         review.viewer_uid,
         review.review_id,
         review.author_id,
         review.visibility,
         review.review_json,
         review.content_validated_at,
         review.authorized_at,
         review.authorization_expires_at,
         review.last_relationship_validated_at,
         review.cached_relationship_status,
         entry.last_seen_at
       FROM community_cached_feed_entries AS entry
       INNER JOIN community_cached_reviews AS review
         ON review.viewer_uid = entry.viewer_uid
        AND review.review_id = entry.review_id
       WHERE entry.viewer_uid = ? AND entry.feed_mode = ?
       ORDER BY entry.last_seen_at DESC`,
      viewerId,
      feedMode
    );
    return rows.flatMap((row) => {
      const cached = readCachedReview(row);
      return cached ? [cached] : [];
    });
  },

  async removeReview(viewerId, reviewId) {
    await runSQLiteTransaction(async (transaction) => {
      await transaction.runAsync(
        'DELETE FROM community_cached_feed_entries WHERE viewer_uid = ? AND review_id = ?',
        viewerId,
        reviewId
      );
      await transaction.runAsync(
        'DELETE FROM community_cached_reviews WHERE viewer_uid = ? AND review_id = ?',
        viewerId,
        reviewId
      );
    });
  },

  async removeFeedEntry(viewerId, feedMode, reviewId) {
    assertFeedMode(feedMode);
    await runSQLiteTransaction(async (transaction) => {
      await transaction.runAsync(
        `DELETE FROM community_cached_feed_entries
         WHERE viewer_uid = ? AND feed_mode = ? AND review_id = ?`,
        viewerId,
        feedMode,
        reviewId
      );
      await pruneForViewer(transaction, viewerId);
    });
  },

  async invalidateFollowingAuthor(viewerId, authorId) {
    await runSQLiteTransaction(async (transaction) => {
      // An unfollow revokes this viewer's Following membership for every
      // review from this author, including Public reviews. Public snapshots
      // still referenced by Everyone are preserved by pruning below.
      await transaction.runAsync(
        `DELETE FROM community_cached_feed_entries
         WHERE viewer_uid = ?
           AND feed_mode = 'following'
           AND review_id IN (
             SELECT review_id
             FROM community_cached_reviews
             WHERE viewer_uid = ? AND author_id = ?
           )`,
        viewerId,
        viewerId,
        authorId
      );
      // Protected review text is no longer useful once this viewer has
      // definitively ended the active relationship, so remove it even if a
      // malformed historical membership somehow exists.
      await transaction.runAsync(
        `DELETE FROM community_cached_reviews
         WHERE viewer_uid = ? AND author_id = ? AND visibility = 'followers'`,
        viewerId,
        authorId
      );
      await pruneForViewer(transaction, viewerId);
    });
  },

  async pruneUnreferencedSnapshots(viewerId) {
    await runSQLiteWrite((database) => pruneForViewer(database, viewerId));
  },

  async enforceBounds(viewerId) {
    await runSQLiteWrite((database) => enforceBoundsForViewer(database, viewerId));
  },

  async clearForViewer(viewerId) {
    await runSQLiteTransaction(async (transaction) => {
      await transaction.runAsync(
        'DELETE FROM community_cached_feed_entries WHERE viewer_uid = ?',
        viewerId
      );
      await transaction.runAsync(
        'DELETE FROM community_cached_reviews WHERE viewer_uid = ?',
        viewerId
      );
    });
  },
};
