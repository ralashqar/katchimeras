import { MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import { windowItems, type MissionWindow } from '@/features/mission-mechanics/board-window';
import type { EncounterDefinition } from '@/types/encounter';
import type { MergeItemDefinition, MergeWorldState } from '@/types/merge-world';
import type { EncounterRunState, EncounterStatus } from './encounter-run';

/**
 * The board's cache: what arrives when the local pieces are spent and the
 * board is not done. Authored, it brings the chapter's request or twins of
 * the highest pieces; unauthored, it is the rescue every board has, twins
 * of the two highest loose pieces, so a board is never lost to luck alone.
 * It lands on the authored cells first, then any free cell. Opens once per attempt.
 */
export const RESCUE_TWINS_MAX = 2;

/** One twin for each of the board's highest loose pieces (distinct kinds, at most `max`) that can still grow. */
export function twinRequest(board: MergeWorldState, window: MissionWindow, max: number, items: ReadonlyMap<string, MergeItemDefinition> = MERGE_ITEMS_BY_ID): { definitionId: string; quantity: number }[] {
  const loose = new Map<string, number>();
  for (const item of windowItems(board, window.cellIndices)) {
    const definition = items.get(item.definitionId);
    if (!definition?.nextItemId) continue;
    loose.set(item.definitionId, definition.tier);
  }
  return [...loose.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, Math.max(1, Math.floor(max))).map(([definitionId]) => ({ definitionId, quantity: 1 }));
}

/** Free cells for what arrives: the authored landing cells first, then the window in order. */
export function landingCells(board: MergeWorldState, window: MissionWindow, preferred: readonly number[] = [], count: number): number[] {
  const free = (index: number) => { const cell = board.board[index]; return Boolean(cell) && !cell.locked && !cell.mist && !cell.occupant; };
  const first = preferred.filter((cell) => window.cellIndices.includes(cell) && free(cell));
  const rest = window.cellIndices.filter((cell) => free(cell) && !first.includes(cell));
  return [...first, ...rest].slice(0, Math.max(0, count));
}

/** What the cache brings, as pieces to land, each on its cell; empty when nothing can land. */
export function cacheEntries(encounter: EncounterDefinition, board: MergeWorldState, window: MissionWindow, items: ReadonlyMap<string, MergeItemDefinition> = MERGE_ITEMS_BY_ID): { cell: number; definitionId: string }[] {
  const contents = encounter.cache?.contents;
  const wanted = contents?.kind === 'items'
    ? contents.items.flatMap((entry) => Array.from({ length: Math.max(0, Math.floor(entry.quantity)) }, () => entry.definitionId)).filter((id) => items.has(id))
    : twinRequest(board, window, contents?.kind === 'twins' ? contents.max : RESCUE_TWINS_MAX, items).map((entry) => entry.definitionId);
  const cells = landingCells(board, window, encounter.cache?.landOn ?? [], wanted.length);
  return cells.map((cell, index) => ({ cell, definitionId: wanted[index]! }));
}

/**
 * The rescue opens on a stuck board once an attempt; in a tactics battle every time the board runs dry, so a level is
 * lost to the Mist, never to running out of pieces (each rescue still caps the grade).
 */
export const canOpenCache = (status: EncounterStatus, run: EncounterRunState): boolean => status === 'stuck' && (!run.cacheOpened || Boolean(run.tactics));

/** The cache opened: its pieces on the board, the attempt remembering it. */
export function openCache(encounter: EncounterDefinition, board: MergeWorldState, window: MissionWindow, run: EncounterRunState, items: ReadonlyMap<string, MergeItemDefinition> = MERGE_ITEMS_BY_ID): { board: MergeWorldState; run: EncounterRunState; placed: { cell: number; definitionId: string }[] } {
  const placed = cacheEntries(encounter, board, window, items);
  const cells = [...board.board];
  let nextInstance = board.nextInstance;
  for (const entry of placed) {
    cells[entry.cell] = { ...cells[entry.cell]!, occupant: { kind: 'item', instanceId: `cache:${nextInstance}`, definitionId: entry.definitionId } };
    nextInstance += 1;
  }
  return { board: { ...board, board: cells, nextInstance, revision: board.revision + 1 }, run: { ...run, cacheOpened: true }, placed };
}
