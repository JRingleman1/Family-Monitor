/**
 * Domain types for the family screen-time economy.
 *
 * Two separate currencies on purpose:
 *
 *   minutes  - spendable screen time. Earned mostly from chores. This is the
 *              day-to-day allowance and it is deliberately easy to grind.
 *   empathy  - the only currency that moves a kid toward a hidden prize.
 *              Earned ONLY from adult-nominated good deeds and sacrifice
 *              passes, never from chores. Chores cannot buy a prize.
 *
 * Keeping them separate is what stops "empty the dishwasher twelve times"
 * from unlocking a reward meant for kindness.
 */

export type Role = 'parent' | 'child';

export interface Member {
  id: string;
  householdId: string;
  displayName: string;
  role: Role;
  /** Synthetic sign-in address; kids never need a real email account. */
  loginEmail: string;
  avatarColor: string;
  /** Marks the adult whose help carries the empathy multiplier. */
  isPrimaryCaregiver?: boolean;
  createdAt: number;
}

export type ChoreKind = 'recurring' | 'oneoff';

export interface Chore {
  id: string;
  title: string;
  description?: string;
  /** Screen-time minutes credited when an adult approves the claim. */
  minutes: number;
  kind: ChoreKind;
  /** Empty array means any child in the household may claim it. */
  assignedTo: string[];
  /** Minimum gap between two approved claims of this chore by one kid. */
  cooldownHours: number;
  /**
   * Expected of them, not a favour to the household: picking up their own
   * wrappers, their own plate, their own floor. Baseline chores pay nothing.
   * Instead they gate cashing out, for any child whose policy turns that on.
   *
   * This is the whole answer to a kid who negotiates with her own basic
   * decency: withholding it stops being profitable, because the reward she
   * wants is behind it rather than paid for it.
   */
  isBaseline: boolean;
  active: boolean;
  createdAt: number;
}

export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export interface Completion {
  id: string;
  choreId: string;
  childId: string;
  claimedAt: number;
  status: ReviewStatus;
  note?: string;
  reviewedBy?: string;
  reviewedAt?: number;
  /** Set on approval. May differ from the chore's minutes if a cap trimmed it. */
  minutesAwarded?: number;
  /** True when the daily cap reduced the award below the chore's full value. */
  cappedByDailyLimit?: boolean;
  rejectionReason?: string;
}

/**
 * A selfless act, nominated by an adult. A child can never create one of
 * these - that is the whole point, and it is enforced in Firestore rules as
 * well as here.
 */
export interface Deed {
  id: string;
  childId: string;
  description: string;
  nominatedBy: string;
  /** Deed specifically helped the primary caregiver. Earns the multiplier. */
  helpedCaregiver: boolean;
  /**
   * The kid gave up something real for someone else. Awards a 12-hour pass
   * on approval instead of plain minutes.
   */
  involvedSacrifice: boolean;
  /**
   * What it actually did for the other person, in the nominator's words - "I
   * got to sit down for twenty minutes." The child reads this on approval.
   *
   * This field is the point of the whole empathy track. Points fade; being
   * told plainly that you changed someone's afternoon is what a kid who
   * struggles to see past herself is missing.
   */
  impactNote?: string;
  status: ReviewStatus;
  createdAt: number;
  approvedBy?: string;
  approvedAt?: number;
  empathyAwarded?: number;
  minutesAwarded?: number;
  passIssuedId?: string;
  rejectionReason?: string;
}

export type PassStatus = 'issued' | 'redeemed' | 'expired';

/** The rare reward: a block of hours that ignores the normal daily limit. */
export interface Pass {
  id: string;
  childId: string;
  hours: number;
  reason: string;
  status: PassStatus;
  issuedBy: string;
  issuedAt: number;
  /** Passes go stale so they are used, not hoarded forever. */
  expiresAt: number;
  redeemedAt?: number;
}

export type LedgerSource =
  | 'chore'
  | 'deed'
  | 'pass'
  | 'grant'
  | 'manual'
  | 'correction';

/**
 * Append-only. Balances are always derived from this, never stored as the
 * source of truth, so no minute can silently disappear and every number a
 * kid sees can be explained line by line.
 */
export interface LedgerEntry {
  id: string;
  childId: string;
  deltaMinutes: number;
  deltaEmpathy: number;
  source: LedgerSource;
  sourceId?: string;
  note: string;
  createdAt: number;
  createdBy: string;
}

/**
 * Family Link has no API, so handing over earned minutes is a human step.
 * A grant tracks that handoff explicitly instead of pretending it happened.
 */
export type GrantStatus = 'requested' | 'granted' | 'cancelled';

