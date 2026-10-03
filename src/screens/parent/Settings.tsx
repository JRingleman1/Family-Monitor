import { useEffect, useState } from 'react';
import { useAuth } from '../../state/AuthContext';
import { useHousehold } from '../../state/HouseholdContext';
import { useChildPolicies } from '../../state/useChildPolicies';
import { recomputeStats, saveChildPolicy, saveSettings } from '../../data/store';
import { Card, ErrorNote, Pill } from '../../components/ui';
import type { ChildPolicy, HouseholdSettings } from '../../domain/types';

/**
 * Household settings and per-child tracks.
 *
 * The two tracks are the substance of this screen, so each one carries a note
 * saying what it is for. A setting changed without knowing why tends to get
 * changed back next week.
 */
export default function Settings() {
  const { householdId } = useAuth();
  const { settings, children, parents, caregiver } = useHousehold();
  const { policyFor } = useChildPolicies();

  const [draft, setDraft] = useState<HouseholdSettings>(settings);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => setDraft(settings), [settings]);

  async function save() {
    if (!householdId) return;
    setBusy(true);
    setError(null);
    try {
      await saveSettings(householdId, draft);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch {
      setError('Could not save settings.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <ErrorNote message={error} />
      {saved && <Card variant="banner">Saved.</Card>}

      <h2>Who gets the empathy multiplier</h2>
      <Card>
        <p className="muted">
          Deeds that help this person are worth a multiple of anything else. If the goal is
          for the kids to take work off Mom, this has to be Mom.
        </p>
        <div className="field">
          <label htmlFor="caregiver">Primary caregiver</label>
          <select
            id="caregiver"
            value={draft.primaryCaregiverId ?? ''}
            onChange={(e) =>
              setDraft({ ...draft, primaryCaregiverId: e.target.value || null })
            }
          >
            <option value="">Nobody selected</option>
            {parents.map((parent) => (
              <option key={parent.id} value={parent.id}>
                {parent.displayName}
              </option>
            ))}
          </select>
        </div>
        {!draft.primaryCaregiverId && (
          <p className="muted">
            Nobody selected, so the multiplier never applies. Pick someone.
          </p>
        )}
      </Card>

      <h2>Deeds and passes</h2>
      <Card>
        <NumberField
          id="deedEmpathy"
          label="Empathy for an ordinary good deed"
          value={draft.deedEmpathyPoints}
          onChange={(v) => setDraft({ ...draft, deedEmpathyPoints: v })}
        />
        <NumberField
          id="sacrificeEmpathy"
          label="Empathy for a deed involving real sacrifice"
          value={draft.sacrificeEmpathyPoints}
          onChange={(v) => setDraft({ ...draft, sacrificeEmpathyPoints: v })}
        />
        <NumberField
          id="deedMinutes"
          label="Screen time minutes a confirmed deed also earns"
          value={draft.deedMinutes}
          onChange={(v) => setDraft({ ...draft, deedMinutes: v })}
        />
        <NumberField
          id="multiplier"
          label={`Default multiplier for helping ${caregiver?.displayName ?? 'the caregiver'}`}
          value={draft.caregiverMultiplier}
          onChange={(v) => setDraft({ ...draft, caregiverMultiplier: v })}
        />
        <NumberField
          id="passHours"
          label="Hours in a sacrifice pass"
          value={draft.passHours}
          onChange={(v) => setDraft({ ...draft, passHours: v })}
        />
        <NumberField
          id="passExpiry"
          label="Days before an unused pass expires"
          value={draft.passExpiryDays}
          onChange={(v) => setDraft({ ...draft, passExpiryDays: v })}
        />
        <NumberField
          id="cap"
          label="Default daily chore minute cap"
          value={draft.dailyChoreMinuteCap}
          onChange={(v) => setDraft({ ...draft, dailyChoreMinuteCap: v })}
        />

        <div className="checkrow">
          <input
            id="selfconfirm"
            type="checkbox"
            checked={draft.allowSelfConfirm}
            onChange={(e) => setDraft({ ...draft, allowSelfConfirm: e.target.checked })}
          />
          <label htmlFor="selfconfirm">
            One adult may both nominate and confirm a deed.{' '}
            <span className="muted">
              Off means two adults in the loop, which is the better default. Turn it on when
              one of you is on your own and a deed would otherwise go unrewarded.
            </span>
          </label>
        </div>

        <button className="primary big" onClick={() => void save()} disabled={busy}>
          {busy ? 'Saving…' : 'Save settings'}
        </button>
      </Card>

      <h2>Tracks</h2>
      {children.map((child) => (
        <TrackEditor key={child.id} childId={child.id} name={child.displayName} existing={policyFor(child.id)} />
      ))}

      <h2>Repair</h2>
      <Card>
        <p className="muted">
          Balances are worked out from the ledger, which is append-only. If a total ever
          looks wrong, rebuild it from the ledger here. Nothing is lost either way.
        </p>
        {children.map((child) => (
          <button
            key={child.id}
            className="ghost"
            style={{ marginRight: 8, marginBottom: 8 }}
            onClick={() => {
              if (!householdId) return;
              void recomputeStats(householdId, child.id)
                .then((b) =>
                  window.alert(
                    `${child.displayName}: ${b.availableMinutes} min banked, ` +
                      `${b.empathyPoints} empathy, ${b.lifetimeMinutes} min lifetime.`,
                  ),
                )
                .catch(() => setError('Could not rebuild that total.'));
            }}
          >
            Rebuild {child.displayName}'s totals
          </button>
        ))}
      </Card>
    </>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function TrackEditor({
  childId,
  name,
  existing,
}: {
  childId: string;
  name: string;
  existing: ChildPolicy | undefined;
}) {
  const { householdId } = useAuth();
  const [draft, setDraft] = useState<ChildPolicy>(
    existing ?? {
      childId,
      label: 'Standard track',
      requireBaselineForCashout: false,
      streakBonusMinutes: 0,
      streakBonusAfterDays: 0,
    },
  );
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (existing) setDraft(existing);
  }, [existing]);

  async function save() {
    if (!householdId) return;
    setBusy(true);
    try {
      await saveChildPolicy(householdId, draft);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="row between">
        <h3>{name}</h3>
        {saved && <Pill tone="good">saved</Pill>}
      </div>

      <div className="field">
        <label htmlFor={`label-${childId}`}>Track name (you only)</label>
        <input
          id={`label-${childId}`}
          value={draft.label}
          onChange={(e) => setDraft({ ...draft, label: e.target.value })}
        />
      </div>

      <div className="checkrow">
        <input
          id={`gate-${childId}`}
          type="checkbox"
          checked={draft.requireBaselineForCashout}
          onChange={(e) =>
            setDraft({ ...draft, requireBaselineForCashout: e.target.checked })
          }
        />
        <label htmlFor={`gate-${childId}`}>
          Can't spend minutes until her own jobs are done.{' '}
          <span className="muted">
            For a kid who negotiates with her own mess. She still earns everything — she just
            can't cash out while the floor is covered. Removes the leverage instead of paying
            to remove it.
          </span>
        </label>
      </div>

      <div className="field">
        <label htmlFor={`cap-${childId}`}>
          Daily chore minute cap (blank uses the household default)
        </label>
        <input
          id={`cap-${childId}`}
          type="number"
          min={0}
          value={draft.dailyChoreMinuteCap ?? ''}
          onChange={(e) =>
            setDraft({
              ...draft,
              dailyChoreMinuteCap: e.target.value === '' ? undefined : Number(e.target.value),
            })
          }
        />
      </div>

      <div className="field">
        <label htmlFor={`bonus-${childId}`}>Streak bonus minutes</label>
        <input
          id={`bonus-${childId}`}
          type="number"
          min={0}
          value={draft.streakBonusMinutes}
          onChange={(e) => setDraft({ ...draft, streakBonusMinutes: Number(e.target.value) })}
        />
      </div>

      <div className="field">
        <label htmlFor={`after-${childId}`}>
          Days in a row before the bonus starts.{' '}
          <span className="muted">
            Set this low — two or three — for a kid who needs to feel the machine pay out
            before she believes in it.
          </span>
        </label>
        <input
          id={`after-${childId}`}
          type="number"
          min={0}
          value={draft.streakBonusAfterDays}
          onChange={(e) => setDraft({ ...draft, streakBonusAfterDays: Number(e.target.value) })}
        />
      </div>

      <div className="field">
        <label htmlFor={`mult-${childId}`}>
          Caregiver multiplier for her specifically (blank uses the household default)
        </label>
        <input
          id={`mult-${childId}`}
          type="number"
          min={1}
          value={draft.caregiverMultiplier ?? ''}
          onChange={(e) =>
            setDraft({
              ...draft,
              caregiverMultiplier: e.target.value === '' ? undefined : Number(e.target.value),
            })
          }
        />
      </div>

      <button className="primary" onClick={() => void save()} disabled={busy}>
        {busy ? 'Saving…' : `Save ${name}'s track`}
      </button>
    </Card>
  );
}
