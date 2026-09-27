/**
 * The two prize tracks, as data.
 *
 * Edit the names, the minute values and above all the prize titles - the prizes
 * only work if they are things these two actually want. The structure is the
 * part that matters, and the reasoning for each choice is written down here so
 * that six months from now it is obvious why the two tracks are shaped
 * differently, and so that changing one does not quietly break the other.
 */

/* ------------------------------------------------------------------------ */
/*  TRACK A - the 8 year old                                                */
/*                                                                          */
/*  Read of the problem: this is an activation problem, not a character      */
/*  one. A bedroom that has become a nest is not a chore she is dodging, it  */
/*  is a task with no visible first step, and "clean your room" is a demand  */
/*  she has no way to begin. Adults freeze on those too.                    */
/*                                                                          */
/*  So the design is:                                                       */
/*   - There is NO "clean your room" chore. It is deliberately absent. Every */
/*     job here is one zone or one action, small enough to start without     */
/*     deciding anything.                                                   */
/*   - Short cooldowns, so several tiny wins fit in a day.                   */
/*   - Her prize ladder runs on consecutive days, not on volume. Turning up  */
/*     daily is the habit; one heroic Saturday is not.                       */
/*   - The streak bonus starts on day TWO. She has to feel the machine pay   */
/*     out almost immediately or she will correctly conclude it is fake.     */
/*   - No cashout gate. She needs early wins more than she needs a fence.    */
/* ------------------------------------------------------------------------ */

export const TRACK_A = {
  key: 'momentum',
  policy: {
    label: 'Momentum track',
    dailyChoreMinuteCap: 90,
    requireBaselineForCashout: false,
    streakBonusMinutes: 10,
    streakBonusAfterDays: 2,
    deedEmpathyPoints: 10,
    sacrificeEmpathyPoints: 40,
    deedMinutes: 15,
    caregiverMultiplier: 2,
  },

  chores: [
    {
      title: 'Wrapper sweep',
      description:
        'Every wrapper and empty packet in your room into the bin. Only wrappers. ' +
        'Nothing else counts and nothing else is needed.',
      minutes: 8,
      cooldownHours: 8,
      isBaseline: false,
      kind: 'recurring',
    },
    {
      title: 'Beat the timer: five minute tidy',
      description:
        'Set a timer for five minutes. Tidy anything in your room until it rings, ' +
        'then stop. Stopping when it rings is part of the job.',
      minutes: 10,
      cooldownHours: 6,
      isBaseline: false,
      kind: 'recurring',
    },
    {
      title: 'Bed zone only',
      description: 'Clear the bed. Just the bed. The floor is a different job.',
      minutes: 10,
      cooldownHours: 20,
      isBaseline: false,
      kind: 'recurring',
    },
    {
      title: 'Floor zone: bed to door',
      description:
        'Clear the strip of floor between your bed and the door so you can walk it. ' +
        'The rest of the floor is not this job.',
      minutes: 10,
      cooldownHours: 20,
      isBaseline: false,
      kind: 'recurring',
    },
    {
      title: 'Bag amnesty',
      description:
        'Bring one bag out of your room. Sort it into keep and bin with a parent. ' +
        'One bag. Not two.',
      minutes: 15,
      cooldownHours: 20,
      isBaseline: false,
      kind: 'recurring',
    },
    {
      title: 'Old food patrol',
      description: 'Any plate, cup, or old food out of your room and into the kitchen.',
      minutes: 8,
      cooldownHours: 8,
      isBaseline: false,
      kind: 'recurring',
    },
    {
      title: 'Plate to the sink',
      description: 'Your plate and cup from a meal, into the sink, without being asked.',
      minutes: 5,
      cooldownHours: 4,
      isBaseline: false,
      kind: 'recurring',
    },
    {
      title: 'Trash walk',
      description: 'Take the kitchen bin out and put a new bag in.',
      minutes: 10,
      cooldownHours: 20,
      isBaseline: false,
      kind: 'recurring',
    },
    {
      title: 'Ten minutes with the baby',
      description:
        'Hold or entertain the baby for ten minutes so Mom can eat or sit down.',
      minutes: 15,
      cooldownHours: 8,
      isBaseline: false,
      kind: 'recurring',
    },
  ],

  // Streak rungs are close together at the bottom on purpose. The first one is
  // reachable in two days, because the first prize has to land before she
  // decides none of this is real.
  prizes: [
    { title: 'You pick dessert tonight', metric: 'streakDays', threshold: 2 },
    { title: 'Stay up thirty minutes late on Friday', metric: 'streakDays', threshold: 5 },
    { title: 'Pick the family movie and Dad makes the popcorn', metric: 'streakDays', threshold: 8 },
    { title: 'Trampoline park trip', metric: 'streakDays', threshold: 12 },
    { title: 'BIG ONE - fill this in with something she is desperate for', metric: 'streakDays', threshold: 21 },
    // Kindness still counts for her, just on a shorter ladder than her sister's.
    { title: 'Something small and hers, for being kind', metric: 'empathy', threshold: 40 },
    { title: 'A day out, just her and a parent', metric: 'empathy', threshold: 120 },
  ],
};

