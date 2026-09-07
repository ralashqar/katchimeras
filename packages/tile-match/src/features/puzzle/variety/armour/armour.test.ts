/**
 * Armour: a footprint that has to be broken open before it will take anything.
 *
 * The variety with the most ways to go wrong, because it is the first one that changes **how many drops a turn
 * takes**. Two failure modes are worse than the others and both have their own tests below: armour that never
 * finishes deals a beat the player cannot end, and armour that costs the streak turns doing the right thing
 * repeatedly into a punishment.
 *
 * `slot-engine.test.ts` covers the other half — that an absorbed drop really does leave the piece in the tray and
 * stay out of every verdict.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  ARMOUR_MAX_HP,
  ARMOUR_MIN_HP,
  ARMOUR_VARIETY,
  armourDropsLeft,
  armourHolds,
  armourHpFor,
  armourProgress,
  type ArmourData,
} from './armour';
import type { DealContext } from '../contract';
import { SLOT_GRID } from '../../engine/slot-types';
import type { SlotGroup } from '../../engine/slot-types';
import type { BlockColorId, Piece } from '../../engine/types';

const group = (id: string, pieceId: string, cells: number[], colorId: BlockColorId): SlotGroup => ({
  id,
  zone: 'left',
  pieceId,
  colorId,
  cells,
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

/** A two-footprint beat: cells 10–11 for p0, cells 30–31 for p1. */
const context = (rngState = 4242): DealContext => ({
  grid: SLOT_GRID,
  beatIndex: 3,
  combo: 7,
  groups: [group('g0', 'p0', [10, 11], 'turbo'), group('g1', 'p1', [30, 31], 'nitro')],
  tray: [piece('p0', 'turbo'), piece('p1', 'nitro')],
  rngState,
});

/** Deal armour and hand back just its data. */
const dealt = (strength: number, ctx = context()): ArmourData =>
  ARMOUR_VARIETY.deal(ctx, strength).data;

/** The footprint the armour landed on, from the beat it was dealt against. */
const frozen = (data: ArmourData, ctx: DealContext): SlotGroup =>
  ctx.groups.find((candidate) => candidate.id === data.groupId)!;

// -------------------------------------------------------------------- dealing

test('exactly one footprint is frozen, and every one of its cells carries the same points', () => {
  /**
   * One, not both, and that is a design constraint rather than a simplification — see the module header. A double
   * with both footprints armoured is four chips plus two placements, which is not a harder version of this
   * mechanic but a different and much worse one. The interesting shape is the asymmetry.
   */
  for (let seed = 0; seed < 30; seed += 1) {
    const ctx = context(seed * 6151);
    const data = dealt(1, ctx);
    const chosen = ctx.groups.filter((candidate) => candidate.id === data.groupId);
    assert.equal(chosen.length, 1, 'exactly one footprint should be frozen');

    // Its cells, all of them, and nothing else's.
    assert.deepEqual(Object.keys(data.hp).map(Number).sort(), [...chosen[0].cells].sort());
    for (const index of chosen[0].cells) {
      assert.equal(data.hp[index], data.max, `cell ${index} should start on ${data.max}`);
    }
  }
});

test('which footprint is frozen is rolled, and the roll advances the generator', () => {
  // Rolled so it cannot be learned as "the left one is always the hard one" — the same reasoning as the bomb's
  // rigged piece.
  const chosen = new Set<string | null>();
  for (let seed = 0; seed < 40; seed += 1) {
    chosen.add(dealt(1, context(seed * 7919)).groupId);
  }
  assert.deepEqual([...chosen].sort(), ['g0', 'g1'], 'both footprints should be freezable');

  const result = ARMOUR_VARIETY.deal(context(4242), 1);
  assert.notEqual(result.rngState, 4242, 'the roll must advance the generator');
});

test('the roll happens even when there is nothing to freeze', () => {
  /**
   * The contract's rng rule. A beat the dealer could not fill still has to burn the roll, or it leaves the
   * generator a step behind a beat that did freeze something and every later deal diverges.
   */
  const empty = ARMOUR_VARIETY.deal({ ...context(900), groups: [], tray: [] }, 1);
  const full = ARMOUR_VARIETY.deal(context(900), 1);
  assert.equal(empty.data.groupId, null);
  assert.deepEqual(empty.data.hp, {});
  assert.equal(empty.rngState, full.rngState, 'the generator must land in the same place either way');
});

