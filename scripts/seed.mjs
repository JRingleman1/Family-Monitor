#!/usr/bin/env node
/**
 * Load the two tracks into a household.
 *
 * Runs as a parent, through the ordinary client SDK and the ordinary security
 * rules, so there is no service-account key to create or leak. Whatever this
 * script can write, a parent could write by hand in the app.
 *
 * Usage:
 *   node scripts/seed.mjs --email you@example.com --password 'yourpassword' \
 *        --track-a "Ellie" --track-b "Maya"
 *
 * Re-running is safe: chores and prizes are matched on title, so an existing
 * one is updated rather than duplicated.
 */

import { readFileSync } from 'node:fs';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { SHARED_PRIZES, TRACK_A, TRACK_B } from './tracks.mjs';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    out[key] = next && !next.startsWith('--') ? next : 'true';
  }
  return out;
}

function loadEnvFile(path) {
  const env = {};
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return env;
  }
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

function die(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

const args = parseArgs(process.argv.slice(2));
const env = { ...loadEnvFile('.env.local'), ...loadEnvFile('.env'), ...process.env };

const email = args.email ?? env.SEED_PARENT_EMAIL;
const password = args.password ?? env.SEED_PARENT_PASSWORD;
const trackAName = args['track-a'];
const trackBName = args['track-b'];

if (!email || !password) {
  die(
    'Need a parent sign-in. Pass --email and --password, or set SEED_PARENT_EMAIL\n' +
      'and SEED_PARENT_PASSWORD. This is the parent account you created in the app.',
  );
}
if (!trackAName || !trackBName) {
  die(
    'Need both kids’ names as they appear in the app.\n' +
      '  --track-a is the younger one (Momentum track: small jobs, fast streak rungs)\n' +
      '  --track-b is the older one (Contribution track: baseline gate, empathy ladder)',
  );
}
if (!env.VITE_FIREBASE_API_KEY || !env.VITE_FIREBASE_PROJECT_ID) {
  die('No Firebase config found. Copy .env.example to .env.local and fill it in first.');
}

const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
});
const auth = getAuth(app);
const db = getFirestore(app);

const credential = await signInWithEmailAndPassword(auth, email, password).catch((err) => {
  die(`Could not sign in as ${email}: ${err.message}`);
});

const indexSnap = await getDoc(doc(db, 'userIndex', credential.user.uid));
if (!indexSnap.exists()) die('That account is not attached to a household yet.');
const householdId = indexSnap.data().householdId;
console.log(`Household: ${householdId}`);

const memberSnap = await getDocs(collection(db, 'households', householdId, 'members'));
const members = memberSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

function findChild(name) {
  const match = members.find(
    (m) => m.role === 'child' && String(m.displayName).toLowerCase() === name.toLowerCase(),
  );
  if (!match) {
    const known = members
      .filter((m) => m.role === 'child')
      .map((m) => m.displayName)
      .join(', ');
    die(`No child called "${name}" in this household. Kids found: ${known || 'none'}`);
  }
  return match;
}

const kidA = findChild(trackAName);
const kidB = findChild(trackBName);
console.log(`Momentum track    -> ${kidA.displayName} (${kidA.id})`);
console.log(`Contribution track -> ${kidB.displayName} (${kidB.id})`);

/* ------------------------------------------------------------- policies */

for (const [child, track] of [
  [kidA, TRACK_A],
  [kidB, TRACK_B],
]) {
  await setDoc(
    doc(db, 'households', householdId, 'childPolicies', child.id),
    { ...track.policy },
    { merge: true },
  );
  console.log(`Policy written for ${child.displayName}: ${track.policy.label}`);
}

/* --------------------------------------------------------------- chores */

const existingChores = await getDocs(collection(db, 'households', householdId, 'chores'));
const choreByTitle = new Map(
  existingChores.docs.map((d) => [String(d.data().title).toLowerCase(), d.ref]),
);

const choreBatch = writeBatch(db);
let choresWritten = 0;

function upsertChore(chore, assignedTo) {
  const key = chore.title.toLowerCase();
  const payload = {
    title: chore.title,
    description: chore.description ?? '',
    minutes: chore.minutes,
    kind: chore.kind ?? 'recurring',
    assignedTo,
    cooldownHours: chore.cooldownHours ?? 0,
    isBaseline: chore.isBaseline ?? false,
    active: true,
  };
  const existing = choreByTitle.get(key);
  if (existing) {
    choreBatch.update(existing, payload);
  } else {
    choreBatch.set(doc(collection(db, 'households', householdId, 'chores')), {
      ...payload,
      createdAt: serverTimestamp(),
    });
  }
  choresWritten += 1;
}

for (const chore of TRACK_A.chores) upsertChore(chore, [kidA.id]);
for (const chore of TRACK_B.baselineChores) upsertChore(chore, [kidB.id]);
for (const chore of TRACK_B.chores) upsertChore(chore, [kidB.id]);

await choreBatch.commit();
console.log(`Chores written: ${choresWritten}`);

/* --------------------------------------------------------------- prizes */

const existingPrizes = await getDocs(collection(db, 'households', householdId, 'prizes'));
const prizeByTitle = new Map(
  existingPrizes.docs.map((d) => [String(d.data().title).toLowerCase(), d.ref]),
);

const prizeBatch = writeBatch(db);
let prizesWritten = 0;

function upsertPrize(prize, childId) {
  const payload = {
    title: prize.title,
    metric: prize.metric,
    threshold: prize.threshold,
    childId,
    active: true,
  };
  const existing = prizeByTitle.get(prize.title.toLowerCase());
  if (existing) {
    prizeBatch.update(existing, payload);
  } else {
    prizeBatch.set(doc(collection(db, 'households', householdId, 'prizes')), {
      ...payload,
      createdAt: serverTimestamp(),
    });
  }
  prizesWritten += 1;
}

for (const prize of TRACK_A.prizes) upsertPrize(prize, kidA.id);
for (const prize of TRACK_B.prizes) upsertPrize(prize, kidB.id);
for (const prize of SHARED_PRIZES) upsertPrize(prize, null);

await prizeBatch.commit();
console.log(`Prizes written: ${prizesWritten}`);

console.log(
  '\nDone.\n\n' +
    'Now do these three things, because the app cannot:\n' +
    `  1. Open Settings and set the primary caregiver to Mom, so the x${TRACK_B.policy.caregiverMultiplier} ` +
    'empathy multiplier lands on helping her.\n' +
    '  2. Rewrite every prize title marked BIG ONE. A placeholder prize is worse than no prize.\n' +
    '  3. Read docs/FAMILY_LINK.md so you know exactly what the app does and does not do\n' +
    '     when minutes are handed over.\n',
);

process.exit(0);
