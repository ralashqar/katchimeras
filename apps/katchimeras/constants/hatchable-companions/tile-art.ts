import type { HatchableTileArt } from '@/types/hatchable-companion';

/**
 * The cleared tile art of every hatchable companion, by tile id. Kept apart
 * from the definitions on purpose: a definition is data that tests and the
 * engine load, and bundled images are only for the scene that draws them.
 * The registry test checks every definition has an entry here.
 */
const TILE_ART: Readonly<Record<string, () => HatchableTileArt>> = {
  'steppling-home': () => ({
    full: require('@incubator/art-world/hex/shared_world_steppling_trailhead_hex_tile_v1.webp'),
    medium: require('@incubator/art-world/hex/shared_world_steppling_trailhead_hex_tile_v1_512.webp'),
    thumb: require('@incubator/art-world/hex/shared_world_steppling_trailhead_hex_tile_v1_256.webp'),
  }),
  'baristabbit-home': () => ({
    full: require('@incubator/art-world/hex/shared_world_baristabbit_window_hex_tile_v1.webp'),
    medium: require('@incubator/art-world/hex/shared_world_baristabbit_window_hex_tile_v1_512.webp'),
    thumb: require('@incubator/art-world/hex/shared_world_baristabbit_window_hex_tile_v1_256.webp'),
  }),
};

export const HATCHABLE_TILE_ART_IDS: readonly string[] = Object.keys(TILE_ART);

/** The friend's cut-out for the garden lesson's closing scene, by companion. */
const CUTOUT_ART: Readonly<Record<string, () => number>> = {
  steppling: () => require('@incubator/art-cutouts/steppling.png'),
  baristabbit: () => require('@incubator/art-cutouts/baristabbit.png'),
};
export const HATCHABLE_CUTOUT_ART_IDS: readonly string[] = Object.keys(CUTOUT_ART);
export function hatchableCutoutArt(companion: string): number {
  const art = CUTOUT_ART[companion];
  if (!art) throw new Error(`No cut-out art is registered for ${companion}.`);
  return art();
}

export function hatchableTileArt(tileId: string): HatchableTileArt {
  const art = TILE_ART[tileId];
  if (!art) throw new Error(`No cleared tile art is registered for ${tileId}.`);
  return art();
}
