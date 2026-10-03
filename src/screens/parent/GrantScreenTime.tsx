import { useState } from 'react';
import { useAuth } from '../../state/AuthContext';
import { useHousehold } from '../../state/HouseholdContext';
import { DomainError, cancelGrant, redeemPass, settleGrant } from '../../data/store';
import { Card, Empty, ErrorNote, Pill, formatMinutes, formatWhen } from '../../components/ui';
import { isPassUsable } from '../../domain/economy';

/**
 * The Family Link handoff.
 *
 * Google publishes no API for Family Link, so no app can add screen time to a
 * managed child account. Nothing here pretends otherwise. This screen exists to
 * make the human step short and unambiguous: it tells you the number, it gives
 * you the link, and the minutes leave the ledger only when you confirm you
 * actually added them on the device.
 *
 * Confirming without doing it is the one thing that breaks the whole system,
 * because the kid loses minutes they never received. Hence the wording on the
 * button.
 */
const FAMILY_LINK_WEB = 'https://families.google.com/families';

export default function GrantScreenTime() {
  const { member, householdId } = useAuth();
  const { grants, passes, memberName } = useHousehold();
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const requested = grants.filter((g) => g.status === 'requested');
  const recent = grants.filter((g) => g.status !== 'requested').slice(0, 8);
  const livePasses = passes.filter((p) => isPassUsable(p, Date.now()));

  async function onSettle(grantId: string) {
    if (!householdId || !member) return;
    const grant = grants.find((g) => g.id === grantId);
    if (!grant) return;

    setError(null);
    setBusyId(grantId);
    try {
      await settleGrant({ householdId, grant, settledBy: member.id });
    } catch (err) {
      setError(err instanceof DomainError ? err.message : 'Could not record that.');
    } finally {
      setBusyId(null);
    }
  }

  async function onCancel(grantId: string) {
    if (!householdId || !member) return;
    const reason = window.prompt('Why not? (the kid sees this)');
    if (reason === null) return;
    setBusyId(grantId);
    try {
      await cancelGrant({
        householdId,
        grantId,
        settledBy: member.id,
        reason: reason.trim() || 'Not right now.',
      });
    } catch {
      setError('Could not cancel that.');
    } finally {
      setBusyId(null);
    }
  }

  async function onRedeemPass(passId: string) {
    if (!householdId) return;
    const pass = passes.find((p) => p.id === passId);
    if (!pass) return;
    setBusyId(passId);
    try {
      await redeemPass({ householdId, pass });
    } catch (err) {
      setError(err instanceof DomainError ? err.message : 'Could not mark that used.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <ErrorNote message={error} />

      <Card variant="banner">
        <h3>How this works</h3>
        <p className="muted">
          Family Link has no API, so this app cannot add time to a device. It tells you the
          number and keeps the books. You add the bonus time in Family Link, then confirm
          here — and only then are the minutes spent.
        </p>
        <a href={FAMILY_LINK_WEB} target="_blank" rel="noreferrer">
          <button className="ghost">Open Family Link</button>
        </a>
      </Card>

      <h2>
        Requests {requested.length > 0 && <Pill tone="warn">{requested.length}</Pill>}
      </h2>
      {requested.length === 0 ? (
        <Empty>No requests right now.</Empty>
      ) : (
        <div className="stack">
          {requested.map((grant) => (
            <div className="card" key={grant.id}>
              <h3>
                Add {formatMinutes(grant.minutes)} for {memberName(grant.childId)}
              </h3>
              <p className="muted">Asked {formatWhen(grant.requestedAt)}</p>
              <ol className="muted" style={{ paddingLeft: 20, marginTop: 4 }}>
                <li>Open Family Link and pick {memberName(grant.childId)}.</li>
                <li>
                  Add {grant.minutes} minutes of bonus time, or raise today's limit by that
                  much.
                </li>
                <li>Come back and confirm below.</li>
              </ol>
              <div className="row" style={{ marginTop: 10 }}>
                <button
                  className="good grow"
                  onClick={() => void onSettle(grant.id)}
                  disabled={busyId === grant.id}
                >
                  I added it in Family Link
                </button>
                <button
                  className="bad"
                  onClick={() => void onCancel(grant.id)}
                  disabled={busyId === grant.id}
                >
                  Not now
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2>Passes not used yet</h2>
      {livePasses.length === 0 ? (
        <Empty>None outstanding.</Empty>
      ) : (
        <div className="stack">
          {livePasses.map((pass) => (
            <div className="card tight" key={pass.id}>
              <div className="row between">
                <div className="grow">
                  <h3>
                    {pass.hours}h pass — {memberName(pass.childId)}
                  </h3>
                  <p className="muted">
                    For: {pass.reason}. Expires {new Date(pass.expiresAt).toLocaleDateString()}
                  </p>
                  <p className="muted">
                    In Family Link, either turn today's limit off for the window or raise it
                    by {pass.hours} hours.
                  </p>
                </div>
                <button
                  className="good"
                  onClick={() => void onRedeemPass(pass.id)}
                  disabled={busyId === pass.id}
                >
                  Used
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {recent.length > 0 && (
        <>
          <h2>Recent</h2>
          <Card>
            {recent.map((grant) => (
              <div className="ledger-line" key={grant.id}>
                <div className="grow">
                  {memberName(grant.childId)} — {formatMinutes(grant.minutes)}
                  <div className="muted">
                    {grant.status === 'granted' ? 'Added' : `Cancelled: ${grant.cancelReason ?? ''}`}
                    {grant.settledAt ? ` · ${formatWhen(grant.settledAt)}` : ''}
                  </div>
                </div>
                <Pill tone={grant.status === 'granted' ? 'good' : undefined}>{grant.status}</Pill>
              </div>
            ))}
          </Card>
        </>
      )}
    </>
  );
}
