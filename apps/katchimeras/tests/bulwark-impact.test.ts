import assert from 'node:assert/strict';
import test from 'node:test';
import { combatLessonMission } from '@/constants/combat-campaign';
import { createEncounterState, encounterWindow } from '@/features/encounter/create-state';
import { encounterMechanicHost } from '@/features/encounter/adapt';
import { createEncounterRun } from '@/features/encounter/encounter-run';
import { settleAction } from '@/features/encounter/settle';
import { reduceMergeWorld } from '@/utils/merge-world/engine';
import { bulwarkBlast } from '@/features/mission-mechanics/combat-rules';
import { createLanesState, lanesTick, normalizeLanesState, type LanesMechanic } from '@/features/mission-mechanics/lanes';

function setup(tier = 2, hp = 100) {
  const encounter = combatLessonMission(3).encounter;
  const window = encounterWindow(encounter);
  const board = createEncounterState(encounter, 'mossprout', 1);
  board.board = board.board.map(cell => ({ ...cell, occupant: null, mist: null, locked: false }));
  board.board[31] = { ...board.board[31]!, occupant: { kind: 'item', instanceId: 'wall', definitionId: `nature:bulwark:${tier}` } };
  const mechanic: LanesMechanic = { kind: 'lanes', rulesVersion: 2, wisps: [{ id: 'enemy', column: 2, hp, at: 0, stepMs: 1000 }] };
  const state = createLanesState(mechanic);
  state.wisps[0]!.row = 1.45;
  return { mechanic, state, board, window };
}

test('extended proximity charges, survives save/load, then sacrifices exactly once', () => {
  const { mechanic, state, board, window } = setup();
  state.wisps[0]!.row = 1;
  const armed = lanesTick(mechanic, state, board, 100, window);
  assert.equal(armed.state.wisps[0]!.damage, 0);
  assert.ok(armed.effects.some(e => e.kind === 'wall-impact' && e.charge));
  assert.ok(armed.board.board[31]!.occupant);
  const saved = normalizeLanesState(mechanic, JSON.parse(JSON.stringify(armed.state)), 0)!;
  assert.deepEqual(saved.combat!.plants.wall!.charge, armed.state.combat!.plants.wall!.charge);
  const early = lanesTick(mechanic, saved, armed.board, 500, window);
  assert.ok(early.board.board[31]!.occupant);
  const boom = lanesTick(mechanic, early.state, early.board, 220, window);
  assert.equal(boom.board.board[31]!.occupant, null);
  assert.ok(boom.state.wisps[0]!.damage > 0);
  assert.ok(armed.state.wisps[0]!.row - boom.state.wisps[0]!.row >= 1.75, 'survivor is pushed back nearly two cells');
  assert.ok(boom.effects.some(e => e.kind === 'wall-impact' && !e.charge));
  const again = lanesTick(mechanic, boom.state, boom.board, 100, window);
  assert.equal(again.state.wisps[0]!.damage, boom.state.wisps[0]!.damage);
  assert.equal(again.effects.filter(e => e.kind === 'wall-impact').length, 0);
});

test('proximity is circular; outside the trigger range does not arm, frozen walls cannot arm', () => {
  const { mechanic, state, board, window } = setup();
  mechanic.wisps[0]!.column = 3;
  state.wisps[0]!.row = 0.5;
  assert.equal(lanesTick(mechanic, state, board, 1, window).effects.filter(e => e.kind === 'wall-impact').length, 0);
  state.wisps[0]!.row = 2;
  assert.ok(lanesTick(mechanic, state, board, 1, window).effects.some(e => e.kind === 'wall-impact' && e.charge));
  assert.equal(lanesTick(mechanic, { ...state, frozen: { wall: 1000 } }, board, 1, window).effects.filter(e => e.kind === 'wall-impact').length, 0);
});

