import { MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import type { MissionWindow } from '@/features/mission-mechanics/board-window';
import type { MergeItemDefinition, MergeWorldState } from '@/types/merge-world';
import type { DarkWispKind, WispPlan } from '@/types/mission-mechanic';
import { windowArea } from './pulse';

/**
 * Where a Dark Wisp spreads its Mist after the player's merge (`docs/encounter-tactics.md`). A wisp is a source of
 * Mist (only a Drifter moves, and only through its own Mist), and each kind is one sentence.
 *
 * - Creeper: Mists one free cell beside its Mist (the nearest to it; then the one with the most pieces around).
 * - Spore Wisp: a Creeper that spreads two cells every third merge.
 * - Root Wisp: its Mist comes in Thick (two clearing effects to lift).
 * - Snare Wisp: it reaches for a piece beside its Mist first; the piece is locked until that Mist is cleared.
 * - Drifter: it drifts one cell through its own Mist, away from the player's pieces, leaving Mist where it was; with
 *   no Mist beside it to drift into, it spreads like a Creeper. Chase it: clear the Mist around it and it has nowhere
 *   to go.
 *
 * Ties are broken by `pick`, a seeded choice, so the cell shown is the cell it takes. Pure.
 */
export type SpreadContext = {
  board: MergeWorldState;
  window: MissionWindow;
  /** The wisp's own cell. */
  nest: number;
  /** The merge this plan answers, counted from 1 (a Spore Wisp's third, sixth... spread two). */
  turn: number;
  pick: <T>(list: readonly T[], label: string) => T | null;
  items?: ReadonlyMap<string, MergeItemDefinition>;
};

const encounterMist = (board: MergeWorldState, cell: number) => { const mist = board.board[cell]?.mist; return mist?.kind === 'encounter' ? mist : null; };

/** A free cell: open, empty, no Mist. */
export function isFreeCell(board: MergeWorldState, cell: number): boolean {
  const entry = board.board[cell];
  return Boolean(entry) && !entry!.locked && !entry!.mist && !entry!.occupant;
}

/** A wisp's Mist: every Mist cell joined to its cell along the board, with its steps from it. */
export function wispRegion(board: MergeWorldState, nest: number, window: MissionWindow): Map<number, number> {
  const region = new Map<number, number>();
  if (nest < 0 || !encounterMist(board, nest)) return region;
  region.set(nest, 0);
  const queue = [nest];
  while (queue.length) {
    const cell = queue.shift()!;
    for (const other of windowArea(cell, window, 'cross')) {
      if (region.has(other) || !encounterMist(board, other)) continue;
      region.set(other, region.get(cell)! + 1);
      queue.push(other);
    }
  }
  return region;
}

/** The free cells touching a wisp's Mist, each with its steps from the wisp: where its Mist spreads next. */
export function wispFrontier(board: MergeWorldState, nest: number, window: MissionWindow): Map<number, number> {
  const region = wispRegion(board, nest, window);
  const frontier = new Map<number, number>();
  for (const [cell, steps] of region) {
    for (const other of windowArea(cell, window, 'cross')) {
      if (!isFreeCell(board, other)) continue;
      frontier.set(other, Math.min(frontier.get(other) ?? Number.POSITIVE_INFINITY, steps + 1));
    }
  }
  return frontier;
}

/** Loose pieces touching a wisp's Mist (a Snare Wisp's reach). */
function piecesTouching(board: MergeWorldState, nest: number, window: MissionWindow, items: ReadonlyMap<string, MergeItemDefinition>) {
  const touching = new Set([...wispRegion(board, nest, window).keys()].flatMap((cell) => windowArea(cell, window, 'cross')));
  return [...touching].flatMap((cell) => {
    const entry = board.board[cell];
    if (!entry || entry.locked || entry.mist || entry.occupant?.kind !== 'item') return [];
    return [{ cell, tier: items.get(entry.occupant.definitionId)?.tier ?? 1 }];
  });
}

/** Spore Wisp: two cells on every third merge. */
export const sporeBurst = (turn: number) => turn % 3 === 0;

/** Mist a Drifter can drift into: light, Thick or root Mist beside it (never a locked piece's, never another wisp). */
const DRIFTABLE = new Set(['light', 'dense', 'root']);

/** A Drifter's step: the Mist cell beside it furthest from the player's pieces; null when it has no Mist to drift into. */
export function planDrift(ctx: SpreadContext): number | null {
  const pieces = ctx.window.cellIndices.filter((cell) => { const entry = ctx.board.board[cell]; return Boolean(entry) && !entry!.locked && !entry!.mist && entry!.occupant?.kind === 'item'; });
  const steps = windowArea(ctx.nest, ctx.window, 'cross').filter((cell) => { const mist = encounterMist(ctx.board, cell); return Boolean(mist) && DRIFTABLE.has(mist!.type); });
  if (!steps.length) return null;
  const distance = (cell: number) => (pieces.length ? Math.min(...pieces.map((piece) => {
    const a = ctx.window.cellIndices.indexOf(cell);
    const b = ctx.window.cellIndices.indexOf(piece);
    return Math.abs((a % ctx.window.columns) - (b % ctx.window.columns)) + Math.abs(Math.floor(a / ctx.window.columns) - Math.floor(b / ctx.window.columns));
  })) : 0);
  const best = Math.max(...steps.map(distance));
  return ctx.pick(steps.filter((cell) => distance(cell) === best), 'drift');
}

/** Where this wisp's Mist goes after the player's next merge (a Drifter: where it drifts). */
export function planSpread(kind: DarkWispKind, index: number, ctx: SpreadContext): WispPlan {
  if (kind === 'drifter') {
    const to = planDrift(ctx);
    if (to != null) return { wisp: index, kind: 'move', cells: [to] };
  }
  const items = ctx.items ?? MERGE_ITEMS_BY_ID;
  const cells: number[] = [];
  let board = ctx.board;
  const amount = kind === 'spore' && sporeBurst(ctx.turn) ? 2 : 1;
  const crowd = (cell: number) => windowArea(cell, ctx.window, 'cross').filter((other) => board.board[other]?.occupant?.kind === 'item').length;
  for (let step = 0; step < amount; step += 1) {
    let cell: number | null = null;
    if (kind === 'snare') {
      const pieces = piecesTouching(board, ctx.nest, ctx.window, items).filter((piece) => !cells.includes(piece.cell));
      const top = Math.max(-1, ...pieces.map((piece) => piece.tier));
      cell = ctx.pick(pieces.filter((piece) => piece.tier === top).map((piece) => piece.cell), `snare:${step}`);
    }
    if (cell == null) {
      const frontier = wispFrontier(board, ctx.nest, ctx.window);
      for (const taken of cells) frontier.delete(taken);
      if (frontier.size) {
        const nearest = Math.min(...frontier.values());
        const close = [...frontier].filter(([, steps]) => steps === nearest).map(([entry]) => entry);
        const most = Math.max(...close.map(crowd));
        cell = ctx.pick(close.filter((entry) => crowd(entry) === most), `spread:${step}`);
      }
    }
    if (cell == null) break;
    cells.push(cell);
    // The next cell of this turn grows from the Mist the first will have laid.
    const next = [...board.board];
    next[cell] = { ...next[cell]!, locked: true, mist: { kind: 'encounter', type: 'light', hp: 1 } };
    board = { ...board, board: next };
  }
  if (!cells.length) return { wisp: index, kind: 'rest', cells: [] };
  return { wisp: index, kind: kind === 'root' ? 'shroud' : 'corrupt', cells, ...(cells.length > 1 ? { amount: cells.length } : {}) };
}
