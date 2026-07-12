import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { auth } from '@/config/firebase';
import type { AuthService } from '@/services/contracts';

export const firebaseAuthService: AuthService = {
  async signUp(username, password) {
    const credential = await createUserWithEmailAndPassword(
      auth,
      `${username}@example.com`,
      password
    );

    return { id: credential.user.uid };
  },

  async signIn(username, password) {
    const credential = await signInWithEmailAndPassword(
      auth,
      `${username}@example.com`,
      password
    );

    return { id: credential.user.uid };
  },

  async signOut() {
    await signOut(auth);
  },

  async getAccessToken() {
    return auth.currentUser ? auth.currentUser.getIdToken() : null;
  },
};
