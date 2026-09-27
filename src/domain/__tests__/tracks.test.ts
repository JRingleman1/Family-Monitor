/**
 * The two-track mechanics: the baseline gate, daily streaks, and per-child
 * policy overrides.
 *
 * These are the parts aimed at real habits in this house, so they get the
 * closest tests: a gate that leaks lets a kid negotiate with her own mess, and
 * a streak that miscounts kills the one thing making small daily jobs worth
 * more than a single Saturday push.
 */

import { describe, expect, it } from 'vitest';
import {
  awardForChoreApproval,
  baselineStatus,
  currentStreakDays,
  effectivePolicy,
  evaluateCashout,
  evaluateChoreClaim,
  localDayRange,
  streakBonusFor,
} from '../economy';
import { DAY, HOUR, childPolicy, chore, completion, entry, policy, settings } from './factories';

const DAY_MS = 24 * HOUR;
const balance = (minutes: number) => ({
  childId: 'kid-a',
  availableMinutes: minutes,
  lifetimeMinutes: minutes,
  empathyPoints: 0,
});

describe('effectivePolicy', () => {
  it('falls back to household settings when a child has no policy yet', () => {
    const merged = effectivePolicy(settings({ dailyChoreMinuteCap: 90 }), undefined, 'kid-a');
    expect(merged.dailyChoreMinuteCap).toBe(90);
    expect(merged.requireBaselineForCashout).toBe(false);
    expect(merged.childId).toBe('kid-a');
  });

  it('lets a child override the cap and the multiplier', () => {
    const merged = effectivePolicy(
      settings({ dailyChoreMinuteCap: 120, caregiverMultiplier: 2 }),
      childPolicy({ dailyChoreMinuteCap: 60, caregiverMultiplier: 3 }),
      'kid-a',
    );
    expect(merged.dailyChoreMinuteCap).toBe(60);
    expect(merged.caregiverMultiplier).toBe(3);
  });

  it('keeps household values the policy does not mention', () => {
    const merged = effectivePolicy(
      settings({ deedMinutes: 15, passHours: 12 }),
      childPolicy({ dailyChoreMinuteCap: 60 }),
      'kid-a',
    );
    expect(merged.deedMinutes).toBe(15);
    expect(merged.passHours).toBe(12);
  });

  it('carries the track label through for parent screens', () => {
    const merged = effectivePolicy(settings(), childPolicy({ label: 'Momentum' }), 'kid-a');
    expect(merged.label).toBe('Momentum');
  });
});

describe('baselineStatus', () => {
  const tidy = chore({ title: 'Wrapper sweep', isBaseline: true, minutes: 0 });
  const dishes = chore({ title: 'Your own plate', isBaseline: true, minutes: 0 });
  const earner = chore({ title: 'Vacuum the stairs', minutes: 20 });

  it('lists every baseline chore as outstanding when nothing is done', () => {
    const status = baselineStatus({
      chores: [tidy, dishes, earner],
      completions: [],
      childId: 'kid-a',
      now: DAY,
    });
    expect(status.required).toHaveLength(2);
    expect(status.outstanding).toHaveLength(2);
    expect(status.satisfied).toBe(false);
  });

  it('ignores earning chores entirely', () => {
    const status = baselineStatus({
      chores: [earner],
      completions: [],
      childId: 'kid-a',
      now: DAY,
    });
    expect(status.required).toHaveLength(0);
    expect(status.satisfied).toBe(true);
  });

  it('is satisfied once every baseline chore is approved today', () => {
    const status = baselineStatus({
      chores: [tidy, dishes],
      completions: [
        completion({ choreId: tidy.id, status: 'approved', reviewedAt: DAY }),
        completion({ choreId: dishes.id, status: 'approved', reviewedAt: DAY }),
      ],
      childId: 'kid-a',
      now: DAY,
    });
    expect(status.satisfied).toBe(true);
    expect(status.done).toHaveLength(2);
  });

  it('does not count a pending claim as done', () => {
    const status = baselineStatus({
      chores: [tidy],
      completions: [completion({ choreId: tidy.id, status: 'pending' })],
      childId: 'kid-a',
      now: DAY,
    });
    expect(status.satisfied).toBe(false);
  });

  it('does not let yesterday’s tidy-up cover today', () => {
    const yesterday = localDayRange(DAY).start - HOUR;
    const status = baselineStatus({
      chores: [tidy],
      completions: [
        completion({ choreId: tidy.id, status: 'approved', reviewedAt: yesterday }),
      ],
      childId: 'kid-a',
      now: DAY,
    });
    expect(status.satisfied).toBe(false);
  });

  it('does not credit a sibling’s tidy-up', () => {
    const status = baselineStatus({
      chores: [tidy],
      completions: [
        completion({
          choreId: tidy.id,
          childId: 'kid-b',
          status: 'approved',
          reviewedAt: DAY,
        }),
      ],
      childId: 'kid-a',
      now: DAY,
    });
    expect(status.satisfied).toBe(false);
  });

  it('only requires baseline chores assigned to this child', () => {
    const hers = chore({ isBaseline: true, assignedTo: ['kid-b'] });
    const status = baselineStatus({
      chores: [hers],
      completions: [],
      childId: 'kid-a',
      now: DAY,
    });
    expect(status.required).toHaveLength(0);
    expect(status.satisfied).toBe(true);
  });

  it('ignores an inactive baseline chore', () => {
    const status = baselineStatus({
      chores: [chore({ isBaseline: true, active: false })],
      completions: [],
      childId: 'kid-a',
      now: DAY,
    });
    expect(status.satisfied).toBe(true);
  });
});

