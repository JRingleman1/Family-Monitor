import { describe, expect, it } from 'vitest';
import {
  childHint,
  hintMessage,
  metricValue,
  nextPrizeFor,
  parentPrizeView,
  pendingReveals,
  prizesForChild,
  prizesUnlockedAt,
  unlockId,
} from '../prizes';
import { DAY, metrics, prize, prizeUnlock } from './factories';

describe('nextPrizeFor', () => {
  it('targets the cheapest active prize', () => {
    const prizes = [prize({ threshold: 300 }), prize({ threshold: 100 }), prize({ threshold: 200 })];
    expect(nextPrizeFor('kid-a', prizes, [], metrics())?.threshold).toBe(100);
  });

  it('skips inactive prizes', () => {
    const prizes = [prize({ threshold: 50, active: false }), prize({ threshold: 200 })];
    expect(nextPrizeFor('kid-a', prizes, [], metrics())?.threshold).toBe(200);
  });

  it('skips prizes this child already reached', () => {
    const cheap = prize({ threshold: 50 });
    const dear = prize({ threshold: 200 });
    const unlocks = [prizeUnlock({ prizeId: cheap.id, childId: 'kid-a' })];
    expect(nextPrizeFor('kid-a', [cheap, dear], unlocks, metrics())?.threshold).toBe(200);
  });

  it('does not let one kid lock a sibling out of the same prize', () => {
    const cheap = prize({ threshold: 50 });
    const unlocks = [prizeUnlock({ prizeId: cheap.id, childId: 'kid-a' })];
    expect(nextPrizeFor('kid-b', [cheap], unlocks, metrics())?.id).toBe(cheap.id);
  });

  it('returns null when nothing is left for this child', () => {
    const only = prize({ threshold: 50 });
    const unlocks = [prizeUnlock({ prizeId: only.id, childId: 'kid-a' })];
    expect(nextPrizeFor('kid-a', [only], unlocks, metrics())).toBeNull();
  });
});

describe('unlockId', () => {
  it('is deterministic per prize and child so an unlock cannot double-write', () => {
    expect(unlockId('p1', 'kid-a')).toBe('p1__kid-a');
    expect(unlockId('p1', 'kid-a')).toBe(unlockId('p1', 'kid-a'));
    expect(unlockId('p1', 'kid-a')).not.toBe(unlockId('p1', 'kid-b'));
  });
});

describe('prizesUnlockedAt', () => {
  it('returns every newly crossed prize, cheapest first', () => {
    const prizes = [prize({ threshold: 200 }), prize({ threshold: 50 }), prize({ threshold: 100 })];
    const unlocked = prizesUnlockedAt({
      childId: 'kid-a',
      metrics: metrics({ empathy: 120 }),
      prizes,
      unlocks: [],
    });
    expect(unlocked.map((p) => p.threshold)).toEqual([50, 100]);
  });

  it('unlocks exactly at the threshold', () => {
    const unlocked = prizesUnlockedAt({
      childId: 'kid-a',
      metrics: metrics({ empathy: 100 }),
      prizes: [prize({ threshold: 100 })],
      unlocks: [],
    });
    expect(unlocked).toHaveLength(1);
  });

  it('does not re-unlock a prize this child already reached', () => {
    const p = prize({ threshold: 100 });
    const unlocked = prizesUnlockedAt({
      childId: 'kid-a',
      metrics: metrics({ empathy: 500 }),
      prizes: [p],
      unlocks: [prizeUnlock({ prizeId: p.id, childId: 'kid-a' })],
    });
    expect(unlocked).toHaveLength(0);
  });

  it('still unlocks for a sibling who has not reached it', () => {
    const p = prize({ threshold: 100 });
    const unlocked = prizesUnlockedAt({
      childId: 'kid-b',
      metrics: metrics({ empathy: 150 }),
      prizes: [p],
      unlocks: [prizeUnlock({ prizeId: p.id, childId: 'kid-a' })],
    });
    expect(unlocked).toHaveLength(1);
  });

  it('ignores inactive prizes', () => {
    const unlocked = prizesUnlockedAt({
      childId: 'kid-a',
      metrics: metrics({ empathy: 500 }),
      prizes: [prize({ threshold: 10, active: false })],
      unlocks: [],
    });
    expect(unlocked).toHaveLength(0);
  });
});

