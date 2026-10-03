import type { DocumentData } from 'firebase/firestore';
import { toMillis, toOptionalMillis } from './convert';
import { DEFAULT_SETTINGS } from '../domain/types';
import type {
  ChildPolicy,
  Chore,
  Infraction,
  InfractionKind,
  Completion,
  Deed,
  Grant,
  HouseholdSettings,
  LedgerEntry,
  Member,
  Pass,
  Prize,
  PrizeUnlock,
  ReviewStatus,
  Role,
} from '../domain/types';

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const num = (v: unknown, fallback = 0): number => (typeof v === 'number' ? v : fallback);
const bool = (v: unknown, fallback = false): boolean =>
  typeof v === 'boolean' ? v : fallback;
const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
const status = (v: unknown): ReviewStatus =>
  v === 'approved' || v === 'rejected' ? v : 'pending';

export function toMember(d: DocumentData, id: string): Member {
  return {
    id,
    householdId: str(d.householdId),
    displayName: str(d.displayName, 'Unnamed'),
    role: (d.role === 'parent' ? 'parent' : 'child') as Role,
    loginEmail: str(d.loginEmail),
    avatarColor: str(d.avatarColor, '#4f6ef7'),
    isPrimaryCaregiver: bool(d.isPrimaryCaregiver),
    createdAt: toMillis(d.createdAt),
  };
}

export function toChore(d: DocumentData, id: string): Chore {
  return {
    id,
    title: str(d.title, 'Untitled chore'),
    description: str(d.description) || undefined,
    minutes: num(d.minutes),
    kind: d.kind === 'oneoff' ? 'oneoff' : 'recurring',
    assignedTo: strings(d.assignedTo),
    cooldownHours: num(d.cooldownHours),
    isBaseline: bool(d.isBaseline),
    active: bool(d.active, true),
    createdAt: toMillis(d.createdAt),
  };
}

export function toCompletion(d: DocumentData, id: string): Completion {
  return {
    id,
    choreId: str(d.choreId),
    childId: str(d.childId),
    claimedAt: toMillis(d.claimedAt),
    status: status(d.status),
    note: str(d.note) || undefined,
    reviewedBy: str(d.reviewedBy) || undefined,
    reviewedAt: toOptionalMillis(d.reviewedAt),
    minutesAwarded: typeof d.minutesAwarded === 'number' ? d.minutesAwarded : undefined,
    cappedByDailyLimit: bool(d.cappedByDailyLimit),
    rejectionReason: str(d.rejectionReason) || undefined,
  };
}

export function toDeed(d: DocumentData, id: string): Deed {
  return {
    id,
    childId: str(d.childId),
    description: str(d.description),
    nominatedBy: str(d.nominatedBy),
    helpedCaregiver: bool(d.helpedCaregiver),
    involvedSacrifice: bool(d.involvedSacrifice),
    impactNote: str(d.impactNote) || undefined,
    status: status(d.status),
    createdAt: toMillis(d.createdAt),
    approvedBy: str(d.approvedBy) || undefined,
    approvedAt: toOptionalMillis(d.approvedAt),
    empathyAwarded: typeof d.empathyAwarded === 'number' ? d.empathyAwarded : undefined,
    minutesAwarded: typeof d.minutesAwarded === 'number' ? d.minutesAwarded : undefined,
    passIssuedId: str(d.passIssuedId) || undefined,
    rejectionReason: str(d.rejectionReason) || undefined,
  };
}

export function toPass(d: DocumentData, id: string): Pass {
  return {
    id,
    childId: str(d.childId),
    hours: num(d.hours, 12),
    reason: str(d.reason),
    status: d.status === 'redeemed' || d.status === 'expired' ? d.status : 'issued',
    issuedBy: str(d.issuedBy),
    issuedAt: toMillis(d.issuedAt),
    expiresAt: toMillis(d.expiresAt),
    redeemedAt: toOptionalMillis(d.redeemedAt),
  };
}