describe('evaluateCashout', () => {
  const tidy = chore({ title: 'Clear your own floor', isBaseline: true, minutes: 0 });

  it('lets an ungated child spend freely', () => {
    const check = evaluateCashout({
      minutes: 30,
      balance: balance(60),
      policy: policy({ requireBaselineForCashout: false }),
      chores: [tidy],
      completions: [],
      now: DAY,
    });
    expect(check.allowed).toBe(true);
  });

  it('blocks a gated child whose own jobs are outstanding, and names them', () => {
    const check = evaluateCashout({
      minutes: 30,
      balance: balance(60),
      policy: policy({ requireBaselineForCashout: true }),
      chores: [tidy],
      completions: [],
      now: DAY,
    });
    expect(check).toMatchObject({ allowed: false, reason: 'baseline-outstanding' });
    expect(check.outstanding?.map((c) => c.title)).toEqual(['Clear your own floor']);
  });

  it('opens the window as soon as the baseline is clear', () => {
    const check = evaluateCashout({
      minutes: 30,
      balance: balance(60),
      policy: policy({ requireBaselineForCashout: true }),
      chores: [tidy],
      completions: [
        completion({ choreId: tidy.id, status: 'approved', reviewedAt: DAY }),
      ],
      now: DAY,
    });
    expect(check.allowed).toBe(true);
  });

  it('does not destroy banked minutes while the gate is shut', () => {
    // The gate withholds spending, never earnings. This is the whole reason it
    // is a gate and not a fine.
    const bal = balance(60);
    evaluateCashout({
      minutes: 30,
      balance: bal,
      policy: policy({ requireBaselineForCashout: true }),
      chores: [tidy],
      completions: [],
      now: DAY,
    });
    expect(bal.availableMinutes).toBe(60);
  });

  it('still refuses to overspend a balance even with the baseline clear', () => {
    const check = evaluateCashout({
      minutes: 90,
      balance: balance(60),
      policy: policy({ requireBaselineForCashout: true }),
      chores: [],
      completions: [],
      now: DAY,
    });
    expect(check).toMatchObject({ allowed: false, reason: 'insufficient-balance' });
  });

  it('refuses a zero or negative request', () => {
    expect(
      evaluateCashout({
        minutes: 0,
        balance: balance(60),
        policy: policy(),
        chores: [],
        completions: [],
        now: DAY,
      }).reason,
    ).toBe('non-positive');
  });
});

describe('currentStreakDays', () => {
  const approvedOn = (offsetDays: number) =>
    completion({
      status: 'approved',
      reviewedAt: localDayRange(DAY - offsetDays * DAY_MS).start + 9 * HOUR,
    });

  it('is zero with no approved work', () => {
    expect(currentStreakDays({ completions: [], childId: 'kid-a', now: DAY })).toBe(0);
  });

  it('counts today alone as one', () => {
    expect(
      currentStreakDays({ completions: [approvedOn(0)], childId: 'kid-a', now: DAY }),
    ).toBe(1);
  });

  it('counts a run of consecutive days', () => {
    const completions = [approvedOn(0), approvedOn(1), approvedOn(2)];
    expect(currentStreakDays({ completions, childId: 'kid-a', now: DAY })).toBe(3);
  });

  it('stops at the first missed day', () => {
    const completions = [approvedOn(0), approvedOn(1), approvedOn(3)];
    expect(currentStreakDays({ completions, childId: 'kid-a', now: DAY })).toBe(2);
  });

  it('is zero when nothing has been approved today, however good yesterday was', () => {
    const completions = [approvedOn(1), approvedOn(2), approvedOn(3)];
    expect(currentStreakDays({ completions, childId: 'kid-a', now: DAY })).toBe(0);
  });

  it('counts a day once even with several chores done', () => {
    const completions = [approvedOn(0), approvedOn(0), approvedOn(0)];
    expect(currentStreakDays({ completions, childId: 'kid-a', now: DAY })).toBe(1);
  });

  it('ignores pending and rejected claims', () => {
    const completions = [
      approvedOn(0),
      completion({ status: 'pending', claimedAt: DAY - DAY_MS }),
      completion({ status: 'rejected', reviewedAt: DAY - DAY_MS }),
    ];
    expect(currentStreakDays({ completions, childId: 'kid-a', now: DAY })).toBe(1);
  });

  it('ignores a sibling’s streak', () => {
    const completions = [
      approvedOn(0),
      { ...approvedOn(1), childId: 'kid-b' },
      { ...approvedOn(2), childId: 'kid-b' },
    ];
    expect(currentStreakDays({ completions, childId: 'kid-a', now: DAY })).toBe(1);
  });
});

