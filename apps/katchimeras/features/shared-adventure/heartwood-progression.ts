import type { MergeWorldState } from '@/types/merge-world';
import { HEARTWOOD_BUILDINGS, heartwoodBuildingLevel } from '@/constants/heartwood-buildings';
import { heartwoodPlants } from './heartwood-garden';
import { heartTreeLevel, heartTreeStage } from '@/constants/heart-tree';

export const GARDEN_SUPPLY_INTERVAL = 12 * 60 * 60 * 1000;
export type HeartwoodStage = 'dormant' | 'stirring' | 'rooted' | 'blooming' | 'awakened';
export type GardenSupply = { version: 1; clock: number; startedAt: number; stored: number; nextParcel: number };

const STAGES: readonly HeartwoodStage[] = ['dormant', 'stirring', 'rooted', 'blooming', 'awakened'];

/**
 * What the buildings around the Tree say about it: the Tree grows with its circle. One building stirs it, three root
 * it, all four at Level 4 bring it to bloom and all four at Level 7 wake it. Seeds planted before the buildings
 * existed still count: the Tree stands at whichever reading is further along.
 */
function buildingStage(world: MergeWorldState): HeartwoodStage {
  // A dormant building (the first session's Spring before the garden wakes) has not stirred anything yet.
  const levels = HEARTWOOD_BUILDINGS.map(building => world.heartwoodBuildings?.[building.id]?.dormant ? 0 : heartwoodBuildingLevel(world, building.id));
  const built = levels.filter(level => level > 0).length;
  if (built === levels.length && levels.every(level => level >= 7)) return 'awakened';
  if (built === levels.length && levels.every(level => level >= 4)) return 'blooming';
  if (built >= 3) return 'rooted';
  return built >= 1 ? 'stirring' : 'dormant';
}

export function heartwoodStage(world: MergeWorldState): HeartwoodStage {
  const [plants, buildings] = [plantStage(world), buildingStage(world)];
  const grown = STAGES.indexOf(buildings) > STAGES.indexOf(plants) ? buildings : plants;
  // The Heart Tree, once woken, is grown by its own level (`constants/heart-tree.ts`): whichever reading is further along.
  const byTree = world.heartTree ? heartTreeStage(heartTreeLevel(world)) : 'dormant';
  return STAGES.indexOf(byTree) > STAGES.indexOf(grown) ? byTree : grown;
}

function plantStage(world: MergeWorldState): HeartwoodStage {
  const plants = heartwoodPlants(world);
  const sprouts = plants.filter(plant => plant.achievedGrowth >= 1).length;
  const blooms = plants.filter(plant => plant.achievedGrowth >= 3).length;
  if (blooms >= 5) return 'awakened';
  if (sprouts >= 5 && blooms >= 3) return 'blooming';
  if (sprouts >= 3) return 'rooted';
  // A completed legacy adventure already proves all three contributions.
  if (world.sharedAdventure?.completedAt != null) return 'rooted';
  if (sprouts >= 1) return 'stirring';
  if (world.sharedAdventure?.gardenSupply) return 'stirring';
  const firstGrowth = world.haven.plantableMemories.some(plant => plant.source.kind === 'ftue' && plant.status === 'planted' && plant.growthPoints >= 1);
  return firstGrowth || world.kingdomGoal?.introducedAt != null ? 'stirring' : 'dormant';
}

export function gardenSupplyStatus(supply: GardenSupply | undefined, time: number) {
  if (!supply) return { stored: 0, nextAt: null, now: time };
  const now = Math.max(time, supply.clock);
  const earned = Math.floor(Math.max(0, now - supply.startedAt) / GARDEN_SUPPLY_INTERVAL);
  const stored = Math.min(2, supply.stored + earned);
  return { stored, nextAt: stored >= 2 ? null : supply.startedAt + (earned + 1) * GARDEN_SUPPLY_INTERVAL, now };
}

/** Called only inside the serialized world transaction. No board-space requirement. */
export function unlockGardenSupply(world: MergeWorldState, now: number) {
  if (heartwoodStage(world) === 'dormant' || world.sharedAdventure?.gardenSupply) return false;
  const progress = world.sharedAdventure!;
  progress.gardenSupply = { version: 1, clock: now, startedAt: now, stored: 0, nextParcel: 1 };
  appendParcel(world, 'intro', now);
  progress.activity = [...progress.activity, { at: now, kind: 'supply_unlocked', target: 'mossprout-garden' }].slice(-200);
  return true;
}

function appendParcel(world: MergeWorldState, id: string, now: number) {
  const receipt = `heartwood:garden:${id}`;
  if (world.arrivals.some(arrival => arrival.id === receipt)) return;
  world.arrivals.push({ id: receipt, kind: 'contextual_parcel', createdAt: now, dayId: new Date(now).toISOString().slice(0, 10), label: 'Garden supply · two Seeds', theme: 'nature', familyId: 'nature', chainId: 'nature:garden', characterId: 'mossprout', source: 'companion_progression', itemDefinitionIds: ['nature:garden:1', 'nature:garden:1'], claimedAt: null, seenAt: null });
}

export function collectGardenSupply(world: MergeWorldState, time: number) {
  const supply = world.sharedAdventure?.gardenSupply;
  if (!supply) return false;
  const status = gardenSupplyStatus(supply, time);
  if (!status.stored) return false;
  for (let i = 0; i < status.stored; i++) appendParcel(world, String(supply.nextParcel++), status.now);
  supply.startedAt = status.stored === 2 ? status.now : supply.startedAt + Math.floor((status.now - supply.startedAt) / GARDEN_SUPPLY_INTERVAL) * GARDEN_SUPPLY_INTERVAL;
  supply.stored = 0;
  supply.clock = status.now;
  return true;
}
