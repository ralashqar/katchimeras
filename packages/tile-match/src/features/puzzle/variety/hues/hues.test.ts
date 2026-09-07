/**
 * The colour swap.
 *
 * A **separate** mechanic from the crossed tray, which has its own file — see the note there. They share a
 * dependency (colour is a rule) and one gauntlet turn, and nothing else.
 *
 * The property worth most here is **solvability**. The obvious implementation of a colour swap — rotate the
 * beat's colours among its footprints — makes a beat with no valid drop at all, and it does so silently: the
 * pieces still fit, they simply cannot be placed. That is the one thing the dealer promises never happens.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { HUES_VARIETY, HUES_WINDOW_MS, huesColors, huesWindowMs, type HuesData } from './hues';
import type { DealContext } from '../contract';
import { paceBudgetMs } from '../../engine/slot-grade';
import { SLOT_GRID } from '../../engine/slot-types';
import type { SlotGroup } from '../../engine/slot-types';
import { BLOCK_COLOR_IDS } from '../../engine/types';
import type { BlockColorId, Piece } from '../../engine/types';

const group = (id: string, colorId: BlockColorId, pieceId: string): SlotGroup => ({
  id,
  zone: 'left',
  pieceId,
  colorId,
  cells: [10, 11],
  origin: { row: 2, column: 2 },
  filled: [],
});

const piece = (id: string, colorId: BlockColorId): Piece => ({
  id,
  shapeId: 'domino',
  cells: [
    { row: 0, column: 0 },
    { row: 0, column: 1 },
  ],
  colorId,
  used: false,
});

/** A two-footprint beat with matching pieces — what the dealer hands `shape`. */
const context = (rngState = 99): DealContext => ({
  grid: SLOT_GRID,
  beatIndex: 2,
  combo: 5,
  groups: [group('g0', 'turbo', 'p0'), group('g1', 'nitro', 'p1')],
  tray: [piece('p0', 'turbo'), piece('p1', 'nitro')],
  rngState,
});

/**
 * The beat as the *engine* builds it: shaped, then dealt.
 *
 * Every test below that cares about the data goes through this rather than calling `deal` on a two-footprint
 * context, because `shape` is now the step that decides which footprint the mechanic is about — and a test that
 * skipped it would be asserting against a beat the game never produces.
 */
const dealShaped = (rngState = 99) => {
  const ctx = context(rngState);
  const shaped = HUES_VARIETY.shape!(ctx, 1);
  return HUES_VARIETY.deal({ ...ctx, ...shaped }, 1);
};

test('the footprints open on their decoys, so the opening move is to wait', () => {
  /**
   * The opposite was tried first — opening on the truth, so the beat was playable immediately — on the reasoning
   * that opening mismatched punishes a quick reader. It has the same flaw the cycling bomb's disarmed opening
   * had: a brisk player drops inside the first window and the mechanic **never happens to them**. The colours
   * agreed, nothing refused anything, and the turn was an ordinary turn.
   *
   * Asserted through a tick at zero rather than off the dealt flag, and that distinction is the bug this test
   * exists to prevent. `swapped` lives in this variety's data; what the player sees and what `matchesColour`
   * enforces is `group.colorId`, which only the `recolour` effect moves. Dealing `swapped: true` would have
   * claimed a mismatch while the footprints still showed — and still accepted — their true colours.
   */
  const dealt = dealShaped().data;
  const [id, swatch] = Object.entries(dealt.swatches)[0]!;
  assert.equal(dealt.nextSwapMs, 0, 'a swap has to be due immediately, or nothing repaints');
  assert.equal(HUES_VARIETY.deadlineMs?.(dealt), 0, 'and the beat has to ask for the tick that does it');

  const opened = HUES_VARIETY.expire!(dealt, 0);
  assert.equal(opened.data.swapped, true);
  assert.deepEqual(huesColors(opened.data), { [id]: swatch.decoy });
  assert.deepEqual(
    opened.effects,
    [{ kind: 'recolour', colors: huesColors(opened.data) }],
    'the very first tick must repaint',
  );
  assert.equal(opened.data.nextSwapMs, dealt.windowMs, 'and the real schedule starts from there');
});

test('the decoy is never the colour the footprint actually wants', () => {
  /**
   * **The solvability argument, and the reason this flips rather than rotating.**
   *
   * Rotating a beat's colours among its footprints would mean piece A matches the footprint whose *shape* belongs
   * to piece B — no drop both matches and fits, and the dealer's standing guarantee that a perfect beat is always
   * available would break every other window. Flipping between own-colour and a decoy keeps a perfect beat
   * permanently reachable; it is simply not reachable right now.
   *
   * The decoy is drawn from colours the beat is not using, which on a trimmed one-footprint beat reduces to "not
   * its own". A decoy equal to the truth would be a mechanic that never refuses anything.
   */
  for (let seed = 0; seed < 30; seed += 1) {
    const data = dealShaped(seed * 1337).data;
    for (const [id, swatch] of Object.entries(data.swatches)) {
      assert.notEqual(swatch.decoy, swatch.own, `${id}'s decoy is its own colour`);
      assert.ok(BLOCK_COLOR_IDS.includes(swatch.decoy), `${id}'s decoy is not a block colour`);
    }
  }
});

