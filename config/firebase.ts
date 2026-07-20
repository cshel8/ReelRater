import { getApp, getApps, initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import {
  getAuth,
  initializeAuth,
  type Persistence,
} from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: "AIzaSyCELo3jcYSgFO0x2QBQ6kCVX_cb7c2U7T0",
  authDomain: "reelrater-753a6.firebaseapp.com",
  projectId: "reelrater-753a6",
  storageBucket: "reelrater-753a6.firebasestorage.app",
  messagingSenderId: "1077113261356",
  appId: "1:1077113261356:web:bbffc7513afa43ad487089"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

function initializeFirebaseAuth() {
  if (Platform.OS === 'web') {
    return getAuth(app);
  }

  try {
    const { getReactNativePersistence } = require('firebase/auth') as {
      getReactNativePersistence: (
        storage: typeof AsyncStorage
      ) => Persistence;
    };
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (error: any) {
    if (error.code === 'auth/already-initialized') {
      return getAuth(app);
    }
    throw error;
  }
}

export const db = getFirestore( app );
export const auth = initializeFirebaseAuth();
export const storage = getStorage( app );
export default app;
