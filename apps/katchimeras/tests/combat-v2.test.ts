import assert from 'node:assert/strict';
import test from 'node:test';
import { combatLessonMission, combatBossSpec } from '@/constants/combat-campaign';
import { islandLevel } from '@/constants/island-campaigns/island-levels';
import { createEncounterState, encounterWindow } from '@/features/encounter/create-state';
import { createLanesState, laneArrived, lanesTick, normalizeLanesState, type LanesMechanic } from '@/features/mission-mechanics/lanes';
import { combatFire, heroDamageMultiplier } from '@/features/mission-mechanics/combat-rules';
import { validateEncounterDefinition } from '@/features/encounter/validate-encounter';
import { lanesPlaytest } from '@/features/encounter/lanes-playtest';
import { openMistCell } from '@/features/encounter/mist';
import { unlockedCombatGenerators, withCombatGenerator } from '@/features/encounter/combat-loadout';
import { combatDayId, combatWeekId, dailyCombatMission, weeklyCombatMissions } from '@/features/encounters/combat-events';
import { createInitialMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';
import { frontierHeldCount, FRONTIER_TILES, frontierMissionId } from '@/constants/frontier-tiles';
import type { MergeWorldCommand } from '@/types/merge-world';

const setup = () => {
  const encounter = combatLessonMission(3).encounter;
  const mechanic = encounter.mechanic as LanesMechanic;
  const window = encounterWindow(encounter);
  return { encounter, mechanic, window, board: createEncounterState(encounter, 'mossprout', 1), state: createLanesState(mechanic) };
};
test('all 24 lessons and nine boss variants have valid encounter definitions', () => {
  for (let i = 0; i < 24; i++) assert.deepEqual(validateEncounterDefinition(combatLessonMission(i).encounter), [], `lesson ${i}`);
  for (let boss = 0; boss < 3; boss++) for (let tier = 0; tier < 3; tier++) assert.deepEqual(validateEncounterDefinition(islandLevel('test', `${boss}-${tier}`, combatBossSpec(boss, tier)).encounter), []);
});
test('every Garden merge beats the combined damage of its inputs by ten percent', () => {
  for (let tier = 2; tier < 7; tier++) {
    const a = combatFire(tier)!; const b = combatFire(tier + 1)!;
    assert.ok(Math.abs(b.damage / b.periodMs / (a.damage / a.periodMs) - 2.2) < 0.00001);
  }
  assert.equal(heroDamageMultiplier(1), 1);
  assert.equal(heroDamageMultiplier(10), 1.72);
});
test('wave one cannot skip before its first enemy arrives, and preparation freezes combat', () => {
  const { mechanic, state, board, window } = setup();
  const early = lanesTick(mechanic, state, board, 100, window);
  assert.equal(early.state.combat!.wave, 0);
  assert.equal(laneArrived(mechanic, early.state, 0), false);
  const dead = { ...early.state, wisps: early.state.wisps.map((w, i) => ({ ...w, damage: (mechanic.wisps[i]!.wave ?? 0) === 0 ? mechanic.wisps[i]!.hp : 0 })) };
  const next = lanesTick(mechanic, dead, early.board, 100, window);
  assert.equal(next.state.combat!.wave, 1);
  assert.equal(next.state.combat!.preparingMs, 5000);
  const prep = lanesTick(mechanic, next.state, next.board, 1000, window);
  assert.equal(prep.state.clock, next.state.clock);
  assert.equal(prep.state.combat!.preparingMs, 4000);
  assert.deepEqual(prep.board, next.board);
});
test('hits consume hearts, downgrade once, preserve instance identity, and survive a save', () => {
  const { mechanic, state, board, window } = setup();
  const plant = board.board[36]!.occupant!;
  assert.equal(plant.kind, 'item');
  if (plant.kind !== 'item') return;
  const incoming = { ...state, spits: [{ id: 1, wisp: 0, cell: 36, firedAt: 0, landsAt: 50, strike: true }] };
  const hit = lanesTick(mechanic, incoming, board, 100, window);
  assert.equal(hit.board.board[36]!.occupant?.kind === 'item' && hit.board.board[36]!.occupant.definitionId, 'nature:garden:1');
  assert.equal(hit.state.combat!.plants[plant.instanceId]!.hearts, 1);
  const again = lanesTick(mechanic, { ...hit.state, spits: incoming.spits }, hit.board, 100, window);
  assert.ok(again.board.board[36]!.occupant, 'grace prevents another immediate downgrade');
  assert.deepEqual(normalizeLanesState(mechanic, JSON.parse(JSON.stringify(again.state)), 0)?.combat, again.state.combat);
});
test('Bulwarks intercept one damaging hit for a neighbouring plant', () => {
  const { mechanic, state, board, window } = setup();
  board.board[37] = { ...board.board[37]!, occupant: { kind: 'item', definitionId: 'nature:bulwark:2', instanceId: 'guard' } };
  const hit = lanesTick(mechanic, { ...state, spits: [{ id: 1, wisp: 0, cell: 36, firedAt: 0, landsAt: 50, strike: true }] }, board, 100, window);
  assert.equal(hit.state.combat!.plants.guard!.shield, 0);
  assert.equal(hit.state.combat!.prevented, 1);
  assert.deepEqual(hit.board.board[36], board.board[36]);
});
test('three breaches lose the sanctuary, a single boss breach loses all hearts', () => {
  const { mechanic, state, board, window } = setup();
  const incoming = { ...state, clock: 30000, wisps: state.wisps.map((w, i) => ({ ...w, row: i < 3 ? 4.49 : -4 })) };
  const hit = lanesTick(mechanic, incoming, board, 500, window);
  assert.equal(hit.state.combat!.hearts, 0);
  assert.notEqual(hit.state.breached, null);
  const boss = { ...mechanic, wisps: mechanic.wisps.map((w, i) => ({ ...w, breachDamage: i === 0 ? 3 : 1 })) };
  assert.equal(lanesTick(boss, incoming, board, 500, window).state.combat!.hearts, 0);
});
test('representative opening lessons require active play', () => {
  for (const index of [0, 3, 8]) assert.equal(lanesPlaytest(combatLessonMission(index).encounter, { style: 'idle', maxMs: 240000 }).won, false);
});

test('a fixed warning can be dodged, and bomber binding preserves plant identity', () => {
  const { mechanic, state, board, window } = setup();
  const plant = board.board[36]!.occupant!;
  board.board[37] = { ...board.board[37]!, occupant: plant };
  board.board[36] = { ...board.board[36]!, occupant: null };
  const warning = { id: 1, wisp: 0, cells: [36], kind: 'gunner' as const, landsAt: 50 };
  const dodge = lanesTick(mechanic, { ...state, combat: { ...state.combat!, warnings: [warning] } }, board, 100, window);
  assert.deepEqual(dodge.board.board[37]!.occupant, plant);
  const bound = lanesTick(mechanic, { ...state, combat: { ...state.combat!, warnings: [{ ...warning, kind: 'bomber', cells: [37] }] } }, board, 100, window);
  assert.equal(bound.board.board[37]!.mist?.kind, 'encounter');
  assert.deepEqual(openMistCell(bound.board, 37).board.board[37]!.occupant, plant);
});

test('Dew heals neighbouring hearts and cleanses frost without making a new plant', () => {
  const { mechanic, state, board, window } = setup();
  const plant = board.board[36]!.occupant!;
  if (plant.kind !== 'item') throw new Error('missing plant');
  board.board[37] = { ...board.board[37]!, occupant: { kind: 'item', definitionId: 'nature:dew:3', instanceId: 'healer' } };
  const warm = lanesTick(mechanic, state, board, 100, window);
  warm.state.combat!.plants[plant.instanceId]!.hearts = 1;
  const healed = lanesTick(mechanic, { ...warm.state, frozen: { [plant.instanceId]: 10000 } }, warm.board, 3100, window);
  assert.equal(healed.state.combat!.plants[plant.instanceId]!.hearts, 2);
  assert.equal(healed.state.frozen?.[plant.instanceId], undefined);
});

test('Mirror reflects a projectile once, while a Spark passes through', () => {
  const { mechanic, state, board, window } = setup();
  const mirror: LanesMechanic = { ...mechanic, wisps: mechanic.wisps.map((wisp, index) => index === 0 ? { ...wisp, attack: 'mirror', hp: 30, at: 0 } : wisp) };
  const shot = { id: 1, wisp: 0, fromCell: 36, damage: 4, firedAt: 0, landsAt: 50 };
  const reflected = lanesTick(mirror, { ...state, shots: [{ ...shot, kind: 'projectile' }] }, board, 100, window);
  assert.equal(reflected.state.wisps[0]!.damage, 0);
  const zap = lanesTick(mirror, { ...state, shots: [{ ...shot, kind: 'zap' }] }, board, 100, window);
  assert.equal(zap.state.wisps[0]!.damage, 4);
});

test('support selection changes one generator and loans do not unlock everything', () => {
  const encounter = withCombatGenerator(combatLessonMission(3).encounter, 'dew-well');
  assert.equal(encounter.spawners.filter((s) => s.generatorId === 'seed-sprinkler').length, 1);
  assert.equal(encounter.spawners.filter((s) => s.generatorId === 'dew-well').length, 1);
  assert.equal(createEncounterState(encounter, 'mossprout').generators['dew-well']?.forcedDropDefinitionId, 'nature:dew:1');
  assert.deepEqual(unlockedCombatGenerators([], 'ward-planter'), ['storm-pot', 'ward-planter']);
  assert.equal(unlockedCombatGenerators(['explorers-lodge', 'the-signal', 'the-kitchen']).length, 4);
});

test('UTC event identities are deterministic across a week and rewards cannot duplicate', () => {
  const now = Date.UTC(2026, 8, 28, 23, 50);
  const day = combatDayId(now);
  assert.equal(day, '2026-09-28');
  assert.equal(combatWeekId('2026-10-04'), day);
  assert.equal(combatWeekId('2026-10-05'), '2026-10-05');
  assert.deepEqual(dailyCombatMission(day, 1), dailyCombatMission(day, 1));
  assert.equal(weeklyCombatMissions(day, {}).length, 0);
  const missions = weeklyCombatMissions(day, { frontierSurges: { firstHeldAt: now, contested: {} } });
  assert.equal(missions.length, 3);
  const world = createInitialMergeWorldState(now, ['mossprout']);
  const command: MergeWorldCommand = { type: 'completeEncounter', receiptId: 'weekly-fixture', missionId: missions[0]!.id, katchimeraId: 'mossprout', helperWispId: null, difficulty: 'boss', now,
    outcome: { cleared: true, grade: 'perfect', resolveLeft: null, actions: 20, merges: 10, continues: 0, rescued: false } };
  const won = reduceMergeWorld(world, command);
  assert.ok(won.changed);
  assert.equal(reduceMergeWorld(won.state, command).state.coins, won.state.coins);
});

test('surges keep reclaimed income and first-clear salvage pays only once', () => {
  const now = Date.UTC(2026, 8, 28);
  const world = createInitialMergeWorldState(now, ['mossprout']);
  const id = FRONTIER_TILES[0]!.id;
  const command: MergeWorldCommand = { type: 'completeEncounter', receiptId: 'frontier-fixture', missionId: frontierMissionId(id), katchimeraId: 'mossprout', helperWispId: null, difficulty: 'calm', now,
    outcome: { cleared: true, grade: 'perfect', resolveLeft: null, actions: 20, merges: 10, continues: 0, rescued: false, frontierReward: 'timber' } };
  const won = reduceMergeWorld(world, command);
  assert.ok(won.encounterCleared!.reclaimed!.timber >= 4);
  assert.equal(reduceMergeWorld(won.state, command).state.materials?.timber, won.state.materials?.timber);
  const held = { ...won.state, frontierSurges: { firstHeldAt: now, contested: { [id]: now } } };
  assert.equal(frontierHeldCount(held), 1);
  assert.equal(reduceMergeWorld(held, { type: 'mistSurge', dayId: '2026-09-29', now: now + 86400000 }).changed, false);
});
