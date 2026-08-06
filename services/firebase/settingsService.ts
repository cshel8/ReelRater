import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import type { SettingsService } from '@/services/contracts';
import {
  DEFAULT_COMMUNITY_PREFERENCES,
  type CommunityDefaultSort,
  type CommunityMediaFilter,
  type ReviewVisibility,
} from '@/types/domain';

function isReviewVisibility(value: unknown): value is ReviewVisibility {
  return value === 'public' || value === 'followers' || value === 'private';
}

function isCommunityMediaFilter(value: unknown): value is CommunityMediaFilter {
  return value === 'all' || value === 'movie' || value === 'tv';
}

function isCommunityDefaultSort(value: unknown): value is CommunityDefaultSort {
  return (
    value === 'newest' ||
    value === 'oldest' ||
    value === 'highestRated' ||
    value === 'lowestRated'
  );
}

export const firebaseSettingsService: SettingsService = {
  async get(userId) {
    const [settingsSnapshot, profileSnapshot] = await Promise.all([
      getDoc(doc(db, 'userSettings', userId)),
      getDoc(doc(db, 'users', userId)),
    ]);
    if (!settingsSnapshot.exists() && !profileSnapshot.exists()) {
      return null;
    }

    const visibility = settingsSnapshot.exists()
      ? settingsSnapshot.data().defaultReviewVisibility
      : null;
    const defaultMediaFilter = settingsSnapshot.exists()
      ? settingsSnapshot.data().defaultMediaFilter
      : null;
    const defaultSort = settingsSnapshot.exists()
      ? settingsSnapshot.data().defaultSort
      : null;
    return {
      accountPrivacy:
        profileSnapshot.exists() &&
        profileSnapshot.data().accountPrivacy === 'private'
          ? 'private'
          : 'public',
      defaultReviewVisibility: isReviewVisibility(visibility)
        ? visibility
        : 'private',
      defaultMediaFilter: isCommunityMediaFilter(defaultMediaFilter)
        ? defaultMediaFilter
        : DEFAULT_COMMUNITY_PREFERENCES.defaultMediaFilter,
      defaultSort: isCommunityDefaultSort(defaultSort)
        ? defaultSort
        : DEFAULT_COMMUNITY_PREFERENCES.defaultSort,
    };
  },

  async initializeForNewUser(userId, defaultReviewVisibility) {
    const settingsReference = doc(db, 'userSettings', userId);
    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(settingsReference);
      const existing = snapshot.exists() ? snapshot.data() : {};
      const initialValues = {
        defaultReviewVisibility: isReviewVisibility(
          existing.defaultReviewVisibility
        )
          ? existing.defaultReviewVisibility
          : defaultReviewVisibility,
        defaultMediaFilter: isCommunityMediaFilter(existing.defaultMediaFilter)
          ? existing.defaultMediaFilter
          : DEFAULT_COMMUNITY_PREFERENCES.defaultMediaFilter,
        defaultSort: isCommunityDefaultSort(existing.defaultSort)
          ? existing.defaultSort
          : DEFAULT_COMMUNITY_PREFERENCES.defaultSort,
        updatedAt: serverTimestamp(),
      };

      transaction.set(settingsReference, initialValues, { merge: true });
    });
  },

  async setDefaultReviewVisibility(userId, visibility) {
    await setDoc(
      doc(db, 'userSettings', userId),
      {
        defaultReviewVisibility: visibility,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  },

  async setPrivacyPreferences(userId, preferences) {
    const batch = writeBatch(db);
    batch.update(doc(db, 'users', userId), {
      accountPrivacy: preferences.accountPrivacy,
    });
    batch.set(
      doc(db, 'userSettings', userId),
      {
        defaultReviewVisibility: preferences.defaultReviewVisibility,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    await batch.commit();
  },

  async setCommunityDefaults(userId, preferences) {
    await setDoc(
      doc(db, 'userSettings', userId),
      {
        defaultMediaFilter: preferences.defaultMediaFilter,
        defaultSort: preferences.defaultSort,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  },
};
