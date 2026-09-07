/**
 * Pixel-space drop targeting for the slot field, and the accuracy it produces.
 *
 * ## What changed from the board, and why it had to
 *
 * `snap.ts` — which this replaces — had two forgiveness mechanisms: a capture margin so a piece
 * hovering slightly off the board still counted, and a **local search** that walked outward from
 * the geometric target to find the closest origin the piece actually fitted. That search is what
 * made the board feel generous, and it is exactly why accuracy could not be measured there: by the
 * time a drop reached the reducer it had already been corrected to somewhere legal, so every
 * placement looked equally deliberate.
 *
 * The capture margin stays, because rejecting a drop that is merely near the field is not
 * forgiveness, it is the difference between "you missed" and "you weren't playing". The search is
 * gone. A drop quantises to the nearest cell origin and lands there, right or wrong.
 *
 * ## Attribution, not validation
 *
 * There is no `canPlace` check on the way in. A piece may be dropped overlapping another group's
 * footprint, half off the field, or on empty space — all of those are legal moves that simply score
 * badly. `scorePlacement` then asks two separate questions: which group did this drop mean, and how
 * much of it landed. Splitting those is what lets a near-miss fill part of a footprint instead of
 * being rejected outright.
 */

// Pure module — `.ts` extension imports so it runs under `node --test`.
import { boardIndex, cellsExtent } from './board';
import type { SlotGroup } from './slot-types';
import type { BoardSpec, Cell } from './types';

export type Point = { x: number; y: number };

/**
 * How far outside the field, in cell pitches, a piece may float and still be captured.
 *
 * Carried over from the board's 1.2 and for the same reason: the field is short, so aiming at its
 * top row from a tray below means routinely overshooting the top edge, and dropping the hover there
 * feels broken. Note this only decides whether a drop is *aimed at the field at all* — it does not
 * move the drop, so it costs nothing in accuracy.
 */
export const SLOT_CAPTURE_MARGIN = 1.2;

/**
 * Where the field is on screen. Constant for the whole of a drag.
 *
 * Split out from `resolveSlotDrop` so the hot path can be a worklet — see `resolveDropCell`. Plain
 * numbers only, no nested objects, because this is captured by a worklet and read on the UI thread
 * every gesture frame.
 */
export type DropFrame = {
  /** Screen-space centre of field cell (0, 0). */
  anchorX: number;
  anchorY: number;
  /** cell + gap, in pixels. */
  pitch: number;
  rows: number;
  cols: number;
  /** How far outside the field, in cell pitches, a piece may float and still be captured. */
  captureMargin: number;
};

/**
 * The dragged piece's own geometry, in cells. Constant for the whole of a drag.
 *
 * Precomputed rather than derived per frame: `cellsExtent` walks the cell list and allocates, and the
 * answer cannot change while one piece is in the air.
 */
export type DropFootprint = {
  /** Offset from the footprint's origin to its centre, in cells. */
  centerRow: number;
  centerColumn: number;
  /** Largest origin that keeps the footprint on the field. */
  maxRow: number;
  maxColumn: number;
};

export function dropFootprintFor(grid: BoardSpec, cells: readonly Cell[]): DropFootprint {
  const { height, width } = cellsExtent(cells);
  return {
    // Cells are normalised to min 0, so the footprint's centre is just its extent.
    centerRow: (height - 1) / 2,
    centerColumn: (width - 1) / 2,
    maxRow: grid.rows - height,
    maxColumn: grid.cols - width,
  };
}

/** Returned by `resolveDropCell` when the piece is nowhere near the field. */
export const NO_CELL = -1;

/**
 * Everything about one release, handed from the gesture to the screen.
 *
 * Reported for **every** release, `NO_CELL` included. The tray used to swallow those, which quietly made a
 * drop outside the field a free retry: the piece sprang home and nothing was spent. It costs the piece
 * now, and this type is what the screen needs to act on that.
 *
 * Two positions, because they answer two different questions and the drag deliberately separates them —
 * the piece rides `fingerLift` points above the finger so the hand does not cover the thing being aimed.
 */
