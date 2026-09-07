import assert from 'node:assert/strict';
import { test } from 'node:test';

import { boardIndex, cellsExtent } from './board';
import {
  LAUNCH_FAMILY_ID,
  LAUNCH_ZONE,
  MAX_SLOTS,
  SLOT_ZONES,
  beatHasPerfectSolution,
  dealBeat,
  slotShapePoolFor,
} from './slot-deal';
import {
  DEFAULT_LADDER,
  DRIFT_AT_COMBO,
  DRIFT_FLOOR,
  DRIFT_FULL_COMBO,
  planBeat,
  rampAt,
  tierFor,
} from './progression';
import { varietyData } from '../variety/contract';
import { beatPaceAllowanceMs } from '../variety/registry';
import type { DriftData } from '../variety/drift/drift';
import {
  GRADE,
  PACE,
  gradeBeat,
  gradePace,
  gradePlacement,
  paceBudgetMs,
} from './slot-grade';
import {
  NO_CELL,
  SLOT_CAPTURE_MARGIN,
  dropFootprintFor,
  resolveDropCell,
  resolveSlotDrop,
  scorePlacement,
} from './slot-drop';
import { MAX_DROPS_PER_BEAT, coolOff, nextSafestPiece } from './scripted-play';
import { beatDeadlineMs, beatTargetCells, createSlotRun, slotReducer } from './slot-reducer';
import { MAX_SLOT_PIECE_CELLS, SLOT_GRID, SLOT_MARGIN } from './slot-types';
import type { SlotRunState } from './slot-types';
import { BLOCK_COLOR_IDS } from './types';
import type { Piece } from './types';

const GRID = SLOT_GRID;

/**
 * The default ladder's rungs, for the tests that are about *the ladder* rather than about the game.
 *
 * Narrowed once here rather than at every use. The distinction matters more than it looks: the ladder's two
 * headline properties — earned rather than clocked, and monotonic — used to be global truths because there
 * was one curve. A `stream` progression breaks both by design, so they are now claims about this table.
 */
const LADDER = DEFAULT_LADDER as Extract<typeof DEFAULT_LADDER, { kind: 'ladder' }>;
const LADDER_TIERS = LADDER.tiers;

/** What the default ladder asks for at a given streak. The dealer takes plans now, not combos. */
const plan = (combo: number, beatIndex = 0) => planBeat(DEFAULT_LADDER, beatIndex, combo);

/** How many footprints the ladder deals at a given streak. */
const slotsAt = (combo: number): number => plan(combo).slots;

/**
 * Whether the ladder decorates a beat at all at a given streak.
 *
 * This used to be `driftsAt`, asking specifically about the sway. The hard rungs **roll** their mechanic now, so
 * "does the field move" is no longer a property of the rung — it is a property of one beat's roll. What the ladder
 * still promises is that the hard rungs carry *something*, and that is what the shape tests below are about.
 */
const decoratedAt = (combo: number): boolean => plan(combo).varieties.length > 0;

/** Which zones the ladder uses, in dealing order. */
const zonesAt = (beatIndex: number, combo: number) => plan(combo, beatIndex).zones;

/** Whether a rung decorates its beats — by a fixed list, by a pool, or both. */
const hasMechanic = (tier: { varieties: readonly string[]; pool?: readonly string[] }): boolean =>
  tier.varieties.length > 0 || (tier.pool?.length ?? 0) > 0;

/**
 * Play forward until a beat is dealt with the drift on it, or give up.
 *
 * The pool means no particular beat is guaranteed to sway, so a test about the sway has to go looking. Bounded and
 * asserted rather than looped forever: a test that cannot fail without hanging is worse than one that is merely
 * wrong.
 */
function findDriftingBeat(seed: string, guard = 200): SlotRunState | null {
  let state = startedRun(seed);
  for (let i = 0; i < guard; i += 1) {
    if (driftOf(state.beat) > 0) return state;
    state = playBeatPerfectly(state);
    state = slotReducer(state, { type: 'next_beat' });
  }
  return null;
}

/** The rung a streak is on. */
const tierAt = (combo: number) => tierFor(LADDER_TIERS, combo);

/** How hard a *dealt* beat actually sways — read back off its variety, where the value now lives. */
const driftOf = (beat: { varieties: { id: string; data: unknown }[] }): number =>
  varietyData<DriftData>(beat as never, 'drift')?.strength ?? 0;

/** The piece dealt for a group, which is the only piece that can perfectly fill it. */
function pieceFor(state: SlotRunState, groupIndex: number): Piece {
  const group = state.beat.groups[groupIndex];
  const piece = state.tray.find((candidate) => candidate.id === group.pieceId);
  assert.ok(piece, `no piece for group ${groupIndex}`);
  return piece;
}

/**
 * Play the whole live beat as well as it can be played, at a pace that grades perfect.
 *
 * Rewritten from "drop each group's piece once, in order", which stopped being *perfect* play the moment the ladder
 * could roll a mechanic. Three things it now has to do, and each of them is what a competent human does:
 *
 *  - **Loop until the beat is over** rather than once per group, because an absorbed drop returns its piece. An
 *    armoured footprint takes two or three drags and the old version left the beat unresolved.
 *  - **Choose the order**, so a `defuse` bomb is taken cold rather than detonated.
 *  - **Wait out a live `cycle` bomb**, which needs the clock the reducer deliberately does not have.
 *
 * Guarded rather than unbounded: two hit points of armour on a double is four drags, and anything much past that
 * means a mechanic is not converging — which should fail loudly here, not spin.
 */
function playBeatPerfectly(state: SlotRunState, elapsedMs = 400): SlotRunState {
  let next = state;
  for (let guard = 0; guard < MAX_DROPS_PER_BEAT; guard += 1) {
    if (next.beat.status !== 'placing') break;
    const piece = nextSafestPiece(next);
    if (!piece) break;

    next = coolOff(next, piece.id);
    const group = next.beat.groups.find((candidate) => candidate.pieceId === piece.id);
    if (!group) break;

    const before = next;
    next = slotReducer(next, {
      type: 'place',
      pieceId: piece.id,
      row: group.origin.row,
      column: group.origin.column,
      elapsedMs,
    });
    // The reducer refused it outright, so dropping again would loop forever.
    if (next === before) break;
  }
  return next;
}

/**
 * Play every piece of a beat one cell off target, landing part of it.
 *
 * The streak-breaker. It used to be enough to play a beat *slowly*, which is exactly the conflation
 * that has been removed — pace no longer touches the combo, so a test that wants a broken streak has
 * to actually miss.
 *
 * The nudge goes along the shape's **longer** axis, and that is not arbitrary. Shifting a fixed
 * direction fails for shapes that are one cell thick across it: a vertical `line-3` moved a column
 * overlaps its footprint *nowhere*, grading `miss` instead of `good` — which broke the streak either
 * way but paid nothing, so a test asserting a partial payout got zero. Along the longer axis the
 * overlap is at worst half the piece, which clears `MIN_COVERAGE` for every shape in the catalogue.
 */
function playBeatOffTarget(state: SlotRunState, elapsedMs = 400): SlotRunState {
  let next = state;
  /**
   * A loop until the beat is over, for the reasons `playBeatPerfectly` documents.
   *
   * It used to be one pass per *group index*, pairing `groups[i]` with `pieceFor(i)`. Two things broke that. A
   * reshaping variety can deal more footprints than the plan asked for, so the index pairing stopped being the
   * piece↔footprint pairing; and an absorbed drop hands its piece back, so a single pass could leave the beat
   * unresolved — which made a test that wanted a *broken streak* silently measure an unfinished beat instead.
   *
   * The bomb ordering matters here too, and for a reason worth stating: without it a detonation would break the
   * streak, so a test asserting a break would pass for entirely the wrong reason.
   */
  for (let guard = 0; guard < MAX_DROPS_PER_BEAT; guard += 1) {
    if (next.beat.status !== 'placing') break;
    const piece = nextSafestPiece(next);
    if (!piece) break;

    next = coolOff(next, piece.id);
    const group = next.beat.groups.find((candidate) => candidate.pieceId === piece.id);
    if (!group) break;

    const { height, width } = cellsExtent(piece.cells);
    const alongRows = height >= width;
    const before = next;
    next = slotReducer(next, {
      type: 'place',
      pieceId: piece.id,
      row: group.origin.row + (alongRows ? 1 : 0),
      column: group.origin.column + (alongRows ? 0 : 1),
      elapsedMs,
    });
    if (next === before) break;
  }
  return next;
}

/**
 * A run with the launch behind it, so the live beat is an ordinary scoring one.
 *
 * Every run opens on the launch beat, which deliberately neither scores nor touches the combo — so a
 * test about payout or streaks that starts from `createSlotRun` is measuring the tutorial, not the game.
 * This is what most of them want instead.
 */
function startedRun(seed: string): SlotRunState {
  return slotReducer(playBeatPerfectly(createSlotRun(seed)), { type: 'next_beat' });
}

// ------------------------------------------------------------------ the zones

test('the zones tile the field left to right without overlapping', () => {
  // Disjoint columns are what make placement unconditional: every zone always has room, so a beat can
  // never quietly deal fewer footprints than the ramp promised.
  const sorted = [...SLOT_ZONES].sort((a, b) => a.columnFrom - b.columnFrom);
  assert.deepEqual(
    sorted.map((zone) => zone.id),
    ['left', 'below', 'right'],
    'zones should read left, below, right across the field',
  );

  let previousEnd = -1;
  for (const zone of sorted) {
    assert.ok(zone.columnFrom > previousEnd, `${zone.id} overlaps the zone to its left`);
    assert.ok(zone.columnTo < GRID.cols, `${zone.id} runs off the field`);
    assert.ok(zone.rowFrom >= 0 && zone.rowTo < GRID.rows, `${zone.id} runs off the field`);
    previousEnd = zone.columnTo;
  }
});

test('the side zones flank the car and the bottom zone sits under it', () => {
  const left = SLOT_ZONES.find((zone) => zone.id === 'left')!;
  const right = SLOT_ZONES.find((zone) => zone.id === 'right')!;
  const below = SLOT_ZONES.find((zone) => zone.id === 'below')!;

  // The field is centred on the car, so the car occupies the middle columns.
  const middle = (GRID.cols - 1) / 2;
  assert.ok(left.columnTo < middle, 'the left zone should be entirely left of the car');
  assert.ok(right.columnFrom > middle, 'the right zone should be entirely right of the car');
  assert.ok(
    below.columnFrom <= middle && below.columnTo >= middle,
    'the bottom zone should sit under the car, not beside it',
  );
  // And it is genuinely *below*: the field is nudged down half a cell, so the car is near row 1.
  assert.ok(below.rowFrom >= 2, `the bottom zone starts at row ${below.rowFrom}, not under the car`);
});

test('the side zones are tall and narrow, the bottom one wide and shallow', () => {
  // Not decoration: this is what makes the three instantly distinguishable, and it falls out of the
  // column budget rather than being imposed on top of it.
  const left = SLOT_ZONES.find((zone) => zone.id === 'left')!;
  const below = SLOT_ZONES.find((zone) => zone.id === 'below')!;
  assert.ok(left.maxHeight > left.maxWidth, 'the side zones should favour tall shapes');
  assert.ok(below.maxWidth > below.maxHeight, 'the bottom zone should favour wide shapes');
});

// ------------------------------------------------------------------ the pool

test('every zone can hold something, and only shapes that fit it', () => {
  for (const zone of SLOT_ZONES) {
    const pool = slotShapePoolFor(GRID, zone);
    assert.ok(pool.length >= 4, `zone ${zone.id} has only ${pool.length} shapes`);
    for (const shape of pool) {
      assert.ok(
        shape.cells.length <= MAX_SLOT_PIECE_CELLS,
        `${shape.id} has ${shape.cells.length} cells`,
      );
      assert.ok(
        shape.height <= zone.maxHeight,
        `${shape.id} is ${shape.height} tall, ${zone.id} allows ${zone.maxHeight}`,
      );
      assert.ok(
        shape.width <= zone.maxWidth,
        `${shape.id} is ${shape.width} wide, ${zone.id} allows ${zone.maxWidth}`,
      );
    }
  }
});

test('each zone still spans small and large, so beats vary', () => {
  for (const zone of SLOT_ZONES) {
    const sizes = new Set(slotShapePoolFor(GRID, zone).map((shape) => shape.cells.length));
    assert.ok(sizes.has(2), `zone ${zone.id} has no domino, so it has no easy piece`);
    assert.ok(
      sizes.has(MAX_SLOT_PIECE_CELLS),
      `zone ${zone.id} has nothing at the top of the size range`,
    );
    assert.ok(sizes.size >= 3, `zone ${zone.id} has only ${sizes.size} distinct sizes`);
  }
});

// ------------------------------------------------------------------ the ramp

test('the ladder is earned: one, two, then the same again with a mechanic on it', () => {
  /**
   * The shape of the whole difficulty curve, read off the table. Written against `LADDER_TIERS` rather than
   * against literal combos so a retune moves the table and this follows — what is being pinned is that the
   * rungs are *reached in order*, not the particular numbers on them.
   */
  assert.equal(slotsAt(0), 1, 'no streak means a single');
  assert.equal(decoratedAt(0), false, 'and it is a plain beat');
  assert.equal(slotsAt(1), 2, 'one clean beat opens the double up');
  assert.equal(decoratedAt(1), false);
  assert.equal(slotsAt(DRIFT_AT_COMBO - 1), 2, 'the last plain rung is a double');
  assert.equal(decoratedAt(DRIFT_AT_COMBO), true, 'and then a mechanic arrives');
  assert.equal(slotsAt(100), MAX_SLOTS, 'the count stops at two');
  assert.equal(decoratedAt(100), true);
});

