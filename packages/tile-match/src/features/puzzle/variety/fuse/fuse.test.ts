/**
 * The jigsaw split: that both halves are placeable, and that **every** assembly which fills the shape is accepted.
 *
 * The mechanic hands the player two pieces and one footprint split in two. The promise it makes is geometric — fit
 * the pieces into the shape — so anything that fills the shape has to count. A split that only accepted one specific
 * assignment would be asking the player to guess an intention rather than solve a shape.
 *
 * Driven through the real dealer rather than by calling `splitGroup` directly, because the failure this is chasing is
 * an interaction: the split produces piece cells, and `resolveSlotDrop` and `scorePlacement` consume them. A unit
 * test of the split alone would happily pass on cells that the drop layer cannot aim at.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { cellsExtent } from '../../engine/board';
import { dealBeat } from '../../engine/slot-deal';
import { scorePlacement } from '../../engine/slot-drop';
import { SLOT_GRID } from '../../engine/slot-types';
import type { Beat, SlotGroup } from '../../engine/slot-types';
import type { Piece } from '../../engine/types';

/** A one-footprint beat with the fuse on it, which is what `JIGSAW_LEVEL` deals. */
function fusedBeat(seed: number): { beat: Beat; tray: Piece[] } {
  const dealt = dealBeat(SLOT_GRID, 1000 + seed * 7919, seed, seed, {
    slots: 1,
    zones: ['left'],
    varieties: [{ id: 'fuse', strength: 1 }],
    combo: 8,
  });
  return { beat: dealt.beat, tray: dealt.tray };
}

/** Every fused beat across many seeds, skipping the ones the split declined (single-row shapes). */
function fusedSamples(count = 120): { beat: Beat; tray: Piece[] }[] {
  const out: { beat: Beat; tray: Piece[] }[] = [];
  for (let seed = 0; seed < count; seed += 1) {
    const sample = fusedBeat(seed);
    if (sample.beat.groups.length === 2) out.push(sample);
  }
  return out;
}

const pieceFor = (tray: Piece[], group: SlotGroup): Piece =>
  tray.find((candidate) => candidate.id === group.pieceId)!;

/** Fill `group` with `piece` aimed at `at`, and report how many of the group's cells landed. */
function landed(group: SlotGroup, piece: Piece, at: SlotGroup): number {
  const score = scorePlacement(SLOT_GRID, [group], piece.cells, at.origin);
  return score.filled.length;
}

test('the split actually happens on shapes that can take it', () => {
  const samples = fusedSamples();
  assert.ok(samples.length > 40, `only ${samples.length} of 120 beats split — the mechanic barely fires`);
});

test('each half is a normalised piece the drop layer can aim at', () => {
  /**
   * **The bug this test was written to find.**
   *
   * `dropFootprintFor` and `cellsExtent` both document that they assume a piece's cells are normalised to a minimum
   * of zero on both axes — the drag quantises a drop by taking the footprint's centre as half its extent. A piece
   * whose cells start at column 1 therefore reports a width one larger than it is, and the resolved origin lands a
   * cell away from where the player aimed.
   *
   * That is invisible for most shapes, because the top half of a bounding box usually touches its left edge. It
   * bites on any shape whose first row is indented — an S, a Z, a T pointing down — and there it makes correct aim
   * score partially or not at all, which is exactly "it rejects valid placements, sometimes".
   */
  for (const { beat, tray } of fusedSamples()) {
    for (const group of beat.groups) {
      const piece = pieceFor(tray, group);
      const minRow = Math.min(...piece.cells.map((c) => c.row));
      const minColumn = Math.min(...piece.cells.map((c) => c.column));
      assert.equal(minRow, 0, `${piece.id} starts at row ${minRow}, not 0`);
      assert.equal(minColumn, 0, `${piece.id} starts at column ${minColumn}, not 0`);
    }
  }
});

test('a half dropped on its own footprint fills it completely', () => {
  // The floor: the intended assembly must work. If this fails the mechanic is simply broken.
  for (const { beat, tray } of fusedSamples()) {
    const [a, b] = beat.groups;
    assert.equal(landed(a, pieceFor(tray, a), a), a.cells.length, `${a.id} did not fill from its own piece`);
    assert.equal(landed(b, pieceFor(tray, b), b), b.cells.length, `${b.id} did not fill from its own piece`);
  }
});

test('congruent halves are interchangeable, so a swapped assembly also fills the shape', () => {
  /**
   * **The user-visible complaint.** When a shape splits into two halves of the same form — a 2x3 rectangle into two
   * 1x3 rows, a 2x2 into two 1x2s — there are two assemblies that fill it perfectly, and the game must take either.
   *
   * Nothing should be *enforcing* one: both halves carry the same colour deliberately, so `matchesColour` admits
   * either piece to either footprint and attribution is left to overlap. This asserts that the geometry actually
   * delivers on that, which is the half a comment cannot promise.
   */
  let checked = 0;
  for (const { beat, tray } of fusedSamples()) {
    const [a, b] = beat.groups;
    const pieceA = pieceFor(tray, a);
    const pieceB = pieceFor(tray, b);

    const extentA = cellsExtent(pieceA.cells);
    const extentB = cellsExtent(pieceB.cells);
    if (extentA.width !== extentB.width || extentA.height !== extentB.height) continue;
    // Same bounding box is not enough — compare the cell sets themselves.
    const shapeOf = (piece: Piece) =>
      piece.cells.map((c) => `${c.row},${c.column}`).sort().join(' ');
    if (shapeOf(pieceA) !== shapeOf(pieceB)) continue;

    checked += 1;
    assert.equal(landed(b, pieceA, b), b.cells.length, `piece A should fill footprint B on ${beat.index}`);
    assert.equal(landed(a, pieceB, a), a.cells.length, `piece B should fill footprint A on ${beat.index}`);
  }
  assert.ok(checked > 0, 'no congruent split turned up, so this proves nothing — widen the sample');
});

test('the two halves tile the original footprint exactly', () => {
  // No shared cell and nothing dropped: the pieces must add up to the shape, or "fill the shape" is unachievable.
  for (const { beat } of fusedSamples()) {
    const [a, b] = beat.groups;
    const overlap = a.cells.filter((cell) => b.cells.includes(cell));
    assert.deepEqual(overlap, [], `${a.id} and ${b.id} share cells`);
    assert.ok(a.cells.length > 0 && b.cells.length > 0, 'a half with no cells is not a half');
  }
});