/* ------------------------------------------------------------------------ */
/*  TRACK B - the 11 year old                                               */
/*                                                                          */
/*  Read of the problem: the described behaviour - talking down to her mom,  */
/*  guilting her into doing her work, never cleaning up after herself - is   */
/*  a pattern where other people are means to an end. The danger of a        */
/*  rewards app here is real and worth stating: pay her for cleaning up      */
/*  after herself and you have priced her basic decency, which hands her a   */
/*  new lever to withhold and negotiate with.                               */
/*                                                                          */
/*  So this track is built inside-out from her sister's:                    */
/*   - Cleaning up after HERSELF pays ZERO. Those are baseline chores.       */
/*     Instead they GATE cashing out. She can bank all the minutes she       */
/*     likes, and the bank window does not open while her own mess is on     */
/*     the floor. Withholding stops being profitable instead of being paid.  */
/*   - Every earning chore serves somebody else or the household. None of    */
/*     them are her own cleanup.                                            */
/*   - Her prize ladder runs on empathy, which is nominated by an adult and  */
/*     cannot be self-claimed, and the rungs are far apart. No amount of     */
/*     chore grinding moves it.                                             */
/*   - Deliberately, one rung is a prize she gives away rather than gets.    */
/*   - One streak rung exists for keeping her own space, because baseline    */
/*     chores still count toward a streak even though they pay nothing.      */
/*     That rewards the habit without pricing the decency.                   */
/*                                                                          */
/*  What this cannot do: an app will not stop her speaking to her mother     */
/*  that way. It makes the exploitation unprofitable and the alternative     */
/*  visible. The line-holding is yours.                                     */
/* ------------------------------------------------------------------------ */

