import { useState } from 'react';
import { useAuth } from '../../state/AuthContext';
import { useHousehold } from '../../state/HouseholdContext';
import { useChildPolicies } from '../../state/useChildPolicies';
import {
  currentStreakDays,
  effectivePolicy,
} from '../../domain/economy';
import {
  DomainError,
  approveCompletion,
  approveDeed,
  rejectCompletion,
  rejectDeed,
} from '../../data/store';
import { Avatar, Card, Empty, ErrorNote, Pill, formatWhen } from '../../components/ui';
import type { Prize } from '../../domain/types';

/**
 * Everything waiting on an adult, in one list.
 *
 * The queue has to be fast to clear or it stops getting cleared, and a chore
 * app that does not get reviewed is worse than no chore app - the kid did the
 * work and learned that doing the work does nothing.
 */
export default function ApprovalQueue() {
  const { member, householdId } = useAuth();
  const { chores, completions, deeds, ledger, settings, caregiver, memberName, members } =
    useHousehold();
  const { policyFor } = useChildPolicies();

  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [unlockedNote, setUnlockedNote] = useState<Prize[]>([]);

  const pendingCompletions = completions.filter((c) => c.status === 'pending');
  const pendingDeeds = deeds.filter((d) => d.status === 'pending');

  function policyFo(childId: string) {
    return effectivePolicy(settings, policyFor(childId), childId);
  }

  async function onApproveChore(completionId: string) {
    if (!householdId || !member) return;
    const completion = completions.find((c) => c.id === completionId);
    const chore = chores.find((c) => c.id === completion?.choreId);
    if (!completion || !chore) {
      setError('That chore was deleted. Reject the claim and add it again.');
      return;
    }

    setError(null);
    setBusyId(completionId);
    try {
      const unlocked = await approveCompletion({
        householdId,
        completion,
        chore,
        ledger,
        completions,
        policy: policyFo(completion.childId),
        approverId: member.id,
      });
      if (unlocked.length > 0) setUnlockedNote(unlocked);
    } catch (err) {
      setError(err instanceof DomainError ? err.message : 'Could not approve that.');
    } finally {
      setBusyId(null);
    }
  }

  async function onRejectChore(completionId: string) {
    if (!householdId || !member) return;
    const reason = window.prompt('What needs doing again?');
    if (reason === null) return;
    setBusyId(completionId);
    try {
      await rejectCompletion({
        householdId,
        completionId,
        approverId: member.id,
        reason: reason.trim() || 'Not done properly yet.',
      });
    } catch {
      setError('Could not send that back.');
    } finally {
      setBusyId(null);
    }
  }

  async function onApproveDeed(deedId: string) {
    if (!householdId || !member) return;
    const deed = deeds.find((d) => d.id === deedId);
    if (!deed) return;

    setError(null);
    setBusyId(deedId);
    try {
      const unlocked = await approveDeed({
        householdId,
        deed,
        policy: policyFo(deed.childId),
        approver: member,
        caregiverName: caregiver?.displayName,
        streakDays: currentStreakDays({
          completions,
          childId: deed.childId,
          now: Date.now(),
        }),
      });
      if (unlocked.length > 0) setUnlockedNote(unlocked);
    } catch (err) {
      setError(err instanceof DomainError ? err.message : 'Could not confirm that.');
    } finally {
      setBusyId(null);
    }
  }

  async function onRejectDeed(deedId: string) {
    if (!householdId || !member) return;
    const reason = window.prompt('Why not? (the kid sees this)');
    if (reason === null) return;
    setBusyId(deedId);
    try {
      await rejectDeed({
        householdId,
        deedId,
        approverId: member.id,
        reason: reason.trim() || 'Not this time.',
      });
    } catch {
      setError('Could not reject that.');
    } finally {
      setBusyId(null);
    }
  }

  const avatarFor = (childId: string) => members.find((m) => m.id === childId);

  return (
    <>
      <ErrorNote message={error} />

      {unlockedNote.length > 0 && (
        <Card variant="hint">
          <h3>A prize just unlocked</h3>
          {unlockedNote.map((p) => (
            <p key={p.id}>
              <strong>{p.title}</strong>
            </p>
          ))}
          <p className="muted">
            The kid only sees "you unlocked something". Go and tell them, then mark it
            revealed on the Prizes tab.
          </p>
          <button className="ghost" onClick={() => setUnlockedNote([])}>
            Got it
          </button>
        </Card>
      )}

      <h2>
        Good deeds waiting{' '}
        {pendingDeeds.length > 0 && <Pill tone="gold">{pendingDeeds.length}</Pill>}
      </h2>
      {pendingDeeds.length === 0 ? (
        <Empty>Nothing waiting. Nominate one from the Deeds tab.</Empty>
      ) : (
        <div className="stack">
          {pendingDeeds.map((deed) => {
            const child = avatarFor(deed.childId);
            return (
              <div className="card" key={deed.id}>
                <div className="row">
                  {child && <Avatar member={child} />}
                  <div className="grow">
                    <h3>{memberName(deed.childId)}</h3>
                    <p>{deed.description}</p>
                    {deed.impactNote && (
                      <p className="muted">What it did: {deed.impactNote}</p>
                    )}
                    <div className="row wrap">
                      {deed.involvedSacrifice && <Pill tone="gold">Sacrifice — 12h pass</Pill>}
                      {deed.helpedCaregiver && (
                        <Pill tone="good">
                          Helped {caregiver?.displayName ?? 'the caregiver'}
                        </Pill>
                      )}
                      <Pill>Nominated by {memberName(deed.nominatedBy)}</Pill>
                      <Pill>{formatWhen(deed.createdAt)}</Pill>
                    </div>
                  </div>
                </div>
                <div className="row" style={{ marginTop: 12 }}>
                  <button
                    className="good grow"
                    onClick={() => void onApproveDeed(deed.id)}
                    disabled={busyId === deed.id}
                  >
                    Confirm
                  </button>
                  <button
                    className="bad"
                    onClick={() => void onRejectDeed(deed.id)}
                    disabled={busyId === deed.id}
                  >
                    No
                  </button>
                </div>
                {deed.nominatedBy === member?.id && !settings.allowSelfConfirm && (
                  <p className="muted" style={{ marginTop: 8 }}>
                    You nominated this, so the other parent needs to confirm it. Turn on
                    self-confirm in Settings if you're on your own.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <h2>
        Chores waiting{' '}
        {pendingCompletions.length > 0 && <Pill>{pendingCompletions.length}</Pill>}
      </h2>
      {pendingCompletions.length === 0 ? (
        <Empty>All clear.</Empty>
      ) : (
        <div className="stack">
          {pendingCompletions.map((completion) => {
            const chore = chores.find((c) => c.id === completion.choreId);
            const child = avatarFor(completion.childId);
            return (
              <div className="card tight" key={completion.id}>
                <div className="row">
                  {child && <Avatar member={child} />}
                  <div className="grow">
                    <h3>{chore?.title ?? 'Deleted chore'}</h3>
                    <div className="row wrap">
                      <Pill>{memberName(completion.childId)}</Pill>
                      {chore?.isBaseline ? (
                        <Pill tone="warn">Expected — no minutes</Pill>
                      ) : (
                        <Pill tone="good">+{chore?.minutes ?? 0} min</Pill>
                      )}
                      <Pill>{formatWhen(completion.claimedAt)}</Pill>
                    </div>
                    {completion.note && <p className="muted">{completion.note}</p>}
                  </div>
                </div>
                <div className="row" style={{ marginTop: 10 }}>
                  <button
                    className="good grow"
                    onClick={() => void onApproveChore(completion.id)}
                    disabled={busyId === completion.id}
                  >
                    Approve
                  </button>
                  <button
                    className="bad"
                    onClick={() => void onRejectChore(completion.id)}
                    disabled={busyId === completion.id}
                  >
                    Send back
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
