/**
 * The economy engine. Pure functions only - no Firebase, no React, no clock
 * reads except the ones passed in. Everything here is unit tested because a
 * bug in this file means a kid does the work and does not get paid, which is
 * the one failure this app cannot afford.
 */

import type {
  Balance,
  Chore,
  ChildPolicy,
  Completion,
  Deed,
  EffectivePolicy,
  HouseholdSettings,
  LedgerEntry,
} from './types';

/** Start and end of the local calendar day containing `timestamp`. */
export function localDayRange(timestamp: number): { start: number; end: number } {
  const d = new Date(timestamp);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0);
  return { start: start.getTime(), end: end.getTime() };
}

/**
 * Derive a child's balance from the ledger. The ledger is append-only, so
 * this is always the truth even if a cached stats document drifts.
 */
export function computeBalance(childId: string, entries: LedgerEntry[]): Balance {
  let availableMinutes = 0;
  let lifetimeMinutes = 0;
  let empathyPoints = 0;

  for (const entry of entries) {
    if (entry.childId !== childId) continue;
    availableMinutes += entry.deltaMinutes;
    if (entry.deltaMinutes > 0) lifetimeMinutes += entry.deltaMinutes;
    empathyPoints += entry.deltaEmpathy;
  }

  return {
    childId,
    // A negative balance would mean we handed over more than was earned.
    // Clamp so the UI can never show a kid owing us time.
    availableMinutes: Math.max(0, availableMinutes),
    lifetimeMinutes,
    empathyPoints: Math.max(0, empathyPoints),
  };
}

/** Chore minutes already credited to this child during the given day. */
export function choreMinutesCreditedOnDay(
  childId: string,
  entries: LedgerEntry[],
  timestamp: number,
): number {
  const { start, end } = localDayRange(timestamp);
  let total = 0;
  for (const entry of entries) {
    if (entry.childId !== childId) continue;
    if (entry.source !== 'chore') continue;
    if (entry.deltaMinutes <= 0) continue;
    if (entry.createdAt < start || entry.createdAt >= end) continue;
    total += entry.deltaMinutes;
  }
  return total;
}

/**
 * Merge a child's overrides onto the household defaults. Anything the policy
 * leaves undefined falls back, so a new child works sensibly before anyone has
 * tuned a thing for them.
 */
export function effectivePolicy(
  settings: HouseholdSettings,
  policy: ChildPolicy | undefined,
  childId: string,
): EffectivePolicy {
  return {
    ...settings,
    childId,
    label: policy?.label ?? 'Standard track',
    requireBaselineForCashout: policy?.requireBaselineForCashout ?? false,
    streakBonusMinutes: policy?.streakBonusMinutes ?? 0,
    streakBonusAfterDays: policy?.streakBonusAfterDays ?? 0,
    dailyChoreMinuteCap: policy?.dailyChoreMinuteCap ?? settings.dailyChoreMinuteCap,
    caregiverMultiplier: policy?.caregiverMultiplier ?? settings.caregiverMultiplier,
    deedEmpathyPoints: policy?.deedEmpathyPoints ?? settings.deedEmpathyPoints,
    sacrificeEmpathyPoints:
      policy?.sacrificeEmpathyPoints ?? settings.sacrificeEmpathyPoints,
    deedMinutes: policy?.deedMinutes ?? settings.deedMinutes,
  };
}

export type ClaimBlockReason =
  | 'chore-inactive'
  | 'not-assigned'
  | 'already-pending'
  | 'cooldown'
  | 'daily-cap-reached';

export interface ClaimEligibility {
  allowed: boolean;
  reason?: ClaimBlockReason;
  /** When blocked by cooldown, the moment the chore becomes claimable again. */
  availableAt?: number;
}

/**
 * Whether a child may claim a chore right now. Guards against the three ways
 * kids actually game a chore app: claiming someone else's chore, claiming the
 * same chore repeatedly, and stacking claims faster than an adult can review.
 */
export function evaluateChoreClaim(params: {
  chore: Chore;
  childId: string;
  completions: Completion[];
  ledger: LedgerEntry[];
  policy: EffectivePolicy;
  now: number;
}): ClaimEligibility {
  const { chore, childId, completions, ledger, policy, now } = params;

  if (!chore.active) return { allowed: false, reason: 'chore-inactive' };

  if (chore.assignedTo.length > 0 && !chore.assignedTo.includes(childId)) {
    return { allowed: false, reason: 'not-assigned' };
  }

  const mine = completions.filter(
    (c) => c.choreId === chore.id && c.childId === childId,
  );

  if (mine.some((c) => c.status === 'pending')) {
    return { allowed: false, reason: 'already-pending' };
  }

  if (chore.cooldownHours > 0) {
    const cooldownMs = chore.cooldownHours * 60 * 60 * 1000;
    let latestApproval = 0;
    for (const c of mine) {
      if (c.status !== 'approved') continue;
      const at = c.reviewedAt ?? c.claimedAt;
      if (at > latestApproval) latestApproval = at;
    }
    if (latestApproval > 0 && now - latestApproval < cooldownMs) {
      return {
        allowed: false,
        reason: 'cooldown',
        availableAt: latestApproval + cooldownMs,
      };
    }
  }

  // A baseline chore is never blocked by the earning cap. It pays nothing, and
  // for a gated child it is the only route to spending what they already have -
  // locking it out at the cap would be exactly backwards.
  if (!chore.isBaseline) {
    const creditedToday = choreMinutesCreditedOnDay(childId, ledger, now);
    if (creditedToday >= policy.dailyChoreMinuteCap) {
      return { allowed: false, reason: 'daily-cap-reached' };
    }
  }

  return { allowed: true };
}

