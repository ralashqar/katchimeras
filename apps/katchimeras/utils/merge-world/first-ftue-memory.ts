import type { MergeWorldCommandResult, MergeWorldState } from '@/types/merge-world';
import { MOSSPROUT_FIRST_MEMORY_SLOT_ID } from '@/utils/mossprout-garden-layout';
import { reduceMergeWorld } from '@/utils/merge-world/engine';

export function firstFtueMemoryForSource(state: MergeWorldState, sourceId: string | null) {
  return state.haven.plantableMemories.find((plant) => (
    plant.source.kind === 'ftue' && (!sourceId || plant.source.sourceId === sourceId)
  )) ?? state.haven.plantableMemories.find((plant) => plant.source.kind === 'ftue');
}

/** Shared by the authored effect and UI recovery, inside the repository write queue. */
export function reduceFirstFtueMemoryPlacement(
  state: MergeWorldState,
  sourceId: string | null,
  receiptId: string,
  now: number,
): MergeWorldCommandResult {
  const plant = firstFtueMemoryForSource(state, sourceId);
  if (!plant || (plant.status === 'planted' && plant.slotId === MOSSPROUT_FIRST_MEMORY_SLOT_ID)) {
    return { state, changed: false };
  }
  return reduceMergeWorld(state, {
    type: 'placePlantableMemory',
    instanceId: plant.id,
    slotId: MOSSPROUT_FIRST_MEMORY_SLOT_ID,
    // v2 repairs saves where the previous recovery receipt moved the Seed to
    // centre, but the later authored effect incorrectly moved it left again.
    receiptId: `${receiptId}:${MOSSPROUT_FIRST_MEMORY_SLOT_ID}:v2`,
    now,
  });
}
