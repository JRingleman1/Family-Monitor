import { useMemo, useState } from 'react';
import { useAuth } from '../../state/AuthContext';
import { useHousehold } from '../../state/HouseholdContext';
import { currentStreakDays } from '../../domain/economy';
import { DomainError, recordInfraction, reverseInfraction } from '../../data/store';
import { Avatar, Card, Empty, ErrorNote, Pill, formatWhen } from '../../components/ui';
import { INFRACTION_LABEL } from '../../domain/types';
import type { InfractionKind } from '../../domain/types';

/**
 * Logging a refusal or a job deliberately done badly.
 *
 * Two deliberate limits, both argued for rather than assumed:
 *
 * Empathy points cannot be touched here, and there is no control for it. Those
 * points record what a child did for another person; a chore refusal does not
 * make that untrue, and letting compliance move the same number the kindness
 * ladder reads would collapse two currencies into one.
 *
 * The reason is required and the child reads it. A balance that drops with no
 * stated cause teaches a kid the system is arbitrary, and an arbitrary system
 * gets worked around rather than respected.
 */
export default function Consequences() {
  const { member, householdId } = useAuth();
  const { children, completions, infractions, memberName, balanceFor } = useHousehold();

  const [childId, setChildId] = useState('');
  const [kind, setKind] = useState<InfractionKind>('refusal');
  const [description, setDescription] = useState('');
  const [minutes, setMinutes] = useState(15);
  const [breaksStreak, setBreaksStreak] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const target = childId || children[0]?.id || '';
  const now = Date.now();

  const streakIfLogged = useMemo(() => {
    if (!target) return { before: 0, after: 0 };
    const before = currentStreakDays({ completions, infractions, childId: target, now });
    const after = breaksStreak
      ? 0
      : before;
    return { before, after };
  }, [target, completions, infractions, breaksStreak, now]);

  const balance = target ? balanceFor(target) : null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!householdId || !member || !target) return;

    setBusy(true);
    setError(null);
    try {
      await recordInfraction({
        householdId,
        childId: target,
        kind,
        description,
        minutesDeducted: Math.max(0, Math.round(minutes)),
        breaksStreak,
        recordedBy: member.id,
      });
      setDescription('');
      setDone(true);
    } catch (err) {
      setError(err instanceof DomainError ? err.message : 'Could not log that.');
    } finally {
      setBusy(false);
    }
  }

  async function undo(infractionId: string) {
    if (!householdId || !member) return;
    const entry = infractions.find((i) => i.id === infractionId);
    if (!entry) return;
    if (!window.confirm(`Undo "${entry.description}"? The minutes go back and the streak is restored.`)) {
      return;
    }
    try {
      await reverseInfraction({ householdId, infraction: entry, reversedBy: member.id });
    } catch (err) {
      setError(err instanceof DomainError ? err.message : 'Could not undo that.');
    }
  }

  return (
    <>
      <ErrorNote message={error} />

      {done && (
        <Card variant="banner">
          Logged. She'll see it on her own screen with the reason.{' '}
          <button className="ghost" onClick={() => setDone(false)}>
            OK
          </button>
        </Card>
      )}

      <h2>Log a refusal or a bad job</h2>
      <Card>
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="cwho">Who</label>
            <select id="cwho" value={target} onChange={(e) => setChildId(e.target.value)}>
              {children.map((child) => (
                <option key={child.id} value={child.id}>
                  {child.displayName}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="ckind">What kind</label>
            <select
              id="ckind"
              value={kind}
              onChange={(e) => setKind(e.target.value as InfractionKind)}
            >
              {(Object.keys(INFRACTION_LABEL) as InfractionKind[]).map((k) => (
                <option key={k} value={k}>
                  {INFRACTION_LABEL[k]}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="cwhat">
              What happened — she reads this, so write it as you'd say it to her
            </label>
            <input
              id="cwhat"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Asked three times to clear her floor and refused"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="cmin">Minutes to take back (0 for a warning that costs nothing)</label>
            <input
              id="cmin"
              type="number"
              min={0}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
            />
            {balance && minutes > balance.availableMinutes && (
              <p className="muted" style={{ marginTop: 6 }}>
                She only has {balance.availableMinutes} banked, so this takes her to zero
                rather than into debt.
              </p>
            )}
          </div>

          <div className="checkrow">
            <input
              id="cstreak"
              type="checkbox"
              checked={breaksStreak}
              onChange={(e) => setBreaksStreak(e.target.checked)}
            />
            <label htmlFor="cstreak">
              Break her streak for today.{' '}
              <span className="muted">
                A streak claims she showed up every day. If she refused, she didn't — so this
                is accuracy rather than an extra punishment.
              </span>
            </label>
          </div>

          {streakIfLogged.before > 0 && breaksStreak && (
            <Card variant="gate" tight>
              This resets a {streakIfLogged.before}-day streak to zero. For a kid working a
              streak ladder that is the bigger of the two consequences by far — worth being
              sure before you log it.
            </Card>
          )}

          <button className="primary big" type="submit" disabled={busy || !description.trim()}>
            {busy ? 'Logging…' : 'Log it'}
          </button>
        </form>
      </Card>

      <Card tight>
        <p className="muted">
          There is no control here for empathy points, deliberately. Those record what she
          did for somebody else, and refusing a chore doesn't make that untrue. Keeping chores
          out of that number in both directions is what stops the prize ladder turning into an
          obedience score.
        </p>
      </Card>

      <h2>Logged</h2>
      {infractions.length === 0 ? (
        <Empty>Nothing logged. Good.</Empty>
      ) : (
        <div className="stack">
          {infractions.slice(0, 20).map((entry) => {
            const child = children.find((c) => c.id === entry.childId);
            return (
              <div className="card tight" key={entry.id}>
                <div className="row">
                  {child && <Avatar member={child} />}
                  <div className="grow">
                    <h3>{memberName(entry.childId)}</h3>
                    <p>{entry.description}</p>
                    <div className="row wrap">
                      <Pill tone="bad">{INFRACTION_LABEL[entry.kind]}</Pill>
                      {entry.minutesDeducted > 0 && (
                        <Pill tone="warn">-{entry.minutesDeducted} min</Pill>
                      )}
                      {entry.breaksStreak && <Pill tone="warn">streak reset</Pill>}
                      <Pill>by {memberName(entry.recordedBy)}</Pill>
                      <Pill>{formatWhen(entry.createdAt)}</Pill>
                    </div>
                  </div>
                  <button className="ghost" onClick={() => void undo(entry.id)}>
                    Undo
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
