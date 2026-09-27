# Why the app is shaped this way

Every rule in here exists because of a specific failure mode. Changing one
without knowing which failure it was guarding against is how a chore app turns
into a chore app nobody uses.

## Two currencies, not one

- **Minutes** are spendable screen time. They come mostly from chores and they
  are deliberately easy to grind.
- **Empathy points** are the only currency that moves a hidden prize. They come
  *only* from adult-nominated good deeds, never from chores.

Keeping them separate is what stops "empty the dishwasher twelve times" from
buying a reward meant for kindness.

## A child can never nominate their own good deed

Enforced in the domain layer, in the UI, and — the one that actually counts — in
`firestore.rules`, which refuses a deed document created by a child even if they
reach the API directly with a browser console.

If a child could self-report kindness, empathy points would be worthless within a
week, and so would every prize behind them.

## The ledger is append-only and balances are derived

Nothing stores "minutes remaining" as truth. `computeBalance()` sums the ledger.
A `stats` document caches the totals so a transaction can check a prize threshold
without reading every line, but it is a cache and `recomputeStats()` rebuilds it
from the ledger whenever it drifts.

This means every number a kid sees can be explained line by line, in words, on
their own screen. "Where did my minutes go" has an answer.

## Hidden prizes show a band, never a number

`childHint()` returns one of five vague bands and a sentence. It never returns a
threshold, a percentage, a day count, or a prize title, and there is a test that
asserts the message contains no digits at all. The prizes collection is
parent-only *in the security rules*, so a child's device never receives the
secret in the first place.

A visible number turns kindness into a grind. A band motivates without giving
anyone something to optimise.

## Prizes are templates; unlocks are per child

The first version had a single `unlockedBy` field on each prize, which meant
whichever kid crossed a threshold first locked their sibling out of that prize
forever. With two kids that is a bug that surfaces the first time the second one
works hard and gets nothing.

Prizes are now household templates, and `prizeUnlocks` records one row per child
per prize, with a deterministic document id so two simultaneous approvals cannot
double-unlock.

## A prize can watch one of three counters

`empathy`, `streakDays`, or `lifetimeMinutes`.

This exists because two children can need opposite things from the same machine.
A child whose difficulty is *starting anything* needs a ladder built on turning up
day after day. A child whose difficulty is *seeing past herself* needs one built
on empathy, which she cannot self-award. Same mechanics, opposite behaviour.

## Baseline chores pay nothing and gate cashing out

A baseline chore is one that is simply expected: your own plate, your own floor,
your own laundry. It earns zero minutes.

For a child whose policy sets `requireBaselineForCashout`, those chores instead
stand between banked minutes and spending them. She earns everything she earns.
She just cannot cash out while her own mess is on the floor.

This is the answer to a child who negotiates with her own basic decency. Paying
her to clean up after herself would establish a price for it and hand her a lever
to withhold. A gate makes withholding worthless instead of profitable.

Two details that matter:

- A baseline chore is **never** blocked by the daily earning cap. It pays nothing
  and it is the only route to spending, so locking it out at the cap would be
  exactly backwards. There is a test for this.
- The gate withholds *spending*, never *earning*. It is not a fine. Nothing is
  ever taken away.

## Streaks beat volume

`currentStreakDays()` counts consecutive local days with at least one approved
chore, and today only counts if something was approved today — the number never
flatters anyone. A policy can pay a bonus once the streak is long enough.

Set the threshold low, two or three days, for a child who needs to feel the
machine pay out before she believes it is real. Ten small days should beat one
heroic Saturday, because the habit is the point.

Baseline chores count toward a streak even though they pay no minutes. That lets a
streak-based prize reward the habit of keeping your own space without putting a
price on it.

## The daily cap trims, it does not reject

Hitting the cap reduces the award rather than refusing it, and the ledger line
says so in words: "daily cap reached, full value was 30". A kid who over-works
still banks something and is told why it was less.

## Two adults in the loop by default

The nominator of a deed is not the one who confirms it. `allowSelfConfirm` exists
because one parent is often alone with the kids and a real deed should not go
unrewarded for that, but it is off by default.

## What none of this can do

The app can make exploitation unprofitable and make the alternative visible. It
cannot make a child speak kindly to their mother. That part is not a software
problem and this file should not pretend it is.
