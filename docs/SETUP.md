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
step 4 is not optional.

## 3. Create the household

Open the app, choose **Set up a new family**, and create your parent account. Note
the **family code** it shows you — kids type it once per device.

Then on the **Family** tab, add:

- The other parent, with their email and a password.
- Each kid, with their name and a **6-digit PIN**. Six, not four: Firebase rejects
  passwords under six characters.

On the **Settings** tab, set the **primary caregiver**. Until you do, the empathy
multiplier never applies to anything.

## 4. Deploy the security rules

This is the step that makes the kid-facing guarantees real rather than cosmetic.

```bash
npm install -g firebase-tools
firebase login
firebase use --add          # pick the project from step 1
firebase deploy --only firestore:rules,firestore:indexes
```

Without this, the default rules either block everything or expose everything, and
a child could read the hidden prize list.

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

Re-running the script is safe — chores and prizes are matched on title and
updated rather than duplicated.

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
npm test               # domain engine, 114 tests
npm run typecheck
npm run build
```

The domain engine in `src/domain/` has no Firebase in it, which is why the tests
run in under a second and need no emulator. That is where the rules of the economy
live, and it is the code most worth keeping honest.
