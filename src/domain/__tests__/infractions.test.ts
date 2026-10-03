/**
 * Consequences: minutes deducted and streaks broken.
 *
 * The most important test in this file is the one asserting an infraction
 * cannot carry empathy. That separation is what keeps chore compliance and
 * kindness from collapsing into a single currency, and it is the reason a
 * child cannot be pushed away from a prize she earned by helping someone.
 */

import { describe, expect, it } from 'vitest';
import { currentStreakDays, localDayRange, streakBonusFor } from '../economy';
import { infractionEntry } from '../entries';
import { DAY, HOUR, completion, infraction, policy } from './factories';

const DAY_MS = 24 * HOUR;

const approvedOn = (offsetDays: number) =>
  completion({
    status: 'approved',
    reviewedAt: localDayRange(DAY - offsetDays * DAY_MS).start + 9 * HOUR,
  });

const dayStart = (offsetDays: number) => localDayRange(DAY - offsetDays * DAY_MS).start;

describe('a refusal breaks the streak', () => {
  it('stops the run on the day it is logged', () => {
    const completions = [approvedOn(0), approvedOn(1), approvedOn(2)];
    const infractions = [infraction({ dayKey: dayStart(1), breaksStreak: true })];
    // Today still counts, yesterday is broken, so the run stops at one.
    expect(currentStreakDays({ completions, infractions, childId: 'kid-a', now: DAY })).toBe(1);
  });

  it('zeroes the streak when today is the refusal', () => {
    // The gap a bare "did anything get approved today" check leaves open: one
    // token job plus a flat refusal should not preserve a streak.
    const completions = [approvedOn(0), approvedOn(1), approvedOn(2)];
    const infractions = [infraction({ dayKey: dayStart(0), breaksStreak: true })];
    expect(currentStreakDays({ completions, infractions, childId: 'kid-a', now: DAY })).toBe(0);
  });

  it('leaves the streak alone when the infraction does not break it', () => {
    const completions = [approvedOn(0), approvedOn(1)];
    const infractions = [infraction({ dayKey: dayStart(0), breaksStreak: false })];
    expect(currentStreakDays({ completions, infractions, childId: 'kid-a', now: DAY })).toBe(2);
  });

  it('does not let a sibling’s refusal break this child’s streak', () => {
    const completions = [approvedOn(0), approvedOn(1)];
    const infractions = [
      infraction({ childId: 'kid-b', dayKey: dayStart(0), breaksStreak: true }),
    ];
    expect(currentStreakDays({ completions, infractions, childId: 'kid-a', now: DAY })).toBe(2);
  });

  it('matches a refusal logged at any hour to its calendar day', () => {
    const completions = [approvedOn(0), approvedOn(1)];
    const infractions = [
      infraction({ dayKey: dayStart(1) + 23 * HOUR, breaksStreak: true }),
    ];
    expect(currentStreakDays({ completions, infractions, childId: 'kid-a', now: DAY })).toBe(1);
  });

  it('behaves exactly as before when no infractions are passed', () => {
    const completions = [approvedOn(0), approvedOn(1), approvedOn(2)];
    expect(currentStreakDays({ completions, childId: 'kid-a', now: DAY })).toBe(3);
  });

  it('costs the streak bonus once the run is broken', () => {
    const completions = [approvedOn(0), approvedOn(1), approvedOn(2)];
    const p = policy({ streakBonusMinutes: 10, streakBonusAfterDays: 3 });
    expect(streakBonusFor({ policy: p, completions, now: DAY }).minutes).toBe(10);
    expect(
      streakBonusFor({
        policy: p,
        completions,
        infractions: [infraction({ dayKey: dayStart(1), breaksStreak: true })],
        now: DAY,
      }).minutes,
    ).toBe(0);
  });
});

describe('infractionEntry', () => {
  const base = {
    childId: 'kid-a',
    infractionId: 'inf-1',
    description: 'Refused to clear her floor when asked',
    kindLabel: 'Refused when asked',
    recordedBy: 'dad',
    now: DAY,
  };

  it('deducts minutes and says why in the child’s own ledger', () => {
    const e = infractionEntry({ ...base, minutes: 20, breaksStreak: false });
    expect(e.deltaMinutes).toBe(-20);
    expect(e.note).toContain('Refused when asked');
    expect(e.note).toContain('Refused to clear her floor when asked');
  });

  it('never carries empathy, whatever happened', () => {
    // The load-bearing assertion. Chore behaviour must not reach the prize
    // ladder in either direction.
    for (const minutes of [0, 20, 500]) {
      for (const breaksStreak of [true, false]) {
        expect(infractionEntry({ ...base, minutes, breaksStreak }).deltaEmpathy).toBe(0);
      }
    }
  });

  it('records a streak reset in words', () => {
    const e = infractionEntry({ ...base, minutes: 0, breaksStreak: true });
    expect(e.note).toContain('streak reset');
  });

  it('allows a logged warning that costs nothing', () => {
    const e = infractionEntry({ ...base, minutes: 0, breaksStreak: false });
    expect(e.deltaMinutes).toBe(0);
    expect(e.note.length).toBeGreaterThan(0);
  });

  it('deducts even if handed a negative number', () => {
    expect(infractionEntry({ ...base, minutes: -20, breaksStreak: false }).deltaMinutes).toBe(-20);
  });
});
