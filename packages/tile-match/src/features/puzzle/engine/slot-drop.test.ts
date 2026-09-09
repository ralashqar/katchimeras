/**
 * The per-group resolve: a drop is graded against where each footprint **is**, not where the layout put it.
 *
 * Three claims, and each is a bug that would otherwise be invisible in a diff: with nothing moving the new
 * resolve is the old one exactly; a piece released over a footprint's moved position lands on its origin; and
 * a piece released over the footprint's *rest* position, once it has moved away, misses.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SLOT_GRID } from './slot-types';
import type { SlotGroup } from './slot-types';
import {
  BOUNDS_STRIDE,
  MOTION_STRIDE,
  NO_CELL,
  NO_GROUP,
  SLOT_CAPTURE_MARGIN,
  dropFootprintFor,
  groupBoundsOf,
  packDropTarget,
  resolveDropAmongGroups,
  resolveDropCell,
  unpackDropCell,
  unpackDropGroup,
  type DropFrame,
} from './slot-drop';

const PITCH = 36;
const frame: DropFrame = {
  anchorX: 100,
  anchorY: 200,
  pitch: PITCH,
  rows: SLOT_GRID.rows,
  cols: SLOT_GRID.cols,
  captureMargin: SLOT_CAPTURE_MARGIN,
};

const square = [
  { row: 0, column: 0 },
  { row: 0, column: 1 },
  { row: 1, column: 0 },
  { row: 1, column: 1 },
];
const footprint = dropFootprintFor(SLOT_GRID, square);

/** A 2x2 footprint at an origin, as the dealer would build it. */
function groupAt(id: string, row: number, column: number, zone: SlotGroup['zone']): SlotGroup {
  return {
    id,
    zone,
    pieceId: `${id}:piece`,
    colorId: 'nitro',
    cells: square.map((cell) => (row + cell.row) * SLOT_GRID.cols + column + cell.column),
    origin: { row, column },
    filled: [],
  };
}

/** Screen centre of a 2x2 piece whose origin sits at a cell, before any motion. */
function centreOf(row: number, column: number) {
  return {
    x: frame.anchorX + (column + 0.5) * PITCH,
    y: frame.anchorY + (row + 0.5) * PITCH,
  };
}

const left = groupAt('a', 3, 2, 'left');
const right = groupAt('b', 2, 9, 'right');
const groups = [left, right];
const bounds = groupBoundsOf(SLOT_GRID, groups);

test('bounds are one quad per group, from its cells', () => {
  assert.equal(bounds.length, groups.length * BOUNDS_STRIDE);
  assert.deepEqual(bounds.slice(0, 4), [3, 2, 4, 3]);
  assert.deepEqual(bounds.slice(4, 8), [2, 9, 3, 10]);
});

test('packing survives the no-answer sentinels', () => {
  assert.equal(unpackDropCell(packDropTarget(NO_GROUP, NO_CELL)), NO_CELL);
  assert.equal(unpackDropGroup(packDropTarget(NO_GROUP, NO_CELL)), NO_GROUP);
  assert.equal(unpackDropCell(packDropTarget(1, 57)), 57);
  assert.equal(unpackDropGroup(packDropTarget(1, 57)), 1);
});

test('with nothing moving, the group resolve is the plain resolve exactly', () => {
  const still = new Array(groups.length * MOTION_STRIDE).fill(0);
  for (let row = -1; row <= SLOT_GRID.rows; row += 0.5) {
    for (let column = -1; column <= SLOT_GRID.cols; column += 0.5) {
      const { x, y } = centreOf(row, column);
      const packed = resolveDropAmongGroups(frame, footprint, x, y, still, bounds);
      assert.equal(
        unpackDropCell(packed),
        resolveDropCell(frame, footprint, x, y),
        `row ${row} column ${column} diverged from the plain resolve`,
      );
    }
  }
});

test('a piece released over a moved footprint lands on its origin', () => {
  // The right footprint has risen a full pitch and swayed half a pitch inward (left, toward the centre).
  const motion = [0, 0, 0, -0.5 * PITCH, -PITCH, 0.1];
  const rest = centreOf(right.origin.row, right.origin.column);
  const moved = { x: rest.x - 0.5 * PITCH, y: rest.y - PITCH };

  const packed = resolveDropAmongGroups(frame, footprint, moved.x, moved.y, motion, bounds);
  assert.equal(unpackDropGroup(packed), 1);
  assert.equal(unpackDropCell(packed), right.origin.row * SLOT_GRID.cols + right.origin.column);
});

test('a piece released where a moved footprint used to be misses it', () => {
  const motion = [0, 0, 0, 0, -1.5 * PITCH, 0];
  const rest = centreOf(right.origin.row, right.origin.column);

  const packed = resolveDropAmongGroups(frame, footprint, rest.x, rest.y, motion, bounds);
  // Nothing claimed it, so it falls back to the un-moved resolve: the rest cell, which the footprint has left.
  assert.equal(unpackDropGroup(packed), NO_GROUP);
  assert.equal(unpackDropCell(packed), resolveDropCell(frame, footprint, rest.x, rest.y));
});

test('the still footprint is unaffected by its neighbour moving', () => {
  const motion = [0, 0, 0, 0, -1.5 * PITCH, 0];
  const rest = centreOf(left.origin.row, left.origin.column);
  const packed = resolveDropAmongGroups(frame, footprint, rest.x, rest.y, motion, bounds);
  assert.equal(unpackDropGroup(packed), 0);
  assert.equal(unpackDropCell(packed), left.origin.row * SLOT_GRID.cols + left.origin.column);
});

test('a drop clear of the field is still no cell at all', () => {
  const motion = [0, -PITCH, 0, 0, -PITCH, 0];
  const packed = resolveDropAmongGroups(frame, footprint, -500, -500, motion, bounds);
  assert.equal(unpackDropCell(packed), NO_CELL);
  assert.equal(unpackDropGroup(packed), NO_GROUP);
});