describe('streakBonusFor', () => {
  const approvedOn = (offsetDays: number) =>
    completion({
      status: 'approved',
      reviewedAt: localDayRange(DAY - offsetDays * DAY_MS).start + 9 * HOUR,
    });

  it('pays nothing when the streak is too short', () => {
    const result = streakBonusFor({
      policy: policy({ streakBonusMinutes: 10, streakBonusAfterDays: 3 }),
      completions: [approvedOn(0), approvedOn(1)],
      now: DAY,
    });
    expect(result).toMatchObject({ minutes: 0, streakDays: 2 });
  });

  it('pays on the day the streak reaches the threshold', () => {
    const result = streakBonusFor({
      policy: policy({ streakBonusMinutes: 10, streakBonusAfterDays: 3 }),
      completions: [approvedOn(0), approvedOn(1), approvedOn(2)],
      now: DAY,
    });
    expect(result).toMatchObject({ minutes: 10, streakDays: 3 });
  });

  it('keeps paying while the streak holds', () => {
    const result = streakBonusFor({
      policy: policy({ streakBonusMinutes: 10, streakBonusAfterDays: 3 }),
      completions: [approvedOn(0), approvedOn(1), approvedOn(2), approvedOn(3)],
      now: DAY,
    });
    expect(result.minutes).toBe(10);
  });

  it('is off when the policy sets no bonus', () => {
    const result = streakBonusFor({
      policy: policy({ streakBonusMinutes: 0, streakBonusAfterDays: 3 }),
      completions: [approvedOn(0), approvedOn(1), approvedOn(2)],
      now: DAY,
    });
    expect(result.minutes).toBe(0);
  });
});

describe('awardForChoreApproval with streaks', () => {
  const approvedOn = (offsetDays: number) =>
    completion({
      status: 'approved',
      reviewedAt: localDayRange(DAY - offsetDays * DAY_MS).start + 9 * HOUR,
    });

  it('adds the streak bonus on top of the chore value', () => {
    const award = awardForChoreApproval({
      chore: chore({ minutes: 10 }),
      childId: 'kid-a',
      ledger: [],
      completions: [approvedOn(0), approvedOn(1), approvedOn(2)],
      policy: policy({ streakBonusMinutes: 5, streakBonusAfterDays: 3, dailyChoreMinuteCap: 120 }),
      now: DAY,
    });
    expect(award).toMatchObject({ minutes: 15, streakBonus: 5, streakDays: 3, capped: false });
  });

  it('never lets the streak bonus break the daily cap', () => {
    const award = awardForChoreApproval({
      chore: chore({ minutes: 10 }),
      childId: 'kid-a',
      ledger: [entry({ deltaMinutes: 58, source: 'chore', createdAt: DAY })],
      completions: [approvedOn(0), approvedOn(1), approvedOn(2)],
      policy: policy({ streakBonusMinutes: 5, streakBonusAfterDays: 3, dailyChoreMinuteCap: 60 }),
      now: DAY,
    });
    expect(award).toMatchObject({ minutes: 2, capped: true });
  });

  it('pays no streak bonus on a baseline chore', () => {
    const award = awardForChoreApproval({
      chore: chore({ minutes: 0, isBaseline: true }),
      childId: 'kid-a',
      ledger: [],
      completions: [approvedOn(0), approvedOn(1), approvedOn(2)],
      policy: policy({ streakBonusMinutes: 5, streakBonusAfterDays: 3 }),
      now: DAY,
    });
    expect(award).toMatchObject({ minutes: 0, streakBonus: 0, baseline: true });
  });
});

describe('evaluateChoreClaim and the baseline gate together', () => {
  it('still lets a capped-out child claim a baseline chore', () => {
    // Otherwise a gated kid who earned all day could be locked out of the only
    // thing that opens her spending window. Exactly backwards.
    const result = evaluateChoreClaim({
      chore: chore({ isBaseline: true, minutes: 0 }),
      childId: 'kid-a',
      completions: [],
      ledger: [entry({ deltaMinutes: 120, source: 'chore', createdAt: DAY })],
      policy: policy({ dailyChoreMinuteCap: 120 }),
      now: DAY,
    });
    expect(result.allowed).toBe(true);
  });

  it('blocks an earning chore at the same cap', () => {
    const result = evaluateChoreClaim({
      chore: chore({ minutes: 20 }),
      childId: 'kid-a',
      completions: [],
      ledger: [entry({ deltaMinutes: 120, source: 'chore', createdAt: DAY })],
      policy: policy({ dailyChoreMinuteCap: 120 }),
      now: DAY,
    });
    expect(result).toMatchObject({ allowed: false, reason: 'daily-cap-reached' });
  });
});
