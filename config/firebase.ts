import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { initializeAuth, type Persistence } from 'firebase/auth';
import * as firebaseAuth from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyCELo3jcYSgFO0x2QBQ6kCVX_cb7c2U7T0",
  authDomain: "reelrater-753a6.firebaseapp.com",
  projectId: "reelrater-753a6",
  storageBucket: "reelrater-753a6.firebasestorage.app",
  messagingSenderId: "1077113261356",
  appId: "1:1077113261356:web:bbffc7513afa43ad487089"
};

// getReactNativePersistence ships in Firebase's React Native build but isn't in the
// default (web) type definitions, so reach it through the namespace import.
const getReactNativePersistence = (
  firebaseAuth as unknown as {
    getReactNativePersistence: (storage: typeof AsyncStorage) => Persistence;
  }
).getReactNativePersistence;

const app = initializeApp( firebaseConfig );
export const db = getFirestore( app );
export const auth = initializeAuth( app, {
  persistence: getReactNativePersistence( AsyncStorage ),
});
export const storage = getStorage( app );
export default app;
