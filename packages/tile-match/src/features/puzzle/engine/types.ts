/**
 * Puzzle engine types.
 *
 * This module and its siblings are pure: no React, no react-native, no side
 * effects, no clock access. Everything needed to reproduce a run lives in
 * `PuzzleState`, which is why a run can be serialised, replayed, or asserted
 * against in a test.
 */

/** Block palettes. Names are gameplay-neutral so the skin can change freely. */
export type BlockColorId = 'ignition' | 'turbo' | 'coolant' | 'nitro' | 'grip';

export const BLOCK_COLOR_IDS: readonly BlockColorId[] = [
  'ignition',
  'turbo',
  'coolant',
  'nitro',
  'grip',
];

/** A coordinate on the board, or an offset within a shape. Never `{x, y}`. */
export type Cell = { row: number; column: number };

/**
 * Grid dimensions.
 *
 * The engine is dimension-agnostic, which is what let the slot field reuse all of `board.ts`
 * unchanged: a `SLOT_GRID` is one of these. The `BOARD` constant that used to live here — 8 wide and
 * 5 tall — is gone with the board itself; `slot-types.ts` owns the shipping dimensions now.
 */
export type BoardSpec = { rows: number; cols: number };

/** Flat array, length `rows * cols`, row-major. `null` means empty. */
export type Board = (BlockColorId | null)[];
export type ReadonlyBoard = readonly (BlockColorId | null)[];

export type Rotation = 0 | 1 | 2 | 3;

/** How willing the tray generator is to hand this shape out when in trouble. */
export type ShapeRole = 'standard' | 'rescue';

export type Shape = {
  id: string;
  familyId: string;
  rotation: Rotation;
  cells: readonly Cell[];
  /** Bounding box, precomputed at module load. */
  height: number;
  width: number;
  weight: number;
  role: ShapeRole;
};

export type Piece = {
  id: string;
  shapeId: string;
  cells: readonly Cell[];
  colorId: BlockColorId;
  used: boolean;
};

/**
 * What one resolved turn did. The match bridge reads this to convert puzzle
 * outcomes into race inputs, so it carries pre-computed totals rather than
 * making consumers re-derive them.
 *
 * Deliberately unchanged across the pivot from board to slot field, which is why `event-bridge.ts`,
 * `race-sim.ts`, the haptic cascade, the bullet volley and the streak callout all needed no rework:
 * a beat resolving fills this in exactly where a line clear used to.
 */
export type Resolution = {
  /** Matches the `eventSequence` of the state that produced it. */
  id: number;
  placedIndices: number[];
  clearedIndices: number[];
  clearedCells: { index: number; colorId: BlockColorId }[];
  /**
   * Always empty in slot mode — there are no lines to complete.
   *
   * Kept so the shape is stable for everything downstream. What replaced them is
   * `SlotRunState.lastGroupCount`, which the bridge reads as its `lineCount`; see there for why it
   * cannot be recovered from these two fields.
   */
  clearedRows: number[];
  clearedColumns: number[];
  /** Total cells removed. Drives the speed impulse. */
  blocksCleared: number;
  /** Cells in the placed piece. */
  blocksPlaced: number;
  /** Combo value *after* this turn resolved. */
  comboAfter: number;
  scoreDelta: number;
  perfectClear: boolean;
};


/*
 * `PuzzleStatus`, `PuzzleMode`, `TRAY_SIZE_BY_MODE`, `PuzzleState` and `PuzzleAction` were here.
 *
 * All five described a run of the board game: a persistent grid you filled up, a tray size that
 * depended on which variant was running, a `'jammed'` status for a deadlock, and actions to wipe or
 * bank the board. `slot-types.ts` replaces them with `SlotRunState` and `SlotAction`, where the run
 * is a sequence of beats rather than a grid that accumulates — so there is no status to be in, no
 * variant to pick, and nothing to reset.
 *
 * What survives above is everything that was never really about a board: cells, colours, shapes,
 * pieces, grid dimensions, and `Resolution`.
 */