test('the beat is trimmed to one footprint and its one piece', () => {
  /**
   * **The shape of the mechanic, and the assertion two earlier versions would both have failed.**
   *
   * First it swatched every footprint of a double, so the player waited not for *a* colour but for the only moment
   * both agreed with their pieces — one window in two rather than one in one, since the windows are in phase. Then
   * it swatched one and left the other alone, which is fairer and still not this mechanic: two drags to plan, the
   * interesting one blocked, so the turn reads as an ordinary double with a stalled corner.
   *
   * Both halves are asserted, and the tray half is the one that bites: a group kept without its piece is a beat
   * that resolves before the player touches it.
   */
  for (let seed = 0; seed < 60; seed += 1) {
    const ctx = context(seed * 7717);
    const shaped = HUES_VARIETY.shape!(ctx, 1);
    assert.equal(shaped.groups.length, 1, `seed ${seed} kept ${shaped.groups.length} footprints`);
    assert.equal(shaped.tray.length, 1, `seed ${seed} kept ${shaped.tray.length} pieces`);
    assert.equal(shaped.tray[0]!.id, shaped.groups[0]!.pieceId, 'and the piece must be that footprint’s own');

    // And the data agrees with the shape it was dealt against — one swatch, on the surviving footprint.
    const data = HUES_VARIETY.deal({ ...ctx, ...shaped }, 1).data;
    assert.deepEqual(Object.keys(data.swatches), [shaped.groups[0]!.id]);
  }
});

test('which footprint survives is rolled, so it cannot be learned', () => {
  // Always the left one would be a mechanic you stop reading after two beats.
  const chosen = new Set<string>();
  for (let seed = 0; seed < 80; seed += 1) {
    const shaped = HUES_VARIETY.shape!(context(seed * 2_654_435_761), 1);
    chosen.add(shaped.groups[0]!.id);
  }
  assert.deepEqual([...chosen].sort(), ['g0', 'g1'], 'both footprints should be reachable');
});

test('a beat it cannot trim is left exactly as dealt', () => {
  /**
   * Reachable if a `shape` ahead of this one leaves a group whose piece is not in the tray. Trimming to a group
   * with no piece would deal a turn with nothing to drop — the beat resolves on its own, empty, and the player
   * sees a footprint appear and vanish. Leaving it alone degrades to "this beat has no colour clock", which is a
   * missing mechanic rather than a broken one.
   */
  const ctx = context();
  const orphaned: DealContext = { ...ctx, tray: [] };
  const shaped = HUES_VARIETY.shape!(orphaned, 1);
  assert.deepEqual(shaped.groups, [...ctx.groups]);
  assert.deepEqual(shaped.tray, []);
  assert.notEqual(shaped.rngState, ctx.rngState, 'and the roll is still burned, or the deal stream diverges');
});

test('a matching window always comes back round, so the beat stays solvable', () => {
  /**
   * The invariant stated as a cycle rather than as a snapshot: at any point in the schedule, the footprints
   * return to their true colours within one window. A beat is therefore never *unplayable*, only not playable
   * right now — which is what makes this a timing mechanic instead of a broken deal.
   */
  let data = dealShaped().data;
  // Read against the surviving footprint's own colour rather than a hardcoded pair, since which one it is is rolled.
  const [id, swatch] = Object.entries(data.swatches)[0]!;

  let matched = 0;
  for (let window = 0; window < 8; window += 1) {
    if (huesColors(data)[id] === swatch.own) matched += 1;
    data = HUES_VARIETY.expire!(data, data.nextSwapMs).data;
  }
  assert.ok(matched >= 3, `only ${matched} of 8 windows were playable`);
});

test('the swap toggles on its schedule and catches up when told late', () => {
  const ctx = context();
  const shaped = HUES_VARIETY.shape!(ctx, 0);
  const data = HUES_VARIETY.deal({ ...ctx, ...shaped }, 0).data;
  const window = data.windowMs;

  const first = HUES_VARIETY.expire!(data, window);
  assert.equal(first.data.swapped, false, 'the first window ends on the truth — the wait is over');
  assert.equal(first.data.nextSwapMs, window * 2);
  assert.deepEqual(first.effects, [
    { kind: 'recolour', colors: huesColors(first.data) },
  ]);

  const second = HUES_VARIETY.expire!(first.data, window * 2);
  assert.equal(second.data.swapped, true, 'and the next one goes back to the decoys');

  // Late by three and a half windows: window 3 is a truthful one, so it must land unswapped rather than stepping
  // once from wherever it was.
  const late = HUES_VARIETY.expire!(data, window * 3.5);
  assert.equal(late.data.swapped, false);
  assert.equal(late.data.nextSwapMs, window * 4);

  for (let windows = 1; windows <= 8; windows += 1) {
    const jumped = HUES_VARIETY.expire!(data, window * windows);
    assert.equal(
      jumped.data.swapped,
      windows % 2 === 0,
      `after ${windows} windows the ghosts should be ${windows % 2 === 0 ? 'swapped' : 'true'}`,
    );
  }
});