test('the first hard rung drops back to a single, teaching one new thing at a time', () => {
  /**
   * The deliberately odd-looking step in the ladder, and the reason it is shaped that way.
   *
   * Rung two asks for two placements; rung three asks for **one**, with a mechanic on it. Asking for both at once
   * would make the arrival of that mechanic a step nobody clears — a new skill and a doubled workload in the same
   * beat. So the mechanic is introduced alone, exactly as the count was.
   *
   * This reasoning got *stronger* when the rung started rolling its mechanic rather than always drifting: whatever
   * comes up is new, so introducing it on one footprint is right for all of them rather than just for the sway.
   */
  const firstHard = LADDER_TIERS.find(hasMechanic);
  assert.ok(firstHard, 'the ladder has no decorated rung at all');
  assert.equal(firstHard?.slots, 1, 'a mechanic arrives alongside a doubled workload');

  const lastPlain = [...LADDER_TIERS].reverse().find((tier) => !hasMechanic(tier));
  assert.equal(lastPlain?.slots, MAX_SLOTS, 'the plain half of the ladder should top out first');
});

test('the ladder never gets easier as the streak grows', () => {
  /**
   * Monotonicity, as difficulty rather than as a single number. Neither term may go backwards: the count may not
   * drop *within* the plain half or *within* the decorated half, and once a rung carries a mechanic it never stops.
   * That is what lets the first hard rung legitimately deal fewer pieces than the rung below it without the ladder
   * as a whole being non-monotonic.
   *
   * Note what is deliberately *not* asserted: that strength rises across the boundary. Two mechanics' strengths are
   * not comparable — the drift's floor is well above the shared one — so a rung that rolled a drift and then a bomb
   * would show a meaningless drop. `progression.test.ts` pins each ramp's own monotonicity instead.
   */
  let previous = tierAt(0);
  for (let combo = 1; combo <= 40; combo += 1) {
    const tier = tierAt(combo);
    assert.ok(
      hasMechanic(tier) || !hasMechanic(previous),
      `combo ${combo} dropped the rung's mechanic`,
    );
    if (hasMechanic(tier) === hasMechanic(previous)) {
      assert.ok(tier.slots >= previous.slots, `combo ${combo} asked for fewer pieces`);
    }
    previous = tier;
  }
});

test('the tier table is a well-formed ladder', () => {
  // Thresholds strictly increasing and starting at zero, which is what makes `tierFor`'s "last rung
  // reached" scan correct. A duplicate or out-of-order threshold would silently shadow a rung.
  assert.equal(LADDER_TIERS[0].atCombo, 0, 'combo 0 must land on a rung');
  for (let i = 1; i < LADDER_TIERS.length; i += 1) {
    assert.ok(
      LADDER_TIERS[i].atCombo > LADDER_TIERS[i - 1].atCombo,
      `rung ${i} does not come after rung ${i - 1}`,
    );
  }
  // Every rung is reachable — a rung the scan can never select is a rung nobody plays.
  for (const tier of LADDER_TIERS) {
    assert.equal(tierAt(tier.atCombo), tier, `the rung at combo ${tier.atCombo} is unreachable`);
  }
  assert.equal(Math.max(...LADDER_TIERS.map((tier) => tier.slots)), MAX_SLOTS);
});

test('breaking a streak drops all the way to the bottom rung', () => {
  // The whole ladder is a function of the streak, so a break cannot leave any of it behind — not the count
  // and not the motion.
  assert.equal(slotsAt(0), 1);
  assert.equal(decoratedAt(0), false);
  for (const combo of [-5, -1]) {
    assert.equal(slotsAt(combo), 1, `combo ${combo} did not clamp`);
    assert.equal(decoratedAt(combo), false);
  }
});

test('a single sits on a flank, never under the car', () => {
  for (let beat = 0; beat < 20; beat += 1) {
    const zones = zonesAt(beat, 0);
    assert.equal(zones.length, 1);
    assert.notEqual(zones[0], 'below', `beat ${beat} put the single under the car`);
  }
  // And it alternates, so it is not always the same reach.
  assert.deepEqual(zonesAt(0, 0), ['left']);
  assert.deepEqual(zonesAt(1, 0), ['right']);
  assert.deepEqual(zonesAt(2, 0), ['left']);
});

test('the centre zone is launch-only', () => {
  /**
   * It used to be the third footprint of a triple. With the triple replaced by a drifting double there is
   * no mid-race beat that reaches it, so the only slot a player ever sees dead centre is the tutorial drag
   * on the starting grid — under a camera they never see again.
   *
   * Worth pinning rather than leaving implicit, because the zone is still defined and still has a pool: it
   * would be easy to reintroduce it as "somewhere to put a third slot" without noticing that the centre is
   * the one place the launch owns.
   */
  for (let combo = 0; combo < 24; combo += 1) {
    for (let beat = 0; beat < 4; beat += 1) {
      assert.ok(
        !zonesAt(beat, combo).includes('below'),
        `combo ${combo} put a mid-race slot under the car`,
      );
    }
  }
  // And the launch does reach it, or the zone would be dead code.
  const launch = dealBeat(GRID, 99, 0, 0, plan(0), true);
  assert.deepEqual(
    launch.beat.groups.map((group) => group.zone),
    ['below'],
  );
});

test('the zone list always matches the slot count', () => {
  for (let combo = 0; combo < 12; combo += 1) {
    for (let beat = 0; beat < 4; beat += 1) {
      assert.equal(
        zonesAt(beat, combo).length,
        slotsAt(combo),
        `beat ${beat} at combo ${combo} disagreed`,
      );
    }
  }
});

test('a two-slot beat is dealt left to right, so its entrance sweeps', () => {
  // The field staggers its entrance by group index, so the order here is what the player sees.
  const dealt = dealBeat(GRID, 5150, 0, 0, plan(1));
  assert.deepEqual(
    dealt.beat.groups.map((group) => group.zone),
    ['left', 'right'],
  );
});

test('a dealt beat carries its own drift, and the launch never does', () => {
  /**
   * Why it is on the beat rather than derived from the live combo by the view: the combo updates the
   * instant a beat resolves, so a view reading it directly would stop the sway mid-outro on the beat that
   * broke a streak and start it mid-outro on the beat that earned the rung.
   */
  assert.equal(driftOf(dealBeat(GRID, 11, 0, 0, plan(0)).beat), 0);
  assert.ok(driftOf(dealBeat(GRID, 11, 0, 0, plan(DRIFT_AT_COMBO)).beat) > 0);

  // The launch is exempt whatever the streak claims. It is the first thing anybody does, framed by a
  // camera used nowhere else, and a moving target is not how to introduce a drag.
  const launch = dealBeat(GRID, 11, 0, 0, plan(DRIFT_FULL_COMBO + 10), true);
  assert.equal(driftOf(launch.beat), 0);
  assert.equal(launch.beat.launch, true);
});

test('the drift keeps growing with the streak, up to a limit', () => {
  /**
   * **The reason this is a number and not a flag.** As a boolean the top of the ladder was a step: combo 6
   * and combo 30 played identically, so a long streak was a longer version of the same beat rather than a
   * harder one. Now the sway gets both wider and quicker the further the streak runs.
   *
   * Read off the **ramp** rather than off a planned beat, which it used to be. The hard rungs roll their mechanic,
   * so no particular beat is guaranteed to sway — a plan-level reading would have been asking two questions at
   * once and failing on the answer to the wrong one.
   */
  const sway = (combo: number) => rampAt(LADDER.ramps.drift, combo);

  assert.equal(sway(DRIFT_AT_COMBO), DRIFT_FLOOR, 'the first drifting beat starts at the floor');
  assert.equal(sway(DRIFT_FULL_COMBO), 1, 'and tops out at the limit');

  // Strictly increasing in between, then flat. Flat matters as much as increasing: an unbounded ramp would
  // eventually sway further than the layout reserved, and the field would reach under the pause button.
  let previous = 0;
  for (let combo = DRIFT_AT_COMBO; combo <= DRIFT_FULL_COMBO; combo += 1) {
    const here = sway(combo);
    assert.ok(here > previous || here === 1, `combo ${combo} did not get harder`);
    previous = here;
  }
  for (const combo of [DRIFT_FULL_COMBO, DRIFT_FULL_COMBO + 1, 100, 10_000]) {
    assert.equal(sway(combo), 1, `combo ${combo} exceeded the limit`);
  }

  // And the still rungs never deal it, whatever the generator says.
  for (let combo = 0; combo < DRIFT_AT_COMBO; combo += 1) {
    for (let sample = 0; sample < 60; sample += 1) {
      const dealt = planBeat(DEFAULT_LADDER, sample % 5, combo, sample * 2_654_435_761);
      assert.deepEqual(dealt.varieties, [], `combo ${combo} decorated a plain rung`);
    }
  }
});

test('a beat dealt the drift carries the ramp onto the beat itself', () => {
  /**
   * End to end through the reducer, which is the half the ramp test above cannot cover: the plan says a strength
   * and the *dealt beat* has to carry it, because the view reads it off the beat and not off the ladder.
   *
   * Hunted for rather than assumed, since the rung rolls its mechanic — see `findDriftingBeat`.
   */
  const state = findDriftingBeat('drift-live');
  assert.ok(state, 'a long streak never rolled the drift at all');
  const strength = driftOf(state.beat);
  assert.ok(strength >= DRIFT_FLOOR, `a dealt drift of ${strength} is below its own floor`);
  assert.ok(strength <= 1, 'and it may never exceed the space the layout reserved');
});

test('the first drifting beat announces itself rather than ramping from nothing', () => {
  /**
   * `DRIFT_FLOOR` is not small, and that is the point. A drift that started near zero would make the beat
   * that *introduces* the mechanic indistinguishable from the still beat before it, so the player would
   * find out about it several beats after being handed it — by which time they have already lost a streak
   * to something they were never shown.
   */
  assert.ok(DRIFT_FLOOR >= 0.5, `a floor of ${DRIFT_FLOOR} is not visible on the beat that introduces it`);
  assert.ok(DRIFT_FLOOR < 1, 'a floor of 1 would make the ramp above it pointless');
});

test("the dealt count follows the run's own combo through a streak and a break", () => {
  // End to end through the reducer, which is where the ladder actually has to hold: `resolveBeat` sets the
  // combo and `nextBeat` sizes the following beat from it.
  let state = startedRun('ramp');
  assert.equal(state.beat.groups.length, 1, 'the first beat after the launch is a single');
  assert.equal(driftOf(state.beat), 0, 'and it is still');

  const rungs: { slots: number; drift: number }[] = [];
  for (let beat = 0; beat < DRIFT_FULL_COMBO + 2; beat += 1) {
    state = playBeatPerfectly(state);
    state = slotReducer(state, { type: 'next_beat' });
    rungs.push({ slots: state.beat.groups.length, drift: driftOf(state.beat) });
  }
  assert.equal(rungs[0].slots, 2, 'one perfect single opens the double');
  assert.ok(
    rungs.some((rung) => rung.drift > 0),
    'a long enough streak never reached the drifting rungs',
  );
  assert.ok(
    rungs.some((rung) => rung.drift > 0 && rung.slots === MAX_SLOTS),
    'a long enough streak never reached the top of the ladder',
  );
  // And the sway grew along the way rather than switching on and staying put.
  const drifts = rungs.map((rung) => rung.drift).filter((value) => value > 0);
  assert.ok(
    Math.max(...drifts) > Math.min(...drifts),
    'the drift never got any harder across a long streak',
  );
  assert.equal(Math.max(...drifts), 1, 'a long enough streak should reach the worst of it');

  // Now break it — which takes a miss, not a slow beat. The very next beat is a still single again.
  state = playBeatOffTarget(state);
  assert.equal(state.combo, 0);
  state = slotReducer(state, { type: 'next_beat' });
  assert.equal(state.beat.groups.length, 1, 'a broken streak drops back to a single');
  assert.equal(driftOf(state.beat), 0, 'and the field stops moving');
});

test('every zone is held clear of the grid edge by the margin', () => {
  // The whole reason the virtual grid is bigger than the drawn area. `resolveSlotDrop` clamps a drop's
  // origin so the footprint stays on the grid, so a zone flush against column 0 meant a drop aimed two
  // cells past the left edge was clamped straight onto the ghost and scored a perfect.
  for (const zone of SLOT_ZONES) {
    assert.ok(zone.columnFrom >= SLOT_MARGIN, `${zone.id} is only ${zone.columnFrom} from the left edge`);
    assert.ok(
      zone.columnTo <= GRID.cols - 1 - SLOT_MARGIN,
      `${zone.id} is too close to the right edge`,
    );
    assert.ok(zone.rowFrom >= SLOT_MARGIN, `${zone.id} is too close to the top edge`);
    assert.ok(zone.rowTo <= GRID.rows - 1 - SLOT_MARGIN, `${zone.id} is too close to the bottom edge`);
  }
});

