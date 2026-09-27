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

test('the Seed Sprinkler stands on the board: a tap launches a Seed near it, its supply refills on the beat, every third launch sparks a wisp in reach', async () => {
  const { sprinklerCell, SPRINKLER_ID } = { ...(await import('@/features/mission-mechanics/lanes')), SPRINKLER_ID: 'seed-sprinkler' };
  const { settleAction, tapSeed } = await import('@/features/encounter/settle');
  const { createEncounterRun } = await import('@/features/encounter/encounter-run');
  const { reduceMergeWorld } = await import('@/utils/merge-world/engine');
  const { SPRINKLER_CHARGES } = await import('@/constants/island-campaigns/island-levels');
  const encounter = islandLevel('test', 'sprinkler', { ...base, seeds: { every: 1 }, lanes: [{ id: 'near', column: 5, at: 0, hp: 50, step: 1.2 }] }).encounter;
  const host = encounterMechanicHost(encounter);
  const mechanic = resolveMechanic(host) as LanesMechanic;
  const window = encounterWindow(encounter);
  let board = createEncounterState(encounter, 'mossprout', 1);
  const at = sprinklerCell(board, window);
  assert.equal(at, 47, 'on a free bottom corner cell');
  assert.equal(board.board[47]!.occupant?.kind, 'generator');
  assert.equal(board.generators[SPRINKLER_ID]!.charges, SPRINKLER_CHARGES, 'a small supply to tap');
  let lanes = createLanesState(mechanic);
  // Nothing comes on its own (and the wisp comes near).
  for (let t = 0; t < 7_600; t += 100) { const ticked = lanesTick(mechanic, lanes, board, 100, window, undefined, { sparkEvery: 3 }); lanes = ticked.state; board = ticked.board; }
  const sown: { from: number; to: number }[] = [];
  let sparks = 0;
  let run = createEncounterRun(encounter);
  for (let tap = 0; tap < 3; tap += 1) {
    const command = { type: 'tapGenerator' as const, generatorId: SPRINKLER_ID, now: 1, seed: tapSeed(run), spendEnergy: false as const, enforceCharges: true as const };
    const settled = settleAction({ encounter, host, window }, { state: board, run, mechanicState: lanes }, command, reduceMergeWorld(board, command));
    board = settled.state; run = settled.run; lanes = settled.mechanicState as LanesState;
    const landed = settled.spawnedCell!;
    assert.equal(board.board[landed]!.occupant?.kind, 'item', 'the tap’s Seed is on the cell it was sent to (the board flies it there)');
    sown.push({ from: at!, to: landed });
    const ticked = lanesTick(mechanic, lanes, board, 100, window);
    lanes = ticked.state; board = ticked.board; sparks += ticked.sparks.length;
  }
  assert.equal(sown.length, 3, 'one Seed a tap');
  assert.ok(sown.every((seed) => seed.from === 47), 'out of the Sprinkler');
  const near = (cell: number) => { const index = window.cellIndices.indexOf(cell); return Math.max(Math.abs((index % 5) - 4), Math.abs(Math.floor(index / 5) - 4)) <= 2; };
  assert.ok(sown.every((seed) => near(seed.to)), 'to cells within its reach');
  assert.equal(sparks, 1, 'the third launch sparked the wisp that came close');
  assert.equal(board.generators[SPRINKLER_ID]!.charges, SPRINKLER_CHARGES - 3);
  const refilled = lanesTick(mechanic, lanes, board, 1_100, window);
  assert.equal(refilled.board.generators[SPRINKLER_ID]!.charges, SPRINKLER_CHARGES - 2, 'a charge back on the beat');
  // A make-do level: no Sprinkler, no Seeds, and it says so.
  const makeDo = islandLevel('test', 'make-do', { ...base, seeds: { every: 1 }, makeDo: true, lanes: [{ id: 'a', column: 3, at: 0, hp: 4, step: 5 }] });
  assert.equal(makeDo.encounter.spawners.length, 0);
  assert.equal(makeDo.encounter.mechanic?.kind === 'lanes' && makeDo.encounter.mechanic.seeds, undefined);
  assert.match(makeDo.objective, /No Sprinkler here/);
  const { FIRST_BATTLE, LOST_TRAIL_BATTLES } = await import('@/constants/last-clearing-battle');
  for (const first of [FIRST_BATTLE, ...LOST_TRAIL_BATTLES]) assert.ok(first.spawners.length === 0 && first.mechanic?.kind === 'lanes' && !first.mechanic.seeds, `the first session has no Seeds and no Sprinkler (${first.id})`);
});
