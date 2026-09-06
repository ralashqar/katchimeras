import config from '@/constants/kingdom-world-view.json';
import { createHexProjection } from '@incubator/environments/hex';
export type { HexCoord, HexPoint } from '@incubator/environments/hex';
export type KingdomHexLayoutProfileId = keyof typeof config.hexTiles.layoutProfiles;
export const { HEX_TILE_W, HEX_TILE_TILT, HEX_TILE_H, HEX_TILE_LIP, KINGDOM_HEX_LAYOUT_PROFILES, HEX_DIRECTIONS, hexAdd, hexScale, hexToWorld, hexRing, hexSpiral, hexTileTopPoints, hexLocalToWorld, worldToHexLocal, clampHexLocal, hexDrawDepth } = createHexProjection<KingdomHexLayoutProfileId>(config.hexTiles, 'separated-v1');
