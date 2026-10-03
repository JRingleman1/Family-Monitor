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
 * THIS SCRIPT NEVER OVERWRITES YOUR EDITS.
 *
 * An earlier version matched rows by title and updated them, which was
 * destructive in two ways at once: renaming a prize in the app meant the
 * original title matched nothing, so re-running pasted the placeholder back in
 * alongside the renamed one; and editing a chore's minutes while keeping its
 * title meant re-running silently reverted them.
 *
 * Every row this script creates now carries a stable `seedKey`, so it can
 * recognise its own work regardless of what you have since renamed. By default
 * anything already present is LEFT ALONE. Your titles, your minute values and
 * your tuned tracks survive every re-run.
 *
 * Flags:
 *   --dry-run   Show what would happen and write nothing.
 *   --update    Deliberately overwrite seeded rows back to the defaults in
 *               tracks.mjs. Only use this when you want the defaults back.
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
import { findExisting, planRow, seedKey } from './seed-plan.mjs';

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

const dryRun = args['dry-run'] === 'true';
const update = args.update === 'true';

if (dryRun) console.log('\n-- DRY RUN: nothing will be written --\n');

const summary = { created: 0, skipped: 0, updated: 0 };

/* ------------------------------------------------------------- policies */

const existingPolicies = await getDocs(
  collection(db, 'households', householdId, 'childPolicies'),
);
const policyIds = new Set(existingPolicies.docs.map((d) => d.id));

for (const [child, track] of [
  [kidA, TRACK_A],
  [kidB, TRACK_B],
]) {
  const exists = policyIds.has(child.id);
  if (exists && !update) {
    console.log(`Policy for ${child.displayName}: already set, left alone`);
    summary.skipped += 1;
    continue;
  }
  if (!dryRun) {
    await setDoc(
      doc(db, 'households', householdId, 'childPolicies', child.id),
      { ...track.policy },
      { merge: true },
    );
  }
  console.log(
    `Policy for ${child.displayName}: ${exists ? 'reset to' : 'set to'} ${track.policy.label}`,
  );
  if (exists) summary.updated += 1;
  else summary.created += 1;
}

/* --------------------------------------------------------------- chores */

const existingChores = await getDocs(collection(db, 'households', householdId, 'chores'));
const choreBySeedKey = new Map();
const choreByTitle = new Map();
for (const d of existingChores.docs) {
  const data = d.data();
  if (data.seedKey) choreBySeedKey.set(data.seedKey, d);
  choreByTitle.set(String(data.title).toLowerCase(), d);
}

const choreBatch = writeBatch(db);
let choreWrites = 0;

function upsertChore(chore, assignedTo, trackKey) {
  const key = seedKey(trackKey, 'chore', chore.title);
  const found = findExisting({
    key,
    title: chore.title,
    bySeedKey: choreBySeedKey,
    byTitle: choreByTitle,
  });
  const action = planRow({
    existing: found?.doc,
    hasSeedKey: found?.matchedBy === 'seedKey',
    update,
  });

  if (action === 'skip') {
    summary.skipped += 1;
    return;
  }
  if (action === 'adopt') {
    // Tag a row from before seedKeys existed, without touching its content.
    if (!dryRun) {
      choreBatch.update(found.doc.ref, { seedKey: key });
      choreWrites += 1;
    }
    summary.skipped += 1;
    return;
  }

  const existing = found?.doc;
  const payload = {
    title: chore.title,
    description: chore.description ?? '',
    minutes: chore.minutes,
    kind: chore.kind ?? 'recurring',
    assignedTo,
    cooldownHours: chore.cooldownHours ?? 0,
    isBaseline: chore.isBaseline ?? false,
    active: true,
    seedKey: key,
  };

  if (dryRun) {
    console.log(`  would ${existing ? 'reset' : 'create'} chore: ${chore.title}`);
  } else if (existing) {
    choreBatch.update(existing.ref, payload);
    choreWrites += 1;
  } else {
    choreBatch.set(doc(collection(db, 'households', householdId, 'chores')), {
      ...payload,
      createdAt: serverTimestamp(),
    });
    choreWrites += 1;
  }

  if (existing) summary.updated += 1;
  else summary.created += 1;
}

