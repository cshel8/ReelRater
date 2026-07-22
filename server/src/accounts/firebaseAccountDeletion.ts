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
    await firestore.recursiveDelete(
      firestore.doc(`followRelationships/${userId}`)
    );
    await deleteQuery(
      firestore.collectionGroup('followers').where('followerId', '==', userId)
    );

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
