import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyCELo3jcYSgFO0x2QBQ6kCVX_cb7c2U7T0",
  authDomain: "reelrater-753a6.firebaseapp.com",
  projectId: "reelrater-753a6",
  storageBucket: "reelrater-753a6.firebasestorage.app",
  messagingSenderId: "1077113261356",
  appId: "1:1077113261356:web:bbffc7513afa43ad487089"
};

const app = initializeApp( firebaseConfig );
export const db = getFirestore( app );
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});
export const storage = getStorage( app );
export default app;