import { cellCenter, cellFromPoint, PATCH_SIZE, TILE_H, TILE_W } from '@/utils/world-iso';

// Shared calibration for the image-base world patch. The editor authors positions
// as normalized coordinates on the square base image; the app converts those
// normalized seats back into its isometric cell space at render time.
export const IMAGE_BASE_RING = 1;
export const IMAGE_BASE_FACTOR = 2.2;
export const IMAGE_BASE_OFFSET_X = 0;
export const IMAGE_BASE_OFFSET_Y = TILE_H * 0.6;

export const WORLD_EDITOR_BASE_SIZE = 760;
export const WORLD_EDITOR_CELL_SCALE = 1.22;

const SLAB_CENTRE_CELL = { col: 1, row: 1 };
const OBJECT_SEAT_PLUS_DROP = TILE_H * (0.25 + 0.18);

function imageBaseSpan(ring: number): number {
  return (PATCH_SIZE + ring * 2) * TILE_W * IMAGE_BASE_FACTOR;
}

function baseCentreYOffset(): number {
  return (PATCH_SIZE * TILE_H) / 2 - cellCenter(SLAB_CENTRE_CELL.col, SLAB_CENTRE_CELL.row).y + IMAGE_BASE_OFFSET_Y;
}

function editorSeatOffsetCorrection(ring: number): number {
  const editorOffsetAsAppSceneUnits =
    (OBJECT_SEAT_PLUS_DROP * WORLD_EDITOR_CELL_SCALE * imageBaseSpan(ring)) / WORLD_EDITOR_BASE_SIZE;
  return editorOffsetAsAppSceneUnits - OBJECT_SEAT_PLUS_DROP;
}

export function normalisedBaseToCell(nx: number, ny: number, ring: number = IMAGE_BASE_RING): { col: number; row: number } {
  const span = imageBaseSpan(ring);
  const origin = cellCenter(SLAB_CENTRE_CELL.col, SLAB_CENTRE_CELL.row);
  const relativeX = IMAGE_BASE_OFFSET_X - span / 2 + nx * span;
  const relativeY = baseCentreYOffset() - span / 2 + ny * span + editorSeatOffsetCorrection(ring);
  return cellFromPoint(relativeX + origin.x, relativeY + origin.y);
}

export function cellToNormalisedBase(col: number, row: number, ring: number = IMAGE_BASE_RING): { nx: number; ny: number } {
  const span = imageBaseSpan(ring);
  const origin = cellCenter(SLAB_CENTRE_CELL.col, SLAB_CENTRE_CELL.row);
  const point = cellCenter(col, row);
  const relativeX = point.x - origin.x;
  const relativeY = point.y - origin.y - editorSeatOffsetCorrection(ring);
  return {
    nx: (relativeX - IMAGE_BASE_OFFSET_X + span / 2) / span,
    ny: (relativeY - baseCentreYOffset() + span / 2) / span,
  };
}

export function editorScaleToAppScale(scale: number, ring: number = IMAGE_BASE_RING): number {
  return scale * WORLD_EDITOR_CELL_SCALE * imageBaseSpan(ring) / WORLD_EDITOR_BASE_SIZE;
}
