import {
  createFirebasePublicReviewSchemaInventoryRepository,
  resolveDevelopmentFirebaseProjectId,
} from './firebasePublicReviewSchemaInventoryRepository.js';
import { PublicReviewSchemaInventoryJob } from './publicReviewSchemaInventory.js';

async function main() {
  if (process.argv.length > 2) {
    throw new Error('Usage: inventory-public-review-schema');
  }
  const projectId = resolveDevelopmentFirebaseProjectId();
  console.log('PUBLIC REVIEW SCHEMA INVENTORY: READ-ONLY MODE');
  console.log(`Target Firebase project: ${projectId}`);
  console.log('Scanning reviews where visibility == "public". No writes, Auth changes, or deployments will occur.');

  const repository = createFirebasePublicReviewSchemaInventoryRepository(projectId);
  const result = await new PublicReviewSchemaInventoryJob(repository).run();
  for (const review of result.unsafeReviews) {
    console.log(JSON.stringify({
      reviewId: review.reviewId,
      userId: review.userId,
      movieTitle: review.movieTitle,
      issues: review.issues,
    }));
  }
  console.log('Public review schema inventory completed.');
  console.log(JSON.stringify(result, null, 2));
}

void main().catch((error) => {
  console.error('Public review schema inventory failed.');
  console.error(error);
  process.exitCode = 1;
});