test('higher tiers increase both explosion damage and radius', () => {
  let previous = 0;
  for (let tier = 2; tier <= 5; tier++) {
    const { mechanic, state, board, window } = setup(tier, 1000);
    const armed = lanesTick(mechanic, state, board, 100, window);
    const boom = lanesTick(mechanic, armed.state, armed.board, 800, window);
    assert.ok(boom.state.wisps[0]!.damage > previous);
    previous = boom.state.wisps[0]!.damage;
    if (tier > 2) assert.ok(bulwarkBlast(tier).radius > bulwarkBlast(tier - 1).radius);
  }
});

test('a charging wall interrupts a dash and lethal blasts still spawn splitter children', () => {
  const { mechanic, state, board, window } = setup(5, 1);
  mechanic.wisps = [...mechanic.wisps, { id: 'child', column: 2, hp: 3, at: 0, stepMs: 1000, spawn: { by: 0, on: 'death' } }];
  const incoming = createLanesState(mechanic);
  incoming.wisps[0] = { ...incoming.wisps[0]!, row: state.wisps[0]!.row, dashFrom: 0, dashUntil: 450 };
  const armed = lanesTick(mechanic, incoming, board, 100, window);
  assert.equal(armed.state.wisps[0]!.dashUntil, undefined);
  const boom = lanesTick(mechanic, armed.state, armed.board, 800, window);
  assert.equal(boom.state.wisps[0]!.damage, 1);
  assert.equal(boom.state.wisps[0]!.row, armed.state.wisps[0]!.row, 'dead wisps are not displaced');
  assert.equal(boom.state.wisps[1]!.bornAt, boom.state.clock);
});

test('tier-one seeds are inert even with a wisp on their cell', () => {
  const { mechanic, state, board, window } = setup(1);
  state.wisps[0]!.row = 2;
  const tick = lanesTick(mechanic, state, board, 100, window);
  assert.equal(tick.effects.some(e => e.kind === 'wall-impact'), false);
  assert.equal(tick.state.combat?.plants.wall?.charge, undefined);
  assert.equal(tick.state.wisps[0]!.damage, 0);
});

test('lunge advances one cell, hits every nearby wisp, and consumes with a newer board revision', () => {
  const { mechanic, board, window } = setup(3, 100);
  mechanic.wisps = [mechanic.wisps[0]!, { ...mechanic.wisps[0]!, id: 'neighbour', column: 3 }];
  const incoming = createLanesState(mechanic);
  incoming.wisps.forEach(w => { w.row = 0.5; });
  const armed = lanesTick(mechanic, incoming, board, 100, window);
  const charge = armed.state.combat!.plants.wall!.charge!;
  assert.equal(charge.toRow, 1, 'shield at row two lunges one cell toward the enemy');
  const boom = lanesTick(mechanic, armed.state, armed.board, 800, window);
  const impact = boom.effects.find(e => e.kind === 'wall-impact' && e.consumed);
  assert.ok(impact && impact.kind === 'wall-impact');
  assert.deepEqual(impact.hitWisps, [0, 1], 'each damaged wisp gets the standard hit particles');
  assert.equal(boom.board.board[31]!.occupant, null);
  assert.ok(boom.board.revision > armed.board.revision, 'stale board animations cannot restore the consumed sprite');
});


test('an armed shield cannot be dragged or merged before it detonates', () => {
  const { mechanic, state, board, window } = setup();
  const encounter = { ...combatLessonMission(3).encounter, mechanic };
  const armed = lanesTick(mechanic, state, board, 100, window);
  const before = { state: armed.board, mechanicState: armed.state, run: createEncounterRun(encounter) };
  const binding = { encounter, window, host: encounterMechanicHost(encounter) };
  for (const [from, to] of [[31, 32], [32, 31]]) {
    armed.board.board[32] = { ...armed.board.board[32]!, occupant: { kind: 'item', instanceId: 'twin', definitionId: 'nature:bulwark:2' } };
    const command = { type: 'move' as const, from: from!, to: to!, now: 1 };
    const result = settleAction(binding, before, command, reduceMergeWorld(armed.board, command));
    assert.equal(result.state, armed.board);
    assert.equal(result.mechanicState, armed.state);
    assert.equal(result.effects.length, 0);
  }
});
