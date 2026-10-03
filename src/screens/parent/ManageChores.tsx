import { useState } from 'react';
import { useAuth } from '../../state/AuthContext';
import { useHousehold } from '../../state/HouseholdContext';
import { deleteChore, saveChore } from '../../data/store';
import { Card, Empty, ErrorNote, Pill } from '../../components/ui';
import type { Chore } from '../../domain/types';

interface Draft {
  id?: string;
  title: string;
  description: string;
  minutes: number;
  cooldownHours: number;
  isBaseline: boolean;
  assignedTo: string[];
  active: boolean;
}

const BLANK: Draft = {
  title: '',
  description: '',
  minutes: 10,
  cooldownHours: 12,
  isBaseline: false,
  assignedTo: [],
  active: true,
};

export default function ManageChores() {
  const { householdId } = useAuth();
  const { chores, children, memberName } = useHousehold();
  const [draft, setDraft] = useState<Draft>(BLANK);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!householdId || !draft.title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await saveChore({
        householdId,
        chore: {
          ...(draft.id ? { id: draft.id } : {}),
          title: draft.title.trim(),
          description: draft.description.trim(),
          // A baseline chore pays nothing by definition. Force it rather than
          // trusting whatever was left in the minutes box.
          minutes: draft.isBaseline ? 0 : Math.max(0, Math.round(draft.minutes)),
          kind: 'recurring',
          assignedTo: draft.assignedTo,
          cooldownHours: Math.max(0, Math.round(draft.cooldownHours)),
          isBaseline: draft.isBaseline,
          active: draft.active,
        },
      });
      setDraft(BLANK);
    } catch {
      setError('Could not save that chore.');
    } finally {
      setBusy(false);
    }
  }

  function edit(chore: Chore) {
    setDraft({
      id: chore.id,
      title: chore.title,
      description: chore.description ?? '',
      minutes: chore.minutes,
      cooldownHours: chore.cooldownHours,
      isBaseline: chore.isBaseline,
      assignedTo: chore.assignedTo,
      active: chore.active,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function remove(chore: Chore) {
    if (!householdId) return;
    if (!window.confirm(`Delete "${chore.title}"? Past approvals stay in the ledger.`)) return;
    await deleteChore(householdId, chore.id).catch(() => setError('Could not delete that.'));
  }

  function toggleAssigned(childId: string) {
    setDraft((d) => ({
      ...d,
      assignedTo: d.assignedTo.includes(childId)
        ? d.assignedTo.filter((id) => id !== childId)
        : [...d.assignedTo, childId],
    }));
  }

  const baseline = chores.filter((c) => c.isBaseline);
  const earning = chores.filter((c) => !c.isBaseline);

  return (
    <>
      <ErrorNote message={error} />

      <h2>{draft.id ? 'Edit chore' : 'Add a chore'}</h2>
      <Card>
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="ctitle">Title</label>
            <input
              id="ctitle"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="cdesc">
              What exactly counts as done (be specific — vague chores are the ones that
              never get started)
            </label>
            <textarea
              id="cdesc"
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </div>

          <div className="checkrow">
            <input
              id="cbaseline"
              type="checkbox"
              checked={draft.isBaseline}
              onChange={(e) => setDraft({ ...draft, isBaseline: e.target.checked })}
            />
            <label htmlFor="cbaseline">
              Expected of them, not paid — cleaning up after themselves.{' '}
              <span className="muted">
                Pays no minutes. For a child with the gate on, it blocks cashing out until
                it's done.
              </span>
            </label>
          </div>

          {!draft.isBaseline && (
            <div className="field">
              <label htmlFor="cminutes">Minutes earned</label>
              <input
                id="cminutes"
                type="number"
                min={0}
                value={draft.minutes}
                onChange={(e) => setDraft({ ...draft, minutes: Number(e.target.value) })}
              />
            </div>
          )}

          <div className="field">
            <label htmlFor="ccooldown">
              Hours before they can claim it again (0 = any time)
            </label>
            <input
              id="ccooldown"
              type="number"
              min={0}
              value={draft.cooldownHours}
              onChange={(e) => setDraft({ ...draft, cooldownHours: Number(e.target.value) })}
            />
          </div>

          <div className="field">
            <label>Who it's for (none selected = either of them)</label>
            {children.map((child) => (
              <div className="checkrow" key={child.id}>
                <input
                  id={`assign-${child.id}`}
                  type="checkbox"
                  checked={draft.assignedTo.includes(child.id)}
                  onChange={() => toggleAssigned(child.id)}
                />
                <label htmlFor={`assign-${child.id}`}>{child.displayName}</label>
              </div>
            ))}
          </div>

          <div className="row">
            <button className="primary grow" type="submit" disabled={busy || !draft.title.trim()}>
              {busy ? 'Saving…' : draft.id ? 'Save changes' : 'Add chore'}
            </button>
            {draft.id && (
              <button type="button" className="ghost" onClick={() => setDraft(BLANK)}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </Card>

      <h2>Expected, unpaid ({baseline.length})</h2>
      {baseline.length === 0 ? (
        <Empty>None set up. These are what the cashout gate checks.</Empty>
      ) : (
        <div className="stack">
          {baseline.map((chore) => (
            <ChoreRow
              key={chore.id}
              chore={chore}
              memberName={memberName}
              onEdit={edit}
              onRemove={remove}
            />
          ))}
        </div>
      )}

      <h2>Earning ({earning.length})</h2>
      {earning.length === 0 ? (
        <Empty>No earning chores yet.</Empty>
      ) : (
        <div className="stack">
          {earning.map((chore) => (
            <ChoreRow
              key={chore.id}
              chore={chore}
              memberName={memberName}
              onEdit={edit}
              onRemove={remove}
            />
          ))}
        </div>
      )}
    </>
  );
}

function ChoreRow({
  chore,
  memberName,
  onEdit,
  onRemove,
}: {
  chore: Chore;
  memberName: (id: string) => string;
  onEdit: (chore: Chore) => void;
  onRemove: (chore: Chore) => void;
}) {
  return (
    <div className="card tight">
      <div className="row between">
        <div className="grow">
          <h3>{chore.title}</h3>
          {chore.description && <p className="muted">{chore.description}</p>}
          <div className="row wrap">
            {chore.isBaseline ? (
              <Pill tone="warn">expected</Pill>
            ) : (
              <Pill tone="good">+{chore.minutes} min</Pill>
            )}
            {chore.cooldownHours > 0 && <Pill>every {chore.cooldownHours}h</Pill>}
            {chore.assignedTo.length === 0 ? (
              <Pill>anyone</Pill>
            ) : (
              chore.assignedTo.map((id) => <Pill key={id}>{memberName(id)}</Pill>)
            )}
            {!chore.active && <Pill tone="bad">off</Pill>}
          </div>
        </div>
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <button className="ghost" onClick={() => onEdit(chore)}>
          Edit
        </button>
        <button className="bad" onClick={() => onRemove(chore)}>
          Delete
        </button>
      </div>
    </div>
  );
}
