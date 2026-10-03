/**
 * What the seed script should do with a single row.
 *
 * Pulled out of seed.mjs so the decision is testable on its own. It is the
 * part that was wrong before: matching rows by title meant a prize renamed in
 * the app looked like a brand new one, so re-running pasted the placeholder
 * back in beside it, and a chore whose title was unchanged had its minutes
 * silently reverted.
 */

/**
 * Stable identity for a row this script creates, derived from the track and the
 * DEFAULT title. It is written to the document once and never recomputed from
 * the live title, which is what lets a row survive being renamed.
 */
export function seedKey(trackKey, kind, title) {
  const slug = String(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  return `${trackKey}:${kind}:${slug}`;
}

/**
 * Decide what to do with one seeded row.
 *
 *   create - nothing like it exists yet
 *   adopt  - a row from before seedKeys existed; tag it and leave its content
 *   skip   - already present; leave it completely alone
 *   reset  - overwrite with the defaults, only ever when --update was passed
 */
export function planRow({ existing, hasSeedKey, update }) {
  if (!existing) return 'create';
  if (update) return 'reset';
  return hasSeedKey ? 'skip' : 'adopt';
}

/**
 * Find the existing document for a seeded row.
 *
 * seedKey wins. Title is only a fallback for rows written before seedKeys
 * existed, so they get adopted instead of duplicated.
 */
export function findExisting({ key, title, bySeedKey, byTitle }) {
  const keyed = bySeedKey.get(key);
  if (keyed) return { doc: keyed, matchedBy: 'seedKey' };
  const titled = byTitle.get(String(title).toLowerCase());
  if (titled) return { doc: titled, matchedBy: 'title' };
  return null;
}
