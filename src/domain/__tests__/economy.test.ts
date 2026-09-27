import { describe, expect, it } from 'vitest';
import {
  awardForChoreApproval,
  awardForDeedApproval,
  canApproveDeed,
  canRequestGrant,
  choreMinutesCreditedOnDay,
  computeBalance,
  evaluateChoreClaim,
  isPassUsable,
  localDayRange,
  passExpiryFrom,
} from '../economy';
import { DAY, HOUR, chore, completion, deed, entry, policy, settings } from './factories';

describe('computeBalance', () => {
  it('sums minutes and empathy for the right child only', () => {
    const ledger = [
      entry({ childId: 'kid-a', deltaMinutes: 20 }),
      entry({ childId: 'kid-a', deltaMinutes: 15, deltaEmpathy: 10, source: 'deed' }),
      entry({ childId: 'kid-b', deltaMinutes: 500, deltaEmpathy: 500 }),
    ];
    const balance = computeBalance('kid-a', ledger);
    expect(balance.availableMinutes).toBe(35);
    expect(balance.empathyPoints).toBe(10);
  });

  it('counts lifetime minutes from credits only, ignoring grants', () => {
    const ledger = [
      entry({ deltaMinutes: 60 }),
      entry({ deltaMinutes: -45, source: 'grant' }),
    ];
    const balance = computeBalance('kid-a', ledger);
    expect(balance.availableMinutes).toBe(15);
    expect(balance.lifetimeMinutes).toBe(60);
  });

  it('never reports a negative balance even if grants overshoot', () => {
    const ledger = [
      entry({ deltaMinutes: 20 }),
      entry({ deltaMinutes: -50, source: 'grant' }),
    ];
    expect(computeBalance('kid-a', ledger).availableMinutes).toBe(0);
  });

  it('returns zeros for a child with no history', () => {
    const balance = computeBalance('kid-new', [entry({ childId: 'kid-a', deltaMinutes: 30 })]);
    expect(balance).toMatchObject({ availableMinutes: 0, lifetimeMinutes: 0, empathyPoints: 0 });
  });
});

describe('choreMinutesCreditedOnDay', () => {
  it('counts only chore credits inside the local day', () => {
    const { start, end } = localDayRange(DAY);
    const ledger = [
      entry({ deltaMinutes: 20, createdAt: start }),
      entry({ deltaMinutes: 20, createdAt: end - 1 }),
      entry({ deltaMinutes: 20, createdAt: start - 1 }),
      entry({ deltaMinutes: 20, createdAt: end }),
    ];
    expect(choreMinutesCreditedOnDay('kid-a', ledger, DAY)).toBe(40);
  });

  it('ignores deed minutes so kindness does not eat the chore cap', () => {
    const ledger = [
      entry({ deltaMinutes: 20, source: 'chore' }),
      entry({ deltaMinutes: 15, source: 'deed' }),
    ];
    expect(choreMinutesCreditedOnDay('kid-a', ledger, DAY)).toBe(20);
  });

  it('ignores debits', () => {
    const ledger = [entry({ deltaMinutes: -30, source: 'chore' })];
    expect(choreMinutesCreditedOnDay('kid-a', ledger, DAY)).toBe(0);
  });
});