export interface ChoreAward {
  minutes: number;
  capped: boolean;
  /** Minutes that came from the daily streak rather than the chore itself. */
  streakBonus: number;
  streakDays: number;
  /** True for a baseline chore, which is expected rather than paid. */
  baseline: boolean;
}

/**
 * Minutes to credit when an adult approves a chore claim.
 *
 * Three rules, in order:
 *  - A baseline chore pays nothing. It is expected, and for some kids it gates
 *    cashing out instead.
 *  - A streak bonus rides on top, so ten small days beat one big Saturday.
 *  - The daily cap trims the total rather than rejecting it, so a kid who
 *    over-works still banks something and is told plainly they hit the ceiling.
 */
export function awardForChoreApproval(params: {
  chore: Chore;
  childId: string;
  ledger: LedgerEntry[];
  completions: Completion[];
  policy: EffectivePolicy;
  now: number;
}): ChoreAward {
  const { chore, childId, ledger, completions, policy, now } = params;

  if (chore.isBaseline) {
    return { minutes: 0, capped: false, streakBonus: 0, streakDays: 0, baseline: true };
  }

  const { minutes: streakBonus, streakDays } = streakBonusFor({
    policy,
    completions,
    now,
  });

  const creditedToday = choreMinutesCreditedOnDay(childId, ledger, now);
  const remaining = Math.max(0, policy.dailyChoreMinuteCap - creditedToday);
  const wanted = chore.minutes + streakBonus;
  const minutes = Math.min(wanted, remaining);

  return {
    minutes,
    capped: minutes < wanted,
    // Report only the bonus that actually survived the cap.
    streakBonus: Math.max(0, minutes - Math.min(chore.minutes, minutes)),
    streakDays,
    baseline: false,
  };
}

export interface DeedAward {
  empathy: number;
  minutes: number;
  /** A sacrifice earns the 12-hour pass instead of only minutes. */
  issuePass: boolean;
  passHours: number;
  /** True when the caregiver multiplier was applied. */
  multiplierApplied: boolean;
}

/**
 * Deeds are the only source of empathy points, and helping the primary
 * caregiver is worth a multiple of anything else. That asymmetry is the whole
 * behavioural design: the fastest route to a hidden prize is helping Mom.
 *
 * The daily chore cap deliberately does NOT apply here. Kindness is not
 * rate-limited.
 */
export function awardForDeedApproval(params: {
  deed: Deed;
  policy: EffectivePolicy;
}): DeedAward {
  const { deed, policy: settings } = params;

  const base = deed.involvedSacrifice
    ? settings.sacrificeEmpathyPoints
    : settings.deedEmpathyPoints;

  const multiplierApplied =
    deed.helpedCaregiver && settings.caregiverMultiplier > 1;

  const empathy = multiplierApplied
    ? Math.round(base * settings.caregiverMultiplier)
    : base;

  return {
    empathy,
    minutes: settings.deedMinutes,
    issuePass: deed.involvedSacrifice,
    passHours: settings.passHours,
    multiplierApplied,
  };
}

export type DeedApprovalBlock =
  | 'not-pending'
  | 'self-confirm-disabled'
  | 'approver-not-parent';

export interface DeedApprovalCheck {
  allowed: boolean;
  reason?: DeedApprovalBlock;
}

/**
 * Two adults in the loop by default: whoever nominated a deed is not the one
 * who confirms it. `allowSelfConfirm` exists because one parent is often
 * alone with the kids and a deed should not go unrewarded for that.
 */
export function canApproveDeed(params: {
  deed: Deed;
  approverId: string;
  approverRole: 'parent' | 'child';
  settings: HouseholdSettings;
}): DeedApprovalCheck {
  const { deed, approverId, approverRole, settings } = params;

  if (approverRole !== 'parent') {
    return { allowed: false, reason: 'approver-not-parent' };
  }
  if (deed.status !== 'pending') {
    return { allowed: false, reason: 'not-pending' };
  }
  if (deed.nominatedBy === approverId && !settings.allowSelfConfirm) {
    return { allowed: false, reason: 'self-confirm-disabled' };
  }
  return { allowed: true };
}

