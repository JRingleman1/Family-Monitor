import { useState } from 'react';
import { AuthProvider, useAuth } from './state/AuthContext';
import { HouseholdProvider } from './state/HouseholdContext';
import { configProblem } from './firebase/client';
import CreateHousehold from './screens/CreateHousehold';
import FinishSetup from './screens/FinishSetup';
import SignIn from './screens/SignIn';
import KidHome from './screens/kid/KidHome';
import ParentHome from './screens/parent/ParentHome';
import { Card } from './components/ui';

/** Fail loudly and usefully rather than throwing something cryptic at runtime. */
function NotConfigured({ missing }: { missing: string[] }) {
  return (
    <div className="app">
      <h1>Not configured yet</h1>
      <Card variant="error">
        <p>Firebase config is missing these values:</p>
        <ul>
          {missing.map((key) => (
            <li key={key}>
              <code>{key}</code>
            </li>
          ))}
        </ul>
        <p className="muted">
          Copy <code>.env.example</code> to <code>.env.local</code> and fill them in from your
          Firebase project settings, then restart the dev server. docs/SETUP.md walks through
          it.
        </p>
      </Card>
    </div>
  );
}

function Routes() {
  const { loading, user, member } = useAuth();
  const [creating, setCreating] = useState(false);

  if (loading) {
    return (
      <div className="app center">
        <p className="muted" style={{ marginTop: 64 }}>
          Loading…
        </p>
      </div>
    );
  }

  if (!user) {
    return creating ? (
      <CreateHousehold onBack={() => setCreating(false)} />
    ) : (
      <>
        <SignIn />
        <div className="app" style={{ paddingTop: 0 }}>
          <button className="ghost" onClick={() => setCreating(true)}>
            Set up a new family
          </button>
        </div>
      </>
    );
  }

  // Signed in but no member document. Either setup failed partway - the auth
  // account is created before any Firestore write, so a failure in between
  // strands you here - or a parent has not finished adding this account.
  // Either way it is recoverable, so offer the way out rather than a dead end.
  if (!member) return <FinishSetup />;

  return member.role === 'parent' ? <ParentHome /> : <KidHome />;
}

export default function App() {
  const problem = configProblem();
  if (problem) return <NotConfigured missing={problem.missing} />;

  return (
    <AuthProvider>
      <HouseholdProvider>
        <Routes />
      </HouseholdProvider>
    </AuthProvider>
  );
}
