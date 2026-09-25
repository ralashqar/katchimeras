import type { HatchableTileArt } from '@/types/hatchable-companion';
import { artKeys, artSource, artSourceSet, type ArtSource } from '@/utils/art-source';

/**
 * The cleared tile art of every hatchable companion, by tile id. Kept apart
 * from the definitions on purpose: a definition is data that tests and the
 * engine load, and bundled images are only for the scene that draws them.
 * The registry test checks every definition has an entry here.
 */
const TILE_ART: Readonly<Record<string, () => HatchableTileArt>> = {
  'feastle-home': () => ({
    full: require('@incubator/art-world/hex/feastle_hearth_v1_hex_tile.webp'),
    medium: require('@incubator/art-world/hex/feastle_hearth_v1_hex_tile_512.webp'),
    thumb: require('@incubator/art-world/hex/feastle_hearth_v1_hex_tile_256.webp'),
  }),
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

/** A tile's own misted art (`HatchableTileDefinition.mistedAlphaBoundsKey`), by tile id. */
const MISTED_TILE_ART: Readonly<Record<string, () => HatchableTileArt>> = {
  'steppling-home': () => ({
    full: require('@incubator/art-world/hex/shared_world_steppling_misted_hex_tile_v1.webp'),
    medium: require('@incubator/art-world/hex/shared_world_steppling_misted_hex_tile_v1_512.webp'),
    thumb: require('@incubator/art-world/hex/shared_world_steppling_misted_hex_tile_v1_256.webp'),
  }),
};
export const HATCHABLE_MISTED_TILE_ART_IDS: readonly string[] = Object.keys(MISTED_TILE_ART);
export function hatchableMistedTileArt(tileId: string): HatchableTileArt | null {
  return MISTED_TILE_ART[tileId]?.() ?? null;
}

/** The friend's cut-out for the garden lesson's closing scene, by companion. */
const CUTOUT_ART: Readonly<Record<string, () => number>> = {
  feastle: () => require('@incubator/art-cutouts/feastle.png'),
  steppling: () => require('@incubator/art-cutouts/steppling.png'),
  baristabbit: () => require('@incubator/art-cutouts/baristabbit.png'),
};
export const HATCHABLE_CUTOUT_ART_IDS: readonly string[] = Object.keys(CUTOUT_ART);
export function hatchableCutoutArt(companion: string): ArtSource {
  const registered = artSource(artKeys.cutout(companion));
  if (registered) return registered;
  const art = CUTOUT_ART[companion];
  if (!art) throw new Error(`No cut-out art is registered for ${companion}.`);
  return art();
}

/** Whether a tile has cleared art anywhere: brought by a pack, or bundled. */
export const hasHatchableTileArt = (tileId: string): boolean => artSourceSet(`tile:${tileId}`) != null || tileId in TILE_ART;

export function hatchableTileArt(tileId: string): HatchableTileArt {
  const registered = artSourceSet(`tile:${tileId}`);
  if (registered) return registered;
  const art = TILE_ART[tileId];
  if (!art) throw new Error(`No cleared tile art is registered for ${tileId}.`);
  return art();
}