test('a drop well past a zone edge scores nothing rather than clamping onto it', () => {
  // The bug the margin exists to fix, asserted end to end in screen coordinates. Aim two full cells
  // beyond the left edge of the leftmost zone: the origin clamp still applies, but it now lands in
  // margin instead of on the footprint.
  const left = SLOT_ZONES.find((zone) => zone.id === 'left')!;
  const shape = [
    { row: 0, column: 0 },
    { row: 0, column: 1 },
  ];
  const cells = [
    boardIndex(GRID, left.rowFrom, left.columnFrom),
    boardIndex(GRID, left.rowFrom, left.columnFrom + 1),
  ];
  const group = groupAt('a', cells, { row: left.rowFrom, column: left.columnFrom });

  // Exactly on target scores full marks...
  const onTarget = resolveSlotDrop(
    GRID,
    shape,
    centerOf(left.rowFrom, left.columnFrom + 0.5),
    FIRST,
    PITCH,
  );
  assert.ok(onTarget);
  assert.equal(scorePlacement(GRID, [group], shape, onTarget).coverage, 1);

  // ...and two cells to its left scores nothing, because there is grid there to land on.
  const wayOff = resolveSlotDrop(
    GRID,
    shape,
    centerOf(left.rowFrom, left.columnFrom - 1.5),
    FIRST,
    PITCH,
  );
  assert.ok(wayOff);
  assert.equal(wayOff.column, left.columnFrom - 2, 'the drop should not have been clamped');
  assert.equal(scorePlacement(GRID, [group], shape, wayOff).coverage, 0);
});

test('a drop one cell out still clips the footprint, so a near miss earns partial credit', () => {
  // The other half of the margin's job: it must not be so generous that a one-cell error becomes a
  // total miss. One off is meant to fill part of the footprint.
  const left = SLOT_ZONES.find((zone) => zone.id === 'left')!;
  const shape = [
    { row: 0, column: 0 },
    { row: 0, column: 1 },
  ];
  const cells = [
    boardIndex(GRID, left.rowFrom, left.columnFrom),
    boardIndex(GRID, left.rowFrom, left.columnFrom + 1),
  ];
  const group = groupAt('a', cells, { row: left.rowFrom, column: left.columnFrom });

  const nearMiss = resolveSlotDrop(
    GRID,
    shape,
    centerOf(left.rowFrom, left.columnFrom - 0.5),
    FIRST,
    PITCH,
  );
  assert.ok(nearMiss);
  assert.equal(nearMiss.column, left.columnFrom - 1);
  const score = scorePlacement(GRID, [group], shape, nearMiss);
  assert.equal(score.coverage, 0.5, 'one cell out should land half the piece');
  assert.equal(score.offset, 1);
});

test('every footprint lands inside the zone it was dealt for', () => {
  for (let beat = 0; beat < 60; beat += 1) {
    const dealt = dealBeat(GRID, 31337 + beat * 419, beat, beat, plan(beat % 6, beat));
    for (const group of dealt.beat.groups) {
      const zone = SLOT_ZONES.find((candidate) => candidate.id === group.zone)!;
      for (const index of group.cells) {
        const row = Math.floor(index / GRID.cols);
        const column = index % GRID.cols;
        assert.ok(
          row >= zone.rowFrom && row <= zone.rowTo,
          `beat ${beat}: ${group.zone} cell at row ${row}, zone spans ${zone.rowFrom}..${zone.rowTo}`,
        );
        assert.ok(
          column >= zone.columnFrom && column <= zone.columnTo,
          `beat ${beat}: ${group.zone} cell at column ${column}, zone spans ${zone.columnFrom}..${zone.columnTo}`,
        );
      }
    }
  }
});

test('a negative combo is treated as no streak at all', () => {
  // Not reachable through the reducer, but the function is exported.
  assert.equal(slotsAt(-5), 1);
});

// ------------------------------------------------------------------ dealing

test('a dealt beat always has a perfect solution available', () => {
  // The guarantee the whole design rests on: the player can only ever fall short by being
  // inaccurate or slow, never because the beat was unwinnable.
  for (let beat = 0; beat < 40; beat += 1) {
    const dealt = dealBeat(GRID, 12345 + beat * 977, beat, beat, plan(beat % 6, beat));
    assert.ok(
      beatHasPerfectSolution(GRID, dealt.beat, dealt.tray),
      `beat ${beat} had no perfect solution`,
    );
  }
});

test('footprints never overlap, and never leave the field', () => {
  for (let beat = 0; beat < 60; beat += 1) {
    const dealt = dealBeat(GRID, 777 + beat * 131, beat, beat, plan(beat % 6, beat));
    const seen = new Set<number>();
    for (const group of dealt.beat.groups) {
      for (const index of group.cells) {
        assert.ok(!seen.has(index), `beat ${beat} placed two groups on cell ${index}`);
        seen.add(index);
        assert.ok(index >= 0 && index < GRID.rows * GRID.cols, `cell ${index} is off the field`);
      }
    }
  }
});

test('a beat deals one piece per footprint, and the shapes match', () => {
  for (let beat = 0; beat < 30; beat += 1) {
    const dealt = dealBeat(GRID, 4242 + beat * 313, beat, beat, plan(beat % 6, beat));
    assert.equal(dealt.tray.length, dealt.beat.groups.length);

    for (const group of dealt.beat.groups) {
      const piece = dealt.tray.find((candidate) => candidate.id === group.pieceId);
      assert.ok(piece, 'a group referenced a piece that was not dealt');
      assert.equal(group.cells.length, piece.cells.length, 'footprint size differs from its piece');
      // Colour is the visual pairing between tray piece and footprint, so it must agree.
      assert.equal(group.colorId, piece.colorId);
    }
  }
});

test('a beat deals at least what the combo allows, and never more than the cap', () => {
  /**
   * Stated as a band rather than an equality, and the reason is `shape`.
   *
   * A plan says how many footprints to *ask* for; a reshaping variety may then turn one into two — `fuse` splits a
   * footprint into halves, which is the whole mechanic. So the dealt count is a floor of the plan, not a match to
   * it. What must still hold is the ceiling: `MAX_SLOTS` is what the camera impulse is tuned against and what the
   * field's layout was measured for, so a plan plus a reshape may never exceed it.
   */
  for (let beat = 0; beat < 30; beat += 1) {
    const combo = beat % 6;
    const dealt = dealBeat(GRID, 99 + beat * 641, beat, beat, plan(combo, beat));
    const count = dealt.beat.groups.length;
    assert.ok(count >= 1, `beat ${beat} dealt nothing`);
    assert.ok(
      count >= slotsAt(combo),
      `beat ${beat} at combo ${combo} dealt ${count}, short of the ${slotsAt(combo)} asked for`,
    );
    assert.ok(count <= MAX_SLOTS, `beat ${beat} at combo ${combo} dealt ${count}, past the cap`);
  }
});

test('the ramp is normally met in full, not merely bounded', () => {
  // The dealer is allowed to drop a footprint it cannot fit, which is a safety valve rather than an
  // expected outcome. If it fired often the cap or the field size would be wrong.
  let short = 0;
  for (let beat = 0; beat < 120; beat += 1) {
    const dealt = dealBeat(GRID, 5000 + beat * 79, beat, beat, plan(beat % 6, beat));
    if (dealt.beat.groups.length < slotsAt(beat % 6)) short += 1;
  }
  assert.ok(short === 0, `${short} of 120 beats could not fit their footprints`);
});

test('dealing is deterministic in its rng state', () => {
  const a = dealBeat(GRID, 8888, 4, 4, plan(2, 4));
  const b = dealBeat(GRID, 8888, 4, 4, plan(2, 4));
  assert.deepEqual(
    a.beat.groups.map((group) => group.cells),
    b.beat.groups.map((group) => group.cells),
  );
  assert.equal(a.rngState, b.rngState);
});

// ------------------------------------------------------------------ drop targeting

/** Screen geometry for the field: cell 40, gap 4, first cell centred at (100, 200). */
const PITCH = 44;
const FIRST = { x: 100, y: 200 };
const centerOf = (row: number, column: number) => ({
  x: FIRST.x + column * PITCH,
  y: FIRST.y + row * PITCH,
});

test('a drop on a cell centre resolves to that cell', () => {
  const single = [{ row: 0, column: 0 }];
  for (let row = 0; row < GRID.rows; row += 1) {
    for (let column = 0; column < GRID.cols; column += 1) {
      const origin = resolveSlotDrop(GRID, single, centerOf(row, column), FIRST, PITCH);
      assert.deepEqual(origin, { row, column }, `cell ${row},${column} missed`);
    }
  }
});

test('a drop quantises to the nearest cell, with no search for a better one', () => {
  const single = [{ row: 0, column: 0 }];
  // Just under half a pitch off still rounds back to the same cell...
  const near = { x: FIRST.x + PITCH * 0.49, y: FIRST.y };
  assert.deepEqual(resolveSlotDrop(GRID, single, near, FIRST, PITCH), { row: 0, column: 0 });
  // ...and just over half rounds to the next one. This is the whole accuracy mechanic: the drop
  // lands where the finger was, not somewhere convenient.
  const past = { x: FIRST.x + PITCH * 0.51, y: FIRST.y };
  assert.deepEqual(resolveSlotDrop(GRID, single, past, FIRST, PITCH), { row: 0, column: 1 });
});

test('a footprint is clamped inside the field rather than hanging off it', () => {
  const wide = [
    { row: 0, column: 0 },
    { row: 0, column: 1 },
    { row: 0, column: 2 },
  ];
  // Aimed at the far right column, which would put two cells off the edge.
  const origin = resolveSlotDrop(GRID, wide, centerOf(1, GRID.cols - 1), FIRST, PITCH);
  assert.deepEqual(origin, { row: 1, column: GRID.cols - 3 });
});

test('a drop well clear of the field is rejected outright', () => {
  const single = [{ row: 0, column: 0 }];
  const farBelow = { x: FIRST.x, y: FIRST.y + (GRID.rows + 4) * PITCH };
  assert.equal(resolveSlotDrop(GRID, single, farBelow, FIRST, PITCH), null);
  const farLeft = { x: FIRST.x - (GRID.cols + 4) * PITCH, y: FIRST.y };
  assert.equal(resolveSlotDrop(GRID, single, farLeft, FIRST, PITCH), null);
});

test('the capture margin is generous enough to overshoot the top row', () => {
  // Aiming at the top row from a tray below means routinely overshooting, and dropping the hover
  // there feels broken. One pitch past the edge must still be captured.
  const single = [{ row: 0, column: 0 }];
  const overshoot = { x: FIRST.x, y: FIRST.y - PITCH * 1.0 };
  assert.ok(SLOT_CAPTURE_MARGIN >= 1, 'the margin no longer covers a one-cell overshoot');
  assert.deepEqual(resolveSlotDrop(GRID, single, overshoot, FIRST, PITCH), { row: 0, column: 0 });
});

// The worklet resolver and the JS convenience wrapper must not drift: the drag reads one and the drop
// reads the other, so a disagreement would mean the ghost promising a cell the drop does not use.
test('the worklet resolver agrees with the JS one everywhere', () => {
  const shapes = [
    [{ row: 0, column: 0 }],
    [
      { row: 0, column: 0 },
      { row: 0, column: 1 },
    ],
    [
      { row: 0, column: 0 },
      { row: 1, column: 0 },
      { row: 1, column: 1 },
    ],
  ];

  for (const shape of shapes) {
    const frame = {
      anchorX: FIRST.x,
      anchorY: FIRST.y,
      pitch: PITCH,
      rows: GRID.rows,
      cols: GRID.cols,
      captureMargin: SLOT_CAPTURE_MARGIN,
    };
    const footprint = dropFootprintFor(GRID, shape);

    // Sweep well past the field on all sides, in third-of-a-cell steps, so both the capture rejection
    // and the clamp are exercised.
    for (let row = -3; row < GRID.rows + 3; row += 1 / 3) {
      for (let column = -3; column < GRID.cols + 3; column += 1 / 3) {
        const centre = centerOf(row, column);
        const viaWorklet = resolveDropCell(frame, footprint, centre.x, centre.y);
        const viaJs = resolveSlotDrop(GRID, shape, centre, FIRST, PITCH);

        if (viaJs === null) {
          assert.equal(viaWorklet, NO_CELL, `disagreed at ${row},${column}: JS rejected, worklet did not`);
        } else {
          assert.equal(
            viaWorklet,
            viaJs.row * GRID.cols + viaJs.column,
            `disagreed at ${row},${column}`,
          );
        }
      }
    }
  }
});

test('the packed cell index uses the same encoding as boardIndex', () => {
  // So a resolved cell unpacks with `cellFromIndex` rather than needing a second convention.
  const frame = {
    anchorX: FIRST.x,
    anchorY: FIRST.y,
    pitch: PITCH,
    rows: GRID.rows,
    cols: GRID.cols,
    captureMargin: SLOT_CAPTURE_MARGIN,
  };
  const footprint = dropFootprintFor(GRID, [{ row: 0, column: 0 }]);

  for (const [row, column] of [
    [0, 0],
    [2, 5],
    [GRID.rows - 1, GRID.cols - 1],
  ]) {
    const centre = centerOf(row, column);
    assert.equal(
      resolveDropCell(frame, footprint, centre.x, centre.y),
      boardIndex(GRID, row, column),
    );
  }
});

