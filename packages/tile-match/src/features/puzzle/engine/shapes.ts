/**
 * The shape catalogue.
 *
 * Tuned for an 8x5 board, which behaves very differently from the classic 8x8:
 * with only 5 rows and 40 cells, bulky pieces deadlock the board fast. Three
 * rules keep it playable:
 *
 *  1. No rotation taller than `MAX_SHAPE_HEIGHT` (3). A 4-tall vertical line
 *     would need an almost-empty column and leave a single dead cell behind,
 *     and a 3x3 block eats 22% of the board in one placement.
 *  2. Exception: a line exactly as tall as the board is always allowed. It only
 *     fits a completely empty column, and placing it clears that column on the
 *     spot — so unlike a 4-tall line it can never leave the board worse than it
 *     found it. It is the one piece that is guaranteed self-clearing.
 *  3. Nothing wider than the board.
 *
 * Filtering happens after rotations are generated, so `line-4` keeps its
 * horizontal form and loses its vertical one. That biases play toward
 * horizontal lines — which is exactly right, because a row is worth more speed
 * than a column.
 *
 * There is deliberately no single-cell piece. A 1x1 trivialises the board: it
 * always fits, so it removes the placement problem entirely and turns a tight
 * spot into a free move. The smallest piece is the domino.
 */

import { cellsExtent, normaliseCells, rotateCells } from './board';
import type { BoardSpec, Cell, Rotation, Shape, ShapeRole } from './types';

/** Tallest rotation allowed, in rows. Keeps 2 rows of slack on a 5-row board. */
export const MAX_SHAPE_HEIGHT = 3;

const at = (...coordinates: [number, number][]): Cell[] =>
  coordinates.map(([row, column]) => ({ row, column }));

type ShapeFamily = {
  id: string;
  cells: Cell[];
  /** Relative frequency across the whole pool, independent of rotation count. */
  weight: number;
  role: ShapeRole;
};

/**
 * Weights lean small: on a short board the player needs a steady supply of
 * gap-fillers, and big pieces are the ones that cause jams.
 */
export const SHAPE_FAMILIES: readonly ShapeFamily[] = [
  { id: 'domino', cells: at([0, 0], [0, 1]), weight: 7, role: 'rescue' },
  { id: 'line-3', cells: at([0, 0], [0, 1], [0, 2]), weight: 6, role: 'rescue' },
  { id: 'corner-3', cells: at([0, 0], [1, 0], [1, 1]), weight: 5, role: 'rescue' },
  { id: 'square-2', cells: at([0, 0], [0, 1], [1, 0], [1, 1]), weight: 5, role: 'standard' },
  { id: 'line-4', cells: at([0, 0], [0, 1], [0, 2], [0, 3]), weight: 4, role: 'standard' },
  { id: 't-4', cells: at([0, 0], [0, 1], [0, 2], [1, 1]), weight: 3, role: 'standard' },
  { id: 's-4', cells: at([0, 1], [0, 2], [1, 0], [1, 1]), weight: 2, role: 'standard' },
  { id: 'z-4', cells: at([0, 0], [0, 1], [1, 1], [1, 2]), weight: 2, role: 'standard' },
  /**
   * The L tetromino and its mirror.
   *
   * These were simply missing — an omission rather than a decision, and the giveaway is that `s-4` and
   * `z-4` are both here. S and Z are a chiral pair for exactly the same reason L and J are, so keeping
   * one pair and dropping the other cannot have been deliberate. Their absence left a conspicuous hole
   * in the silhouette vocabulary: `corner-3` is the only elbow in the catalogue, so every bend the
   * player ever saw was the same small one.
   *
   * They earn their place in the slot field on geometry as well. The 3x2 rotations fit the tall narrow
   * flank zones and the 2x3 rotations fit the wide shallow bottom one, so an L reads differently
   * depending on which slot it is dealt for — which is the character the zone extents were meant to
   * give the field in the first place.
   *
   * Weighted like S and Z: present, not common.
   */
  { id: 'l-4', cells: at([0, 0], [1, 0], [2, 0], [2, 1]), weight: 2, role: 'standard' },
  { id: 'j-4', cells: at([0, 1], [1, 1], [2, 0], [2, 1]), weight: 2, role: 'standard' },
  { id: 'line-5', cells: at([0, 0], [0, 1], [0, 2], [0, 3], [0, 4]), weight: 2, role: 'standard' },
  {
    id: 'rectangle-2x3',
    cells: at([0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]),
    weight: 2,
    role: 'standard',
  },
];

/** Distinct rotations of a shape, deduped by cell signature. */
function uniqueRotations(cells: readonly Cell[]): { rotation: Rotation; cells: Cell[] }[] {
  const seen = new Set<string>();
  const results: { rotation: Rotation; cells: Cell[] }[] = [];
  for (const rotation of [0, 1, 2, 3] as const) {
    const rotated = rotateCells(cells, rotation);
    const key = rotated.map((cell) => `${cell.row},${cell.column}`).join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({ rotation, cells: rotated });
  }
  return results;
}

/**
 * Expand families into concrete shapes that fit `spec`.
 *
 * A family's total weight is preserved across its surviving rotations, so
 * dropping the vertical form of `line-4` makes the horizontal form twice as
 * likely rather than making the family half as common.
 */
export function buildShapePool(spec: BoardSpec, maxHeight = MAX_SHAPE_HEIGHT): Shape[] {
  const pool: Shape[] = [];
  const heightLimit = Math.min(maxHeight, spec.rows);

  for (const family of SHAPE_FAMILIES) {
    const rotations = uniqueRotations(normaliseCells(family.cells)).filter((rotation) => {
      const { height, width } = cellsExtent(rotation.cells);
      if (width > spec.cols) return false;
      // A full-height line is self-clearing, so it escapes the height limit.
      if (width === 1 && height === spec.rows) return true;
      return height <= heightLimit;
    });
    if (rotations.length === 0) continue;

    for (const rotation of rotations) {
      const { height, width } = cellsExtent(rotation.cells);
      pool.push({
        id: rotations.length === 1 ? family.id : `${family.id}-r${rotation.rotation}`,
        familyId: family.id,
        rotation: rotation.rotation,
        cells: rotation.cells,
        height,
        width,
        weight: family.weight / rotations.length,
        role: family.role,
      });
    }
  }

  return pool;
}

/** Smallest-first, for the rescue path when the board is nearly full. */
export const shapeCellCount = (shape: Shape): number => shape.cells.length;
