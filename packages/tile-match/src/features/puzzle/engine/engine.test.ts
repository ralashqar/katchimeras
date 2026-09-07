/**
 * Tests for the geometry and shape primitives the slot game is built on.
 *
 * These modules — `board.ts` and `shapes.ts` — came through the pivot unchanged, which is the
 * strongest evidence that the slot field really is just a small board. What used to be here as well
 * were the tests for `reducer.ts`, `snap.ts` and `generateTray`; those modules are gone and their
 * successors are covered by `slot-engine.test.ts`.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  boardIndex,
  canPlace,
  cellFromIndex,
  cellsExtent,
  createEmptyBoard,
  normaliseCells,
  rotateCells,
  validOrigins,
} from './board';
import { MAX_SHAPE_HEIGHT, buildShapePool, shapeCellCount } from './shapes';
import { SLOT_GRID } from './slot-types';
import { pickDiverseShapes, toPieces } from './tray';
import type { Cell } from './types';

/**
 * The slot field's **virtual** grid: 13 wide, 8 tall.
 *
 * Much larger than anything drawn. Four of those columns and four of those rows are empty margin that
 * exists purely so a drop aimed past a zone has somewhere to land that is not a target — see
 * `SLOT_GRID`. The drawn part is `SLOT_PLAY_AREA`.
 */
const SPEC = SLOT_GRID;

// ---------------------------------------------------------------- geometry

test('the virtual field is 13 wide and 8 tall', () => {
  assert.equal(SPEC.cols, 13);
  assert.equal(SPEC.rows, 8);
  assert.equal(createEmptyBoard(SPEC).length, 104);
});

test('boardIndex strides by cols, and round-trips', () => {
  assert.equal(boardIndex(SPEC, 0, 0), 0);
  assert.equal(boardIndex(SPEC, 0, 12), 12);
  assert.equal(boardIndex(SPEC, 1, 0), 13);
  assert.equal(boardIndex(SPEC, 7, 12), 103);

  for (let index = 0; index < SPEC.rows * SPEC.cols; index += 1) {
    const cell = cellFromIndex(SPEC, index);
    assert.equal(boardIndex(SPEC, cell.row, cell.column), index);
  }
});

test('normaliseCells shifts to origin and sorts', () => {
  const normalised = normaliseCells([
    { row: 3, column: 5 },
    { row: 2, column: 4 },
  ]);
  assert.deepEqual(normalised, [
    { row: 0, column: 0 },
    { row: 1, column: 1 },
  ]);
});

test('rotateCells returns to the original after four turns', () => {
  const cells: Cell[] = [
    { row: 0, column: 0 },
    { row: 0, column: 1 },
    { row: 1, column: 1 },
  ];
  let rotated = cells;
  for (let turn = 0; turn < 4; turn += 1) rotated = rotateCells(rotated, 1);
  assert.deepEqual(rotated, normaliseCells(cells));
});

test('cellsExtent measures the bounding box', () => {
  const extent = cellsExtent([
    { row: 0, column: 0 },
    { row: 2, column: 1 },
  ]);
  assert.deepEqual(extent, { height: 3, width: 2 });
});

test('canPlace rejects out of bounds on the short axis', () => {
  const board = createEmptyBoard(SPEC);
  const tall: Cell[] = [0, 1, 2].map((row) => ({ row, column: 0 }));
  assert.ok(canPlace(SPEC, board, tall, 5, 0));
  assert.ok(!canPlace(SPEC, board, tall, 6, 0));
});

test('canPlace rejects out of bounds on the long axis', () => {
  const board = createEmptyBoard(SPEC);
  const wide: Cell[] = [0, 1, 2].map((column) => ({ row: 0, column }));
  assert.ok(canPlace(SPEC, board, wide, 0, 10));
  assert.ok(!canPlace(SPEC, board, wide, 0, 11));
});

test('canPlace rejects overlap', () => {
  const board = createEmptyBoard(SPEC);
  board[boardIndex(SPEC, 2, 3)] = 'turbo';
  assert.ok(!canPlace(SPEC, board, [{ row: 0, column: 0 }], 2, 3));
  assert.ok(canPlace(SPEC, board, [{ row: 0, column: 0 }], 2, 4));
});

test('validOrigins counts correctly for a single cell on an empty field', () => {
  const board = createEmptyBoard(SPEC);
  assert.equal(validOrigins(SPEC, board, [{ row: 0, column: 0 }]).length, 104);
});

test('validOrigins respects the field for a 4-wide line', () => {
  const board = createEmptyBoard(SPEC);
  const line4: Cell[] = [0, 1, 2, 3].map((column) => ({ row: 0, column }));
  // 10 horizontal positions x 8 rows.
  assert.equal(validOrigins(SPEC, board, line4).length, 80);
});

// ----------------------------------------------------------------- shapes