test('the footprint solve matches the extent it is derived from', () => {
  const shape = [
    { row: 0, column: 0 },
    { row: 1, column: 0 },
    { row: 1, column: 1 },
    { row: 2, column: 1 },
  ];
  const { height, width } = cellsExtent(shape);
  const footprint = dropFootprintFor(GRID, shape);

  assert.equal(footprint.centerRow, (height - 1) / 2);
  assert.equal(footprint.centerColumn, (width - 1) / 2);
  assert.equal(footprint.maxRow, GRID.rows - height);
  assert.equal(footprint.maxColumn, GRID.cols - width);
});

test('a piece too big for the field resolves to nothing', () => {
  const frame = {
    anchorX: FIRST.x,
    anchorY: FIRST.y,
    pitch: PITCH,
    rows: 2,
    cols: 2,
    captureMargin: SLOT_CAPTURE_MARGIN,
  };
  const tooTall = [0, 1, 2].map((row) => ({ row, column: 0 }));
  const footprint = dropFootprintFor({ rows: 2, cols: 2 }, tooTall);
  assert.ok(footprint.maxRow < 0);
  assert.equal(resolveDropCell(frame, footprint, FIRST.x, FIRST.y), NO_CELL);
});

test('a degenerate drop is refused rather than guessed at', () => {
  assert.equal(resolveSlotDrop(GRID, [], centerOf(0, 0), FIRST, PITCH), null);
  assert.equal(resolveSlotDrop(GRID, [{ row: 0, column: 0 }], centerOf(0, 0), FIRST, 0), null);
});

// ------------------------------------------------------------------ scoring a drop

const groupAt = (id: string, cells: number[], origin: { row: number; column: number }) => ({
  id,
  zone: 'below' as const,
  pieceId: `piece-${id}`,
  colorId: 'turbo' as const,
  cells,
  origin,
  filled: [] as number[],
});

test('an exact drop fills the whole footprint at zero offset', () => {
  const shape = [
    { row: 0, column: 0 },
    { row: 0, column: 1 },
  ];
  const cells = [boardIndex(GRID, 1, 2), boardIndex(GRID, 1, 3)];
  const group = groupAt('a', cells, { row: 1, column: 2 });

  const score = scorePlacement(GRID, [group], shape, { row: 1, column: 2 });
  assert.equal(score.groupId, 'a');
  assert.equal(score.coverage, 1);
  assert.equal(score.offset, 0);
  assert.deepEqual(score.filled.sort(), [...cells].sort());
});

test('a score reports every cell the piece covered, so wasted ones can be derived', () => {
  // `dropped` exists so the reducer can compute `wasted` as `dropped - filled` rather than repeating
  // the offset-and-clip arithmetic. The two disagreeing would mean cells that neither scored nor fell.
  const shape = [
    { row: 0, column: 0 },
    { row: 0, column: 1 },
    { row: 0, column: 2 },
  ];
  const cells = [boardIndex(GRID, 1, 1), boardIndex(GRID, 1, 2), boardIndex(GRID, 1, 3)];
  const group = groupAt('a', cells, { row: 1, column: 1 });

  const score = scorePlacement(GRID, [group], shape, { row: 1, column: 2 });
  assert.equal(score.dropped.length, 3, 'all three cells were on the grid');
  const filled = new Set(score.filled);
  const wasted = score.dropped.filter((index) => !filled.has(index));
  assert.equal(wasted.length, 1, 'one of the three landed off target');
  assert.deepEqual(wasted, [boardIndex(GRID, 1, 4)]);
});

test('cells clipped off the grid are not reported as dropped', () => {
  // They cannot fall away, because they were never anywhere. Reporting them would make the reducer
  // build a shower for cells with no position.
  const shape = [
    { row: 0, column: 0 },
    { row: 0, column: 1 },
  ];
  const group = groupAt('a', [boardIndex(GRID, 0, 0)], { row: 0, column: 0 });
  // An origin the resolver would never produce, but `scorePlacement` takes arbitrary ones.
  const score = scorePlacement(GRID, [group], shape, { row: 0, column: GRID.cols - 1 });
  assert.equal(score.dropped.length, 1, 'only the in-bounds cell should be reported');
});

test('a placement records what it wasted, and in the piece colour', () => {
  const state = createSlotRun('wasted');
  const group = state.beat.groups[0];
  const piece = pieceFor(state, 0);
  const { width } = cellsExtent(piece.cells);
  const column =
    group.origin.column + 1 <= GRID.cols - width
      ? group.origin.column + 1
      : group.origin.column - 1;

  const next = slotReducer(state, {
    type: 'place',
    pieceId: piece.id,
    row: group.origin.row,
    column,
    elapsedMs: 200,
  });

  const placement = next.beat.placements[0];
  assert.ok(placement.wasted.length > 0, 'an off-target drop should waste something');
  assert.equal(placement.colorId, piece.colorId, 'the falling cells must be the piece colour');
  // Wasted and filled are disjoint, and together account for every in-bounds cell of the piece.
  const filled = new Set(next.beat.groups.find((g) => g.id === group.id)!.filled);
  for (const index of placement.wasted) {
    assert.ok(!filled.has(index), `cell ${index} was both filled and wasted`);
  }
});

test('an exact placement wastes nothing', () => {
  const state = createSlotRun('exact');
  const resolved = playBeatPerfectly(state);
  for (const placement of resolved.beat.placements) {
    assert.deepEqual(placement.wasted, [], 'a perfect drop should have nothing fall away');
  }
});

test('a drop one cell out fills only the cells that overlapped', () => {
  // The partial-payout rule, which is what makes accuracy matter without punishing a near miss.
  const shape = [
    { row: 0, column: 0 },
    { row: 0, column: 1 },
    { row: 0, column: 2 },
  ];
  const cells = [boardIndex(GRID, 1, 1), boardIndex(GRID, 1, 2), boardIndex(GRID, 1, 3)];
  const group = groupAt('a', cells, { row: 1, column: 1 });

  const score = scorePlacement(GRID, [group], shape, { row: 1, column: 2 });
  assert.equal(score.groupId, 'a');
  assert.equal(score.offset, 1);
  // Two of the three landed on target.
  assert.equal(score.filled.length, 2);
  assert.ok(Math.abs(score.coverage - 2 / 3) < 1e-9);
});

test('a drop that touches no footprint scores nothing and has no offset', () => {
  const shape = [{ row: 0, column: 0 }];
  const group = groupAt('a', [boardIndex(GRID, 0, 0)], { row: 0, column: 0 });

  const score = scorePlacement(GRID, [group], shape, { row: 3, column: 4 });
  assert.equal(score.groupId, null);
  assert.equal(score.coverage, 0);
  assert.deepEqual(score.filled, []);
  // Infinity, not 0 — a total miss must never look like an exact hit.
  assert.equal(score.offset, Number.POSITIVE_INFINITY);
});

test('a drop is attributed to the footprint it covers most', () => {
  const shape = [
    { row: 0, column: 0 },
    { row: 0, column: 1 },
    { row: 0, column: 2 },
  ];
  // `a` gets one cell of the drop, `b` gets two.
  const a = groupAt('a', [boardIndex(GRID, 0, 0)], { row: 0, column: 0 });
  const b = groupAt('b', [boardIndex(GRID, 0, 1), boardIndex(GRID, 0, 2)], { row: 0, column: 1 });

  const score = scorePlacement(GRID, [a, b], shape, { row: 0, column: 0 });
  assert.equal(score.groupId, 'b');
  assert.equal(score.filled.length, 2);
});

test('already-filled cells cannot be scored twice', () => {
  const shape = [
    { row: 0, column: 0 },
    { row: 0, column: 1 },
  ];
  const cells = [boardIndex(GRID, 0, 0), boardIndex(GRID, 0, 1)];
  const group = { ...groupAt('a', cells, { row: 0, column: 0 }), filled: [cells[0]] };

  const score = scorePlacement(GRID, [group], shape, { row: 0, column: 0 });
  assert.equal(score.filled.length, 1, 'a filled cell was counted again');
  assert.equal(score.coverage, 0.5);
});

test('cells dropped off the field are clipped, not wrapped onto the far side', () => {
  // Wrapping would let a drop off the right edge score against a footprint on the left.
  const shape = [
    { row: 0, column: 0 },
    { row: 0, column: 1 },
  ];
  const leftEdge = groupAt('a', [boardIndex(GRID, 1, 0)], { row: 1, column: 0 });
  const score = scorePlacement(GRID, [leftEdge], shape, { row: 0, column: GRID.cols - 1 });
  assert.equal(score.groupId, null);
});

// ------------------------------------------------------------------ grading

test('an exact placement is perfect', () => {
  assert.equal(gradePlacement({ coverage: 1, offset: 0 }), 'perfect');
});

test('a placement grade says nothing about how long it took', () => {
  /**
   * The heart of the pace change, and the reason it is asserted on the *type* as well as the value:
   * `gradePlacement` no longer accepts a time at all, so there is no way for a caller to reintroduce
   * timing into the accuracy verdict by accident. A slow exact drop is `perfect`, full stop — the
   * clock is answered to once, by the beat.
   */
  assert.equal(gradePlacement({ coverage: 1, offset: 0 }), 'perfect');
  assert.deepEqual(Object.keys(GRADE).sort(), ['MIN_COVERAGE', 'PERFECT_OFFSET']);
});

test('a cell out is good, not perfect', () => {
  assert.equal(gradePlacement({ coverage: 1, offset: 1 }), 'good');
  assert.equal(gradePlacement({ coverage: GRADE.MIN_COVERAGE, offset: 1 }), 'good');
});

test('coverage below the floor is a miss', () => {
  assert.equal(gradePlacement({ coverage: GRADE.MIN_COVERAGE - 0.01, offset: 1 }), 'miss');
  assert.equal(gradePlacement({ coverage: 0, offset: Number.POSITIVE_INFINITY }), 'miss');
});

// -------------------------------------------------------------------- pace

test('the pace budget grows with the piece count', () => {
  // Adaptive by construction: a triple is more work than a single and gets more time for it.
  assert.ok(paceBudgetMs(1) < paceBudgetMs(2));
  assert.ok(paceBudgetMs(2) < paceBudgetMs(3));
  assert.equal(paceBudgetMs(2) - paceBudgetMs(1), PACE.PER_PIECE_MS);
  assert.equal(paceBudgetMs(3) - paceBudgetMs(2), PACE.PER_PIECE_MS);
});

test('every beat size is more generous than the old per-placement window', () => {
  /**
   * The old rule was 1100ms per placement, judged alone. This pins that the replacement is looser at
   * every beat size — which is what "very slightly more generous" has to mean concretely, and is the
   * kind of claim that silently stops being true the next time someone retunes `PACE`.
   */
  const OLD_PER_PLACEMENT_MS = 1100;
  for (const pieces of [1, 2, 3]) {
    assert.ok(
      paceBudgetMs(pieces) > OLD_PER_PLACEMENT_MS * pieces,
      `${pieces} piece(s): ${paceBudgetMs(pieces)}ms is not looser than ${OLD_PER_PLACEMENT_MS * pieces}ms`,
    );
  }
});

test('pace is judged on the sum, so a fast piece pays for a slow one', () => {
  // The reason it is a budget rather than a window. Two drops averaging inside it pass even though
  // the second, alone, would have failed a per-piece test at any plausible rate.
  const budget = paceBudgetMs(2);
  assert.equal(gradePace(200 + (budget - 200), 2), 'onTime');
  assert.equal(gradePace(budget + 1, 2), 'late');
});

test('the budget boundary is inclusive', () => {
  assert.equal(gradePace(paceBudgetMs(1), 1), 'onTime');
  assert.equal(gradePace(paceBudgetMs(1) + 1, 1), 'late');
});

test('a beat grades as its worst placement', () => {
  assert.equal(gradeBeat(['perfect', 'perfect']), 'perfect');
  assert.equal(gradeBeat(['perfect', 'good']), 'good');
  assert.equal(gradeBeat(['perfect', 'good', 'miss']), 'miss');
  // No placements is a miss, not a free perfect.
  assert.equal(gradeBeat([]), 'miss');
});

// ------------------------------------------------------------------ the reducer

test('a new run opens on a live single-slot beat', () => {
  const state = createSlotRun('seed-a');
  assert.equal(state.beat.index, 0);
  assert.equal(state.beat.status, 'placing');
  assert.equal(state.beat.groups.length, 1);
  assert.equal(state.tray.length, 1);
  assert.equal(state.combo, 0);
  assert.equal(state.eventSequence, 0);
  assert.equal(state.lastResolution, null);
});

