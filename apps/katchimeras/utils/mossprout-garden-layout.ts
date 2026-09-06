import type { MossproutGardenPlantSlotId } from '@/types/merge-world';

export const MOSSPROUT_FIRST_MEMORY_SLOT_ID = 'back-centre' as const;

// Coordinates refer to the full 1024px art canvas, not its alpha bounds or
// the logical hex. The central bed was measured on both shipping art levels.
export const GARDEN_PLANT_SLOT_POSITIONS = {
  'back-left': { x: 0.37, y: 0.45 },
  'back-centre': { x: 550 / 1024, y: 350 / 1024 },
  'back-right': { x: 0.75, y: 0.33 },
  'front-left': { x: 0.245, y: 0.525 },
  'front-centre': { x: 0.50, y: 0.50 },
  'front-right': { x: 0.74, y: 0.48 },
} as const;

type Frame = { height: number; left: number; top: number; width: number };

export function mossproutGardenPlantSlotFrame(gardenFrame: Frame, slotId: MossproutGardenPlantSlotId): Frame {
  if (slotId === MOSSPROUT_FIRST_MEMORY_SLOT_ID) {
    // Include the outer rim of the rectangular soil bed, not the tall sprite
    // that will grow from it. The old sprite-shaped target sat above the soil.
    return {
      left: gardenFrame.left + gardenFrame.width * (442 / 1024),
      top: gardenFrame.top + gardenFrame.height * (270 / 1024),
      width: gardenFrame.width * (220 / 1024),
      height: gardenFrame.height * (154 / 1024),
    };
  }
  const position = GARDEN_PLANT_SLOT_POSITIONS[slotId];
  const width = gardenFrame.width * 0.24;
  const height = gardenFrame.height * 0.168;
  return {
    left: gardenFrame.left + gardenFrame.width * position.x - width / 2,
    top: gardenFrame.top + gardenFrame.height * position.y - height / 2,
    width,
    height,
  };
}