export const TRACK_B = {
  key: 'contribution',
  policy: {
    label: 'Contribution track',
    dailyChoreMinuteCap: 120,
    requireBaselineForCashout: true,
    // A small streak bonus, well behind her sister's, so daily habit still pays
    // but the main ladder stays empathy.
    streakBonusMinutes: 5,
    streakBonusAfterDays: 4,
    deedEmpathyPoints: 10,
    sacrificeEmpathyPoints: 40,
    // Helping Mom is worth triple for her specifically. Mom is the person she
    // currently treats as staff, so Mom is where the value has to sit.
    caregiverMultiplier: 3,
    deedMinutes: 15,
  },

  // Baseline: expected, pays nothing, gates cashing out.
  baselineChores: [
    {
      title: 'Your own dishes in the sink',
      description: 'Every plate, cup and bowl of yours out of your room and into the sink.',
      minutes: 0,
      cooldownHours: 0,
      isBaseline: true,
      kind: 'recurring',
    },
    {
      title: 'Your own floor clear',
      description: 'Your floor walkable. Your things, put away by you.',
      minutes: 0,
      cooldownHours: 0,
      isBaseline: true,
      kind: 'recurring',
    },
    {
      title: 'Your own laundry in the basket',
      description: 'Your clothes off the floor and into the basket, not onto a chair.',
      minutes: 0,
      cooldownHours: 0,
      isBaseline: true,
      kind: 'recurring',
    },
    {
      title: 'Whatever you used, put back',
      description:
        'Anything you got out today - snacks, chargers, craft stuff - back where it lives.',
      minutes: 0,
      cooldownHours: 0,
      isBaseline: true,
      kind: 'recurring',
    },
  ],

  // Earning: every one of these is work for someone else or for the house.
  chores: [
    {
      title: 'Unload the dishwasher',
      description: 'All of it, put away where it belongs.',
      minutes: 20,
      cooldownHours: 20,
      isBaseline: false,
      kind: 'recurring',
    },
    {
      title: 'Fold and put away a full load',
      description: 'A whole load of family laundry, folded and in the right drawers.',
      minutes: 25,
      cooldownHours: 20,
      isBaseline: false,
      kind: 'recurring',
    },
    {
      title: 'Twenty minutes with the baby so Mom can eat',
      description:
        'Mom sits down and eats a meal while you have the baby. Twenty minutes, phone down.',
      minutes: 25,
      cooldownHours: 8,
      isBaseline: false,
      kind: 'recurring',
    },
    {
      title: 'Get your sister’s breakfast',
      description: 'Make it, put it in front of her, clear it after.',
      minutes: 20,
      cooldownHours: 20,
      isBaseline: false,
      kind: 'recurring',
    },
    {
      title: 'Kitchen counters and table',
      description: 'Wiped down properly, not smeared around.',
      minutes: 15,
      cooldownHours: 12,
      isBaseline: false,
      kind: 'recurring',
    },
    {
      title: 'Sweep the kitchen floor',
      description: 'Swept and the pile actually picked up.',
      minutes: 15,
      cooldownHours: 20,
      isBaseline: false,
      kind: 'recurring',
    },
    {
      title: 'Take the trash and recycling out',
      description: 'Both, plus new bags in.',
      minutes: 15,
      cooldownHours: 20,
      isBaseline: false,
      kind: 'recurring',
    },
    {
      title: 'A job of Mom’s, done before she asks',
      description:
        'Something you know is on her list, done without being told. A parent decides ' +
        'whether it counts.',
      minutes: 25,
      cooldownHours: 12,
      isBaseline: false,
      kind: 'recurring',
    },
  ],

  // Empathy rungs are far apart and cannot be reached by chores at all. The
  // giving rung is intentional: the point is for a prize to feel good because
  // somebody else got something.
  prizes: [
    { title: 'You choose dinner for the whole house', metric: 'empathy', threshold: 60 },
    { title: 'A day out, just you and Dad', metric: 'empathy', threshold: 150 },
    {
      title: 'Forty dollars to spend on a present for somebody else, and we go together',
      metric: 'empathy',
      threshold: 300,
    },
    { title: 'BIG ONE - the thing she has been asking for all year', metric: 'empathy', threshold: 500 },
    // Two weeks of keeping her own space. Baseline chores pay nothing but do
    // count toward a streak, so this rewards the habit without buying it.
    { title: 'Something for her room, for two weeks of keeping it', metric: 'streakDays', threshold: 14 },
  ],
};

/** Shared prizes either of them can reach. */
export const SHARED_PRIZES = [
  {
    title: 'Family day out, chosen by whoever got here first',
    metric: 'empathy',
    threshold: 200,
  },
];

export const TRACKS = { A: TRACK_A, B: TRACK_B };
