/**
 * Security rules tests, run against the Firestore emulator.
 *
 * These are the only place the app's promises are actually guaranteed. The UI
 * can be bypassed with a browser console; these cannot. Each test here maps to
 * a sentence in the README, so if one fails, a claim made to the family is
 * false.
 *
 * Run with: npm run test:rules
 */

import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  setDoc,
  updateDoc,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

const HID = 'house1';
const DAD = 'dad-uid';
const MOM = 'mom-uid';
const KID = 'kid-uid';
const SIB = 'sib-uid';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'family-monitor-rules-test',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

/** A household with two parents and two kids, written with rules bypassed. */
async function seedHousehold() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'households', HID), { name: 'Test family' });
    await setDoc(doc(db, 'households', HID, 'members', DAD), {
      householdId: HID,
      displayName: 'Dad',
      role: 'parent',
    });
    await setDoc(doc(db, 'households', HID, 'members', MOM), {
      householdId: HID,
      displayName: 'Mom',
      role: 'parent',
    });
    await setDoc(doc(db, 'households', HID, 'members', KID), {
      householdId: HID,
      displayName: 'Kid',
      role: 'child',
    });
    await setDoc(doc(db, 'households', HID, 'members', SIB), {
      householdId: HID,
      displayName: 'Sib',
      role: 'child',
    });
    await setDoc(doc(db, 'households', HID, 'config', 'settings'), {
      dailyChoreMinuteCap: 120,
    });
    await setDoc(doc(db, 'households', HID, 'chores', 'chore1'), {
      title: 'Dishes',
      minutes: 20,
      isBaseline: false,
      active: true,
      assignedTo: [],
    });
    await setDoc(doc(db, 'households', HID, 'prizes', 'prize1'), {
      title: 'Trampoline park',
      metric: 'empathy',
      threshold: 100,
      childId: KID,
      active: true,
    });
    await setDoc(doc(db, 'households', HID, 'prizeUnlocks', 'prize1__kid-uid'), {
      prizeId: 'prize1',
      childId: KID,
    });
    await setDoc(doc(db, 'households', HID, 'ledger', 'l1'), {
      childId: KID,
      deltaMinutes: 20,
      deltaEmpathy: 0,
      note: 'Dishes',
    });
    await setDoc(doc(db, 'households', HID, 'ledger', 'l2'), {
      childId: SIB,
      deltaMinutes: 50,
      deltaEmpathy: 0,
      note: 'Sib work',
    });
    await setDoc(doc(db, 'households', HID, 'stats', KID), {
      childId: KID,
      availableMinutes: 20,
      empathyPoints: 30,
      hintBand: 'stirring',
    });
    await setDoc(doc(db, 'households', HID, 'deeds', 'deed1'), {
      childId: KID,
      description: 'Helped Mom',
      nominatedBy: MOM,
      status: 'pending',
    });
    await setDoc(doc(db, 'households', HID, 'childPolicies', KID), {
      label: 'Momentum track',
      requireBaselineForCashout: false,
    });
  });
}

const asDad = () => env.authenticatedContext(DAD).firestore();
const asMom = () => env.authenticatedContext(MOM).firestore();
const asKid = () => env.authenticatedContext(KID).firestore();
const asStranger = () => env.authenticatedContext('nobody-uid').firestore();

beforeEach(async () => {
  await env.clearFirestore();
  await seedHousehold();
});

