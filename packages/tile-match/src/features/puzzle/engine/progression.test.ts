/**
 * How a level decides the next turn.
 *
 * Two things are being pinned, and they pull in opposite directions on purpose.
 *
 * The **default ladder** must keep the properties the game was tuned around — earned rather than clocked,
 * never easier as the streak grows, and the exact drift ramp it has always had. Those used to be global
 * truths asserted of the engine; they are now claims about one table, and this is where they live.
 *
 * The **stream** must be free to break both, because a gauntlet level is the point of having a second kind
 * of progression at all. A test that asserted monotonicity of *every* progression would forbid the feature.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  ANY_VARIETY,
  DEFAULT_LADDER,
  DRIFT_AT_COMBO,
  DRIFT_FLOOR,
  DRIFT_FULL_COMBO,
  DUO_POOL,
  QUICK_GENTLE_STRENGTH,
  SOLO_POOL,
  maxSlotsOf,
  planBeat,
  rampAt,
  tierFor,
  zonesFor,
  type Progression,
} from './progression';
import { MAX_SLOTS } from './slot-deal';
import { ARMOUR_HARD_AT, armourHpFor } from '../variety/armour/armour';
import { BOMB_CYCLE_AT } from '../variety/bomb/bomb';
import type { VarietyRequest } from '../variety/contract';

const LADDER = DEFAULT_LADDER as Extract<Progression, { kind: 'ladder' }>;

/** Every mechanic a beat is dealt, at a given streak and generator state. */
const mechanicsAt = (combo: number, rngState = 0, beatIndex = 0): readonly VarietyRequest[] =>
  planBeat(DEFAULT_LADDER, beatIndex, combo, rngState).varieties;

/**
 * The ids the ladder can roll at a given streak, swept over many generator states.
 *
 * The roll is derived from the generator rather than consuming it, so sweeping `rngState` is exactly what sweeping
 * runs and beats does — it is the same input.
 */
function rolledIdsAt(combo: number, samples = 400): Set<string> {
  const seen = new Set<string>();
  for (let i = 0; i < samples; i += 1) {
    for (const request of mechanicsAt(combo, i * 2_654_435_761, i % 7)) seen.add(request.id);
  }
  return seen;
}

// -------------------------------------------------------------- the ramp

test('a ramp is flat outside its window and linear inside it', () => {
  const ramp = { from: 0.5, to: 1, fromCombo: 4, toCombo: 14 };
  assert.equal(rampAt(ramp, 0), 0.5, 'below the window it holds its floor');
  assert.equal(rampAt(ramp, 4), 0.5);
  assert.equal(rampAt(ramp, 9), 0.75, 'halfway through the window is halfway up');
  assert.equal(rampAt(ramp, 14), 1);
  assert.equal(rampAt(ramp, 500), 1, 'above the window it holds its ceiling');
});

test('a zero-width ramp is its ceiling rather than a division by zero', () => {
  // Reachable through a hand-written level: `fromCombo === toCombo` is the natural way to say "no ramp".
  assert.equal(rampAt({ from: 0.2, to: 0.9, fromCombo: 5, toCombo: 5 }, 5), 0.9);
  assert.equal(rampAt({ from: 0.2, to: 0.9, fromCombo: 5, toCombo: 3 }, 5), 0.9);
});

// ------------------------------------------------------------ the ladder

test('the default ladder is the game as it has always played', () => {
  assert.equal(planBeat(DEFAULT_LADDER, 0, 0).slots, 1, 'no streak means a single');
  assert.equal(planBeat(DEFAULT_LADDER, 0, 1).slots, 2, 'one clean beat opens the double up');
  assert.equal(planBeat(DEFAULT_LADDER, 0, DRIFT_AT_COMBO).slots, 1, 'the drift rung drops back to one');
  assert.equal(planBeat(DEFAULT_LADDER, 0, 100).slots, MAX_SLOTS, 'the count stops at two');
});