test('strength picks the hit points, and they stay small', () => {
  /**
   * Small on purpose. Two points is three drags for that footprint, which on a double is four against an ordinary
   * beat's two — already most of the pace budget. Higher and the beat stops being a beat.
   */
  assert.equal(armourHpFor(0), ARMOUR_MIN_HP);
  assert.equal(armourHpFor(0.49), ARMOUR_MIN_HP);
  assert.equal(armourHpFor(0.5), ARMOUR_MAX_HP);
  assert.equal(armourHpFor(1), ARMOUR_MAX_HP);
  assert.ok(ARMOUR_MIN_HP >= 1, 'zero points would be armour that was never there');
  assert.ok(ARMOUR_MAX_HP <= 2, 'more than two turns a beat into a siege');
});

test('the number on a cell counts drops, not hit points', () => {
  /**
   * **The off-by-one is the point of the function, so it is asserted as an off-by-one.**
   *
   * A cell on 1 point needs a chip and *then* a placement. A plate reading `1` therefore promised one more drop and
   * took two — wrong in the direction that costs a streak, because the player plans the beat around it. Printing
   * drops-remaining means the last number shown before the plate leaves is `1`, and one drop later the footprint is
   * theirs.
   *
   * Pinned against `armourHpFor` at both strengths rather than against literals, so the two-drop and three-drop
   * readings stay tied to the hit points they come from — a retune that moved `ARMOUR_MAX_HP` and left this behind
   * would be a plate lying about the beat it is on.
   */
  assert.equal(armourDropsLeft(armourHpFor(0)), 2, 'the gentle armour is a two-drop cell');
  assert.equal(armourDropsLeft(armourHpFor(1)), 3, 'and the hard one is three');

  // The countdown itself: every step is one lower, and it never shows a promise it cannot keep.
  assert.equal(armourDropsLeft(2), 3);
  assert.equal(armourDropsLeft(1), 2);

  /**
   * Zero is unreachable on screen — the layer stops drawing a cell at zero points, because a cleared cell is an
   * ordinary footprint again. It still has to answer `1` rather than `0`: the plate's exit animation runs on the
   * frame the cell clears, and a `0` flashing during it would read as "no drops left" on the exact cell that still
   * wants one.
   */
  assert.equal(armourDropsLeft(0), 1);
  assert.equal(armourDropsLeft(-3), 1, 'and it clamps rather than counting backwards');
});

// -------------------------------------------------------------------- chipping

test('the right piece on the frozen footprint takes a point off every cell it covered', () => {
  const ctx = context();
  const data = dealt(1, ctx);
  const target = frozen(data, ctx);

  // Cover one of its two cells only, so the partial case is the one under test.
  const once = ARMOUR_VARIETY.absorb!(data, {
    piece: piece(target.pieceId, target.colorId),
    covered: [target.cells[0]],
  });
  assert.ok(once, 'a drop on a frozen cell must be absorbed');
  assert.equal(once.data.hp[target.cells[0]], ARMOUR_MAX_HP - 1);
  assert.equal(once.data.hp[target.cells[1]], ARMOUR_MAX_HP, 'a cell it missed keeps its points');
});

test('it always finishes, so the beat can always be ended', () => {
  /**
   * **The invariant that matters most here.** `absorb` suspends the beat — the piece is handed back and nothing
   * resolves — so a variety that ate drops forever would deal a turn with no way out but throwing the piece off
   * the field. Armour is bounded by its points, and this walks that bound to zero.
   *
   * Asserted as a loop with a guard rather than a fixed count, so it fails loudly if the arithmetic ever stops
   * converging instead of hanging the suite. A test that cannot fail without hanging is worse than a wrong one.
   */
  const ctx = context();
  let data = dealt(1, ctx);
  const target = frozen(data, ctx);
  const held = piece(target.pieceId, target.colorId);

  let drops = 0;
  while (armourHolds(data)) {
    drops += 1;
    assert.ok(drops < 20, 'armour never cleared');
    const eaten = ARMOUR_VARIETY.absorb!(data, { piece: held, covered: target.cells });
    assert.ok(eaten, `drop ${drops} should still have been absorbed`);
    data = eaten.data;
  }

  // Covering every cell each time, so it takes exactly as many drops as a cell has points.
  assert.equal(drops, ARMOUR_MAX_HP);
  assert.equal(armourProgress(data).left, 0);
});

