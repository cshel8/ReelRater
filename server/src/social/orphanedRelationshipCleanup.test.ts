import assert from 'node:assert/strict';
import test from 'node:test';
import {
  OrphanedRelationshipCleanupJob,
  type OrphanedRelationshipCleanupRepository,
  type SocialRelationshipRecord,
} from './orphanedRelationshipCleanup.js';

const relationship = (
  followerId: string,
  followedUserId: string,
  status: 'active' | 'pending' = 'active'
): SocialRelationshipRecord => ({
  path: `followRelationships/${followedUserId}/followers/${followerId}`,
  followerId,
  followedUserId,
  status,
});

class MemoryRepository implements OrphanedRelationshipCleanupRepository {
  readonly deletedPaths: string[] = [];

  constructor(
    readonly profiles: Set<string>,
    readonly relationships: Map<string, SocialRelationshipRecord>
  ) {}

  async listRelationships({ cursor, maximumResults }: {
    cursor?: string;
    maximumResults: number;
  }) {
    const paths = [...this.relationships.keys()].sort();
    const start = cursor ? paths.indexOf(cursor) + 1 : 0;
    const records = paths.slice(start, start + maximumResults)
      .map((path) => this.relationships.get(path)!);
    return {
      records,
      nextCursor: start + records.length < paths.length
        ? records.at(-1)?.path ?? null
        : null,
    };
  }

  async checkProfiles({ followerId, followedUserId }: Pick<SocialRelationshipRecord, 'followerId' | 'followedUserId'>) {
    return {
      followerProfileExists: this.profiles.has(followerId),
      followedProfileExists: this.profiles.has(followedUserId),
    };
  }

  async deleteIfStillOrphaned(path: string) {
    const current = this.relationships.get(path);
    if (!current) return { action: 'missing' as const };
    const presence = await this.checkProfiles(current);
    if (presence.followerProfileExists && presence.followedProfileExists) {
      return { action: 'retained' as const, relationship: current };
    }
    this.relationships.delete(path);
    this.deletedPaths.push(path);
    return { action: 'deleted' as const, relationship: { ...current, ...presence } };
  }
}

const repositoryFor = (
  profileIds: string[],
  relationships: SocialRelationshipRecord[]
) => new MemoryRepository(
  new Set(profileIds),
  new Map(relationships.map((item) => [item.path, item]))
);

test('retains valid active and pending relationships during a dry run', async () => {
  const repository = repositoryFor(
    ['alex', 'connor'],
    [relationship('alex', 'connor', 'active'), relationship('connor', 'alex', 'pending')]
  );

  const result = await new OrphanedRelationshipCleanupJob(repository).run();

  assert.equal(result.relationshipsScanned, 2);
  assert.equal(result.validRelationships, 2);
  assert.equal(result.orphanedRelationships, 0);
  assert.equal(repository.deletedPaths.length, 0);
});

test('reports missing follower, missing followed profile, and both missing without deleting', async () => {
  const missingFollower = relationship('missing-follower', 'alex');
  const missingFollowed = relationship('alex', 'missing-followed');
  const bothMissing = relationship('missing-one', 'missing-two');
  const repository = repositoryFor(
    ['alex'],
    [missingFollower, missingFollowed, bothMissing]
  );

  const result = await new OrphanedRelationshipCleanupJob(repository).run({ batchSize: 1 });

  assert.equal(result.orphanedRelationships, 3);
  assert.equal(result.activeOrphans, 3);
  assert.equal(result.pendingOrphans, 0);
  assert.deepEqual(result.orphans.map((item) => ({
    path: item.path,
    followerProfileExists: item.followerProfileExists,
    followedProfileExists: item.followedProfileExists,
  })), [
    {
      path: missingFollower.path,
      followerProfileExists: false,
      followedProfileExists: true,
    },
    {
      path: missingFollowed.path,
      followerProfileExists: true,
      followedProfileExists: false,
    },
    {
      path: bothMissing.path,
      followerProfileExists: false,
      followedProfileExists: false,
    },
  ]);
  assert.equal(repository.deletedPaths.length, 0);
});

test('detects pending orphans in dry-run mode', async () => {
  const pendingOrphan = relationship('alex', 'missing-user', 'pending');
  const repository = repositoryFor(['alex'], [pendingOrphan]);

  const result = await new OrphanedRelationshipCleanupJob(repository).run();

  assert.equal(result.orphanedRelationships, 1);
  assert.equal(result.activeOrphans, 0);
  assert.equal(result.pendingOrphans, 1);
  assert.equal(result.orphans[0]?.status, 'pending');
  assert.equal(repository.deletedPaths.length, 0);
});

test('explicit deletion revalidates and removes only orphaned relationships', async () => {
  const valid = relationship('alex', 'connor', 'active');
  const orphan = relationship('alex', 'missing-user', 'active');
  const repository = repositoryFor(['alex', 'connor'], [valid, orphan]);

  const result = await new OrphanedRelationshipCleanupJob(repository).run({
    deleteOrphans: true,
  });

  assert.deepEqual(repository.deletedPaths, [orphan.path]);
  assert.equal(repository.relationships.has(orphan.path), false);
  assert.equal(repository.relationships.has(valid.path), true);
  assert.deepEqual(result.deletedRelationships.map((item) => item.path), [orphan.path]);
  assert.equal(result.retainedDuringRevalidation.length, 0);
});

test('rerunning cleanup after deletion is safe and performs no additional deletes', async () => {
  const orphan = relationship('alex', 'missing-user');
  const repository = repositoryFor(['alex'], [orphan]);
  const job = new OrphanedRelationshipCleanupJob(repository);

  await job.run({ deleteOrphans: true });
  const rerun = await job.run({ deleteOrphans: true });

  assert.equal(repository.deletedPaths.length, 1);
  assert.equal(rerun.relationshipsScanned, 0);
  assert.equal(rerun.orphanedRelationships, 0);
  assert.equal(rerun.deletedRelationships.length, 0);
});
