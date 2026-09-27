/**
 * Firestore read/write layer.
 *
 * All the decision-making lives in src/domain. This file only moves data and
 * runs the transactions that must be atomic, so a chore approval can never
 * credit minutes twice or credit none at all.
 */

import {
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';
import { getDb } from '../firebase/client';
import { paths } from './paths';
import {
  toChore,
  toCompletion,
  toDeed,
  toGrant,
  toLedgerEntry,
  toMember,
  toChildPolicy,
  toPass,
  toPrize,
  toPrizeUnlock,
  toSettings,
} from './mappers';
import {
  awardForChoreApproval,
  awardForDeedApproval,
  canApproveDeed,
  computeBalance,
  currentStreakDays,
  evaluateCashout,
  evaluateChoreClaim,
  isPassUsable,
  passExpiryFrom,
} from '../domain/economy';
import { choreEntry, deedEntry, grantEntry, manualEntry } from '../domain/entries';
import type { NewLedgerEntry } from '../domain/entries';
import { childHint, prizesUnlockedAt, unlockId } from '../domain/prizes';
import type { HintBand } from '../domain/prizes';
import type {
  Balance,
  ChildMetrics,
  ChildPolicy,
  Chore,
  EffectivePolicy,
  Completion,
  Deed,
  Grant,
  HouseholdSettings,
  LedgerEntry,
  Member,
  Pass,
  Prize,
  PrizeUnlock,
} from '../domain/types';

export type Unsubscribe = () => void;

/* ------------------------------------------------------------------ reads */

/**
 * Child-scoped collections take an optional childId. Kids MUST pass their own
 * id: the security rules only allow a child to read rows that are theirs, and
 * an unfiltered listen would simply be denied. Parents pass null to see all.
 */
function scoped(base: ReturnType<typeof paths.completions>, childId: string | null) {
  return childId ? query(base, where('childId', '==', childId)) : base;
}

export function watchMembers(hid: string, cb: (members: Member[]) => void): Unsubscribe {
  return onSnapshot(paths.members(getDb(), hid), (snap) => {
    cb(snap.docs.map((d) => toMember(d.data(), d.id)));
  });
}

export function watchChores(hid: string, cb: (chores: Chore[]) => void): Unsubscribe {
  return onSnapshot(paths.chores(getDb(), hid), (snap) => {
    const chores = snap.docs.map((d) => toChore(d.data(), d.id));
    chores.sort((a, b) => a.title.localeCompare(b.title));
    cb(chores);
  });
}

export function watchCompletions(
  hid: string,
  childId: string | null,
  cb: (completions: Completion[]) => void,
): Unsubscribe {
  return onSnapshot(scoped(paths.completions(getDb(), hid), childId), (snap) => {
    const rows = snap.docs.map((d) => toCompletion(d.data(), d.id));
    rows.sort((a, b) => b.claimedAt - a.claimedAt);
    cb(rows);
  });
}

export function watchDeeds(
  hid: string,
  childId: string | null,
  cb: (deeds: Deed[]) => void,
): Unsubscribe {
  return onSnapshot(scoped(paths.deeds(getDb(), hid), childId), (snap) => {
    const rows = snap.docs.map((d) => toDeed(d.data(), d.id));
    rows.sort((a, b) => b.createdAt - a.createdAt);
    cb(rows);
  });
}

export function watchPasses(
  hid: string,
  childId: string | null,
  cb: (passes: Pass[]) => void,
): Unsubscribe {
  return onSnapshot(scoped(paths.passes(getDb(), hid), childId), (snap) => {
    const rows = snap.docs.map((d) => toPass(d.data(), d.id));
    rows.sort((a, b) => b.issuedAt - a.issuedAt);
    cb(rows);
  });
}

export function watchLedger(
  hid: string,
  childId: string | null,
  cb: (entries: LedgerEntry[]) => void,
): Unsubscribe {
  const base = paths.ledger(getDb(), hid);
  const q = childId
    ? query(base, where('childId', '==', childId), orderBy('createdAt', 'desc'))
    : query(base, orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => toLedgerEntry(d.data(), d.id))));
}

