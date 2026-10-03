import { useState } from 'react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useAuth } from '../../state/AuthContext';
import { useHousehold } from '../../state/HouseholdContext';
import { getDb, syntheticEmail } from '../../firebase/client';
import { createMemberAccount } from '../../firebase/provisioning';
import { paths } from '../../data/paths';
import { Avatar, Card, ErrorNote, Pill } from '../../components/ui';

const COLORS = ['#6d8cff', '#3ddc97', '#ffb454', '#ff6b6b', '#c084fc', '#22d3ee'];

/**
 * Adding family members.
 *
 * Kids get a synthetic sign-in address and a 6-digit PIN. Firebase requires a
 * password of at least six characters, which is why the PIN is six digits rather
 * than the four a kid would prefer.
 */
export default function ManageMembers() {
  const { householdId, member } = useAuth();
  const { members } = useHousehold();

  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<'child' | 'parent'>('child');
  const [pin, setPin] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!householdId || !member) return;

    const name = displayName.trim();
    if (!name) return;

    if (role === 'child' && !/^\d{6}$/.test(pin)) {
      setError('A kid PIN has to be exactly 6 digits — Firebase will not accept fewer.');
      return;
    }
    if (role === 'parent' && (!email.trim() || pin.length < 6)) {
      setError('A parent needs an email and a password of at least 6 characters.');
      return;
    }

    const loginEmail = role === 'child' ? syntheticEmail(householdId, name) : email.trim();

    setBusy(true);
    setError(null);
    try {
      const uid = await createMemberAccount({ email: loginEmail, password: pin });
      const db = getDb();

      await setDoc(paths.member(db, householdId, uid), {
        householdId,
        displayName: name,
        role,
        loginEmail,
        avatarColor: COLORS[members.length % COLORS.length],
        createdAt: serverTimestamp(),
      });
      await setDoc(doc(db, 'userIndex', uid), { householdId });

      setDone(
        role === 'child'
          ? `${name} can sign in with their name, that PIN, and the family code ${householdId}.`
          : `${name} can sign in with ${loginEmail}.`,
      );
      setDisplayName('');
      setPin('');
      setEmail('');
    } catch (err) {
      const code = (err as { code?: string })?.code ?? '';
      setError(
        code === 'auth/email-already-in-use'
          ? 'Somebody with that name already has an account in this household.'
          : code === 'auth/weak-password'
            ? 'That PIN or password is too short. Six characters minimum.'
            : err instanceof Error
              ? err.message
              : 'Could not create that member.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <ErrorNote message={error} />
      {done && (
        <Card variant="banner">
          {done}{' '}
          <button className="ghost" onClick={() => setDone(null)}>
            OK
          </button>
        </Card>
      )}

      <h2>Family</h2>
      <div className="stack">
        {members.map((m) => (
          <div className="card tight" key={m.id}>
            <div className="row">
              <Avatar member={m} />
              <div className="grow">
                <h3>{m.displayName}</h3>
                <div className="row wrap">
                  <Pill tone={m.role === 'parent' ? 'good' : undefined}>{m.role}</Pill>
                  {m.id === member?.id && <Pill>you</Pill>}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <h2>Add someone</h2>
      <Card>
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="mname">Name (this is what a kid types to sign in)</label>
            <input
              id="mname"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="mrole">Role</label>
            <select
              id="mrole"
              value={role}
              onChange={(e) => setRole(e.target.value as 'child' | 'parent')}
            >
              <option value="child">Child</option>
              <option value="parent">Parent</option>
            </select>
          </div>
          {role === 'parent' && (
            <div className="field">
              <label htmlFor="memail">Email</label>
              <input
                id="memail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          )}
          <div className="field">
            <label htmlFor="mpin">
              {role === 'child' ? 'Six digit PIN' : 'Password (6+ characters)'}
            </label>
            <input
              id="mpin"
              type={role === 'child' ? 'text' : 'password'}
              inputMode={role === 'child' ? 'numeric' : undefined}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              required
            />
          </div>
          <button className="primary big" type="submit" disabled={busy}>
            {busy ? 'Creating…' : 'Add member'}
          </button>
        </form>
      </Card>

      <Card tight>
        <p className="muted">
          Family code for this household: <strong>{householdId}</strong>. A kid types it once
          on their device and it is remembered after that.
        </p>
      </Card>
    </>
  );
}
