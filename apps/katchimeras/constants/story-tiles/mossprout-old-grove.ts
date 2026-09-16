import type { StoryTileDefinition } from './registry';

/**
 * The Old Grove: the garden Mossprout grew up in, kept under the Mist behind
 * the Garden. Arc 1 of his journey finds it again; the Bond Hex of the
 * chapter plan. Behind the Garden on the grid, south of it.
 */
export const MOSSPROUT_OLD_GROVE: StoryTileDefinition = {
  id: 'mossprout-old-grove',
  coord: { q: 0, r: 3 },
  unlockId: 'mossprout:old-grove',
  name: 'The Old Grove',
  companion: 'mossprout',
  revealPreset: 'mist-clear',
  alphaBoundsKey: 'shared_world_mossprout_old_grove_hex_tile_v1.webp',
  lines: {
    reveal: 'There. That’s where I started. It waited.',
  },
};
