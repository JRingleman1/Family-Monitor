/**
 * The seed script must never undo a parent's edits.
 *
 * This is a regression suite for a real bug: the script matched rows by title
 * and updated them, so renaming a prize in the app made the original title
 * match nothing, and re-running pasted the placeholder straight back in beside
 * the renamed one. Editing a chore's minutes while keeping its title was worse
 * - the values were silently reverted with no new row to notice.
 */

import { describe, expect, it } from 'vitest';
// @ts-expect-error - plain ESM helper shared with the CLI seed script
import { findExisting, planRow, seedKey } from '../seed-plan.mjs';

const fakeDoc = (id: string) => ({ id });

describe('seedKey', () => {
  it('is stable for the same track and title', () => {
    expect(seedKey('momentum', 'prize', 'Trampoline park trip')).toBe(
      seedKey('momentum', 'prize', 'Trampoline park trip'),
    );
  });

  it('separates the two tracks', () => {
    expect(seedKey('momentum', 'chore', 'Trash walk')).not.toBe(
      seedKey('contribution', 'chore', 'Trash walk'),
    );
  });

  it('separates chores from prizes', () => {
    expect(seedKey('momentum', 'chore', 'Same name')).not.toBe(
      seedKey('momentum', 'prize', 'Same name'),
    );
  });

  it('survives punctuation and case in the default title', () => {
    expect(seedKey('momentum', 'prize', 'BIG ONE - fill this in!')).toBe(
      seedKey('momentum', 'prize', 'big one   fill this in'),
    );
  });
});

describe('findExisting', () => {
  const keyed = fakeDoc('keyed');
  const titled = fakeDoc('titled');

  it('prefers a seedKey match over a title match', () => {
    const found = findExisting({
      key: 'momentum:prize:x',
      title: 'Renamed by a parent',
      bySeedKey: new Map([['momentum:prize:x', keyed]]),
      byTitle: new Map([['renamed by a parent', titled]]),
    });
    expect(found).toMatchObject({ doc: keyed, matchedBy: 'seedKey' });
  });

  it('falls back to title for rows written before seedKeys existed', () => {
    const found = findExisting({
      key: 'momentum:prize:x',
      title: 'Trampoline park trip',
      bySeedKey: new Map(),
      byTitle: new Map([['trampoline park trip', titled]]),
    });
    expect(found).toMatchObject({ doc: titled, matchedBy: 'title' });
  });

  it('finds nothing when the row is genuinely new', () => {
    expect(
      findExisting({
        key: 'momentum:prize:x',
        title: 'Brand new',
        bySeedKey: new Map(),
        byTitle: new Map(),
      }),
    ).toBeNull();
  });
});

describe('planRow', () => {
  it('creates a row that does not exist', () => {
    expect(planRow({ existing: undefined, hasSeedKey: false, update: false })).toBe('create');
  });

  it('leaves a seeded row completely alone on a re-run', () => {
    // The regression. A second run must not touch what is already there.
    expect(planRow({ existing: fakeDoc('a'), hasSeedKey: true, update: false })).toBe('skip');
  });

  it('adopts a legacy row rather than duplicating it', () => {
    expect(planRow({ existing: fakeDoc('a'), hasSeedKey: false, update: false })).toBe('adopt');
  });

  it('resets only when --update is passed explicitly', () => {
    expect(planRow({ existing: fakeDoc('a'), hasSeedKey: true, update: true })).toBe('reset');
    expect(planRow({ existing: fakeDoc('a'), hasSeedKey: false, update: true })).toBe('reset');
  });

  it('still creates a missing row even with --update', () => {
    expect(planRow({ existing: undefined, hasSeedKey: false, update: true })).toBe('create');
  });
});

describe('the renamed-prize scenario end to end', () => {
  // A parent renames "BIG ONE - fill this in" to "Nintendo Switch". The row
  // keeps its seedKey. The next run must recognise it and do nothing.
  const DEFAULT_TITLE = 'BIG ONE - fill this in with something she is desperate for';
  const key = seedKey('momentum', 'prize', DEFAULT_TITLE);
  const renamed = fakeDoc('renamed-by-parent');

  it('does not duplicate the placeholder beside the renamed prize', () => {
    const found = findExisting({
      key,
      title: DEFAULT_TITLE,
      bySeedKey: new Map([[key, renamed]]),
      // The parent's new title is nowhere near the default one.
      byTitle: new Map([['nintendo switch', renamed]]),
    });
    expect(found?.matchedBy).toBe('seedKey');
    expect(planRow({ existing: found?.doc, hasSeedKey: true, update: false })).toBe('skip');
  });

  it('would have duplicated it under the old title-only matching', () => {
    // Proves the bug was real: with no seedKey lookup, the renamed row is
    // invisible and the script creates a second one.
    const found = findExisting({
      key,
      title: DEFAULT_TITLE,
      bySeedKey: new Map(),
      byTitle: new Map([['nintendo switch', renamed]]),
    });
    expect(found).toBeNull();
    expect(planRow({ existing: undefined, hasSeedKey: false, update: false })).toBe('create');
  });

  it('leaves retuned chore minutes alone when the title is unchanged', () => {
    const choreKey = seedKey('contribution', 'chore', 'Unload the dishwasher');
    const retuned = fakeDoc('minutes-changed-by-parent');
    const found = findExisting({
      key: choreKey,
      title: 'Unload the dishwasher',
      bySeedKey: new Map([[choreKey, retuned]]),
      byTitle: new Map([['unload the dishwasher', retuned]]),
    });
    expect(planRow({ existing: found?.doc, hasSeedKey: true, update: false })).toBe('skip');
  });
});