describe('household bootstrap', () => {
  it('lets the founding parent create their own member document', async () => {
    // The deadlock this guards against: isParent() reads the member document,
    // so without this the first parent could never create theirs and setup
    // failed at the first click.
    await env.clearFirestore();
    const db = env.authenticatedContext('new-parent').firestore();
    await assertSucceeds(
      setDoc(doc(db, 'households', 'fresh', 'members', 'new-parent'), {
        householdId: 'fresh',
        displayName: 'Founder',
        role: 'parent',
      }),
    );
  });

  it('then lets them create the household, index and settings', async () => {
    await env.clearFirestore();
    const db = env.authenticatedContext('new-parent').firestore();
    await setDoc(doc(db, 'households', 'fresh', 'members', 'new-parent'), {
      householdId: 'fresh',
      displayName: 'Founder',
      role: 'parent',
    });
    await assertSucceeds(setDoc(doc(db, 'userIndex', 'new-parent'), { householdId: 'fresh' }));
    await assertSucceeds(setDoc(doc(db, 'households', 'fresh'), { name: 'Fresh' }));
    await assertSucceeds(
      setDoc(doc(db, 'households', 'fresh', 'config', 'settings'), { dailyChoreMinuteCap: 120 }),
    );
  });

  it('closes the bootstrap once the household exists, so nobody can join themselves', async () => {
    const db = asStranger();
    await assertFails(
      setDoc(doc(db, 'households', HID, 'members', 'nobody-uid'), {
        householdId: HID,
        displayName: 'Intruder',
        role: 'parent',
      }),
    );
  });

  it('does not let the founder bootstrap themselves as a child-role trojan', async () => {
    await env.clearFirestore();
    const db = env.authenticatedContext('new-parent').firestore();
    await assertFails(
      setDoc(doc(db, 'households', 'fresh', 'members', 'new-parent'), {
        householdId: 'fresh',
        displayName: 'Founder',
        role: 'child',
      }),
    );
  });

  it('does not let the founder create somebody else’s member document', async () => {
    await env.clearFirestore();
    const db = env.authenticatedContext('new-parent').firestore();
    await assertFails(
      setDoc(doc(db, 'households', 'fresh', 'members', 'someone-else'), {
        householdId: 'fresh',
        displayName: 'Ghost',
        role: 'parent',
      }),
    );
  });
});

describe('a child can never award themselves empathy', () => {
  it('refuses a deed created by a child', async () => {
    // This is the load-bearing rule of the whole app. Empathy is the only
    // currency that moves a hidden prize.
    const db = asKid();
    await assertFails(
      setDoc(doc(db, 'households', HID, 'deeds', 'self1'), {
        childId: KID,
        description: 'I was amazing',
        nominatedBy: KID,
        status: 'pending',
      }),
    );
  });

  it('refuses a child approving a pending deed', async () => {
    const db = asKid();
    await assertFails(
      updateDoc(doc(db, 'households', HID, 'deeds', 'deed1'), { status: 'approved' }),
    );
  });

  it('lets a parent nominate a deed for a child', async () => {
    const db = asMom();
    await assertSucceeds(
      setDoc(doc(db, 'households', HID, 'deeds', 'deed2'), {
        childId: KID,
        description: 'Took the baby',
        nominatedBy: MOM,
        status: 'pending',
      }),
    );
  });

  it('refuses a parent nominating in another parent’s name', async () => {
    const db = asMom();
    await assertFails(
      setDoc(doc(db, 'households', HID, 'deeds', 'deed3'), {
        childId: KID,
        description: 'Forged',
        nominatedBy: DAD,
        status: 'pending',
      }),
    );
  });

  it('refuses a deed created already approved, skipping review', async () => {
    const db = asMom();
    await assertFails(
      setDoc(doc(db, 'households', HID, 'deeds', 'deed4'), {
        childId: KID,
        description: 'Pre-approved',
        nominatedBy: MOM,
        status: 'approved',
      }),
    );
  });

  it('lets the other parent approve a deed', async () => {
    const db = asDad();
    await assertSucceeds(
      updateDoc(doc(db, 'households', HID, 'deeds', 'deed1'), { status: 'approved' }),
    );
  });
});