for (const chore of TRACK_A.chores) upsertChore(chore, [kidA.id], TRACK_A.key);
for (const chore of TRACK_B.baselineChores) upsertChore(chore, [kidB.id], TRACK_B.key);
for (const chore of TRACK_B.chores) upsertChore(chore, [kidB.id], TRACK_B.key);

if (!dryRun && choreWrites > 0) await choreBatch.commit();

/* --------------------------------------------------------------- prizes */

const existingPrizes = await getDocs(collection(db, 'households', householdId, 'prizes'));
const prizeBySeedKey = new Map();
const prizeByTitle = new Map();
for (const d of existingPrizes.docs) {
  const data = d.data();
  if (data.seedKey) prizeBySeedKey.set(data.seedKey, d);
  prizeByTitle.set(String(data.title).toLowerCase(), d);
}

const prizeBatch = writeBatch(db);
let prizeWrites = 0;

function upsertPrize(prize, childId, trackKey) {
  const key = seedKey(trackKey, 'prize', prize.title);
  const found = findExisting({
    key,
    title: prize.title,
    bySeedKey: prizeBySeedKey,
    byTitle: prizeByTitle,
  });
  const action = planRow({
    existing: found?.doc,
    hasSeedKey: found?.matchedBy === 'seedKey',
    update,
  });

  if (action === 'skip') {
    summary.skipped += 1;
    return;
  }
  if (action === 'adopt') {
    if (!dryRun) {
      prizeBatch.update(found.doc.ref, { seedKey: key });
      prizeWrites += 1;
    }
    summary.skipped += 1;
    return;
  }

  const existing = found?.doc;
  const payload = {
    title: prize.title,
    metric: prize.metric,
    threshold: prize.threshold,
    childId,
    active: true,
    seedKey: key,
  };

  if (dryRun) {
    console.log(`  would ${existing ? 'reset' : 'create'} prize: ${prize.title}`);
  } else if (existing) {
    prizeBatch.update(existing.ref, payload);
    prizeWrites += 1;
  } else {
    prizeBatch.set(doc(collection(db, 'households', householdId, 'prizes')), {
      ...payload,
      createdAt: serverTimestamp(),
    });
    prizeWrites += 1;
  }

  if (existing) summary.updated += 1;
  else summary.created += 1;
}

for (const prize of TRACK_A.prizes) upsertPrize(prize, kidA.id, TRACK_A.key);
for (const prize of TRACK_B.prizes) upsertPrize(prize, kidB.id, TRACK_B.key);
for (const prize of SHARED_PRIZES) upsertPrize(prize, null, 'shared');

if (!dryRun && prizeWrites > 0) await prizeBatch.commit();

console.log(
  `\nCreated ${summary.created}, left alone ${summary.skipped}` +
    (summary.updated ? `, reset ${summary.updated}` : ''),
);

if (summary.skipped > 0 && !update) {
  console.log(
    'Rows already present were not touched, so anything you renamed or retuned\n' +
      'in the app is intact. Pass --update only if you want the defaults back.',
  );
}

if (dryRun) {
  console.log('\nDry run only. Nothing was written.\n');
} else {
  console.log(
    '\nDone.\n\n' +
      'Now do these three things, because the app cannot:\n' +
      `  1. Open Settings and set the primary caregiver, so the x${TRACK_B.policy.caregiverMultiplier} ` +
      'empathy multiplier lands on helping her.\n' +
      '  2. Rewrite every prize title marked BIG ONE. A placeholder prize is worse than no prize.\n' +
      '  3. Read docs/FAMILY_LINK.md so you know exactly what the app does and does not do\n' +
      '     when minutes are handed over.\n',
  );
}

process.exit(0);
