import { firebaseOrphanedRelationshipCleanupRepository } from './firebaseOrphanedRelationshipCleanupRepository.js';
import { OrphanedRelationshipCleanupJob } from './orphanedRelationshipCleanup.js';

function readOptions(argumentsList: string[]) {
  const deleteOrphans = argumentsList.includes('--delete-orphans');
  const batchOption = argumentsList.find((argument) =>
    argument.startsWith('--batch-size=')
  );
  const unknown = argumentsList.filter(
    (argument) => argument !== '--delete-orphans' && argument !== batchOption
  );
  if (unknown.length > 0) {
    throw new Error(
      'Usage: cleanup-orphaned-relationships [--delete-orphans] [--batch-size=<positive integer>]'
    );
  }
  const batchSize = batchOption
    ? Number(batchOption.slice('--batch-size='.length))
    : undefined;
  if (batchSize !== undefined && (!Number.isInteger(batchSize) || batchSize < 1)) {
    throw new Error('Use --batch-size=<positive integer>.');
  }
  return { batchSize, deleteOrphans };
}

async function main() {
  const options = readOptions(process.argv.slice(2));
  if (options.deleteOrphans) {
    console.log('ORPHANED RELATIONSHIP CLEANUP: DELETE MODE — relationships will be revalidated before deletion.');
  } else {
    console.log('ORPHANED RELATIONSHIP CLEANUP: DRY RUN — no Firestore writes will occur.');
  }
  const job = new OrphanedRelationshipCleanupJob(
    firebaseOrphanedRelationshipCleanupRepository
  );
  const result = await job.run(options);
  console.log('Orphaned relationship cleanup completed.');
  console.log(JSON.stringify(result, null, 2));
}

void main().catch((error) => {
  console.error('Orphaned relationship cleanup failed.');
  console.error(error);
  process.exitCode = 1;
});