export type DropRelease = {
  /** Packed field origin, or `NO_CELL` if the piece was not aimed at the field at all. */
  cellIndex: number;
  /**
   * The piece footprint's centre, in window coordinates.
   *
   * Where a failed piece comes apart. The player was watching the piece, so anywhere else reads as a
   * second object appearing rather than as the one they dropped falling.
   */
  centerX: number;
  centerY: number;
  /**
   * The finger, in window coordinates.
   *
   * What decides a cancel. The screen owns that call because it depends on where the tray is, and the
   * *finger* is the honest test — the piece is lifted clear of it, so testing the piece against the tray
   * would make the cancel gesture unreachable.
   */
  fingerX: number;
  fingerY: number;
};

/**
 * Quantise a floating piece's centre to a packed field cell index, **on the UI thread**.
 *
 * This is the hot path: it runs once per gesture frame per finger. Three properties earn it its own
 * function rather than being folded into `resolveSlotDrop`:
 *
 *  - **It is a worklet.** The drag used to run its whole gesture on the JS thread, which is also the
 *    thread `RaceScene` renders the car and the road on — so every frame of every drag was competing
 *    with the 3D render, and two fingers doubled it. `snap.ts` predicted this from the start: "this
 *    can live in the pure engine and later be marked `'worklet'` to run on the UI thread."
 *  - **It allocates nothing.** Scalars in, a scalar out. The `{ row, column }` object it replaces was
 *    garbage generated sixty times a second per finger.
 *  - **It returns a packed index**, so the caller can compare it against a shared value with one
 *    integer comparison and only cross to JS when the answer has genuinely changed.
 *
 * Packed as `row * cols + column`, which is `boardIndex`'s own encoding — so the result drops straight
 * into `cellFromIndex` without a second convention to keep in step.
 */
export function resolveDropCell(
  frame: DropFrame,
  footprint: DropFootprint,
  centerX: number,
  centerY: number,
): number {
  'worklet';
  const { anchorX, anchorY, pitch, rows, cols, captureMargin } = frame;
  const { centerRow, centerColumn, maxRow, maxColumn } = footprint;

  if (pitch <= 0) return NO_CELL;
  // A piece too big for the field cannot be dropped on it at all. Unreachable while the dealer builds
  // the field's own pool, but this module is given arbitrary cells by its tests.
  if (maxRow < 0 || maxColumn < 0) return NO_CELL;

  // Reject early if the piece's bounding box is clear of the field entirely.
  const capturePadding = (0.5 + captureMargin) * pitch;
  const lastCellCenterX = anchorX + (cols - 1) * pitch;
  const lastCellCenterY = anchorY + (rows - 1) * pitch;

  if (
    centerX + centerColumn * pitch < anchorX - capturePadding ||
    centerX - centerColumn * pitch > lastCellCenterX + capturePadding ||
    centerY + centerRow * pitch < anchorY - capturePadding ||
    centerY - centerRow * pitch > lastCellCenterY + capturePadding
  ) {
    return NO_CELL;
  }

  const rawRow = (centerY - anchorY) / pitch - centerRow;
  const rawColumn = (centerX - anchorX) / pitch - centerColumn;

  const row = Math.max(0, Math.min(maxRow, Math.round(rawRow)));
  const column = Math.max(0, Math.min(maxColumn, Math.round(rawColumn)));
  return row * cols + column;
}

/**
 * Quantise a floating piece's centre to a field origin.
 *
 * The convenience form of `resolveDropCell`, for callers on the JS thread — the drop handler and the
 * tests. Identical arithmetic by construction, because it delegates rather than repeating it.
 *
 * @param floatingCenter  screen-space centre of the dragged piece's footprint
 * @param firstCellCenter screen-space centre of field cell (0, 0)
 * @param pitch           cell size + gap, in pixels
 * @returns the origin to drop at, or `null` when the piece is nowhere near the field
 *
 * The origin is clamped so the footprint always lies inside the field. That is not forgiveness
 * either — an origin that hung off the edge would silently discard the overhanging cells, which is
 * the same outcome as clamping but harder to reason about, and it would let a piece score from a
 * position it was never really at.
 */
