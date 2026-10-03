# How this app relates to Google Family Link

## The short version

**Google publishes no API for Family Link.** There is no REST endpoint, no SDK, no
OAuth scope, and no documented mechanism by which a third-party application can
add screen time to a Family Link–managed child account or Chromebook. Family Link
is a closed consumer product, controlled only from the Family Link app and from
families.google.com.

This app therefore does **not** grant screen time. It cannot. Anything that
claims otherwise is either using an undocumented interface that will break, or
is not doing what it says.

What this app does instead is own the *economy* and leave Family Link to do the
*enforcement*:

- The app tracks what was earned, by whom, and why, in an append-only ledger.
- When a kid wants to spend minutes, they raise a request.
- A parent gets that request with the exact number, adds that much bonus time
  inside Family Link by hand, and confirms it here.
- Only on that confirmation do the minutes leave the ledger.

One human step, twice or three times a day. That is the cost of the honest
version.

## What about the Chrome Enterprise / Education admin APIs?

Those are real APIs, and they are a different product. Chrome Enterprise and
Chrome Education Upgrade manage Chromebooks enrolled in a Google Workspace
domain, through the Admin SDK. They are paid products for organisations, they
require enrolling the devices into a managed domain, and they do not deal in
"minutes of screen time" for a child account. Migrating two kids' personal
Chromebooks into a managed Workspace domain to get an API would be a large
change with its own consequences, and it still would not give you the thing
Family Link gives you.

## Why the confirmation button is worded the way it is

The button says **"I added it in Family Link"**, not "Grant". That is deliberate.

Confirming without actually adding the time is the single action that breaks the
whole system, because the kid loses minutes they never received. Once that
happens twice, the ledger is fiction and they will stop trusting it — correctly.
If you cannot add the time right now, use **Not now** instead; the request is
cancelled and the minutes stay banked.

## Passes

A 12-hour sacrifice pass has no Family Link equivalent either. To honour one,
either turn the daily limit off for that window or raise it by the pass length,
then mark the pass used here.

## If Google ever ships an API

The handoff is deliberately isolated. `settleGrant()` in `src/data/store.ts` is
the only place minutes leave the ledger, and `GrantScreenTime.tsx` is the only
screen that drives it. An automated grant would replace the parent's
confirmation in those two places and nothing else would need to change.
