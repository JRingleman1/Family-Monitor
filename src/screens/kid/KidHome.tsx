import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../state/AuthContext';
import { useHousehold } from '../../state/HouseholdContext';
import { useChildPolicies } from '../../state/useChildPolicies';
import {
  baselineStatus,
  currentStreakDays,
  effectivePolicy,
  evaluateCashout,
  evaluateChoreClaim,
  isPassUsable,
} from '../../domain/economy';
import { hintMessage } from '../../domain/prizes';
import { DomainError, claimChore, requestGrant, watchStats } from '../../data/store';
import type { ChildStats } from '../../data/store';
import {
  Card,
  Empty,
  ErrorNote,
  Meter,
  Pill,
  formatCountdown,
  formatMinutes,
  formatWhen,
} from '../../components/ui';
import type { Chore } from '../../domain/types';

/**
 * A kid's whole app.
 *
 * Design rules, learned the hard way from every chore chart that ever died on a
 * fridge door:
 *  - The banked number is the biggest thing on screen. That is the point of
 *    doing any of this, so it is never more than one glance away.
 *  - Each chore is one row with one button. No menus, no long press, no modals.
 *  - When something is blocked, the row says why in a sentence a child can read,
 *    rather than just going grey.
 *  - The prize hint never shows a number. Not a percentage, not a threshold,
 *    not a days count.
 */
