import assert from 'node:assert/strict';
import { mergeBurst } from '@/features/encounter/merge-burst';
import test from 'node:test';
import { crawler, islandLevel, STORM_POT_CHARGES, type IslandLaneSpec, type IslandLevelSpec } from '@/constants/island-campaigns/island-levels';
import { MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import { encounterMechanicHost } from '@/features/encounter/adapt';
import { createEncounterState, encounterWindow } from '@/features/encounter/create-state';
import { createEncounterRun } from '@/features/encounter/encounter-run';
import { settleAction, tapSeed } from '@/features/encounter/settle';
import { createLanesState, laneAlive, laneColumn, laneOf, laneRowOf, lanesTick, laneZap, type LanesMechanic, type LanesState } from '@/features/mission-mechanics/lanes';
import { resolveMechanic } from '@/features/mission-mechanics/mechanic';
import { reduceMergeWorld } from '@/utils/merge-world/engine';
import type { MergeWorldState } from '@/types/merge-world';

// The five-row board: row 0 is cells 15-19, row 1 22-26, row 2 29-33, row 3 36-40, row 4 43-47.
const base: IslandLevelSpec = { title: 'T', objective: 'T.', difficulty: 'calm', pieces: [], mist: [], wisps: [], lanes: [] };
function setup(spec: Partial<IslandLevelSpec>, lanes: IslandLaneSpec[]) {
  const encounter = islandLevel('test', 'spark', { ...base, ...spec, lanes }).encounter;
  const host = encounterMechanicHost(encounter);
  const mechanic = resolveMechanic(host) as LanesMechanic;
  return { encounter, host, mechanic, window: encounterWindow(encounter), board: createEncounterState(encounter, 'mossprout', 1), lanes: createLanesState(mechanic) };
}
function play(mechanic: LanesMechanic, lanes: LanesState, board: MergeWorldState, ms: number, window: ReturnType<typeof encounterWindow>) {
  let state = lanes; let next = board; const zaps: { from: number; wisps: number[] }[] = []; const effects = [];
  for (let t = 0; t < ms; t += 100) {
    const ticked = lanesTick(mechanic, state, next, 100, window);
    state = ticked.state; next = ticked.board; zaps.push(...ticked.zaps); effects.push(...ticked.effects);
  }
  return { state, board: next, zaps, effects };
}
const tierAt = (board: MergeWorldState, cell: number) => { const occupant = board.board[cell]?.occupant; return occupant?.kind === 'item' ? MERGE_ITEMS_BY_ID.get(occupant.definitionId)?.tier ?? 0 : 0; };

test('the Spark chain is its own chain: Spark Seed to Tempest Bloom; a Spark Seed does not zap, and reach grows with the tier', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map((tier) => MERGE_ITEMS_BY_ID.get(`nature:storm:${tier}`)?.name), ['Spark Seed', 'Static Sprout', 'Thunder Bulb', 'Storm Lily', 'Tempest Bloom']);
  assert.equal(MERGE_ITEMS_BY_ID.get('nature:storm:1')?.nextItemId, 'nature:storm:2');
  assert.equal(laneZap(1), null, 'a Spark Seed does not zap');
  assert.deepEqual([2, 3, 4, 5].map((tier) => [laneZap(tier)!.reach, laneZap(tier)!.jumps]), [[1, 0], [1, 1], [2, 2], [2, 2]]);
  assert.ok(laneZap(5)!.stunMs > 0, 'the Tempest Bloom stuns');
});

test('the Storm Pot stands on a free bottom cell beside the Sprinkler: a tap lands a Spark Seed near it, and a charge comes back on its beat', () => {
  const { encounter, host, mechanic, window, board, lanes } = setup({ seeds: { every: 99 }, stormPot: { every: 2 } }, [{ id: 'a', column: 3, at: 60, hp: 5, step: 5 }]);
  const pot = encounter.spawners.find((spawner) => spawner.generatorId === 'storm-pot');
  const sprinkler = encounter.spawners.find((spawner) => spawner.generatorId === 'seed-sprinkler');
  assert.equal(pot?.cell, 43, 'bottom left');
  assert.equal(sprinkler?.cell, 47, 'the Sprinkler bottom right');
  assert.equal(board.generators['storm-pot']!.charges, STORM_POT_CHARGES);
  const run = createEncounterRun(encounter);
  const command = { type: 'tapGenerator' as const, generatorId: 'storm-pot', now: 1, seed: tapSeed(run), spendEnergy: false as const, enforceCharges: true as const };
  const settled = settleAction({ encounter, host, window }, { state: board, run, mechanicState: lanes }, command, reduceMergeWorld(board, command));
  const landed = settled.spawnedCell!;
  const seed = settled.state.board[landed]?.occupant;
  assert.equal(seed?.kind === 'item' && seed.definitionId, 'nature:storm:1', 'a Spark Seed');
  const at = laneOf(window, landed)!;
  assert.ok(Math.max(Math.abs(at.column - 0), Math.abs(at.row - 4)) <= 2, `within the pot's reach (${landed})`);
  const refilled = play(mechanic, settled.mechanicState as LanesState, settled.state, 2_100, window);
  assert.equal(refilled.board.generators['storm-pot']!.charges, STORM_POT_CHARGES, 'a charge back after its beat');
});