/** Whether a grant request is payable from the child's current balance. */
export function canRequestGrant(params: {
  minutes: number;
  balance: Balance;
}): { allowed: boolean; reason?: 'non-positive' | 'insufficient-balance' } {
  if (params.minutes <= 0) return { allowed: false, reason: 'non-positive' };
  if (params.minutes > params.balance.availableMinutes) {
    return { allowed: false, reason: 'insufficient-balance' };
  }
  return { allowed: true };
}

export function passExpiryFrom(issuedAt: number, settings: HouseholdSettings): number {
  return issuedAt + settings.passExpiryDays * 24 * 60 * 60 * 1000;
}

export function isPassUsable(pass: { status: string; expiresAt: number }, now: number): boolean {
  return pass.status === 'issued' && pass.expiresAt > now;
}

/* ------------------------------------------------- baseline and streaks */

export interface BaselineStatus {
  /** Baseline chores this child is responsible for today. */
  required: Chore[];
  /** The ones approved today. */
  done: Chore[];
  /** The ones still outstanding. */
  outstanding: Chore[];
  satisfied: boolean;
}

/**
 * How a child stands on the work that is simply expected of them today.
 *
 * Baseline chores pay nothing on purpose. For a child whose policy gates
 * cashing out, this is what stands between banked minutes and actually
 * spending them - so tidying up after herself stops being a bargaining chip
 * and goes back to being the floor.
 */
export function baselineStatus(params: {
  chores: Chore[];
  completions: Completion[];
  childId: string;
  now: number;
}): BaselineStatus {
  const { chores, completions, childId, now } = params;
  const { start, end } = localDayRange(now);

  const required = chores.filter(
    (c) =>
      c.active &&
      c.isBaseline &&
      (c.assignedTo.length === 0 || c.assignedTo.includes(childId)),
  );

  const approvedTodayChoreIds = new Set(
    completions
      .filter((c) => c.childId === childId && c.status === 'approved')
      .filter((c) => {
        const at = c.reviewedAt ?? c.claimedAt;
        return at >= start && at < end;
      })
      .map((c) => c.choreId),
  );

  const done = required.filter((c) => approvedTodayChoreIds.has(c.id));
  const outstanding = required.filter((c) => !approvedTodayChoreIds.has(c.id));

  return { required, done, outstanding, satisfied: outstanding.length === 0 };
}

/**
 * Consecutive calendar days, counting back from today, on which this child had
 * at least one chore claim approved. Today counts only if something has been
 * approved today, so the number never flatters them.
 */
export function currentStreakDays(params: {
  completions: Completion[];
  childId: string;
  now: number;
}): number {
  const { completions, childId, now } = params;

  const days = new Set<number>();
  for (const c of completions) {
    if (c.childId !== childId || c.status !== 'approved') continue;
    days.add(localDayRange(c.reviewedAt ?? c.claimedAt).start);
  }

  let streak = 0;
  let cursor = localDayRange(now).start;
  while (days.has(cursor)) {
    streak += 1;
    // Step back a day through a real Date so DST shifts cannot break the walk.
    const prev = new Date(cursor);
    prev.setDate(prev.getDate() - 1);
    cursor = localDayRange(prev.getTime()).start;
  }
  return streak;
}

export interface CashoutCheck {
  allowed: boolean;
  reason?: 'non-positive' | 'insufficient-balance' | 'baseline-outstanding';
  outstanding?: Chore[];
}

/**
 * Whether a child may cash minutes out right now. This is the gate: banked
 * minutes are real, but the window does not open while their own mess is still
 * on the floor and their policy says it must be clear.
 */
export function evaluateCashout(params: {
  minutes: number;
  balance: Balance;
  policy: EffectivePolicy;
  chores: Chore[];
  completions: Completion[];
  now: number;
}): CashoutCheck {
  const { minutes, balance, policy, chores, completions, now } = params;

  const base = canRequestGrant({ minutes, balance });
  if (!base.allowed) return { allowed: false, reason: base.reason };

  if (policy.requireBaselineForCashout) {
    const status = baselineStatus({
      chores,
      completions,
      childId: policy.childId,
      now,
    });
    if (!status.satisfied) {
      return {
        allowed: false,
        reason: 'baseline-outstanding',
        outstanding: status.outstanding,
      };
    }
  }

  return { allowed: true };
}

/**
 * Streak bonus to add on top of a chore award. Paid on the day the streak
 * reaches the threshold and every day it holds after that, which is what makes
 * a run of small daily jobs worth more than one big Saturday push.
 *
 * The daily cap still applies to the total, so this cannot be used to blow
 * past it.
 */
export function streakBonusFor(params: {
  policy: EffectivePolicy;
  completions: Completion[];
  now: number;
}): { minutes: number; streakDays: number } {
  const { policy, completions, now } = params;

  if (policy.streakBonusMinutes <= 0 || policy.streakBonusAfterDays <= 0) {
    return { minutes: 0, streakDays: 0 };
  }

  const streakDays = currentStreakDays({
    completions,
    childId: policy.childId,
    now,
  });

  return {
    minutes: streakDays >= policy.streakBonusAfterDays ? policy.streakBonusMinutes : 0,
    streakDays,
  };
}
