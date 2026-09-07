/**
 * Board geometry and queries. Pure, allocation-light, and safe to call from a
 * Reanimated worklet (no closures over module-level mutable state).
 */

import type { Board, BoardSpec, Cell, ReadonlyBoard } from './types';

/**
 * Row-major index. The stride is `cols`, not `rows`.
 *
 * Getting this backwards produces a board that still "works" — placements
 * succeed, clears fire — but renders transposed. It reads as a rendering bug
 * and costs hours. It is the single easiest mistake to make in this file.
 */
export const boardIndex = (spec: BoardSpec, row: number, column: number): number =>
  row * spec.cols + column;

export const cellFromIndex = (spec: BoardSpec, index: number): Cell => ({
  row: Math.floor(index / spec.cols),
  column: index % spec.cols,
});

export const boardCellCount = (spec: BoardSpec): number => spec.rows * spec.cols;

export const createEmptyBoard = (spec: BoardSpec): Board =>
  new Array<null>(boardCellCount(spec)).fill(null);

export const isBoardEmpty = (board: ReadonlyBoard): boolean =>
  board.every((cell) => cell === null);

/** Bounding box of a shape's cells, assuming they are normalised to min 0. */
export function cellsExtent(cells: readonly Cell[]): { height: number; width: number } {
  let maxRow = 0;
  let maxColumn = 0;
  for (const cell of cells) {
    if (cell.row > maxRow) maxRow = cell.row;
    if (cell.column > maxColumn) maxColumn = cell.column;
  }
  return { height: maxRow + 1, width: maxColumn + 1 };
}

/** Shift cells so the minimum row and column are both 0, then sort for stable ids. */
export function normaliseCells(cells: readonly Cell[]): Cell[] {
  let minRow = Number.POSITIVE_INFINITY;
  let minColumn = Number.POSITIVE_INFINITY;
  for (const cell of cells) {
    if (cell.row < minRow) minRow = cell.row;
    if (cell.column < minColumn) minColumn = cell.column;
  }
  return cells
    .map((cell) => ({ row: cell.row - minRow, column: cell.column - minColumn }))
    .sort((a, b) => (a.row === b.row ? a.column - b.column : a.row - b.row));
}

/** Rotate 90 degrees clockwise `quarterTurns` times, re-normalised. */
export function rotateCells(cells: readonly Cell[], quarterTurns: number): Cell[] {
  let rotated = cells.map((cell) => ({ ...cell }));
  const turns = ((quarterTurns % 4) + 4) % 4;
  for (let turn = 0; turn < turns; turn += 1) {
    rotated = rotated.map((cell) => ({ row: cell.column, column: -cell.row }));
  }
  return normaliseCells(rotated);
}

/**
 * Can this shape sit with its origin at (row, column)?
 * Fully bounds-checked — callers may pass any integer.
 */
export function canPlace(
  spec: BoardSpec,
  board: ReadonlyBoard,
  cells: readonly Cell[],
  row: number,
  column: number,
): boolean {
  for (const cell of cells) {
    const targetRow = row + cell.row;
    const targetColumn = column + cell.column;
    if (targetRow < 0 || targetRow >= spec.rows) return false;
    if (targetColumn < 0 || targetColumn >= spec.cols) return false;
    if (board[boardIndex(spec, targetRow, targetColumn)] != null) return false;
  }
  return true;
}

/** Every origin where the shape fits. Empty when it cannot be placed at all. */
export function validOrigins(
  spec: BoardSpec,
  board: ReadonlyBoard,
  cells: readonly Cell[],
): Cell[] {
  const { height, width } = cellsExtent(cells);
  const origins: Cell[] = [];
  for (let row = 0; row <= spec.rows - height; row += 1) {
    for (let column = 0; column <= spec.cols - width; column += 1) {
      if (canPlace(spec, board, cells, row, column)) origins.push({ row, column });
    }
  }
  return origins;
}

export function hasAnyOrigin(
  spec: BoardSpec,
  board: ReadonlyBoard,
  cells: readonly Cell[],
): boolean {
  const { height, width } = cellsExtent(cells);
  for (let row = 0; row <= spec.rows - height; row += 1) {
    for (let column = 0; column <= spec.cols - width; column += 1) {
      if (canPlace(spec, board, cells, row, column)) return true;
    }
  }
  return false;
}

/** Escalating praise for a combo streak. */
export function streakWord(
  combo: number,
): 'GOOD' | 'GREAT' | 'EPIC' | 'LEGENDARY' | 'GODLIKE' {
  const words = ['GOOD', 'GREAT', 'EPIC', 'LEGENDARY', 'GODLIKE'] as const;
  return words[Math.min(words.length - 1, Math.floor(Math.max(0, combo - 1) / 2))];
}

/*
 * Four line-oriented helpers were here, and all four are gone because the slot field has no lines:
 *
 *  - `completedLines` and `projectedLines`, which found and previewed full rows and columns. A
 *    footprint completing is now the unit of payout, and that is a property of a `SlotGroup` rather
 *    than of the grid — the reducer counts it directly.
 *  - `validOriginMask`, a 0/1 mask over legal origins for the board's tap-to-place Pressables. Slot
 *    placement is free-form: every origin is legal and only more or less accurate, so a mask of
 *    legal ones would be all 1s.
 *  - `clearCascadePhase`, the burst ordering. Replaced by `view/slot-metrics.ts`'s
 *    `buildSlotBurst`, which sequences cells one at a time in the order they were filled rather than
 *    by position. This one returns `Infinity` for a cell in no cleared line — which the burst clamps
 *    to its *maximum* stagger, and every slot cell is in no line.
 */
