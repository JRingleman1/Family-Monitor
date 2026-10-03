import { useState } from 'react';
import { useAuth } from '../../state/AuthContext';
import { useHousehold } from '../../state/HouseholdContext';
import { useChildPolicies } from '../../state/useChildPolicies';
import { effectivePolicy } from '../../domain/economy';
import { DomainError, nominateDeed } from '../../data/store';
import { Avatar, Card, ErrorNote, Pill, formatWhen } from '../../components/ui';

/**
 * Nominating a good deed.
 *
 * This is the screen the caregiver uses one-handed with a baby in the other arm,
 * so it is three taps: who, what, send. Everything else is optional.
 *
 * A child can never reach this screen, and the Firestore rules refuse a deed
 * they create even if they reach the API directly. Empathy points are the only
 * currency that moves a hidden prize, so being unable to self-award them is what
 * keeps the whole thing honest.
 */
export default function NominateDeed() {
  const { member, householdId } = useAuth();
  const { children, deeds, settings, caregiver, memberName } = useHousehold();
  const { policyFor } = useChildPolicies();

  const [childId, setChildId] = useState<string>('');
  const [description, setDescription] = useState('');
  const [impactNote, setImpactNote] = useState('');
  const [helpedCaregiver, setHelpedCaregiver] = useState(false);
  const [involvedSacrifice, setInvolvedSacrifice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const target = childId || children[0]?.id || '';
  const policy = effectivePolicy(settings, policyFor(target), target);

  const recent = deeds.slice(0, 6);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!householdId || !member || !target) return;

    setError(null);
    setBusy(true);
    try {
      await nominateDeed({
        householdId,
        childId: target,
        description,
        impactNote: impactNote.trim() || undefined,
        nominatedBy: member.id,
        helpedCaregiver,
        involvedSacrifice,
      });
      setDescription('');
      setImpactNote('');
      setHelpedCaregiver(false);
      setInvolvedSacrifice(false);
      setSent(true);
    } catch (err) {
      setError(err instanceof DomainError ? err.message : 'Could not send that.');
    } finally {
      setBusy(false);
    }
  }

  const empathyPreview = involvedSacrifice
    ? policy.sacrificeEmpathyPoints
    : policy.deedEmpathyPoints;
  const withMultiplier =
    helpedCaregiver && policy.caregiverMultiplier > 1
      ? Math.round(empathyPreview * policy.caregiverMultiplier)
      : empathyPreview;

  return (
    <>
      <ErrorNote message={error} />

      {sent && (
        <Card variant="banner">
          Sent. It needs a parent to confirm it before it counts.{' '}
          <button className="ghost" onClick={() => setSent(false)}>
            OK
          </button>
        </Card>
      )}

      <h2>Someone did something good</h2>
      <Card>
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="who">Who</label>
            <select id="who" value={target} onChange={(e) => setChildId(e.target.value)}>
              {children.map((child) => (
                <option key={child.id} value={child.id}>
                  {child.displayName}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="what">What they did</label>
            <input
              id="what"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Took the baby so I could eat"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="impact">What it did for you (optional, but this is the bit that lands)</label>
            <textarea
              id="impact"
              value={impactNote}
              onChange={(e) => setImpactNote(e.target.value)}
              placeholder="I got to sit down and eat a hot meal for the first time all week."
            />
          </div>

          <div className="checkrow">
            <input
              id="helped"
              type="checkbox"
              checked={helpedCaregiver}
              onChange={(e) => setHelpedCaregiver(e.target.checked)}
            />
            <label htmlFor="helped">
              This helped {caregiver?.displayName ?? 'Mom'}
              {policy.caregiverMultiplier > 1 && (
                <>
                  {' '}
                  <Pill tone="good">x{policy.caregiverMultiplier} empathy</Pill>
                </>
              )}
            </label>
          </div>

          <div className="checkrow">
            <input
              id="sacrifice"
              type="checkbox"
              checked={involvedSacrifice}
              onChange={(e) => setInvolvedSacrifice(e.target.checked)}
            />
            <label htmlFor="sacrifice">
              They gave up something real for someone else{' '}
              <Pill tone="gold">{policy.passHours}h pass</Pill>
            </label>
          </div>

          <p className="muted">
            Worth {withMultiplier} empathy and {policy.deedMinutes} minutes once confirmed
            {involvedSacrifice ? `, plus a ${policy.passHours} hour pass` : ''}.
          </p>

          <button className="primary big" type="submit" disabled={busy || !description.trim()}>
            {busy ? 'Sending…' : 'Nominate'}
          </button>
        </form>
      </Card>

      <Card tight>
        <p className="muted">
          Kids cannot nominate themselves, here or anywhere else. That is deliberate: empathy
          points are the only thing that moves a hidden prize, so they have to come from
          someone who was actually helped.
        </p>
      </Card>

      {recent.length > 0 && (
        <>
          <h2>Recent deeds</h2>
          <div className="stack">
            {recent.map((deed) => {
              const child = children.find((c) => c.id === deed.childId);
              return (
                <div className="card tight" key={deed.id}>
                  <div className="row">
                    {child && <Avatar member={child} />}
                    <div className="grow">
                      <strong>{memberName(deed.childId)}</strong> — {deed.description}
                      <div className="row wrap" style={{ marginTop: 4 }}>
                        <Pill
                          tone={
                            deed.status === 'approved'
                              ? 'good'
                              : deed.status === 'rejected'
                                ? 'bad'
                                : undefined
                          }
                        >
                          {deed.status}
                        </Pill>
                        {deed.empathyAwarded !== undefined && (
                          <Pill tone="gold">+{deed.empathyAwarded} empathy</Pill>
                        )}
                        <Pill>{formatWhen(deed.createdAt)}</Pill>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
