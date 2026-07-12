import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '@/config/firebase';
import type { ProfileService } from '@/services/contracts';

export const firebaseProfileService: ProfileService = {
  async create(userId, username) {
    await setDoc(doc(db, 'users', userId), {
      username,
      profileImage: null,
      createdAt: serverTimestamp(),
    });

    return { id: userId, username, profileImage: null };
  },

  async get(userId) {
    const snapshot = await getDoc(doc(db, 'users', userId));
    if (!snapshot.exists()) return null;

    const data = snapshot.data();
    return {
      id: snapshot.id,
      username: data.username,
      profileImage: data.profileImage ?? null,
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
