const mockGetAllAsync = jest.fn();
const mockRunAsync = jest.fn();
const mockDatabase = { getAllAsync: mockGetAllAsync, runAsync: mockRunAsync };
const mockTransaction = { runAsync: mockRunAsync };

jest.mock('@/database/sqliteDatabase', () => ({
  getSQLiteDatabase: jest.fn(async () => mockDatabase),
  runSQLiteTransaction: jest.fn(async (operation) => operation(mockTransaction)),
  runSQLiteWrite: jest.fn(async (operation) => operation(mockDatabase)),
}));

import { COMMUNITY_CACHE_LIMITS } from '@/services/local/communityCacheTypes';
import { sqliteCommunityCacheRepository } from '@/services/local/sqliteCommunityCacheRepository';
import type { CommunityReview } from '@/types/domain';

const metadata = {
  contentValidatedAt: '2026-09-27T12:00:00.000Z',
  authorizedAt: '2026-09-27T12:00:00.000Z',
  authorizationExpiresAt: null,
  lastRelationshipValidatedAt: null,
  cachedRelationshipStatus: null,
  lastSeenAt: '2026-09-27T12:00:00.000Z',
} as const;

const followersMetadata = {
  ...metadata,
  authorizedAt: '2026-09-27T12:00:00.000Z',
  authorizationExpiresAt: '2026-09-27T18:00:00.000Z',
  lastRelationshipValidatedAt: '2026-09-27T12:00:00.000Z',
  cachedRelationshipStatus: 'active' as const,
};

function createReview(
  id = 'review-1',
  visibility: 'public' | 'followers' | 'private' = 'public'
): CommunityReview {
  return {
    id,
    authorId: 'author-1',
    author: {
      id: 'author-1',
      displayName: 'Author',
      handle: 'author',
      handleNormalized: 'author',
      profileImage: null,
      accountPrivacy: 'public',
      followerCount: 0,
      followingCount: 0,
    },
    movieTitle: 'Arrival',
    reviewText: 'Excellent.',
    rating: 5,
    spoilerWarning: false,
    visibility: visibility as 'public',
    createdAt: '2026-09-27T10:00:00.000Z',
    syncStatus: 'synced',
  };
}

