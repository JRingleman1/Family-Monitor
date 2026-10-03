import { describe, expect, it } from 'vitest';
import { awardForChoreApproval, awardForDeedApproval } from '../economy';
import { choreEntry, deedEntry, grantEntry } from '../entries';
import { DAY, chore, deed, policy } from './factories';

describe('choreEntry', () => {
  it('records the chore title and minutes in plain words', () => {
    const c = chore({ title: 'Take out the trash', minutes: 20 });
    const award = awardForChoreApproval({
      chore: c,
      childId: 'kid-a',
      ledger: [],
      completions: [],
      policy: policy(),
      now: DAY,
    });
    const e = choreEntry({
      chore: c,
      childId: 'kid-a',
      completionId: 'comp-1',
      award,
      approvedBy: 'dad',
      now: DAY,
    });
    expect(e.deltaMinutes).toBe(20);
    expect(e.deltaEmpathy).toBe(0);
    expect(e.note).toBe('Take out the trash - 20 min');
  });

  it('explains a capped award instead of silently short-paying', () => {
    const c = chore({ title: 'Vacuum', minutes: 30 });
    const e = choreEntry({
      chore: c,
      childId: 'kid-a',
      completionId: 'comp-2',
      award: { minutes: 10, capped: true, streakBonus: 0, streakDays: 0, baseline: false },
      approvedBy: 'dad',
      now: DAY,
    });
    expect(e.note).toContain('daily cap reached');
    expect(e.note).toContain('full value was 30');
  });
});

describe('deedEntry', () => {
  it('credits empathy and minutes together', () => {
    const d = deed({ description: 'Read to his sister' });
    const e = deedEntry({
      deed: d,
      award: awardForDeedApproval({ deed: d, policy: policy() }),
      approvedBy: 'dad',
      now: DAY,
    });
    expect(e.deltaEmpathy).toBeGreaterThan(0);
    expect(e.deltaMinutes).toBeGreaterThan(0);
    expect(e.note).toContain('Good deed');
    expect(e.note).toContain('Read to his sister');
  });

  it('names the caregiver bonus so the kid sees why it was worth more', () => {
    const d = deed({ helpedCaregiver: true, description: 'Did the bottles' });
    const e = deedEntry({
      deed: d,
      award: awardForDeedApproval({ deed: d, policy: policy() }),
      approvedBy: 'dad',
      caregiverName: 'Mom',
      now: DAY,
    });
    expect(e.note).toContain('helped Mom');
  });

  it('labels a sacrifice differently from an ordinary deed', () => {
    const d = deed({ involvedSacrifice: true });
    const e = deedEntry({
      deed: d,
      award: awardForDeedApproval({ deed: d, policy: policy() }),
      approvedBy: 'dad',
      now: DAY,
    });
    expect(e.note).toContain('Sacrifice');
  });
});

describe('grantEntry', () => {
  it('debits the ledger when minutes are handed over', () => {
    const e = grantEntry({
      childId: 'kid-a',
      grantId: 'grant-1',
      minutes: 45,
      settledBy: 'dad',
      now: DAY,
    });
    expect(e.deltaMinutes).toBe(-45);
    expect(e.source).toBe('grant');
    expect(e.note).toContain('Family Link');
  });

  it('debits even if handed a negative number', () => {
    const e = grantEntry({
      childId: 'kid-a',
      grantId: 'grant-2',
      minutes: -45,
      settledBy: 'dad',
      now: DAY,
    });
    expect(e.deltaMinutes).toBe(-45);
  });
});