test('the drift ramp reproduces the curve it replaced, exactly', () => {
  /**
   * The migration's arithmetic, spelled out. `Beat.drift` used to be
   * `DRIFT_FLOOR + (1 - DRIFT_FLOOR) * clamp01((combo - 4) / (14 - 4))`, computed inside the dealer. It is
   * now a ramp on the progression, and the numbers have to be identical or every drifting beat changed
   * difficulty in a refactor that claimed to change nothing.
   *
   * Asserted against the **ramp** rather than against a planned beat, which it used to be. Since the hard rungs
   * roll their mechanic, a given beat may not carry the drift at all — so reading a plan would have conflated two
   * questions: *is the curve right* and *did this beat happen to roll it*. The first is what matters here, and the
   * test below covers the second.
   */
  const expected = (combo: number) => {
    const span = DRIFT_FULL_COMBO - DRIFT_AT_COMBO;
    const climbed = Math.min(1, Math.max(0, (combo - DRIFT_AT_COMBO) / span));
    return DRIFT_FLOOR + (1 - DRIFT_FLOOR) * climbed;
  };

  for (let combo = DRIFT_AT_COMBO; combo <= DRIFT_FULL_COMBO + 5; combo += 1) {
    const actual = rampAt(LADDER.ramps.drift, combo);
    assert.ok(
      Math.abs(actual - expected(combo)) < 1e-12,
      `combo ${combo}: ${actual} against ${expected(combo)}`,
    );
  }
});

test('a rolled drift is dealt at the drift ramp, not at the shared one', () => {
  /**
   * The reason a per-id ramp still beats the wildcard, and it is a correctness rule rather than a preference.
   *
   * The drift reads its strength as a **gate** below `DRIFT_FLOOR` and as a strength at or above it, so a drift
   * dealt at the shared ramp's floor of 0.2 would sway at roughly a third of the floor amplitude — which is
   * precisely the failure the floor exists to prevent: the beat that introduces the sway looking like the still
   * beat before it.
   */
  const found = (() => {
    for (let i = 0; i < 400; i += 1) {
      const request = mechanicsAt(DRIFT_AT_COMBO, i * 2_654_435_761, i % 7).find(
        (entry) => entry.id === 'drift',
      );
      if (request) return request;
    }
    return null;
  })();

  assert.ok(found, 'the pool must be able to roll the drift at all');
  assert.equal(found.strength, DRIFT_FLOOR, 'and it must arrive at its own floor, not the shared one');
  assert.ok(DRIFT_FLOOR > LADDER.ramps[ANY_VARIETY].from, 'or this test proves nothing');
});

test('the still rungs carry nothing at all', () => {
  for (let combo = 0; combo < DRIFT_AT_COMBO; combo += 1) {
    // Swept over generator states as well as combos: a still rung has no pool, so no state may make it deal
    // anything. This is the assertion that would fail if a pool were ever added to the bottom of the ladder.
    assert.equal(rolledIdsAt(combo).size, 0, `combo ${combo} should be bare`);
  }
});

test('the ramp spans both hard rungs rather than restarting on the second', () => {
  /**
   * Why the ramps live on the progression and not on each rung.
   *
   * The hard rungs begin at combo 4 and the count doubles again at combo 6. Written per-rung, the second rung's
   * copy of the ramp would have restarted the climb from 6 — so the mechanic would have got *easier* at the moment
   * the ladder got harder. Held once, `fromCombo` is where the hard rungs begin regardless of which one is asking,
   * and the curve is continuous across the boundary.
   */
  /**
   * Asserted per **ramp**, not per plan, and the distinction is the one thing about this design worth internalising:
   * two mechanics' strengths are not comparable. The drift's floor is 0.55 and the shared floor is 0.2, so a beat
   * that rolled the drift at combo 5 and a bomb at combo 6 shows a "drop" that means nothing — the second beat is
   * not easier, it is a different question. Continuity is a property of each curve.
   */
  for (const ramp of [LADDER.ramps.drift, LADDER.ramps[ANY_VARIETY]]) {
    assert.ok(rampAt(ramp, 6) > rampAt(ramp, 5), 'a ramp must keep climbing across the rung boundary');
  }
  assert.equal(LADDER.ramps.drift.fromCombo, DRIFT_AT_COMBO);
  assert.equal(LADDER.ramps[ANY_VARIETY].fromCombo, DRIFT_AT_COMBO);
});

