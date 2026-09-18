import type { MossproutGardenPlantSlotId } from '@/types/merge-world';

// Retain the FTUE save ID; Mossprout now plants in the front-center bed.
export const MOSSPROUT_FIRST_MEMORY_SLOT_ID = 'back-centre' as const;
export const GARDEN_PLANT_SLOT_POSITIONS: Partial<Record<MossproutGardenPlantSlotId, { x: number; y: number }>> = {
  'back-left': { x: 0.212, y: 0.414 },
  'back-right': { x: 0.788, y: 0.414 },
  'front-left': { x: 0.315, y: 0.548 },
  'front-right': { x: 0.685, y: 0.548 },
  'back-centre': { x: 0.5, y: 0.592 },
};

type Frame = { height: number; left: number; top: number; width: number };
export function mossproutGardenPlantSlotFrame(gardenFrame: Frame, slotId: MossproutGardenPlantSlotId): Frame {
  const position = GARDEN_PLANT_SLOT_POSITIONS[slotId] ?? GARDEN_PLANT_SLOT_POSITIONS[MOSSPROUT_FIRST_MEMORY_SLOT_ID]!;
  const width = gardenFrame.width * 0.14;
  const height = gardenFrame.height * 0.09;
  return { left: gardenFrame.left + gardenFrame.width * position.x - width / 2,
    top: gardenFrame.top + gardenFrame.height * position.y - height / 2, width, height };
}