export default function KidHome() {
  const { member, householdId, signOut } = useAuth();
  const {
    chores,
    completions,
    ledger,
    passes,
    grants,
    infractions,
    settings,
    balanceFor,
  } = useHousehold();
  const { policyFor } = useChildPolicies();

  const [error, setError] = useState<string | null>(null);
  const [busyChoreId, setBusyChoreId] = useState<string | null>(null);
  const [askMinutes, setAskMinutes] = useState(30);
  const [asking, setAsking] = useState(false);

  const childId = member?.id ?? '';
  const now = Date.now();

  const policy = useMemo(
    () => effectivePolicy(settings, policyFor(childId), childId),
    [settings, policyFor, childId],
  );

  const balance = balanceFor(childId);
  const streak = currentStreakDays({ completions, infractions, childId, now });
  const baseline = baselineStatus({ chores, completions, childId, now });

  // Prize titles and thresholds never reach this device - the rules refuse a
  // child any read on the prizes collection - so the band cannot be worked out
  // here. It is computed on a parent's approval and stored as one word.
  const [stats, setStats] = useState<ChildStats | null>(null);
  useEffect(() => {
    if (!householdId || !childId) return;
    return watchStats(householdId, childId, setStats);
  }, [householdId, childId]);

  const band = stats?.hintBand ?? 'none';

  const usablePasses = passes.filter((p) => isPassUsable(p, now));
  const pendingGrant = grants.find((g) => g.status === 'requested');
  const myLedger = ledger.filter((e) => e.childId === childId).slice(0, 12);

  const visibleChores = useMemo(
    () =>
      chores
        .filter((c) => c.active)
        .filter((c) => c.assignedTo.length === 0 || c.assignedTo.includes(childId))
        // Their own jobs first when those gate spending: that is the thing
        // standing between them and the screen time they already earned.
        .sort((a, b) => {
          if (policy.requireBaselineForCashout && a.isBaseline !== b.isBaseline) {
            return a.isBaseline ? -1 : 1;
          }
          return a.title.localeCompare(b.title);
        }),
    [chores, childId, policy.requireBaselineForCashout],
  );

  const cashout = evaluateCashout({
    minutes: askMinutes,
    balance,
    policy,
    chores,
    completions,
    now,
  });

  async function onClaim(chore: Chore) {
    if (!householdId || !member) return;
    setError(null);
    setBusyChoreId(chore.id);
    try {
      await claimChore({
        householdId,
        chore,
        childId: member.id,
        completions,
        ledger,
        policy,
      });
    } catch (err) {
      setError(err instanceof DomainError ? err.message : 'Could not send that. Try again.');
    } finally {
      setBusyChoreId(null);
    }
  }

  async function onAsk() {
    if (!householdId || !member) return;
    setError(null);
    setAsking(true);
    try {
      await requestGrant({
        householdId,
        childId: member.id,
        minutes: askMinutes,
        balance,
        policy,
        chores,
        completions,
        requestedBy: member.id,
      });
    } catch (err) {
      setError(err instanceof DomainError ? err.message : 'Could not send that. Try again.');
    } finally {
      setAsking(false);
    }
  }

  if (!member) return null;

  return (
    <div className="app">
      <div className="topbar">
        <div>
          <h1>Hi {member.displayName}</h1>
          {streak > 0 && (
            <Pill tone="good">
              {streak} day{streak === 1 ? '' : 's'} in a row
            </Pill>
          )}
        </div>
        <button className="ghost" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>

      <ErrorNote message={error} />

      <Card>
        <div className="balance">
          <div className="num">{balance.availableMinutes}</div>
          <div className="unit">minutes banked</div>
        </div>
      </Card>

      {band !== 'none' && (
        <Card variant="hint">
          <div className="band">{hintMessage(band)}</div>
        </Card>
      )}

      {usablePasses.length > 0 && (
        <Card variant="banner">
          <h3>
            You have {usablePasses.length} pass{usablePasses.length === 1 ? '' : 'es'}
          </h3>
          {usablePasses.map((pass) => (
            <p key={pass.id} className="muted">
              {pass.hours} hours — for {pass.reason}. Ask a parent to use it.
            </p>
          ))}
        </Card>
      )}

      {policy.requireBaselineForCashout && !baseline.satisfied && (
        <Card variant="gate">
          <h3>Your own jobs first</h3>
          <p className="muted">
            Your minutes are safe. You just can't spend them until these are done and
            checked off:
          </p>
          <div className="row wrap">
            {baseline.outstanding.map((c) => (
              <Pill key={c.id} tone="warn">
                {c.title}
              </Pill>
            ))}
          </div>
        </Card>
      )}

      <h2>Ask for screen time</h2>
      <Card>
        {pendingGrant ? (
          <p>
            You asked for {formatMinutes(pendingGrant.minutes)}. Waiting for a parent to
            add it. <span className="muted">{formatWhen(pendingGrant.requestedAt)}</span>
          </p>
        ) : (
          <>
            <div className="field">
              <label htmlFor="ask">How many minutes?</label>
              <select
                id="ask"
                value={askMinutes}
                onChange={(e) => setAskMinutes(Number(e.target.value))}
              >
                {[15, 30, 45, 60, 90].map((m) => (
                  <option key={m} value={m} disabled={m > balance.availableMinutes}>
                    {formatMinutes(m)}
                    {m > balance.availableMinutes ? ' — not enough banked' : ''}
                  </option>
                ))}
              </select>
            </div>
            <button
              className="primary big"
              onClick={() => void onAsk()}
              disabled={asking || !cashout.allowed}
            >
              {asking ? 'Sending…' : `Ask for ${formatMinutes(askMinutes)}`}
            </button>
            {!cashout.allowed && cashout.reason === 'baseline-outstanding' && (
              <p className="muted" style={{ marginTop: 10 }}>
                Finish your own jobs above first.
              </p>
            )}
            {!cashout.allowed && cashout.reason === 'insufficient-balance' && (
              <p className="muted" style={{ marginTop: 10 }}>
                You have {formatMinutes(balance.availableMinutes)} banked.
              </p>
            )}
          </>
        )}
      </Card>

      <h2>Jobs</h2>
      {visibleChores.length === 0 ? (
        <Empty>No jobs set up yet. A parent needs to add some.</Empty>
      ) : (
        <div className="stack">
          {visibleChores.map((chore) => {
            const eligibility = evaluateChoreClaim({
              chore,
              childId,
              completions,
              ledger,
              policy,
              now,
            });
            const pending = completions.some(
              (c) => c.choreId === chore.id && c.childId === childId && c.status === 'pending',
            );

            return (
              <div className="card tight" key={chore.id}>
                <div className="row between">
                  <div className="grow">
                    <h3>{chore.title}</h3>
                    {chore.description && <p className="muted">{chore.description}</p>}
                    <div className="row wrap">
                      {chore.isBaseline ? (
                        <Pill tone="warn">Expected — no minutes</Pill>
                      ) : (
                        <Pill tone="good">+{formatMinutes(chore.minutes)}</Pill>
                      )}
                      {pending && <Pill>Waiting to be checked</Pill>}
                      {eligibility.reason === 'cooldown' && eligibility.availableAt && (
                        <Pill>Again {formatCountdown(eligibility.availableAt)}</Pill>
                      )}
                      {eligibility.reason === 'daily-cap-reached' && (
                        <Pill tone="warn">Earned enough today</Pill>
                      )}
                    </div>
                  </div>
                  <button
                    className="good"
                    onClick={() => void onClaim(chore)}
                    disabled={!eligibility.allowed || busyChoreId === chore.id}
                  >
                    {busyChoreId === chore.id ? '…' : 'Done'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <h2>Where your minutes came from</h2>
      {myLedger.length === 0 ? (
        <Empty>Nothing yet. Do a job and it shows up here.</Empty>
      ) : (
        <Card>
          {myLedger.map((entry) => (
            <div className="ledger-line" key={entry.id}>
              <div className="grow">
                {entry.note}
                <div className="muted">{formatWhen(entry.createdAt)}</div>
              </div>
              <div className={`delta ${entry.deltaMinutes >= 0 ? 'up' : 'down'}`}>
                {entry.deltaMinutes > 0 ? '+' : ''}
                {entry.deltaMinutes} min
              </div>
            </div>
          ))}
        </Card>
      )}

      <Card tight>
        <p className="muted">
          Minutes get added to your device by a parent in Family Link. This app keeps count;
          it can't change your phone by itself.
        </p>
      </Card>

      <div style={{ height: 8 }} />
      <Meter percent={Math.min(100, (balance.availableMinutes / 120) * 100)} />
    </div>
  );
}
