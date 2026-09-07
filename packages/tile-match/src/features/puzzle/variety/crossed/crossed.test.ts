/**
 * The crossed tray.
 *
 * Its own file, and that is worth being deliberate about: `crossed` and `hues` are **separate mechanics** that
 * happen to lean on the same rule. Both are about colour, both were added in the same pass, and the gauntlet
 * deals them together on one turn — none of which makes them one thing. They register independently, they are
 * dealt independently, and the level that combines them does so on exactly one of its eight turns, on purpose.
 * Testing them in one file would have quietly implied otherwise.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CROSSED_VARIETY } from './crossed';
import type { DealContext } from '../contract';
import { SLOT_GRID } from '../../engine/slot-types';
import type { SlotGroup } from '../../engine/slot-types';
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

const context = (rngState = 99): DealContext => ({
  grid: SLOT_GRID,
  beatIndex: 2,
  combo: 5,
  groups: [group('g0', 'turbo', 'p0'), group('g1', 'nitro', 'p1')],
  tray: [piece('p0', 'turbo'), piece('p1', 'nitro')],
  rngState,
});

test('a crossed tray holds the same pieces in the opposite order', () => {
  const ctx = context();
  const shaped = CROSSED_VARIETY.shape?.(ctx, 1);

  assert.deepEqual(
    shaped?.tray.map((entry) => entry.id),
    ['p1', 'p0'],
    'the tray should be reversed',
  );
  // The footprints are untouched, so each still names its own piece — the beat's answer has not moved, only the
  // path to it. That is what keeps a perfect beat available.
  assert.deepEqual(
    shaped?.groups.map((entry) => entry.pieceId),
    ['p0', 'p1'],
  );
  assert.equal(shaped?.rngState, ctx.rngState, 'reversing consumes no randomness');
});

test('the crossed tray is a derangement, never accidentally the identity', () => {
  /**
   * Reversed rather than shuffled, and this is why: a shuffle can roll the identity permutation, which would
   * deal a beat that claims to be crossed and is not. The player would learn nothing from it and — worse —
   * would learn that the marker sometimes lies.
   */
  const ctx = context();
  const shaped = CROSSED_VARIETY.shape?.(ctx, 1);
  shaped?.tray.forEach((entry, index) => {
    assert.notEqual(entry.id, ctx.tray[index].id, `slot ${index} was not crossed`);
  });
});

test('a one-piece beat is left alone rather than pretending to cross', () => {
  const solo: DealContext = {
    ...context(),
    groups: [group('g0', 'turbo', 'p0')],
    tray: [piece('p0', 'turbo')],
  };
  const shaped = CROSSED_VARIETY.shape?.(solo, 1);
  assert.deepEqual(shaped?.tray.map((entry) => entry.id), ['p0']);
});

test('it only bites because colour is a rule, and it never touches colour itself', () => {
  /**
   * The dependency stated as an assertion, because it is the whole reason this is a mechanic rather than a
   * nuisance. `crossed` moves *pieces*; what makes moving them cost anything is `matchesColour` refusing a piece
   * dropped on a footprint of another colour. Before that rule this would have been cosmetic — a wrong-order drop
   * that happened to overlap still scored.
   *
   * The corollary, asserted here: this variety must not touch colour at all. If it repainted anything, it would be
   * changing the information the rule reads rather than the path to it — which is `hues`' job, and the two would
   * stop being separable.
   */
  const ctx = context();
  const shaped = CROSSED_VARIETY.shape?.(ctx, 1);
  assert.deepEqual(
    shaped?.groups.map((entry) => entry.colorId),
    ['turbo', 'nitro'],
    'footprint colours must be untouched',
  );
  // Each piece keeps its own colour too, so the tray still says which footprint it belongs to — the swap is a
  // problem of *reach*, not of identification.
  assert.deepEqual(
    shaped?.tray.map((entry) => [entry.id, entry.colorId]),
    [
      ['p1', 'nitro'],
      ['p0', 'turbo'],
    ],
  );
});
