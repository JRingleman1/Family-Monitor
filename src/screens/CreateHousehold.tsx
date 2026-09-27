import { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getAuthClient, getDb } from '../firebase/client';
import { paths } from '../data/paths';
import { DEFAULT_SETTINGS } from '../domain/types';
import { Card, ErrorNote } from '../components/ui';

/** Short, typeable, and not guessable from a name. Kids type this once. */
function householdCode(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  for (const byte of bytes) out += alphabet[byte % alphabet.length];
  return out;
}

/**
 * First run. Creates the household, the first parent, and the default settings
 * in one go, then signs that parent in.
 */
export default function CreateHousehold({ onBack }: { onBack: () => void }) {
  const [familyName, setFamilyName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const credential = await createUserWithEmailAndPassword(
        getAuthClient(),
        email.trim(),
        password,
      );
      const uid = credential.user.uid;
      const hid = householdCode();
      const db = getDb();

      // The member document has to land before the household document, because
      // the household's own write rule asks whether you are a parent of it.
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
    } catch (err) {
      const code = (err as { code?: string })?.code ?? '';
      setError(
        code === 'auth/email-already-in-use'
          ? 'That email already has an account. Sign in instead.'
          : err instanceof Error
            ? err.message
            : 'Could not create the household.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <h1>Set up your family</h1>
      <p className="muted">
        This creates the household and your parent account. You add the kids next.
      </p>

      <ErrorNote message={error} />

      <Card>
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="family">Family name</label>
            <input
              id="family"
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
              placeholder="The Ringlemans"
            />
          </div>
          <div className="field">
            <label htmlFor="pname">Your name</label>
            <input
              id="pname"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="pemail">Your email</label>
            <input
              id="pemail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="ppass">Password (6+ characters)</label>
            <input
              id="ppass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button className="primary big" type="submit" disabled={busy}>
            {busy ? 'Creating…' : 'Create household'}
          </button>
        </form>
      </Card>

      <button className="ghost" onClick={onBack}>
        I already have an account
      </button>
    </div>
  );
}
