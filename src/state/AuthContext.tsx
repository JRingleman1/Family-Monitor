/**
 * Sign-in and identity.
 *
 * Parents sign in with an email and password. Kids sign in with their first
 * name and a 6-digit PIN against a synthetic address, because a Family Link
 * managed Google account cannot reliably consent to third-party sign-in and
 * because a 9-year-old should not be managing an email account to do chores.
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { getAuthClient, getDb, syntheticEmail } from '../firebase/client';
import { toMember } from '../data/mappers';
import { paths } from '../data/paths';
import type { Member } from '../domain/types';

export const HOUSEHOLD_CODE_KEY = 'family-monitor.householdCode';

interface AuthState {
  loading: boolean;
  user: User | null;
  member: Member | null;
  householdId: string | null;
  error: string | null;
  signInParent: (email: string, password: string) => Promise<void>;
  signInChild: (householdCode: string, name: string, pin: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/** Maps an auth uid to the household it belongs to. Written at member setup. */
async function readUserIndex(uid: string): Promise<{ householdId: string } | null> {
  const snap = await getDoc(doc(getDb(), 'userIndex', uid));
  if (!snap.exists()) return null;
  const householdId = snap.data().householdId;
  return typeof householdId === 'string' ? { householdId } : null;
}

function friendlyAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'That name and PIN do not match. Try again.';
    case 'auth/too-many-requests':
      return 'Too many tries. Wait a minute and try again.';
    case 'auth/network-request-failed':
      return 'No connection. Check the wifi and try again.';
    default:
      return err instanceof Error ? err.message : 'Could not sign in.';
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return onAuthStateChanged(getAuthClient(), async (next) => {
      setUser(next);
      if (!next) {
        setMember(null);
        setHouseholdId(null);
        setLoading(false);
        return;
      }

      try {
        const index = await readUserIndex(next.uid);
        if (!index) {
          setError(
            'That account is signed in but not attached to a household yet. ' +
              'A parent needs to finish adding them.',
          );
          setMember(null);
          setHouseholdId(null);
          return;
        }
        const snap = await getDoc(paths.member(getDb(), index.householdId, next.uid));
        setHouseholdId(index.householdId);
        setMember(snap.exists() ? toMember(snap.data(), snap.id) : null);
        setError(null);
      } catch (err) {
        setError(friendlyAuthError(err));
      } finally {
        setLoading(false);
      }
    });
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      loading,
      user,
      member,
      householdId,
      error,
      async signInParent(email, password) {
        setError(null);
        try {
          await signInWithEmailAndPassword(getAuthClient(), email.trim(), password);
        } catch (err) {
          setError(friendlyAuthError(err));
          throw err;
        }
      },
      async signInChild(householdCode, name, pin) {
        setError(null);
        const code = householdCode.trim();
        try {
          await signInWithEmailAndPassword(
            getAuthClient(),
            syntheticEmail(code, name.trim()),
            pin,
          );
          // Remember the code so this device never asks the kid for it again.
          localStorage.setItem(HOUSEHOLD_CODE_KEY, code);
        } catch (err) {
          setError(friendlyAuthError(err));
          throw err;
        }
      },
      async signOut() {
        await fbSignOut(getAuthClient());
      },
    }),
    [loading, user, member, householdId, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
