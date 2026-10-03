import { useState } from 'react';
import { useAuth } from '../state/AuthContext';
import { explainProvisionError, provisionHousehold } from '../data/provision';
import { Card, ErrorNote } from '../components/ui';

/**
 * Recovery for an account that exists but has no household.
 *
 * Firebase creates the auth account before any Firestore write happens, so a
 * failure in between leaves you signed in and stranded. Previously that was a
 * dead end with no way back and no visible reason. This finishes the job using
 * the account already signed in, and says plainly what went wrong if it fails
 * again.
 */
export default function FinishSetup() {
  const { user, signOut } = useAuth();
  const [familyName, setFamilyName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;

    setBusy(true);
    setError(null);
    try {
      await provisionHousehold({
        uid: user.uid,
        email: user.email ?? '',
        familyName,
        displayName,
      });
      // AuthContext picks the new member document up on its next read; a reload
      // is the simplest way to trigger that without threading state around.
      window.location.reload();
    } catch (err) {
      setError(explainProvisionError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <h1>Finish setting up</h1>
      <p className="muted">
        You're signed in as {user?.email}, but your account has no family attached yet.
        That happens when the account gets created and the first save then fails.
        Nothing is broken and nothing is lost — fill this in and it will finish the job.
      </p>

      <ErrorNote message={error} />

      <Card>
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="ffamily">Family name</label>
            <input
              id="ffamily"
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
              placeholder="The Ringlemans"
            />
          </div>
          <div className="field">
            <label htmlFor="fname">Your name</label>
            <input
              id="fname"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          </div>
          <button className="primary big" type="submit" disabled={busy}>
            {busy ? 'Finishing…' : 'Finish setup'}
          </button>
        </form>
      </Card>

      <button className="ghost" onClick={() => void signOut()}>
        Sign out
      </button>
    </div>
  );
}