test('no shape rotation is taller than the limit or wider than the field', () => {
  const pool = buildShapePool(SPEC);
  assert.ok(pool.length > 0);
  for (const shape of pool) {
    assert.ok(
      shape.height <= MAX_SHAPE_HEIGHT,
      `${shape.id} is ${shape.height} tall, limit is ${MAX_SHAPE_HEIGHT}`,
    );
    assert.ok(shape.width <= SPEC.cols, `${shape.id} is ${shape.width} wide`);
  }
});

test('the full-height exception is unreachable on this grid, and nothing needs it', () => {
  // `buildShapePool` lets a line exactly as tall as the grid escape the height limit. That mattered on
  // the 5-row board, where the 5-tall column was self-clearing. The virtual grid is 8 rows and the
  // tallest family is 5, so the exception can no longer fire — which is fine, because a tall column
  // would not fit a two-column zone anyway. Asserted so the dead branch is a known fact rather than a
  // surprise if the grid is ever resized.
  const pool = buildShapePool(SPEC);
  assert.ok(
    pool.every((shape) => !(shape.width === 1 && shape.height === SPEC.rows)),
    'a grid-height line got through; the height rule needs rethinking for the zones',
  );

  const has = (familyId: string, height: number, width: number) =>
    pool.some((s) => s.familyId === familyId && s.height === height && s.width === width);

  assert.ok(has('line-4', 1, 4), 'horizontal line-4 should exist');
  assert.ok(!has('line-4', 4, 1), 'a 4-tall line is past the height limit');
  assert.ok(has('line-5', 1, 5), 'horizontal line-5 should exist');
  assert.ok(!has('line-5', 5, 1), 'a 5-tall line is past the height limit');
  assert.ok(has('line-3', 3, 1), 'a 3-tall vertical line is exactly at the limit');
});

test('there is no single-cell piece', () => {
  // A 1x1 always fits, which removes the placement problem entirely.
  const pool = buildShapePool(SPEC);
  assert.ok(
    pool.every((shape) => shape.cells.length >= 2),
    'the smallest piece should be the domino',
  );
});

test('a family keeps its total weight when rotations are filtered out', () => {
  const pool = buildShapePool(SPEC);
  const totalFor = (familyId: string) =>
    pool.filter((s) => s.familyId === familyId).reduce((sum, s) => sum + s.weight, 0);

  // line-5 loses its vertical form to the height limit, so its single surviving rotation must carry
  // the family's whole weight rather than half of it.
  assert.equal(totalFor('line-5'), 2);
  assert.equal(totalFor('line-3'), 6);
});

test('every shape in the pool fits on an empty field', () => {
  const board = createEmptyBoard(SPEC);
  for (const shape of buildShapePool(SPEC)) {
    assert.ok(
      validOrigins(SPEC, board, shape.cells).length > 0,
      `${shape.id} cannot be placed on an empty field`,
    );
  }
});

// ------------------------------------------------------- dealing primitives

test('pickDiverseShapes prefers distinct families', () => {
  const pool = buildShapePool(SPEC);
  const { shapes } = pickDiverseShapes(pool, 12345, 3);
  assert.equal(shapes.length, 3);
  assert.equal(
    new Set(shapes.map((shape) => shape.familyId)).size,
    3,
    'three picks should come from three families',
  );
});

test('pickDiverseShapes caps how many big pieces a deal can contain', () => {
  const pool = buildShapePool(SPEC);
  for (let seed = 0; seed < 40; seed += 1) {
    const { shapes } = pickDiverseShapes(pool, seed * 7919, 3);
    const big = shapes.filter((shape) => shapeCellCount(shape) >= 5).length;
    assert.ok(big <= 1, `seed ${seed} dealt ${big} big pieces`);
  }
});

test('pickDiverseShapes is deterministic for a given rng state', () => {
  const pool = buildShapePool(SPEC);
  const a = pickDiverseShapes(pool, 999, 3);
  const b = pickDiverseShapes(pool, 999, 3);
  assert.deepEqual(
    a.shapes.map((shape) => shape.id),
    b.shapes.map((shape) => shape.id),
  );
  assert.equal(a.rngState, b.rngState);
});

test('toPieces gives distinct ids and colours', () => {
  const pool = buildShapePool(SPEC);
  const { shapes } = pickDiverseShapes(pool, 4242, 3);
  const { pieces } = toPieces(shapes, 4242, 5);

  assert.equal(pieces.length, 3);
  assert.equal(new Set(pieces.map((piece) => piece.id)).size, 3, 'ids should be unique');
  // Colour is what pairs a tray piece with its footprint, so two pieces in one beat must not share.
  assert.equal(new Set(pieces.map((piece) => piece.colorId)).size, 3, 'colours should differ');
  assert.ok(pieces.every((piece) => !piece.used));
  // The generation is in the id, so ids cannot collide across beats.
  assert.ok(pieces.every((piece) => piece.id.startsWith('5:')));
});
