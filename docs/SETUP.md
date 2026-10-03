# Setup

Roughly 30 minutes end to end, most of it waiting on Firebase.

## 1. Create the Firebase project

1. Go to the [Firebase console](https://console.firebase.google.com) and create a
   project. The free Spark plan is plenty for a family of five.
2. **Build → Firestore Database → Create database.** Start in production mode;
   the rules in this repo replace the defaults in step 4.
3. **Build → Authentication → Get started → Email/Password.** Enable it. Leave
   every other provider off — kids sign in with a name and a PIN against a
   synthetic address, and a Family Link–managed Google account cannot reliably
   consent to third-party sign-in anyway.
4. **Project settings → General → Your apps → Web app.** Register one and copy the
   config values.

## 2. Configure the app

```bash
cp .env.example .env.local
# paste the values from step 1.4 into .env.local
npm install
npm run dev
```

The Firebase web config is public by design — it identifies the project, it does
not authorise anything. Your data is protected by `firestore.rules`, which is why
step 3 is not optional.

## 3. Deploy the security rules

**Do this before creating your household, not after.** Firestore in production
mode ships with rules that deny every read and write, so the app cannot save
anything until the rules in this repo replace them. Getting this order wrong
means your first click fails with "Missing or insufficient permissions".

This is also the step that makes the kid-facing guarantees real rather than
cosmetic. Until these rules are live, nothing stops a child from reading the
hidden prize list or writing their own ledger entries.

```bash
npm install -g firebase-tools
firebase login
firebase use --add          # pick the project from step 1
firebase deploy --only firestore:rules,firestore:indexes
```

Do **not** run `firebase init`. The repo already has `firebase.json`,
`firestore.rules` and `firestore.indexes.json`, and `firebase init` offers to
overwrite them with defaults that either block everything or allow everything.

You can check the rules before trusting them with your family's data:

```bash
npm run test:rules
```

That boots the Firestore emulator and runs 45 tests against the real rules file,
covering every promise the app makes: a child cannot nominate their own good
deed, cannot read a prize title or threshold, cannot write the ledger, cannot
approve their own chore, cannot turn off their own cashout gate, and cannot read
a sibling's anything. If one of those fails, a claim made to your kids is false.

## 4. Create the household

Open the app, choose **Set up a new family**, and create your parent account.
Note the **family code** it shows you — kids type it once per device.

Then on the **Family** tab, add:

- The other parent, with their email and a password.
- Each kid, with their name and a **6-digit PIN**. Six, not four: Firebase rejects
  passwords under six characters.

On the **Settings** tab, set the **primary caregiver**. Until you do, the empathy
multiplier never applies to anything.

## 5. Load the two tracks

```bash
node scripts/seed.mjs \
  --email you@example.com --password 'your-password' \
  --track-a "YoungerKidName" --track-b "OlderKidName"
```

`--track-a` gets the Momentum track: many tiny jobs, short cooldowns, a streak
bonus from day two, prize rungs reachable in days, no cashout gate.

`--track-b` gets the Contribution track: her own cleanup pays nothing and gates
cashing out, every earning chore serves somebody else, and the prize ladder runs
on empathy with rungs far apart.

The reasoning behind every value is written down in `scripts/tracks.mjs`. Read it
before you tune anything.

Re-running the script never overwrites your edits. Every row it creates carries
a stable `seedKey`, so it recognises its own work even after you rename things,
and anything already present is left alone. Rename prizes, retune minutes and
adjust the tracks freely.

Two flags if you need them. `--dry-run` reports what it would do and writes
nothing. `--update` deliberately resets the seeded rows back to the defaults in
`scripts/tracks.mjs`, which is the only way to lose your changes and takes an
explicit choice.

**Then rewrite every prize title marked `BIG ONE`.** A placeholder prize is worse
than no prize.

## 6. Publish it

```bash
npm run build
firebase deploy --only hosting
```

Firebase Hosting gives you a URL on `*.web.app`. On each kid's phone, open it in
Chrome and use **Add to Home Screen** — it then behaves like an installed app with
no app store involved and no Family Link install approval needed. On the
Chromebook, just bookmark it or install it from the address bar.

## Local development against emulators

To work on it without touching live data:

```bash
npm run emulators      # in one terminal
# set VITE_USE_EMULATORS=true in .env.local
npm run dev            # in another
```

## Checks

```bash
npm test               # domain engine and seed logic, 141 tests, no emulator
npm run test:rules     # security rules, 45 tests, boots the emulator
npm run typecheck
npm run build
```

The domain engine in `src/domain/` has no Firebase in it, which is why those
tests run in under a second. That is where the rules of the economy live, and it
is the code most worth keeping honest.

The rules tests in `src/rules/` are the other half: the economy engine decides
what *should* happen, and the rules decide what a determined 11-year-old with a
browser console *can* make happen.

## About `npm audit`

A fresh install reports a handful of advisories. As of the last check they break
down like this, and neither group reaches the app your kids load:

Two moderate advisories in `@vitest/mocker`, which is the test runner's mocking
layer. It runs only when you run tests.

Several high advisories tracing to `@grpc/grpc-js`, which the Firebase SDK pins
at a version with no patched release available yet. gRPC is the SDK's **Node**
transport; in a browser Firestore uses WebChannel instead, and the gRPC code is
tree-shaken out of the production bundle. This was verified rather than assumed
— the built bundle contains none of the library's markers. The only place it
actually executes is `scripts/seed.mjs`, which you run once, locally, against
your own project.

Do **not** run `npm audit fix --force`. It will upgrade majors and break the
build to fix something that is not in your app.