test('every run opens on the same shape, in the same place, whatever the seed', () => {
  /**
   * The opening beat is the launch: the screen holds the grid until this one piece is dragged home, so
   * it is the game's whole tutorial. A tutorial that rolls a domino one race and a Z-piece the next is
   * not one — hence `LAUNCH_FAMILY_ID` and `LAUNCH_ZONE`, and hence this test, because nothing else
   * would notice if either force were dropped from `createSlotRun`.
   */
  for (const seed of ['a', 'b', 'launch', 'zzz', '']) {
    const state = createSlotRun(seed);
    assert.equal(state.tray.length, 1, `seed "${seed}" dealt more than one opening piece`);
    assert.ok(state.beat.launch, `seed "${seed}" did not deal a launch beat`);
    assert.equal(
      state.tray[0].shapeId.replace(/-r\d$/, ''),
      LAUNCH_FAMILY_ID,
      `seed "${seed}" opened on ${state.tray[0].shapeId}`,
    );
    assert.equal(state.beat.groups[0].zone, LAUNCH_ZONE, `seed "${seed}" opened off centre`);
  }
});

test('the launch piece is dealt wide, not tall', () => {
  /**
   * Three columns by two rows. No rotation is asked for anywhere — the centre zone caps height at 2, so
   * its pool only ever contains the wide rotation and the zone picks the orientation for free. Asserted
   * because that is a two-step inference, and the wide form is the one the layout has room for: the
   * centre zone is three columns across and only reaches two rows down.
   */
  const state = createSlotRun('wide');
  const { height, width } = cellsExtent(state.tray[0].cells);
  assert.equal(width, 3);
  assert.equal(height, 2);
});

test('the launch footprint is centred, so it reads under any camera', () => {
  // The launch is framed by `gridIdle`, not by the chase shot the field is positioned from — so it is
  // the one target in the game that must not be read against the car. Dead centre is what makes that work.
  const state = createSlotRun('centre');
  const columns = state.beat.groups[0].cells.map((index) => index % GRID.cols);
  const middle = (GRID.cols - 1) / 2;
  assert.ok(Math.min(...columns) <= middle && Math.max(...columns) >= middle, 'the launch slot must straddle the centre column');
});

test('the forced opening shape still has somewhere to sit', () => {
  // Forcing a shape past a zone that cannot hold it would deal a beat with no footprint, so the
  // fallback matters: the guarantee is that a perfect solution exists, not that the force always wins.
  for (const seed of ['a', 'b', 'launch']) {
    const state = createSlotRun(seed);
    assert.ok(beatHasPerfectSolution(GRID, state.beat, state.tray));
    assert.equal(state.beat.groups.length, 1);
  }
});

test('dealing the launch does not change where the generator ends up', () => {
  /**
   * The rng is advanced by the roll whether or not its result is used, so a launch beat leaves the
   * generator where a normal beat would. Without that the forced opening would silently reseed
   * everything after it, and two runs that should match would diverge from beat one.
   */
  const launch = dealBeat(GRID, 12345, 0, 0, plan(0), true);
  const rolled = dealBeat(GRID, 12345, 0, 0, plan(0));
  assert.notEqual(launch.tray[0].shapeId, rolled.tray[0].shapeId, 'the force should have changed the shape');
  assert.equal(launch.rngState, rolled.rngState, 'but not where the generator ended up');
  assert.equal(rolled.beat.launch, false, 'a normal beat is not a launch');
});

test('the launch neither builds nor breaks a streak', () => {
  /**
   * The rule that keeps the first *real* beat a single. Crediting the launch drag put a clean player on
   * combo 1, so `nextBeat` dealt them a double before the race had started — the game opened on its
   * second difficulty tier. Punishing a fumbled one would be worse.
   */
  for (const play of [playBeatPerfectly, playBeatOffTarget]) {
    let state = createSlotRun('launch-combo');
    state = play(state);
    assert.equal(state.beat.status, 'resolved', 'the launch still resolves');
    assert.equal(state.combo, 0, 'the launch must leave the combo alone');
    assert.equal(state.score, 0, 'and score nothing');
    assert.equal(state.beatsPlayed, 0, 'and not count as a beat');
    assert.equal(state.lastResolution?.perfectClear, false, 'and never read as a perfect clear');
    // But it must still be *reported*, or the burst and the cascade never fire.
    assert.equal(state.eventSequence, 1);

    state = slotReducer(state, { type: 'next_beat' });
    assert.equal(state.beat.groups.length, 1, 'the first beat of the race is a single');
    assert.equal(state.beat.launch, false);
  }
});

test('a perfect beat resolves, pays out and extends the combo', () => {
  const state = startedRun('seed-b');
  const resolved = playBeatPerfectly(state);

  assert.equal(resolved.beat.status, 'resolved');
  assert.equal(resolved.combo, 1);
  assert.equal(resolved.maxCombo, 1);
  // Relative to the run, not absolute: the launch beat has already banked a sequence number of its own.
  assert.equal(resolved.eventSequence, state.eventSequence + 1);
  assert.equal(resolved.lastBeatGrade, 'perfect');
  assert.equal(resolved.lastGroupCount, state.beat.groups.length);

  const resolution = resolved.lastResolution;
  assert.ok(resolution);
  assert.equal(resolution.perfectClear, true);
  assert.equal(resolution.comboAfter, 1);
  assert.equal(resolution.blocksCleared, beatTargetCells(state.beat));
  assert.ok(resolution.scoreDelta > 0);
  // No lines in slot mode — this is why the bridge reads `lastGroupCount` instead.
  assert.deepEqual(resolution.clearedRows, []);
  assert.deepEqual(resolution.clearedColumns, []);
});

test('a late but exact beat keeps the streak and forfeits only the bonus', () => {
  /**
   * The pace rule as behaviour, and the single most important test in this file for it.
   *
   * This assertion used to read the other way: a slow beat reset the combo. That double-charged for
   * slowness, because the race clock already makes a slow beat cost a race — it is a beat that did not
   * happen. What being late costs now is `perfectClear`: the flat bonus and the Success haptic, paid
   * once and not compounding.
   */
  let state = startedRun('seed-c');
  state = playBeatPerfectly(state);
  assert.equal(state.combo, 1);
  state = slotReducer(state, { type: 'next_beat' });

  const target = beatTargetCells(state.beat);
  const pieces = state.beat.groups.length;
  // Each placement alone overruns the whole beat's budget, so the sum cannot be in any doubt.
  state = playBeatPerfectly(state, paceBudgetMs(pieces) + 100);

  assert.equal(state.lastBeatGrade, 'perfect', 'the clock must not touch the accuracy grade');
  assert.equal(state.lastBeatPace, 'late');
  assert.equal(state.combo, 2, 'a late beat must not break the streak');
  assert.equal(state.lastResolution?.blocksCleared, target, 'a late beat still pays for what landed');
  assert.equal(state.lastResolution?.perfectClear, false, 'but it forfeits the perfect bonus');
});

test('a brisk beat is on time and records how long it took', () => {
  let state = startedRun('seed-c2');
  state = playBeatPerfectly(state, 300);
  assert.equal(state.lastBeatPace, 'onTime');
  assert.equal(state.lastBeatElapsedMs, 300, 'one footprint, one drop');
  assert.equal(state.lastResolution?.perfectClear, true);
});

test('the beat pace is the sum of its placements, not the worst of them', () => {
  /**
   * A multi-piece beat where one drag dawdles and the rest are quick. Per piece the slow one would fail any
   * plausible window; as a beat it comes in under budget, which is the whole point of the per-beat budget.
   *
   * Climbs to `MAX_SLOTS` rather than to a literal 3, and bounds the climb. It used to say `< 3`, which was
   * an unbounded `while` pinned to the largest beat the ramp happened to deal — so when the triple was
   * replaced by a drifting double the loop stopped terminating and hung the whole suite rather than failing.
   * A test that cannot fail without hanging is worse than one that is merely wrong.
   */
  let state = startedRun('seed-c3');
  for (let guard = 0; state.beat.groups.length < MAX_SLOTS; guard += 1) {
    assert.ok(guard < 40, `the ramp never reached ${MAX_SLOTS} footprints`);
    state = playBeatPerfectly(state);
    state = slotReducer(state, { type: 'next_beat' });
  }

  const pieces = state.beat.groups.length;
  const quick = 200;
  // One drag eats all but `quick` of the beat's budget; the others are brisk. The sum lands just inside it.
  const slow = paceBudgetMs(pieces) - quick * (pieces - 1);

  const comboBefore = state.combo;
  let next = state;
  state.beat.groups.forEach((group, index) => {
    next = slotReducer(next, {
      type: 'place',
      pieceId: pieceFor(next, index).id,
      row: group.origin.row,
      column: group.origin.column,
      elapsedMs: index === 0 ? slow : quick,
    });
  });

  assert.ok(slow > paceBudgetMs(1), 'the slow drag should be one no per-piece window would pass');
  assert.equal(next.lastBeatElapsedMs, paceBudgetMs(pieces));
  assert.equal(next.lastBeatPace, 'onTime', 'a quick drag should pay for a slow one');
  assert.equal(next.combo, comboBefore + 1);
});

test('an inaccurate beat pays proportionally less', () => {
  const state = createSlotRun('seed-d');
  const group = state.beat.groups[0];
  const piece = pieceFor(state, 0);
  const { width } = cellsExtent(piece.cells);

  // Shove the drop one column off, clamped so it stays on the field.
  const column =
    group.origin.column + 1 <= GRID.cols - width
      ? group.origin.column + 1
      : group.origin.column - 1;

  const sloppy = slotReducer(state, {
    type: 'place',
    pieceId: piece.id,
    row: group.origin.row,
    column,
    elapsedMs: 200,
  });

  assert.equal(sloppy.beat.status, 'resolved');
  assert.equal(sloppy.combo, 0);
  assert.ok(
    sloppy.lastResolution!.blocksCleared < beatTargetCells(state.beat),
    'an off-target drop paid the full amount',
  );
});

test('a drop that misses everything resolves the beat with no payout', () => {
  const state = createSlotRun('seed-e');
  const group = state.beat.groups[0];
  const piece = pieceFor(state, 0);

  // Find a corner the footprint definitely does not occupy.
  const { height, width } = cellsExtent(piece.cells);
  const row = group.origin.row === 0 ? GRID.rows - height : 0;
  const column = group.origin.column === 0 ? GRID.cols - width : 0;

  const missed = slotReducer(state, {
    type: 'place',
    pieceId: piece.id,
    row,
    column,
    elapsedMs: 100,
  });

  assert.equal(missed.beat.status, 'resolved');
  if (missed.lastResolution!.blocksCleared === 0) {
    assert.equal(missed.lastBeatGrade, 'miss');
    assert.equal(missed.combo, 0);
  }
});

test('an unknown or already-used piece is a no-op', () => {
  const state = createSlotRun('seed-f');
  const piece = pieceFor(state, 0);

  assert.equal(
    slotReducer(state, { type: 'place', pieceId: 'nope', row: 0, column: 0, elapsedMs: 1 }),
    state,
  );

  const played = playBeatPerfectly(state);
  // The beat has resolved, so the same piece cannot be replayed for a second payout.
  const again = slotReducer(played, {
    type: 'place',
    pieceId: piece.id,
    row: 0,
    column: 0,
    elapsedMs: 1,
  });
  assert.equal(again, played);
});

test('next_beat only advances a resolved beat', () => {
  const state = createSlotRun('seed-g');
  // Live beat: ignored, so a stray settle timer cannot skip a turn.
  assert.equal(slotReducer(state, { type: 'next_beat' }), state);

  const resolved = playBeatPerfectly(state);
  const next = slotReducer(resolved, { type: 'next_beat' });
  assert.equal(next.beat.status, 'placing');
  assert.equal(next.beat.index, 1);
  assert.equal(next.trayGeneration, resolved.trayGeneration + 1);
  // Cleared so the view cannot replay a stale burst over a live beat.
  assert.equal(next.lastResolution, null);
  assert.equal(next.lastBeatGrade, null);
  // Progress survives the deal.
  assert.equal(next.combo, resolved.combo);
  assert.equal(next.score, resolved.score);
});

test('the combo survives a run of perfect beats and resets on one bad one', () => {
  let state = startedRun('seed-h');
  for (let beat = 0; beat < 4; beat += 1) {
    state = playBeatPerfectly(state);
    assert.equal(state.combo, beat + 1);
    state = slotReducer(state, { type: 'next_beat' });
  }
  assert.equal(state.maxCombo, 4);

  state = playBeatOffTarget(state);
  assert.equal(state.combo, 0);
  assert.equal(state.maxCombo, 4, 'the best run was forgotten');
});

test('event sequence advances once per resolved beat, never per placement', () => {
  let state = createSlotRun('seed-i');
  // Reach a beat with more than one footprint.
  while (state.beat.groups.length < 2) {
    state = playBeatPerfectly(state);
    state = slotReducer(state, { type: 'next_beat' });
  }

  const before = state.eventSequence;
  const groups = state.beat.groups.length;
  assert.ok(groups >= 2);

  for (let index = 0; index < groups; index += 1) {
    const group = state.beat.groups[index];
    const piece = pieceFor(state, index);
    state = slotReducer(state, {
      type: 'place',
      pieceId: piece.id,
      row: group.origin.row,
      column: group.origin.column,
      elapsedMs: 300,
    });
    const expected = index === groups - 1 ? before + 1 : before;
    assert.equal(state.eventSequence, expected, `after placement ${index + 1} of ${groups}`);
  }

  assert.equal(state.lastGroupCount, groups, 'the bridge would read the wrong line count');
});

