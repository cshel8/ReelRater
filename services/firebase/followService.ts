import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import type { FollowService } from '@/services/contracts';
import type {
  FollowRelationship,
  FollowStatus,
} from '@/types/domain';

interface FollowRelationshipData {
  followerId?: unknown;
  followedUserId?: unknown;
  status?: unknown;
  createdAt?: unknown;
  acceptedAt?: unknown;
}

function relationshipReference(followerId: string, followedUserId: string) {
  return doc(
    db,
    'followRelationships',
    followedUserId,
    'followers',
    followerId
  );
}

function readTimestamp(value: unknown): string {
  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof value.toDate === 'function'
  ) {
    return value.toDate().toISOString();
  }

  if (typeof value === 'string') {
    return value;
  }

  return new Date(0).toISOString();
}

function readNullableTimestamp(value: unknown): string | null {
  return value == null ? null : readTimestamp(value);
}

function toRelationship(
  data: FollowRelationshipData
): FollowRelationship | null {
  if (
    typeof data.followerId !== 'string' ||
    typeof data.followedUserId !== 'string' ||
    (data.status !== 'active' && data.status !== 'pending')
  ) {
    return null;
  }

  return {
    followerId: data.followerId,
    followedUserId: data.followedUserId,
    status: data.status,
    createdAt: readTimestamp(data.createdAt),
    acceptedAt: readNullableTimestamp(data.acceptedAt),
  };
}

function sortNewestFirst(
  relationships: FollowRelationship[]
): FollowRelationship[] {
  return relationships.sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  );
}

function mapRelationships(
  documents: { data(): FollowRelationshipData }[],
  status: FollowStatus
): FollowRelationship[] {
  return sortNewestFirst(
    documents
      .map((relationshipDocument) =>
        toRelationship(relationshipDocument.data())
      )
      .filter(
        (relationship): relationship is FollowRelationship =>
          relationship !== null && relationship.status === status
      )
  );
}

export const firebaseFollowService: FollowService = {
  async follow(followerId, followedUserId) {
    if (followerId === followedUserId) {
      throw new Error('You cannot follow your own account.');
    }

    const reference = relationshipReference(followerId, followedUserId);

    await runTransaction(db, async (transaction) => {
      const existingRelationship = await transaction.get(reference);

      if (existingRelationship.exists()) {
        return;
      }

      const followedProfile = await transaction.get(
        doc(db, 'users', followedUserId)
      );
      if (!followedProfile.exists()) {
        throw new Error('This profile is no longer available.');
      }
      const pending = followedProfile.data().accountPrivacy === 'private';

      transaction.set(reference, {
        followerId,
        followedUserId,
        status: pending ? 'pending' : 'active',
        createdAt: serverTimestamp(),
        acceptedAt: pending ? null : serverTimestamp(),
      });
    });
  },

  async unfollow(followerId, followedUserId) {
    await deleteDoc(relationshipReference(followerId, followedUserId));
  },

  async removeFollower(followedUserId, followerId) {
    await deleteDoc(relationshipReference(followerId, followedUserId));
  },

  async approveFollower(followedUserId, followerId) {
    await updateDoc(relationshipReference(followerId, followedUserId), {
      status: 'active',
      acceptedAt: serverTimestamp(),
    });
  },

  async rejectFollower(followedUserId, followerId) {
    await deleteDoc(relationshipReference(followerId, followedUserId));
  },

  async listFollowers(userId) {
    const snapshot = await getDocs(
      collection(db, 'followRelationships', userId, 'followers')
    );

    return mapRelationships(snapshot.docs, 'active');
  },

  async listFollowing(userId) {
    const followingQuery = query(
      collectionGroup(db, 'followers'),
      where('followerId', '==', userId)
    );
    const snapshot = await getDocs(followingQuery);

    return mapRelationships(snapshot.docs, 'active');
  },

  async listPendingRequests(userId) {
    const snapshot = await getDocs(
      collection(db, 'followRelationships', userId, 'followers')
    );

    return mapRelationships(snapshot.docs, 'pending');
  },

  async isFollowing(followerId, followedUserId) {
    const snapshot = await getDoc(
      relationshipReference(followerId, followedUserId)
    );

    if (!snapshot.exists()) {
      return false;
    }

    return snapshot.data().status === 'active';
  },

  async getStatus(followerId, followedUserId) {
    const snapshot = await getDoc(
      relationshipReference(followerId, followedUserId)
    );
    if (!snapshot.exists()) {
      return null;
    }

    const status = snapshot.data().status;
    return status === 'active' || status === 'pending' ? status : null;
  },
};
