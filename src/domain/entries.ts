/**
 * Builders that turn an approval into the ledger entries it implies.
 *
 * Every balance change in the app goes through one of these, so the note on
 * each line is always human readable. When a kid asks "where did my minutes
 * go", the answer is on screen in plain words.
 */

import type { Chore, Deed, LedgerEntry, Member } from './types';
import type { ChoreAward, DeedAward } from './economy';

export type NewLedgerEntry = Omit<LedgerEntry, 'id'>;

export function choreEntry(params: {
  chore: Chore;
  childId: string;
  completionId: string;
  award: ChoreAward;
  approvedBy: string;
  now: number;
}): NewLedgerEntry {
  const { chore, childId, completionId, award, approvedBy, now } = params;

  let note: string;
  if (award.baseline) {
    note = `${chore.title} - done (expected, no minutes)`;
  } else {
    note = `${chore.title} - ${award.minutes} min`;
    if (award.streakBonus > 0) {
      note += ` (includes ${award.streakBonus} min for a ${award.streakDays}-day streak)`;
    }
    if (award.capped) {
      note += ` (daily cap reached, full value was ${chore.minutes + (award.streakBonus || 0)})`;
    }
  }

  return {
    childId,
    deltaMinutes: award.minutes,
    deltaEmpathy: 0,
    source: 'chore',
    sourceId: completionId,
    note,
    createdAt: now,
    createdBy: approvedBy,
  };
}

export function deedEntry(params: {
  deed: Deed;
  award: DeedAward;
  approvedBy: string;
  caregiverName?: string;
  now: number;
}): NewLedgerEntry {
  const { deed, award, approvedBy, caregiverName, now } = params;

  const parts: string[] = [deed.involvedSacrifice ? 'Sacrifice' : 'Good deed'];
  parts.push(deed.description);
  // The impact note is the part that actually teaches. Keep it in the ledger so
  // the child can scroll back and reread what they did for someone.
  if (deed.impactNote) parts.push(`what it did: ${deed.impactNote}`);
  if (award.multiplierApplied) {
    parts.push(`helped ${caregiverName ?? 'Mom'} - bonus applied`);
  }

  return {
    childId: deed.childId,
    deltaMinutes: award.minutes,
    deltaEmpathy: award.empathy,
    source: 'deed',
    sourceId: deed.id,
    note: parts.join(': '),
    createdAt: now,
    createdBy: approvedBy,
  };
}

/**
 * Handing minutes over in Family Link is a debit: the minutes leave our ledger
 * at the moment a parent confirms they added them to the real device.
 */
export function grantEntry(params: {
  childId: string;
  grantId: string;
  minutes: number;
  settledBy: string;
  now: number;
}): NewLedgerEntry {
  const { childId, grantId, minutes, settledBy, now } = params;
  return {
    childId,
    deltaMinutes: -Math.abs(minutes),
    deltaEmpathy: 0,
    source: 'grant',
    sourceId: grantId,
    note: `${Math.abs(minutes)} min added in Family Link`,
    createdAt: now,
    createdBy: settledBy,
  };
}

export function manualEntry(params: {
  childId: string;
  deltaMinutes: number;
  deltaEmpathy: number;
  note: string;
  author: Member;
  now: number;
}): NewLedgerEntry {
  const { childId, deltaMinutes, deltaEmpathy, note, author, now } = params;
  return {
    childId,
    deltaMinutes,
    deltaEmpathy,
    source: 'manual',
    note: `${note} (by ${author.displayName})`,
    createdAt: now,
    createdBy: author.id,
  };
}
