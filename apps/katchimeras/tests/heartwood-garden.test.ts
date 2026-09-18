import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialMergeWorldState, normalizeMergeWorldState } from '@/utils/merge-world/engine';
import { reduceAdventure } from '@/features/shared-adventure/runtime';
import { heartwoodStage } from '@/features/shared-adventure/heartwood-progression';
import { HEARTWOOD_CATEGORIES, heartwoodPlants } from '@/features/shared-adventure/heartwood-garden';
import { GARDEN_PLANT_SLOT_POSITIONS, mossproutGardenPlantSlotFrame } from '@/utils/mossprout-garden-layout';
import type { MossproutGardenPlantSlotId } from '@/types/merge-world';

test('five Heartwood bed targets remain distinct around the larger original Tree', () => {
  const slots = Object.keys(GARDEN_PLANT_SLOT_POSITIONS) as MossproutGardenPlantSlotId[];
  assert.equal(slots.length, 5);
  const frames = slots.map(slot => mossproutGardenPlantSlotFrame({ left: 0, top: 0, width: 1024, height: 1024 }, slot));
  for (let i = 0; i < frames.length; i++) for (let j = i + 1; j < frames.length; j++) {
    const a = frames[i], b = frames[j];
    const overlaps = a.left < b.left + b.width && a.left + a.width > b.left && a.top < b.top + b.height && a.top + a.height > b.top;
    assert.equal(overlaps, false, `${slots[i]} and ${slots[j]} must not compete for a tap`);
  }
});

const NOW = 1800000000000;
function ready() {
  const world = createInitialMergeWorldState(NOW);
  world.kingdomGoal = { introducedAt: NOW, coachmarkSeenAt: null };
  world.board = world.board.map((cell, index) => ({ ...cell, locked: false, mist: null, blocker: null, occupant: { kind: 'item', instanceId: `plant:${index}`, definitionId: 'nature:garden:3' } }));
  return reduceAdventure(world, { type: 'sync_heartwood' }, NOW).state;
}
test('any five independently planted categories grow the same Tree through five visual stages', () => {
  let world = ready();
  for (const category of HEARTWOOD_CATEGORIES.slice(1)) {
    world = reduceAdventure(world, { type: 'tend_heartwood', category, expectedGrowth: -1 }, NOW + 1).state;
    world = reduceAdventure(world, { type: 'tend_heartwood', category, expectedGrowth: 0 }, NOW + 2).state;
  }
  assert.equal(new Set(world.haven.plantableMemories.map(plant => plant.slotId)).size, 5);
  assert.equal(heartwoodStage(world), 'rooted');
  for (const [index, category] of HEARTWOOD_CATEGORIES.slice(1).entries()) {
    world = reduceAdventure(world, { type: 'tend_heartwood', category, expectedGrowth: 1 }, NOW + 3).state;
    world = reduceAdventure(world, { type: 'tend_heartwood', category, expectedGrowth: 2 }, NOW + 4).state;
    if (index === 2) assert.equal(heartwoodStage(world), 'blooming');
  }
  assert.equal(heartwoodStage(world), 'awakened');
  const restored = normalizeMergeWorldState(JSON.parse(JSON.stringify(world)), NOW + 5);
  assert.equal(heartwoodStage(restored), 'awakened');
  assert.equal(heartwoodPlants(restored).find(plant => plant.category === 'connection')?.growth, 3);
});
test('selected bed is honored; replay, blocked inventory and insufficient delivery cannot spend resources', () => {
  let world = ready();
  const command = { type: 'tend_heartwood', category: 'connection', expectedGrowth: -1, slotId: 'back-right' } as const;
  world = reduceAdventure(world, command, NOW + 1).state;
  assert.equal(heartwoodPlants(world).find(plant => plant.category === 'connection')?.plant?.slotId, 'back-right');
  assert.equal(reduceAdventure(world, command, NOW + 2).changed, false);
  assert.throws(() => reduceAdventure(world, { ...command, category: 'warmth' }, NOW + 2), /occupied/);
  world.board.forEach(cell => { cell.locked = true; });
  const before = structuredClone(world);
  assert.throws(() => reduceAdventure(world, { type: 'tend_heartwood', category: 'connection', expectedGrowth: 0 }, NOW + 3), /Merge 1 Plant/);
  assert.deepEqual(world, before);
});
test('legacy duplicate categories retain memory IDs and strongest growth while freeing beds', () => {
  let world = ready();
  world.haven.plantableMemories = [
    { id: 'first-seed', definitionId: 'stillness', status: 'planted', slotId: 'back-centre', growthPoints: 1, source: { kind: 'ftue', sourceId: 'old' }, earnedAt: NOW, plantedAt: NOW },
    { id: 'second-memory', definitionId: 'stillness', status: 'planted', slotId: 'front-left', growthPoints: 5, source: { kind: 'moment', sourceId: 'old' }, earnedAt: NOW, plantedAt: NOW },
  ];
  world = reduceAdventure(world, { type: 'sync_heartwood' }, NOW + 1).state;
  assert.equal(world.haven.plantableMemories[0].id, 'first-seed');
  assert.equal(world.haven.plantableMemories[0].growthPoints, 5);
  assert.equal(world.haven.plantableMemories[0].slotId, 'back-centre');
  assert.equal(world.haven.plantableMemories[1].status, 'earned');
  assert.equal(world.haven.plantableMemories[1].growthPoints, 5);
  assert.equal(reduceAdventure(world, { type: 'sync_heartwood' }, NOW + 2).changed, false);
});

