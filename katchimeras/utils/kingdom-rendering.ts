import { KINGDOM_RENDERING } from '@/constants/kingdom-rendering';
import {
  HEX_TILE_H,
  HEX_TILE_LIP,
  HEX_TILE_W,
  hexSpiral,
  hexToWorld,
  type KingdomHexLayoutProfileId,
} from '@/utils/world-hex';
import type { KingdomHexTileLod } from '@/utils/world-visuals';

export type KingdomCameraSnapshot = {
  tx: number;
  ty: number;
  scale: number;
};

export type KingdomRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type KingdomSize = {
  width: number;
  height: number;
};

export type KingdomResidentLod = 'thumb' | 'medium';

export type KingdomWorldViewPlacement = {
  horizontalOffsetHexTileWidth: number;
  verticalOffsetHexTileHeight: number;
};

export type KingdomFocusTarget = { id: string; x: number; y: number };

export function nearestKingdomFocusTarget(
  point: { x: number; y: number },
  targets: readonly KingdomFocusTarget[]
): KingdomFocusTarget | null {
  let nearest: KingdomFocusTarget | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const target of targets) {
    const distance = (target.x - point.x) ** 2 + (target.y - point.y) ** 2;
    if (distance < nearestDistance) {
      nearest = target;
      nearestDistance = distance;
    }
  }
  return nearest;
}

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
  layoutProfile: KingdomHexLayoutProfileId = 'separated-v1'
) {
  const capacity = Math.max(KINGDOM_RENDERING.sceneResidentCapacity, residentCount);
  const coords = [{ q: 0, r: 0 }, ...hexSpiral(capacity, false)];
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

export function frameToRect(frame: { left: number; top: number; width: number; height: number }): KingdomRect {
  return {
    left: frame.left,
    top: frame.top,
    right: frame.left + frame.width,
    bottom: frame.top + frame.height,
  };
}

export function rectsIntersect(a: KingdomRect, b: KingdomRect): boolean {
  return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
}

export function visibleWorldRect(
  viewport: KingdomSize,
  scene: KingdomSize,
  camera: KingdomCameraSnapshot,
  screenPadding = 0
): KingdomRect | null {
  if (!viewport.width || !viewport.height || camera.scale <= 0) return null;

  const toWorldX = (screenX: number) => (screenX - scene.width / 2 - camera.tx) / camera.scale + scene.width / 2;
  const toWorldY = (screenY: number) => (screenY - scene.height / 2 - camera.ty) / camera.scale + scene.height / 2;

  return {
    left: toWorldX(-screenPadding),
    top: toWorldY(-screenPadding),
    right: toWorldX(viewport.width + screenPadding),
    bottom: toWorldY(viewport.height + screenPadding),
  };
}

export function screenPointToWorld(
  point: { x: number; y: number },
  scene: KingdomSize,
  camera: KingdomCameraSnapshot
): { x: number; y: number } {
  return {
    x: (point.x - scene.width / 2 - camera.tx) / camera.scale + scene.width / 2,
    y: (point.y - scene.height / 2 - camera.ty) / camera.scale + scene.height / 2,
  };
}

export function cameraTranslationBounds(viewport: KingdomSize, scene: KingdomSize, scale: number) {
  const scaledWidth = scene.width * scale;
  const scaledHeight = scene.height * scale;
  const centeredTx = viewport.width / 2 - scene.width / 2;
  const centeredTy = viewport.height / 2 - scene.height / 2;

  const x =
    scaledWidth <= viewport.width
      ? ([centeredTx, centeredTx] as const)
      : ([viewport.width - scene.width / 2 - scaledWidth / 2, scaledWidth / 2 - scene.width / 2] as const);
  const y =
    scaledHeight <= viewport.height
      ? ([centeredTy, centeredTy] as const)
      : ([viewport.height - scene.height / 2 - scaledHeight / 2, scaledHeight / 2 - scene.height / 2] as const);

  return { x, y };
}

export function clampCameraTranslation(
  translation: { tx: number; ty: number },
  viewport: KingdomSize,
  scene: KingdomSize,
  scale: number
): { tx: number; ty: number } {
  const bounds = cameraTranslationBounds(viewport, scene, scale);
  return {
    tx: Math.min(bounds.x[1], Math.max(bounds.x[0], translation.tx)),
    ty: Math.min(bounds.y[1], Math.max(bounds.y[0], translation.ty)),
  };
}

export function kingdomCameraSnapshotForTarget(
  viewport: KingdomSize,
  scene: KingdomSize,
  target: { x: number; y: number },
  scale: number,
  screenPoint: { x: number; y: number } = {
    x: viewport.width / 2,
    y: viewport.height / 2,
  },
): KingdomCameraSnapshot {
  const translation = clampCameraTranslation(
    {
      tx: screenPoint.x - scene.width / 2 - (target.x - scene.width / 2) * scale,
      ty: screenPoint.y - scene.height / 2 - (target.y - scene.height / 2) * scale,
    },
    viewport,
    scene,
    scale,
  );
  return { ...translation, scale };
}

export function tileLodWithHysteresis(current: KingdomHexTileLod | null, screenWidth: number): KingdomHexTileLod {
  const thresholds = KINGDOM_RENDERING.tileLod;

  if (!current) {
    if (screenWidth > thresholds.fullUpScreenPoints) return 'full';
    if (screenWidth > thresholds.mediumUpScreenPoints) return 'medium';
    return 'thumb';
  }

  if (current === 'thumb') {
    return screenWidth > thresholds.mediumUpScreenPoints ? 'medium' : 'thumb';
  }
  if (current === 'medium') {
    if (screenWidth > thresholds.fullUpScreenPoints) return 'full';
    if (screenWidth < thresholds.mediumDownScreenPoints) return 'thumb';
    return 'medium';
  }
  return screenWidth < thresholds.fullDownScreenPoints ? 'medium' : 'full';
}

export function residentLodWithHysteresis(current: KingdomResidentLod, screenSize: number): KingdomResidentLod {
  const thresholds = KINGDOM_RENDERING.residentLod;
  if (current === 'thumb') {
    return screenSize > thresholds.mediumUpScreenPoints ? 'medium' : 'thumb';
  }
  return screenSize < thresholds.mediumDownScreenPoints ? 'thumb' : 'medium';
}
