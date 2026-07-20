import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import type { SettingsService } from '@/services/contracts';
import type { ReviewVisibility } from '@/types/domain';

function isReviewVisibility(value: unknown): value is ReviewVisibility {
  return value === 'public' || value === 'followers' || value === 'private';
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
    return {
      accountPrivacy:
        profileSnapshot.exists() &&
        profileSnapshot.data().accountPrivacy === 'private'
          ? 'private'
          : 'public',
      defaultReviewVisibility: isReviewVisibility(visibility)
        ? visibility
        : 'private',
    };
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
};
