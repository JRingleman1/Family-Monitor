import { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { getAuthClient } from '../firebase/client';
import { explainProvisionError, provisionHousehold } from '../data/provision';
import { Card, ErrorNote } from '../components/ui';

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
      await provisionHousehold({
        uid: credential.user.uid,
        email: email.trim(),
        familyName,
        displayName,
      });
    } catch (err) {
      const code = (err as { code?: string })?.code ?? '';
      setError(
        code === 'auth/email-already-in-use'
          ? 'That email already has an account. Sign in instead.'
          : explainProvisionError(err),
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