test('the quick race pins the variant-switching mechanics to their gentle form', () => {
  /**
   * The tuning that made the default level playable again, expressed as the constraint it actually is.
   *
   * `armour` and `bomb` change *kind* rather than degree at a threshold — armour to two hit points, the bomb to the
   * cycling form you can only wait out — and the quick race wants neither. Their ramps are flat and below both
   * thresholds, so no streak however long escalates them.
   *
   * Asserted against the varieties' **own** exported thresholds rather than a repeated 0.5. They live in their own
   * modules and only happen to be equal today; comparing to them is what stops that coincidence quietly ending.
   */
  assert.ok(QUICK_GENTLE_STRENGTH < ARMOUR_HARD_AT, 'armour would deal two hit points');
  assert.ok(QUICK_GENTLE_STRENGTH < BOMB_CYCLE_AT, 'the bomb would deal its cycling form');

  // Flat at every streak, including well past the top of every other ramp.
  for (const id of ['armour', 'bomb']) {
    for (const combo of [0, DRIFT_AT_COMBO, 6, DRIFT_FULL_COMBO, 100]) {
      assert.equal(
        rampAt(LADDER.ramps[id], combo),
        QUICK_GENTLE_STRENGTH,
        `'${id}' moved at combo ${combo}`,
      );
    }
  }

  // And end to end: whatever the roll, a dealt bomb is a `defuse` and dealt armour has one point.
  for (let i = 0; i < 300; i += 1) {
    for (const combo of [DRIFT_AT_COMBO, 6, 20, 60]) {
      for (const request of mechanicsAt(combo, i * 2_654_435_761, i % 7)) {
        if (request.id === 'armour') assert.equal(armourHpFor(request.strength), 1);
        if (request.id === 'bomb') assert.ok(request.strength < BOMB_CYCLE_AT);
      }
    }
  }
});

test('the quick race leaves the colour puzzles to the gauntlet', () => {
  /**
   * `crossed` and `hues` are registered, playable and deliberately **absent from the default level**.
   *
   * Both are colour-reading puzzles and both proved too much here. `hues` in particular makes the player *wait*,
   * which eats a race clock calibrated so a good run finishes at the buzzer — the probe showed a steady-but-accurate
   * player dropping two places once they were in the rotation.
   *
   * Swept over generator states rather than checked against the pool arrays, so it holds against what the ladder
   * actually deals rather than against how it happens to be written.
   */
  for (const combo of [DRIFT_AT_COMBO, 5, 6, 12, 40]) {
    const rolled = rolledIdsAt(combo);
    for (const id of ['crossed', 'hues']) {
      assert.ok(!rolled.has(id), `combo ${combo} can roll '${id}' into the quick race`);
    }
  }
});

test('the ladder never gets easier as the streak grows', () => {
  /**
   * Monotonicity as *difficulty*, not as a single number. Three separate claims, and none of them is "the number
   * went up":
   *
   *  - once a rung carries a mechanic it never stops carrying one;
   *  - every ramp is non-decreasing, so whatever is rolled only gets harder;
   *  - the count may not drop within either half — which is what lets the hard rung legitimately ask for fewer
   *    pieces than the rung below it without the ladder being non-monotonic. See the note on the ladder itself.
   *
   * The strength claim is deliberately *per ramp* rather than per beat. Comparing the strength of a drift against
   * the strength of a bomb is comparing two different questions, and a plan-level comparison would fail on a
   * perfectly correct rotation.
   */
  const decorated = (combo: number) => mechanicsAt(combo).length > 0;
  let previous = tierFor(LADDER.tiers, 0);
  for (let combo = 1; combo <= 40; combo += 1) {
    const tier = tierFor(LADDER.tiers, combo);
    assert.ok(decorated(combo) || !decorated(combo - 1), `combo ${combo} dropped its mechanic`);
    for (const [id, ramp] of Object.entries(LADDER.ramps)) {
      assert.ok(
        rampAt(ramp, combo) >= rampAt(ramp, combo - 1),
        `combo ${combo} weakened '${id}'`,
      );
    }
    if (decorated(combo) === decorated(combo - 1)) {
      assert.ok(tier.slots >= previous.slots, `combo ${combo} asked for fewer pieces`);
    }
    previous = tier;
  }
});

test('a hard beat carries exactly one mechanic, however it rolls', () => {
  /**
   * The rung rolls **one**, not a handful. Two at once is a real risk of the pool design — a rung listing an id in
   * both `varieties` and `pool` would deal it twice, which would have the folds run that variety's hooks twice on
   * one beat against two copies of its data.
   */
  for (const combo of [DRIFT_AT_COMBO, 5, 6, 12, 30]) {
    for (let i = 0; i < 200; i += 1) {
      const dealt = mechanicsAt(combo, i * 2_654_435_761, i % 7);
      assert.equal(dealt.length, 1, `combo ${combo} at sample ${i} dealt ${dealt.length}`);
    }
  }
});