describe('hidden prizes stay hidden from children', () => {
  it('refuses a child reading a prize document', async () => {
    const db = asKid();
    await assertFails(getDoc(doc(db, 'households', HID, 'prizes', 'prize1')));
  });

  it('refuses a child listing the prizes collection', async () => {
    const db = asKid();
    await assertFails(getDocs(collection(db, 'households', HID, 'prizes')));
  });

  it('lets a parent read prizes', async () => {
    const db = asDad();
    await assertSucceeds(getDocs(collection(db, 'households', HID, 'prizes')));
  });

  it('lets a child see their own unlock exists, but not the prize behind it', async () => {
    const db = asKid();
    await assertSucceeds(
      getDocs(
        query(collection(db, 'households', HID, 'prizeUnlocks'), where('childId', '==', KID)),
      ),
    );
    await assertFails(getDoc(doc(db, 'households', HID, 'prizes', 'prize1')));
  });

  it('refuses a child writing an unlock for themselves', async () => {
    const db = asKid();
    await assertFails(
      setDoc(doc(db, 'households', HID, 'prizeUnlocks', 'prize1__kid-uid'), {
        prizeId: 'prize1',
        childId: KID,
        revealedAt: serverTimestamp(),
      }),
    );
  });

  it('refuses a child creating a prize with a threshold of one', async () => {
    const db = asKid();
    await assertFails(
      setDoc(doc(db, 'households', HID, 'prizes', 'cheap'), {
        title: 'Free stuff',
        metric: 'empathy',
        threshold: 1,
        childId: KID,
        active: true,
      }),
    );
  });
});

describe('minutes cannot be invented', () => {
  it('refuses a child writing a ledger entry', async () => {
    const db = asKid();
    await assertFails(
      setDoc(doc(db, 'households', HID, 'ledger', 'fake'), {
        childId: KID,
        deltaMinutes: 9999,
        deltaEmpathy: 0,
        note: 'Free minutes',
      }),
    );
  });

  it('refuses a child writing their own stats cache', async () => {
    const db = asKid();
    await assertFails(
      setDoc(
        doc(db, 'households', HID, 'stats', KID),
        { availableMinutes: 9999 },
        { merge: true },
      ),
    );
  });

  it('refuses even a parent editing ledger history', async () => {
    // Append-only applies to us too. The ledger is the audit trail.
    const db = asDad();
    await assertFails(
      updateDoc(doc(db, 'households', HID, 'ledger', 'l1'), { deltaMinutes: 500 }),
    );
  });

  it('lets a parent append a ledger entry', async () => {
    const db = asDad();
    await assertSucceeds(
      setDoc(doc(db, 'households', HID, 'ledger', 'new1'), {
        childId: KID,
        deltaMinutes: 20,
        deltaEmpathy: 0,
        note: 'Dishes',
      }),
    );
  });

  it('refuses a child approving their own chore claim', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'households', HID, 'completions', 'c1'), {
        choreId: 'chore1',
        childId: KID,
        status: 'pending',
      });
    });
    const db = asKid();
    await assertFails(
      updateDoc(doc(db, 'households', HID, 'completions', 'c1'), {
        status: 'approved',
        minutesAwarded: 20,
      }),
    );
  });

  it('refuses a child claiming a chore with an award already attached', async () => {
    const db = asKid();
    await assertFails(
      setDoc(doc(db, 'households', HID, 'completions', 'c2'), {
        choreId: 'chore1',
        childId: KID,
        status: 'pending',
        claimedAt: serverTimestamp(),
        minutesAwarded: 500,
      }),
    );
  });

  it('refuses a child claiming a chore on a sibling’s behalf', async () => {
    const db = asKid();
    await assertFails(
      setDoc(doc(db, 'households', HID, 'completions', 'c3'), {
        choreId: 'chore1',
        childId: SIB,
        status: 'pending',
        claimedAt: serverTimestamp(),
      }),
    );
  });

  it('lets a child claim a chore for themselves as pending', async () => {
    const db = asKid();
    await assertSucceeds(
      setDoc(doc(db, 'households', HID, 'completions', 'c4'), {
        choreId: 'chore1',
        childId: KID,
        status: 'pending',
        claimedAt: serverTimestamp(),
      }),
    );
  });
});

