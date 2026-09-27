/**
 * Creating a family member's sign-in account.
 *
 * `createUserWithEmailAndPassword` signs you in as the account it just made,
 * which would kick the parent out of their own session mid-setup. So member
 * accounts are created on a second, throwaway Firebase app instance and that
 * instance is signed out immediately. The parent's session is untouched.
 */

import { deleteApp, getApp, initializeApp } from 'firebase/app';
import { createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth';

const SECONDARY = 'member-provisioning';

function secondaryConfig() {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };
}

/** Returns the new account's uid. Leaves the caller's session alone. */
export async function createMemberAccount(params: {
  email: string;
  password: string;
}): Promise<string> {
  const { email, password } = params;

  let app;
  try {
    app = getApp(SECONDARY);
  } catch {
    app = initializeApp(secondaryConfig(), SECONDARY);
  }

  const auth = getAuth(app);
  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await signOut(auth);
    return credential.user.uid;
  } finally {
    await deleteApp(app).catch(() => {
      // Nothing useful to do if teardown fails; the parent session is safe
      // either way and the next call re-initialises.
    });
  }
}
