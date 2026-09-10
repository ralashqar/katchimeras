import type { IslandCampaignDefinition, RestorationBoardDefinition } from '@/constants/island-campaigns/types';
import { islandCampaignChapter } from '@/constants/island-campaigns/helpers';
import type { FtueStepDefinition } from '@/features/onboarding/ftue-types';
import { createOpeningMissionState } from '@/features/onboarding/opening-mission-state';
import { closestOpeningPair, OPENING_BOARD_LAYOUT, OPENING_MERGE_WINDOW_CELLS } from '@/features/onboarding/opening-mist';
import type { IslandRestorationProgress, MergeBoardCell, MergeWorldState, MossproutNatureIslandLevel } from '@/types/merge-world';

/**
 * A friend's restoration board: the same docked board the mist missions use.
 * Merges fill the bar. Some cells are half-hidden in mist with an item inside
 * (an ordinary Dream Echo): match it to unlock the cell, and that match counts
 * too. The local pieces never reach the bar on their own; when the board is
 * spent the chapter's Main Board order brings what unlocks the rest.
 * Pure helpers; the Kingdom owns the store and the dock.
 */
export const RESTORATION_WINDOW_5x3: readonly number[] = [
  15, 16, 17, 18, 19,
  22, 23, 24, 25, 26,
  29, 30, 31, 32, 33,
];

export function restorationWindowCells(rows: 3 | 4): readonly number[] {
  return rows === 3 ? RESTORATION_WINDOW_5x3 : OPENING_MERGE_WINDOW_CELLS;
}

export function restorationLayout(rows: 3 | 4) {
  return {
    ...OPENING_BOARD_LAYOUT,
    accessibilityLabel: `Restoration board, five columns by ${rows === 3 ? 'three' : 'four'} rows`,
    rows,
    cellIndices: restorationWindowCells(rows),
  } as const;
}

export function restorationStorageKey(campaignId: string, level: MossproutNatureIslandLevel): string {
  return `katchimeras.mist-mission.${campaignId}.${level}.v1`;
}

/**
 * The run a saved board belongs to. It carries the stage's start time and a
 * fingerprint of the authored board, so a restarted stage (a new start time)
 * or a re-authored board (new contents) begins fresh instead of resurrecting
 * an earlier play's cells and merge count under a request they no longer fit.
 */
export function restorationRunId(campaignId: string, level: MossproutNatureIslandLevel, startedAt: number, definition: RestorationBoardDefinition): string {
  return `${campaignId}:${level}:${Math.floor(startedAt)}:${restorationFingerprint(definition)}`;
}

function restorationFingerprint(definition: RestorationBoardDefinition): string {
  const text = JSON.stringify([definition.rows, definition.merges, definition.items, definition.echoes, definition.deliveryCells]);
  let hash = 5381;
  for (let index = 0; index < text.length; index += 1) hash = ((hash * 33) ^ text.charCodeAt(index)) >>> 0;
  return hash.toString(36);
}

/** The board a chapter starts with: sealed outside its window, the misted cells holding their items, the local pieces placed. */
export function createRestorationState(definition: RestorationBoardDefinition, now = Date.now()): MergeWorldState {
  const base = createOpeningMissionState(now);
  const window = new Set(restorationWindowCells(definition.rows));
  const board: MergeBoardCell[] = base.board.map((cell, index) => (window.has(index)
    ? { ...cell, locked: false, blocker: null, mist: null, occupant: null }
    : { ...cell, locked: true, blocker: null, mist: cell.mist ?? { kind: 'dormant' as const }, occupant: null }));
  definition.items.forEach(({ cell, definitionId }, index) => {
    board[cell] = { ...board[cell], occupant: { kind: 'item', instanceId: `restoration-item-${index}`, definitionId } };
  });
  // Owned by Mossprout: the board normaliser drops an echo with no known owner on reload.
  for (const echo of definition.echoes) {
    board[echo.cell] = { ...board[echo.cell], locked: true, blocker: null, occupant: null, mist: { kind: 'echo', id: echo.id, definitionId: echo.definitionId, ownerCharacterId: 'mossprout' } };
  }
  return { ...base, board };
}

/**
 * A board saved before its echoes had an owner reloads them as plain mist.
 * An authored echo whose cell is still locked and empty was never matched
 * (a matched one is unlocked and holds the next tier), so it is put back.
 */
