import assert from 'node:assert/strict';
import test from 'node:test';
import { combatLessonMission } from '@/constants/combat-campaign';
import { createEncounterState, encounterWindow } from '@/features/encounter/create-state';
import { chainBenefits } from '@/features/encounter/chain-homes';
import { mergeBurst } from '@/features/encounter/merge-burst';
import { createLanesState, lanesTick, normalizeLanesState, type LanesMechanic } from '@/features/mission-mechanics/lanes';
import { bulwarkBlast, rippleFalloff, type CombatChain } from '@/features/mission-mechanics/combat-rules';

function setup(chain: CombatChain, tier: number, positions = [[2, 1], [2, 0], [3, 1], [4, 0]]) {
  const encounter = combatLessonMission(3).encounter;
  const window = encounterWindow(encounter);
  const board = createEncounterState(encounter, 'mossprout', 1);
  board.board = board.board.map(cell => ({ ...cell, occupant: null, mist: null, locked: false }));
  board.board[31]!.occupant = { kind: 'item', instanceId: 'merged', definitionId: `nature:${chain}:${tier}` };
  const mechanic: LanesMechanic = { kind: 'lanes', rulesVersion: 2, wisps: positions.map(([column], i) => ({ id: `w${i}`, column: column!, hp: 1000, at: 0, stepMs: 1000000 })) };
  const state = createLanesState(mechanic);
  state.wisps.forEach((w, i) => { w.row = positions[i]![1]!; });
  state.ready.merged = 100000;
  return { mechanic, window, board, state: mergeBurst(mechanic, state, board, window, 31) };
}

test('Garden merge fires one bonus bullet at T2 and one more per tier over time and preserves remaining burst through save/resume', () => {
  for (const tier of [2, 3, 4, 5, 6, 7]) {
    const { mechanic, window, board, state } = setup('garden', tier);
    const first = lanesTick(mechanic, state, board, 1, window);
    assert.equal(first.fired.length, 1);
    let saved = normalizeLanesState(mechanic, JSON.parse(JSON.stringify(first.state)), 0)!;
    let count = 1;
    for (let i = 0; i < 14; i++) {
      const tick = lanesTick(mechanic, saved, first.board, 100, window);
      saved = tick.state; count += tick.fired.length;
    }
    assert.equal(count, tier - 1);
    assert.equal(saved.mergeAttacks!.length, 0);
    assert.ok(saved.wisps[0]!.damage > 0);
    assert.equal(saved.wisps[1]!.damage, 0, 'Garden burst targets the nearest enemy in its lane');
  }
});

test('Storm merge fans out from one origin with simultaneous landing times and tier-scaled target count', () => {
  for (const tier of [2, 3, 4]) {
    const { mechanic, window, board, state } = setup('storm', tier);
    const tick = lanesTick(mechanic, state, board, 1, window);
    assert.equal(tick.zaps.length, 1);
    assert.equal(tick.zaps[0]!.simultaneous, true);
    assert.equal(tick.zaps[0]!.wisps.length, tier - 1);
    assert.equal(tick.zaps[0]!.wisps[0], 0);
    assert.equal(new Set(tick.state.shots.map(s => s.landsAt)).size, 1);
    assert.ok(tick.state.shots.every(s => s.fromCell === 31));
  }
});

test('shield merge is a circular falloff pulse, does not sacrifice the plant, and respects chain upgrades', () => {
  const { mechanic, window, board, state } = setup('bulwark', 4, [[2, 0.8], [3, 0.8], [4, 0]]);
  const tick = lanesTick(mechanic, state, board, 1, window);
  assert.ok(tick.state.wisps[0]!.damage > tick.state.wisps[1]!.damage);
  assert.ok(tick.state.wisps[1]!.damage > 0);
  assert.equal(tick.state.wisps[2]!.damage, 0);
  assert.ok(tick.board.board[31]!.occupant);
  assert.ok(tick.effects.some(e => e.kind === 'wall-impact' && e.radius === bulwarkBlast(4).radius && !e.charge));
  const boosted = lanesTick(mechanic, state, board, 1, window, undefined, { chains: { bulwark: { ...chainBenefits(1), power: 1.5 } } });
  assert.ok(Math.abs(boosted.state.wisps[0]!.damage / tick.state.wisps[0]!.damage - 1.5) < 0.00001);
  assert.equal(rippleFalloff(2, 2), 0.25);
  assert.equal(rippleFalloff(2.01, 2), 0);
});

test('Dew merge heals and thaws nearby plants; Lantern merge pierces along its lane', () => {
  const dew = setup('dew', 3);
  dew.board.board[30]!.occupant = { kind: 'item', definitionId: 'nature:garden:3', instanceId: 'ally' };
  dew.state.combat!.plants.ally = { tier: 3, hearts: 1, shield: 0, shieldAt: 0, immuneUntil: 0, interceptAt: 0 };
  dew.state.frozen = { ally: 10000 };
  const healed = lanesTick(dew.mechanic, dew.state, dew.board, 1, dew.window);
  assert.equal(healed.state.combat!.plants.ally!.hearts, 3);
  assert.equal(healed.state.frozen?.ally, undefined);
  assert.ok(healed.effects.some(e => e.kind === 'wall-impact' && e.healing));
  const lantern = setup('lantern', 3);
  const pierced = lanesTick(lantern.mechanic, lantern.state, lantern.board, 1, lantern.window);
  assert.deepEqual(pierced.fired.map(s => s.wisp), [0, 1]);
});

test('wave preparation preserves queued merge attacks without firing early', () => {
  const { mechanic, state, board, window } = setup('garden', 3);
  state.combat!.preparingMs = 500;
  const paused = lanesTick(mechanic, state, board, 500, window);
  assert.equal(paused.fired.length, 0);
  assert.equal(paused.state.mergeAttacks!.length, 2);
  assert.equal(lanesTick(mechanic, paused.state, board, 1, window).fired.length, 1);
});