describe('pendingReveals', () => {
  it('lists this child’s unlocks that nobody has told them about', () => {
    const unlocks = [
      prizeUnlock({ prizeId: 'p1', childId: 'kid-a' }),
      prizeUnlock({ prizeId: 'p2', childId: 'kid-a', revealedAt: DAY }),
      prizeUnlock({ prizeId: 'p3', childId: 'kid-b' }),
    ];
    expect(pendingReveals('kid-a', unlocks).map((u) => u.prizeId)).toEqual(['p1']);
  });
});

describe('childHint', () => {
  const prizes = [prize({ threshold: 100 })];

  it('says nothing useful below half way', () => {
    expect(childHint({ childId: 'kid-a', metrics: metrics({ empathy: 49 }), prizes, unlocks: [] }).band).toBe('none');
  });

  it('hints at half way', () => {
    expect(childHint({ childId: 'kid-a', metrics: metrics({ empathy: 50 }), prizes, unlocks: [] }).band).toBe('stirring');
  });

  it('warms up at eighty percent', () => {
    expect(childHint({ childId: 'kid-a', metrics: metrics({ empathy: 80 }), prizes, unlocks: [] }).band).toBe('close');
  });

  it('goes imminent at ninety five percent', () => {
    expect(childHint({ childId: 'kid-a', metrics: metrics({ empathy: 95 }), prizes, unlocks: [] }).band).toBe('imminent');
  });

  it('reports an unlock waiting to be revealed', () => {
    const p = prize({ threshold: 100 });
    const hint = childHint({
      childId: 'kid-a',
      metrics: metrics({ empathy: 100 }),
      prizes: [p],
      unlocks: [prizeUnlock({ prizeId: p.id, childId: 'kid-a' })],
    });
    expect(hint.band).toBe('unlocked');
  });

  it('stops nagging once the unlock has been revealed', () => {
    const p = prize({ threshold: 100 });
    const hint = childHint({
      childId: 'kid-a',
      metrics: metrics({ empathy: 100 }),
      prizes: [p],
      unlocks: [prizeUnlock({ prizeId: p.id, childId: 'kid-a', revealedAt: DAY })],
    });
    expect(hint.band).toBe('none');
  });

  it('does not show a sibling’s unlock to this child', () => {
    const p = prize({ threshold: 100 });
    const hint = childHint({
      childId: 'kid-b',
      metrics: metrics({ empathy: 0 }),
      prizes: [p],
      unlocks: [prizeUnlock({ prizeId: p.id, childId: 'kid-a' })],
    });
    expect(hint.band).toBe('none');
  });

  it('leaks no number, threshold or prize title in the message', () => {
    const secret = prize({ threshold: 100, title: 'Trampoline park' });
    for (const points of [0, 25, 50, 80, 95, 99, 100]) {
      const { message } = childHint({
        childId: 'kid-a',
        metrics: metrics({ empathy: points }),
        prizes: [secret],
        unlocks: [],
      });
      expect(message).not.toMatch(/\d/);
      expect(message.toLowerCase()).not.toContain('trampoline');
    }
  });

  it('is calm when no prizes are configured at all', () => {
    expect(childHint({ childId: 'kid-a', metrics: metrics({ empathy: 999 }), prizes: [], unlocks: [] }).band).toBe('none');
  });
});

describe('parentPrizeView', () => {
  it('shows the parent the real numbers', () => {
    const view = parentPrizeView({
      prize: prize({ threshold: 200 }),
      childId: 'kid-a',
      metrics: metrics({ empathy: 50 }),
      unlocks: [],
    });
    expect(view).toMatchObject({ current: 50, remaining: 150, percent: 25, unlocked: false, revealed: false });
  });

  it('clamps past the threshold', () => {
    const view = parentPrizeView({
      prize: prize({ threshold: 100 }),
      childId: 'kid-a',
      metrics: metrics({ empathy: 250 }),
      unlocks: [],
    });
    expect(view).toMatchObject({ remaining: 0, percent: 100 });
  });

  it('reports unlock and reveal state for the child in question', () => {
    const p = prize({ threshold: 100 });
    const view = parentPrizeView({
      prize: p,
      childId: 'kid-a',
      metrics: metrics({ empathy: 100 }),
      unlocks: [prizeUnlock({ prizeId: p.id, childId: 'kid-a', revealedAt: DAY })],
    });
    expect(view).toMatchObject({ unlocked: true, revealed: true });
  });
});

