import { useState } from 'react';
import { useAuth, HOUSEHOLD_CODE_KEY } from '../state/AuthContext';
import { Card, ErrorNote } from '../components/ui';

/**
 * Two doors. Kids get the simple one and it is the default, because they will
 * use it ten times as often as anyone else.
 */
export default function SignIn() {
  const { signInParent, signInChild, error } = useAuth();
  const [mode, setMode] = useState<'child' | 'parent'>('child');
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [code, setCode] = useState(() => localStorage.getItem(HOUSEHOLD_CODE_KEY) ?? '');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === 'child') await signInChild(code, name, pin);
      else await signInParent(email, password);
    } catch {
      // The provider already turned this into a readable message.
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <h1>Family Monitor</h1>
      <p className="muted">Earn screen time. Do good. See what happens.</p>

      <div className="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-current={mode === 'child'}
          onClick={() => setMode('child')}
        >
          I'm a kid
        </button>
        <button
          type="button"
          role="tab"
          aria-current={mode === 'parent'}
          onClick={() => setMode('parent')}
        >
          I'm a parent
        </button>
      </div>

      <ErrorNote message={error} />

      <Card>
        <form onSubmit={submit}>
          {mode === 'child' ? (
            <>
              <div className="field">
                <label htmlFor="name">Your name</label>
                <input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="pin">Your PIN</label>
                <input
                  id="pin"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  type="password"
                  inputMode="numeric"
                  autoComplete="current-password"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="code">Family code</label>
                <input
                  id="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Ask a parent once, then this device remembers"
                  required
                />
              </div>
            </>
          ) : (
            <>
              <div className="field">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  autoComplete="email"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </div>
            </>
          )}

          <button className="primary big" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </Card>
    </div>
  );
}