export function watchGrants(
  hid: string,
  childId: string | null,
  cb: (grants: Grant[]) => void,
): Unsubscribe {
  return onSnapshot(scoped(paths.grants(getDb(), hid), childId), (snap) => {
    const rows = snap.docs.map((d) => toGrant(d.data(), d.id));
    rows.sort((a, b) => b.requestedAt - a.requestedAt);
    cb(rows);
  });
}

/** Parent-only. Security rules deny a child any read on this collection. */
export function watchPrizes(hid: string, cb: (prizes: Prize[]) => void): Unsubscribe {
  return onSnapshot(paths.prizes(getDb(), hid), (snap) => {
    const rows = snap.docs.map((d) => toPrize(d.data(), d.id));
    rows.sort((a, b) => a.threshold - b.threshold);
    cb(rows);
  });
}

/**
 * Unlocks a child is allowed to see - but only their own, and only the fact
 * that one exists. The prize title lives in the prizes collection, which the
 * rules keep out of reach, so the hint stays vague until a parent reveals it.
 */
export function watchPrizeUnlocks(
  hid: string,
  childId: string | null,
  cb: (unlocks: PrizeUnlock[]) => void,
): Unsubscribe {
  const base = paths.prizeUnlocks(getDb(), hid);
  const q = childId ? query(base, where('childId', '==', childId)) : base;
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => toPrizeUnlock(d.data(), d.id)));
  });
}

export function watchSettings(hid: string, cb: (s: HouseholdSettings) => void): Unsubscribe {
  return onSnapshot(paths.settings(getDb(), hid), (snap) => {
    cb(toSettings(snap.data()));
  });
}

/* --------------------------------------------------------------- mutations */