describe('evaluateChoreClaim', () => {
  const base = { completions: [], ledger: [], policy: policy(), now: DAY };

  it('allows a normal claim', () => {
    expect(evaluateChoreClaim({ ...base, chore: chore(), childId: 'kid-a' }).allowed).toBe(true);
  });

  it('blocks an inactive chore', () => {
    const result = evaluateChoreClaim({ ...base, chore: chore({ active: false }), childId: 'kid-a' });
    expect(result).toMatchObject({ allowed: false, reason: 'chore-inactive' });
  });

  it('blocks a chore assigned to a sibling', () => {
    const result = evaluateChoreClaim({
      ...base,
      chore: chore({ assignedTo: ['kid-b'] }),
      childId: 'kid-a',
    });
    expect(result).toMatchObject({ allowed: false, reason: 'not-assigned' });
  });

  it('allows an unassigned chore for anyone', () => {
    const result = evaluateChoreClaim({
      ...base,
      chore: chore({ assignedTo: [] }),
      childId: 'kid-a',
    });
    expect(result.allowed).toBe(true);
  });

  it('blocks stacking a second claim while one is pending review', () => {
    const c = chore();
    const result = evaluateChoreClaim({
      ...base,
      chore: c,
      childId: 'kid-a',
      completions: [completion({ choreId: c.id, childId: 'kid-a', status: 'pending' })],
    });
    expect(result).toMatchObject({ allowed: false, reason: 'already-pending' });
  });

  it('blocks a re-claim inside the cooldown and reports when it reopens', () => {
    const c = chore({ cooldownHours: 12 });
    const approvedAt = DAY - 2 * HOUR;
    const result = evaluateChoreClaim({
      ...base,
      chore: c,
      childId: 'kid-a',
      completions: [
        completion({ choreId: c.id, childId: 'kid-a', status: 'approved', reviewedAt: approvedAt }),
      ],
    });
    expect(result).toMatchObject({ allowed: false, reason: 'cooldown' });
    expect(result.availableAt).toBe(approvedAt + 12 * HOUR);
  });

  it('allows a re-claim once the cooldown has passed', () => {
    const c = chore({ cooldownHours: 12 });
    const result = evaluateChoreClaim({
      ...base,
      chore: c,
      childId: 'kid-a',
      completions: [
        completion({
          choreId: c.id,
          childId: 'kid-a',
          status: 'approved',
          reviewedAt: DAY - 13 * HOUR,
        }),
      ],
    });
    expect(result.allowed).toBe(true);
  });

  it('does not let a rejected claim start a cooldown', () => {
    const c = chore({ cooldownHours: 12 });
    const result = evaluateChoreClaim({
      ...base,
      chore: c,
      childId: 'kid-a',
      completions: [
        completion({ choreId: c.id, childId: 'kid-a', status: 'rejected', reviewedAt: DAY - HOUR }),
      ],
    });
    expect(result.allowed).toBe(true);
  });

  it('ignores a sibling cooldown on a shared chore', () => {
    const c = chore({ cooldownHours: 12 });
    const result = evaluateChoreClaim({
      ...base,
      chore: c,
      childId: 'kid-a',
      completions: [
        completion({ choreId: c.id, childId: 'kid-b', status: 'approved', reviewedAt: DAY - HOUR }),
      ],
    });
    expect(result.allowed).toBe(true);
  });

  it('blocks once the daily chore cap is spent', () => {
    const result = evaluateChoreClaim({
      ...base,
      chore: chore(),
      childId: 'kid-a',
      policy: policy({ dailyChoreMinuteCap: 60 }),
      ledger: [entry({ deltaMinutes: 60, source: 'chore', createdAt: DAY })],
    });
    expect(result).toMatchObject({ allowed: false, reason: 'daily-cap-reached' });
  });
});

describe('awardForChoreApproval', () => {
  const base = { childId: 'kid-a', completions: [], now: DAY };

  it('pays the full value with room to spare', () => {
    const award = awardForChoreApproval({
      ...base,
      chore: chore({ minutes: 20 }),
      ledger: [],
      policy: policy({ dailyChoreMinuteCap: 120 }),
    });
    expect(award).toMatchObject({ minutes: 20, capped: false, baseline: false });
  });

  it('pays nothing for a baseline chore, because it is expected', () => {
    const award = awardForChoreApproval({
      ...base,
      chore: chore({ minutes: 20, isBaseline: true }),
      ledger: [],
      policy: policy(),
    });
    expect(award).toMatchObject({ minutes: 0, baseline: true });
  });

  it('trims the award to the cap instead of paying nothing', () => {
    const award = awardForChoreApproval({
      ...base,
      chore: chore({ minutes: 30 }),
      ledger: [entry({ deltaMinutes: 110, source: 'chore', createdAt: DAY })],
      policy: policy({ dailyChoreMinuteCap: 120 }),
    });
    expect(award).toMatchObject({ minutes: 10, capped: true });
  });

  it('pays zero once the cap is fully spent', () => {
    const award = awardForChoreApproval({
      ...base,
      chore: chore({ minutes: 30 }),
      ledger: [entry({ deltaMinutes: 120, source: 'chore', createdAt: DAY })],
      policy: policy({ dailyChoreMinuteCap: 120 }),
    });
    expect(award).toMatchObject({ minutes: 0, capped: true });
  });

  it('resets with the calendar day', () => {
    const yesterday = localDayRange(DAY).start - HOUR;
    const award = awardForChoreApproval({
      ...base,
      chore: chore({ minutes: 30 }),
      ledger: [entry({ deltaMinutes: 120, source: 'chore', createdAt: yesterday })],
      policy: policy({ dailyChoreMinuteCap: 120 }),
    });
    expect(award).toMatchObject({ minutes: 30, capped: false });
  });
});

