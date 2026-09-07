/**
 * The fuse variety: one footprint split into two row-halves, each filled by its own piece.
 *
 * A backing plate behind the pair marks them as one job — the player is completing a single
 * combined shape, not two independent footprints. The split is always horizontal (top / bottom),
 * and neither half can be rotated, so the shapes alone dictate correct placement.
 *
 * The pure half is small because the mechanic is entirely geometric: no timer, no gate, no
 * random event during the beat. `shape` does the work; `deal` only records which groups form
 * the pair so `FuseLayer` can draw the plate behind the right cells.
 *
 * ## The perfect-solution guarantee
 *
 * Returning null from `splitGroup` falls through to passing the original group unchanged, so the
 * beat still has a valid answer. In practice the left/right zones cannot produce a single-row
 * footprint at today's minimum cell counts, so the split succeeds on every dealt shape.
 * `beatHasPerfectSolution` is asserted in `slot-engine.test.ts`.
 *
 * ## RNG discipline
 *
 * Neither `shape` nor `deal` consume a roll. The second colour is derived arithmetically from the
 * first (next index in `BLOCK_COLOR_IDS`), so the generator advances by nothing — and advances
 * identically whether or not the variety fires, which is the contract's invariant.
 */

// Pure module — `.ts` extension imports so it runs under `node --test`.
import { defineVariety } from '../contract';
import type { BeatShape, DealContext } from '../contract';
import type { SlotGroup } from '../../engine/slot-types';
import type { Cell, Piece } from '../../engine/types';

export type FuseData = {
  /** The two group ids that form the fused footprint, top half first. */
  groupIds: [string, string];
};

/**
 * Split one group at the row midpoint, producing two non-empty halves.
 *
 * The second half gets the next colour in the ring so the two pieces are visually distinct in
 * the tray. No RNG is consumed — the colour is a pure function of the first piece's colour index.
 */
function splitGroup(
  group: SlotGroup,
  piece: Piece,
  cols: number,
): { groupA: SlotGroup; groupB: SlotGroup; pieceA: Piece; pieceB: Piece } | null {
  const coords = group.cells.map((idx) => ({
    row: Math.floor(idx / cols),
    column: idx % cols,
  }));
  coords.sort((a, b) => a.row - b.row || a.column - b.column);

  const rows = [...new Set(coords.map((c) => c.row))].sort((a, b) => a - b);
  if (rows.length < 2) return null;

  const splitRow = rows[Math.floor(rows.length / 2)];
  const topCoords = coords.filter((c) => c.row < splitRow);
  const bottomCoords = coords.filter((c) => c.row >= splitRow);
  if (topCoords.length === 0 || bottomCoords.length === 0) return null;

  /**
   * Each half's origin is the top-left of **its own** cells, not the whole shape's.
   *
   * `originA` used to be `group.origin` — the bounding box of the *undivided* footprint — and that was a real bug
   * rather than a shortcut. The two are the same only when the top half happens to touch the shape's leftmost
   * column, which most shapes do and some do not: an S, a Z, or a T on its side has an indented first row.
   *
   * For those, `pieceA.cells` came out starting at column 1 instead of 0. The arithmetic stayed self-consistent —
   * `scorePlacement` adds the origin to each cell, so filling still worked *if* the drop landed on the exact
   * origin — but the **drag layer could not aim at it**. `dropFootprintFor` takes a piece's centre to be half its
   * extent, and `cellsExtent` documents that it assumes a minimum of zero on both axes, so an un-normalised piece
   * reports a footprint one cell wider than it is and quantises the finger to an origin a cell away from the ghost.
   *
   * The player aimed correctly and the shape refused them, on some shapes and not others — which is exactly how it
   * was reported. Deriving both origins the same way makes both pieces normalised and leaves the absolute cells
   * unchanged.
   */
  const originA: Cell = {
    row: Math.min(...topCoords.map((c) => c.row)),
    column: Math.min(...topCoords.map((c) => c.column)),
  };
  const originB: Cell = {
    row: Math.min(...bottomCoords.map((c) => c.row)),
    column: Math.min(...bottomCoords.map((c) => c.column)),
  };

  // Both halves share the same colour — no colour hint about which piece goes where.
  // Shape alone guides placement, which is the whole point of the mechanic.
  const groupA: SlotGroup = {
    ...group,
    id: `${group.id}:fuse:a`,
    pieceId: `${piece.id}:fuse:a`,
    cells: topCoords.map((c) => c.row * cols + c.column),
    origin: originA,
    filled: [],
  };

  const groupB: SlotGroup = {
    ...group,
    id: `${group.id}:fuse:b`,
    pieceId: `${piece.id}:fuse:b`,
    cells: bottomCoords.map((c) => c.row * cols + c.column),
    origin: originB,
    filled: [],
  };

  const pieceA: Piece = {
    ...piece,
    id: `${piece.id}:fuse:a`,
    shapeId: `${piece.shapeId}:fuse:a`,
    cells: topCoords.map((c) => ({
      row: c.row - originA.row,
      column: c.column - originA.column,
    })),
    used: false,
  };

  const pieceB: Piece = {
    ...piece,
    id: `${piece.id}:fuse:b`,
    shapeId: `${piece.shapeId}:fuse:b`,
    cells: bottomCoords.map((c) => ({
      row: c.row - originB.row,
      column: c.column - originB.column,
    })),
    used: false,
  };

  return { groupA, groupB, pieceA, pieceB };
}

export const FUSE_VARIETY = defineVariety<FuseData>({
  id: 'fuse',

  /**
   * Split the first group into two row-halves.
   *
   * Only the first group is reshaped. A fuse level keeps plan.slots at 1, so there is exactly
   * one group entering and two leaving — a count that stays within the camera's two-footprint
   * tuning cap. If the shape cannot be split (single row), the group passes through unchanged
   * and the beat plays as a normal single.
   */
  shape(ctx: DealContext, _strength: number): BeatShape {
    if (ctx.groups.length === 0) {
      return { groups: [], tray: [], rngState: ctx.rngState };
    }

    const group = ctx.groups[0];
    const piece = ctx.tray.find((p) => p.id === group.pieceId);
    if (!piece) {
      return { groups: [...ctx.groups], tray: [...ctx.tray], rngState: ctx.rngState };
    }

    const split = splitGroup(group, piece, ctx.grid.cols);
    if (!split) {
      return { groups: [...ctx.groups], tray: [...ctx.tray], rngState: ctx.rngState };
    }

    const restGroups = ctx.groups.slice(1);
    const restPieces = ctx.tray.filter((p) => p.id !== piece.id);

    return {
      groups: [split.groupA, split.groupB, ...restGroups],
      tray: [split.pieceA, split.pieceB, ...restPieces],
      rngState: ctx.rngState,
    };
  },

  /**
   * Record the two group ids so the view can draw the backing plate.
   *
   * Called after `shape`, so ctx.groups[0] and [1] are already the split halves. No RNG consumed.
   */
  deal(ctx: DealContext, _strength: number): { data: FuseData; rngState: number } {
    return {
      data: {
        groupIds: [ctx.groups[0]?.id ?? '', ctx.groups[1]?.id ?? ''],
      },
      rngState: ctx.rngState,
    };
  },
});