test('a partially filled footprint still clears with the beat', () => {
  // Nothing is left on screen for the next beat to inherit — the miss rule is streak loss plus a
  // smaller payout, not accumulating wreckage.
  let state = createSlotRun('seed-j');
  const group = state.beat.groups[0];
  const piece = pieceFor(state, 0);
  const { width } = cellsExtent(piece.cells);
  const column =
    group.origin.column + 1 <= GRID.cols - width
      ? group.origin.column + 1
      : Math.max(0, group.origin.column - 1);

  state = slotReducer(state, {
    type: 'place',
    pieceId: piece.id,
    row: group.origin.row,
    column,
    elapsedMs: 200,
  });
  state = slotReducer(state, { type: 'next_beat' });

  for (const next of state.beat.groups) {
    assert.deepEqual(next.filled, [], 'a new beat inherited filled cells');
  }
});

// ------------------------------------------------------- integration, as on the board

test('a scripted run replays identically from the same seed', () => {
  const script = (seed: string) => {
    let state = createSlotRun(seed);
    const trace: string[] = [];

    for (let beat = 0; beat < 12; beat += 1) {
      for (let index = 0; index < state.beat.groups.length; index += 1) {
        const group = state.beat.groups[index];
        const piece = pieceFor(state, index);
        // Vary accuracy and pace deterministically, so the trace exercises every grade.
        const skew = (beat + index) % 3 === 0 ? 1 : 0;
        const { width } = cellsExtent(piece.cells);
        const column = Math.min(GRID.cols - width, group.origin.column + skew);
        state = slotReducer(state, {
          type: 'place',
          pieceId: piece.id,
          row: group.origin.row,
          column,
          elapsedMs: 300 + ((beat * 7 + index * 13) % 2000),
        });
      }
      trace.push(
        `${beat}:${state.lastBeatGrade}:${state.combo}:${state.score}:${state.lastResolution?.blocksCleared}`,
      );
      state = slotReducer(state, { type: 'next_beat' });
    }

    return { trace, state };
  };

  const a = script('replay-me');
  const b = script('replay-me');
  assert.deepEqual(a.trace, b.trace);
  assert.equal(a.state.score, b.state.score);
  assert.equal(a.state.rngState, b.state.rngState);

  // And a different seed genuinely diverges, or the determinism above is vacuous.
  const other = script('replay-me-not');
  assert.notDeepEqual(a.trace, other.trace);
});

test('a long run of sloppy placements stays internally consistent', () => {
  // Past the launch, which is played cleanly and counts for nothing — this is about the race proper.
  let state = startedRun('sloppy');
  const firstEvent = state.eventSequence;
  const firstPlayed = state.beatsPlayed;

  for (let beat = 0; beat < 120; beat += 1) {
    const groups = state.beat.groups.length;
    // Always exactly one, because the combo never gets off the ground — which is the ramp working, not
    // a limitation. Difficulty is earned, so a player who never lands a clean beat is never handed more
    // to do; they simply make slower progress, which the payout already reflects.
    assert.equal(groups, 1, `beat ${beat} dealt ${groups} groups to a player with no streak`);
    assert.equal(state.beat.status, 'placing');
    assert.equal(state.tray.length, groups);

    for (let index = 0; index < groups; index += 1) {
      const piece = pieceFor(state, index);
      // Deliberately awful: a fixed corner, slowly.
      state = slotReducer(state, {
        type: 'place',
        pieceId: piece.id,
        row: 0,
        column: 0,
        elapsedMs: 3000,
      });
    }

    assert.equal(state.beat.status, 'resolved');
    assert.equal(state.combo, 0, 'sloppy play built a streak');
    assert.equal(state.eventSequence, firstEvent + beat + 1);
    assert.equal(state.beatsPlayed, firstPlayed + beat + 1);

    const resolution = state.lastResolution;
    assert.ok(resolution);
    assert.ok(resolution.blocksCleared >= 0);
    assert.ok(
      resolution.blocksCleared <= beatTargetCells(state.beat),
      'paid out more cells than the beat contained',
    );
    assert.equal(resolution.perfectClear, false);
    assert.ok(Number.isFinite(resolution.scoreDelta) && resolution.scoreDelta >= 0);

    state = slotReducer(state, { type: 'next_beat' });
  }

  assert.equal(state.maxCombo, 0);
  // One piece per beat, because every beat was a single — plus the launch, which `startedRun` played
  // before the loop and which does count as a placement even though it counts as nothing else.
  assert.equal(state.piecesPlaced, 121);
});

test('a run of perfect beats never stalls as the ramp climbs', () => {
  let state = startedRun('perfect-run');
  for (let beat = 0; beat < 60; beat += 1) {
    const target = beatTargetCells(state.beat);
    state = playBeatPerfectly(state);
    assert.equal(state.lastBeatGrade, 'perfect', `beat ${beat} was not perfect`);
    assert.equal(state.combo, beat + 1);
    assert.equal(state.lastResolution?.blocksCleared, target);
    state = slotReducer(state, { type: 'next_beat' });
  }
  assert.equal(state.maxCombo, 60);
});

// ----------------------------------------------------------------- discarding

test('a discarded piece is spent, scores nothing, and breaks the streak', () => {
  /**
   * Letting go of a piece somewhere the field is not used to be free: the tray sprang it home and nothing
   * was charged, which made the field's edge the safest place on screen. An uncertain player could hold a
   * piece over nothing indefinitely and pay less than one who aimed and was a cell out.
   *
   * It now costs what a badly aimed drop costs — the piece, and the streak.
   */
  let state = startedRun('discard-a');
  state = playBeatPerfectly(state);
  state = slotReducer(state, { type: 'next_beat' });
  const comboBefore = state.combo;
  assert.ok(comboBefore > 0, 'the run should be on a streak for the break to mean anything');

  const scoreBefore = state.score;
  const piece = pieceFor(state, 0);
  let next = state;
  for (let index = 0; index < state.beat.groups.length; index += 1) {
    next = slotReducer(next, {
      type: 'discard',
      pieceId: pieceFor(next, index).id,
      elapsedMs: 300,
    });
  }

  assert.equal(next.beat.status, 'resolved', 'the beat still has to resolve — pieces cannot be un-spent');
  assert.equal(next.combo, 0, 'a thrown-away piece breaks the streak');
  assert.equal(next.score, scoreBefore, 'and pays nothing');
  assert.equal(next.lastResolution?.blocksCleared, 0);
  assert.equal(next.lastResolution?.perfectClear, false);
  assert.ok(
    next.tray.every((candidate) => candidate.used),
    'every discarded piece must be consumed',
  );
  assert.equal(piece.used, false, 'the original state must not have been mutated');
});

test('a discard fills nothing and claims no group', () => {
  // The reason it is its own action rather than a `place` with an invented origin: any row and column
  // handed to `scorePlacement` would be a fiction, and a *clamped* one could land on a footprint and
  // score — which is the one outcome a total miss must never produce.
  const state = startedRun('discard-b');
  const before = state.beat.groups.map((group) => group.filled.length);
  const next = slotReducer(state, {
    type: 'discard',
    pieceId: pieceFor(state, 0).id,
    elapsedMs: 200,
  });

  const placement = next.beat.placements[next.beat.placements.length - 1];
  assert.equal(placement.groupId, null);
  assert.equal(placement.coverage, 0);
  assert.equal(placement.offset, Number.POSITIVE_INFINITY, 'a total miss must never compare as exact');
  assert.equal(placement.grade, 'miss');
  assert.deepEqual(placement.filled, []);
  assert.deepEqual(placement.wasted, [], 'the cells never touched the field, so none were wasted on it');
  assert.equal(placement.colorId, pieceFor(state, 0).colorId, 'the collapse needs the piece its colour');
  assert.deepEqual(
    next.beat.groups.map((group) => group.filled.length),
    before,
    'a discard must not fill anything',
  );
});

test('a discard still counts the time it took, so the beat pace is honest', () => {
  // The piece was in the air for however long it was in the air. Excluding it would make throwing a piece
  // away a way to stop the clock, which would be a strictly better move than a slow careful placement.
  const state = startedRun('discard-c');
  const next = slotReducer(state, {
    type: 'discard',
    pieceId: pieceFor(state, 0).id,
    elapsedMs: 900,
  });
  assert.equal(next.lastBeatElapsedMs, 900);
});

test('a beat part-landed and part-thrown-away still pays for what landed', () => {
  /**
   * The mixed case, which is the one that decides whether losing a piece is a cost or a catastrophe. It has
   * to be a cost: the beat resolves a footprint short, pays for the footprint that landed, and breaks the
   * streak — the same shape as any other beat with a miss in it.
   */
  let state = startedRun('discard-d');
  state = playBeatPerfectly(state);
  state = slotReducer(state, { type: 'next_beat' });
  assert.ok(state.beat.groups.length >= 2, 'this needs a multi-piece beat');

  const target = state.beat.groups[0];
  let next = slotReducer(state, {
    type: 'place',
    pieceId: pieceFor(state, 0).id,
    row: target.origin.row,
    column: target.origin.column,
    elapsedMs: 300,
  });
  for (let index = 1; index < state.beat.groups.length; index += 1) {
    next = slotReducer(next, {
      type: 'discard',
      pieceId: pieceFor(next, index).id,
      elapsedMs: 300,
    });
  }

  assert.equal(next.beat.status, 'resolved');
  assert.equal(
    next.lastResolution?.blocksCleared,
    target.cells.length,
    'the footprint that landed should pay in full',
  );
  assert.ok((next.score ?? 0) > state.score, 'a part-landed beat must still pay something');
  assert.equal(next.combo, 0, 'but the streak is gone');
});

test('a discard cannot spend a piece twice or revive a resolved beat', () => {
  // Same guards as `place`, and worth pinning separately: the screen dispatches this from a gesture
  // callback, which is the least predictable caller in the app.
  const state = startedRun('discard-e');
  const pieceId = pieceFor(state, 0).id;
  const once = slotReducer(state, { type: 'discard', pieceId, elapsedMs: 100 });
  const twice = slotReducer(once, { type: 'discard', pieceId, elapsedMs: 100 });
  assert.equal(twice, once, 'a spent piece must be a no-op, not a second placement');

  const unknown = slotReducer(state, { type: 'discard', pieceId: 'nope', elapsedMs: 100 });
  assert.equal(unknown, state);
});

// -------------------------------------------------------------------- ticking

test('a tick on an ordinary beat is a no-op, by identity', () => {
  /**
   * **The property the 60Hz tick rests on.** The screen dispatches this from the fixed-step loop, so it runs
   * sixty times a second; `use-match` treats a referentially identical result as "nothing happened" and does
   * not call `setRun`. If a tick ever returned a fresh object on an uneventful frame, the run state would
   * change every frame and the standing promise that React state holds only discrete things would be gone —
   * as a frame-rate problem rather than as a failing test, which is the worst way to find out.
   *
   * Checked with `===` deliberately. `deepEqual` would pass on a copy, and a copy is exactly the bug.
   */
  const state = startedRun('tick-noop');
  for (const elapsed of [0, 1, 500, 3000, 60_000]) {
    assert.equal(slotReducer(state, { type: 'tick', beatElapsedMs: elapsed }), state, `at ${elapsed}ms`);
  }
});

test('a tick on a resolved beat does nothing either', () => {
  // The settle window is a real gap between a beat resolving and the next being dealt, and the loop keeps
  // running through it. A variety must not be able to act on a beat that is already over.
  let state = startedRun('tick-resolved');
  state = playBeatPerfectly(state);
  assert.equal(state.beat.status, 'resolved');
  assert.equal(slotReducer(state, { type: 'tick', beatElapsedMs: 99_999 }), state);
});

test('a beat with no timed variety asks for no deadline', () => {
  // What lets the screen skip dispatching a tick entirely, which is every beat at today's tuning — the drift
  // is the only registered variety and it never expires.
  const state = startedRun('tick-deadline');
  assert.equal(beatDeadlineMs(state), null);
  assert.equal(beatDeadlineMs(slotReducer(state, { type: 'next_beat' })), null);
});

test('the launch beat carries no varieties, whatever the ladder would ask for', () => {
  /**
   * The launch is the first thing anybody ever does, framed by a camera used nowhere else. A moving or
   * burning target is not how to introduce a drag, so the dealer suppresses the plan's varieties outright
   * rather than relying on the opening plan happening to be empty.
   */
  const launch = dealBeat(GRID, 4242, 0, 0, plan(DRIFT_FULL_COMBO + 10), true);
  assert.deepEqual(launch.beat.varieties, []);
  assert.equal(launch.beat.launch, true);

  // And a run always opens on it.
  const run = createSlotRun('launch-clean');
  assert.deepEqual(run.beat.varieties, []);
});

test('a run carries its progression, and a fresh seed keeps it', () => {
  /**
   * `new_run` restarts the level; it does not change it. Carrying the progression through is what makes
   * "race again" replay the same level rather than dropping the player back onto the default one.
   */
  const state = startedRun('progression-carry');
  const again = slotReducer(state, { type: 'new_run', seed: 'different' });
  assert.equal(again.progression, state.progression);
  assert.equal(again.grid, state.grid);
  assert.equal(again.seed, 'different');
});

// ------------------------------------------------------------------- voiding

/**
 * A beat carrying a bomb rigged to a known piece, live.
 *
 * Built by dealing a two-slot beat and then overwriting the bomb's data, rather than by rolling until the
 * wanted piece comes up: which piece gets rigged is a random choice this test has no opinion about, and
 * fishing for a seed would make the test depend on the generator's internals.
 */
