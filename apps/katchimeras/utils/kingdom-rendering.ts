import type { KingdomWorldViewPlacement } from '@incubator/environments/hex-camera-math';
import { KINGDOM_RENDERING } from '@/constants/kingdom-rendering';
import {
  HEX_TILE_H,
  HEX_TILE_LIP,
  HEX_TILE_W,
  hexSpiral,
  hexToWorld,
  type KingdomHexLayoutProfileId,
} from '@/utils/world-hex';

export function kingdomWorldViewPoint(
  center: { x: number; y: number },
  placement: KingdomWorldViewPlacement
): { x: number; y: number } {
  return {
    x: center.x + HEX_TILE_W * placement.horizontalOffsetHexTileWidth,
    y: center.y + HEX_TILE_H * placement.verticalOffsetHexTileHeight,
  };
}

export function kingdomSceneMetrics(
  residentCount: number,
  layoutProfile: KingdomHexLayoutProfileId = 'separated-v1',
  extraCoords: readonly { q: number; r: number }[] = [],
) {
  const capacity = Math.max(KINGDOM_RENDERING.sceneResidentCapacity, residentCount);
  const coords = [{ q: 0, r: 0 }, ...hexSpiral(capacity, false), ...extraCoords];
  let halfWidth = HEX_TILE_W / 2;
  let halfHeight = HEX_TILE_H / 2 + HEX_TILE_LIP;

  for (const coord of coords) {
    const point = hexToWorld(coord, layoutProfile);
    halfWidth = Math.max(halfWidth, Math.abs(point.x - HEX_TILE_W / 2), Math.abs(point.x + HEX_TILE_W / 2));
    halfHeight = Math.max(
      halfHeight,
      Math.abs(point.y - HEX_TILE_H / 2),
      Math.abs(point.y + HEX_TILE_H / 2 + HEX_TILE_LIP)
    );
  }

  const centerX = Math.ceil(halfWidth + KINGDOM_RENDERING.sceneEdgePaddingWorld);
  const centerY = Math.ceil(halfHeight + KINGDOM_RENDERING.sceneEdgePaddingWorld);
  return { centerX, centerY, width: centerX * 2, height: centerY * 2 };
}


export * from '@incubator/environments/hex-camera-math';
