/**
 * Creating a household's first documents.
 *
 * Separated from the sign-up screen because these two things can and do come
 * apart: Firebase creates the auth account first, and if a Firestore write then
 * fails - rules not deployed, rules deployed to a different project, no
 * database created yet - you end up signed in with no household. Keeping this
 * callable on its own means that state is recoverable instead of terminal.
 */

import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getDb } from '../firebase/client';
import { paths } from './paths';
import { DEFAULT_SETTINGS } from '../domain/types';

/** Short, typeable, and not guessable from a name. Kids type this once. */
export function newHouseholdCode(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  for (const byte of bytes) out += alphabet[byte % alphabet.length];
  return out;
}

export interface ProvisionInput {
  uid: string;
  email: string;
  familyName: string;
  displayName: string;
  /** Reuse an existing code when repairing a half-finished setup. */
  householdId?: string;
}

/**
 * Write the member, index, household and settings documents, in that order.
 *
 * Order is load-bearing. The household's write rule asks whether you are a
 * parent of it, which reads the member document, so the member has to land
 * first. The member rule in turn has a bootstrap clause that only opens while
 * the household document does not exist - writing the household closes it.
 */
export async function provisionHousehold(input: ProvisionInput): Promise<string> {
  const { uid, email, familyName, displayName } = input;
  const hid = input.householdId ?? newHouseholdCode();
  const db = getDb();

  await setDoc(paths.member(db, hid, uid), {
    householdId: hid,
    displayName: displayName.trim() || 'Parent',
    role: 'parent',
    loginEmail: email.trim(),
    avatarColor: '#6d8cff',
    isPrimaryCaregiver: false,
    createdAt: serverTimestamp(),
  });
  await setDoc(doc(db, 'userIndex', uid), { householdId: hid });
  await setDoc(paths.household(db, hid), {
    name: familyName.trim() || 'Our family',
    createdAt: serverTimestamp(),
    createdBy: uid,
  });
  await setDoc(paths.settings(db, hid), { ...DEFAULT_SETTINGS });

  return hid;
}

/**
 * Turn a Firestore failure during setup into something that names the actual
 * cause. These three account for essentially every failed first run, and the
 * raw SDK message ("Missing or insufficient permissions") does not tell anyone
 * which of them they are looking at.
 */
export function explainProvisionError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  const message = err instanceof Error ? err.message : String(err);

  if (code === 'permission-denied' || /insufficient permissions/i.test(message)) {
    return (
      'Firestore refused the write. Almost always one of three things: the ' +
      'security rules were never deployed, they were deployed to a different ' +
      'Firebase project than this app points at, or the Firestore database was ' +
      'never created. Check that `firebase use` names the same project as ' +
      'VITE_FIREBASE_PROJECT_ID in .env.local, then run: ' +
      'firebase deploy --only firestore:rules,firestore:indexes'
    );
  }
  if (code === 'unavailable' || /offline|network/i.test(message)) {
    return 'Could not reach Firestore. Check the connection and try again.';
  }
  if (code === 'not-found' || /does not exist/i.test(message)) {
    return (
      'That Firebase project has no Firestore database yet. In the console, go ' +
      'to Build, then Firestore Database, and create one in production mode.'
    );
  }
  return message || 'Could not finish setting up the household.';
}