export interface Grant {
  id: string;
  childId: string;
  minutes: number;
  status: GrantStatus;
  requestedAt: number;
  requestedBy: string;
  settledBy?: string;
  settledAt?: number;
  cancelReason?: string;
}

/**
 * Parent-defined reward at a secret empathy threshold.
 *
 * A prize is a household-wide template, not a one-off trophy: each child can
 * reach it independently. Who has reached it is tracked in PrizeUnlock, so one
 * kid crossing the line never locks a sibling out.
 */
/**
 * Which counter a prize watches.
 *
 * Two kids with opposite problems need prizes that measure opposite things. A
 * child whose difficulty is starting anything needs a ladder built on showing
 * up day after day; a child whose difficulty is seeing past herself needs one
 * built on empathy, which she cannot self-award.
 */
export type PrizeMetric = 'empathy' | 'streakDays' | 'lifetimeMinutes';

export interface Prize {
  id: string;
  title: string;
  /** Which counter this prize reads. */
  metric: PrizeMetric;
  /** Value of that metric required. Never sent to a child's screen. */
  threshold: number;
  /**
   * Which child this prize belongs to, or null for one either of them can
   * reach. Two kids with opposite problems need opposite ladders: short and
   * frequent for the one who needs to believe the system is real, long and
   * relational for the one who needs to stop treating people as means.
   */
  childId: string | null;
  active: boolean;
  createdAt: number;
}

/** One child reaching one prize. Document id is `${prizeId}__${childId}`. */
export interface PrizeUnlock {
  id: string;
  prizeId: string;
  childId: string;
  unlockedAt: number;
  /** Set once a parent has actually told the child and handed the prize over. */
  revealedAt?: number;
}

export interface HouseholdSettings {
  /** Ceiling on chore minutes credited to one kid in one day. */
  dailyChoreMinuteCap: number;
  /** Member id of the adult whose help earns the multiplier. */
  primaryCaregiverId: string | null;
  /** Empathy multiplier for deeds that helped the primary caregiver. */
  caregiverMultiplier: number;
  /** Base empathy for an approved deed. */
  deedEmpathyPoints: number;
  /** Screen-time minutes an approved deed also credits. */
  deedMinutes: number;
  /** Empathy for a deed involving genuine sacrifice, before multiplier. */
  sacrificeEmpathyPoints: number;
  /** Length of a sacrifice pass. */
  passHours: number;
  /** Days before an unredeemed pass expires. */
  passExpiryDays: number;
  /** Whether one adult may both nominate and approve the same deed. */
  allowSelfConfirm: boolean;
}

export const DEFAULT_SETTINGS: HouseholdSettings = {
  dailyChoreMinuteCap: 120,
  primaryCaregiverId: null,
  caregiverMultiplier: 2,
  deedEmpathyPoints: 10,
  deedMinutes: 15,
  sacrificeEmpathyPoints: 40,
  passHours: 12,
  passExpiryDays: 14,
  allowSelfConfirm: false,
};

export interface Balance {
  childId: string;
  /** Minutes earned and not yet handed over through Family Link. */
  availableMinutes: number;
  /** Lifetime minutes earned, for stats and streak bragging rights. */
  lifetimeMinutes: number;
  empathyPoints: number;
}

/**
 * Per-child tuning on top of the household settings.
 *
 * The two kids in this house need almost opposite economies, so anything that
 * differs between them lives here and the household settings are only the
 * fallback. `effectivePolicy()` in economy.ts merges the two.
 */
export interface ChildPolicy {
  childId: string;
  /** Shown to parents only, so it is obvious which track is which. */
  label: string;
  dailyChoreMinuteCap?: number;
  /**
   * Whether baseline chores must be done before this child can cash minutes
   * out. On for the kid who negotiates with her own mess; off for the kid who
   * needs early wins more than she needs a gate.
   */
  requireBaselineForCashout: boolean;
  /** Extra minutes once a daily streak is long enough. Builds the habit. */
  streakBonusMinutes: number;
  /** Consecutive days of at least one approved chore before the bonus starts. */
  streakBonusAfterDays: number;
  caregiverMultiplier?: number;
  deedEmpathyPoints?: number;
  sacrificeEmpathyPoints?: number;
  deedMinutes?: number;
}

/** Household settings merged with one child's overrides. */
export type EffectivePolicy = HouseholdSettings & {
  childId: string;
  label: string;
  requireBaselineForCashout: boolean;
  streakBonusMinutes: number;
  streakBonusAfterDays: number;
};

/** The three counters a prize can watch, for one child, right now. */
export interface ChildMetrics {
  empathy: number;
  streakDays: number;
  lifetimeMinutes: number;
}
