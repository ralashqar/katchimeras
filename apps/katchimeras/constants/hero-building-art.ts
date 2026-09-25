import type { HatchableTileArt } from '@/types/hatchable-companion';

/**
 * A hero building's tile as it grows (`constants/hero-buildings.ts`): the tile's own art is the first look; the later
 * looks come from the shared-world hex pipeline (`art-source/katchimeras/shared-world-discovery-v2`, briefs
 * `steppling-lodge-2` and `steppling-lodge-3`), each with its generated bounds key.
 */
type TileLook = { art: () => HatchableTileArt; alphaBoundsKey: string };

const LOOKS: Readonly<Record<string, readonly [TileLook, TileLook]>> = {
  'steppling-home': [
    {
      alphaBoundsKey: 'shared_world_steppling_lodge_2_hex_tile_v1.webp',
      art: () => ({
        full: require('@incubator/art-world/hex/shared_world_steppling_lodge_2_hex_tile_v1.webp'),
        medium: require('@incubator/art-world/hex/shared_world_steppling_lodge_2_hex_tile_v1_512.webp'),
        thumb: require('@incubator/art-world/hex/shared_world_steppling_lodge_2_hex_tile_v1_256.webp'),
      }),
    },
    {
      alphaBoundsKey: 'shared_world_steppling_lodge_3_hex_tile_v1.webp',
      art: () => ({
        full: require('@incubator/art-world/hex/shared_world_steppling_lodge_3_hex_tile_v1.webp'),
        medium: require('@incubator/art-world/hex/shared_world_steppling_lodge_3_hex_tile_v1_512.webp'),
        thumb: require('@incubator/art-world/hex/shared_world_steppling_lodge_3_hex_tile_v1_256.webp'),
      }),
    },
  ],
};

/** A tile's art at a hero building look (1 or 2), or null for its own art (look 0, or a tile with no looks). */
export function heroTileLook(tileId: string, look: number): TileLook | null {
  if (look < 1) return null;
  return LOOKS[tileId]?.[Math.min(2, look) - 1] ?? null;
}