test('the top of the ladder is a rotation: every pooled mechanic actually comes up', () => {
  /**
   * The point of the change. The hard rungs used to deal `drift` and only `drift`, so a player who earned them met
   * the same beat for the rest of the race. A pool that in practice only ever rolled one or two of its entries
   * would be the same failure wearing a rotation's clothes, so this asserts coverage rather than intent.
   */
  const solo = rolledIdsAt(DRIFT_AT_COMBO);
  assert.deepEqual([...solo].sort(), [...SOLO_POOL].sort(), 'the single rung should reach its whole pool');

  const duo = rolledIdsAt(8);
  assert.deepEqual([...duo].sort(), [...DUO_POOL].sort(), 'and the double rung its whole one');
});

test('each rung pools only mechanics its slot count can carry', () => {
  /**
   * Two structural exclusions, in opposite directions, and both are correctness rather than taste.
   *
   * **`bomb` is off the single.** `defuse` is answered by playing the *other* piece, and a one-piece beat has none —
   * so the variety substitutes the cycling form, which the quick race does not want. A solo bomb here would be the
   * one variant that was taken out, arriving by the back door.
   *
   * **`fuse` is off the double.** It splits the *first* group, so two footprints become three — past `MAX_SLOTS`,
   * which is what the camera impulse is tuned against and what the field's layout was measured for.
   */
  assert.equal(planBeat(DEFAULT_LADDER, 0, DRIFT_AT_COMBO).slots, 1, 'the first hard rung is a single');
  assert.equal(planBeat(DEFAULT_LADDER, 0, 6).slots, 2, 'and the second a double');

  assert.ok(!SOLO_POOL.includes('bomb'), 'a solo bomb could only be the cycling form');
  assert.ok(DUO_POOL.includes('bomb'), 'but a double can carry the defuse puzzle');

  assert.ok(SOLO_POOL.includes('fuse'), 'splitting one footprint gives exactly two');
  assert.ok(!DUO_POOL.includes('fuse'), 'splitting one of two would give three');
});

test('the roll is stable for one beat and varies across them', () => {
  /**
   * Both halves matter. `planBeat` is called more than once for a beat — by the reducer, and by tests — so an
   * unstable answer would mean a beat whose mechanic changed under it. And a roll that did *not* vary would be a
   * fixed sequence dressed up as a rotation.
   */
  const once = mechanicsAt(8, 12_345, 3);
  assert.deepEqual(mechanicsAt(8, 12_345, 3), once, 'same inputs must give the same beat');

  const byBeat = new Set<string>();
  for (let beat = 0; beat < 40; beat += 1) byBeat.add(mechanicsAt(8, 99_991, beat)[0]?.id ?? '');
  assert.ok(byBeat.size > 1, 'consecutive beats of one run must not all roll the same mechanic');
});

test('the ladder is a well-formed table', () => {
  // Thresholds strictly increasing from zero, which is what makes `tierFor`'s "last rung reached" scan
  // correct. A duplicate or out-of-order threshold would silently shadow a rung.
  assert.equal(LADDER.tiers[0].atCombo, 0, 'combo 0 must land on a rung');
  for (let i = 1; i < LADDER.tiers.length; i += 1) {
    assert.ok(LADDER.tiers[i].atCombo > LADDER.tiers[i - 1].atCombo, `rung ${i} is out of order`);
  }
  for (const tier of LADDER.tiers) {
    assert.equal(tierFor(LADDER.tiers, tier.atCombo), tier, `the rung at ${tier.atCombo} is unreachable`);
  }
  // Every ramp is reachable, or it is dead configuration. A ramp may be named by a rung's fixed list, by a rung's
  // pool, or — for the wildcard — by any rung that rolls at all.
  for (const id of Object.keys(LADDER.ramps)) {
    const named = LADDER.tiers.some(
      (tier) => tier.varieties.includes(id) || (tier.pool?.includes(id) ?? false),
    );
    const wildcard = id === ANY_VARIETY && LADDER.tiers.some((tier) => (tier.pool?.length ?? 0) > 0);
    assert.ok(named || wildcard, `nothing on the ladder can ask for '${id}', so its ramp is dead`);
  }
});

test('a broken streak drops all the way to the bottom rung', () => {
  assert.equal(planBeat(DEFAULT_LADDER, 0, 0).slots, 1);
  assert.equal(rolledIdsAt(0).size, 0);
  for (const combo of [-5, -1]) {
    assert.equal(planBeat(DEFAULT_LADDER, 0, combo).slots, 1, `combo ${combo} did not clamp`);
    assert.equal(rolledIdsAt(combo).size, 0, `combo ${combo} dealt a mechanic below the ladder`);
  }
});

// ------------------------------------------------------------- the zones

