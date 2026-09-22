import { MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import type { MissionWindow } from '@/features/mission-mechanics/board-window';
import { isPlantItem } from '@/features/mission-mechanics/dark-wisps';
import type { EncounterMistHolds } from '@/types/encounter';
import type { MergeBoardCell, MergeItemDefinition, MergeWorldState } from '@/types/merge-world';

/**
 * An encounter's own Mist and how merges wear it down. Light Mist goes on a
 * hit; dense takes two; root Mist only listens to plant merges; wisp-bound
 * Mist falls with its wisp. A cell that opens gives up what it held: an
 * item lands there, a spawner is placed by the caller. Pure over the board.
 */
export type MistOpened = { cell: number; holds?: EncounterMistHolds };

const encounterMist = (cell: MergeBoardCell | undefined) => (cell?.mist?.kind === 'encounter' ? cell.mist : null);

/** The cells sharing an edge with `cell` on the canonical board, kept to the window. */
export function windowNeighbours(cell: number, window: MissionWindow): number[] {
  const index = window.cellIndices.indexOf(cell);
  if (index < 0) return [];
  const column = index % window.columns;
  const row = Math.floor(index / window.columns);
  const at = (c: number, r: number) => (c >= 0 && c < window.columns && r >= 0 && r < window.rows ? [window.cellIndices[r * window.columns + c]!] : []);
  return [...at(column, row - 1), ...at(column, row + 1), ...at(column - 1, row), ...at(column + 1, row)];
}

/** The cell opened: unlocked, its Mist gone, and any item it held placed. */
export function openMistCell(board: MergeWorldState, cell: number): { board: MergeWorldState; opened: MistOpened } {
  const current = board.board[cell]!;
  const mist = encounterMist(current);
  const holds = mist?.holds;
  const cells = [...board.board];
  const item = holds?.kind === 'item' ? { kind: 'item' as const, instanceId: `mist-held:${board.nextInstance}`, definitionId: holds.definitionId } : null;
  cells[cell] = { ...current, locked: false, blocker: null, mist: null, occupant: item ?? current.occupant };
  return { board: { ...board, board: cells, nextInstance: item ? board.nextInstance + 1 : board.nextInstance, revision: board.revision + 1 }, opened: { cell, ...(holds ? { holds } : {}) } };
}

/** One hit on a Mist cell: opened at zero, worn otherwise. */
function wear(board: MergeWorldState, cell: number, amount: number): { board: MergeWorldState; opened: MistOpened | null } {
  const mist = encounterMist(board.board[cell]);
  if (!mist) return { board, opened: null };
  if (mist.hp - amount <= 0) return openMistCell(board, cell);
  const cells = [...board.board];
  cells[cell] = { ...cells[cell]!, mist: { ...mist, hp: mist.hp - amount } };
  return { board: { ...board, board: cells, revision: board.revision + 1 }, opened: null };
}

/**
 * A merge's result beside the Mist: every neighbouring Mist cell takes a
 * hit, root Mist only from a plant, wisp-bound Mist never.
 */
export function clearMistAround(board: MergeWorldState, mergedCell: number, resultDefinitionId: string, window: MissionWindow, items: ReadonlyMap<string, MergeItemDefinition> = MERGE_ITEMS_BY_ID): { board: MergeWorldState; opened: MistOpened[]; worn: number[] } {
  const plant = isPlantItem(resultDefinitionId, items);
  let next = board;
  const opened: MistOpened[] = [];
  const worn: number[] = [];
  for (const cell of windowNeighbours(mergedCell, window)) {
    const mist = encounterMist(next.board[cell]);
    if (!mist || mist.type === 'wisp-bound' || (mist.type === 'root' && !plant)) continue;
    const result = wear(next, cell, 1);
    next = result.board;
    if (result.opened) opened.push(result.opened); else worn.push(cell);
  }
  return { board: next, opened, worn };
}

/** Wisp-bound Mist whose wisps have fallen lets go. */
export function clearBoundMist(board: MergeWorldState, wispIds: readonly string[], window: MissionWindow): { board: MergeWorldState; opened: MistOpened[] } {
  if (!wispIds.length) return { board, opened: [] };
  let next = board;
  const opened: MistOpened[] = [];
  for (const cell of window.cellIndices) {
    const mist = encounterMist(next.board[cell]);
    if (!mist || mist.type !== 'wisp-bound' || !mist.wispId || !wispIds.includes(mist.wispId)) continue;
    const result = openMistCell(next, cell);
    next = result.board;
    opened.push(result.opened);
  }
  return { board: next, opened };
}

/**
 * Mist revealed outright (Trailfinder, a Beacon Wisp, the Root Cellar): the
 * thinnest encounter Mist first, in cell order; then full mist that hides a
 * sleeper bursts open into it. Wisp-bound Mist is never revealed this way.
 */
export function revealMistCells(board: MergeWorldState, window: MissionWindow, count: number): { board: MergeWorldState; opened: MistOpened[] } {
  let next = board;
  const opened: MistOpened[] = [];
  let left = Math.max(0, Math.floor(count));
  const candidates = window.cellIndices
    .map((cell) => ({ cell, mist: encounterMist(next.board[cell]) }))
    .filter((entry): entry is { cell: number; mist: NonNullable<ReturnType<typeof encounterMist>> } => Boolean(entry.mist) && entry.mist!.type !== 'wisp-bound')
    .sort((a, b) => a.mist.hp - b.mist.hp || a.cell - b.cell);
  for (const { cell } of candidates) {
    if (left <= 0) break;
    const result = openMistCell(next, cell);
    next = result.board;
    opened.push(result.opened);
    left -= 1;
  }
  for (const cell of window.cellIndices) {
    if (left <= 0) break;
    const veiled = next.board[cell]?.mist;
    if (veiled?.kind !== 'veiled') continue;
    const cells = [...next.board];
    cells[cell] = { ...cells[cell]!, locked: true, blocker: null, occupant: null, mist: { kind: 'echo', ...veiled.echo } };
    next = { ...next, board: cells, revision: next.revision + 1 };
    opened.push({ cell });
    left -= 1;
  }
  return { board: next, opened };
}

/** Encounter Mist cells still on the window. */
export function encounterMistLeft(board: MergeWorldState, window: MissionWindow): number {
  return window.cellIndices.filter((cell) => encounterMist(board.board[cell])).length;
}