describe('SQLite Community cache repository', () => {
  beforeEach(() => jest.clearAllMocks());

  it('stores a normalized snapshot once while allowing it in Following and Everyone', async () => {
    await sqliteCommunityCacheRepository.upsertReview('viewer-a', createReview(), metadata);
    await sqliteCommunityCacheRepository.upsertFeedEntry(
      'viewer-a',
      'following',
      'review-1',
      metadata.lastSeenAt
    );
    await sqliteCommunityCacheRepository.upsertFeedEntry(
      'viewer-a',
      'everyone',
      'review-1',
      metadata.lastSeenAt
    );

    const snapshotInserts = mockRunAsync.mock.calls.filter(([sql]) =>
      String(sql).includes('community_cached_reviews') && String(sql).includes('INSERT')
    );
    const membershipInserts = mockRunAsync.mock.calls.filter(([sql]) =>
      String(sql).includes('community_cached_feed_entries') && String(sql).includes('INSERT')
    );
    expect(snapshotInserts).toHaveLength(1);
    expect(membershipInserts).toHaveLength(2);
  });

  it('retains a newly stored snapshot until its separate feed membership is written', async () => {
    await sqliteCommunityCacheRepository.upsertReview('viewer-a', createReview(), metadata);

    expect(mockRunAsync.mock.calls.some(([sql]) =>
      String(sql).includes('DELETE FROM community_cached_reviews')
    )).toBe(false);
  });

  it('scopes same review IDs independently by viewer', async () => {
    await sqliteCommunityCacheRepository.upsertReview('viewer-a', createReview('shared'), metadata);
    await sqliteCommunityCacheRepository.upsertReview('viewer-b', createReview('shared'), metadata);

    const inserts = mockRunAsync.mock.calls.filter(([sql]) =>
      String(sql).includes('INSERT OR REPLACE INTO community_cached_reviews')
    );
    expect(inserts).toHaveLength(2);
    expect(inserts.map(([, viewerId, reviewId]) => [viewerId, reviewId])).toEqual([
      ['viewer-a', 'shared'],
      ['viewer-b', 'shared'],
    ]);
  });

  it('retrieves feed membership only for the requested viewer and mode', async () => {
    mockGetAllAsync.mockResolvedValue([
      {
        viewer_uid: 'viewer-a',
        review_id: 'review-1',
        author_id: 'author-1',
        visibility: 'public',
        review_json: JSON.stringify(createReview()),
        content_validated_at: metadata.contentValidatedAt,
        authorized_at: metadata.authorizedAt,
        authorization_expires_at: null,
        last_relationship_validated_at: null,
        cached_relationship_status: null,
        last_seen_at: metadata.lastSeenAt,
      },
    ]);

    await expect(
      sqliteCommunityCacheRepository.listForFeed('viewer-a', 'following')
    ).resolves.toHaveLength(1);
    expect(mockGetAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('WHERE entry.viewer_uid = ? AND entry.feed_mode = ?'),
      'viewer-a',
      'following'
    );
  });

  it('rejects unsupported feed modes and private Community content', async () => {
    await expect(
      sqliteCommunityCacheRepository.upsertFeedEntry(
        'viewer-a',
        'other' as never,
        'review-1',
        metadata.lastSeenAt
      )
    ).rejects.toThrow('Unsupported Community cache feed mode');
    await expect(
      sqliteCommunityCacheRepository.upsertReview(
        'viewer-a',
        createReview('private', 'private'),
        metadata
      )
    ).rejects.toThrow('Only public or followers-only reviews');
  });

  it.each([
    ['malformed JSON', '{not-json}', 'review-1', 'author-1', 'public'],
    ['review ID mismatch', JSON.stringify(createReview('other-review')), 'review-1', 'author-1', 'public'],
    ['author ID mismatch', JSON.stringify({ ...createReview(), authorId: 'other-author' }), 'review-1', 'author-1', 'public'],
    ['visibility mismatch', JSON.stringify(createReview()), 'review-1', 'author-1', 'followers'],
    ['private serialized content', JSON.stringify(createReview('review-1', 'private')), 'review-1', 'author-1', 'private'],
    ['invalid rating', JSON.stringify({ ...createReview(), rating: '5' }), 'review-1', 'author-1', 'public'],
  ])('skips %s without surfacing corrupt Community content', async (_case, reviewJson, reviewId, authorId, visibility) => {
    mockGetAllAsync.mockResolvedValue([
      {
        viewer_uid: 'viewer-a',
        review_id: reviewId,
        author_id: authorId,
        visibility,
        review_json: reviewJson,
        content_validated_at: metadata.contentValidatedAt,
        authorized_at: metadata.authorizedAt,
        authorization_expires_at: metadata.authorizationExpiresAt,
        last_relationship_validated_at: metadata.lastRelationshipValidatedAt,
        cached_relationship_status: metadata.cachedRelationshipStatus,
        last_seen_at: metadata.lastSeenAt,
      },
    ]);

    await expect(
      sqliteCommunityCacheRepository.listForFeed('viewer-a', 'following')
    ).resolves.toEqual([]);
  });

  it('requires active, consistent metadata before persisting followers-only content', async () => {
    await expect(
      sqliteCommunityCacheRepository.upsertReview(
        'viewer-a',
        createReview('followers-review', 'followers'),
        metadata
      )
    ).rejects.toThrow('Followers-only Community cache entries');

    await expect(
      sqliteCommunityCacheRepository.upsertReview(
        'viewer-a',
        createReview('followers-review', 'followers'),
        followersMetadata
      )
    ).resolves.toBeUndefined();
  });

  it('keeps a snapshot when one of its two feed memberships is removed', async () => {
    await sqliteCommunityCacheRepository.removeFeedEntry(
      'viewer-a',
      'following',
      'review-1'
    );

    const snapshotPrune = mockRunAsync.mock.calls.find(([sql]) =>
      String(sql).includes('DELETE FROM community_cached_reviews') &&
      String(sql).includes('NOT IN')
    );
    expect(snapshotPrune).toBeDefined();
    expect(String(snapshotPrune?.[0])).toContain('community_cached_feed_entries');
  });

  it('clears only the requested viewer cache', async () => {
    await sqliteCommunityCacheRepository.clearForViewer('viewer-a');
    const deletes = mockRunAsync.mock.calls.filter(([sql]) => String(sql).includes('DELETE FROM community_cached_'));
    expect(deletes).toHaveLength(2);
    expect(deletes.every(([, viewerId]) => viewerId === 'viewer-a')).toBe(true);
  });

  it('removes an unfollowed author from Following and destroys only their protected snapshot', async () => {
    await sqliteCommunityCacheRepository.invalidateFollowingAuthor(
      'viewer-a',
      'author-a'
    );

    const calls = mockRunAsync.mock.calls;
    expect(calls.some(([sql, viewerId, , authorId]) =>
      String(sql).includes("feed_mode = 'following'") &&
      viewerId === 'viewer-a' && authorId === 'author-a'
    )).toBe(true);
    expect(calls.some(([sql, viewerId, authorId]) =>
      String(sql).includes("visibility = 'followers'") &&
      viewerId === 'viewer-a' && authorId === 'author-a'
    )).toBe(true);
    expect(calls.some(([sql]) =>
      String(sql).includes('DELETE FROM community_cached_reviews') &&
      String(sql).includes('NOT IN')
    )).toBe(true);
  });

  it('applies the per-viewer 50-entry feed caps and 80-snapshot cap', async () => {
    await sqliteCommunityCacheRepository.upsertFeedEntry(
      'viewer-a',
      'following',
      'review-51',
      metadata.lastSeenAt
    );
    await sqliteCommunityCacheRepository.upsertFeedEntry(
      'viewer-a',
      'everyone',
      'review-51',
      metadata.lastSeenAt
    );
    await sqliteCommunityCacheRepository.enforceBounds('viewer-a');

    const followingLimitCall = mockRunAsync.mock.calls.find(([, viewerId, mode, , , limit]) =>
      viewerId === 'viewer-a' && mode === 'following' && limit === COMMUNITY_CACHE_LIMITS.followingFeedEntries
    );
    const everyoneLimitCall = mockRunAsync.mock.calls.find(([, viewerId, mode, , , limit]) =>
      viewerId === 'viewer-a' && mode === 'everyone' && limit === COMMUNITY_CACHE_LIMITS.everyoneFeedEntries
    );
    const snapshotLimitCall = mockRunAsync.mock.calls.find(([sql, viewerId, , limit]) =>
      String(sql).includes('LIMIT -1 OFFSET ?') &&
      viewerId === 'viewer-a' &&
      limit === COMMUNITY_CACHE_LIMITS.reviewSnapshots
    );
    expect(followingLimitCall).toBeDefined();
    expect(everyoneLimitCall).toBeDefined();
    expect(snapshotLimitCall).toBeDefined();
  });
});
