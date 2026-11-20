import { initializeApp, getApp, getApps, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, type Firestore } from 'firebase/firestore';
import { getAnalytics, isSupported, type Analytics } from 'firebase/analytics';

/**
 * Firebase Web Client Configuration for project 'agroai-dev'.
 * Values are populated via Vite environment variables (VITE_FIREBASE_*).
 */
export const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

/**
 * Indicates whether the minimal required client configuration is present.
 */
export const isFirebaseClientConfigured: boolean = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.appId
);

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

if (isFirebaseClientConfigured) {
  try {
    appInstance = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    authInstance = getAuth(appInstance);
    dbInstance = getFirestore(appInstance);

    if (import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
      const authHost = import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
      const firestoreHost = import.meta.env.VITE_FIREBASE_FIRESTORE_EMULATOR_HOST || '127.0.0.1:8085';
      const [fHost, fPort] = firestoreHost.split(':');
      connectAuthEmulator(authInstance, `http://${authHost}`, { disableWarnings: true });
      connectFirestoreEmulator(dbInstance, fHost, Number(fPort));
      console.info(`Connected Firebase client to Emulators (Auth: ${authHost}, Firestore: ${firestoreHost})`);
    }
  } catch (err) {
    console.error('CRITICAL: Firebase client failed to initialize with provided config:', err);
  }
} else {
  console.info('Firebase client running in unconfigured mode (VITE_FIREBASE_API_KEY not set).');
}

/**
 * Shared singleton instances.
 */
export const app = appInstance;
export const auth = authInstance;
export const db = dbInstance;

/**
 * Reusable analytics promise that initializes only in supported browser environments.
 * Returns null safely in SSR, Node, Vitest, or unsupported environments.
 */
export const analyticsPromise: Promise<Analytics | null> = isSupported()
  .then((supported) => (supported && app ? getAnalytics(app) : null))
  .catch(() => null);

export const getFirebaseAuth = (): Auth | null => auth;
export const getFirestoreDb = (): Firestore | null => db;

/**
 * Retrieves the current Firebase ID token with optional online force-refresh.
 * Falls back to mock token only in Vite development mode.
 */
export const getCurrentIdToken = async (forceRefresh = false): Promise<string | null> => {
  if (auth?.currentUser) {
    try {
      return await auth.currentUser.getIdToken(forceRefresh);
    } catch (error) {
      console.error('Failed to get Firebase ID token:', error);
      return null;
    }
  }
  if (import.meta.env.DEV && typeof localStorage !== 'undefined') {
    return localStorage.getItem('agroai_mock_token');
  }
  return null;
};