test('a Spark plant zaps the nearest wisp beside it in any direction, not one high in the sky; a Thunder Bulb’s zap jumps on to a second', () => {
  // A Static Sprout on 38 (column 2, row 3); a crawler that never moves on 30 (column 1, row 2): diagonal, one cell away.
  const beside = setup({}, [crawler('c', 30, 0, 50, 999)], );
  const withSprout = { ...beside.board, board: beside.board.board.map((cell, index) => (index === 38 ? { ...cell, occupant: { kind: 'item' as const, instanceId: 'spark', definitionId: 'nature:storm:2' } } : cell)) };
  const zapped = play(beside.mechanic, beside.lanes, withSprout, 4_000, beside.window);
  assert.ok(zapped.zaps.some((zap) => zap.from === 38 && zap.wisps[0] === 0), 'it zaps the crawler beside it');
  assert.ok(zapped.state.wisps[0]!.damage > 0, 'and hurts it');
  const high = setup({}, [{ id: 'sky', column: 3, at: 0, hp: 50, step: 999 }]);
  const plain = { ...high.board, board: high.board.board.map((cell, index) => (index === 38 ? { ...cell, occupant: { kind: 'item' as const, instanceId: 'spark', definitionId: 'nature:storm:2' } } : cell)) };
  assert.equal(play(high.mechanic, high.lanes, plain, 4_000, high.window).zaps.length, 0, 'a wisp high over the board is out of its reach');
  // A Thunder Bulb on 38; crawlers on 31 (beside it) and 24 (beside that one, two away from the bulb).
  const pair = setup({}, [crawler('near', 31, 0, 50, 999), crawler('far', 24, 0, 50, 999)]);
  const bulb = { ...pair.board, board: pair.board.board.map((cell, index) => (index === 38 ? { ...cell, occupant: { kind: 'item' as const, instanceId: 'bulb', definitionId: 'nature:storm:3' } } : cell)) };
  const jumped = play(pair.mechanic, pair.lanes, bulb, 4_000, pair.window);
  assert.ok(jumped.zaps.some((zap) => zap.wisps.length === 2 && zap.wisps.includes(0) && zap.wisps.includes(1)), 'the zap jumps from one to the other');
});

test('a crawler climbs out of the Mist on its cell, creeps to the nearest plant and knocks it down a tier; with none, it walks off the bottom and gets through', () => {
  // A Sprout on 45 (column 2, row 4); the crawler climbs out on 17 (column 2, row 0), a step every second.
  const { mechanic, window, board, lanes } = setup({ pieces: [[45, 2]] }, [crawler('c', 17, 0, 50, 1)]);
  const out = play(mechanic, lanes, board, 300, window);
  assert.deepEqual([laneColumn(mechanic, out.state, 0), laneRowOf(out.state.wisps[0]!.row)], [2, 0], 'out of the Mist on its cell');
  // The Sprout shoots up its column at it, so give it room to arrive: hp 50.
  const walked = play(mechanic, out.state, out.board, 3_200, window);
  assert.equal(laneRowOf(walked.state.wisps[0]!.row), 3, 'it creeps down to the plant');
  const struck = play(mechanic, walked.state, walked.board, 1_100, window);
  assert.equal(tierAt(struck.board, 45), 1, 'the Sprout is knocked down to a Seed');
  assert.ok(struck.state.wisps[0]!.damage > 0, 'the plant under it shot it on the way');
  const alone = setup({}, [crawler('c', 17, 0, 50, 1)]);
  const through = play(alone.mechanic, alone.lanes, alone.board, 7_000, alone.window);
  assert.equal(through.state.breached, 0, 'with no plant to reach, it walks off the bottom row');
  assert.equal(laneAlive(alone.mechanic, through.state, 0), true);
});

for (const modern of [false, true]) test(`lightning merge immediately fires one visible, ranged zap (v2=${modern})`, () => {
  // A wisp BELOW the plant is still in its lightning reach.
  const { mechanic: legacy, window, board, lanes } = setup({}, [crawler('near', 38, 0, 50, 999), crawler('far', 17, 0, 50, 999)]);
  const mechanic = modern ? { ...legacy, rulesVersion: 2 as const } : legacy;
  const state = modern ? createLanesState(mechanic) : lanes;
  const merged = { ...board, board: board.board.map((cell, index) => index === 31 ? { ...cell, occupant: { kind: 'item' as const, instanceId: 'merged-spark', definitionId: 'nature:storm:2' } } : cell) };
  const queued = mergeBurst(mechanic, state, merged, window, 31);
  assert.equal(queued.shots.length, 0, 'no invisible extra burst');
  const first = lanesTick(mechanic, queued, merged, 1, window);
  assert.deepEqual(first.zaps.map(zap => zap.wisps), [[0]], 'fires on first tick, toward nearby wisp only');
  const landed = lanesTick(mechanic, first.state, first.board, 200, window);
  assert.equal(landed.zaps.length, 0, 'merge does not fire twice');
  assert.equal(landed.state.wisps[0]!.damage, laneZap(2)!.damage);
  assert.equal(landed.state.wisps[1]!.damage, 0);

  const distant = { ...merged, board: merged.board.map((cell, index) => index === 31 ? { ...cell, occupant: null } : index === 43 ? { ...cell, occupant: { kind: 'item' as const, instanceId: 'distant-spark', definitionId: 'nature:storm:2' } } : cell) };
  const waiting = lanesTick(mechanic, mergeBurst(mechanic, state, distant, window, 43), distant, 1, window);
  assert.equal(waiting.zaps.length, 0, 'no strike beyond tier reach');
});
