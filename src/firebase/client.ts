/**
 * Firebase initialisation.
 *
 * Reads config from Vite env vars. If they are missing we fail loudly at
 * startup with instructions rather than throwing a cryptic Firebase error
 * three screens later.
 */

import { initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';

const REQUIRED = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

export interface ConfigProblem {
  missing: string[];
}

export function configProblem(): ConfigProblem | null {
  const missing = REQUIRED.filter((key) => !import.meta.env[key]);
  return missing.length > 0 ? { missing } : null;
}

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

function ensureApp(): FirebaseApp {
  if (app) return app;

  const problem = configProblem();
  if (problem) {
    throw new Error(
      `Firebase is not configured. Missing: ${problem.missing.join(', ')}. ` +
        'Copy .env.example to .env.local and fill in the values from your ' +
        'Firebase project settings.',
    );
  }

  app = initializeApp({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  });
  return app;
}

const useEmulators = import.meta.env.VITE_USE_EMULATORS === 'true';

export function getAuthClient(): Auth {
  if (!authInstance) {
    authInstance = getAuth(ensureApp());
    if (useEmulators) {
      connectAuthEmulator(authInstance, 'http://127.0.0.1:9099', { disableWarnings: true });
    }
  }
  return authInstance;
}

export function getDb(): Firestore {
  if (!dbInstance) {
    dbInstance = getFirestore(ensureApp());
    if (useEmulators) {
      connectFirestoreEmulator(dbInstance, '127.0.0.1', 8080);
    }
  }
  return dbInstance;
}

/**
 * Kids do not have email accounts, and a Family Link managed Google account
 * cannot reliably consent to third-party sign-in anyway. So every member gets
 * a synthetic address derived from the household id and a slug of their name,
 * and kids sign in with a 6-digit PIN as the password.
 */
export function syntheticEmail(householdId: string, displayName: string): string {
  const slug = displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug}.${householdId}@family-monitor.invalid`;
}