function armedBombRun(seed: string): { state: SlotRunState; riggedId: string; safeId: string } {
  let state = startedRun(seed);
  // Climb to a two-slot beat, which is what the mechanic needs.
  for (let guard = 0; state.beat.groups.length < 2; guard += 1) {
    assert.ok(guard < 40, 'never reached a two-slot beat');
    state = playBeatPerfectly(state);
    state = slotReducer(state, { type: 'next_beat' });
  }

  const riggedId = state.tray[0].id;
  const safeId = state.tray[1].id;
  const armed = {
    ...state,
    beat: {
      ...state.beat,
      varieties: [
        {
          id: 'bomb',
          data: { variant: 'defuse', pieceId: riggedId, armed: true, windowMs: 3000, nextToggleMs: 3000 },
        },
      ],
    },
  };
  return { state: armed, riggedId, safeId };
}

test('a voided beat pays absolutely nothing', () => {
  /**
   * The point of the whole mechanic, and the thing that makes it different from every other failure: a missed
   * beat still credits the cells that landed, so it pays *something*. This pays nothing at all.
   *
   * Asserted on the resolution rather than on the score alone, because "no boost" is four separate claims —
   * no cells cleared, no score, no perfect bonus, and no streak — and the boost the race actually applies is
   * computed from `blocksCleared`.
   */
  const { state, riggedId } = armedBombRun('void-a');
  const before = state.score;
  const group = state.beat.groups.find((candidate) => candidate.pieceId === riggedId)!;

  const boom = slotReducer(state, {
    type: 'place',
    pieceId: riggedId,
    row: group.origin.row,
    column: group.origin.column,
    elapsedMs: 200,
  });

  assert.equal(boom.beat.status, 'resolved', 'detonating ends the beat immediately');
  assert.equal(boom.beat.voided, true);
  assert.equal(boom.lastResolution?.blocksCleared, 0, 'no cells cleared means no boost');
  assert.equal(boom.lastResolution?.scoreDelta, 0);
  assert.equal(boom.lastResolution?.perfectClear, false);
  assert.equal(boom.score, before, 'the score must not move');
  assert.equal(boom.combo, 0, 'and the streak is gone');
  assert.equal(boom.lastBeatGrade, 'miss', 'so the bridge raises a miss and flashes the brake lights');
});

test('a voided beat still reports itself, so the screen and the race both see it', () => {
  // `eventSequence` has to advance or the bridge never learns the beat happened — the burst, the callout and
  // the miss flash all hang off it. A silently swallowed beat would leave the screen waiting for a settle.
  const { state, riggedId } = armedBombRun('void-b');
  const group = state.beat.groups.find((candidate) => candidate.pieceId === riggedId)!;
  const boom = slotReducer(state, {
    type: 'place',
    pieceId: riggedId,
    row: group.origin.row,
    column: group.origin.column,
    elapsedMs: 200,
  });

  assert.equal(boom.eventSequence, state.eventSequence + 1);
  assert.equal(boom.beatsPlayed, state.beatsPlayed + 1, 'it was a turn, and it was played');
});

test('a voided beat consumes every remaining piece', () => {
  /**
   * Otherwise the beat resolves with pieces still unused, and the tray keeps them draggable over a turn that
   * is already over — `placing` is derived from the status but the tray's own pieces are not. It is also the
   * honest model: the turn is lost, so nothing left in it is playable.
   */
  const { state, riggedId } = armedBombRun('void-c');
  const group = state.beat.groups.find((candidate) => candidate.pieceId === riggedId)!;
  const boom = slotReducer(state, {
    type: 'place',
    pieceId: riggedId,
    row: group.origin.row,
    column: group.origin.column,
    elapsedMs: 200,
  });

  assert.ok(boom.tray.every((piece) => piece.used), 'every piece should be spent');
});

test('playing the safe piece first defuses it, and the beat pays normally', () => {
  // The other half of the mechanic. A defused bomb has to be *fully* harmless, or the variant is a trap
  // rather than a puzzle.
  const { state, riggedId, safeId } = armedBombRun('void-d');
  const safeGroup = state.beat.groups.find((candidate) => candidate.pieceId === safeId)!;
  const riggedGroup = state.beat.groups.find((candidate) => candidate.pieceId === riggedId)!;

  let next = slotReducer(state, {
    type: 'place',
    pieceId: safeId,
    row: safeGroup.origin.row,
    column: safeGroup.origin.column,
    elapsedMs: 200,
  });
  assert.equal(next.beat.voided, false, 'the safe piece must not detonate anything');

  next = slotReducer(next, {
    type: 'place',
    pieceId: riggedId,
    row: riggedGroup.origin.row,
    column: riggedGroup.origin.column,
    elapsedMs: 200,
  });

  assert.equal(next.beat.status, 'resolved');
  assert.equal(next.beat.voided, false, 'a defused bomb must not void the beat');
  assert.ok((next.lastResolution?.blocksCleared ?? 0) > 0, 'and the beat should pay in full');
  assert.equal(next.lastBeatGrade, 'perfect');
  assert.equal(next.combo, state.combo + 1, 'the streak should survive');
});

test('throwing the rigged piece off the field still detonates it', () => {
  /**
   * A bomb that only went off on a *scoring* drop could be defused by hurling the rigged piece into empty
   * space — which would make the safest play the one that looks like giving up. A discard is a placement as
   * far as a variety is concerned.
   */
  const { state, riggedId } = armedBombRun('void-e');
  const boom = slotReducer(state, { type: 'discard', pieceId: riggedId, elapsedMs: 200 });
  assert.equal(boom.beat.voided, true);
  assert.equal(boom.lastResolution?.blocksCleared, 0);
});

// ------------------------------------------------------------------- absorbing

/**
 * A live beat whose first footprint is frozen, built by hand.
 *
 * Hand-built rather than fished for with seeds, for the reason `armedBombRun` is: which footprint gets frozen is a
 * random choice this test has no opinion about, and seed-fishing would make the test depend on the generator.
 */
function armouredRun(seed: string, hp: number): SlotRunState {
  const state = twoSlotRun(seed);
  const target = state.beat.groups[0];
  const points: Record<number, number> = {};
  for (const index of target.cells) points[index] = hp;

  return {
    ...state,
    beat: {
      ...state.beat,
      varieties: [
        {
          id: 'armour',
          data: { groupId: target.id, pieceId: target.pieceId, hp: points, max: hp },
        },
      ],
    },
  };
}

/** Drop a group's own piece exactly on it. */
function dropOn(state: SlotRunState, groupIndex: number, elapsedMs = 300): SlotRunState {
  const group = state.beat.groups[groupIndex];
  const piece = state.tray.find((candidate) => candidate.id === group.pieceId)!;
  return slotReducer(state, {
    type: 'place',
    pieceId: piece.id,
    row: group.origin.row,
    column: group.origin.column,
    elapsedMs,
  });
}

test('a drop on frozen armour lands nothing and keeps its piece', () => {
  /**
   * The three things `absorb` promises, in one test, because they only make sense together: no cells land, the
   * beat does not advance, and **the piece is still there to drop again**. That last one is the mechanic — without
   * it a one-hit-point footprint would simply eat the only piece and resolve the beat having paid nothing, which
   * is a worse outcome than aiming badly.
   */
  const state = armouredRun('armour-a', 1);
  const target = state.beat.groups[0];
  const chipped = dropOn(state, 0);

  assert.equal(chipped.beat.groups[0].filled.length, 0, 'not one cell may land on frozen armour');
  assert.equal(chipped.beat.status, 'placing', 'and the beat must not resolve');
  assert.ok(
    chipped.tray.every((piece) => !piece.used),
    'no piece may be spent — the drop is meant to be repeatable',
  );
  assert.equal(chipped.piecesPlaced, state.piecesPlaced, 'nor counted as a piece placed');

  // The armour itself took the damage.
  const data = varietyData<{ hp: Record<number, number> }>(chipped.beat, 'armour')!;
  for (const index of target.cells) assert.equal(data.hp[index], 0, `cell ${index} should be clear`);
});

test('the drop after the armour clears scores exactly as it always would', () => {
  // A delay, not a wall. The whole mechanic rests on the second drop being an ordinary drop.
  const state = armouredRun('armour-b', 1);
  const target = state.beat.groups[0];
  const cleared = dropOn(state, 0);
  const filled = dropOn(cleared, 0);

  assert.equal(
    filled.beat.groups[0].filled.length,
    target.cells.length,
    'every cell should land once the armour is gone',
  );
  assert.ok(filled.tray.some((piece) => piece.used), 'and this time the piece is spent');
});

test('chipping costs nothing on accuracy or on the clock', () => {
  /**
   * The balance decision, asserted rather than described. Chipping is the player doing the *right* thing several
   * times; charging the streak for it would make armour the harshest mechanic in the game by a distance.
   *
   * The pace half matters just as much and is easier to get wrong. Absorbed drops carry an `elapsedMs` like any
   * other placement, and if `resolveBeat` summed them every armoured beat would be automatically `LATE` — a
   * verdict the player could not avoid. The cost of armour is the race clock running while it happens, which is
   * charged once, in the only place it should be.
   */
  const state = armouredRun('armour-c', 2);
  let next = state;
  // Two chips at a deliberately slow pace, which alone would blow the whole budget.
  next = dropOn(next, 0, 1500);
  next = dropOn(next, 0, 1500);
  // Then both footprints, exactly and briskly.
  next = dropOn(next, 0, 300);
  next = dropOn(next, 1, 300);

  assert.equal(next.beat.status, 'resolved');
  assert.equal(next.lastBeatGrade, 'perfect', 'a beat cleared exactly is exact, however many chips it took');
  assert.equal(next.combo, state.combo + 1, 'so the streak survives');
  assert.equal(next.lastBeatPace, 'onTime', 'and the chips must not count against the budget');
});

test('a piece thrown off the field ends an armoured beat, so it can never trap the player', () => {
  /**
   * The escape hatch, and it is the reason `absorb` is safe to have at all. An absorbed drop suspends the beat, so
   * a player who cannot clear the armour would otherwise be stuck until the race clock ran out. A discard spends
   * the piece for real — nothing absorbs it — so the tray empties and the beat resolves short.
   */
  const state = armouredRun('armour-d', 2);
  let next = state;
  for (const index of [0, 1]) {
    const group = state.beat.groups[index];
    const piece = next.tray.find((candidate) => candidate.id === group.pieceId)!;
    next = slotReducer(next, { type: 'discard', pieceId: piece.id, elapsedMs: 200 });
  }
  assert.equal(next.beat.status, 'resolved', 'discarding must still end the beat');
  assert.equal(next.lastBeatGrade, 'miss');
});

test('an absorbed drop is on the beat but out of every verdict', () => {
  /**
   * The flag is what keeps the two facts compatible: the view needs to know the drop happened, and nothing that
   * grades the beat may see it. Pinned here because the failure mode is silent — a `resolveBeat` that forgot one
   * of its four uses would produce a beat that graded correctly and paid wrongly, or vice versa.
   */
  const chipped = dropOn(armouredRun('armour-e', 2), 0);
  assert.equal(chipped.beat.placements.length, 1, 'it is recorded');
  assert.equal(chipped.beat.placements[0].absorbed, true, 'and flagged');
  assert.equal(chipped.beat.placements[0].filled.length, 0);
  assert.equal(
    chipped.beat.placements[0].wasted.length,
    0,
    'not wasted either — these cells hit armour, they did not miss',
  );
});

// ------------------------------------------------------- waiting is not being late

test('a beat that makes the player wait widens its own budget', () => {
  /**
   * The fairness rule underneath the whole pace verdict, and the reason `waitMs` exists.
   *
   * Two mechanics ask the player to stand still rather than to aim better: a cycling bomb has to be waited out, and
   * a footprint showing its decoy cannot be dropped on until it turns back. Both waits are forced by the beat, and
   * charging them against a budget sized for *drags* called a competent player LATE for playing correctly — the one
   * kind of difficulty this codebase keeps having to take back out.
   *
   * Asserted against the budget rather than a played beat, because it is the threshold that moved. The `hues` window
   * is the interesting case: it applies on **every** hues beat, since the deal opens on the decoys.
   */
  const bare = { ...startedRun('pace-allowance').beat, varieties: [] };
  assert.equal(beatPaceAllowanceMs(bare), 0, 'an ordinary beat allows nothing extra');

  const waiting = {
    ...bare,
    varieties: [
      { id: 'hues', data: { swatches: { g0: { own: 'turbo', decoy: 'nitro' } }, windowMs: 2000, nextSwapMs: 0, swapped: false } },
    ],
  };
  assert.equal(beatPaceAllowanceMs(waiting), 2000, 'a colour clock is worth one window');
  assert.equal(
    paceBudgetMs(2, beatPaceAllowanceMs(waiting)) - paceBudgetMs(2),
    2000,
    'and the budget grows by exactly that',
  );
});

