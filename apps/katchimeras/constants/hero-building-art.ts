import type { HatchableTileArt } from '@/types/hatchable-companion';

/**
 * A hero building's tile as it grows (`constants/hero-buildings.ts`), by art slot (`heroTileSlot`): slot 0 is the
 * tile's own art, slots 1-3 the building's three looks. A slot with null keeps the tile's own art (the Lodge's first
 * look is Steppling's trailhead, which already has its hut). The looks come from the shared-world hex pipeline
 * (`art-source/katchimeras/shared-world-discovery-v2`, briefs `steppling-lodge-2/3`, `bloom-house-1/2/3` and `fern-thicket-1/2/3`), each
 * with its generated bounds key.
 */
type TileLook = { art: () => HatchableTileArt; alphaBoundsKey: string };

const LOOKS: Readonly<Record<string, readonly [TileLook | null, TileLook | null, TileLook | null]>> = {
  'steppling-home': [
    null,
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
  'bloom-garden': [
    {
      alphaBoundsKey: 'shared_world_bloom_house_1_hex_tile_v1.webp',
      art: () => ({
        full: require('@incubator/art-world/hex/shared_world_bloom_house_1_hex_tile_v1.webp'),
        medium: require('@incubator/art-world/hex/shared_world_bloom_house_1_hex_tile_v1_512.webp'),
        thumb: require('@incubator/art-world/hex/shared_world_bloom_house_1_hex_tile_v1_256.webp'),
      }),
    },
    {
      alphaBoundsKey: 'shared_world_bloom_house_2_hex_tile_v1.webp',
      art: () => ({
        full: require('@incubator/art-world/hex/shared_world_bloom_house_2_hex_tile_v1.webp'),
        medium: require('@incubator/art-world/hex/shared_world_bloom_house_2_hex_tile_v1_512.webp'),
        thumb: require('@incubator/art-world/hex/shared_world_bloom_house_2_hex_tile_v1_256.webp'),
      }),
    },
    {
      alphaBoundsKey: 'shared_world_bloom_house_3_hex_tile_v1.webp',
      art: () => ({
        full: require('@incubator/art-world/hex/shared_world_bloom_house_3_hex_tile_v1.webp'),
        medium: require('@incubator/art-world/hex/shared_world_bloom_house_3_hex_tile_v1_512.webp'),
        thumb: require('@incubator/art-world/hex/shared_world_bloom_house_3_hex_tile_v1_256.webp'),
      }),
    },
  ],
  'wildgrowth-grove': [
    {
      alphaBoundsKey: 'shared_world_fern_thicket_1_hex_tile_v1.webp',
      art: () => ({
        full: require('@incubator/art-world/hex/shared_world_fern_thicket_1_hex_tile_v1.webp'),
        medium: require('@incubator/art-world/hex/shared_world_fern_thicket_1_hex_tile_v1_512.webp'),
        thumb: require('@incubator/art-world/hex/shared_world_fern_thicket_1_hex_tile_v1_256.webp'),
      }),
    },
    {
      alphaBoundsKey: 'shared_world_fern_thicket_2_hex_tile_v1.webp',
      art: () => ({
        full: require('@incubator/art-world/hex/shared_world_fern_thicket_2_hex_tile_v1.webp'),
        medium: require('@incubator/art-world/hex/shared_world_fern_thicket_2_hex_tile_v1_512.webp'),
        thumb: require('@incubator/art-world/hex/shared_world_fern_thicket_2_hex_tile_v1_256.webp'),
      }),
    },
    {
      alphaBoundsKey: 'shared_world_fern_thicket_3_hex_tile_v1.webp',
      art: () => ({
        full: require('@incubator/art-world/hex/shared_world_fern_thicket_3_hex_tile_v1.webp'),
        medium: require('@incubator/art-world/hex/shared_world_fern_thicket_3_hex_tile_v1_512.webp'),
        thumb: require('@incubator/art-world/hex/shared_world_fern_thicket_3_hex_tile_v1_256.webp'),
      }),
    },
  ],
};

/** A tile's art at a hero building's art slot (1-3), or null for its own art (slot 0, a null slot, or a tile with no looks). */
export function heroTileLook(tileId: string, slot: number): TileLook | null {
  if (slot < 1) return null;
  return LOOKS[tileId]?.[Math.min(3, slot) - 1] ?? null;
}
