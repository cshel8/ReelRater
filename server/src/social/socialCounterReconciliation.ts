export type SocialCounterProfile = {
  userId: string;
};

export type SocialCounterRelationship = {
  followerId: string;
  followedUserId: string;
  status: unknown;
};

export type SocialCounterPage<T> = {
  records: T[];
  nextCursor: string | null;
};

/**
 * Trusted persistence boundary for the administrative reconciliation job.
 * It deliberately contains no client-facing operations or client-provided
 * counter values.
 */
export interface SocialCounterReconciliationRepository {
  listProfiles(input: {
    cursor?: string;
    maximumResults: number;
  }): Promise<SocialCounterPage<SocialCounterProfile>>;
  listRelationships(input: {
    cursor?: string;
    maximumResults: number;
  }): Promise<SocialCounterPage<SocialCounterRelationship>>;
  replaceCounters(input: {
    userId: string;
    followerCount: number;
    followingCount: number;
  }): Promise<'updated' | 'unchanged' | 'missing'>;
}

export type SocialCounterReconciliationResult = {
  profilesScanned: number;
  relationshipsScanned: number;
  activeRelationshipsCounted: number;
  profilesUpdated: number;
  profilesUnchanged: number;
  profilesMissingAtWrite: number;
  danglingRelationshipsIgnored: number;
};

const DEFAULT_BATCH_SIZE = 100;

const positiveInteger = (value: number | undefined) => {
  if (value === undefined) return DEFAULT_BATCH_SIZE;
  if (!Number.isInteger(value) || value < 1) {
    throw new Error('The reconciliation batch size must be a positive integer.');
  }
  return value;
};

const emptyResult = (): SocialCounterReconciliationResult => ({
  profilesScanned: 0,
  relationshipsScanned: 0,
  activeRelationshipsCounted: 0,
  profilesUpdated: 0,
  profilesUnchanged: 0,
  profilesMissingAtWrite: 0,
  danglingRelationshipsIgnored: 0,
});

/**
 * Rebuilds trusted social counters from relationship documents.
 *
 * This is intentionally a maintenance/backfill workflow, distinct from the
 * new-account /social/counters endpoint. It sets absolute values so it can be
 * safely rerun after partial failures; it never applies an increment based on
 * a previous reconciliation result.
 */
export class SocialCounterReconciliationJob {
  constructor(
    private readonly repository: SocialCounterReconciliationRepository
  ) {}

  async run(options: { batchSize?: number } = {}) {
    const batchSize = positiveInteger(options.batchSize);
    const result = emptyResult();
    const userIds = new Set<string>();
    let profileCursor: string | undefined;

    do {
      const page = await this.repository.listProfiles({
        cursor: profileCursor,
        maximumResults: batchSize,
      });
      if (page.records.length > batchSize) {
        throw new Error('Profile repository returned more records than requested.');
      }
      for (const profile of page.records) {
        userIds.add(profile.userId);
        result.profilesScanned += 1;
      }
      profileCursor = page.nextCursor ?? undefined;
    } while (profileCursor);

    const totals = new Map<string, { followerCount: number; followingCount: number }>();
    for (const userId of userIds) {
      totals.set(userId, { followerCount: 0, followingCount: 0 });
    }

    let relationshipCursor: string | undefined;
    do {
      const page = await this.repository.listRelationships({
        cursor: relationshipCursor,
        maximumResults: batchSize,
      });
      if (page.records.length > batchSize) {
        throw new Error('Relationship repository returned more records than requested.');
      }
      for (const relationship of page.records) {
        result.relationshipsScanned += 1;
        if (relationship.status !== 'active') continue;

        const followerTotals = totals.get(relationship.followerId);
        const followedTotals = totals.get(relationship.followedUserId);
        if (!followerTotals || !followedTotals) {
          // Deleted/incomplete profiles must not leave social counts that
          // point at non-existent accounts.
          result.danglingRelationshipsIgnored += 1;
          continue;
        }

        followerTotals.followingCount += 1;
        followedTotals.followerCount += 1;
        result.activeRelationshipsCounted += 1;
      }
      relationshipCursor = page.nextCursor ?? undefined;
    } while (relationshipCursor);

    for (const [userId, counts] of totals) {
      const writeResult = await this.repository.replaceCounters({ userId, ...counts });
      if (writeResult === 'updated') result.profilesUpdated += 1;
      if (writeResult === 'unchanged') result.profilesUnchanged += 1;
      if (writeResult === 'missing') result.profilesMissingAtWrite += 1;
    }

    return result;
  }
}