test('swapping retains growth and earned Tree stage; collecting a plant again is free', () => {
  let world = ready();
  for (const category of HEARTWOOD_CATEGORIES.slice(0, 5)) {
    for (const expectedGrowth of [-1, 0, 1, 2]) world = reduceAdventure(world, { type: 'tend_heartwood', category, expectedGrowth }, NOW + 1).state;
  }
  const old = heartwoodPlants(world)[0].plant!;
  const occupied = world.board.filter(cell => cell.occupant).length;
  const swap = { type: 'place_heartwood', category: 'connection', slotId: old.slotId!, expectedOccupantId: old.id } as const;
  world = reduceAdventure(world, swap, NOW + 2).state;
  assert.equal(world.board.filter(cell => cell.occupant).length, occupied - 1);
  assert.equal(world.haven.plantableMemories.find(plant => plant.id === old.id)?.growthPoints, 3);
  assert.equal(world.haven.plantableMemories.filter(plant => plant.status === 'planted').length, 5);
  assert.equal(heartwoodStage(world), 'awakened');
  assert.equal(reduceAdventure(world, swap, NOW + 3).changed, false);
  const replacement = heartwoodPlants(world).find(plant => plant.category === 'connection')!.plant!;
  world = reduceAdventure(world, { type: 'place_heartwood', category: 'momentum', slotId: old.slotId!, expectedOccupantId: replacement.id }, NOW + 4).state;
  assert.equal(world.board.filter(cell => cell.occupant).length, occupied - 1, 'replanting is free');
  assert.equal(heartwoodPlants(world)[0].plant?.growthPoints, 3);
  assert.equal(heartwoodStage(normalizeMergeWorldState(JSON.parse(JSON.stringify(world)), NOW + 5)), 'awakened');
  assert.throws(() => reduceAdventure(world, { ...swap, slotId: 'front-centre' }, NOW + 6), /available/);
});

test('six-bed saves migrate once, keep every memory and move Mossprout to the front center', () => {
  let world = ready();
  world.sharedAdventure!.gardenBedsVersion = 1;
  const slots = ['back-left', 'back-centre', 'back-right', 'front-left', 'front-right', 'front-centre'] as const;
  world.haven.plantableMemories = HEARTWOOD_CATEGORIES.map((definitionId, index) => ({ id: `legacy:${index}`, definitionId, status: 'planted', slotId: slots[index], growthPoints: 3, source: { kind: index === 0 ? 'ftue' : 'tending', sourceId: 'legacy' }, earnedAt: NOW, plantedAt: NOW }));
  world = reduceAdventure(world, { type: 'sync_heartwood' }, NOW + 1).state;
  assert.equal(world.sharedAdventure!.gardenBedsVersion, 2);
  assert.equal(world.haven.plantableMemories.length, 6);
  assert.equal(world.haven.plantableMemories.filter(plant => plant.status === 'planted').length, 5);
  assert.equal(world.haven.plantableMemories[0].slotId, 'back-centre');
  assert.ok(world.haven.plantableMemories.every(plant => plant.growthPoints === 3));
  assert.equal(heartwoodStage(world), 'awakened');
  assert.equal(reduceAdventure(world, { type: 'sync_heartwood' }, NOW + 2).changed, false);
});