/** Thrown when the domain layer refuses an action. Carries a reason code. */
export class DomainError extends Error {
  constructor(
    message: string,
    readonly reason: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export async function claimChore(params: {
  householdId: string;
  chore: Chore;
  childId: string;
  completions: Completion[];
  ledger: LedgerEntry[];
  policy: EffectivePolicy;
  note?: string;
}): Promise<void> {
  const { householdId, chore, childId, completions, ledger, policy, note } = params;

  const eligibility = evaluateChoreClaim({
    chore,
    childId,
    completions,
    ledger,
    policy,
    now: Date.now(),
  });
  if (!eligibility.allowed) {
    throw new DomainError('That chore is not claimable right now.', eligibility.reason ?? 'blocked');
  }

  await addDoc(paths.completions(getDb(), householdId), {
    choreId: chore.id,
    childId,
    claimedAt: serverTimestamp(),
    status: 'pending',
    ...(note ? { note } : {}),
  });
}

/**
 * Approve a chore claim: stamp the completion, append the ledger line and bump
 * the cached totals in one transaction. Either all three land or none do.
 */
export async function approveCompletion(params: {
  householdId: string;
  completion: Completion;
  chore: Chore;
  ledger: LedgerEntry[];
  completions: Completion[];
  policy: EffectivePolicy;
  approverId: string;
}): Promise<Prize[]> {
  const { householdId, completion, chore, ledger, completions, policy, approverId } =
    params;
  const db = getDb();
  const now = Date.now();

  const award = awardForChoreApproval({
    chore,
    childId: completion.childId,
    ledger,
    completions,
    policy,
    now,
  });

  const entry = choreEntry({
    chore,
    childId: completion.childId,
    completionId: completion.id,
    award,
    approvedBy: approverId,
    now,
  });

  await runTransaction(db, async (tx) => {
    const completionRef = paths.completion(db, householdId, completion.id);
    const fresh = await tx.get(completionRef);
    if (!fresh.exists()) throw new DomainError('That claim no longer exists.', 'missing');
    if (fresh.data().status !== 'pending') {
      throw new DomainError('Someone already reviewed that claim.', 'not-pending');
    }

    const statRef = paths.stat(db, householdId, completion.childId);
    const statSnap = await tx.get(statRef);
    const prev = statSnap.data();

    tx.update(completionRef, {
      status: 'approved',
      reviewedBy: approverId,
      reviewedAt: serverTimestamp(),
      minutesAwarded: award.minutes,
      cappedByDailyLimit: award.capped,
      streakBonusMinutes: award.streakBonus,
    });

    tx.set(doc(paths.ledger(db, householdId)), {
      ...entry,
      createdAt: serverTimestamp(),
    });

    tx.set(
      statRef,
      {
        childId: completion.childId,
        availableMinutes: (prev?.availableMinutes ?? 0) + entry.deltaMinutes,
        lifetimeMinutes: (prev?.lifetimeMinutes ?? 0) + Math.max(0, entry.deltaMinutes),
        empathyPoints: prev?.empathyPoints ?? 0,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  });

  // A chore approval can complete a streak, and a streak can unlock a prize.
  // The completion we just approved is not in the local `completions` array
  // yet, so count it in by hand.
  const streakDays = currentStreakDays({
    completions: [
      ...completions.filter((c) => c.id !== completion.id),
      { ...completion, status: 'approved', reviewedAt: now },
    ],
    childId: completion.childId,
    now,
  });

  return syncPrizeUnlocks({ householdId, childId: completion.childId, streakDays });
}

export async function rejectCompletion(params: {
  householdId: string;
  completionId: string;
  approverId: string;
  reason: string;
}): Promise<void> {
  const { householdId, completionId, approverId, reason } = params;
  await updateDoc(paths.completion(getDb(), householdId, completionId), {
    status: 'rejected',
    reviewedBy: approverId,
    reviewedAt: serverTimestamp(),
    rejectionReason: reason,
  });
}

/**
 * Nominate a good deed. Only an adult may call this, which the Firestore rules
 * enforce independently of the UI: a child cannot claim their own kindness.
 */
export async function nominateDeed(params: {
  householdId: string;
  childId: string;
  description: string;
  /** What it did for the other person, in their words. The child reads this. */
  impactNote?: string;
  nominatedBy: string;
  helpedCaregiver: boolean;
  involvedSacrifice: boolean;
}): Promise<void> {
  const { householdId, ...rest } = params;
  if (!rest.description.trim()) {
    throw new DomainError('Describe what they did.', 'empty-description');
  }
  await addDoc(paths.deeds(getDb(), householdId), {
    ...rest,
    description: rest.description.trim(),
    status: 'pending',
    createdAt: serverTimestamp(),
  });
}

/**
 * Confirm a nominated deed. Credits empathy and minutes, and issues the
 * 12-hour pass when the deed involved real sacrifice.
 *
 * Returns any prizes the new empathy total unlocked, so the parent screen can
 * tell the adult - never the child - that a reveal is waiting.
 */
export async function approveDeed(params: {
  householdId: string;
  deed: Deed;
  policy: EffectivePolicy;
  approver: Member;
  caregiverName?: string;
  /** Passed through so a deed approval can also complete a streak ladder. */
  streakDays?: number;
}): Promise<Prize[]> {
  const { householdId, deed, policy, approver, caregiverName, streakDays = 0 } = params;
  const db = getDb();
  const now = Date.now();

  const check = canApproveDeed({
    deed,
    approverId: approver.id,
    approverRole: approver.role,
    settings: policy,
  });
  if (!check.allowed) {
    const messages: Record<string, string> = {
      'not-pending': 'That deed has already been reviewed.',
      'self-confirm-disabled':
        'You nominated this one, so the other parent needs to confirm it. ' +
        'Turn on self-confirm in Settings if you are on your own.',
      'approver-not-parent': 'Only a parent can confirm a deed.',
    };
    throw new DomainError(messages[check.reason ?? ''] ?? 'Cannot confirm.', check.reason ?? 'blocked');
  }

  const award = awardForDeedApproval({ deed, policy });
  const entry = deedEntry({ deed, award, approvedBy: approver.id, caregiverName, now });

  const passRef = award.issuePass ? doc(paths.passes(db, householdId)) : null;

  await runTransaction(db, async (tx) => {
    const deedRef = paths.deed(db, householdId, deed.id);
    const fresh = await tx.get(deedRef);
    if (!fresh.exists()) throw new DomainError('That deed no longer exists.', 'missing');
    if (fresh.data().status !== 'pending') {
      throw new DomainError('Someone already reviewed that deed.', 'not-pending');
    }

    const statRef = paths.stat(db, householdId, deed.childId);
    const statSnap = await tx.get(statRef);
    const prev = statSnap.data();

    tx.update(deedRef, {
      status: 'approved',
      approvedBy: approver.id,
      approvedAt: serverTimestamp(),
      empathyAwarded: award.empathy,
      minutesAwarded: award.minutes,
      ...(passRef ? { passIssuedId: passRef.id } : {}),
    });

    tx.set(doc(paths.ledger(db, householdId)), {
      ...entry,
      createdAt: serverTimestamp(),
    });

    if (passRef) {
      tx.set(passRef, {
        childId: deed.childId,
        hours: award.passHours,
        reason: deed.description,
        status: 'issued',
        issuedBy: approver.id,
        issuedAt: serverTimestamp(),
        expiresAt: passExpiryFrom(now, policy),
      });
    }

    tx.set(
      statRef,
      {
        childId: deed.childId,
        availableMinutes: (prev?.availableMinutes ?? 0) + entry.deltaMinutes,
        lifetimeMinutes: (prev?.lifetimeMinutes ?? 0) + Math.max(0, entry.deltaMinutes),
        empathyPoints: (prev?.empathyPoints ?? 0) + entry.deltaEmpathy,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  });

  return syncPrizeUnlocks({ householdId, childId: deed.childId, streakDays });
}

export async function rejectDeed(params: {
  householdId: string;
  deedId: string;
  approverId: string;
  reason: string;
}): Promise<void> {
  const { householdId, deedId, approverId, reason } = params;
  await updateDoc(paths.deed(getDb(), householdId, deedId), {
    status: 'rejected',
    approvedBy: approverId,
    approvedAt: serverTimestamp(),
    rejectionReason: reason,
  });
}

/**
 * Check the child's empathy total against the hidden prize thresholds and
 * record anything newly crossed.
 *
 * Firestore client transactions cannot run queries, so the reads happen first
 * and each unlock is then written under its own transaction against a
 * deterministic document id. That makes the write idempotent even if both
 * parents approve deeds at the same moment.
 */
export async function syncPrizeUnlocks(params: {
  householdId: string;
  childId: string;
  /**
   * Streak days cannot be derived from the stats cache, so the caller passes
   * the value it already has on screen. Omitted means zero, which only ever
   * delays a streak unlock to the next approval - it never awards one wrongly.
   */
  streakDays?: number;
}): Promise<Prize[]> {
  const { householdId, childId, streakDays = 0 } = params;
  const db = getDb();

  const statSnap = await getDoc(paths.stat(db, householdId, childId));
  const stat = statSnap.data();
  const metrics: ChildMetrics = {
    empathy: Number(stat?.empathyPoints ?? 0),
    lifetimeMinutes: Number(stat?.lifetimeMinutes ?? 0),
    streakDays,
  };

  const [prizeSnap, unlockSnap] = await Promise.all([
    getDocs(paths.prizes(db, householdId)),
    getDocs(query(paths.prizeUnlocks(db, householdId), where('childId', '==', childId))),
  ]);
  const prizes = prizeSnap.docs.map((d) => toPrize(d.data(), d.id));
  const unlocks = unlockSnap.docs.map((d) => toPrizeUnlock(d.data(), d.id));

  const candidates = prizesUnlockedAt({ childId, metrics, prizes, unlocks });
  const unlocked: Prize[] = [];

  for (const prize of candidates) {
    const ref = paths.prizeUnlock(db, householdId, unlockId(prize.id, childId));
    const claimed = await runTransaction(db, async (tx) => {
      const fresh = await tx.get(ref);
      if (fresh.exists()) return false;
      tx.set(ref, {
        prizeId: prize.id,
        childId,
        unlockedAt: serverTimestamp(),
      });
      return true;
    });
    if (claimed) unlocked.push(prize);
  }

  // The band has to be recomputed after the unlocks land, so a fresh unlock
  // shows the child 'go find a parent' rather than yesterday's band.
  await refreshHintBand({ householdId, childId, metrics });

  return unlocked;
}

/** Record that a parent has actually told the child and handed the prize over. */
export async function markPrizeRevealed(params: {
  householdId: string;
  prizeId: string;
  childId: string;
}): Promise<void> {
  const { householdId, prizeId, childId } = params;
  await updateDoc(paths.prizeUnlock(getDb(), householdId, unlockId(prizeId, childId)), {
    revealedAt: serverTimestamp(),
  });
}

/* ------------------------------------------------- the Family Link handoff */

/**
 * A child asking to cash in minutes. Nothing is debited yet - Family Link has
 * no API, so the minutes only leave the ledger once a parent confirms they
 * actually added the time on the real device.
 */
export async function requestGrant(params: {
  householdId: string;
  childId: string;
  minutes: number;
  balance: Balance;
  policy: EffectivePolicy;
  chores: Chore[];
  completions: Completion[];
  requestedBy: string;
}): Promise<void> {
  const { householdId, childId, minutes, balance, policy, chores, completions, requestedBy } =
    params;

  const check = evaluateCashout({
    minutes,
    balance,
    policy,
    chores,
    completions,
    now: Date.now(),
  });
  if (!check.allowed) {
    if (check.reason === 'baseline-outstanding') {
      const list = (check.outstanding ?? []).map((c) => c.title).join(', ');
      throw new DomainError(
        `Your minutes are safe in the bank, but you cannot spend them until ` +
          `your own jobs are done: ${list}.`,
        'baseline-outstanding',
      );
    }
    const messages: Record<string, string> = {
      'non-positive': 'Ask for at least one minute.',
      'insufficient-balance': `You only have ${balance.availableMinutes} minutes banked.`,
    };
    throw new DomainError(
      messages[check.reason ?? ''] ?? 'Cannot request that.',
      check.reason ?? 'blocked',
    );
  }

  await addDoc(paths.grants(getDb(), householdId), {
    childId,
    minutes,
    status: 'requested',
    requestedAt: serverTimestamp(),
    requestedBy,
  });
}

/**
 * The parent has added the bonus time inside Family Link and is confirming it.
 * This is the moment the minutes are spent.
 */
export async function settleGrant(params: {
  householdId: string;
  grant: Grant;
  settledBy: string;
}): Promise<void> {
  const { householdId, grant, settledBy } = params;
  const db = getDb();
  const now = Date.now();

  const entry = grantEntry({
    childId: grant.childId,
    grantId: grant.id,
    minutes: grant.minutes,
    settledBy,
    now,
  });

  await runTransaction(db, async (tx) => {
    const grantRef = paths.grant(db, householdId, grant.id);
    const fresh = await tx.get(grantRef);
    if (!fresh.exists()) throw new DomainError('That request no longer exists.', 'missing');
    if (fresh.data().status !== 'requested') {
      throw new DomainError('That request was already settled.', 'not-requested');
    }

    const statRef = paths.stat(db, householdId, grant.childId);
    const statSnap = await tx.get(statRef);
    const prev = statSnap.data();
    const available = Number(prev?.availableMinutes ?? 0);
    if (available < grant.minutes) {
      throw new DomainError(
        `Only ${available} minutes are banked now, so this request cannot be paid.`,
        'insufficient-balance',
      );
    }

    tx.update(grantRef, {
      status: 'granted',
      settledBy,
      settledAt: serverTimestamp(),
    });

    tx.set(doc(paths.ledger(db, householdId)), {
      ...entry,
      createdAt: serverTimestamp(),
    });

    tx.set(
      statRef,
      {
        availableMinutes: available + entry.deltaMinutes,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  });
}

export async function cancelGrant(params: {
  householdId: string;
  grantId: string;
  settledBy: string;
  reason: string;
}): Promise<void> {
  const { householdId, grantId, settledBy, reason } = params;
  await updateDoc(paths.grant(getDb(), householdId, grantId), {
    status: 'cancelled',
    settledBy,
    settledAt: serverTimestamp(),
    cancelReason: reason,
  });
}

export async function redeemPass(params: {
  householdId: string;
  pass: Pass;
}): Promise<void> {
  const { householdId, pass } = params;
  if (!isPassUsable(pass, Date.now())) {
    throw new DomainError('That pass is no longer usable.', 'unusable');
  }
  await updateDoc(paths.pass(getDb(), householdId, pass.id), {
    status: 'redeemed',
    redeemedAt: serverTimestamp(),
  });
}

/** Sweep passes whose expiry has come and gone. Cheap to run on parent load. */
export async function expireStalePasses(householdId: string): Promise<number> {
  const db = getDb();
  const snap = await getDocs(query(paths.passes(db, householdId), where('status', '==', 'issued')));
  const now = Date.now();
  const stale = snap.docs.filter((d) => toPass(d.data(), d.id).expiresAt <= now);
  if (stale.length === 0) return 0;

  const batch = writeBatch(db);
  for (const d of stale) batch.update(d.ref, { status: 'expired' });
  await batch.commit();
  return stale.length;
}

/* -------------------------------------------------------- admin and config */

export async function saveChore(params: {
  householdId: string;
  chore: Omit<Chore, 'id' | 'createdAt'> & { id?: string };
}): Promise<void> {
  const { householdId, chore } = params;
  const db = getDb();
  const { id, ...fields } = chore;

  if (id) {
    await updateDoc(paths.chore(db, householdId, id), { ...fields });
  } else {
    await addDoc(paths.chores(db, householdId), { ...fields, createdAt: serverTimestamp() });
  }
}

export async function deleteChore(householdId: string, choreId: string): Promise<void> {
  await deleteDoc(paths.chore(getDb(), householdId, choreId));
}

export async function savePrize(params: {
  householdId: string;
  prize: Omit<Prize, 'id' | 'createdAt'> & { id?: string };
}): Promise<void> {
  const { householdId, prize } = params;
  const db = getDb();
  const { id, ...fields } = prize;

  if (id) {
    await updateDoc(paths.prize(db, householdId, id), { ...fields });
  } else {
    await addDoc(paths.prizes(db, householdId), { ...fields, createdAt: serverTimestamp() });
  }
}

export async function deletePrize(householdId: string, prizeId: string): Promise<void> {
  await deleteDoc(paths.prize(getDb(), householdId, prizeId));
}

export async function saveSettings(
  householdId: string,
  settings: HouseholdSettings,
): Promise<void> {
  await setDoc(paths.settings(getDb(), householdId), { ...settings }, { merge: true });
}

export async function adjustBalance(params: {
  householdId: string;
  childId: string;
  deltaMinutes: number;
  deltaEmpathy: number;
  note: string;
  author: Member;
}): Promise<Prize[]> {
  const { householdId, childId, deltaMinutes, deltaEmpathy, note, author } = params;
  const db = getDb();

  const entry: NewLedgerEntry = manualEntry({
    childId,
    deltaMinutes,
    deltaEmpathy,
    note,
    author,
    now: Date.now(),
  });

  await runTransaction(db, async (tx) => {
    const statRef = paths.stat(db, householdId, childId);
    const statSnap = await tx.get(statRef);
    const prev = statSnap.data();

    tx.set(doc(paths.ledger(db, householdId)), { ...entry, createdAt: serverTimestamp() });
    tx.set(
      statRef,
      {
        childId,
        availableMinutes: Math.max(0, (prev?.availableMinutes ?? 0) + deltaMinutes),
        lifetimeMinutes: (prev?.lifetimeMinutes ?? 0) + Math.max(0, deltaMinutes),
        empathyPoints: Math.max(0, (prev?.empathyPoints ?? 0) + deltaEmpathy),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  });

  return deltaEmpathy > 0 ? syncPrizeUnlocks({ householdId, childId }) : [];
}

/** Everything a prize ladder can watch, for one child, right now. */
export function metricsFor(params: {
  childId: string;
  ledger: LedgerEntry[];
  completions: Completion[];
  now?: number;
}): ChildMetrics {
  const { childId, ledger, completions, now = Date.now() } = params;
  const balance = computeBalance(childId, ledger);
  return {
    empathy: balance.empathyPoints,
    lifetimeMinutes: balance.lifetimeMinutes,
    streakDays: currentStreakDays({ completions, childId, now }),
  };
}

/**
 * Rebuild the cached totals from the ledger. The ledger is the truth, so this
 * is the repair tool if a cache ever drifts - for instance if a transaction
 * was interrupted mid-flight.
 */
export async function recomputeStats(householdId: string, childId: string): Promise<Balance> {
  const db = getDb();
  const snap = await getDocs(paths.ledger(db, householdId));
  const entries = snap.docs.map((d) => toLedgerEntry(d.data(), d.id));
  const balance = computeBalance(childId, entries);

  await setDoc(
    paths.stat(db, householdId, childId),
    {
      childId,
      availableMinutes: balance.availableMinutes,
      lifetimeMinutes: balance.lifetimeMinutes,
      empathyPoints: balance.empathyPoints,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  return balance;
}

export function watchChildPolicies(
  hid: string,
  cb: (policies: ChildPolicy[]) => void,
): Unsubscribe {
  return onSnapshot(paths.childPolicies(getDb(), hid), (snap) => {
    cb(snap.docs.map((d) => toChildPolicy(d.data(), d.id)));
  });
}

export async function saveChildPolicy(
  householdId: string,
  policy: ChildPolicy,
): Promise<void> {
  const { childId, ...fields } = policy;
  await setDoc(paths.childPolicy(getDb(), householdId, childId), { ...fields }, { merge: true });
}

/**
 * One child's own policy. A child cannot list the whole collection - the rules
 * allow a read only on their own document, and Firestore refuses a query it
 * cannot prove is within that - so the child side of the app listens here.
 */
export function watchChildPolicy(
  hid: string,
  childId: string,
  cb: (policy: ChildPolicy | null) => void,
): Unsubscribe {
  return onSnapshot(paths.childPolicy(getDb(), hid, childId), (snap) => {
    cb(snap.exists() ? toChildPolicy(snap.data(), snap.id) : null);
  });
}

export interface ChildStats {
  availableMinutes: number;
  lifetimeMinutes: number;
  empathyPoints: number;
  /**
   * The child's hint band, as a single word. Computed on a parent's approval,
   * because prize thresholds and titles never reach a child's device and so a
   * child cannot work their own band out. See `hintMessage()`.
   */
  hintBand: HintBand;
}

const EMPTY_STATS: ChildStats = {
  availableMinutes: 0,
  lifetimeMinutes: 0,
  empathyPoints: 0,
  hintBand: 'none',
};

function toStats(data: DocumentData | undefined): ChildStats {
  if (!data) return { ...EMPTY_STATS };
  const band = data.hintBand;
  return {
    availableMinutes: Number(data.availableMinutes ?? 0),
    lifetimeMinutes: Number(data.lifetimeMinutes ?? 0),
    empathyPoints: Number(data.empathyPoints ?? 0),
    hintBand:
      band === 'stirring' || band === 'close' || band === 'imminent' || band === 'unlocked'
        ? band
        : 'none',
  };
}

export function watchStats(
  hid: string,
  childId: string,
  cb: (stats: ChildStats) => void,
): Unsubscribe {
  return onSnapshot(paths.stat(getDb(), hid, childId), (snap) => {
    cb(toStats(snap.data()));
  });
}

/**
 * Recompute a child's hint band and store it on their stats document.
 *
 * Runs as a parent, because reading prizes requires it. This is the only route
 * by which any prize information reaches a child, and all that crosses is one
 * word out of five.
 */
export async function refreshHintBand(params: {
  householdId: string;
  childId: string;
  metrics: ChildMetrics;
}): Promise<HintBand> {
  const { householdId, childId, metrics } = params;
  const db = getDb();

  const [prizeSnap, unlockSnap] = await Promise.all([
    getDocs(paths.prizes(db, householdId)),
    getDocs(query(paths.prizeUnlocks(db, householdId), where('childId', '==', childId))),
  ]);

  const { band } = childHint({
    childId,
    metrics,
    prizes: prizeSnap.docs.map((d) => toPrize(d.data(), d.id)),
    unlocks: unlockSnap.docs.map((d) => toPrizeUnlock(d.data(), d.id)),
  });

  await setDoc(paths.stat(db, householdId, childId), { hintBand: band }, { merge: true });
  return band;
}
