import {
  collection,
  doc,
  endAt,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  startAt,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import type { UserDirectoryService } from '@/services/contracts';
import type { PublicUserProfile } from '@/types/domain';

interface UserProfileData {
  displayName?: unknown;
  handle?: unknown;
  handleNormalized?: unknown;
  profileImage?: unknown;
  accountPrivacy?: unknown;
}

function toPublicProfile(
  id: string,
  data: UserProfileData
): PublicUserProfile | null {
  if (
    typeof data.displayName !== 'string' ||
    typeof data.handle !== 'string' ||
    typeof data.handleNormalized !== 'string'
  ) {
    return null;
  }

  return {
    id,
    displayName: data.displayName,
    handle: data.handle,
    handleNormalized: data.handleNormalized,
    profileImage:
      typeof data.profileImage === 'string' ? data.profileImage : null,
    accountPrivacy: data.accountPrivacy === 'private' ? 'private' : 'public',
  };
}

function normalizeSearchTerm(value: string): string {
  return value.trim().replace(/^@/, '').toLowerCase();
}

export const firebaseUserDirectoryService: UserDirectoryService = {
  async getById(userId) {
    const snapshot = await getDoc(doc(db, 'users', userId));
    if (!snapshot.exists()) {
      return null;
    }

    return toPublicProfile(snapshot.id, snapshot.data());
  },

  async searchByHandle(searchTerm, excludeUserId, maximumResults = 20) {
    const normalizedSearchTerm = normalizeSearchTerm(searchTerm);
    if (!normalizedSearchTerm) {
      return [];
    }

    const resultLimit = Math.min(50, Math.max(1, maximumResults));
    const usersQuery = query(
      collection(db, 'users'),
      orderBy('handleNormalized'),
      startAt(normalizedSearchTerm),
      endAt(`${normalizedSearchTerm}\uf8ff`),
      limit(resultLimit + (excludeUserId ? 1 : 0))
    );
    const snapshot = await getDocs(usersQuery);

    return snapshot.docs
      .map((profileDocument) =>
        toPublicProfile(profileDocument.id, profileDocument.data())
      )
      .filter(
        (profile): profile is PublicUserProfile =>
          profile !== null && profile.id !== excludeUserId
      )
      .slice(0, resultLimit);
  },
};