describe('metricValue', () => {
  it('reads the counter a prize watches', () => {
    const m = metrics({ empathy: 30, streakDays: 7, lifetimeMinutes: 400 });
    expect(metricValue('empathy', m)).toBe(30);
    expect(metricValue('streakDays', m)).toBe(7);
    expect(metricValue('lifetimeMinutes', m)).toBe(400);
  });
});

describe('prizesForChild', () => {
  it('includes a shared prize and this child\u2019s own, and excludes a sibling\u2019s', () => {
    const shared = prize({ childId: null });
    const hers = prize({ childId: 'kid-a' });
    const theirs = prize({ childId: 'kid-b' });
    const ids = prizesForChild('kid-a', [shared, hers, theirs]).map((p) => p.id);
    expect(ids).toEqual([shared.id, hers.id]);
  });
});

describe('streak-based prize ladders', () => {
  const streakPrize = prize({ metric: 'streakDays', threshold: 7, childId: 'kid-a' });

  it('unlocks on consecutive days rather than empathy', () => {
    const unlocked = prizesUnlockedAt({
      childId: 'kid-a',
      metrics: metrics({ streakDays: 7, empathy: 0 }),
      prizes: [streakPrize],
      unlocks: [],
    });
    expect(unlocked).toHaveLength(1);
  });

  it('does not unlock on empathy alone', () => {
    const unlocked = prizesUnlockedAt({
      childId: 'kid-a',
      metrics: metrics({ streakDays: 2, empathy: 500 }),
      prizes: [streakPrize],
      unlocks: [],
    });
    expect(unlocked).toHaveLength(0);
  });

  it('hints from the streak counter, not the empathy counter', () => {
    // Six of seven days is the 'close' band. The kid never learns it is seven.
    expect(
      childHint({
        childId: 'kid-a',
        metrics: metrics({ streakDays: 6, empathy: 0 }),
        prizes: [streakPrize],
        unlocks: [],
      }).band,
    ).toBe('close');

    expect(
      childHint({
        childId: 'kid-a',
        metrics: metrics({ streakDays: 0, empathy: 500 }),
        prizes: [streakPrize],
        unlocks: [],
      }).band,
    ).toBe('none');
  });

  it('never leaks the day count in the hint', () => {
    for (const days of [0, 3, 5, 6, 7]) {
      const { message } = childHint({
        childId: 'kid-a',
        metrics: metrics({ streakDays: days }),
        prizes: [streakPrize],
        unlocks: [],
      });
      expect(message).not.toMatch(/\d/);
    }
  });

  it('tracks whichever ladder the child is furthest along', () => {
    const empathyLadder = prize({ metric: 'empathy', threshold: 100, childId: 'kid-a' });
    const streakLadder = prize({ metric: 'streakDays', threshold: 10, childId: 'kid-a' });
    const target = nextPrizeFor(
      'kid-a',
      [empathyLadder, streakLadder],
      [],
      metrics({ empathy: 10, streakDays: 9 }),
    );
    expect(target?.id).toBe(streakLadder.id);
  });
});

describe('hintMessage', () => {
  it('has a sentence for every band', () => {
    for (const band of ['none', 'stirring', 'close', 'imminent', 'unlocked'] as const) {
      expect(hintMessage(band).length).toBeGreaterThan(0);
    }
  });

  it('leaks no digits in any band, since this is the only text a kid sees', () => {
    for (const band of ['none', 'stirring', 'close', 'imminent', 'unlocked'] as const) {
      expect(hintMessage(band)).not.toMatch(/\d/);
    }
  });

  it('agrees with what childHint returns, so the stored word round-trips', () => {
    const hint = childHint({
      childId: 'kid-a',
      metrics: metrics({ empathy: 85 }),
      prizes: [prize({ threshold: 100 })],
      unlocks: [],
    });
    expect(hint.message).toBe(hintMessage(hint.band));
  });
});
