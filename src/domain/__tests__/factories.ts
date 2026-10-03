import type {
  ChildMetrics,
  ChildPolicy,
  Chore,
  Completion,
  Deed,
  EffectivePolicy,
  HouseholdSettings,
  Infraction,
  LedgerEntry,
  Prize,
  PrizeUnlock,
} from '../types';
import { DEFAULT_SETTINGS } from '../types';

/** Fixed local-time anchor so day-boundary tests behave in any timezone. */
export const DAY = new Date(2026, 8, 27, 12, 0, 0, 0).getTime();
export const HOUR = 60 * 60 * 1000;

let seq = 0;
const id = (p: string) => `${p}-${++seq}`;

export function settings(over: Partial<HouseholdSettings> = {}): HouseholdSettings {
  return { ...DEFAULT_SETTINGS, ...over };
}

export function policy(over: Partial<EffectivePolicy> = {}): EffectivePolicy {
  return {
    ...DEFAULT_SETTINGS,
    childId: 'kid-a',
    label: 'Test track',
    requireBaselineForCashout: false,
    streakBonusMinutes: 0,
    streakBonusAfterDays: 0,
    ...over,
  };
}

export function childPolicy(over: Partial<ChildPolicy> = {}): ChildPolicy {
  return {
    childId: 'kid-a',
    label: 'Test track',
    requireBaselineForCashout: false,
    streakBonusMinutes: 0,
    streakBonusAfterDays: 0,
    ...over,
  };
}

export function chore(over: Partial<Chore> = {}): Chore {
  return {
    id: id('chore'),
    title: 'Empty the dishwasher',
    minutes: 20,
    kind: 'recurring',
    assignedTo: [],
    cooldownHours: 12,
    isBaseline: false,
    active: true,
    createdAt: DAY,
    ...over,
  };
}

export function completion(over: Partial<Completion> = {}): Completion {
  return {
    id: id('completion'),
    choreId: 'chore-x',
    childId: 'kid-a',
    claimedAt: DAY,
    status: 'pending',
    ...over,
  };
}

export function deed(over: Partial<Deed> = {}): Deed {
  return {
    id: id('deed'),
    childId: 'kid-a',
    description: 'Took the baby monitor so Mom could nap',
    nominatedBy: 'mom',
    helpedCaregiver: false,
    involvedSacrifice: false,
    status: 'pending',
    createdAt: DAY,
    ...over,
  };
}

export function entry(over: Partial<LedgerEntry> = {}): LedgerEntry {
  return {
    id: id('ledger'),
    childId: 'kid-a',
    deltaMinutes: 0,
    deltaEmpathy: 0,
    source: 'chore',
    note: 'test entry',
    createdAt: DAY,
    createdBy: 'dad',
    ...over,
  };
}

export function prize(over: Partial<Prize> = {}): Prize {
  return {
    id: id('prize'),
    title: 'Trip to the trampoline park',
    metric: 'empathy',
    threshold: 100,
    childId: null,
    active: true,
    createdAt: DAY,
    ...over,
  };
}

export function prizeUnlock(over: Partial<PrizeUnlock> = {}): PrizeUnlock {
  const prizeId = over.prizeId ?? 'prize-x';
  const childId = over.childId ?? 'kid-a';
  return {
    id: `${prizeId}__${childId}`,
    prizeId,
    childId,
    unlockedAt: DAY,
    ...over,
  };
}

export function metrics(over: Partial<ChildMetrics> = {}): ChildMetrics {
  return { empathy: 0, streakDays: 0, lifetimeMinutes: 0, ...over };
}

export function infraction(over: Partial<Infraction> = {}): Infraction {
  return {
    id: id('infraction'),
    childId: 'kid-a',
    kind: 'refusal',
    description: 'Refused to clear her floor',
    minutesDeducted: 20,
    breaksStreak: true,
    dayKey: DAY,
    recordedBy: 'dad',
    createdAt: DAY,
    ...over,
  };
}
