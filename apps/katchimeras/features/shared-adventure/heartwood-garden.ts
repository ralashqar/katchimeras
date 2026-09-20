import type { MergeWorldState, MossproutGardenPlantSlotId, MossproutMemoryPlantId } from '@/types/merge-world';

export const HEARTWOOD_CATEGORIES = ['momentum', 'stillness', 'renewal', 'warmth', 'curiosity', 'connection'] as const;
// Saved IDs stay stable; back-centre is now the front-center showcase bed.
export const HEARTWOOD_BEDS: readonly MossproutGardenPlantSlotId[] = ['back-centre', 'front-left', 'front-right', 'back-left', 'back-right'];
export const HEARTWOOD_BED_LABELS: Partial<Record<MossproutGardenPlantSlotId, string>> = {
  'back-centre': 'Front center', 'front-left': 'Front left', 'front-right': 'Front right', 'back-left': 'Left side', 'back-right': 'Right side',
};

export function availableHeartwoodBeds(world: MergeWorldState) {
  return HEARTWOOD_BEDS.filter(bed => bed !== world.wispLanternPlacement?.slotId);
}

export function heartwoodPlants(world: MergeWorldState) {
  return HEARTWOOD_CATEGORIES.map(category => {
    const memories = world.haven.plantableMemories.filter(plant => plant.definitionId === category).sort((a, b) => b.growthPoints - a.growthPoints);
    const plant = memories.find(plant => plant.status === 'planted');
    const memory = plant ?? memories[0];
    const achievedGrowth = Math.max(-1, ...memories.filter(plant => plant.status === 'planted' || plant.plantedAt != null).map(plant => plant.growthPoints));
    return { category, plant, memory, achievedGrowth, growth: memory?.growthPoints ?? -1,
      requiredPlants: plant ? Math.min(3, plant.growthPoints + 1) : memory ? 0 : 1 };
  });
}

/** Keep every memory and its growth; five beds hold unique categories. */
export function reconcileHeartwoodPlants(world: MergeWorldState) {
  let changed = false;
  for (const category of HEARTWOOD_CATEGORIES) {
    const planted = world.haven.plantableMemories.filter(plant => plant.definitionId === category && plant.status === 'planted');
    if (planted.length < 2) continue;
    const keeper = planted.find(plant => plant.source.kind === 'ftue') ?? planted[0];
    keeper.growthPoints = Math.max(...planted.map(plant => plant.growthPoints));
    for (const duplicate of planted) if (duplicate !== keeper) { duplicate.status = 'earned'; duplicate.slotId = null; }
    changed = true;
  }
  const firstMigration = world.sharedAdventure?.gardenBedsVersion !== 2;
  const planted = world.haven.plantableMemories.filter(plant => plant.status === 'planted')
    .sort((a, b) => Number(b.source.kind === 'ftue') - Number(a.source.kind === 'ftue'));
  const used = new Set<MossproutGardenPlantSlotId>(world.wispLanternPlacement ? [world.wispLanternPlacement.slotId] : []);
  for (const plant of planted) {
    const preferred = firstMigration && plant.source.kind === 'ftue' ? 'back-centre' : plant.slotId;
    const slot = preferred && HEARTWOOD_BEDS.includes(preferred) && !used.has(preferred) ? preferred : HEARTWOOD_BEDS.find(bed => !used.has(bed));
    if (!slot) {
      plant.plantedAt ??= plant.earnedAt;
      plant.status = 'earned'; plant.slotId = null; changed = true;
    } else {
      if (plant.slotId !== slot) { plant.slotId = slot; changed = true; }
      used.add(slot);
    }
  }
  return changed;
}

function consumePlants(world: MergeWorldState, amount: number) {
  const cells = world.board.filter(cell => !cell.locked && !cell.blocker && !cell.mist && cell.occupant?.kind === 'item' && cell.occupant.definitionId === 'nature:garden:3');
  if (cells.length < amount) throw new Error(`Merge ${amount} Plant${amount === 1 ? '' : 's'} on the Garden board first.`);
  cells.slice(0, amount).forEach(cell => { cell.occupant = null; });
}

/** Expected occupant makes replacements safe against stale taps and retries. */
export function placeHeartwood(world: MergeWorldState, category: MossproutMemoryPlantId, slotId: MossproutGardenPlantSlotId, expectedOccupantId: string | null, now: number) {
  if (!HEARTWOOD_CATEGORIES.includes(category) || !availableHeartwoodBeds(world).includes(slotId)) throw new Error('Choose an available Heartwood category and bed.');
  const occupant = world.haven.plantableMemories.find(plant => plant.status === 'planted' && plant.slotId === slotId);
  if ((occupant?.id ?? null) !== expectedOccupantId) return false;
  const target = heartwoodPlants(world).find(entry => entry.category === category)!;
  if (target.plant) return false;
  // New categories cost one Plant; moving a collected plant is always free.
  if (!target.memory) consumePlants(world, 1);
  if (occupant) { occupant.status = 'earned'; occupant.slotId = null; occupant.plantedAt ??= now; }
  if (target.memory) {
    target.memory.status = 'planted'; target.memory.slotId = slotId; target.memory.plantedAt ??= now;
  } else world.haven.plantableMemories.push({ id: `heartwood:plant:${category}`, definitionId: category, status: 'planted', slotId, growthPoints: 0, source: { kind: 'tending', sourceId: `heartwood:${category}` }, earnedAt: now, plantedAt: now });
  world.haven.mutationReceipts.push({ id: `heartwood:place:${world.revision}:${category}:${slotId}`, kind: 'plantable_place', targetId: target.memory?.id ?? `heartwood:plant:${category}`, createdAt: now });
  return true;
}

/** Mutates only the cloned world owned by the serialized adventure transaction. */
export function tendHeartwood(world: MergeWorldState, category: MossproutMemoryPlantId, expectedGrowth: number, now: number, requestedSlot?: MossproutGardenPlantSlotId) {
  if (!HEARTWOOD_CATEGORIES.includes(category)) throw new Error('Unknown seed category');
  const target = heartwoodPlants(world).find(entry => entry.category === category)!;
  if (target.growth !== expectedGrowth) return false;
  if (!target.plant) {
    const slot = requestedSlot ?? availableHeartwoodBeds(world).find(bed => !world.haven.plantableMemories.some(plant => plant.status === 'planted' && plant.slotId === bed));
    if (!slot || world.haven.plantableMemories.some(plant => plant.status === 'planted' && plant.slotId === slot)) throw new Error('All plant beds are occupied. Choose a bed to swap.');
    return placeHeartwood(world, category, slot, null, now);
  }
  if (target.growth >= 3) return false;
  consumePlants(world, target.requiredPlants);
  target.plant.growthPoints++;
  world.haven.mutationReceipts.push({ id: `heartwood:tend:${category}:${expectedGrowth}`, kind: 'plantable_growth', targetId: target.plant.id, createdAt: now });
  return true;
}
