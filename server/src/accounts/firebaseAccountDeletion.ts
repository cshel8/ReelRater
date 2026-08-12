import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import type { AccountDataDeleter, AccountIdentityVerifier } from './types.js';

const projectId = process.env.FIREBASE_PROJECT_ID ?? 'reelrater-753a6';
const storageBucket =
  process.env.FIREBASE_STORAGE_BUCKET ?? 'reelrater-753a6.firebasestorage.app';
const app =
  getApps()[0] ??
  initializeApp({ credential: applicationDefault(), projectId, storageBucket });

const auth = getAuth(app);
const firestore = getFirestore(app);
const bucket = getStorage(app).bucket();

async function deleteQuery(
  query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData>
) {
  const snapshot = await query.get();
  const writer = firestore.bulkWriter();
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
  relationshipReference: FirebaseFirestore.DocumentReference,
  deletedUserId: string
) {
  await firestore.runTransaction(async (transaction) => {
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
    const survivorReference = firestore.doc(`users/${survivorId}`);
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

async function deleteRelationshipsAndRepairCounts(userId: string) {
  const [incoming, outgoing] = await Promise.all([
    firestore.collection(`followRelationships/${userId}/followers`).get(),
    firestore.collectionGroup('followers').where('followerId', '==', userId).get(),
  ]);
  const relationships = new Map<string, FirebaseFirestore.DocumentReference>();
  for (const document of [...incoming.docs, ...outgoing.docs]) {
    relationships.set(document.ref.path, document.ref);
  }
  for (const reference of relationships.values()) {
    await deleteRelationshipAndRepairSurvivorCount(reference, userId);
  }
}

export const firebaseAccountIdentityVerifier: AccountIdentityVerifier = {
  async verify(idToken) {
    const decoded = await auth.verifyIdToken(idToken, true);
    return {
      userId: decoded.uid,
      authenticatedAt: new Date(decoded.auth_time * 1000),
    };
  },
};

export const firebaseAccountDataDeleter: AccountDataDeleter = {
  async deleteAll(userId) {
    const profileReference = firestore.doc(`users/${userId}`);
    const profile = await profileReference.get();
    const handleNormalized = profile.data()?.handleNormalized;

    await deleteQuery(
      firestore.collection('reviews').where('userId', '==', userId)
    );
    await deleteRelationshipsAndRepairCounts(userId);

    const writer = firestore.bulkWriter();
    writer.delete(profileReference);
    writer.delete(firestore.doc(`userSettings/${userId}`));
    if (typeof handleNormalized === 'string' && handleNormalized) {
      const handleReference = firestore.doc(`handles/${handleNormalized}`);
      const handle = await handleReference.get();
      if (handle.data()?.userId === userId) {
        writer.delete(handleReference);
      }
    }
    await writer.close();

    await bucket.deleteFiles({ prefix: `users/${userId}/`, force: true });

    // Authentication is deliberately last so a partial cleanup can be retried.
    await auth.deleteUser(userId);
  },
};
