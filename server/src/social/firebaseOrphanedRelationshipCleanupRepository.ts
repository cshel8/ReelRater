import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { FieldPath, getFirestore } from 'firebase-admin/firestore';
import type {
  OrphanedRelationshipCleanupRepository,
  OrphanedRelationship,
  ProfileExistence,
  SocialRelationshipRecord,
} from './orphanedRelationshipCleanup.js';

const projectId = process.env.FIREBASE_PROJECT_ID ?? 'reelrater-753a6';
const app =
  getApps()[0] ?? initializeApp({ credential: applicationDefault(), projectId });
const firestore = getFirestore(app);

const relationshipFromSnapshot = (
  snapshot: FirebaseFirestore.QueryDocumentSnapshot
): SocialRelationshipRecord | null => {
  const pathSegments = snapshot.ref.path.split('/');
  const data = snapshot.data();
  if (
    pathSegments.length !== 4 ||
    pathSegments[0] !== 'followRelationships' ||
    pathSegments[2] !== 'followers' ||
    typeof data.followerId !== 'string' ||
    typeof data.followedUserId !== 'string'
  ) {
    return null;
  }
  return {
    path: snapshot.ref.path,
    followerId: data.followerId,
    followedUserId: data.followedUserId,
    status: data.status,
  };
};

const checkProfiles = async (
  followerId: string,
  followedUserId: string
): Promise<ProfileExistence> => {
  const [follower, followed] = await firestore.getAll(
    firestore.doc(`users/${followerId}`),
    firestore.doc(`users/${followedUserId}`)
  );
  return {
    followerProfileExists: follower.exists,
    followedProfileExists: followed.exists,
  };
};

/** Firebase Admin adapter for the administrator-only orphan cleanup command. */
export const firebaseOrphanedRelationshipCleanupRepository: OrphanedRelationshipCleanupRepository = {
  async listRelationships({ cursor, maximumResults }) {
    let request = firestore
      .collectionGroup('followers')
      .orderBy(FieldPath.documentId())
      .limit(maximumResults);
    if (cursor) request = request.startAfter(cursor);
    const snapshot = await request.get();
    return {
      records: snapshot.docs.flatMap((document) => {
        const relationship = relationshipFromSnapshot(document);
        return relationship ? [relationship] : [];
      }),
      nextCursor:
        snapshot.size === maximumResults
          ? snapshot.docs.at(-1)?.ref.path ?? null
          : null,
    };
  },

  async checkProfiles({ followerId, followedUserId }) {
    return checkProfiles(followerId, followedUserId);
  },

  async deleteIfStillOrphaned(path) {
    const reference = firestore.doc(path);
    return firestore.runTransaction(async (transaction) => {
      const relationshipSnapshot = await transaction.get(reference);
      if (!relationshipSnapshot.exists) return { action: 'missing' as const };

      const relationship = relationshipFromSnapshot(
        relationshipSnapshot as FirebaseFirestore.QueryDocumentSnapshot
      );
      if (!relationship) {
        return { action: 'retained' as const, relationship: {
          path,
          followerId: '',
          followedUserId: '',
          status: 'invalid',
        } };
      }

      const followerReference = firestore.doc(`users/${relationship.followerId}`);
      const followedReference = firestore.doc(`users/${relationship.followedUserId}`);
      const [follower, followed] = await Promise.all([
        transaction.get(followerReference),
        transaction.get(followedReference),
      ]);
      const orphan: OrphanedRelationship = {
        ...relationship,
        followerProfileExists: follower.exists,
        followedProfileExists: followed.exists,
      };
      if (follower.exists && followed.exists) {
        return { action: 'retained' as const, relationship };
      }

      transaction.delete(reference);
      return { action: 'deleted' as const, relationship: orphan };
    });
  },
};
