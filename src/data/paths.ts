import { collection, doc, type Firestore } from 'firebase/firestore';

export const paths = {
  household: (db: Firestore, hid: string) => doc(db, 'households', hid),
  members: (db: Firestore, hid: string) => collection(db, 'households', hid, 'members'),
  member: (db: Firestore, hid: string, id: string) =>
    doc(db, 'households', hid, 'members', id),
  chores: (db: Firestore, hid: string) => collection(db, 'households', hid, 'chores'),
  chore: (db: Firestore, hid: string, id: string) => doc(db, 'households', hid, 'chores', id),
  completions: (db: Firestore, hid: string) =>
    collection(db, 'households', hid, 'completions'),
  completion: (db: Firestore, hid: string, id: string) =>
    doc(db, 'households', hid, 'completions', id),
  deeds: (db: Firestore, hid: string) => collection(db, 'households', hid, 'deeds'),
  deed: (db: Firestore, hid: string, id: string) => doc(db, 'households', hid, 'deeds', id),
  passes: (db: Firestore, hid: string) => collection(db, 'households', hid, 'passes'),
  pass: (db: Firestore, hid: string, id: string) => doc(db, 'households', hid, 'passes', id),
  ledger: (db: Firestore, hid: string) => collection(db, 'households', hid, 'ledger'),
  grants: (db: Firestore, hid: string) => collection(db, 'households', hid, 'grants'),
  grant: (db: Firestore, hid: string, id: string) =>
    doc(db, 'households', hid, 'grants', id),
  prizes: (db: Firestore, hid: string) => collection(db, 'households', hid, 'prizes'),
  prize: (db: Firestore, hid: string, id: string) =>
    doc(db, 'households', hid, 'prizes', id),
  /** Per-child prize unlocks, keyed `${prizeId}__${childId}`. */
  prizeUnlocks: (db: Firestore, hid: string) =>
    collection(db, 'households', hid, 'prizeUnlocks'),
  prizeUnlock: (db: Firestore, hid: string, unlockId: string) =>
    doc(db, 'households', hid, 'prizeUnlocks', unlockId),
  /**
   * Cached totals per child. The ledger stays the source of truth; this exists
   * so a transaction can check a prize threshold without reading every line.
   * `recomputeStats` rebuilds it from the ledger if it ever drifts.
   */
  stats: (db: Firestore, hid: string) => collection(db, 'households', hid, 'stats'),
  stat: (db: Firestore, hid: string, childId: string) =>
    doc(db, 'households', hid, 'stats', childId),
  settings: (db: Firestore, hid: string) =>
    doc(db, 'households', hid, 'config', 'settings'),
  /** Per-child tuning. Document id is the child's member id. */
  childPolicies: (db: Firestore, hid: string) =>
    collection(db, 'households', hid, 'childPolicies'),
  childPolicy: (db: Firestore, hid: string, childId: string) =>
    doc(db, 'households', hid, 'childPolicies', childId),
};
