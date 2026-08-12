import { firebaseSocialCounterReconciliationRepository } from './firebaseSocialCounterReconciliationRepository.js';
import { SocialCounterReconciliationJob } from './socialCounterReconciliation.js';

function readBatchSize(argumentsList: string[]) {
  const option = argumentsList.find((argument) => argument.startsWith('--batch-size='));
  if (!option) return undefined;
  const value = Number(option.slice('--batch-size='.length));
  if (!Number.isInteger(value) || value < 1) {
    throw new Error('Use --batch-size=<positive integer>.');
  }
  return value;
}

async function main() {
  const batchSize = readBatchSize(process.argv.slice(2));
  const job = new SocialCounterReconciliationJob(
    firebaseSocialCounterReconciliationRepository
  );
  const result = await job.run({ batchSize });
  console.log('Social counter reconciliation completed.');
  console.log(JSON.stringify(result, null, 2));
}

void main().catch((error) => {
  console.error('Social counter reconciliation failed.');
  console.error(error);
  process.exitCode = 1;
});