test('a single alternates flanks and never sits under the car', () => {
  for (let beat = 0; beat < 20; beat += 1) {
    const zones = zonesFor(1, beat);
    assert.equal(zones.length, 1);
    assert.notEqual(zones[0], 'below', `beat ${beat} put the single under the car`);
  }
  assert.deepEqual(zonesFor(1, 0), ['left']);
  assert.deepEqual(zonesFor(1, 1), ['right']);
  assert.deepEqual(zonesFor(2, 0), ['left', 'right']);
});

test('the centre zone never appears in a planned mid-race beat', () => {
  // Launch-only. The dealer forces it for the opening drag; nothing else may reach it without naming it.
  for (let combo = 0; combo < 24; combo += 1) {
    for (let beat = 0; beat < 4; beat += 1) {
      assert.ok(
        !planBeat(DEFAULT_LADDER, beat, combo).zones.includes('below'),
        `combo ${combo} put a mid-race slot under the car`,
      );
    }
  }
});

test('the zone list always matches the slot count', () => {
  for (let combo = 0; combo < 12; combo += 1) {
    for (let beat = 0; beat < 4; beat += 1) {
      const plan = planBeat(DEFAULT_LADDER, beat, combo);
      assert.equal(plan.zones.length, plan.slots, `beat ${beat} at combo ${combo} disagreed`);
    }
  }
});

test('asking for more footprints than there are flanks reaches for the centre', () => {
  // Unreachable at today's tuning and here so that a level asking for three deals three, rather than
  // silently dealing two and saying nothing about it.
  assert.equal(zonesFor(3, 0).length, 3);
  assert.ok(zonesFor(3, 0).includes('below'));
});

// ------------------------------------------------------------ the stream

const GAUNTLET: Progression = {
  kind: 'stream',
  turns: [
    { slots: 2, varieties: [{ id: 'drift', strength: 1 }] },
    { slots: 1, zones: ['below'], varieties: [] },
  ],
  loop: true,
};

test('a stream plays its written turns in order and ignores the streak', () => {
  /**
   * The whole point of the second kind. A gauntlet level asks for what it asks for — a combo of 0 does not
   * make it merciful, and a combo of 30 does not make it worse.
   */
  for (const combo of [0, 1, 7, 40]) {
    const first = planBeat(GAUNTLET, 0, combo);
    assert.equal(first.slots, 2);
    assert.deepEqual(first.varieties, [{ id: 'drift', strength: 1 }]);

    const second = planBeat(GAUNTLET, 1, combo);
    assert.equal(second.slots, 1);
    assert.deepEqual(second.zones, ['below'], 'a written turn may name the centre');
  }
});

test('a looping stream wraps, and a finite one holds its last turn', () => {
  assert.equal(planBeat(GAUNTLET, 2, 0).slots, 2, 'beat 2 should be turn 0 again');
  assert.equal(planBeat(GAUNTLET, 3, 0).slots, 1);

  const finite: Progression = { ...GAUNTLET, loop: false };
  // Held rather than wrapped: a gauntlet that ran out of script should end on its hardest turn, not
  // silently restart at its easiest.
  assert.equal(planBeat(finite, 2, 0).slots, 1);
  assert.equal(planBeat(finite, 99, 0).slots, 1);
});

test('a stream with no turns still produces a playable beat', () => {
  // Reachable through a hand-written level, and the failure has to be a dull beat rather than a crash.
  const empty: Progression = { kind: 'stream', turns: [], loop: true };
  const plan = planBeat(empty, 0, 5);
  assert.equal(plan.slots, 1);
  assert.equal(plan.zones.length, 1);
  assert.deepEqual(plan.varieties, []);
});

// ------------------------------------------------------------- the ceiling

test('the biggest beat a progression can deal is knowable without playing it', () => {
  /**
   * Needed because `camera-impulse.ts` tunes its count term for one to two footprints. A level that deals
   * three would flatten the camera's response, and this is what lets a test say so rather than a player
   * noticing the game got quieter.
   */
  assert.equal(maxSlotsOf(DEFAULT_LADDER), MAX_SLOTS);
  assert.equal(maxSlotsOf(GAUNTLET), 2);
  assert.equal(maxSlotsOf({ kind: 'stream', turns: [], loop: false }), MAX_SLOTS);
});

test('a plan carries the streak it was resolved at', () => {
  // So a variety's `deal` can read "how hot is this run" from the same object that told it how hard to be,
  // rather than from a second parameter that could disagree with it.
  assert.equal(planBeat(DEFAULT_LADDER, 3, 9).combo, 9);
  assert.equal(planBeat(GAUNTLET, 3, 9).combo, 9);
});