test('the mechanics that only change aim cost no extra time', () => {
  /**
   * The other half, and the one that keeps the allowance honest: a budget that grew for *every* mechanic would be a
   * blanket difficulty cut wearing a fairness argument's clothes. Only waiting earns it.
   *
   * Armour is the case worth naming. It takes several drags, so it looks like the most time-hungry mechanic here —
   * but an absorbed drop is excluded from the pace sum entirely, so its cost is the race clock rather than the
   * budget. Paying it twice would make every armoured beat automatically late.
   */
  const bare = { ...startedRun('pace-aim').beat, varieties: [] };
  const cases = [
    { id: 'drift', data: { strength: 1 } },
    { id: 'crossed', data: null },
    { id: 'armour', data: { groupId: 'g0', pieceId: 'p0', hp: { 10: 2, 11: 2 }, max: 2 } },
    // A `defuse` bomb is answered by order, not by the clock — you play the safe piece first, which you were going
    // to play anyway. Only the `cycle` variant costs a wait.
    { id: 'bomb', data: { variant: 'defuse', pieceId: 'p0', armed: true, windowMs: 3000, nextToggleMs: 3000 } },
  ];
  for (const spec of cases) {
    assert.equal(
      beatPaceAllowanceMs({ ...bare, varieties: [spec] }),
      0,
      `'${spec.id}' should cost no extra budget`,
    );
  }
});

// ---------------------------------------------------------------- colour as a rule

/**
 * A two-slot beat, reached by playing the ladder rather than by hand-building one.
 *
 * The colour rule is only testable on a beat with **two different colours** in it, and that is a property of the
 * dealer (`toPieces` shuffles `BLOCK_COLOR_IDS` so one deal never repeats a colour) rather than something worth
 * faking here. Climbing to the beat the real game would deal is what keeps this test honest about the rule as
 * shipped.
 */
function twoSlotRun(seed: string): SlotRunState {
  let state = startedRun(seed);
  for (let guard = 0; state.beat.groups.length < 2; guard += 1) {
    assert.ok(guard < 40, 'never reached a two-slot beat');
    state = playBeatPerfectly(state);
    state = slotReducer(state, { type: 'next_beat' });
  }
  assert.notEqual(
    state.beat.groups[0].colorId,
    state.beat.groups[1].colorId,
    'a deal must never repeat a colour, or the colour rule has nothing to say',
  );
  return state;
}

/**
 * A live hues variety mapping each of the beat's footprints to a chosen decoy.
 *
 * Built showing the **true** colours with the first swap due at 1000ms, so the window arithmetic below reads
 * plainly: window 0 is what this was built as, and every even window after it shows the decoys. Note this is not
 * how a dealt beat opens — `deal` opens on the decoys, so the opening move is to wait — but a hand-built starting
 * point is clearer here than inheriting that and inverting every assertion.
 */
function withHues(state: SlotRunState, decoys: Readonly<Record<string, string>>): SlotRunState {
  const swatches: Record<string, { own: string; decoy: string }> = {};
  for (const group of state.beat.groups) {
    const decoy = decoys[group.id];
    if (decoy !== undefined) swatches[group.id] = { own: group.colorId, decoy };
  }
  return {
    ...state,
    beat: {
      ...state.beat,
      varieties: [
        { id: 'hues', data: { swatches, windowMs: 1000, nextSwapMs: 1000, swapped: false } },
      ],
    },
  };
}

test('a perfectly aimed drop onto a footprint of another colour scores nothing', () => {
  /**
   * The rule the two colour mechanics are built on, and the reason they are mechanics at all.
   *
   * Stated as a *pair* with the control below, because the interesting claim is not "this drop failed" — it is
   * that the **same geometry** passes or fails purely on colour. Before this rule, colour paired a piece with its
   * footprint by eye and nothing else; a crossed tray would then have been a cosmetic shuffle, and a swapping
   * ghost would have been a light with no wiring behind it.
   */
  const state = twoSlotRun('colour-a');
  const group = state.beat.groups[0];
  const piece = pieceFor(state, 0);

  // Repaint that one footprint to the *other* group's colour — the sharpest version of the wrong colour, since
  // the piece now matches nothing on the field while its footprint still fits it exactly.
  const painted = {
    ...state,
    beat: {
      ...state.beat,
      groups: state.beat.groups.map((candidate, index) =>
        index === 0 ? { ...candidate, colorId: state.beat.groups[1].colorId } : candidate,
      ),
    },
  };

  const dropped = slotReducer(painted, {
    type: 'place',
    pieceId: piece.id,
    row: group.origin.row,
    column: group.origin.column,
    elapsedMs: 200,
  });

  const placed = dropped.beat.groups.reduce((total, candidate) => total + candidate.filled.length, 0);
  assert.equal(placed, 0, 'not one cell may land');
  assert.equal(dropped.score, painted.score, 'and it may not pay');
});

test('the identical drop pays in full when the colours agree', () => {
  // The control. Same seed, same piece, same cell — the only difference is that nobody repainted anything.
  const state = twoSlotRun('colour-a');
  const group = state.beat.groups[0];
  const piece = pieceFor(state, 0);

  const dropped = slotReducer(state, {
    type: 'place',
    pieceId: piece.id,
    row: group.origin.row,
    column: group.origin.column,
    elapsedMs: 200,
  });

  const placed = dropped.beat.groups.reduce((total, candidate) => total + candidate.filled.length, 0);
  assert.equal(placed, piece.cells.length, 'every cell should land');
});

test('a single-footprint beat is not filtered by colour, so the launch still plays', () => {
  /**
   * `matchesColour` returns its input by identity when every group matches, and a one-slot beat's only group is
   * the one holding that piece — so the rule is inert there by construction. Worth pinning because the **launch**
   * is a one-slot beat with a forced shape, and a colour rule that touched it would break the tutorial for a
   * reason nothing on screen explains.
   */
  const launch = createSlotRun('colour-launch');
  assert.equal(launch.beat.groups.length, 1);
  const played = playBeatPerfectly(launch);
  assert.equal(played.beat.status, 'resolved');
  assert.equal(played.beat.groups[0].filled.length, pieceFor(launch, 0).cells.length);
});

test('a refused drop says so, and a merely bad one does not', () => {
  /**
   * The distinction the screen needs in order to say the right thing, and the reason `Placement.refused` exists
   * at all. Filtering the candidates means a refused drop is scored through exactly the path a badly aimed one
   * takes — which is the point — and that leaves the two **indistinguishable in the result**. They deserve
   * opposite feedback: MISSED is advice about aim, and a player who aimed correctly will look for a problem they
   * do not have.
   *
   * Three cases, and the third is the one worth having a test for.
   */
  const state = twoSlotRun('refusal');
  const [first, second] = state.beat.groups;
  const painted = {
    ...state,
    beat: {
      ...state.beat,
      groups: state.beat.groups.map((candidate, index) =>
        index === 0 ? { ...candidate, colorId: second.colorId } : candidate,
      ),
    },
  };
  const piece = pieceFor(state, 0);

  // 1. Aimed at a footprint that will not take it: refused.
  const refused = slotReducer(painted, {
    type: 'place',
    pieceId: piece.id,
    row: first.origin.row,
    column: first.origin.column,
    elapsedMs: 200,
  });
  assert.equal(refused.beat.placements[0].refused, 'colour');

  // 2. The same drop when the colours agree: nothing refused it.
  const fine = slotReducer(state, {
    type: 'place',
    pieceId: piece.id,
    row: first.origin.row,
    column: first.origin.column,
    elapsedMs: 200,
  });
  assert.equal(fine.beat.placements[0].refused, null);

  /**
   * 3. Dropped into empty space on a beat whose colours *were* filtered.
   *
   * This must stay `null`. The colour rule did filter a group out, but the drop never went near it — so the
   * player simply missed, and WRONG COLOUR here would be coaching about a rule they did not break. This is why
   * the reducer scores a second, shadow pass rather than inferring the refusal from the filter alone.
   */
  const away = slotReducer(painted, {
    type: 'place',
    pieceId: piece.id,
    row: 0,
    column: 0,
    elapsedMs: 200,
  });
  assert.equal(away.beat.placements[0].coverage, 0, 'the drop has to have landed nothing');
  assert.equal(away.beat.placements[0].refused, null, 'a plain miss must not be called a refusal');
});

test('a piece thrown off the field was refused by nothing', () => {
  // There is no footprint to have been wrong about, which is exactly what separates a discard from a refusal.
  const state = twoSlotRun('refusal-discard');
  const gone = slotReducer(state, { type: 'discard', pieceId: pieceFor(state, 0).id, elapsedMs: 200 });
  assert.equal(gone.beat.placements[0].refused, null);
});

test('a repaint lands on the footprints it names and leaves the rest alone', () => {
  /**
   * The `recolour` effect is a **rule** change wearing a visual's clothes: after it, a footprint takes a
   * different piece. So a repaint that missed a group would leave that group enforcing a colour nobody can see,
   * which is the one failure mode here that would be invisible in play and obvious in the score.
   */
  const state = twoSlotRun('colour-b');
  const [first, second] = state.beat.groups;
  const decoy = BLOCK_COLOR_IDS.find((id) => id !== first.colorId && id !== second.colorId)!;

  // Only the first footprint is named, which is also how a variety dealt onto a beat that later reshaped would
  // behave — `recolour` addresses groups by id precisely so a stale name is ignored rather than misapplied.
  const ticked = slotReducer(withHues(state, { [first.id]: decoy, missing: decoy }), {
    type: 'tick',
    // Window 2, which is a decoy window — see `withHues`.
    beatElapsedMs: 2000,
  });

  assert.equal(ticked.beat.groups[0].colorId, decoy, 'the named footprint should repaint');
  assert.equal(ticked.beat.groups[1].colorId, second.colorId, 'the unnamed one must not');
  assert.equal(ticked.beat.status, 'placing', 'a repaint does not end a turn');
});

test('a repaint to the colour a footprint already has keeps the groups by identity', () => {
  /**
   * The no-op half of the tick contract. `expireVarieties` still advances the schedule, so the *state* changes —
   * but the groups array is what every view diffs on, and rebuilding it every window would repaint the whole
   * field on a swap that showed nothing. The reducer's identity-means-no-op promise is only worth anything if it
   * holds at this granularity too.
   */
  const state = twoSlotRun('colour-c');
  const same = Object.fromEntries(state.beat.groups.map((group) => [group.id, group.colorId]));
  const ticked = slotReducer(withHues(state, same), { type: 'tick', beatElapsedMs: 1000 });

  assert.notEqual(ticked, state, 'the schedule still moved');
  assert.equal(ticked.beat.groups, state.beat.groups, 'but nothing repainted, so nothing was rebuilt');
});

test('a swapped footprint refuses its own piece, and takes it again when it swaps back', () => {
  /**
   * The whole colour-swap mechanic in one pass, through the real reducer rather than through the variety's own
   * functions: swap, the drop fails; swap back, the same drop lands. That round trip is what makes it a *timing*
   * mechanic — the perfect beat never left, it was only unreachable for a window.
   */
  const state = twoSlotRun('colour-d');
  const [first] = state.beat.groups;
  const decoy = BLOCK_COLOR_IDS.find((id) => !state.beat.groups.some((g) => g.colorId === id))!;
  const live = withHues(state, { [first.id]: decoy });

  const swapped = slotReducer(live, { type: 'tick', beatElapsedMs: 2000 });
  assert.equal(swapped.beat.groups[0].colorId, decoy);

  const early = slotReducer(swapped, {
    type: 'place',
    pieceId: pieceFor(state, 0).id,
    row: first.origin.row,
    column: first.origin.column,
    elapsedMs: 200,
  });
  assert.equal(early.beat.groups[0].filled.length, 0, 'dropping mid-swap must fail');

  // The next window shows the true colours again, and the beat is playable once more.
  const back = slotReducer(swapped, { type: 'tick', beatElapsedMs: 3000 });
  assert.equal(back.beat.groups[0].colorId, first.colorId);

  const late = slotReducer(back, {
    type: 'place',
    pieceId: pieceFor(state, 0).id,
    row: first.origin.row,
    column: first.origin.column,
    elapsedMs: 200,
  });
  assert.equal(late.beat.groups[0].filled.length, pieceFor(state, 0).cells.length, 'and now it lands');
});

test('a beat with a timed variety asks for a tick, and an ordinary one does not', () => {
  // The gate that keeps the 60Hz dispatch affordable: the screen only ticks a beat that has asked to be told.
  const { state } = armedBombRun('void-f');
  assert.equal(beatDeadlineMs(state), null, 'a defuse bomb is event-driven, so it wants no clock');

  const cycling = {
    ...state,
    beat: {
      ...state.beat,
      varieties: [
        {
          id: 'bomb',
          data: {
            variant: 'cycle',
            pieceId: state.tray[0].id,
            armed: false,
            windowMs: 3000,
            nextToggleMs: 3000,
          },
        },
      ],
    },
  };
  assert.equal(beatDeadlineMs(cycling), 3000);

  // And a tick that crosses it toggles the bomb without ending the beat. Which way it toggles is the variety's
  // business — `bomb.test.ts` owns the parity — and the claim here is only that the reducer notices and that
  // noticing is not resolving.
  const ticked = slotReducer(cycling, { type: 'tick', beatElapsedMs: 3000 });
  assert.notEqual(ticked, cycling, 'crossing a deadline must change something');
  assert.equal(ticked.beat.status, 'placing', 'a toggle is not a resolve');
  assert.equal(ticked.beat.voided, false);
});
