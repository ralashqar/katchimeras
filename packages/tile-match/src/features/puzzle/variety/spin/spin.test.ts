/**
 * The spin: a footprint that turns on a clock and refuses its piece while turned.
 *
 * The properties that matter are the ones every timing variety shares — it opens on the wait, it catches up after
 * a stall, the rng advances the same whether or not anything could spin — plus the one that is its own: the cells
 * never change, so the dealer's perfect-beat guarantee is untouched.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SLOT_GRID } from '../../engine/slot-types';
import type { SlotGroup } from '../../engine/slot-types';
import type { Piece } from '../../engine/types';
import { beatHasPerfectSolution, dealBeat } from '../../engine/slot-deal';
import { planBeat } from '../../engine/progression';
import { eligibleGroups, expireVarieties, nextDeadlineMs, varietyDef } from '../registry';
import { varietyData } from '../contract';
import type { DealContext } from '../contract';
import { SPIN_DOUBLE_AT, SPIN_VARIETY, SPIN_WINDOW_MS, spinWindowMs, visibleTurns, type SpinData } from './spin';

const at = (...coordinates: [number, number][]) => coordinates.map(([row, column]) => ({ row, column }));
const SQUARE = at([0, 0], [0, 1], [1, 0], [1, 1]);
const LINE = at([0, 0], [0, 1], [0, 2]);
const ELL = at([0, 0], [1, 0], [2, 0], [2, 1]);

function piece(id: string, cells: Piece['cells'], colorId: Piece['colorId'] = 'nitro'): Piece {
  return { id, shapeId: id, cells, colorId, used: false };
}
function group(id: string, pieceId: string, colorId: Piece['colorId'] = 'nitro'): SlotGroup {
  return { id, zone: 'left', pieceId, colorId, cells: [30, 31], origin: { row: 2, column: 4 }, filled: [] };
}
function ctx(groups: SlotGroup[], tray: Piece[], rngState = 12345): DealContext {
  return { grid: SLOT_GRID, beatIndex: 3, combo: 0, groups, tray, rngState };
}

test('only shapes that look different turned can spin', () => {
  assert.deepEqual(visibleTurns(SQUARE), []);
  assert.deepEqual(visibleTurns(LINE), [1]);
  assert.deepEqual(visibleTurns(ELL), [1, 2, 3]);
});

test('the rng advances identically whether or not anything could spin', () => {
  const spinnable = SPIN_VARIETY.deal(ctx([group('a', 'p')], [piece('p', ELL)]), 0.3);
  const inert = SPIN_VARIETY.deal(ctx([group('a', 'p')], [piece('p', SQUARE)]), 0.3);
  assert.equal(spinnable.rngState, inert.rngState);
  assert.equal(spinnable.data.groupId, 'a');
  assert.equal(inert.data.groupId, null);
  assert.equal(nextDeadlineMs({ index: 0, groups: [], placements: [], status: 'placing', launch: false, voided: false, varieties: [{ id: 'spin', data: inert.data }] }), null);
});

test('a beat with one square and one L always spins the L', () => {
  for (let seed = 1; seed < 40; seed += 1) {
    const dealt = SPIN_VARIETY.deal(ctx([group('sq', 'a'), group('el', 'b', 'turbo')], [piece('a', SQUARE), piece('b', ELL, 'turbo')], seed), 0.3);
    assert.equal(dealt.data.groupId, 'el');
  }
});

test('opens on a turn, then alternates, catching up after a stall', () => {
  const { data } = SPIN_VARIETY.deal(ctx([group('a', 'p')], [piece('p', ELL)]), 0.3);
  assert.equal(data.nextTurnMs, 0, 'the first tick must turn it');
  const first = SPIN_VARIETY.expire!(data, 5);
  assert.equal(first.data.turned, true);
  assert.notEqual(first.data.facing, 0);
  assert.equal(first.data.nextTurnMs, data.windowMs);

  const back = SPIN_VARIETY.expire!(first.data, data.windowMs + 1);
  assert.equal(back.data.turned, false);
  assert.equal(back.data.facing, 0);

  // A long stall lands on the right window rather than one step on.
  const stalled = SPIN_VARIETY.expire!(back.data, data.windowMs * 7 + 10);
  assert.equal(stalled.data.turned, false);
  assert.equal(stalled.data.nextTurnMs, data.windowMs * 8);
  const stalledTurned = SPIN_VARIETY.expire!(back.data, data.windowMs * 6 + 10);
  assert.equal(stalledTurned.data.turned, true);
});

test('below the double threshold one look repeats; above it two alternate', () => {
  const single = SPIN_VARIETY.deal(ctx([group('a', 'p')], [piece('p', ELL)]), SPIN_DOUBLE_AT - 0.1).data;
  assert.equal(single.turns.length, 1);
  const double = SPIN_VARIETY.deal(ctx([group('a', 'p')], [piece('p', ELL)]), SPIN_DOUBLE_AT).data;
  assert.equal(double.turns.length, 2);
  const looks = [0, 2, 4, 6].map((window) => SPIN_VARIETY.expire!(double, window * double.windowMs + 1).data.facing);
  assert.deepEqual(looks, [double.turns[0], double.turns[1], double.turns[0], double.turns[1]]);
});

test('a turned footprint refuses its piece and the other footprint is untouched', () => {
  const groups = [group('a', 'p'), group('b', 'q', 'turbo')];
  const tray = [piece('p', ELL), piece('q', LINE, 'turbo')];
  const dealt = SPIN_VARIETY.deal(ctx(groups, tray), 0.3);
  const turned: SpinData = { ...dealt.data, turned: true, facing: 1 };
  const spinning = groups.find((g) => g.id === turned.groupId)!;
  const other = groups.find((g) => g.id !== turned.groupId)!;
  assert.equal(SPIN_VARIETY.accepts!(turned, { group: spinning, piece: tray[0] }), false);
  assert.equal(SPIN_VARIETY.accepts!(turned, { group: other, piece: tray[1] }), true);
  assert.equal(SPIN_VARIETY.accepts!({ ...turned, turned: false, facing: 0 }, { group: spinning, piece: tray[0] }), true);

  // Through the fold: the turned group drops out of the candidates and comes back when aligned.
  const beat = { index: 0, groups, placements: [], status: 'placing' as const, launch: false, voided: false, varieties: [{ id: 'spin', data: turned }] };
  assert.deepEqual(eligibleGroups(beat, tray[0]).map((g) => g.id), [other.id]);
  const aligned = expireVarieties(beat, turned.windowMs + 1)!;
  assert.equal(eligibleGroups({ ...beat, varieties: aligned.varieties }, tray[0]).length, 2);
});

test('the window squeezes with strength and always outlasts a drag', () => {
  assert.equal(spinWindowMs(0), SPIN_WINDOW_MS);
  assert.ok(spinWindowMs(1) < spinWindowMs(0.5) && spinWindowMs(0.5) < spinWindowMs(0));
  assert.ok(spinWindowMs(1) >= 1500, 'a window must be longer than one drag at pace');
  assert.equal(SPIN_VARIETY.waitMs!({ groupId: 'a', turns: [1], windowMs: 2000, nextTurnMs: 0, turned: false, facing: 0 }), 2000);
});

test('a dealt spin beat keeps its cells and its perfect answer', () => {
  const plan = { ...planBeat({ kind: 'stream', loop: true, turns: [{ slots: 2, varieties: [{ id: 'spin', strength: 0.4 }] }] }, 1, 0), combo: 0 };
  for (let seed = 1; seed < 30; seed += 1) {
    const plain = dealBeat(SLOT_GRID, seed, 1, 1, { ...plan, varieties: [] });
    const spun = dealBeat(SLOT_GRID, seed, 1, 1, plan);
    assert.deepEqual(spun.beat.groups.map((g) => g.cells), plain.beat.groups.map((g) => g.cells));
    assert.ok(beatHasPerfectSolution(SLOT_GRID, spun.beat, spun.tray));
    const data = varietyData<SpinData>(spun.beat, 'spin')!;
    if (data.groupId) assert.ok(spun.beat.groups.some((g) => g.id === data.groupId));
  }
  assert.ok(varietyDef('spin'));
});
