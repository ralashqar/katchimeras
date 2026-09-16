import { OPENING_MERGE_WINDOW_CELLS, OPENING_MERGE_WINDOW_COLUMNS } from '@/features/onboarding/opening-mist';
import type { MergeWorldState } from '@/types/merge-world';
import type { MissionMechanicMove } from '@/types/mission-mechanic';

/** The window of the canonical grid a docked board shows: how many columns, how many rows, which cells. */
export type MissionWindow = { columns: number; rows: number; cellIndices: readonly number[] };

/** The docked board's window: the opening's five columns, three or four rows from the top. */
export function missionWindow(rows: 3 | 4 = 4): MissionWindow {
  return { columns: OPENING_MERGE_WINDOW_COLUMNS, rows, cellIndices: OPENING_MERGE_WINDOW_CELLS.slice(0, OPENING_MERGE_WINDOW_COLUMNS * rows) };
}

/** The column a cell sits in, or null when the cell is outside the window. */
export function windowColumn(window: MissionWindow, cell: number): number | null {
  const index = window.cellIndices.indexOf(cell);
  return index >= 0 ? index % window.columns : null;
}

/** Every loose item on the window, by cell. */
export function windowItems(state: MergeWorldState, cells: readonly number[]): { cell: number; definitionId: string }[] {
  return cells.flatMap((index) => {
    const cell = state.board[index];
    return cell && !cell.locked && !cell.mist && cell.occupant?.kind === 'item' ? [{ cell: index, definitionId: cell.occupant.definitionId }] : [];
  });
}

/**
 * Every sleeping cell whose match is loose on the board, lowest first, with the
 * loose piece that wakes it. The first is the drag the finger shows.
 */
export function missionWakes(state: MergeWorldState, cells: readonly number[]): MissionMechanicMove[] {
  const items = windowItems(state, cells);
  const sleepers = cells.filter((index) => state.board[index]?.mist?.kind === 'echo').sort((a, b) => b - a);
  const wakes: MissionMechanicMove[] = [];
  for (const to of sleepers) {
    const mist = state.board[to]!.mist;
    if (mist?.kind !== 'echo') continue;
    const from = items.find((item) => item.definitionId === mist.definitionId);
    if (from) wakes.push({ kind: 'wake', from: from.cell, to, definitionId: mist.definitionId });
  }
  return wakes;
}

/** Every pair of loose twins on the window, closest first. */
export function missionPairs(state: MergeWorldState, cells: readonly number[]): (MissionMechanicMove & { distance: number })[] {
  const byDefinition = new Map<string, number[]>();
  for (const item of windowItems(state, cells)) byDefinition.set(item.definitionId, [...(byDefinition.get(item.definitionId) ?? []), item.cell]);
  const pairs: (MissionMechanicMove & { distance: number })[] = [];
  for (const [definitionId, indices] of byDefinition) {
    for (let a = 0; a < indices.length; a++) {
      for (let b = a + 1; b < indices.length; b++) {
        const [ax, ay] = [indices[a]! % 7, Math.floor(indices[a]! / 7)];
        const [bx, by] = [indices[b]! % 7, Math.floor(indices[b]! / 7)];
        pairs.push({ kind: 'merge', from: indices[a]!, to: indices[b]!, definitionId, distance: Math.hypot(ax - bx, ay - by) });
      }
    }
  }
  return pairs.sort((a, b) => a.distance - b.distance);
}
