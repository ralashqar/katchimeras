import { createHexProjection, type HexCoord } from './hex';
import { kingdomTileArtFrame, type KingdomTileAlphaBounds } from './tile-alignment';
/** Pure placement metadata; safe for save migrations and content tooling. */
export const MOSSPROUT_LAYOUT = {
  layout: { width: 490, projectionTilt: .7, lipWidthRatio: .0975, layoutProfiles: { neighborhood: { horizontalSpacing: 1.02, verticalSpacing: 1.02 } } },
  home: { coord: { q: 0, r: 1 } },
  garden: { coord: { q: 0, r: 2 } },
  gate: { coord: { q: 0, r: 0 } },
} as const;

const projection = createHexProjection(MOSSPROUT_LAYOUT.layout, 'neighborhood');
const REFERENCE_BOUNDS = { left: 43, top: 168, right: 980, bottom: 952 };
export function mossproutHexPoint(coord: HexCoord) {
  const point = projection.hexToWorld(coord);
  return { x: point.x * 1.1, y: point.y * 1.1 };
}
export function mossproutLayerGeometry(coord: HexCoord, assetBounds: KingdomTileAlphaBounds) {
  const point = mossproutHexPoint(coord);
  const points = projection.hexTileTopPoints(point.x, point.y);
  const target = { left: Math.min(...points.map(p => p.x)), right: Math.max(...points.map(p => p.x)),
    top: Math.min(...points.map(p => p.y)), bottom: Math.max(...points.map(p => p.y + projection.HEX_TILE_LIP)) };
  return { frame: kingdomTileArtFrame({ alignmentMode: 'ground-bottom', assetBounds, referenceBounds: REFERENCE_BOUNDS, target }),
    interactionFrame: { left: target.left, top: target.top, width: target.right - target.left, height: target.bottom - target.top } };
}
/** Reserve every art envelope before shifting, so a reveal never moves other tiles. */
export function mossproutSceneEnvelope(frames: readonly { left: number; top: number; width: number; height: number }[]) {
  const left = Math.min(...frames.map(f => f.left)), top = Math.min(...frames.map(f => f.top));
  const right = Math.max(...frames.map(f => f.left + f.width)), bottom = Math.max(...frames.map(f => f.top + f.height));
  return { dx: 96 - left, dy: 96 - top, width: Math.ceil(right - left + 192), height: Math.ceil(bottom - top + 192) };
}
