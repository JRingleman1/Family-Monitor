# Family Monitor

A screen-time economy for our house. Kids earn minutes by doing chores, earn
something rarer by doing genuine good for someone else, and work toward prizes
they cannot see.

Built to sit **alongside** Google Family Link, not to replace it.

## Read this first

**Google publishes no API for Family Link.** No third-party app can add screen
time to a Family Link–managed child account or Chromebook, and this one does not
pretend to. What it does is own the ledger and the incentives, then hand a parent
one clear instruction — "add 35 minutes for Bella" — with a link to Family Link and
a confirm button. The minutes leave the ledger only once you confirm you actually
added them.

That human step is the honest version. `docs/FAMILY_LINK.md` explains exactly why,
including why the Chrome Enterprise admin APIs are not the answer either.

## How the economy works

Two currencies, deliberately separate:

**Minutes** are spendable screen time, earned mostly from chores, and easy to
grind on purpose.

**Empathy points** are the only thing that moves a hidden prize. They come only
from good deeds nominated by an adult — a child can never nominate their own, which
is enforced in the Firestore security rules and not just in the UI. Chores cannot
buy a prize.

On top of that:

A deed where a kid gave up something real for somebody else issues a **12-hour
pass**, which is the rarest reward in the system.

Deeds that helped the **primary caregiver** are worth a multiple of anything else,
configurable per child. If the goal is for the kids to take work off Mom, that is
where the value sits.

Prizes are **hidden**. A kid's screen shows one of five vague bands — "something is
stirring", "you're getting close to something big" — and never a number, a
threshold, a percentage, or a title. There is a test asserting the hint text
contains no digits, and the prizes collection is parent-only in the rules, so the
secret never reaches a child's device at all.

Balances are **derived from an append-only ledger**, so every minute can be
explained line by line on the kid's own screen.

## Two tracks, because two kids

The same machinery runs opposite economies for the two of them, configured in
`scripts/tracks.mjs`.

**The Momentum track** is for a child whose real problem is starting, not
willingness. There is deliberately no "clean your room" chore anywhere in it —
that is a task with no visible first step. Instead there are many one-action jobs
("wrapper sweep", "bed zone only", "floor: bed to door"), short cooldowns, a
streak bonus that starts on day two, and prize rungs reachable within days, so the
system proves itself real before she decides it isn't.

**The Contribution track** is for a child who treats people as means. Cleaning up
after herself earns **zero** minutes — those chores instead *gate* her ability to
cash out at all. She banks everything she earns and simply cannot spend it while
her own mess is on the floor. That removes the leverage rather than paying to
remove it, which matters: pay a kid for basic decency and you have given it a
price she can withhold. Every earning chore on her track serves somebody else, and
her prize ladder runs on empathy, which she cannot self-award.

Consequences work the same way round. A parent can log a refusal or a job done
badly on purpose, which deducts minutes and can reset that day's streak. It
cannot touch empathy points, and there is no control for it: those points record
what a child did for somebody else, and refusing a chore doesn't make that
untrue. Chores stay out of the prize ladder in both directions, which is what
stops a kindness ladder turning into an obedience score. Every deduction lands
as a named line in the child's own ledger with the reason in the parent's words.

`docs/DESIGN.md` gives the reasoning behind every rule, including the failure mode
each one guards against.

### What this cannot do

It can make exploitation unprofitable and make the alternative visible. It cannot
make a child speak kindly to their mother. That is not a software problem.

## Stack

A React + TypeScript web app, installable to a phone home screen as a PWA, so it
works on both kids' phones and the Chromebook with nothing to install and no
Family Link install approval. Firestore for storage and real-time sync; Firebase
Auth for sign-in; Firebase Hosting. No server to run, so it works whether or not
any machine at home is on.

Kids sign in with their name and a 6-digit PIN. They need no email account and no
Google account.

## Layout

```
src/domain/     The economy engine. Pure functions, no Firebase, fully tested.
                This is where the rules live.
src/data/       Firestore reads, writes, and the transactions that must be atomic.
src/state/      Auth and the shared household subscription.
src/screens/    Kid app (one screen) and parent app (seven tabs).
firestore.rules The guarantees that actually hold: no self-nominated deeds, no
                child reading the prize list, no invented minutes.
src/rules/      45 tests proving those guarantees, against the emulator.
scripts/tracks.mjs  The two tracks, as data, with the reasoning written down.
scripts/seed.mjs    Loads them into a household.
docs/           Setup, the Family Link situation, and the design rationale.
```

## Getting started

`docs/SETUP.md`. About 30 minutes, most of it waiting on Firebase.

```bash
npm install
npm test            # 126 tests on the economy engine, no emulator needed
npm run test:rules  # 45 tests on the security rules, boots the emulator
npm run dev
```

Deploy the security rules **before** creating your household. Firestore in
production mode denies everything by default, so the first click fails without
them — and until they are live, the kid-facing guarantees above are cosmetic.

## License

Private. Family use only.
