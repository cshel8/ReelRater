import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { noRemoteUserAssetCleaner } from './noopUserAssetCleaner.js';
import type {
  AccountDataDeleter,
  AccountIdentityVerifier,
  UserAssetCleaner,
} from './types.js';

const projectId = process.env.FIREBASE_PROJECT_ID ?? 'reelrater-753a6';
const app =
  getApps()[0] ??
  initializeApp({ credential: applicationDefault(), projectId });

const auth = getAuth(app);
const firestore = getFirestore(app);

async function deleteQuery(
  firestoreInstance: FirebaseFirestore.Firestore,
  query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData>
) {
  const snapshot = await query.get();
  const writer = firestoreInstance.bulkWriter();
  for (const document of snapshot.docs) {
    writer.delete(document.ref);
  }
  await writer.close();
}

const readCounter = (value: unknown) =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : 0;

async function deleteRelationshipAndRepairSurvivorCount(
  firestoreInstance: FirebaseFirestore.Firestore,
  relationshipReference: FirebaseFirestore.DocumentReference,
  deletedUserId: string
) {
  await firestoreInstance.runTransaction(async (transaction) => {
    const relationship = await transaction.get(relationshipReference);
    if (!relationship.exists) {
      return;
    }
    const data = relationship.data() ?? {};
    const followerId = data.followerId;
    const followedUserId = data.followedUserId;
    const active = data.status === 'active';
    if (!active || typeof followerId !== 'string' || typeof followedUserId !== 'string') {
      transaction.delete(relationshipReference);
      return;
    }

    const survivorId =
      followerId === deletedUserId ? followedUserId : followerId;
    if (survivorId === deletedUserId) {
      transaction.delete(relationshipReference);
      return;
    }
    const survivorReference = firestoreInstance.doc(`users/${survivorId}`);
    const survivor = await transaction.get(survivorReference);
    if (!survivor.exists) {
      transaction.delete(relationshipReference);
      return;
    }
    const counterField =
      followerId === deletedUserId ? 'followerCount' : 'followingCount';
    transaction.delete(relationshipReference);
    transaction.update(survivorReference, {
      [counterField]: Math.max(0, readCounter((survivor.data() ?? {})[counterField]) - 1),
    });
  });
}

async function deleteRelationshipsAndRepairCounts(
  firestoreInstance: FirebaseFirestore.Firestore,
  userId: string
) {
  const [incoming, outgoing] = await Promise.all([
    firestoreInstance.collection(`followRelationships/${userId}/followers`).get(),
    firestoreInstance.collectionGroup('followers').where('followerId', '==', userId).get(),
  ]);
  const relationships = new Map<string, FirebaseFirestore.DocumentReference>();
  for (const document of [...incoming.docs, ...outgoing.docs]) {
    relationships.set(document.ref.path, document.ref);
  }
  for (const reference of relationships.values()) {
    await deleteRelationshipAndRepairSurvivorCount(
      firestoreInstance,
      reference,
      userId
    );
  }
}

const isAuthUserNotFound = (error: unknown) =>
  Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'auth/user-not-found'
  );

type AccountDeletionDependencies = {
  auth: ReturnType<typeof getAuth>;
  firestore: FirebaseFirestore.Firestore;
  userAssetCleaner?: UserAssetCleaner;
};

export const firebaseAccountIdentityVerifier: AccountIdentityVerifier = {
  async verify(idToken) {
    const decoded = await auth.verifyIdToken(idToken, true);
    return {
      userId: decoded.uid,
      authenticatedAt: new Date(decoded.auth_time * 1000),
    };
  },
};

/**
 * Deletes account-owned data in independently retry-safe stages. Firestore,
 * Storage, and Firebase Auth cannot participate in one global transaction, so
 * each stage treats resources removed by an earlier attempt as completed.
 */
export const createFirebaseAccountDataDeleter = ({
  auth: authInstance,
  firestore: firestoreInstance,
  userAssetCleaner = noRemoteUserAssetCleaner,
}: AccountDeletionDependencies): AccountDataDeleter => ({
  async deleteAll(userId) {
    // These owner-ID queries remain valid even after an earlier attempt deleted
    // the profile document. In particular, they recover an orphaned handle
    // mapping without requiring a deletion-state/tombstone document.
    await deleteQuery(
      firestoreInstance,
      firestoreInstance.collection('reviews').where('userId', '==', userId)
    );
    await deleteRelationshipsAndRepairCounts(firestoreInstance, userId);
    await deleteQuery(
      firestoreInstance,
      firestoreInstance.collection('handles').where('userId', '==', userId)
    );

    const writer = firestoreInstance.bulkWriter();
    writer.delete(firestoreInstance.doc(`userSettings/${userId}`));
    writer.delete(firestoreInstance.doc(`users/${userId}`));
    await writer.close();

    // Current ReelRater has no remote user-asset provider. If one is added in
    // the future, its cleanup participates in this retry-safe sequence and a
    // genuine provider failure remains retryable rather than being ignored.
    await userAssetCleaner.deleteAssetsForUser(userId);

    // Authentication is deliberately last. A prior successful Auth deletion
    // is also a completed state, while other Admin Auth failures remain errors.
    try {
      await authInstance.deleteUser(userId);
    } catch (error) {
      if (!isAuthUserNotFound(error)) {
        throw error;
      }
    }
  },
});

export const firebaseAccountDataDeleter = createFirebaseAccountDataDeleter({
  auth,
  firestore,
});
