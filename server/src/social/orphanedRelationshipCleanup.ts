export type SocialRelationshipRecord = {
  path: string;
  followerId: string;
  followedUserId: string;
  status: unknown;
};

export type ProfileExistence = {
  followerProfileExists: boolean;
  followedProfileExists: boolean;
};

export type OrphanedRelationship = SocialRelationshipRecord & ProfileExistence;

export type OrphanedRelationshipCleanupRepository = {
  listRelationships(input: {
    cursor?: string;
    maximumResults: number;
  }): Promise<{ records: SocialRelationshipRecord[]; nextCursor: string | null }>;
  checkProfiles(input: Pick<SocialRelationshipRecord, 'followerId' | 'followedUserId'>): Promise<ProfileExistence>;
  deleteIfStillOrphaned(path: string): Promise<
    | { action: 'deleted'; relationship: OrphanedRelationship }
    | { action: 'retained'; relationship: SocialRelationshipRecord }
    | { action: 'missing' }
  >;
};

export type OrphanedRelationshipCleanupResult = {
  mode: 'dry-run' | 'delete-orphans';
  relationshipsScanned: number;
  validRelationships: number;
  orphanedRelationships: number;
  activeOrphans: number;
  pendingOrphans: number;
  orphans: OrphanedRelationship[];
  deletedRelationships: OrphanedRelationship[];
  retainedDuringRevalidation: SocialRelationshipRecord[];
  missingDuringRevalidation: number;
};

const DEFAULT_BATCH_SIZE = 100;

const readBatchSize = (value: number | undefined) => {
  if (value === undefined) return DEFAULT_BATCH_SIZE;
  if (!Number.isInteger(value) || value < 1) {
    throw new Error('The cleanup batch size must be a positive integer.');
  }
  return value;
};

const isOrphan = (presence: ProfileExistence) =>
  !presence.followerProfileExists || !presence.followedProfileExists;

/**
 * Trusted maintenance workflow for historical data only. Normal account
 * deletion owns current relationship cleanup; this job defaults to read-only
 * reporting and requires an explicit opt-in before deleting anything.
 */
export class OrphanedRelationshipCleanupJob {
  constructor(
    private readonly repository: OrphanedRelationshipCleanupRepository
  ) {}

  async run(options: { batchSize?: number; deleteOrphans?: boolean } = {}) {
    const batchSize = readBatchSize(options.batchSize);
    const mode = options.deleteOrphans ? 'delete-orphans' : 'dry-run';
    const result: OrphanedRelationshipCleanupResult = {
      mode,
      relationshipsScanned: 0,
      validRelationships: 0,
      orphanedRelationships: 0,
      activeOrphans: 0,
      pendingOrphans: 0,
      orphans: [],
      deletedRelationships: [],
      retainedDuringRevalidation: [],
      missingDuringRevalidation: 0,
    };

    let cursor: string | undefined;
    do {
      const page = await this.repository.listRelationships({
        cursor,
        maximumResults: batchSize,
      });
      if (page.records.length > batchSize) {
        throw new Error('Relationship repository returned more records than requested.');
      }

      for (const relationship of page.records) {
        result.relationshipsScanned += 1;
        const presence = await this.repository.checkProfiles(relationship);
        if (!isOrphan(presence)) {
          result.validRelationships += 1;
          continue;
        }

        const orphan = { ...relationship, ...presence };
        result.orphanedRelationships += 1;
        result.orphans.push(orphan);
        if (relationship.status === 'active') result.activeOrphans += 1;
        if (relationship.status === 'pending') result.pendingOrphans += 1;

        if (mode === 'delete-orphans') {
          const deletion = await this.repository.deleteIfStillOrphaned(
            relationship.path
          );
          if (deletion.action === 'deleted') {
            result.deletedRelationships.push(deletion.relationship);
          }
          if (deletion.action === 'retained') {
            result.retainedDuringRevalidation.push(deletion.relationship);
          }
          if (deletion.action === 'missing') {
            result.missingDuringRevalidation += 1;
          }
        }
      }
      cursor = page.nextCursor ?? undefined;
    } while (cursor);

    return result;
  }
}