export function restoreRestorationEchoes(definition: RestorationBoardDefinition, state: MergeWorldState): MergeWorldState {
  let board: MergeBoardCell[] | null = null;
  for (const echo of definition.echoes) {
    const cell = state.board[echo.cell];
    if (!cell || !cell.locked || cell.occupant || cell.mist?.kind === 'echo') continue;
    board ??= [...state.board];
    board[echo.cell] = { ...cell, blocker: null, mist: { kind: 'echo', id: echo.id, definitionId: echo.definitionId, ownerCharacterId: 'mossprout' } };
  }
  return board ? { ...state, board } : state;
}

/** Merges counted toward the bar, clamped to the chapter's requirement. */
export function restorationProgress(definition: RestorationBoardDefinition, merges: number): { current: number; total: number } {
  return { current: Math.max(0, Math.min(definition.merges, Math.floor(merges))), total: definition.merges };
}

export function restorationComplete(definition: RestorationBoardDefinition, merges: number): boolean {
  return merges >= definition.merges;
}

export type RestorationMove = { kind: 'unlock' | 'merge'; from: number; to: number };

function freeItems(state: MergeWorldState, cells: readonly number[]) {
  return cells.flatMap((index) => {
    const cell = state.board[index];
    return cell && !cell.locked && !cell.mist && cell.occupant?.kind === 'item' ? [{ cell: index, definitionId: cell.occupant.definitionId }] : [];
  });
}

/** The misted cells still holding an item, and what each one wants. */
export function restorationEchoes(state: MergeWorldState, cells: readonly number[] = OPENING_MERGE_WINDOW_CELLS): { id: string; cell: number; definitionId: string }[] {
  return cells.flatMap((index) => {
    const mist = state.board[index]?.mist;
    return mist?.kind === 'echo' ? [{ id: mist.id, cell: index, definitionId: mist.definitionId }] : [];
  });
}

/** The next thing to do: unlock a misted cell when something matches it, else the closest twin pair. */
export function restorationNextMove(state: MergeWorldState, cells: readonly number[] = OPENING_MERGE_WINDOW_CELLS): RestorationMove | null {
  const items = freeItems(state, cells);
  for (const echo of restorationEchoes(state, cells)) {
    const item = items.find((candidate) => candidate.definitionId === echo.definitionId);
    if (item) return { kind: 'unlock', from: item.cell, to: echo.cell };
  }
  const pair = closestOpeningPair(state, cells);
  return pair ? { kind: 'merge', from: pair.from, to: pair.to } : null;
}

/** The board is spent and the bar is not full: the Main Board has to bring more. */
export function restorationCheckpointReached(definition: RestorationBoardDefinition, state: MergeWorldState, merges: number): boolean {
  if (restorationComplete(definition, merges)) return false;
  const cells = restorationWindowCells(definition.rows);
  if (cells.some((index) => state.board[index]?.occupant?.kind === 'generator')) return false;
  return restorationNextMove(state, cells) == null;
}

/** Delivered items not yet placed on the board. */
export function deliveriesToPlace(progress: IslandRestorationProgress, placed: number): string[] {
  return progress.delivered.slice(Math.max(0, placed)).map((entry) => entry.definitionId);
}

/** Where delivered items land: the authored delivery cells first, then any free window cell. */
export function restorationDeliveryCells(definition: RestorationBoardDefinition, state: MergeWorldState, count: number): number[] {
  const window = restorationWindowCells(definition.rows);
  const free = (index: number) => { const cell = state.board[index]; return Boolean(cell) && !cell.locked && !cell.mist && !cell.occupant; };
  const preferred = definition.deliveryCells.filter(free);
  const rest = window.filter((index) => free(index) && !preferred.includes(index));
  return [...preferred, ...rest].slice(0, count);
}

/**
 * The beat the restoration board projects. A friend's board carries no
 * tutorial: the first two mist missions taught merging and misted cells, so
 * here the board is free from the first move. The only step is the lock once
 * the bar is full, while the last item flies into the tile.
 */
export function restorationBoardStep(
  campaign: IslandCampaignDefinition,
  level: MossproutNatureIslandLevel,
  state: MergeWorldState | null,
  merges: number,
): FtueStepDefinition | null {
  const chapter = islandCampaignChapter(campaign, level);
  const definition = chapter?.restoration;
  if (!state || !chapter || !definition) return null;
  const id = `restoration.${campaign.campaignId}.${level}`;
  if (restorationComplete(definition, merges)) {
    return { id: `${id}.complete`, surface: 'merge', actions: [], guide: { eyebrow: campaign.residentName, title: 'The mist is clearing.', body: 'Watch the garden grow.' }, interaction: { mode: 'blocked' } };
  }
  return { id: `${id}.free`, surface: 'merge', actions: [], guide: { eyebrow: '', title: '', body: '' }, interaction: { mode: 'none' } };
}