export function resolveSlotDrop(
  grid: BoardSpec,
  cells: readonly Cell[],
  floatingCenter: Point,
  firstCellCenter: Point,
  pitch: number,
  captureMargin = SLOT_CAPTURE_MARGIN,
): Cell | null {
  if (cells.length === 0 || pitch <= 0) return null;

  const index = resolveDropCell(
    {
      anchorX: firstCellCenter.x,
      anchorY: firstCellCenter.y,
      pitch,
      rows: grid.rows,
      cols: grid.cols,
      captureMargin,
    },
    dropFootprintFor(grid, cells),
    floatingCenter.x,
    floatingCenter.y,
  );

  if (index === NO_CELL) return null;
  return { row: Math.floor(index / grid.cols), column: index % grid.cols };
}

export type PlacementScore = {
  /** The group this drop is attributed to, or null if it touched none of them. */
  groupId: string | null;
  /**
   * Every field index the piece occupied, clipped to the grid.
   *
   * Returned so the caller can derive the cells that were *wasted* — `dropped` minus `filled` — without
   * repeating the offset-and-clip arithmetic and risking the two disagreeing about which cells the
   * piece covered.
   */
  dropped: number[];
  /** Field indices that landed on an unfilled target cell of that group. */
  filled: number[];
  /** `filled.length / cells.length`, so a piece fully on target scores 1. */
  coverage: number;
  /**
   * Chebyshev distance from the attributed group's origin, in cells.
   *
   * Chebyshev rather than Euclidean because a cell diagonally adjacent is one cell wrong in the way
   * a player experiences it, not 1.41. `Infinity` when no group was touched, so a total miss can
   * never be mistaken for an exact one.
   */
  offset: number;
};

/**
 * Score a drop against the beat's footprints.
 *
 * Attribution is by **overlap count**, so the player is never required to place in a particular
 * order: drop any piece anywhere and it counts toward whichever footprint it mostly covers. Ties go
 * to the earlier group, which keeps the result deterministic.
 *
 * Only cells that land on a target cell that is still *unfilled* count. Two consequences worth
 * being deliberate about: a piece cannot score twice for the same cell, and a second piece dropped
 * on top of a completed footprint scores nothing rather than stealing its credit.
 */
export function scorePlacement(
  grid: BoardSpec,
  groups: readonly SlotGroup[],
  cells: readonly Cell[],
  origin: Cell,
): PlacementScore {
  const dropped = new Set<number>();
  for (const cell of cells) {
    const row = origin.row + cell.row;
    const column = origin.column + cell.column;
    // Clipped rather than wrapped. `resolveSlotDrop` clamps the origin so this cannot normally
    // fire, but a caller passing an arbitrary origin must not be able to fabricate an index that
    // aliases onto the far side of the field.
    if (row < 0 || row >= grid.rows || column < 0 || column >= grid.cols) continue;
    dropped.add(boardIndex(grid, row, column));
  }

  let bestGroup: SlotGroup | null = null;
  let bestFilled: number[] = [];

  for (const group of groups) {
    const alreadyFilled = new Set(group.filled);
    const hits: number[] = [];
    for (const index of group.cells) {
      if (alreadyFilled.has(index)) continue;
      if (dropped.has(index)) hits.push(index);
    }
    // Strictly greater, so a tie keeps the earlier group and the result is stable.
    if (hits.length > bestFilled.length) {
      bestGroup = group;
      bestFilled = hits;
    }
  }

  const droppedCells = [...dropped];

  if (!bestGroup || bestFilled.length === 0) {
    return {
      groupId: null,
      dropped: droppedCells,
      filled: [],
      coverage: 0,
      offset: Number.POSITIVE_INFINITY,
    };
  }

  return {
    groupId: bestGroup.id,
    dropped: droppedCells,
    filled: bestFilled,
    coverage: cells.length === 0 ? 0 : bestFilled.length / cells.length,
    offset: Math.max(
      Math.abs(origin.row - bestGroup.origin.row),
      Math.abs(origin.column - bestGroup.origin.column),
    ),
  };
}
