import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type {
  PersistedPublicReview,
} from './publicReviewSchemaInventory.js';

export const DEVELOPMENT_FIREBASE_PROJECT_ID = 'reelrater-753a6';

export const resolveDevelopmentFirebaseProjectId = () => {
  const configuredProjectId = process.env.FIREBASE_PROJECT_ID?.trim();
  if (
    configuredProjectId &&
    configuredProjectId !== DEVELOPMENT_FIREBASE_PROJECT_ID
  ) {
    throw new Error(
      `Refusing to scan Firebase project "${configuredProjectId}". ` +
        `This maintenance command is restricted to "${DEVELOPMENT_FIREBASE_PROJECT_ID}".`
    );
  }
  return configuredProjectId || DEVELOPMENT_FIREBASE_PROJECT_ID;
};

/**
 * Firebase Admin adapter for the public-review inventory. The only Firestore
 * operation exposed is a read query; this command has no write or Auth API.
 */
export const createFirebasePublicReviewSchemaInventoryRepository = (
  projectId: string
) => {
  const app = initializeApp(
    { credential: applicationDefault(), projectId },
    `public-review-schema-inventory-${projectId}`
  );
  const firestore = getFirestore(app);

  return {
    async listPublicReviews(): Promise<PersistedPublicReview[]> {
      const snapshot = await firestore
        .collection('reviews')
        .where('visibility', '==', 'public')
        .get();
      return snapshot.docs.map((document) => ({
        reviewId: document.id,
        value: document.data(),
      }));
    },
  };
};