test('once it is clear the next drop goes straight through and scores', () => {
  // The whole point of the mechanic: it is a *delay*, not a wall.
  const ctx = context();
  const data = dealt(0, ctx);
  const target = frozen(data, ctx);
  const held = piece(target.pieceId, target.colorId);

  const chipped = ARMOUR_VARIETY.absorb!(data, { piece: held, covered: target.cells })!.data;
  assert.equal(armourHolds(chipped), false, 'one point means one chip');

  assert.equal(
    ARMOUR_VARIETY.absorb!(chipped, { piece: held, covered: target.cells }),
    null,
    'a cleared footprint must not eat the drop that fills it',
  );
  assert.equal(
    ARMOUR_VARIETY.accepts!(chipped, { group: target, piece: held }),
    true,
    'and it must then accept the piece',
  );
});

test('a frozen footprint accepts nothing at all, even on cells already cleared', () => {
  /**
   * All-or-nothing, which is what "all cells must be clear for regular play" means. The alternative — cleared
   * cells scoring while their neighbours are still frozen — would be a drop that both chips and scores, and a
   * placement that is half progress and half payout is not something the grader can describe.
   *
   * This is also the case `accepts` exists for at all: a drop landing *only* on cleared cells covers nothing
   * frozen, so `absorb` declines it, and without the gate it would score on a footprint still holding points.
   */
  const ctx = context();
  const data = dealt(1, ctx);
  const target = frozen(data, ctx);
  const held = piece(target.pieceId, target.colorId);

  // Clear one cell entirely, leave the other frozen.
  const partial: ArmourData = { ...data, hp: { ...data.hp, [target.cells[0]]: 0 } };
  assert.equal(armourHolds(partial), true);
  assert.equal(ARMOUR_VARIETY.accepts!(partial, { group: target, piece: held }), false);

  // A drop covering only the cleared cell is not absorbed — there was nothing to chip.
  assert.equal(
    ARMOUR_VARIETY.absorb!(partial, { piece: held, covered: [target.cells[0]] }),
    null,
  );
});

test('another footprint is unaffected, and its drops are never stolen', () => {
  /**
   * The reason the armour records a `pieceId` rather than working out what it hit. A mechanic that swallowed the
   * neighbour's drop would be taking a placement the player earned — and on a double the two footprints can be
   * covered by one badly aimed piece.
   */
  const ctx = context();
  const data = dealt(1, ctx);
  const other = ctx.groups.find((candidate) => candidate.id !== data.groupId)!;
  const target = frozen(data, ctx);

  assert.equal(
    ARMOUR_VARIETY.accepts!(data, { group: other, piece: piece(other.pieceId, other.colorId) }),
    true,
    'the open footprint must still take its own piece',
  );

  // The other piece, dropped across the frozen footprint's cells: not absorbed. It is a wrong-colour drop, and the
  // colour rule is what should judge it.
  assert.equal(
    ARMOUR_VARIETY.absorb!(data, {
      piece: piece(other.pieceId, other.colorId),
      covered: target.cells,
    }),
    null,
  );
});

test('a drop nowhere near the frozen footprint is left alone', () => {
  // Otherwise every drop on an armoured beat would be eaten, and the beat could never end.
  const ctx = context();
  const data = dealt(1, ctx);
  const target = frozen(data, ctx);
  assert.equal(
    ARMOUR_VARIETY.absorb!(data, {
      piece: piece(target.pieceId, target.colorId),
      covered: [0, 1, 2],
    }),
    null,
  );
});

test('a beat with nothing frozen is inert rather than a crash', () => {
  // Reachable if a level asks for armour on a turn the dealer could not fill.
  const empty = ARMOUR_VARIETY.deal({ ...context(), groups: [], tray: [] }, 1).data;
  assert.equal(armourHolds(empty), false);
  assert.equal(ARMOUR_VARIETY.absorb!(empty, { piece: piece('p0', 'turbo'), covered: [10] }), null);
  assert.equal(
    ARMOUR_VARIETY.accepts!(empty, {
      group: group('g0', 'p0', [10, 11], 'turbo'),
      piece: piece('p0', 'turbo'),
    }),
    true,
  );
});

test('progress is reported against what it started with', () => {
  // The view draws how far along the player is from this, so it has to agree with the deal.
  const ctx = context();
  const data = dealt(1, ctx);
  const target = frozen(data, ctx);
  const start = armourProgress(data);
  assert.equal(start.left, start.total);
  assert.equal(start.total, target.cells.length * ARMOUR_MAX_HP);

  const chipped = ARMOUR_VARIETY.absorb!(data, {
    piece: piece(target.pieceId, target.colorId),
    covered: target.cells,
  })!.data;
  const after = armourProgress(chipped);
  assert.equal(after.left, start.left - target.cells.length);
  assert.equal(after.total, start.total, 'the total must not move — it is what was there to begin with');
});
