/**
 * Board geometry in pixels.
 *
 * Dimension-agnostic: it takes a `BoardSpec` and solves a cell grid, which is why the slot field
 * reuses it verbatim rather than having its own copy. `slot-metrics.ts` adds only what is genuinely
 * slot-specific — the cell size range and the burst ordering.
 */

// Pure module — `.ts` extension so it runs under `node --test` too.
import type { BoardSpec } from '../engine/types';

export type BoardMetrics = {
  /** Outer chrome bezel size. */
  width: number;
  height: number;
  /** Padding between the bezel edge and the first cell. */
  outer: number;
  gap: number;
  cell: number;
  /** cell + gap — the distance between adjacent cell origins. */
  pitch: number;
  rows: number;
  cols: number;
};

export const BOARD_OUTER = 9;
export const BOARD_GAP = 3;

/** Cell size bounds. Below ~32pt a block is hard to hit; above ~48 it wastes height. */
export const MIN_CELL = 32;
export const MAX_CELL = 48;

/** Largest cell size that fits `availableWidth`, before clamping. */
export function cellSizeForWidth(spec: BoardSpec, availableWidth: number): number {
  const usable = availableWidth - BOARD_OUTER * 2 - BOARD_GAP * (spec.cols - 1);
  return Math.floor(usable / spec.cols);
}

/** Total board height for a given cell size. */
export function boardHeightForCell(spec: BoardSpec, cell: number): number {
  return BOARD_OUTER * 2 + spec.rows * cell + BOARD_GAP * (spec.rows - 1);
}

export function boardMetricsForCell(spec: BoardSpec, cell: number): BoardMetrics {
  return {
    width: BOARD_OUTER * 2 + spec.cols * cell + BOARD_GAP * (spec.cols - 1),
    height: boardHeightForCell(spec, cell),
    outer: BOARD_OUTER,
    gap: BOARD_GAP,
    cell,
    pitch: cell + BOARD_GAP,
    rows: spec.rows,
    cols: spec.cols,
  };
}

/** Top-left pixel of a cell, relative to the board container. */
export function cellOrigin(metrics: BoardMetrics, row: number, column: number) {
  return {
    x: metrics.outer + column * metrics.pitch,
    y: metrics.outer + row * metrics.pitch,
  };
}

/** Centre of cell (0, 0) — the anchor `resolveSlotDrop` measures against. */
export function firstCellCenter(metrics: BoardMetrics) {
  return {
    x: metrics.outer + metrics.cell / 2,
    y: metrics.outer + metrics.cell / 2,
  };
}

/** Corner radius used for every block, scaled to the cell. */
export const cellRadius = (cell: number) => Math.max(4, cell * 0.17);
