import assert from 'node:assert/strict';
import test from 'node:test';
import { islandLevel, laneWisps, type IslandLaneSpec, type IslandLevelSpec } from '@/constants/island-campaigns/island-levels';
import { createEncounterState, encounterWindow } from '@/features/encounter/create-state';
import { encounterMechanicHost } from '@/features/encounter/adapt';
import { createLanesState, laneAlive, laneArrived, laneColumn, lanesComplete, lanesTick, type LanesMechanic, type LanesState } from '@/features/mission-mechanics/lanes';
import { resolveMechanic } from '@/features/mission-mechanics/mechanic';
import type { MergeWorldState } from '@/types/merge-world';

const base: IslandLevelSpec = { title: 'T', objective: 'T.', difficulty: 'calm', pieces: [], mist: [], seeds: { every: 999 }, wisps: [], lanes: [] };
function setup(lanes: IslandLaneSpec[], pieces: IslandLevelSpec['pieces'] = []) {
  const encounter = islandLevel('test', 'variety', { ...base, pieces, lanes }).encounter;
  const mechanic = resolveMechanic(encounterMechanicHost(encounter)) as LanesMechanic;
  return { mechanic, window: encounterWindow(encounter), board: createEncounterState(encounter, 'mossprout', 1), lanes: createLanesState(mechanic) };
}
function run(mechanic: LanesMechanic, lanes: LanesState, board: MergeWorldState, ms: number, window: ReturnType<typeof encounterWindow>) {
  let state = lanes; let next = board; const effects = [];
  for (let t = 0; t < ms; t += 100) { const ticked = lanesTick(mechanic, state, next, 100, window); state = ticked.state; next = ticked.board; effects.push(...ticked.effects); }
  return { state, board: next, effects };
}

test('a weaver slides between its column and the ones beside it once it is near the board', () => {
  const { mechanic, window, board, lanes } = setup([{ id: 'w', column: 3, at: 0, hp: 50, step: 2, weave: 1.5 }]);
  const seen = new Set<number>();
  let state = lanes; let next = board;
  for (let t = 0; t < 12_000; t += 100) { const ticked = lanesTick(mechanic, state, next, 100, window); state = ticked.state; next = ticked.board; seen.add(laneColumn(mechanic, state, 0)); }
  assert.deepEqual([...seen].sort(), [1, 2, 3], 'it weaves across three columns');
});

test('a dasher lunges: it covers more rows than its pace alone would', () => {
  const plain = setup([{ id: 'd', column: 3, at: 0, hp: 50, step: 3 }]);
  const dasher = setup([{ id: 'd', column: 3, at: 0, hp: 50, step: 3, dash: { every: 2, rows: 2 } }]);
  const a = run(plain.mechanic, plain.lanes, plain.board, 12_000, plain.window).state.wisps[0]!.row;
  const b = run(dasher.mechanic, dasher.lanes, dasher.board, 12_000, dasher.window).state.wisps[0]!.row;
  assert.ok(b > a + 1, `the dasher is further down (${b.toFixed(2)} vs ${a.toFixed(2)})`);
});

test('a bulwark shields the wisps beside it; bring it down first', () => {
  const { mechanic, window, board, lanes } = setup([{ id: 'guarded', column: 3, at: 0, hp: 6, step: 30 }, { id: 'bulwark', column: 4, at: 0, hp: 60, step: 30, shield: true }], [[38, 3], [39, 3]]);
  const shielded = run(mechanic, lanes, board, 8_000, window);
  assert.equal(shielded.state.wisps[0]!.damage, 0, 'nothing gets through the shield');
  assert.ok(shielded.effects.some((effect) => effect.kind === 'shielded'));
  assert.ok(shielded.state.wisps[1]!.damage > 0, 'the bulwark itself can be hit');
});

test('a mender mends the wisps within a column of it', () => {
  const { mechanic, window, board, lanes } = setup([{ id: 'hurt', column: 2, at: 0, hp: 20, step: 30 }, { id: 'mender', column: 3, at: 0, hp: 20, step: 30, mend: { every: 1, amount: 2 } }]);
  const hurt = { ...lanes, wisps: lanes.wisps.map((wisp, index) => (index === 0 ? { ...wisp, damage: 10 } : wisp)) };
  const after = run(mechanic, hurt, board, 3_500, window);
  assert.ok(after.state.wisps[0]!.damage < 10, 'healed');
});

test('a frost wisp freezes the plant under it, which holds its fire until it thaws', () => {
  const { mechanic, window, board, lanes } = setup([{ id: 'frost', column: 3, at: 0, hp: 50, step: 30, frost: 1 }], [[38, 2]]);
  const after = run(mechanic, lanes, board, 1_600, window);
  assert.ok(after.effects.some((effect) => effect.kind === 'frozen'));
  assert.ok(Object.values(after.state.frozen ?? {}).some((until) => until > after.state.clock), 'the plant is frozen');
});

test('a snatcher takes the smallest piece under it', () => {
  const { mechanic, window, board, lanes } = setup([{ id: 'snatch', column: 3, at: 0, hp: 50, step: 30, snatch: 1 }], [[38, 3], [45, 1]]);
  const after = run(mechanic, lanes, board, 1_600, window);
  assert.ok(after.effects.some((effect) => effect.kind === 'snatched'));
  assert.equal(after.board.board[45]!.occupant, null, 'the Seed is gone');
  assert.equal(after.board.board[38]!.occupant?.kind, 'item', 'the bigger plant stays');
});

test('a splitter bursts into shards beside it when it falls, and the level waits for them', () => {
  const lanes: IslandLaneSpec[] = [{ id: 'split', column: 3, at: 0, hp: 3, step: 30, splits: 2 }];
  assert.equal(laneWisps(lanes).length, 3, 'two shards are made');
  const { mechanic, window, board, lanes: state } = setup(lanes);
  const felled = { ...state, wisps: state.wisps.map((wisp, index) => (index === 0 ? { ...wisp, damage: 3 } : wisp)) };
  const after = run(mechanic, felled, board, 200, window);
  assert.ok(laneArrived(mechanic, after.state, 1) && laneArrived(mechanic, after.state, 2), 'the shards come');
  assert.deepEqual([laneColumn(mechanic, after.state, 1), laneColumn(mechanic, after.state, 2)].sort(), [1, 3]);
  assert.equal(lanesComplete(mechanic, after.state), false, 'not over until they fall too');
});

test('a caller calls its mistlings down one at a time; those never called fade when it falls', () => {
  const { mechanic, window, board, lanes } = setup([{ id: 'caller', column: 3, at: 0, hp: 30, step: 30, calls: { every: 2, count: 3 } }]);
  const after = run(mechanic, lanes, board, 4_500, window);
  assert.equal([1, 2, 3].filter((index) => laneArrived(mechanic, after.state, index)).length, 2, 'two called so far');
  const felled = { ...after.state, wisps: after.state.wisps.map((wisp, index) => (index === 0 ? { ...wisp, damage: 30 } : wisp)) };
  const later = run(mechanic, felled, after.board, 200, window);
  assert.equal(laneAlive(mechanic, later.state, 3), false, 'the third never comes');
});