export function toLedgerEntry(d: DocumentData, id: string): LedgerEntry {
  return {
    id,
    childId: str(d.childId),
    deltaMinutes: num(d.deltaMinutes),
    deltaEmpathy: num(d.deltaEmpathy),
    source: (d.source ?? 'manual') as LedgerEntry['source'],
    sourceId: str(d.sourceId) || undefined,
    note: str(d.note),
    createdAt: toMillis(d.createdAt),
    createdBy: str(d.createdBy),
  };
}

export function toGrant(d: DocumentData, id: string): Grant {
  return {
    id,
    childId: str(d.childId),
    minutes: num(d.minutes),
    status:
      d.status === 'granted' || d.status === 'cancelled' ? d.status : 'requested',
    requestedAt: toMillis(d.requestedAt),
    requestedBy: str(d.requestedBy),
    settledBy: str(d.settledBy) || undefined,
    settledAt: toOptionalMillis(d.settledAt),
    cancelReason: str(d.cancelReason) || undefined,
  };
}

export function toPrize(d: DocumentData, id: string): Prize {
  return {
    id,
    title: str(d.title),
    metric:
      d.metric === 'streakDays' || d.metric === 'lifetimeMinutes' ? d.metric : 'empathy',
    threshold: num(d.threshold),
    childId: str(d.childId) || null,
    active: bool(d.active, true),
    createdAt: toMillis(d.createdAt),
  };
}

export function toPrizeUnlock(d: DocumentData, id: string): PrizeUnlock {
  return {
    id,
    prizeId: str(d.prizeId),
    childId: str(d.childId),
    unlockedAt: toMillis(d.unlockedAt),
    revealedAt: toOptionalMillis(d.revealedAt),
  };
}

export function toSettings(d: DocumentData | undefined): HouseholdSettings {
  if (!d) return { ...DEFAULT_SETTINGS };
  return {
    dailyChoreMinuteCap: num(d.dailyChoreMinuteCap, DEFAULT_SETTINGS.dailyChoreMinuteCap),
    primaryCaregiverId: str(d.primaryCaregiverId) || null,
    caregiverMultiplier: num(d.caregiverMultiplier, DEFAULT_SETTINGS.caregiverMultiplier),
    deedEmpathyPoints: num(d.deedEmpathyPoints, DEFAULT_SETTINGS.deedEmpathyPoints),
    deedMinutes: num(d.deedMinutes, DEFAULT_SETTINGS.deedMinutes),
    sacrificeEmpathyPoints: num(
      d.sacrificeEmpathyPoints,
      DEFAULT_SETTINGS.sacrificeEmpathyPoints,
    ),
    passHours: num(d.passHours, DEFAULT_SETTINGS.passHours),
    passExpiryDays: num(d.passExpiryDays, DEFAULT_SETTINGS.passExpiryDays),
    allowSelfConfirm: bool(d.allowSelfConfirm, DEFAULT_SETTINGS.allowSelfConfirm),
  };
}

export function toChildPolicy(d: DocumentData, id: string): ChildPolicy {
  const optNum = (v: unknown): number | undefined =>
    typeof v === 'number' ? v : undefined;
  return {
    childId: id,
    label: str(d.label, 'Standard track'),
    dailyChoreMinuteCap: optNum(d.dailyChoreMinuteCap),
    requireBaselineForCashout: bool(d.requireBaselineForCashout),
    streakBonusMinutes: num(d.streakBonusMinutes),
    streakBonusAfterDays: num(d.streakBonusAfterDays),
    caregiverMultiplier: optNum(d.caregiverMultiplier),
    deedEmpathyPoints: optNum(d.deedEmpathyPoints),
    sacrificeEmpathyPoints: optNum(d.sacrificeEmpathyPoints),
    deedMinutes: optNum(d.deedMinutes),
  };
}

export function toInfraction(d: DocumentData, id: string): Infraction {
  const kind: InfractionKind =
    d.kind === 'refusal' || d.kind === 'done-badly' ? d.kind : 'other';
  return {
    id,
    childId: str(d.childId),
    kind,
    description: str(d.description),
    minutesDeducted: num(d.minutesDeducted),
    breaksStreak: bool(d.breaksStreak),
    dayKey: toMillis(d.dayKey),
    recordedBy: str(d.recordedBy),
    createdAt: toMillis(d.createdAt),
  };
}