describe('awardForDeedApproval', () => {
  const s = policy({
    deedEmpathyPoints: 10,
    deedMinutes: 15,
    sacrificeEmpathyPoints: 40,
    caregiverMultiplier: 2,
    passHours: 12,
  });

  it('pays base empathy for an ordinary deed', () => {
    const award = awardForDeedApproval({ deed: deed(), policy: s });
    expect(award).toMatchObject({ empathy: 10, minutes: 15, issuePass: false, multiplierApplied: false });
  });

  it('doubles empathy when the deed helped the caregiver', () => {
    const award = awardForDeedApproval({ deed: deed({ helpedCaregiver: true }), policy: s });
    expect(award).toMatchObject({ empathy: 20, multiplierApplied: true });
  });

  it('pays the sacrifice rate and issues a 12 hour pass', () => {
    const award = awardForDeedApproval({ deed: deed({ involvedSacrifice: true }), policy: s });
    expect(award).toMatchObject({ empathy: 40, issuePass: true, passHours: 12 });
  });

  it('stacks the caregiver multiplier on top of a sacrifice', () => {
    const award = awardForDeedApproval({
      deed: deed({ involvedSacrifice: true, helpedCaregiver: true }),
      policy: s,
    });
    expect(award).toMatchObject({ empathy: 80, issuePass: true, multiplierApplied: true });
  });

  it('applies no multiplier when it is configured to 1', () => {
    const award = awardForDeedApproval({
      deed: deed({ helpedCaregiver: true }),
      policy: policy({ caregiverMultiplier: 1, deedEmpathyPoints: 10 }),
    });
    expect(award).toMatchObject({ empathy: 10, multiplierApplied: false });
  });
});

describe('canApproveDeed', () => {
  it('lets the other parent confirm', () => {
    const check = canApproveDeed({
      deed: deed({ nominatedBy: 'mom' }),
      approverId: 'dad',
      approverRole: 'parent',
      settings: settings(),
    });
    expect(check.allowed).toBe(true);
  });

  it('never lets a child approve a deed', () => {
    const check = canApproveDeed({
      deed: deed(),
      approverId: 'kid-a',
      approverRole: 'child',
      settings: settings(),
    });
    expect(check).toMatchObject({ allowed: false, reason: 'approver-not-parent' });
  });

  it('blocks the nominator from self-confirming by default', () => {
    const check = canApproveDeed({
      deed: deed({ nominatedBy: 'mom' }),
      approverId: 'mom',
      approverRole: 'parent',
      settings: settings({ allowSelfConfirm: false }),
    });
    expect(check).toMatchObject({ allowed: false, reason: 'self-confirm-disabled' });
  });

  it('allows self-confirm when the household opts in', () => {
    const check = canApproveDeed({
      deed: deed({ nominatedBy: 'mom' }),
      approverId: 'mom',
      approverRole: 'parent',
      settings: settings({ allowSelfConfirm: true }),
    });
    expect(check.allowed).toBe(true);
  });

  it('refuses to approve a deed twice', () => {
    const check = canApproveDeed({
      deed: deed({ status: 'approved' }),
      approverId: 'dad',
      approverRole: 'parent',
      settings: settings(),
    });
    expect(check).toMatchObject({ allowed: false, reason: 'not-pending' });
  });
});

describe('canRequestGrant', () => {
  const balance = { childId: 'kid-a', availableMinutes: 40, lifetimeMinutes: 100, empathyPoints: 0 };

  it('allows a request within balance', () => {
    expect(canRequestGrant({ minutes: 40, balance }).allowed).toBe(true);
  });

  it('rejects a request over balance', () => {
    expect(canRequestGrant({ minutes: 41, balance })).toMatchObject({
      allowed: false,
      reason: 'insufficient-balance',
    });
  });

  it('rejects zero and negative requests', () => {
    expect(canRequestGrant({ minutes: 0, balance }).reason).toBe('non-positive');
    expect(canRequestGrant({ minutes: -10, balance }).reason).toBe('non-positive');
  });
});

describe('passes', () => {
  it('expires a pass the configured number of days out', () => {
    const s = settings({ passExpiryDays: 14 });
    expect(passExpiryFrom(DAY, s)).toBe(DAY + 14 * 24 * HOUR);
  });

  it('treats an issued unexpired pass as usable', () => {
    expect(isPassUsable({ status: 'issued', expiresAt: DAY + HOUR }, DAY)).toBe(true);
  });

  it('treats an expired or spent pass as unusable', () => {
    expect(isPassUsable({ status: 'issued', expiresAt: DAY - HOUR }, DAY)).toBe(false);
    expect(isPassUsable({ status: 'redeemed', expiresAt: DAY + HOUR }, DAY)).toBe(false);
  });
});
