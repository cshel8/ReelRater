import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { FieldPath, getFirestore } from 'firebase-admin/firestore';
import type {
  SocialCounterReconciliationRepository,
} from './socialCounterReconciliation.js';

const projectId = process.env.FIREBASE_PROJECT_ID ?? 'reelrater-753a6';
const app =
  getApps()[0] ?? initializeApp({ credential: applicationDefault(), projectId });
const firestore = getFirestore(app);

const validCounter = (value: unknown) =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

/** Firebase Admin adapter used only by the trusted maintenance command. */
export const firebaseSocialCounterReconciliationRepository: SocialCounterReconciliationRepository = {
  async listProfiles({ cursor, maximumResults }) {
    let request = firestore
      .collection('users')
      .orderBy(FieldPath.documentId())
      .limit(maximumResults);
    if (cursor) request = request.startAfter(cursor);
    const snapshot = await request.get();
    return {
      records: snapshot.docs.map((document) => ({ userId: document.id })),
      nextCursor:
        snapshot.size === maximumResults
          ? snapshot.docs.at(-1)?.id ?? null
          : null,
    };
  },

  async listRelationships({ cursor, maximumResults }) {
    let request = firestore
      .collectionGroup('followers')
      .orderBy(FieldPath.documentId())
      .limit(maximumResults);
    if (cursor) request = request.startAfter(cursor);
    const snapshot = await request.get();
    return {
      records: snapshot.docs.flatMap((document) => {
        const data = document.data();
        return typeof data.followerId === 'string' &&
          typeof data.followedUserId === 'string'
          ? [{
              followerId: data.followerId,
              followedUserId: data.followedUserId,
              status: data.status,
            }]
          : [];
      }),
      nextCursor:
        snapshot.size === maximumResults
          ? snapshot.docs.at(-1)?.ref.path ?? null
          : null,
    };
  },

  async replaceCounters({ userId, followerCount, followingCount }) {
    const reference = firestore.doc(`users/${userId}`);
    return firestore.runTransaction(async (transaction) => {
      const profile = await transaction.get(reference);
      if (!profile.exists) return 'missing' as const;

      const data = profile.data() ?? {};
      if (
        validCounter(data.followerCount) &&
        validCounter(data.followingCount) &&
        data.followerCount === followerCount &&
        data.followingCount === followingCount
      ) {
        return 'unchanged' as const;
      }

      transaction.update(reference, { followerCount, followingCount });
      return 'updated' as const;
    });
  },
};
