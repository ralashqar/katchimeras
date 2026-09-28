import assert from 'node:assert/strict';
import test from 'node:test';
import { combatLessonMission } from '@/constants/combat-campaign';
import { createEncounterState, encounterWindow } from '@/features/encounter/create-state';
import { bulwarkImpact } from '@/features/mission-mechanics/combat-rules';
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

test('contact explodes once, damages, pushes upward, and preserves the wall', () => {
  const { mechanic, state, board, window } = setup();
  const hit = lanesTick(mechanic, state, board, 100, window);
  assert.equal(hit.state.wisps[0]!.damage, bulwarkImpact(2).damage);
  assert.ok(hit.state.wisps[0]!.row < state.wisps[0]!.row);
  assert.ok(hit.state.wisps[0]!.holdUntil > hit.state.clock);
  assert.equal(hit.effects.filter(e => e.kind === 'wall-impact').length, 1);
  assert.deepEqual(hit.board.board[31], board.board[31]);
  assert.equal(hit.state.strikes, 1);
  const again = lanesTick(mechanic, hit.state, hit.board, 100, window);
  assert.equal(again.effects.filter(e => e.kind === 'wall-impact').length, 0);
  assert.equal(again.state.wisps[0]!.damage, hit.state.wisps[0]!.damage);
  assert.equal(normalizeLanesState(mechanic, JSON.parse(JSON.stringify(hit.state)), 0)!.combat!.plants.wall!.interceptAt,
    hit.state.combat!.plants.wall!.interceptAt, 'recharge survives save/load');
  const rearmed = { ...hit.state, clock: hit.state.combat!.plants.wall!.interceptAt, wisps: [{ ...hit.state.wisps[0]!, row: 1.45 }] };
  assert.equal(lanesTick(mechanic, rearmed, hit.board, 100, window).effects.filter(e => e.kind === 'wall-impact').length, 1);
});

test('higher tiers deal more damage and knock back farther with a shorter recharge', () => {
  let damage = 0, row = Infinity, recharge = Infinity;
  for (let tier = 1; tier <= 5; tier++) {
    const { mechanic, state, board, window } = setup(tier);
    const hit = lanesTick(mechanic, state, board, 100, window);
    assert.ok(hit.state.wisps[0]!.damage > damage);
    assert.ok(hit.state.wisps[0]!.row < row);
    assert.ok(hit.state.combat!.plants.wall!.interceptAt < recharge);
    damage = hit.state.wisps[0]!.damage; row = hit.state.wisps[0]!.row; recharge = hit.state.combat!.plants.wall!.interceptAt;
  }
});

test('lethal impact does not push a dead wisp and triggers splitter children', () => {
  const { mechanic, state, board, window } = setup(5, 1);
  mechanic.wisps = [...mechanic.wisps, { id: 'child', column: 2, hp: 3, at: 0, stepMs: 1000, spawn: { by: 0, on: 'death' } }];
  const incoming = createLanesState(mechanic);
  incoming.wisps[0]!.row = state.wisps[0]!.row;
  const hit = lanesTick(mechanic, incoming, board, 100, window);
  assert.equal(hit.state.wisps[0]!.damage, 1);
  assert.equal(hit.state.wisps[0]!.row, 1.5);
  assert.equal(hit.state.wisps[1]!.bornAt, hit.state.clock);
});

test('a dash is interrupted and a frozen wall cannot explode', () => {
  const { mechanic, state, board, window } = setup();
  mechanic.wisps = [{ ...mechanic.wisps[0]!, dashEvery: 3000 }];
  state.wisps[0] = { ...state.wisps[0]!, dashFrom: 0, dashUntil: 450 };
  const hit = lanesTick(mechanic, state, board, 100, window);
  assert.equal(hit.state.wisps[0]!.dashUntil, undefined);
  const frozen = lanesTick(mechanic, { ...state, frozen: { wall: 1000 } }, board, 100, window);
  assert.equal(frozen.effects.filter(e => e.kind === 'wall-impact').length, 0);
});

test('crawler, sideways weaver, and a wall placed under a wisp trigger contact', () => {
  for (const mode of ['crawler', 'weaver', 'overlap']) {
    const { mechanic, state, board, window } = setup();
    if (mode === 'crawler') {
      mechanic.wisps = [{ ...mechanic.wisps[0]!, crawlEvery: 1000 }];
      state.wisps[0] = { ...state.wisps[0]!, row: 1, crawlAt: 0 };
    } else if (mode === 'weaver') {
      mechanic.wisps = [{ ...mechanic.wisps[0]!, column: 1, weaveEvery: 1000 }];
      state.wisps[0] = { ...state.wisps[0]!, row: 2, weaveAt: 0 };
    } else state.wisps[0]!.row = 2;
    const hit = lanesTick(mechanic, state, board, 100, window);
    assert.equal(hit.effects.filter(e => e.kind === 'wall-impact').length, 1, mode);
    assert.ok(hit.state.wisps[0]!.damage > 0, mode);
  }
});
