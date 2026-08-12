import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import {
  SocialGraphError,
  type SocialGraphService,
  type SocialMutationResult,
} from './types.js';

const projectId = process.env.FIREBASE_PROJECT_ID ?? 'reelrater-753a6';
const app =
  getApps()[0] ??
  initializeApp({ credential: applicationDefault(), projectId });
const firestore = getFirestore(app);

type RelationshipData = {
  followerId?: unknown;
  followedUserId?: unknown;
  status?: unknown;
};

const active = (relationship: RelationshipData | undefined) =>
  relationship?.status === 'active';

const count = (value: unknown) =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : 0;

const relationshipReference = (followerId: string, followedUserId: string) =>
  firestore.doc(
    `followRelationships/${followedUserId}/followers/${followerId}`
  );

async function requireProfile(
  transaction: FirebaseFirestore.Transaction,
  userId: string
) {
  const reference = firestore.doc(`users/${userId}`);
  const snapshot = await transaction.get(reference);
  if (!snapshot.exists) {
    throw new SocialGraphError('This profile is no longer available.', 404);
  }
  return { reference, data: snapshot.data() ?? {} };
}

function ensureCounters(
  transaction: FirebaseFirestore.Transaction,
  reference: FirebaseFirestore.DocumentReference,
  data: FirebaseFirestore.DocumentData
) {
  const followerCount = count(data.followerCount);
  const followingCount = count(data.followingCount);
  if (
    data.followerCount !== followerCount ||
    data.followingCount !== followingCount
  ) {
    transaction.set(
      reference,
      { followerCount, followingCount },
      { merge: true }
    );
  }
  return { followerCount, followingCount };
}

function result(status: SocialMutationResult['status']): SocialMutationResult {
  return { status };
}

async function deleteRelationship(
  actorId: string,
  followedUserId: string,
  followerId: string
) {
  return firestore.runTransaction(async (transaction) => {
    if (actorId !== followerId && actorId !== followedUserId) {
      throw new SocialGraphError('You cannot change this relationship.', 403);
    }

    const relationship = relationshipReference(followerId, followedUserId);
    const relationshipSnapshot = await transaction.get(relationship);
    if (!relationshipSnapshot.exists) {
      return result(null);
    }

    const relationshipData = relationshipSnapshot.data() as RelationshipData;
    const [follower, followed] = await Promise.all([
      requireProfile(transaction, followerId),
      requireProfile(transaction, followedUserId),
    ]);
    const followerCounts = ensureCounters(
      transaction,
      follower.reference,
      follower.data
    );
    const followedCounts = ensureCounters(
      transaction,
      followed.reference,
      followed.data
    );

    transaction.delete(relationship);
    if (active(relationshipData)) {
      transaction.update(follower.reference, {
        followingCount: Math.max(0, followerCounts.followingCount - 1),
      });
      transaction.update(followed.reference, {
        followerCount: Math.max(0, followedCounts.followerCount - 1),
      });
    }
    return result(null);
  });
}

export const firebaseSocialGraph: SocialGraphService = {
  async initializeCounters(userId) {
    await firestore.runTransaction(async (transaction) => {
      const profile = await requireProfile(transaction, userId);
      ensureCounters(transaction, profile.reference, profile.data);
    });
  },

  async follow(followerId, followedUserId) {
    if (!followedUserId || followerId === followedUserId) {
      throw new SocialGraphError('You cannot follow your own account.', 400);
    }

    return firestore.runTransaction(async (transaction) => {
      const relationship = relationshipReference(followerId, followedUserId);
      const [existing, follower, followed] = await Promise.all([
        transaction.get(relationship),
        requireProfile(transaction, followerId),
        requireProfile(transaction, followedUserId),
      ]);
      const followerCounts = ensureCounters(
        transaction,
        follower.reference,
        follower.data
      );
      const followedCounts = ensureCounters(
        transaction,
        followed.reference,
        followed.data
      );

      if (existing.exists) {
        const current = existing.data() as RelationshipData;
        if (current.status === 'pending' || current.status === 'active') {
          return result(current.status);
        }
        throw new SocialGraphError('This relationship is invalid.', 409);
      }

      const status = followed.data.accountPrivacy === 'private' ? 'pending' : 'active';
      transaction.set(relationship, {
        followerId,
        followedUserId,
        status,
        createdAt: new Date(),
        acceptedAt: status === 'active' ? new Date() : null,
      });
      if (status === 'active') {
        transaction.update(follower.reference, {
          followingCount: followerCounts.followingCount + 1,
        });
        transaction.update(followed.reference, {
          followerCount: followedCounts.followerCount + 1,
        });
      }
      return result(status);
    });
  },

  async unfollow(followerId, followedUserId) {
    return deleteRelationship(followerId, followedUserId, followerId);
  },

  async removeFollower(followedUserId, followerId) {
    return deleteRelationship(followedUserId, followedUserId, followerId);
  },

  async approveFollower(followedUserId, followerId) {
    return firestore.runTransaction(async (transaction) => {
      const relationship = relationshipReference(followerId, followedUserId);
      const [relationshipSnapshot, follower, followed] = await Promise.all([
        transaction.get(relationship),
        requireProfile(transaction, followerId),
        requireProfile(transaction, followedUserId),
      ]);
      if (!relationshipSnapshot.exists) {
        throw new SocialGraphError('This follow request no longer exists.', 404);
      }
      const current = relationshipSnapshot.data() as RelationshipData;
      if (current.status === 'active') {
        return result('active');
      }
      if (current.status !== 'pending') {
        throw new SocialGraphError('This follow request is invalid.', 409);
      }
      const followerCounts = ensureCounters(
        transaction,
        follower.reference,
        follower.data
      );
      const followedCounts = ensureCounters(
        transaction,
        followed.reference,
        followed.data
      );
      transaction.update(relationship, { status: 'active', acceptedAt: new Date() });
      transaction.update(follower.reference, {
        followingCount: followerCounts.followingCount + 1,
      });
      transaction.update(followed.reference, {
        followerCount: followedCounts.followerCount + 1,
      });
      return result('active');
    });
  },

  async rejectFollower(followedUserId, followerId) {
    return firestore.runTransaction(async (transaction) => {
      const relationship = relationshipReference(followerId, followedUserId);
      const snapshot = await transaction.get(relationship);
      if (!snapshot.exists) {
        return result(null);
      }
      if ((snapshot.data() as RelationshipData).status !== 'pending') {
        throw new SocialGraphError('Only pending requests can be declined.', 409);
      }
      transaction.delete(relationship);
      return result(null);
    });
  },
};
