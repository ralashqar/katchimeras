// Hex-grid projection for the Kingdom map. This is intentionally separate from
// utils/world-iso.ts so older day/world surfaces keep their diamond math.

export type HexCoord = { q: number; r: number };
export type HexPoint = { x: number; y: number };

// Canonical guide size for generated tile art. The rendered top face is a
// regular flat-top hex with one orthographic y-scale tilt, matching
// design/hex-tile-clean-flat-regular-projected-widthfit-1024.png.
export const HEX_TILE_W = 490;
export const HEX_TILE_TILT = 0.7;
export const HEX_TILE_H = HEX_TILE_W * (Math.sqrt(3) / 2) * HEX_TILE_TILT;
export const HEX_TILE_LIP = HEX_TILE_W * 0.0975;
export const HEX_TILE_SPACING = 1.08;
export const HEX_TILE_ART_Y_SPACING = 1.12;

// Axial neighbour steps. Order starts east and walks counter-clockwise; the
// ring helper below starts at south-west so ring traversal is stable and compact.
export const HEX_DIRECTIONS: readonly HexCoord[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export function hexAdd(a: HexCoord, b: HexCoord): HexCoord {
  return { q: a.q + b.q, r: a.r + b.r };
}

export function hexScale(a: HexCoord, scale: number): HexCoord {
  return { q: a.q * scale, r: a.r * scale };
}

// Centre-to-centre screen projection for a flat-top axial hex grid. This is the
// same regular-hex projection used by the tile guide: first regular flat-top
// hex math, then one y-scale tilt.
export function hexToWorld(hex: HexCoord): HexPoint {
  return {
    x: HEX_TILE_W * 0.75 * HEX_TILE_SPACING * hex.q,
    y: HEX_TILE_H * HEX_TILE_SPACING * HEX_TILE_ART_Y_SPACING * (hex.r + hex.q / 2),
  };
}

export function hexRing(radius: number): HexCoord[] {
  if (radius <= 0) return [{ q: 0, r: 0 }];
  const out: HexCoord[] = [];
  let cursor = hexAdd({ q: 0, r: 0 }, hexScale(HEX_DIRECTIONS[4], radius));
  for (let side = 0; side < 6; side += 1) {
    const direction = HEX_DIRECTIONS[side];
    for (let step = 0; step < radius; step += 1) {
      out.push(cursor);
      cursor = hexAdd(cursor, direction);
    }
  }
  return out;
}

export function hexSpiral(count: number, includeCenter = false): HexCoord[] {
  const out: HexCoord[] = includeCenter ? [{ q: 0, r: 0 }] : [];
  let radius = includeCenter ? 1 : 1;
  while (out.length < count) {
    for (const coord of hexRing(radius)) {
      out.push(coord);
      if (out.length >= count) break;
    }
    radius += 1;
  }
  return out;
}

export function hexTileTopPoints(cx: number, cy: number, scale = 1): HexPoint[] {
  const w = HEX_TILE_W * scale;
  const radius = w / 2;
  const y = Math.sin(Math.PI / 3) * radius * HEX_TILE_TILT;
  return [
    { x: cx + radius, y: cy },
    { x: cx + radius / 2, y: cy + y },
    { x: cx - radius / 2, y: cy + y },
    { x: cx - radius, y: cy },
    { x: cx - radius / 2, y: cy - y },
    { x: cx + radius / 2, y: cy - y },
  ];
}

// Old decor storage uses patch cells. The hex map treats those as a small local
// coordinate field inside each tile so legacy planted objects still have a place.
export function hexLocalToWorld(col: number, row: number): HexPoint {
  return {
    x: ((col - 1.5) / 3) * HEX_TILE_W * 0.72,
    y: ((row - 1.5) / 3) * HEX_TILE_H * 0.76 + HEX_TILE_H * 0.08,
  };
}

export function worldToHexLocal(x: number, y: number): { col: number; row: number } {
  return {
    col: 1.5 + (x / (HEX_TILE_W * 0.72)) * 3,
    row: 1.5 + ((y - HEX_TILE_H * 0.08) / (HEX_TILE_H * 0.76)) * 3,
  };
}

export function clampHexLocal(value: { col: number; row: number }): { col: number; row: number } {
  return {
    col: Math.max(0.1, Math.min(2.9, value.col)),
    row: Math.max(0.1, Math.min(2.9, value.row)),
  };
}

export function hexDrawDepth(point: HexPoint, localY = 0): number {
  return point.y * 10 + localY;
}
