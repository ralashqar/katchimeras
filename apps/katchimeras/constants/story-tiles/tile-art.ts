import type { HatchableTileArt } from '@/types/hatchable-companion';
import { artSourceSet } from '@/utils/art-source';

/**
 * The revealed art of every story tile, by tile id. Kept apart from the
 * definitions on purpose, like the hatchable tiles: a definition is data
 * that tests and the engine load; bundled images are only for the scene.
 */
const TILE_ART: Readonly<Record<string, () => HatchableTileArt>> = {
  'mossprout-old-grove': () => ({
    full: require('@incubator/art-world/hex/shared_world_mossprout_old_grove_hex_tile_v1.webp'),
    medium: require('@incubator/art-world/hex/shared_world_mossprout_old_grove_hex_tile_v1_512.webp'),
    thumb: require('@incubator/art-world/hex/shared_world_mossprout_old_grove_hex_tile_v1_256.webp'),
  }),
};

export const STORY_TILE_ART_IDS: readonly string[] = Object.keys(TILE_ART);

/** Whether a story tile has revealed art anywhere: brought by a pack, or bundled. */
export const hasStoryTileArt = (tileId: string): boolean => artSourceSet(`tile:${tileId}`) != null || tileId in TILE_ART;

export function storyTileArt(tileId: string): HatchableTileArt {
  const registered = artSourceSet(`tile:${tileId}`);
  if (registered) return registered;
  const art = TILE_ART[tileId];
  if (!art) throw new Error(`No revealed tile art is registered for ${tileId}.`);
  return art();
}
