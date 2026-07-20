import { doc, getDoc, runTransaction, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '@/config/firebase';
import type { ProfileService } from '@/services/contracts';
import type { AccountPrivacy } from '@/types/domain';

function readAccountPrivacy(value: unknown): AccountPrivacy {
  return value === 'private' ? 'private' : 'public';
}

export const firebaseProfileService: ProfileService = {
  async create(userId, input) {
    const handleReference = doc(db, 'handles', input.handleNormalized);
    const profileReference = doc(db, 'users', userId);

    return runTransaction(db, async (transaction) => {
      const existingHandle = await transaction.get(handleReference);
      const existingProfile = await transaction.get(profileReference);

      if (
        existingProfile.exists()
        && existingProfile.data().handleNormalized
      ) {
        const data = existingProfile.data();
        if (!data.accountPrivacy) {
          transaction.update(profileReference, {
            accountPrivacy: input.accountPrivacy,
          });
        }
        return {
          id: userId,
          displayName: data.displayName ?? data.username ?? '',
          handle: data.handle ?? '',
          handleNormalized: data.handleNormalized,
          profileImage: data.profileImage ?? null,
          accountPrivacy: readAccountPrivacy(
            data.accountPrivacy ?? input.accountPrivacy
          ),
        };
      }

      if (
        existingHandle.exists()
        && existingHandle.data().userId !== userId
      ) {
        throw new Error('That handle is already taken.');
      }

      if (existingProfile.exists()) {
        const data = existingProfile.data();
        if (!existingHandle.exists()) {
          transaction.set(handleReference, {
            userId,
            handle: input.handle,
            handleNormalized: input.handleNormalized,
          });
        }
        transaction.update(profileReference, input);

        return {
          id: userId,
          ...input,
          profileImage: data.profileImage ?? null,
          accountPrivacy: input.accountPrivacy,
        };
      }

      if (!existingHandle.exists()) {
        transaction.set(handleReference, {
          userId,
          handle: input.handle,
          handleNormalized: input.handleNormalized,
        });
      }
      transaction.set(profileReference, {
        ...input,
        profileImage: null,
        createdAt: serverTimestamp(),
      });

      return { id: userId, ...input, profileImage: null };
    });
  },

  async get(userId) {
    const snapshot = await getDoc(doc(db, 'users', userId));
    if (!snapshot.exists()) return null;

    const data = snapshot.data();
    return {
      id: snapshot.id,
      displayName: data.displayName ?? data.username ?? '',
      handle: data.handle ?? '',
      handleNormalized: data.handleNormalized ?? '',
      profileImage: data.profileImage ?? null,
      accountPrivacy: readAccountPrivacy(data.accountPrivacy),
    };
  },

  async uploadImage(userId, localUri) {
    const response = await fetch(localUri);
    const blob = await response.blob();
    const imageRef = ref(storage, `users/${userId}/profileImage.jpg`);

    await uploadBytes(imageRef, blob);
    const downloadUrl = await getDownloadURL(imageRef);
    await updateDoc(doc(db, 'users', userId), { profileImage: downloadUrl });

    return downloadUrl;
  },
};