test('the recolour effect names the one footprint the variety owns, and no other', () => {
  /**
   * Both halves matter and they fail in opposite directions.
   *
   * Naming **too few** leaves a ghost on a stale colour, and because colour is a rule that is a stale *rule* — the
   * footprint would take a piece it should be refusing. Naming **too many** would repaint a footprint this beat
   * never claimed, which is the bug that the "one footprint" change could most easily reintroduce.
   */
  const data = dealShaped().data;
  const owned = Object.keys(data.swatches);
  const effect = HUES_VARIETY.expire!(data, data.windowMs).effects[0];
  assert.equal(effect.kind, 'recolour');
  if (effect.kind !== 'recolour') return;
  assert.deepEqual(Object.keys(effect.colors).sort(), owned.sort());
  assert.equal(owned.length, 1, 'and it should own exactly one');
});

test('the window survives a whole drag at every strength', () => {
  /**
   * A window shorter than one drag would fail a player who *began* inside a matching window — a loss they could not
   * have avoided, which is the difference between hard and unfair.
   *
   * Measured against the **marginal** cost of a drag, `paceBudgetMs(2) - paceBudgetMs(1)`, rather than against a
   * whole one-piece budget. `paceBudgetMs(1)` is a drag *plus* `PACE.BASE_MS` to read the field, and the reading
   * happens before the player picks the piece up — so charging it against the window would be asking the window to
   * cover time the player spends looking at a ghost that has not started moving yet. The difference of the two is
   * exactly `PER_PIECE_MS`, which is the number this is about.
   */
  const oneDrag = paceBudgetMs(2) - paceBudgetMs(1);
  for (const strength of [0, 0.5, 1]) {
    assert.ok(
      huesWindowMs(strength) > oneDrag,
      `at strength ${strength} the window is ${huesWindowMs(strength)}ms against a ${oneDrag}ms drag`,
    );
  }
  assert.equal(huesWindowMs(0), HUES_WINDOW_MS);
  assert.ok(huesWindowMs(1) < HUES_WINDOW_MS, 'strength should squeeze it');
  assert.equal(huesWindowMs(-3), huesWindowMs(0), 'and clamp outside 0..1');
  assert.equal(huesWindowMs(9), huesWindowMs(1));
});

test('a beat with no footprints wants no clock', () => {
  // Reachable if a level asks for this on a turn the dealer could not fill. Inert beats crashing.
  const empty = HUES_VARIETY.deal({ ...context(), groups: [], tray: [] }, 1).data;
  assert.deepEqual(empty.swatches, {});
  assert.equal(HUES_VARIETY.deadlineMs?.(empty), null);
});

test('the variety consumes the same rolls whatever the plan asked for', () => {
  /**
   * The rng rule, across **both** hooks. `shape` takes one roll to choose the survivor and `deal` takes one for the
   * decoy, so a hues beat advances the generator by exactly two however many footprints the plan asked for — and
   * every deal after it therefore lands in the same place. A roll taken only when there was something to choose
   * between is the thing that makes runs diverge.
   *
   * The single-footprint case is the one that would have broken it: `nextInt(state, 1)` is a *pointless* roll, and
   * the tempting optimisation is to skip it.
   */
  const solo: DealContext = {
    ...context(500),
    groups: [group('g0', 'turbo', 'p0')],
    tray: [piece('p0', 'turbo')],
  };
  const consume = (ctx: DealContext): number => {
    const shaped = HUES_VARIETY.shape!(ctx, 1);
    return HUES_VARIETY.deal({ ...ctx, ...shaped }, 1).rngState;
  };

  assert.equal(consume(solo), consume(context(500)));
  assert.notEqual(consume(solo), 500, 'and it must actually roll');
});

test('the data survives a round trip through its own colours', () => {
  // `huesColors` is read by both the reducer's effect and the layer, so the two cannot disagree about what is
  // showing. Worth pinning because a drift between them would be invisible: the field would draw one colour and
  // the rule would enforce another.
  const data: HuesData = dealShaped().data;
  const [id, swatch] = Object.entries(data.swatches)[0]!;

  assert.deepEqual(huesColors({ ...data, swapped: false }), { [id]: swatch.own });
  assert.deepEqual(huesColors({ ...data, swapped: true }), { [id]: swatch.decoy });
  assert.notEqual(swatch.decoy, swatch.own, 'a decoy identical to the truth would never refuse anything');
});
