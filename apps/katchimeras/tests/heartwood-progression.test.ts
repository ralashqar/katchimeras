import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialMergeWorldState, normalizeMergeWorldState } from '@/utils/merge-world/engine';
import { reduceAdventure } from '@/features/shared-adventure/runtime';
import { heartwoodStage, gardenSupplyStatus, GARDEN_SUPPLY_INTERVAL as INTERVAL } from '@/features/shared-adventure/heartwood-progression';

const NOW = Date.parse('2026-09-18T12:00:00Z');
function ready() {
  const world = createInitialMergeWorldState(NOW);
  world.kingdomGoal = { ...world.kingdomGoal, introducedAt: NOW } as NonNullable<typeof world.kingdomGoal>;
  return world;
}
test('restoring the home alone does not preempt first-growth teaching', () => {
  const world = createInitialMergeWorldState(NOW);
  world.haven.tileStages.mossprout = 1;
  assert.equal(heartwoodStage(world), 'dormant');
  assert.equal(reduceAdventure(world, { type: 'sync_heartwood' }, NOW).changed, false);
});
test('older progress unlocks one introductory parcel, without retroactive production', () => {
  let world = reduceAdventure(ready(), { type: 'sync_heartwood' }, NOW).state;
  assert.equal(heartwoodStage(world), 'stirring');
  assert.deepEqual(world.arrivals.at(-1)?.itemDefinitionIds, ['nature:garden:1', 'nature:garden:1']);
  const count = world.arrivals.length;
  world = reduceAdventure(world, { type: 'sync_heartwood' }, NOW + INTERVAL).state;
  assert.equal(world.arrivals.length, count);
  assert.equal(gardenSupplyStatus(world.sharedAdventure?.gardenSupply, NOW).stored, 0);
  assert.equal(heartwoodStage({ ...world, sharedAdventure: { ...world.sharedAdventure!, completedAt: NOW } }), 'rooted');
});
test('collection keeps partial intervals and atomically queues supplies even on a full board', () => {
  let world = reduceAdventure(ready(), { type: 'sync_heartwood' }, NOW).state;
  world.board = world.board.map((cell, index) => ({ ...cell, occupant: { kind: 'item', instanceId: `full:${index}`, definitionId: 'nature:garden:1' } }));
  const beforeBoard = structuredClone(world.board);
  const initial = world.arrivals.length;
  world = reduceAdventure(world, { type: 'collect_garden_supply' }, NOW + INTERVAL * 1.5).state;
  assert.equal(world.arrivals.length, initial + 1);
  assert.deepEqual(world.board, beforeBoard);
  assert.equal(gardenSupplyStatus(world.sharedAdventure?.gardenSupply, NOW + INTERVAL * 1.5).nextAt, NOW + INTERVAL * 2);
  assert.equal(reduceAdventure(world, { type: 'collect_garden_supply' }, NOW + INTERVAL * 1.5).changed, false);
});

test('first seed growth wakes Heartwood before Steppling and its earned stage survives memory removal', () => {
  let world = createInitialMergeWorldState(NOW);
  world.haven.plantableMemories.push({ id: 'first', definitionId: 'momentum', status: 'planted', slotId: 'back-centre', growthPoints: 0, source: { kind: 'ftue', sourceId: 'opening' }, earnedAt: NOW, plantedAt: NOW });
  assert.equal(heartwoodStage(world), 'dormant');
  world.haven.plantableMemories[0].growthPoints = 1;
  assert.equal(heartwoodStage(world), 'stirring');
  world = reduceAdventure(world, { type: 'sync_heartwood' }, NOW).state;
  assert.equal(world.kingdomGoal?.introducedAt, undefined);
  assert.equal(world.arrivals.filter(arrival => arrival.id === 'heartwood:garden:intro').length, 1);
  world.haven.plantableMemories = [];
  assert.equal(heartwoodStage(world), 'stirring');
});
test('offline storage caps at two and discards overflow before restarting; rollback cannot duplicate', () => {
  let world = reduceAdventure(ready(), { type: 'sync_heartwood' }, NOW).state;
  const initial = world.arrivals.length;
  const later = NOW + INTERVAL * 100;
  world = reduceAdventure(world, { type: 'collect_garden_supply' }, later).state;
  assert.equal(world.arrivals.length, initial + 2);
  assert.equal(gardenSupplyStatus(world.sharedAdventure?.gardenSupply, later).nextAt, later + INTERVAL);
  assert.equal(reduceAdventure(world, { type: 'collect_garden_supply' }, NOW).changed, false);
  const reloaded = normalizeMergeWorldState(world, later);
  assert.equal(reloaded.sharedAdventure?.gardenSupply?.nextParcel, 3);
  assert.equal(reduceAdventure(reloaded, { type: 'sync_heartwood' }, later).changed, false);
});
