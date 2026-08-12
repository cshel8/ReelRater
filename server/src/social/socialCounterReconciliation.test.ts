import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SocialCounterReconciliationJob,
  type SocialCounterProfile,
  type SocialCounterReconciliationRepository,
  type SocialCounterRelationship,
} from './socialCounterReconciliation.js';

class MemoryRepository implements SocialCounterReconciliationRepository {
  readonly writes: Array<{ userId: string; followerCount: number; followingCount: number }> = [];

  constructor(
    readonly profiles: Map<string, { followerCount?: unknown; followingCount?: unknown }>,
    private readonly relationships: SocialCounterRelationship[],
    private readonly pageSize = 100
  ) {}

  async listProfiles({
    cursor,
    maximumResults,
  }: {
    cursor?: string;
    maximumResults: number;
  }) {
    const all = [...this.profiles.keys()].sort();
    const start = cursor ? all.indexOf(cursor) + 1 : 0;
    const records: SocialCounterProfile[] = all.slice(start, start + Math.min(maximumResults, this.pageSize))
      .map((userId) => ({ userId }));
    return {
      records,
      nextCursor: start + records.length < all.length ? records.at(-1)?.userId ?? null : null,
    };
  }

  async listRelationships({
    cursor,
    maximumResults,
  }: {
    cursor?: string;
    maximumResults: number;
  }) {
    const start = cursor ? Number(cursor) : 0;
    const records = this.relationships.slice(start, start + Math.min(maximumResults, this.pageSize));
    const next = start + records.length;
    return { records, nextCursor: next < this.relationships.length ? String(next) : null };
  }

  async replaceCounters({
    userId,
    followerCount,
    followingCount,
  }: {
    userId: string;
    followerCount: number;
    followingCount: number;
  }) {
    const profile = this.profiles.get(userId);
    if (!profile) return 'missing' as const;
    this.writes.push({ userId, followerCount, followingCount });
    if (profile.followerCount === followerCount && profile.followingCount === followingCount) {
      return 'unchanged' as const;
    }
    profile.followerCount = followerCount;
    profile.followingCount = followingCount;
    return 'updated' as const;
  }
}

const profiles = (...userIds: string[]) =>
  new Map(userIds.map((userId) => [userId, {}]));

const active = (followerId: string, followedUserId: string): SocialCounterRelationship => ({
  followerId,
  followedUserId,
  status: 'active',
});

const pending = (followerId: string, followedUserId: string): SocialCounterRelationship => ({
  followerId,
  followedUserId,
  status: 'pending',
});

test('reconciliation writes zeroes for profiles with no relationships', async () => {
  const repository = new MemoryRepository(profiles('alex', 'connor'), []);
  const result = await new SocialCounterReconciliationJob(repository).run();

  assert.equal(repository.profiles.get('alex')?.followerCount, 0);
  assert.equal(repository.profiles.get('alex')?.followingCount, 0);
  assert.equal(repository.profiles.get('connor')?.followerCount, 0);
  assert.equal(result.activeRelationshipsCounted, 0);
});

test('reconciliation derives active follower and following totals', async () => {
  const repository = new MemoryRepository(
    profiles('alex', 'connor', 'maria'),
    [active('alex', 'connor'), active('maria', 'connor')]
  );
  await new SocialCounterReconciliationJob(repository).run({ batchSize: 1 });

  assert.deepEqual(repository.profiles.get('connor'), {
    followerCount: 2,
    followingCount: 0,
  });
  assert.deepEqual(repository.profiles.get('alex'), {
    followerCount: 0,
    followingCount: 1,
  });
  assert.deepEqual(repository.profiles.get('maria'), {
    followerCount: 0,
    followingCount: 1,
  });
});

test('reconciliation ignores pending relationships and handles mixed statuses', async () => {
  const repository = new MemoryRepository(
    profiles('alex', 'connor', 'maria'),
    [pending('alex', 'connor'), active('maria', 'connor'), pending('connor', 'maria')]
  );
  const result = await new SocialCounterReconciliationJob(repository).run();

  assert.equal(result.activeRelationshipsCounted, 1);
  assert.deepEqual(repository.profiles.get('connor'), {
    followerCount: 1,
    followingCount: 0,
  });
  assert.deepEqual(repository.profiles.get('alex'), {
    followerCount: 0,
    followingCount: 0,
  });
});

test('reconciliation corrects invalid and drifted stored counters', async () => {
  const repository = new MemoryRepository(
    new Map([
      ['alex', { followerCount: -4, followingCount: 'wrong' }],
      ['connor', { followerCount: 99, followingCount: 40 }],
    ]),
    [active('alex', 'connor')]
  );
  const result = await new SocialCounterReconciliationJob(repository).run();

  assert.equal(result.profilesUpdated, 2);
  assert.deepEqual(repository.profiles.get('alex'), {
    followerCount: 0,
    followingCount: 1,
  });
  assert.deepEqual(repository.profiles.get('connor'), {
    followerCount: 1,
    followingCount: 0,
  });
});

test('a rerun is safe because it replaces absolute totals', async () => {
  const repository = new MemoryRepository(
    profiles('alex', 'connor'),
    [active('alex', 'connor')]
  );
  const job = new SocialCounterReconciliationJob(repository);

  const first = await job.run();
  const second = await job.run();

  assert.equal(first.profilesUpdated, 2);
  assert.equal(second.profilesUpdated, 0);
  assert.equal(second.profilesUnchanged, 2);
  assert.deepEqual(repository.profiles.get('alex'), {
    followerCount: 0,
    followingCount: 1,
  });
});

test('dangling active relationships are ignored and profiles deleted during writes are reported', async () => {
  const repository = new MemoryRepository(
    profiles('alex'),
    [active('alex', 'missing-user')]
  );
  const job = new SocialCounterReconciliationJob(repository);
  const result = await job.run();

  assert.equal(result.danglingRelationshipsIgnored, 1);
  assert.deepEqual(repository.profiles.get('alex'), {
    followerCount: 0,
    followingCount: 0,
  });

  const disappearingRepository = new MemoryRepository(profiles('alex'), []);
  disappearingRepository.replaceCounters = async () => 'missing';
  const missingResult = await new SocialCounterReconciliationJob(
    disappearingRepository
  ).run();
  assert.equal(missingResult.profilesMissingAtWrite, 1);
});
