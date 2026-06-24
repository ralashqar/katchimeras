// Isometric projection math for the World system. Pure + dependency-free so the
// renderer (Skia) and the headless verify harness share one source of truth.
// 2:1 dimetric: a tile is twice as wide as it is tall. The grid is logical — the
// ground slab is drawn from these same numbers, so object slots align by
// construction (no per-image calibration). See docs/katchimera-world-design.md.

export const TILE_W = 128;
export const TILE_H = 64;
export const PATCH_SIZE = 4;
export const SLAB_THICKNESS = 46;

export type IsoPoint = { x: number; y: number };

// Centre of cell (col,row) in a patch-local frame whose origin is the patch's
// top corner. (col-row) drives the horizontal fan; (col+row+1) the vertical.
export function cellCenter(col: number, row: number): IsoPoint {
  return { x: (col - row) * (TILE_W / 2), y: (col + row + 1) * (TILE_H / 2) };
}

// Inverse of cellCenter: a patch-local point → its (fractional) cell col/row.
// Round + clamp to land on the nearest tile when hit-testing taps.
export function cellFromPoint(x: number, y: number): { col: number; row: number } {
  const a = x / (TILE_W / 2); // col - row
  const b = y / (TILE_H / 2) - 1; // col + row
  return { col: (a + b) / 2, row: (b - a) / 2 };
}

// A grid-corner (not cell-centre) — corners run 0..size on each axis.
export function gridCorner(c: number, r: number): IsoPoint {
  return { x: (c - r) * (TILE_W / 2), y: (c + r) * (TILE_H / 2) };
}

// The four screen corners of a patch's top face (a diamond), patch-local:
// [top, right, bottom, left].
export function patchTopCorners(size: number = PATCH_SIZE): IsoPoint[] {
  return [gridCorner(0, 0), gridCorner(size, 0), gridCorner(size, size), gridCorner(0, size)];
}

// Painter's order key: lower (col+row) draws first (further back). Objects that
// span 2 tiles anchor on their front-most cell, so callers pass that cell.
export function drawDepth(col: number, row: number): number {
  return col + row;
}

const PATCH_SPAN_X = (PATCH_SIZE * TILE_W) / 2; // 256 — half the diorama width
const PATCH_SPAN_Y = (PATCH_SIZE * TILE_H) / 2; // 128 — half the diorama height
const PATCH_GAP_X = 44;
const PATCH_GAP_Y = 30;

// World-space origin (top corner) for a patch placed at (gridCol,gridRow). Lays
// the dioramas out along the same iso axes so they read as plots on a shelf.
export function patchWorldOrigin(gridCol: number, gridRow: number): IsoPoint {
  return {
    x: (gridCol - gridRow) * (PATCH_SPAN_X + PATCH_GAP_X),
    y: (gridCol + gridRow) * (PATCH_SPAN_Y + PATCH_GAP_Y),
  };
}

// Deterministic outward spiral over patch-grid cells: 0 → origin, then ring by
// ring. Keeps the growing world a pleasing cluster instead of a long line.
export function spiralCoord(index: number): { gridCol: number; gridRow: number } {
  if (index <= 0) return { gridCol: 0, gridRow: 0 };
  let x = 0;
  let y = 0;
  let dx = 1;
  let dy = 0;
  let segment = 1;
  let stepsInSegment = 0;
  let segmentsAtLength = 0;
  for (let i = 0; i < index; i += 1) {
    x += dx;
    y += dy;
    stepsInSegment += 1;
    if (stepsInSegment === segment) {
      stepsInSegment = 0;
      // rotate direction 90°: (dx,dy) -> (-dy,dx)
      const ndx = -dy;
      const ndy = dx;
      dx = ndx;
      dy = ndy;
      segmentsAtLength += 1;
      if (segmentsAtLength === 2) {
        segmentsAtLength = 0;
        segment += 1;
      }
    }
  }
  return { gridCol: x, gridRow: y };
}
