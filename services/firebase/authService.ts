import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { auth } from '@/config/firebase';
import type { AuthService } from '@/services/contracts';

export const firebaseAuthService: AuthService = {
  async signUp(email, password) {
    const credential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    return { id: credential.user.uid };
  },

  async signIn(email, password) {
    const credential = await signInWithEmailAndPassword(
      auth,
      email,
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

  observeAuthState(callback) {
    return onAuthStateChanged(auth, (user) => {
      callback(user ? { id: user.uid } : null);
    });
  },
};
