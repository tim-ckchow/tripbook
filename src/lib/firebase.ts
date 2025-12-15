// FIX: The Firebase imports and initialization logic were using the v9 modular syntax.
// This was causing errors because the installed Firebase version is likely v8.
// The file has been updated to use the v8 namespaced API syntax.
// FIX: Switched to v8 compat imports since Firebase v9+ is likely installed.
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/storage';

// ---------------------------------------------------------
// FIREBASE CONFIGURATION
// Values loaded from .env.local
// ---------------------------------------------------------
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// Initialize Firestore
// FIX: Switched to v8 syntax for Firestore initialization.
const db = firebase.firestore();
// In v8, settings are applied after getting the instance.
db.settings({
    cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED
});




// Enable Offline Persistence
// This should be done after emulator connection if applicable.
// FIX: Switched to v8 syntax for enabling persistence.
db.enablePersistence().catch((err) => {
  if (err.code == 'failed-precondition') {
    // Multiple tabs open, persistence can only be enabled in one tab at a a time.
    console.warn('Firebase persistence failed: Multiple tabs open.');
  } else if (err.code == 'unimplemented') {
    // The current browser does not support all of the features required to enable persistence
    console.warn('Firebase persistence not supported in this browser.');
  }
});

// FIX: Switched to v8 syntax for getting storage instance.
const storage = firebase.storage();

// FIX: Exporting `firebase` object for v8 specific features like FieldValue.
export { app, auth, db, storage, firebase };