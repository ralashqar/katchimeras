/**
 * Living targets: the room each footprint gets, and the shape of its motion.
 *
 * The bound that matters most is the last test: the gentlest drifting beat has to move every flank footprint
 * past half a cell, or a player who aims once still lands exact and the mechanic is decoration — which is what
 * the whole-field drift had become on the battle screen.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SLOT_ZONES } from '../engine/slot-deal';
import { MOTION_STRIDE } from '../engine/slot-drop';
import { SLOT_GRID } from '../engine/slot-types';
import type { SlotGroup } from '../engine/slot-types';
import { DRIFT_FLOOR, SLOT_DRIFT_SMOOTH_AMPLITUDE } from '../variety/drift/drift-metrics';
import {
  GROUP_PHASE_STEP,
  ROOM_STRIDE,
  SLOT_MOTION_CELLS,
  SLOT_SWAY_CELLS,
  SLOT_TILT_RADIANS,
  groupMotionAt,
  motionRoomFor,
  motionRoomsFor,
} from './group-motion';

const PITCH = 36;

function rect(id: string, zone: SlotGroup['zone'], row: number, column: number, height: number, width: number): SlotGroup {
  const cells: number[] = [];
  for (let r = 0; r < height; r += 1) for (let c = 0; c < width; c += 1) cells.push((row + r) * SLOT_GRID.cols + column + c);
  return { id, zone, pieceId: `${id}:p`, colorId: 'nitro', cells, origin: { row, column }, filled: [] };
}

const leftZone = SLOT_ZONES.find((z) => z.id === 'left')!;
const rightZone = SLOT_ZONES.find((z) => z.id === 'right')!;

test('a shape at the top of its zone bobs down, one at the bottom bobs up', () => {
  const atTop = rect('t', 'left', leftZone.rowFrom, leftZone.columnFrom, 2, 2);
  const atBottom = rect('b', 'left', leftZone.rowTo - 1, leftZone.columnFrom, 2, 2);
  const [downRoom] = motionRoomFor(SLOT_GRID, atTop, PITCH);
  const [upRoom] = motionRoomFor(SLOT_GRID, atBottom, PITCH);
  assert.ok(downRoom > 0, 'top of zone should have room below');
  assert.ok(upRoom < 0, 'bottom of zone should have room above');
  assert.equal(Math.abs(downRoom), Math.abs(upRoom));
});

test('room is the zone slack, capped, plus the layout clearance above', () => {
  const tall = rect('t', 'left', leftZone.rowFrom + 1, leftZone.columnFrom, 3, 2);
  // One row of slack above, none below.
  assert.deepEqual(motionRoomFor(SLOT_GRID, tall, PITCH)[0], -PITCH);
  assert.deepEqual(motionRoomFor(SLOT_GRID, tall, PITCH, 18)[0], -(PITCH + 18));
  // A domino in a four-row zone has three rows of slack, which the cap trims.
  const small = rect('s', 'left', leftZone.rowFrom, leftZone.columnFrom, 1, 2);
  assert.equal(motionRoomFor(SLOT_GRID, small, PITCH)[0], SLOT_MOTION_CELLS * PITCH);
});

test('every flank shape gets at least a pitch of vertical room', () => {
  for (const zone of [leftZone, rightZone]) {
    for (let height = 1; height <= zone.maxHeight; height += 1) {
      for (let row = zone.rowFrom; row + height - 1 <= zone.rowTo; row += 1) {
        const [vertical] = motionRoomFor(SLOT_GRID, rect('g', zone.id, row, zone.columnFrom, height, 1), PITCH);
        assert.ok(Math.abs(vertical) >= PITCH, `${zone.id} ${height}-tall at row ${row} has ${vertical}pt of room`);
      }
    }
  }
});

test('flanks sway inward, the centre zone not at all', () => {
  const left = rect('l', 'left', leftZone.rowFrom, leftZone.columnFrom, 2, 2);
  const right = rect('r', 'right', rightZone.rowFrom, rightZone.columnFrom, 2, 2);
  const centre = rect('c', 'below', 4, 5, 2, 3);
  assert.equal(motionRoomFor(SLOT_GRID, left, PITCH)[1], SLOT_SWAY_CELLS * PITCH);
  assert.equal(motionRoomFor(SLOT_GRID, right, PITCH)[1], -SLOT_SWAY_CELLS * PITCH);
  assert.equal(motionRoomFor(SLOT_GRID, centre, PITCH)[1], 0);
  assert.equal(motionRoomsFor(SLOT_GRID, [left, right], PITCH).length, 2 * ROOM_STRIDE);
});

const rooms = motionRoomsFor(
  SLOT_GRID,
  [rect('l', 'left', leftZone.rowFrom, leftZone.columnFrom, 2, 2), rect('r', 'right', rightZone.rowTo - 1, rightZone.columnFrom, 2, 2)],
  PITCH,
);

test('zero strength is exactly rest for every footprint', () => {
  const still = groupMotionAt(0.37, 0, rooms);
  assert.equal(still.length, 2 * MOTION_STRIDE);
  assert.ok(still.every((value) => value === 0));
});

test('the two footprints of a double never move in unison', () => {
  let apart = 0;
  for (let phase = 0; phase < 1; phase += 0.05) {
    const motion = groupMotionAt(phase, 1, rooms);
    const a = Math.abs(motion[1]);
    const b = Math.abs(motion[MOTION_STRIDE + 1]);
    if (Math.abs(a - b) > 1) apart += 1;
  }
  assert.ok(apart > 15, 'the second footprint should run half a cycle behind');
  assert.equal(GROUP_PHASE_STEP, 0.5);
});

test('the gentlest drifting beat is vertical only and clears half a cell', () => {
  let peak = 0;
  for (let phase = 0; phase <= 1; phase += 0.01) {
    const motion = groupMotionAt(phase, DRIFT_FLOOR, rooms);
    assert.equal(motion[0], 0, 'no sway at the floor');
    assert.equal(motion[2], 0, 'no tilt at the floor');
    peak = Math.max(peak, Math.abs(motion[1]));
  }
  assert.ok(peak > 0.5 * PITCH, `the floor beat only travels ${(peak / PITCH).toFixed(2)} pitches`);
  assert.ok(Math.abs(peak - SLOT_DRIFT_SMOOTH_AMPLITUDE * SLOT_MOTION_CELLS * PITCH) < 1e-6);
});

test('the worst beat sways and tilts inside its room', () => {
  let sway = 0;
  let tilt = 0;
  for (let phase = 0; phase <= 1; phase += 0.01) {
    const motion = groupMotionAt(phase, 1, rooms);
    sway = Math.max(sway, Math.abs(motion[0]));
    tilt = Math.max(tilt, Math.abs(motion[2]));
    assert.ok(Math.abs(motion[0]) <= SLOT_SWAY_CELLS * PITCH + 1e-9);
    assert.ok(Math.abs(motion[1]) <= SLOT_MOTION_CELLS * PITCH + 1e-9);
    assert.ok(Math.abs(motion[2]) <= SLOT_TILT_RADIANS + 1e-9);
  }
  assert.ok(sway > 0.4 * PITCH, 'the hardest beat should use its sway room');
  assert.ok(tilt > SLOT_TILT_RADIANS * 0.9, 'the hardest beat should reach the full tilt');
  // And a caller that already turns the footprint can switch the tilt off.
  assert.ok(groupMotionAt(0.25, 1, rooms, false).every((_, i) => i % MOTION_STRIDE !== 2 || _ === 0));
});

test('room below flips the bob so a footprint never leaves its zone', () => {
  for (let phase = 0; phase <= 1; phase += 0.01) {
    const motion = groupMotionAt(phase, 1, rooms);
    assert.ok(motion[1] >= -1e-9, 'the top-of-zone footprint should only move down');
    assert.ok(motion[MOTION_STRIDE + 1] <= 1e-9, 'the bottom-of-zone footprint should only move up');
  }
});