describe('the cashout gate cannot be walked around', () => {
  it('refuses a child marking their own grant granted', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'households', HID, 'grants', 'g1'), {
        childId: KID,
        minutes: 30,
        status: 'requested',
        requestedBy: KID,
      });
    });
    const db = asKid();
    await assertFails(
      updateDoc(doc(db, 'households', HID, 'grants', 'g1'), { status: 'granted' }),
    );
  });

  it('lets a child request a cashout', async () => {
    const db = asKid();
    await assertSucceeds(
      setDoc(doc(db, 'households', HID, 'grants', 'g2'), {
        childId: KID,
        minutes: 30,
        status: 'requested',
        requestedBy: KID,
        requestedAt: serverTimestamp(),
      }),
    );
  });

  it('refuses a negative-minute request that would credit instead of debit', async () => {
    const db = asKid();
    await assertFails(
      setDoc(doc(db, 'households', HID, 'grants', 'g3'), {
        childId: KID,
        minutes: -500,
        status: 'requested',
        requestedBy: KID,
        requestedAt: serverTimestamp(),
      }),
    );
  });

  it('refuses a child turning off their own baseline gate', async () => {
    const db = asKid();
    await assertFails(
      setDoc(
        doc(db, 'households', HID, 'childPolicies', KID),
        { requireBaselineForCashout: false },
        { merge: true },
      ),
    );
  });

  it('lets a child read their own track', async () => {
    const db = asKid();
    await assertSucceeds(getDoc(doc(db, 'households', HID, 'childPolicies', KID)));
  });

  it('refuses a child making a baseline chore disappear', async () => {
    const db = asKid();
    await assertFails(
      updateDoc(doc(db, 'households', HID, 'chores', 'chore1'), { active: false }),
    );
  });

  it('refuses a child raising their own daily cap', async () => {
    const db = asKid();
    await assertFails(
      setDoc(
        doc(db, 'households', HID, 'config', 'settings'),
        { dailyChoreMinuteCap: 9999 },
        { merge: true },
      ),
    );
  });
});

describe('siblings and outsiders', () => {
  it('refuses a child reading a sibling’s ledger', async () => {
    const db = asKid();
    await assertFails(getDoc(doc(db, 'households', HID, 'ledger', 'l2')));
  });

  it('refuses a child listing the whole ledger unscoped', async () => {
    const db = asKid();
    await assertFails(getDocs(collection(db, 'households', HID, 'ledger')));
  });

  it('lets a child list their own ledger when scoped', async () => {
    const db = asKid();
    await assertSucceeds(
      getDocs(query(collection(db, 'households', HID, 'ledger'), where('childId', '==', KID))),
    );
  });

  it('refuses a child promoting themselves to parent', async () => {
    const db = asKid();
    await assertFails(
      updateDoc(doc(db, 'households', HID, 'members', KID), { role: 'parent' }),
    );
  });

  it('refuses an outsider reading anything in the household', async () => {
    const db = asStranger();
    await assertFails(getDoc(doc(db, 'households', HID, 'members', KID)));
    await assertFails(getDocs(collection(db, 'households', HID, 'chores')));
  });

  it('refuses an outsider reading somebody else’s userIndex', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'userIndex', DAD), { householdId: HID });
    });
    const db = asStranger();
    await assertFails(getDoc(doc(db, 'userIndex', DAD)));
  });

  it('lets a parent add a child member', async () => {
    const db = asDad();
    await assertSucceeds(
      setDoc(doc(db, 'households', HID, 'members', 'newkid'), {
        householdId: HID,
        displayName: 'New Kid',
        role: 'child',
      }),
    );
  });

  it('lets a parent write a new member’s userIndex', async () => {
    const db = asDad();
    await assertSucceeds(setDoc(doc(db, 'userIndex', 'newkid'), { householdId: HID }));
  });
});
