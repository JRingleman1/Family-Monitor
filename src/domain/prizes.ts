/**
 * Hidden prize logic.
 *
 * A child's screen never receives a threshold number, a prize title, or a
 * percentage. It receives one of a handful of deliberately vague hint bands.
 * That is enforced here by construction - `childHint()` returns only a band and
 * a sentence - and again in Firestore rules, which stop a child reading the
 * prize documents at all.
 *
 * Vagueness is the point. A visible number turns kindness into a grind.
 *
 * Two further design choices live here:
 *  - Prizes are household templates and unlocks are per child, so both kids can
 *    reach the same prize independently.
 *  - A prize watches one of three counters. A ladder built on daily streaks
 *    rewards a child who struggles to start anything; a ladder built on empathy
 *    rewards one who struggles to see past herself. Same machinery, opposite
 *    behaviour.
 */

import type { ChildMetrics, Prize, PrizeMetric, PrizeUnlock } from './types';

export type HintBand = 'none' | 'stirring' | 'close' | 'imminent' | 'unlocked';

export interface ChildHint {
  band: HintBand;
  message: string;
}

export const HINT_COPY: Record<HintBand, string> = {
  none: 'Keep looking out for people. Good things build up quietly.',
  stirring: 'Something is stirring. Keep going.',
  close: "You're getting close to something big.",
  imminent: 'Something big is almost here.',
  unlocked: 'You unlocked something. Go find a parent.',
};

/**
 * The sentence for a band.
 *
 * A child's device cannot read the prizes collection, so it cannot work its own
 * band out. The band is computed where the prize data lives - on a parent's
 * approval - stored as a single word on the child's stats document, and turned
 * back into a sentence here. Only the word crosses to the child's device.
 */
export function hintMessage(band: HintBand): string {
  return HINT_COPY[band];
}

/** Deterministic id so an unlock can never be written twice for a child. */
export function unlockId(prizeId: string, childId: string): string {
  return `${prizeId}__${childId}`;
}

export function metricValue(metric: PrizeMetric, metrics: ChildMetrics): number {
  switch (metric) {
    case 'empathy':
      return metrics.empathy;
    case 'streakDays':
      return metrics.streakDays;
    case 'lifetimeMinutes':
      return metrics.lifetimeMinutes;
  }
}

function unlockedPrizeIds(childId: string, unlocks: PrizeUnlock[]): Set<string> {
  const ids = new Set<string>();
  for (const u of unlocks) {
    if (u.childId === childId) ids.add(u.prizeId);
  }
  return ids;
}

/** Prizes this child is eligible for at all: theirs, or the shared ones. */
export function prizesForChild(childId: string, prizes: Prize[]): Prize[] {
  return prizes.filter((p) => p.childId === null || p.childId === childId);
}

/**
 * The next prize a child is working toward: the one they are furthest along, so
 * the hint they see tracks the target they are actually closest to reaching.
 */
export function nextPrizeFor(
  childId: string,
  prizes: Prize[],
  unlocks: PrizeUnlock[],
  metrics: ChildMetrics,
): Prize | null {
  const done = unlockedPrizeIds(childId, unlocks);
  const candidates = prizesForChild(childId, prizes).filter(
    (p) => p.active && !done.has(p.id) && p.threshold > 0,
  );
  if (candidates.length === 0) return null;

  return candidates.reduce((best, p) => {
    const ratio = metricValue(p.metric, metrics) / p.threshold;
    const bestRatio = metricValue(best.metric, metrics) / best.threshold;
    if (ratio > bestRatio) return p;
    // Tie break on the cheaper target so progress feels like it is going
    // somewhere rather than jumping between ladders.
    if (ratio === bestRatio && p.threshold < best.threshold) return p;
    return best;
  });
}

/**
 * Prizes this child has newly crossed. Returned so the caller can record the
 * unlock and tell a parent - never the child directly.
 */
export function prizesUnlockedAt(params: {
  childId: string;
  metrics: ChildMetrics;
  prizes: Prize[];
  unlocks: PrizeUnlock[];
}): Prize[] {
  const { childId, metrics, prizes, unlocks } = params;
  const done = unlockedPrizeIds(childId, unlocks);
  return prizesForChild(childId, prizes)
    .filter(
      (p) =>
        p.active &&
        !done.has(p.id) &&
        metricValue(p.metric, metrics) >= p.threshold,
    )
    .sort((a, b) => a.threshold - b.threshold);
}

/** Unlocks this child has earned but not yet been told about. */
export function pendingReveals(childId: string, unlocks: PrizeUnlock[]): PrizeUnlock[] {
  return unlocks.filter((u) => u.childId === childId && !u.revealedAt);
}

/**
 * The only prize information a child is ever allowed to see.
 *
 * Bands are wide on purpose. A kid cannot work out a threshold from a band, and
 * cannot tell whether one more deed will tip it.
 */
export function childHint(params: {
  childId: string;
  metrics: ChildMetrics;
  prizes: Prize[];
  unlocks: PrizeUnlock[];
}): ChildHint {
  const { childId, metrics, prizes, unlocks } = params;

  if (pendingReveals(childId, unlocks).length > 0) {
    return { band: 'unlocked', message: HINT_COPY.unlocked };
  }

  const target = nextPrizeFor(childId, prizes, unlocks, metrics);
  if (!target) return { band: 'none', message: HINT_COPY.none };

  const ratio = metricValue(target.metric, metrics) / target.threshold;
  let band: HintBand;
  if (ratio >= 0.95) band = 'imminent';
  else if (ratio >= 0.8) band = 'close';
  else if (ratio >= 0.5) band = 'stirring';
  else band = 'none';

  return { band, message: HINT_COPY[band] };
}

/** Full detail, for parent screens only. */
export interface ParentPrizeView {
  prize: Prize;
  current: number;
  remaining: number;
  percent: number;
  unlocked: boolean;
  revealed: boolean;
}

export function parentPrizeView(params: {
  prize: Prize;
  childId: string;
  metrics: ChildMetrics;
  unlocks: PrizeUnlock[];
}): ParentPrizeView {
  const { prize, childId, metrics, unlocks } = params;
  const unlock = unlocks.find((u) => u.prizeId === prize.id && u.childId === childId);
  const current = metricValue(prize.metric, metrics);
  const remaining = Math.max(0, prize.threshold - current);
  const percent =
    prize.threshold > 0 ? Math.min(100, Math.round((current / prize.threshold) * 100)) : 100;
  return {
    prize,
    current,
    remaining,
    percent,
    unlocked: unlock !== undefined,
    revealed: unlock?.revealedAt !== undefined,
  };
}
